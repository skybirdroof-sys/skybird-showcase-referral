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
    l10: 'L10 Scorecard',
    l10History: 'L10 History',
    salesYtd: 'Sales YTD',
    salesDetail: 'Sales YTD Detail',
  },

  /* Level 10 scorecard page. Week count is a display cap; Meta
     `l10_trend_weeks` overrides it. */
  l10TrendWeeks: 13,

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

  /* Which L10 view to show when the Meta tab does not say: the completed week
     the Level 10 meeting actually reviews, not the partial week in progress. */
  l10DefaultView: 'last',

  /* The eight cash/ops tiles. `metric` must match the Sheet's KPI!A values
     exactly. `unit` is the fallback when the Sheet's Unit cell is blank. */
/* `trend` is the `L10 History` Measurable whose weekly series draws this
     tile's sparkline. The names differ from the tile labels because the KPI tab
     and the L10 tab were written by different hands - "Cost per Appt" here is
     "Cost per Appointment Set" there. A tile with no `trend` gets no sparkline:
     Close Rates has no company-wide series (only the three per-closer ones,
     all of them blank), and Sent CoC cash sitting is not in the history tab at
     all. Neither gets a line invented for it. */
  /* Reading order, left to right then top to bottom. Close Rates leads because
     it sits under the sales story on the card above it; Rest Index closes the
     top row. Rest Index is the one tile that is not a KPI row - it reads its
     own tab, which is why it carries `kind`, and why the Monthly/Weekly toggle
     does not touch it wherever it sits. */
  tiles: [
    /* Company rate as the hero, the three closers as chips beneath it. The
       chip metrics are ordinary KPI rows, so the Monthly/Weekly toggle flips
       all four together and any that the Sheet has not filled shows an em
       dash. ProLine owns the definition of this number - Talon transcribes it
       and the board displays it; nothing here computes a close rate. See
       docs/TALON_CLOSE_RATES_REQUEST.md. */
    {
      metric: 'Close Rates',
      unit: 'pct',
      kind: 'rates',
      chips: [
        { label: 'John', metric: 'Close Rate - John' },
        { label: 'Anas', metric: 'Close Rate - Anas' },
        { label: 'Henry', metric: 'Close Rate - Henry' },
      ],
    },
    { metric: 'Appointments Set', unit: 'count', trend: 'Appointments Set' },
    { metric: 'Contracts Signed $$', unit: 'usd', trend: 'Contracts Signed - $$' },
    { kind: 'rest', metric: 'Rest Index', unit: 'rest', note: 'avg days at rest · lower is better' },
    { metric: 'Jobs Completed', unit: 'count', trend: 'Jobs Completed' },
    { metric: 'Sent CoC cash sitting', unit: 'usd' },
    { metric: 'Total AR Over 60 Days', unit: 'usd', alert: true, trend: 'Total AR Over 60 Days' },
    { metric: 'Cash Collected', unit: 'usd', trend: 'Cash Collected' },
  ],

  /* --- year-to-date sales scoreboard ----------------------------------
     Reads the `Sales YTD` tab, which the ops bot has not shipped yet. Until
     it does the card renders its frame with em dashes: the board does not
     derive a YTD figure from the monthly Contracts tile, and it does not
     carry a stale one forward. See docs/TALON_SALES_YTD_REQUEST.md. */
  salesClosers: ['John', 'Anas', 'Henry', 'Other'],
  salesTotalRow: 'Total',

  /* The periods the card's buttons offer, in Jacob's order. A period whose
     numbers the Sheet does not carry keeps its button and shows em dashes: the
     button vanishing would be a worse lie than an honest blank, and the board
     never derives one period from another.

     `dollars` / `count` are the column spellings the board will accept on the
     `Sales YTD` tab when Talon ships them. Only the YTD pair exists today. */
  salesPeriods: [
    {
      key: 'ytd',
      label: 'Year to date',
      short: 'YTD',
      dollars: ['contract', 'contracts', 'contractdollars', 'ytd', 'ytddollars'],
      count: ['contractscount', 'contractcount', 'count', 'jobs'],
    },
    {
      key: 'month',
      label: 'This month',
      short: 'This month',
      dollars: ['month', 'monthdollars', 'mtd', 'mtddollars', 'thismonth', 'thismonthdollars'],
      count: ['monthcount', 'mtdcount', 'thismonthcount'],
    },
    {
      key: 'lastmonth',
      label: 'Last month',
      short: 'Last month',
      dollars: ['lastmonth', 'lastmonthdollars', 'priormonth', 'priormonthdollars'],
      count: ['lastmonthcount', 'priormonthcount'],
    },
    {
      key: 'quarter',
      label: 'This quarter',
      short: 'This qtr',
      dollars: ['quarter', 'quarterdollars', 'qtd', 'qtddollars', 'thisquarter', 'thisquarterdollars'],
      count: ['quartercount', 'qtdcount', 'thisquartercount'],
    },
    {
      key: 'lastquarter',
      label: 'Last quarter',
      short: 'Last qtr',
      dollars: ['lastquarter', 'lastquarterdollars', 'priorquarter', 'priorquarterdollars'],
      count: ['lastquartercount', 'priorquartercount'],
    },
  ],
  salesDefaultView: 'ytd',
  salesViewStorageKey: 'talon.salesView',

  /* How many weeks a tile sparkline shows. Shorter than the L10 page's 13-25:
     at 120x34 in a corner of a tile, more weeks is just a noisier squiggle. */
  tileTrendWeeks: 12,

  /* --- Top Five celebrations (Phase 1) --------------------------------
     The Top Five strip polls on its own clock, far faster than the rest of the
     board: a ding that lands four minutes after someone closed an item is not
     a celebration, it is a puzzle. The KPI tiles and the Rest Index keep the
     Meta refresh_seconds cadence, because none of those numbers move minute to
     minute. */
  top5PollSeconds: 12,

  celebrate: {
    dingPath: '/public/sounds/ding.wav',
    soundStorageKey: 'talon.sound',
    /* The lowest Today % that counts as having closed something. Also the
       threshold a blank must reach to read as a real first close. */
    softGreenAt: 20,
    /* How long one celebration holds the floor before the next in the queue.
       The 4pm write can move three people at once and three dings on top of
       each other tell you nothing about who they were for. */
    dwellMs: 1800,
    hundredDwellMs: 3000,
    /* How long a name pulses when the increase lands on a full five of five. */
    hundredPulseMs: 2600,
  },

  /* Reporting periods for the eight tiles. `monthly` is the wall's default;
     `weekly` is the set used in the Tuesday L10 scorecard. A KPI row with a
     blank Period column counts as the default period, so a Sheet written
     before this column existed keeps rendering unchanged. */
  periods: ['monthly', 'weekly'],
  defaultPeriod: 'monthly',
  periodStorageKey: 'talon.period',

  timeZone: 'America/New_York',
};
