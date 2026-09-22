/* Talon — the Sheet tab contract, shared by both Functions.
 *
 * This lives outside netlify/functions on purpose: every file in that folder
 * is treated as a deployable Function, so shared code cannot sit there. The
 * sibling package.json pins CommonJS, because the repo root is "type":"module"
 * and these Functions are CommonJS.
 *
 * The proxy (sheet.js) and the watchdog (health.js) both read this file, so
 * there is exactly one list of tabs and one definition of what each one should
 * look like. A second copy is how you end up with a watchdog that cannot see
 * the tab that broke.
 */

/* Netlify environment keys are case-sensitive, and a mistyped key here fails
 * silently. Match exactly, then fall back to a case-insensitive lookup so
 * TALON_PASSWORD / Talon_password / talon_password all resolve. */
function env(name) {
  if (process.env[name] !== undefined) return process.env[name];
  const wanted = name.toLowerCase();
  const found = Object.keys(process.env).find((key) => key.toLowerCase() === wanted);
  return found ? process.env[found] : undefined;
}

const DEFAULT_TABS = {
  KPI: 'KPI',
  TOP5: 'Daily Top-Five Progress',
  REST: 'Rest Index',
  META: 'Meta',
  L10: 'L10 Scorecard',
  L10_HISTORY: 'L10 History',
};

/* Each slot resolves to a tab name (SHEET_TAB_*) and, optionally, a stable gid
 * (SHEET_GID_*). A gid survives someone renaming the tab, so it wins when set. */
function slots() {
  return Object.keys(DEFAULT_TABS).map((slot) => ({
    slot,
    name: (env(`SHEET_TAB_${slot}`) || DEFAULT_TABS[slot]).trim(),
    gid: (env(`SHEET_GID_${slot}`) || '').trim(),
  }));
}

/* headers=1 is not optional. Without it gviz GUESSES how many leading rows are
 * header by column type, and a text column whose first data rows are blank
 * (KPI!Value, Meta!Value) makes it swallow those rows into the header and
 * space-join them. Pinning it to one header row is the difference between
 * eight numbers and eight dashes. */
