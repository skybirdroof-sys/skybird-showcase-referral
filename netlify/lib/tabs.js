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
  SALES_YTD: 'Sales YTD',
  SALES_YTD_DETAIL: 'Sales YTD Detail',
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
     header row. `owner` is an accepted spelling of the person column but is
     deliberately NOT in `required`: the KPI tab also has an Owner column, and
     gviz answers an unknown tab name by serving the first sheet, so a required
     set that KPI happens to satisfy would let a renamed Rest Index tab pass the
     verification below while actually returning KPI rows. */
  REST: {
    required: [['person', 'name', 'crew'], ['daysatrestavg', 'daysatrest', 'avgdaysatrest', 'restdays', 'days']],
    known: ['person', 'name', 'owner', 'daysatrestavg', 'daysatrest', 'avgdaysatrest', 'restdays', 'days', 'projectcount', 'projects', 'openprojects', 'count', 'key', 'value', 'metric', 'rule', 'updatedet', 'updated'],
    maxAgeHours: 30,
  },
  META: {
    required: [['key', 'name', 'setting'], ['value', 'val']],
    known: ['key', 'name', 'setting', 'value', 'val', 'updatedet', 'updated'],
    maxAgeHours: 48,
  },
  /* `goalop` rather than `goal`: the KPI tab has both Target and Value, and
     gviz serves KPI for an unknown tab name, so a required set KPI satisfies
     would wave the wrong tab through. Nothing but the L10 tabs has a GoalOp. */
  L10: {
    required: [['measurable', 'metric', 'name'], ['value'], ['goalop', 'op', 'operator']],
    known: ['period', 'view', 'week', 'sort', 'order', 'group', 'measurable', 'metric', 'name', 'owner', 'goalop', 'op', 'operator', 'goal', 'target', 'value', 'unit', 'units', 'weeklabel', 'source', 'notes', 'note', 'updatedet', 'updated'],
    maxAgeHours: 192,
  },
  L10_HISTORY: {
    required: [['weekstart', 'start'], ['measurable', 'metric', 'name'], ['value']],
    known: ['weekstart', 'start', 'weekend', 'end', 'weeklabel', 'week', 'sort', 'order', 'group', 'measurable', 'metric', 'name', 'owner', 'goalop', 'op', 'goal', 'target', 'value', 'unit', 'units', 'source', 'sourcedetail', 'updatedet', 'updated'],
    maxAgeHours: 192,
    /* A record of past weeks. Rows written once keep their stamp forever and
       that is correct, so only the newest row is checked for staleness here. */
    appendOnly: true,
  },
  /* Not shipped by the ops bot yet. Listed here so the watchdog reports it as
     unreadable rather than not noticing it is absent, and so the day it
     appears its shape is checked like every other tab. */
  /* Neither required set may lean on `owner`, `name` or a bare `value`, for
     the same reason: those are KPI's columns too. */
  SALES_YTD: {
    required: [['closer', 'salesman', 'salesperson'], ['contract', 'contracts', 'contractdollars', 'ytd', 'ytddollars']],
    /* The per-period column pairs the card's five buttons read. Documented here
       as well as in config.js so the watchdog does not report them as drift -
       a column the board deliberately reads is not an undocumented one. */
    known: ['closer', 'salesman', 'salesperson', 'owner', 'person', 'name',
      'contract', 'contracts', 'contractdollars', 'ytd', 'ytddollars', 'dollars', 'amount', 'value',
      'contractscount', 'contractcount', 'count', 'jobs',
      'month', 'monthdollars', 'mtd', 'mtddollars', 'thismonth', 'thismonthdollars',
      'monthcount', 'mtdcount', 'thismonthcount',
      'lastmonth', 'lastmonthdollars', 'priormonth', 'priormonthdollars',
      'lastmonthcount', 'priormonthcount',
      'quarter', 'quarterdollars', 'qtd', 'qtddollars', 'thisquarter', 'thisquarterdollars',
      'quartercount', 'qtdcount', 'thisquartercount',
      'lastquarter', 'lastquarterdollars', 'priorquarter', 'priorquarterdollars',
      'lastquartercount', 'priorquartercount',
      'notes', 'note', 'updatedet', 'updated'],
    maxAgeHours: 30,
  },
  /* The job list behind each closer on the sales card. One row per job, so an
     empty tab is a real possibility (nobody has signed anything yet this year
     would be zero rows, not an error) - which is why the watchdog's "parses to
     zero rows" check is the only thing that would flag it, and why the panel
     says "no YTD jobs in Sheet" rather than treating it as a fault. */
  SALES_YTD_DETAIL: {
    required: [['closer', 'salesman', 'salesperson'], ['customer', 'project', 'customername', 'homeowner'], ['wondate', 'date', 'signed', 'signeddate']],
    known: ['closer', 'salesman', 'salesperson', 'owner', 'person', 'name', 'projectnumber', 'projectno', 'project', 'projectid', 'customer', 'customername', 'homeowner', 'wondate', 'date', 'signed', 'signeddate', 'wonmonth', 'month', 'contract', 'contracts', 'contractdollars', 'dollars', 'amount', 'value', 'notes', 'note', 'updatedet', 'updated'],
    maxAgeHours: 30,
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
  let oldest = null;
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
      if (oldest === null || ms < oldest) oldest = ms;
    }
  }
  if (newest === null) return null;
  return {
    newestStamp: new Date(newest).toISOString(),
    ageHours: (now - newest) / 3600000,
    /* The oldest row matters as much as the newest. A tab that is only PARTLY
       rewritten reads as perfectly fresh when you look at the newest stamp
       alone: eight new close-rate rows on the KPI tab made it report "ok" while
       fourteen cash rows sat seventeen days old underneath them, which is the
       exact failure this watchdog exists to catch. */
    oldestStamp: new Date(oldest).toISOString(),
    oldestAgeHours: (now - oldest) / 3600000,
  };
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

/* gviz does not 404 an unknown tab name - it serves the FIRST sheet of the
 * workbook, with HTTP 200 and perfectly valid CSV. Asking for a tab that does
 * not exist therefore returns the KPI tab, which parses cleanly and is
 * completely wrong: the Sales YTD Detail drill-down spent a day reading KPI
 * rows and reporting "no jobs for this closer" rather than "that tab does not
 * exist". notCsv() cannot catch this, because the body IS csv.
 *
 * So the contract doubles as proof of identity. If the headers that came back
 * do not carry the columns this tab is required to have, it is not this tab,
 * whatever gviz says. Returns a reason string, or null when the body checks
 * out. */
function wrongTab(slot, body) {
  const drift = driftFor(slot, body);
  if (!drift.missing.length) return null;
  return `did not resolve - the response is missing ${drift.missing.map((c) => `"${c}"`).join(', ')}`
    + ', so it is a different tab (gviz serves the first sheet when a name does not match)';
}

module.exports = {
  cacheSecondsFor,
  wrongTab,
  env, DEFAULT_TABS, slots, gvizUrl, notCsv,
  CONTRACT, norm, headerCells, driftFor, stampAgeHours, maxAgeFor,
};
