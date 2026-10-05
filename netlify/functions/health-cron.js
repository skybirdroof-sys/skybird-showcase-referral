/* Talon — Sheet watchdog, the daily run.
 *
 * Scheduled in netlify.toml, invoked by Netlify's scheduler rather than over
 * HTTP, and the only entry point that notifies. Reading the report by hand is
 * free and silent: that is GET /api/health (health.js).
 *
 * Env: SHEET_ID (required), ALERT_WEBHOOK_URL (optional - anything that
 * accepts {"text": "..."}; unset means the log is the only record).
 */

const { runHealth, notify } = require('../lib/health');

exports.handler = async () => {
  const report = await runHealth();

  if (report.configured && report.status !== 'ok') {
    report.notified = await notify(report);
  }

  console.log(`[talon-health-cron] ${report.status}: ${report.summary.replace(/\n/g, ' | ')}`
    + (report.notified ? ` | notify: ${report.notified}` : ''));

  return { statusCode: 200, body: JSON.stringify({ status: report.status }) };
};
