/* Talon — passphrase check.
 *
 * GET  /api/gate            -> { "required": true|false }
 * POST /api/gate {passphrase} -> { "ok": true } | 401 { "ok": false }
 *
 * Env: TALON_PASSWORD — unset/blank means the gate is off and the board relies
 * on the secret /t/<random> URL (and/or Netlify's site-wide Visitor access
 * password). The passphrase never reaches the browser bundle.
 */

const crypto = require('crypto');

/* Netlify environment keys are case-sensitive, and a mistyped key here fails
 * silently — the gate would report "no password set" and the board would sit
 * open with nothing logged. Match exactly, then fall back to a case-insensitive
 * lookup so TALON_PASSWORD / Talon_password / talon_password all resolve. */
function env(name) {
  if (process.env[name] !== undefined) return process.env[name];
  const wanted = name.toLowerCase();
  const found = Object.keys(process.env).find((key) => key.toLowerCase() === wanted);
  return found ? process.env[found] : undefined;
}

const json = (statusCode, payload) => ({
  statusCode,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  },
  body: JSON.stringify(payload),
});

/* Constant-time compare that tolerates differing lengths. */
function sameSecret(a, b) {
  const ha = crypto.createHash('sha256').update(String(a), 'utf8').digest();
  const hb = crypto.createHash('sha256').update(String(b), 'utf8').digest();
  return crypto.timingSafeEqual(ha, hb);
}

exports.handler = async (event) => {
  const expected = (env('TALON_PASSWORD') || '').trim();

  if (event.httpMethod === 'GET') {
    if (expected === '') {
      // Visible in the function log, so an open board is never a silent state.
      console.log('[talon] gate disabled: no TALON_PASSWORD set');
    }
    return json(200, { required: expected !== '' });
  }

  if (event.httpMethod !== 'POST') return json(405, { ok: false });

  if (expected === '') return json(200, { ok: true, required: false });

  let passphrase = '';
  try {
    passphrase = String(JSON.parse(event.body || '{}').passphrase || '').trim();
  } catch {
    return json(400, { ok: false });
  }

  if (passphrase === '') return json(401, { ok: false });

  return sameSecret(passphrase, expected)
    ? json(200, { ok: true })
    : json(401, { ok: false });
};
