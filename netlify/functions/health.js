/* Talon — Sheet watchdog, public endpoint.
 *
 * GET /api/health -> JSON report, any time, no side effects and no notifying.
 *
 * Deliberately carries no `schedule`. Netlify will not serve a scheduled
 * function over HTTP - it answers 403 - and the first version of this put the
 * schedule here, which meant the documented verification command returned 403
 * from the day it shipped. The daily digest is health-cron.js.
 *
 * Env: SHEET_ID (required), HEALTH_MAX_AGE_HOURS / HEALTH_MAX_AGE_<SLOT>.
 */

const { runHealth } = require('../lib/health');

const json = (statusCode, payload) => ({
  statusCode,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  body: JSON.stringify(payload, null, 2),
});

exports.handler = async (event) => {
  const method = (event && event.httpMethod) || 'GET';
  if (method !== 'GET' && method !== 'POST') return json(405, { error: 'Method not allowed' });

  const report = await runHealth();
  if (!report.configured) return json(501, { status: 'error', error: report.summary });

  console.log(`[talon-health] ${report.status}: ${report.summary.replace(/\n/g, ' | ')}`);
  // 200 even when unhealthy: the body carries the verdict.
  return json(200, report);
};
