/* Talon — the Sheet watchdog's actual checks.
 *
 * Lives here rather than in the Function because there are now TWO entry
 * points. Netlify does not allow a scheduled function to be invoked over HTTP,
 * so a single function carrying `schedule` answered /api/health with a 403 -
 * which made the one command anybody was told to run ("curl /api/health | jq")
 * the one command that could not work. The public endpoint and the daily
 * digest are separate functions over this one body of checks.
 */

const {
  slots, gvizUrl, notCsv, wrongTab, driftFor, stampAgeHours, maxAgeFor, env,
} = require('./tabs');

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

    /* gviz serves the FIRST sheet when a tab name does not match, so a tab
       that does not exist comes back as valid CSV from a different tab. Say
       that plainly - listing the other tab's columns as "drift" buries the
       actual finding, which is that this tab is not there. */
    const impostor = wrongTab(slot.slot, body);
    if (impostor) {
      return {
        slot: slot.slot,
        tab: slot.name,
        resolvedBy: attempt.by,
        status: 'error',
        rows: 0,
        issues: [`tab not found - ${impostor}`],
      };
    }

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


/* Runs every check and returns the report. No HTTP, no notifying - the two
   Functions above this decide what to do with it. */
async function runHealth(now = Date.now()) {
  const sheetId = (env('SHEET_ID') || '').trim();
  if (!sheetId) {
    return { configured: false, status: 'error', checkedAt: new Date(now).toISOString(), tabs: [], summary: 'SHEET_ID is not configured on this site.' };
  }

  const tabs = await Promise.all(slots().map((slot) => checkTab(sheetId, slot, now)));
  const worst = tabs.some((t) => t.status === 'error') ? 'error'
    : tabs.some((t) => t.status === 'warn') ? 'warn' : 'ok';

  const report = { configured: true, status: worst, checkedAt: new Date(now).toISOString(), tabs };
  report.summary = summarize(report);
  return report;
}

/* Posts the summary when something needs a look and a hook is configured.
   Returns what happened, for the report. */
async function notify(report) {
  const hook = (env('ALERT_WEBHOOK_URL') || '').trim();
  if (!hook) return 'ALERT_WEBHOOK_URL is not set - report only';
  try {
    const res = await fetch(hook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: report.summary, report }),
    });
    return res.ok ? 'sent' : `webhook returned ${res.status}`;
  } catch (err) {
    return `webhook failed: ${err && err.message ? err.message : err}`;
  }
}

module.exports = { runHealth, notify, summarize, dataRowCount };