function gvizUrl(sheetId, selector) {
  return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}` +
    `/gviz/tq?tqx=out:csv&headers=1&${selector}`;
}

/* gviz does not fail cleanly. A bad gid, a deleted tab or a query error comes
 * back as HTTP 200 whose body is a JavaScript payload (a slash-star O_o marker
 * followed by google.visualization.Query.setResponse) rather than an error
 * status. Accepting that as CSV is worse than a 502: the tab reports success,
 * parses to zero rows, and the zone goes quietly blank. */
function notCsv(body) {
  const t = String(body === null || body === undefined ? '' : body).trim();
  if (t === '') return 'empty response';
  if (t.startsWith('<')) return 'HTML, not CSV - check the Sheet is shared "anyone with the link can view"';
  if (t.startsWith('/*') || t.includes('google.visualization.Query.setResponse')) {
    return 'gviz error payload - the tab id or name did not resolve';
  }
  if (!t.split('\n', 1)[0].includes(',')) return 'single-column response, not a Talon tab';
  return null;
}

/* --- the contract the watchdog checks -------------------------------- */

/* `required` are the columns the board genuinely reads: losing one of them
 * blanks a zone. Each entry is the list of headers that SATISFY that field,
 * because the board accepts aliases - "Today %" and "Today Pct" are the same
 * column to it, and a watchdog that only knew one spelling would cry missing
 * on a perfectly good tab. The first alias is the name used in the report.
 * `known` is everything documented in SHEET_SCHEMA.md, headers the board
 * tolerates included. A column that is in neither is DRIFT - the tab
 * grew a field nobody told the board about, which is exactly how the L10 page
 * started rendering eighteen cards instead of nine when a Period column
 * appeared. Drift is a warning, not a failure: the sheet is allowed to grow,
 * but somebody has to look.
 *
 * `maxAgeHours` is how long the newest stamp on a tab may lag before the tab
 * counts as stale. Weekly tabs get a week and a day; daily tabs get a day and
 * a bit, so one missed run shows up without a weekend tripping it. */
const CONTRACT = {
  KPI: {
    required: [['metric', 'kpi', 'name'], ['value']],
    known: ['metric', 'period', 'value', 'target', 'unit', 'source', 'owner', 'notes', 'updatedet', 'updated'],
    maxAgeHours: 48,
  },
  TOP5: {
    required: [['person', 'name', 'crew'], ['todaypct', 'today', 'todaypercent']],
    known: ['person', 'name', 'crew', 'todaypct', 'today', 'todaypercent', '5dayavg', 'weeklyavg', 'avg', 'updatedet', 'updated'],
    maxAgeHours: 30,
  },
  /* The Rest Index tab carries a person block and a key/value block under one
     header row, so only the person column is load-bearing here. */
  REST: {
    required: [['person', 'name', 'owner']],
    known: ['person', 'name', 'owner', 'daysatrestavg', 'daysatrest', 'avgdaysatrest', 'restdays', 'days', 'projectcount', 'projects', 'openprojects', 'count', 'key', 'value', 'metric', 'rule', 'updatedet', 'updated'],
    maxAgeHours: 30,
  },
  META: {
    required: [['key', 'name', 'setting'], ['value', 'val']],
    known: ['key', 'name', 'setting', 'value', 'val', 'updatedet', 'updated'],
    maxAgeHours: 48,
  },
  L10: {
    required: [['measurable', 'metric', 'name'], ['value'], ['goal', 'target']],
    known: ['period', 'view', 'week', 'sort', 'order', 'group', 'measurable', 'metric', 'name', 'owner', 'goalop', 'op', 'operator', 'goal', 'target', 'value', 'unit', 'units', 'weeklabel', 'source', 'notes', 'note', 'updatedet', 'updated'],
    maxAgeHours: 192,
  },
  L10_HISTORY: {
    required: [['weekstart', 'start'], ['measurable', 'metric', 'name'], ['value']],
    known: ['weekstart', 'start', 'weekend', 'end', 'weeklabel', 'week', 'sort', 'order', 'group', 'measurable', 'metric', 'name', 'owner', 'goalop', 'op', 'goal', 'target', 'value', 'unit', 'units', 'source', 'sourcedetail', 'updatedet', 'updated'],
    maxAgeHours: 192,
  },
};

/* Same normalisation the board uses, so "Today %", "today%" and "Today  %"
 * are one column here too. */
const norm = (s) => String(s === null || s === undefined ? '' : s)
  .toLowerCase().replace(/[^a-z0-9]/g, '');

/* Just the header row, quoted commas respected. The watchdog never needs the
 * body parsed, only counted. */
function headerCells(csv) {
  const line = String(csv || '').split(/\r?\n/, 1)[0];
  const cells = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { cells.push(cur); cur = ''; }
    else cur += ch;
  }
  cells.push(cur);
  return cells.map((c) => c.trim()).filter((c) => c !== '');
}

/* Required columns that are absent, and columns nobody documented. */
function driftFor(slot, csv) {
  const spec = CONTRACT[slot] || { required: [], known: [] };
  const seen = headerCells(csv).map(norm).filter((h) => h !== '');
  const seenSet = new Set(seen);
  const knownSet = new Set(spec.known);
  return {
    // A field is missing only when NONE of its accepted spellings is present.
    missing: spec.required
      .filter((aliases) => !aliases.some((a) => seenSet.has(a)))
      .map((aliases) => aliases[0]),
    added: [...new Set(seen.filter((h) => !knownSet.has(h)))],
    columns: seen.length,
  };
}

const ISO_WITH_OFFSET = /(Z|[+-]\d{2}:?\d{2})$/;

/* Only a stamp that carries its own zone can be compared to "now". A human
 * stamp with no zone ("Mon Sep 21 - 9:01 PM ET") is displayable but not
 * orderable, so it is skipped rather than guessed at - the alternative is a
 * watchdog that cries stale every time the clocks move. */
function stampAgeHours(csv, now) {
  const lines = String(csv || '').split(/\r?\n/);
  if (lines.length < 2) return null;

  const header = headerCells(lines[0]).map(norm);
  const cols = [];
  header.forEach((h, i) => { if (h === 'updatedet' || h === 'updated' || h === 'lastupdatedet') cols.push(i); });

  let newest = null;
  for (let r = 1; r < lines.length; r += 1) {
    const cells = lines[r].split(',');
    const candidates = cols.length ? cols.map((i) => cells[i]) : [];
    // The Meta tab carries its stamp as a key/value ROW, not a column.
    if (norm(cells[0]) === 'lastupdatedet') candidates.push(cells[1]);
    for (const raw of candidates) {
      const t = String(raw || '').trim().replace(/^"|"$/g, '');
      if (!t || !ISO_WITH_OFFSET.test(t)) continue;
      const ms = Date.parse(t);
      if (!Number.isFinite(ms)) continue;
      if (newest === null || ms > newest) newest = ms;
    }
  }
  if (newest === null) return null;
  return { newestStamp: new Date(newest).toISOString(), ageHours: (now - newest) / 3600000 };
}

function maxAgeFor(slot) {
  const specific = env(`HEALTH_MAX_AGE_${slot}`);
  const global = env('HEALTH_MAX_AGE_HOURS');
  const n = Number(specific !== undefined && specific !== '' ? specific : global);
  if (Number.isFinite(n) && n > 0) return n;
  return (CONTRACT[slot] || {}).maxAgeHours || 48;
}

/* Edge cache TTL per tab. The Top Five strip is polled every dozen seconds for
 * the celebration ding, so 30s of shared cache would make a ding up to half a
 * minute late - long enough that nobody in the room connects it to the thing
 * that caused it. It still caches, just briefly, so five screens in the office
 * do not become five times the requests to Google. Nothing else on the board
 * moves minute to minute. */
function cacheSecondsFor(slot) {
  return slot === 'TOP5' ? 8 : 30;
}

module.exports = {
  cacheSecondsFor,
  env, DEFAULT_TABS, slots, gvizUrl, notCsv,
  CONTRACT, norm, headerCells, driftFor, stampAgeHours, maxAgeFor,
};
