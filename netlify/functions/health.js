/* Talon — Sheet watchdog.
 *
 * The board is only as good as the tabs behind it, and both ways those tabs go
 * wrong are SILENT from the board's point of view:
 *
 *   1. Schema drift. The ops bot adds a column and the fetch still succeeds, so
 *      no badge lights up. A Period column appeared on the L10 tab and the page
 *      rendered eighteen cards instead of nine for a day before anyone noticed.
 *   2. Staleness. A tab stops being written but keeps serving its last values.
 *      The fetch succeeds, so the amber "feed stale" badge - which only ever
 *      means the fetch FAILED - stays dark. The KPI tab sat four days old
 *      showing Friday's numbers as though they were today's.
 *
 * So this checks each tab against the shared contract and reports, rather than
 * waiting for someone to spot it on the wall.
 *
 * GET  /api/health      -> JSON report, any time, no side effects
 * POST /api/health      -> same, and posts to ALERT_WEBHOOK_URL if not ok.
 *                          Netlify's scheduler invokes it this way, which is
 *                          what makes the daily run the one that notifies and
 *                          a manual check quiet.
 *
 * Env:
 *   SHEET_ID                  (required) same id the proxy uses
 *   ALERT_WEBHOOK_URL         (optional) anything that accepts {"text": "..."}
 *                             - Slack and Discord incoming webhooks, Zapier,
 *                             Make. Unset means report-only.
 *   HEALTH_MAX_AGE_HOURS      (optional) overrides every tab's staleness limit
 *   HEALTH_MAX_AGE_<SLOT>     (optional) overrides one, e.g. HEALTH_MAX_AGE_KPI
 */

const {
  slots, gvizUrl, notCsv, driftFor, stampAgeHours, maxAgeFor, env,
} = require('../lib/tabs');

const json = (statusCode, payload) => ({
  statusCode,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  body: JSON.stringify(payload, null, 2),
});

/* Rows past the header. Cheap and good enough: a tab that parses to zero rows
 * is the failure we care about, and the exact count is only ever informational. */
function dataRowCount(csv) {
  return String(csv || '').split(/\r?\n/).slice(1).filter((l) => l.trim() !== '' && l.replace(/[",]/g, '').trim() !== '').length;
}

async function checkTab(sheetId, slot, now) {
  const attempts = [];
  if (slot.gid) attempts.push({ by: 'gid', selector: `gid=${encodeURIComponent(slot.gid)}` });
  attempts.push({ by: 'name', selector: `sheet=${encodeURIComponent(slot.name)}` });

  const problems = [];

  for (const attempt of attempts) {
    let body;
    try {
      const res = await fetch(gvizUrl(sheetId, attempt.selector), {
        redirect: 'follow',
        headers: { 'user-agent': 'talon-tv-watchdog/1.0 (+netlify-function)' },
      });
      if (!res.ok) { problems.push(`${attempt.by}: Google returned ${res.status}`); continue; }
      body = await res.text();
    } catch (err) {
      problems.push(`${attempt.by}: ${err && err.message ? err.message : err}`);
      continue;
    }

    const why = notCsv(body);
    if (why) { problems.push(`${attempt.by}: ${why}`); continue; }

    const rows = dataRowCount(body);
    const drift = driftFor(slot.slot, body);
    const age = stampAgeHours(body, now);
    const maxAgeHours = maxAgeFor(slot.slot);

    const issues = [];
    if (!rows) issues.push('parses to zero data rows');
    for (const col of drift.missing) issues.push(`missing required column "${col}"`);
    for (const col of drift.added) issues.push(`undocumented column "${col}"`);
    if (age && age.ageHours > maxAgeHours) {
      issues.push(`newest stamp is ${age.ageHours.toFixed(1)}h old (limit ${maxAgeHours}h)`);
    }

    /* A missing required column or an unreadable tab breaks a zone; a new
       column or a stale stamp needs a human but the board still renders. */
    const broken = !rows || drift.missing.length > 0;
    return {
      slot: slot.slot,
      tab: slot.name,
      resolvedBy: attempt.by,
      status: broken ? 'error' : issues.length ? 'warn' : 'ok',
      rows,
      columns: drift.columns,
      missingColumns: drift.missing,
      undocumentedColumns: drift.added,
      newestStamp: age ? age.newestStamp : null,
      ageHours: age ? Number(age.ageHours.toFixed(1)) : null,
      maxAgeHours,
      issues,
    };
  }

  return {
    slot: slot.slot,
    tab: slot.name,
    status: 'error',
    rows: 0,
    issues: [`unreadable - ${problems.join('; ')}`],
  };
}

function summarize(report) {
  const bad = report.tabs.filter((t) => t.status !== 'ok');
  if (!bad.length) return `Talon: all ${report.tabs.length} Sheet tabs healthy.`;
  const lines = bad.map((t) => `• ${t.tab} [${t.status}]: ${t.issues.join('; ')}`);
  return `Talon Sheet check — ${bad.length} of ${report.tabs.length} tabs need a look:\n${lines.join('\n')}`;
}

exports.handler = async (event) => {
  const method = (event && event.httpMethod) || 'GET';
  if (method !== 'GET' && method !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  const sheetId = (env('SHEET_ID') || '').trim();
  if (!sheetId) return json(501, { status: 'error', error: 'SHEET_ID is not configured on this site.' });

  const now = Date.now();
  const tabs = await Promise.all(slots().map((slot) => checkTab(sheetId, slot, now)));

  const worst = tabs.some((t) => t.status === 'error') ? 'error'
    : tabs.some((t) => t.status === 'warn') ? 'warn' : 'ok';

  const report = { status: worst, checkedAt: new Date(now).toISOString(), tabs };
  report.summary = summarize(report);

  /* Notify on the scheduled run (Netlify invokes it as a POST) or when asked
     for explicitly, never on the plain GET a person or the board might make -
     otherwise a watchdog on an hourly board becomes its own noise problem. */
  const wantsNotify = method === 'POST'
    || !!(event && event.queryStringParameters && event.queryStringParameters.notify);
  const hook = (env('ALERT_WEBHOOK_URL') || '').trim();

  if (wantsNotify && worst !== 'ok' && hook) {
    try {
      const res = await fetch(hook, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: report.summary, report }),
      });
      report.notified = res.ok ? 'sent' : `webhook returned ${res.status}`;
    } catch (err) {
      report.notified = `webhook failed: ${err && err.message ? err.message : err}`;
    }
  } else if (wantsNotify && worst !== 'ok') {
    report.notified = 'ALERT_WEBHOOK_URL is not set - report only';
  }

  // Always logged, so the Netlify function log is a usable history even with
  // no webhook wired up.
  console.log(`[talon-health] ${report.status}: ${report.summary.replace(/\n/g, ' | ')}`);

  // 200 even when unhealthy: the body carries the verdict, and a non-200 would
  // make Netlify's scheduler retry a check that is working correctly.
  return json(200, report);
};
