/* Light passphrase gate.

   The check happens in a Netlify Function (netlify/functions/gate.js) against
   the TALON_PASSWORD env var — the passphrase is never baked into the bundle.
   The unlocked passphrase is kept in localStorage so the office TV survives a
   reboot without someone typing it again, and is re-verified on every load.

   This is a "keep the lobby out" gate, not auth. For a hard wall use Netlify's
   site-wide Visitor access password (README -> Access control). */

import { CONFIG } from './config.js';

const STORE_KEY = 'talon.passphrase';

function readStored() {
  try { return localStorage.getItem(STORE_KEY) || ''; } catch { return ''; }
}

function writeStored(value) {
  try {
    if (value) localStorage.setItem(STORE_KEY, value);
    else localStorage.removeItem(STORE_KEY);
  } catch { /* private mode / storage blocked — gate just asks again */ }
}

async function gateStatus() {
  try {
    const res = await fetch(CONFIG.gatePath, { cache: 'no-store' });
    if (!res.ok) return { required: false };
    const data = await res.json();
    return { required: Boolean(data.required) };
  } catch {
    // No function available (plain `npx serve`) — nothing to enforce.
    return { required: false };
  }
}

async function verify(passphrase) {
  if (!passphrase) return false;
  try {
    const res = await fetch(CONFIG.gatePath, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ passphrase }),
      cache: 'no-store',
    });
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.ok);
  } catch {
    return false;
  }
}

export async function ensureAccess() {
  const { required } = await gateStatus();
  if (!required) return true;

  if (await verify(readStored())) return true;
  writeStored('');

  const gate = document.getElementById('gate');
  const form = document.getElementById('gate-form');
  const input = document.getElementById('gate-input');
  const msg = document.getElementById('gate-msg');

  gate.hidden = false;
  input.focus();

  return new Promise((resolve) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const value = input.value.trim();
      msg.textContent = 'Checking…';
      if (await verify(value)) {
        writeStored(value);
        gate.hidden = true;
        resolve(true);
      } else {
        msg.textContent = 'Nope. Try again.';
        input.value = '';
        input.focus();
      }
    });
  });
}
