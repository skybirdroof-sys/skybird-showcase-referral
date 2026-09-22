/* Talon — server-side Google Sheet CSV proxy.
 *
 * Why a function instead of fetching Google from the browser: no CORS
 * surprises on a TV that sits open all day, the Sheet id stays out of the
 * bundle, and responses can carry a short shared cache.
 *
 * Env:
 *   SHEET_ID        (required) Google Sheet id, Sheet shared "anyone with link can view"
 *   SHEET_TAB_KPI / SHEET_TAB_TOP5 / SHEET_TAB_REST / SHEET_TAB_META (optional) tab names
 *   SHEET_GID_KPI / SHEET_GID_TOP5 / SHEET_GID_REST / SHEET_GID_META (optional) tab gids,
 *                   which survive a tab rename and win over the name when set
 *
 * GET /api/sheet?tab=KPI  ->  text/csv
 */

/* The tab list, the gviz URL shape and the not-CSV guard live in one place so
 * the watchdog in health.js cannot disagree with this proxy about what a Talon
 * tab is. See netlify/lib/tabs.js. */
const { env, slots, gvizUrl, notCsv } = require('../lib/tabs');

const text = (statusCode, body, extraHeaders = {}) => ({
  statusCode,
  headers: {
    'content-type': 'text/plain; charset=utf-8',
    'cache-control': 'no-store',
    ...extraHeaders,
  },
  body,
});

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return text(405, 'Method not allowed');

  // Trimmed: a value pasted into the Netlify UI can carry a trailing space or
  // newline, which would otherwise be encoded into the URL and 502 every tab.
  const sheetId = (env('SHEET_ID') || '').trim();
  if (!sheetId) {
    // 501 tells the client "proxy exists but is unconfigured", so it can fall
    // back to a direct CSV read if CONFIG.sheetId was set.
    return text(501, 'SHEET_ID is not configured on this site.');
  }

  const tab = (event.queryStringParameters && event.queryStringParameters.tab) || '';
  if (!tab) return text(400, 'Missing ?tab=');

  // Whitelist: this proxy only ever reads the Talon tabs in netlify/lib/tabs.js.
  const match = slots().find((s) => s.name.toLowerCase() === tab.toLowerCase());
  if (!match) return text(403, `Tab "${tab}" is not exposed by this board.`);

  /* A gid survives a tab being RENAMED but not a tab being rebuilt: the ops bot
   * recreates a tab when it changes its shape, and the new tab gets a new gid.
   * A stale gid then fails forever and that zone goes blank — which is exactly
   * what happened to KPI and Meta. So try the gid, then fall back to the tab
   * name before giving up. Both failing is still a real failure. */
  const attempts = [];
  if (match.gid) attempts.push({ by: 'gid', selector: `gid=${encodeURIComponent(match.gid)}` });
  attempts.push({ by: 'name', selector: `sheet=${encodeURIComponent(match.name)}` });

  const problems = [];

  for (const attempt of attempts) {
    const url = gvizUrl(sheetId, attempt.selector);

    try {
      const res = await fetch(url, {
        redirect: 'follow',
        headers: { 'user-agent': 'talon-tv/1.0 (+netlify-function)' },
      });

      if (!res.ok) {
        problems.push(`${attempt.by}: Google returned ${res.status}`);
        continue;
      }

      const body = await res.text();

      const why = notCsv(body);
      if (why) {
        problems.push(`${attempt.by}: ${why}`);
        continue;
      }

      return {
        statusCode: 200,
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          // Names the route taken, so a stale gid shows up in a header rather
          // than only as a blank tile on the wall.
          'x-talon-resolved-by': attempt.by,
          // A wall display refreshes every few minutes; 30s of edge cache keeps
          // multiple screens from hammering Google without showing stale data.
          'cache-control': 'public, max-age=0, s-maxage=30',
        },
        body,
      };
    } catch (err) {
      problems.push(`${attempt.by}: ${err && err.message ? err.message : err}`);
    }
  }

  return text(502, `Tab "${match.name}" could not be read — ${problems.join('; ')}.`);
};
