/* Talon — build-time-free config. Everything here is safe to ship to the browser.
   The Sheet id lives in Netlify env (SHEET_ID) and is read server-side by
   netlify/functions/sheet.js. Only set `sheetId` below if you deliberately want
   direct browser -> Google requests (no Netlify Function). */

export const CONFIG = {
  /* Netlify Function proxy (preferred). Redirected in netlify.toml. */
  proxyPath: '/api/sheet',
  gatePath: '/api/gate',

  /* Optional public fallback: browser fetches the published CSV directly.
     Leave '' to require the Function. */
  sheetId: '',

  tabs: {
    kpi: 'KPI',
    top5: 'Daily Top-Five Progress',
    rest: 'Rest Index',
    meta: 'Meta',
  },

  /* Refresh cadence. The Meta tab's `refresh_seconds` overrides this, clamped
     to the 2-5 minute window the board is specified for. */
  refreshSeconds: 180,
  refreshMin: 120,
  refreshMax: 300,

  /* Rest Index owners (locked for v1). Extra people found in the Sheet are
     still shown as chips, they just don't change a Sheet-provided index. */
  restOwners: ['Jacob', 'John', 'Henry', 'Anas'],

  /* Top 5 row order. Anyone extra in the Sheet is appended after these. */
  top5Order: ['Margaret', 'Travis', 'John', 'Henry', 'Anas', 'Jacob'],

  /* Daily Top Five scoring is count-based — five items, 20% each — so these are
     the only values Today % can legitimately hold. Anything else (a cell
     corrupted into a timestamp, a stray 45) is treated as missing and drawn as
     an em dash. Set to [] to accept any 0-100 number. */
  top5ValidToday: [0, 20, 40, 60, 80, 100],

  /* The eight cash/ops tiles. `metric` must match the Sheet's KPI!A values
     exactly. `unit` is the fallback when the Sheet's Unit cell is blank. */
  tiles: [
    { metric: 'Appointments Set', unit: 'count' },
    { metric: 'Cost per Appt', unit: 'usd' },
    { metric: 'Contracts Signed $$', unit: 'usd' },
    { metric: 'Close Rates', unit: 'pct', note: 'Anas · John · Henry' },
    { metric: 'Jobs Completed', unit: 'count' },
    { metric: 'Sent CoC cash sitting', unit: 'usd' },
    { metric: 'Total AR Over 60 Days', unit: 'usd', alert: true },
    { metric: 'Cash Collected', unit: 'usd' },
  ],

  timeZone: 'America/New_York',
};
