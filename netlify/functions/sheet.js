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

const DEFAULT_TABS = {
  KPI: 'KPI',
  TOP5: 'Daily Top-Five Progress',
  REST: 'Rest Index',
  META: 'Meta',
};

/* Each slot resolves to a tab name (SHEET_TAB_*) and, optionally, a stable gid
 * (SHEET_GID_*). A gid survives someone renaming the tab, so it wins when set. */
function slots() {
  return Object.keys(DEFAULT_TABS).map((slot) => ({
    slot,
    name: process.env[`SHEET_TAB_${slot}`] || DEFAULT_TABS[slot],
    gid: (process.env[`SHEET_GID_${slot}`] || '').trim(),
  }));
}

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

  const sheetId = process.env.SHEET_ID;
  if (!sheetId) {
    // 501 tells the client "proxy exists but is unconfigured", so it can fall
    // back to a direct CSV read if CONFIG.sheetId was set.
    return text(501, 'SHEET_ID is not configured on this site.');
  }

  const tab = (event.queryStringParameters && event.queryStringParameters.tab) || '';
  if (!tab) return text(400, 'Missing ?tab=');

  // Whitelist: this proxy only ever reads the four Talon tabs.
  const match = slots().find((s) => s.name.toLowerCase() === tab.toLowerCase());
  if (!match) return text(403, `Tab "${tab}" is not exposed by this board.`);

  const selector = match.gid
    ? `gid=${encodeURIComponent(match.gid)}`
    : `sheet=${encodeURIComponent(match.name)}`;

  const url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}` +
    `/gviz/tq?tqx=out:csv&${selector}`;

  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: { 'user-agent': 'talon-tv/1.0 (+netlify-function)' },
    });

    if (!res.ok) {
      return text(502, `Google returned ${res.status} for tab "${match.name}".`);
    }

    const body = await res.text();

    // Google answers with an HTML sign-in page when the Sheet isn't link-shared.
    if (body.trim().startsWith('<')) {
      return text(502, `Tab "${match.name}" did not return CSV — check the Sheet is shared "anyone with the link can view".`);
    }

    return {
      statusCode: 200,
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        // A wall display refreshes every few minutes; 30s of edge cache keeps
        // multiple screens from hammering Google without showing stale data.
        'cache-control': 'public, max-age=0, s-maxage=30',
      },
      body,
    };
  } catch (err) {
    return text(502, `Sheet fetch failed: ${err && err.message ? err.message : err}`);
  }
};
