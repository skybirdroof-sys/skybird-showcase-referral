/* Talon data layer: Google Sheet (CSV) -> normalized board model.
   Read-only. Never fabricates a value: a missing tab, a missing row or a blank
   cell all end up as null, which the renderer draws as an em dash. */

import { CONFIG } from './config.js';
import { parseCsv, toRecords, pick } from './csv.js';
import { parseValue, parsePercent } from './format.js';

export class NoSourceError extends Error {
  constructor(message) {
    super(message || 'No Sheet source configured');
    this.name = 'NoSourceError';
  }
}

const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

let proxyWorks = null; // null = untested, false = fall back to direct CSV

/* headers=1 pins gviz to a single header row. Left to guess, it folds leading
   rows whose numeric column is still blank into the header and space-joins
   them, which silently produces a tab with no usable rows. */
function gvizUrl(tab) {
  return `https://docs.google.com/spreadsheets/d/${CONFIG.sheetId}` +
    `/gviz/tq?tqx=out:csv&headers=1&sheet=${encodeURIComponent(tab)}`;
}

/* Same rule as the Function applies here, so a direct-CSV read can't be fooled
   either. gviz answers a bad gid or a missing tab with HTTP 200 and a
   JavaScript payload (a slash-star O_o marker plus
   google.visualization.Query.setResponse), which is not HTML and would
   otherwise sail through as valid CSV and parse to nothing. */
function looksLikeCsv(text) {
  const t = String(text ?? '').trim();
  if (t === '') return false;
  if (t.startsWith('<')) return false;
  if (t.startsWith('/*') || t.includes('google.visualization.Query.setResponse')) return false;
  return t.split('\n', 1)[0].includes(',');
}

/**
 * One tab, via the Function proxy when it exists, direct CSV otherwise.
 *
 * The distinction that matters: 404/501 means the proxy itself isn't there
 * (not deployed, or SHEET_ID unset) and we should fall back for good. Any other
 * status means the proxy answered — so it exists, and the problem belongs to
 * this one tab (a tab Talon hasn't created yet returns 502). Marking the proxy
 * dead on a tab-level error would take the whole board down on the next
 * refresh, which is the opposite of what a missing tab should cost.
 */
async function fetchTabCsv(tab) {
  if (proxyWorks !== false) {
    try {
      const res = await fetch(`${CONFIG.proxyPath}?tab=${encodeURIComponent(tab)}`, {
        cache: 'no-store',
      });

      if (res.status === 404 || res.status === 501) {
        proxyWorks = false; // no Function here — try the published CSV instead
      } else {
        proxyWorks = true;  // the Function answered, so it is alive

        if (!res.ok) throw new Error(`Proxy error ${res.status} for "${tab}"`);

        const text = await res.text();
        if (!looksLikeCsv(text)) throw new Error(`Proxy returned non-CSV for "${tab}"`);
        return text;
      }
    } catch (err) {
      if (proxyWorks === true) throw err; // proven alive: this tab is the problem
      proxyWorks = false;
    }
  }

  if (!CONFIG.sheetId) {
    throw new NoSourceError(
      'No data source: set SHEET_ID in Netlify env (Function proxy) or CONFIG.sheetId (direct CSV).'
    );
  }

  const res = await fetch(gvizUrl(tab), { cache: 'no-store' });
  if (!res.ok) throw new Error(`Sheet fetch failed (${res.status}) for "${tab}"`);
  const text = await res.text();
  if (!looksLikeCsv(text)) throw new Error(`Sheet returned no CSV for "${tab}" — check sharing`);
  return text;
}

function records(csv) {
  return toRecords(parseCsv(csv));
}

/* --- tab parsers ------------------------------------------------------- */

function parseKpi(csv) {
  return records(csv)
    .map((r) => ({
      metric: String(pick(r, ['metric', 'kpi', 'name'])).trim(),
      period: String(pick(r, ['period', 'periodtype', 'range', 'cadence'])).trim(),
      value: pick(r, ['value']),
      target: pick(r, ['target', 'goal']),
      unit: String(pick(r, ['unit', 'units'])).trim(),
      source: String(pick(r, ['source'])).trim(),
      owner: String(pick(r, ['owner'])).trim(),
      notes: String(pick(r, ['notes', 'note'])).trim(),
      updated: String(pick(r, ['updated', 'updatedet', 'lastupdated'])).trim(),
    }))
    .filter((row) => row.metric !== '' && !/^note/i.test(row.metric));
}

function parseTop5(csv) {
  return records(csv)
    .map((r) => ({
      person: String(pick(r, ['person', 'name', 'crew'])).trim(),
      today: pick(r, ['today', 'todaypct', 'todaypercent', 'today5']),
      week: pick(r, ['5dayavg', 'fivedayavg', 'weeklyavg', 'weekavg', 'avg']),
      updated: String(pick(r, ['updatedet', 'updated'])).trim(),
    }))
    .filter((row) => row.person !== '' && !/^note/i.test(row.person));
}

/* Header words that can appear in column A when the tab carries a second
   Key/Value summary block below the person rows. */
const HEADER_WORDS = new Set(['key', 'person', 'metric', 'name', 'value', 'owner', 'updated', 'updatedet']);

/* Talon's summary block uses snake_case keys (period_label, last_updated_et). */
const META_KEY = /^[a-z0-9]+(?:_[a-z0-9]+)+$/;

function parseRest(csv) {
  const rows = records(csv).map((r) => ({
    person: String(pick(r, ['person', 'key', 'name', 'owner'])).trim(),
    days: pick(r, ['daysatrestavg', 'daysatrest', 'restdays', 'avgdaysatrest', 'days', 'value']),
    projects: pick(r, ['projectcount', 'projects', 'openprojects', 'count']),
    updated: String(pick(r, ['updatedet', 'updated'])).trim(),
  }));

  let index = null;
  const people = [];
  const meta = {};

  for (const row of rows) {
    const label = row.person;
    if (label === '' || /^note/i.test(label)) continue;

    const key = norm(label);

    // A repeated header line (the summary block's own `Key | Value` row).
    if (HEADER_WORDS.has(key)) continue;

    // Company number, as a person row or as a summary-block key.
    if (key === 'restindex') {
      index = parseValue(row.days);
      continue;
    }

    // Meta values parked in the summary block rather than the Meta tab.
    if (META_KEY.test(label.toLowerCase())) {
      meta[key] = String(row.days ?? '').trim();
      continue;
    }

    // Annotation rows: Talon states the blank-clock rule on this tab, and a
    // `Rule | blank clocks excluded` row must not become a person chip reading
    // "RULE —". A row is a person only if its value is a number, or the name is
    // a configured owner (who stays visible as an em dash while unwritten).
    const isOwner = CONFIG.restOwners.some((owner) => norm(owner) === key);
    if (parseValue(row.days) === null && !isOwner) continue;

    people.push(row);
  }

  return { index, people, meta };
}

/* --- Level 10 scorecard ------------------------------------------------- */

/* `Sales YTD` — one row per closer plus a Total row.
   `Month $$` / `Month Count` are optional: the card's "This month" view shows
   em dashes until the Sheet supplies them, rather than deriving a month from
   the YTD figure or borrowing the monthly Contracts tile. */
/* One row per closer. Every period the card offers gets read here from its own
   columns - the board never derives one period from another, so a period the
   Sheet does not carry comes back null and renders an em dash. */
function parseSalesYtd(csv) {
  return records(csv)
    .map((r) => {
      const periods = {};
      for (const spec of CONFIG.salesPeriods) {
        periods[spec.key] = {
          dollars: parseValue(pick(r, spec.dollars)),
          count: parseValue(pick(r, spec.count)),
        };
      }
      return {
        closer: String(pick(r, ['closer', 'salesman', 'salesperson', 'owner', 'person', 'name'])).trim(),
        periods,
        notes: String(pick(r, ['notes', 'note'])).trim(),
        updated: String(pick(r, ['updatedet', 'updated'])).trim(),
      };
    })
    .filter((row) => row.closer !== '' && !/^note/i.test(row.closer));
}

const emptyPeriods = () => Object.fromEntries(
  CONFIG.salesPeriods.map((p) => [p.key, { dollars: null, count: null }]),
);

/* Closers in the board's locked order, then the company total. A closer the
   Sheet does not mention still gets a row, showing em dashes - an absent name
   is unknown, not zero, and a scoreboard that silently drops a person is worse
   than one that admits it has nothing for them. */
export function buildSalesYtd(csv, meta = {}) {
  const rows = parseSalesYtd(csv);
  const byName = new Map(rows.map((r) => [norm(r.closer), r]));

  const closers = CONFIG.salesClosers.map((name) => {
    const row = byName.get(norm(name)) || {};
    return {
      closer: name,
      periods: row.periods || emptyPeriods(),
      notes: row.notes || '',
    };
  });

  const totalRow = byName.get(norm(CONFIG.salesTotalRow)) || {};

  /* A label is not a KPI: when Meta has not named the window, the calendar year
     from the clock is a true description of what the card covers, and naming it
     beats an unlabelled column of money. The NUMBERS are never derived this
     way - those stay em dashes until the Sheet supplies them. */
  const label = meta.ytdlabel || meta.ytdLabel || `${new Date().getFullYear()} YTD`;

  return {
    label,
    basis: meta.ytdbasis || meta.ytdBasis || '',
    closers,
    total: {
      periods: totalRow.periods || emptyPeriods(),
      notes: totalRow.notes || '',
    },
    /* The Sheet's own Total is what the board shows - never a sum the board
       computed. But a Total that disagrees with its parts is worth saying out
       loud rather than hiding, so the card can footnote it. */
    reconciles: reconcileSales(closers, (totalRow.periods || emptyPeriods()).ytd.dollars),
    updated: freshest(meta.ytdupdatedet || '', rows.map((r) => r.updated)),
    present: rows.length > 0,
  };
}

function reconcileSales(closers, total) {
  if (total === null) return null;
  const parts = closers.map((c) => c.periods.ytd.dollars).filter((v) => v !== null);
  if (parts.length !== closers.length) return null;   // can't judge a partial set
  const sum = parts.reduce((a, b) => a + b, 0);
  return Math.abs(sum - total) < 0.5;
}

/* `Sales YTD Detail` — one row per signed job, behind each closer on the card. */
function parseSalesDetail(csv) {
  return records(csv)
    .map((r) => ({
      closer: String(pick(r, ['closer', 'salesman', 'salesperson', 'owner', 'person', 'name'])).trim(),
      projectNumber: String(pick(r, ['projectnumber', 'projectno', 'projectid', 'project'])).trim(),
      customer: String(pick(r, ['customer', 'customername', 'homeowner', 'project'])).trim(),
      wonDate: String(pick(r, ['wondate', 'date', 'signeddate', 'signed'])).trim(),
      wonMonth: String(pick(r, ['wonmonth', 'month'])).trim(),
      dollars: parseValue(pick(r, ['contract', 'contracts', 'contractdollars', 'dollars', 'amount', 'value'])),
      updated: String(pick(r, ['updatedet', 'updated'])).trim(),
    }))
    .filter((row) => row.closer !== '' && !/^note/i.test(row.closer));
}

/* YYYY-MM, taken from Won Month when the Sheet supplies it and derived from the
   first seven characters of Won Date when it does not. Deliberately string
   surgery rather than Date parsing: `new Date('2026-10-01')` is read as UTC and
   comes back as September 30th west of Greenwich, which would file a job under
   the wrong month on a board whose whole point is which month it was signed. */
export function monthKeyOf(row) {
  const m = String(row.wonMonth || '').trim();
  if (/^\d{4}-\d{2}$/.test(m)) return m;
  const d = String(row.wonDate || '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 7);
  return '';
}

/* Jobs per closer, grouped by month, newest month first and newest job first
   inside it. The Sheet's own row order is never trusted - it is a convenience,
   not a contract. */
export function buildSalesDetail(csv) {
  const rows = parseSalesDetail(csv);
  const byCloser = new Map();

  for (const row of rows) {
    const key = norm(row.closer);
    if (!byCloser.has(key)) byCloser.set(key, []);
    byCloser.get(key).push({ ...row, monthKey: monthKeyOf(row) });
  }

  for (const [key, list] of byCloser) {
    const months = new Map();
    for (const job of list) {
      if (!months.has(job.monthKey)) months.set(job.monthKey, []);
      months.get(job.monthKey).push(job);
    }

    const grouped = [...months.entries()]
      /* A job with no readable month sorts last rather than being dropped: it
         is a real signed job and hiding it would make the panel disagree with
         its own footer. */
      .sort((a, b) => (b[0] || '').localeCompare(a[0] || ''))
      .map(([monthKey, jobs]) => {
        jobs.sort((x, y) => {
          const d = String(y.wonDate || '').localeCompare(String(x.wonDate || ''));
          return d !== 0 ? d : String(x.customer || '').localeCompare(String(y.customer || ''));
        });
        const known = jobs.map((j) => j.dollars).filter((v) => v !== null);
        return {
          monthKey,
          jobs,
          /* A subtotal across rows where some dollar cells are blank would be a
             number nobody can reconcile, so it stays null and renders an em
             dash - the job count is still true and still shown. */
          subtotal: known.length === jobs.length ? known.reduce((a, b) => a + b, 0) : null,
          count: jobs.length,
        };
      });

    const all = list.map((j) => j.dollars).filter((v) => v !== null);
    byCloser.set(key, {
      months: grouped,
      total: all.length === list.length ? all.reduce((a, b) => a + b, 0) : null,
      count: list.length,
    });
  }

  return {
    present: rows.length > 0,
    byCloser,
    updated: freshest('', rows.map((r) => r.updated)),
  };
}

const pad2 = (n) => String(n).padStart(2, '0');
const ymd = (y, m, d) => `${y}-${pad2(m)}-${pad2(d)}`;
const lastDayOf = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/* The calendar window a card period covers, as plain YYYY-MM-DD strings so the
   Sheet's own date strings can be compared without ever being parsed. (A
   `new Date('2026-10-01')` is read as UTC and lands on September 30th west of
   Greenwich, which would put a job in the wrong month.)

   `today` comes from the browser's clock, which on the TV is Eastern - the same
   calendar ProLine's Won Date uses. */
export function periodRange(key, today = new Date()) {
  const y = today.getFullYear();
  const m = today.getMonth() + 1;         // 1-12
  const d = today.getDate();
  const q = Math.floor((m - 1) / 3);      // 0-3

  switch (key) {
    case 'ytd':
      return { start: ymd(y, 1, 1), end: ymd(y, m, d) };
    case 'month':
      return { start: ymd(y, m, 1), end: ymd(y, m, d) };
    case 'lastmonth': {
      const py = m === 1 ? y - 1 : y;
      const pm = m === 1 ? 12 : m - 1;
      return { start: ymd(py, pm, 1), end: ymd(py, pm, lastDayOf(py, pm)) };
    }
    case 'quarter':
      return { start: ymd(y, q * 3 + 1, 1), end: ymd(y, m, d) };
    case 'lastquarter': {
      const py = q === 0 ? y - 1 : y;
      const pq = q === 0 ? 3 : q - 1;
      const endMonth = pq * 3 + 3;
      return { start: ymd(py, pq * 3 + 1, 1), end: ymd(py, endMonth, lastDayOf(py, endMonth)) };
    }
    default:
      return null;
  }
}

/* The job list for one closer, plus whether it agrees with the summary tab.
   A disagreement is reported, never reconciled by inventing or dropping rows:
   the panel shows what the detail tab actually holds and says the summary
   differs. */
export function detailFor(model, closer, period = 'ytd', today = new Date()) {
  const detail = model.salesDetail || { present: false, byCloser: new Map() };
  const all = detail.byCloser.get(norm(closer)) || { months: [], total: null, count: 0 };

  /* Narrowing the job list to the selected window is filtering, not deriving:
     every row carries its own Won Date. The CARD's number still comes from the
     Sheet's own column for that period and is never computed from these rows. */
  const found = period === 'ytd' ? all : narrowToPeriod(all, periodRange(period, today));
  const summary = (model.salesYtd?.closers || []).find((c) => norm(c.closer) === norm(closer)) || {};
  /* Compare like with like: the panel is showing ONE period, so it is that
     period's summary column it has to agree with. Checking a narrowed total
     against the YTD figure cried mismatch on every period but year to date. */
  const summaryPeriod = (summary.periods || {})[period] || {};

  const dollarsAgree = summaryPeriod.dollars === null || summaryPeriod.dollars === undefined || found.total === null
    ? null
    : Math.abs(found.total - summaryPeriod.dollars) < 0.5;
  const countAgree = summaryPeriod.count === null || summaryPeriod.count === undefined
    ? null
    : found.count === summaryPeriod.count;

  return {
    closer,
    period,
    present: detail.present,
    months: found.months,
    total: found.total,
    count: found.count,
    summaryDollars: summaryPeriod.dollars ?? null,
    summaryCount: summaryPeriod.count ?? null,
    agrees: dollarsAgree === false || countAgree === false ? false
      : dollarsAgree === null && countAgree === null ? null : true,
  };
}

/* Keeps only the jobs whose Won Date falls inside the window, re-totalling as
   it goes. A job with no readable date is kept out of a narrowed window rather
   than guessed into one - it still appears under YTD, where it belongs. */
function narrowToPeriod(found, range) {
  if (!range) return { months: [], total: null, count: 0 };

  const months = [];
  for (const month of found.months) {
    const jobs = month.jobs.filter((j) => {
      const date = String(j.wonDate || '').slice(0, 10);
      return date.length === 10 && date >= range.start && date <= range.end;
    });
    if (!jobs.length) continue;
    const known = jobs.map((j) => j.dollars).filter((v) => v !== null);
    months.push({
      monthKey: month.monthKey,
      jobs,
      subtotal: known.length === jobs.length ? known.reduce((a, b) => a + b, 0) : null,
      count: jobs.length,
    });
  }

  const all = months.flatMap((m) => m.jobs);
  const known = all.map((j) => j.dollars).filter((v) => v !== null);
  return {
    months,
    total: known.length === all.length ? known.reduce((a, b) => a + b, 0) : null,
    count: all.length,
  };
}

function parseL10Current(csv) {
  return records(csv)
    .map((r) => ({
      period: String(pick(r, ['period', 'view', 'week'])).trim(),
      sort: parseValue(pick(r, ['sort', 'order'])),
      group: String(pick(r, ['group'])).trim(),
      measurable: String(pick(r, ['measurable', 'metric', 'name'])).trim(),
      owner: String(pick(r, ['owner'])).trim(),
      goalOp: String(pick(r, ['goalop', 'op', 'operator'])).trim(),
      goal: pick(r, ['goal', 'target']),
      value: pick(r, ['value']),
      unit: String(pick(r, ['unit', 'units'])).trim(),
      weekLabel: String(pick(r, ['weeklabel', 'week'])).trim(),
      notes: String(pick(r, ['notes', 'note'])).trim(),
      updated: String(pick(r, ['updatedet', 'updated'])).trim(),
    }))
    .filter((row) => row.measurable !== '' && !/^note/i.test(row.measurable));
}

function parseL10History(csv) {
  return records(csv)
    .map((r) => ({
      weekStart: String(pick(r, ['weekstart', 'start'])).trim(),
      weekEnd: String(pick(r, ['weekend', 'end'])).trim(),
      weekLabel: String(pick(r, ['weeklabel', 'week'])).trim(),
      sort: parseValue(pick(r, ['sort', 'order'])),
      measurable: String(pick(r, ['measurable', 'metric', 'name'])).trim(),
      goalOp: String(pick(r, ['goalop', 'op'])).trim(),
      goal: pick(r, ['goal', 'target']),
      value: pick(r, ['value']),
      unit: String(pick(r, ['unit', 'units'])).trim(),
    }))
    .filter((row) => row.measurable !== '' && !/^note/i.test(row.measurable));
}

/* >=, >, <=, <, = against the Sheet's own numbers. No invented scaling, and no
   verdict at all unless both sides are real numbers - a blank value is unknown,
   which is not a miss. */
export function hitStatus(value, goal, goalOp) {
  if (value === null || goal === null) return null;
  switch (String(goalOp || '').trim()) {
    case '>=': case '≥': return value >= goal;
    case '>': return value > goal;
    case '<=': case '≤': return value <= goal;
    case '<': return value < goal;
    case '=': case '==': return value === goal;
    default: return null;
  }
}

export function buildL10FromCsv({ current = '', history = '', meta = '' }) {
  const metaRows = parseMeta(meta);
  const currentRows = parseL10Current(current);
  const historyRows = parseL10History(history);

  /* Nine measurables per view, so without this filter every card appears
     twice - once for the completed week and once for the week in progress.
     A row with no Period belongs to whatever view is showing. */
  const view = normalizeL10View(metaRows.l10viewdefault) || CONFIG.l10DefaultView;
  const forView = currentRows.filter((row) => {
    const rowView = normalizeL10View(row.period);
    return rowView === null || rowView === view;
  });
  /* If the sheet only carries the other view, show that rather than nothing:
     an empty page hides numbers that exist. */
  const rows = forView.length ? forView : currentRows;

  const cards = rows
    .map((row) => {
      const value = parseValue(row.value);
      const goal = parseValue(row.goal);
      return {
        ...row,
        value,
        goal,
        hit: hitStatus(value, goal, row.goalOp),
      };
    })
    .sort((a, b) => {
      if (a.sort !== null && b.sort !== null) return a.sort - b.sort;
      return a.measurable.localeCompare(b.measurable);
    });

  /* History joined on the exact measurable string (defensive trim only), and
     ordered by WeekStart so the x axis is chronological rather than sheet
     order. A blank Value stays null: it is a gap in the line, not a zero. */
  const history_ = new Map();
  for (const row of historyRows) {
    const key = norm(row.measurable);
    if (!history_.has(key)) history_.set(key, []);
    history_.get(key).push({
      weekStart: row.weekStart,
      weekLabel: row.weekLabel || row.weekStart,
      value: parseValue(row.value),
      goal: parseValue(row.goal),
      goalOp: row.goalOp,
    });
  }
  for (const series of history_.values()) {
    series.sort((a, b) => String(a.weekStart).localeCompare(String(b.weekStart)));
  }

  const trendWeeks = parseValue(metaRows.l10trendweeks) || CONFIG.l10TrendWeeks;

  return {
    view,
    weekLabel: metaRows[`l10weeklabel${view}`] || metaRows.l10weeklabel
      || (cards[0] && cards[0].weekLabel) || '',
    trendWeeks,
    cards,
    history: history_,
    refreshSeconds: parseValue(metaRows.refreshseconds),
    updated: freshest(metaRows.lastupdatedet || '', [
      ...rows.map((r) => r.updated),
    ]),
    fetchedAt: new Date(),
  };
}

export function historyFor(model, measurable) {
  return model.history.get(norm(measurable)) || [];
}

export async function loadL10() {
  const { tabs } = CONFIG;
  const wanted = [
    ['current', tabs.l10],
    ['history', tabs.l10History],
    ['meta', tabs.meta],
  ];

  const settled = await Promise.all(wanted.map(async ([key, tab]) => {
    try {
      return { key, tab, csv: await fetchTabCsv(tab) };
    } catch (error) {
      return { key, tab, csv: '', error };
    }
  }));

  const csv = { current: '', history: '', meta: '' };
  const sources = {};
  const sourceErrors = [];
  let noSource = 0;

  for (const result of settled) {
    csv[result.key] = result.csv;
    if (result.error) {
      sources[result.key] = 'unavailable';
      sourceErrors.push(`${result.tab}: ${result.error.message}`);
      if (result.error instanceof NoSourceError) noSource += 1;
      console.warn(`[talon] L10 tab "${result.tab}" unavailable:`, result.error.message);
    } else {
      sources[result.key] = 'ok';
    }
  }

  if (sources.current !== 'ok') {
    if (noSource) throw new NoSourceError('No data source for the L10 scorecard.');
    throw new Error(sourceErrors.join(' · ') || 'L10 Scorecard could not be read');
  }

  const model = buildL10FromCsv(csv);
  model.sources = sources;
  model.sourceErrors = sourceErrors;
  return model;
}

function parseMeta(csv) {
  const out = {};
  for (const r of records(csv)) {
    const key = norm(pick(r, ['key', 'name', 'setting']));
    const value = String(pick(r, ['value', 'val'])).trim();
    if (key) out[key] = value;
  }
  return out;
}

/* --- value guards ------------------------------------------------------ */

/* A blank Period means the default period: the KPI tab predates this column,
   and a Sheet that never adopts it must keep working exactly as it does now.
   An unrecognised period is dropped rather than guessed at — better a missing
   tile than a weekly number displayed as the month. */
/* The L10 tab carries the same kind of column the KPI tab does, but its values
   are "last" and "current": the completed week the Level 10 meeting reviews,
   and the partial week in progress. A blank value belongs to whichever view is
   showing, so a tab without the column keeps working. */
export function normalizeL10View(raw) {
  const v = norm(raw);
  if (v === '' ) return null;
  if (v === 'last' || v === 'lastweek' || v === 'prior' || v === 'completed') return 'last';
  if (v === 'current' || v === 'currentweek' || v === 'thisweek' || v === 'wtd') return 'current';
  return null;
}

export function normalizePeriod(raw) {
  const text = String(raw ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!text) return CONFIG.defaultPeriod;
  if (['monthly', 'month', 'mtd', 'm', 'monthtodate'].includes(text)) return 'monthly';
  if (['weekly', 'week', 'wtd', 'w', 'l10', 'weektodate'].includes(text)) return 'weekly';
  return null;
}


/* Daily Top Five is count-based: five items, 20% each. Anything outside that
   set is bad data (a cell has been corrupted into a timestamp before now), and
   bad data must read as missing rather than as a number nobody scored. */
function validToday(value, row) {
  if (value === null) return null;
  const allowed = CONFIG.top5ValidToday;
  if (!allowed || !allowed.length) return inRange(value);
  if (allowed.indexOf(value) > -1) return value;
  console.warn(`[talon] ignoring out-of-range Today % for ${row && row.person}:`, row && row.today);
  return null;
}

function inRange(value) {
  if (value === null) return null;
  return value >= 0 && value <= 100 ? value : null;
}

/* A timestamp is only reformatted when it carries an explicit offset (ISO).
   A human stamp with no zone ("Wed Sep 17 7:10 AM") is displayed as written,
   because guessing its zone would be inventing precision we don't have. */
const ISO_WITH_OFFSET = /(Z|[+-]\d{2}:?\d{2})$/;

function parseStamp(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  if (!ISO_WITH_OFFSET.test(text)) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

/* Newest timestamp we can actually parse, across Meta and every tab's own
   Updated column; plus the first human stamp as a display fallback. */
function freshest(metaStamp, rows) {
  const candidates = [metaStamp, ...rows].map((v) => String(v ?? '').trim()).filter(Boolean);
  let date = null;
  for (const candidate of candidates) {
    const parsed = parseStamp(candidate);
    if (parsed && (!date || parsed > date)) date = parsed;
  }
  const raw = String(metaStamp ?? '').trim() || candidates[0] || '';
  return { date, raw };
}

/* --- model ------------------------------------------------------------- */

export function normalizeModel(raw) {
  // Meta tab wins; the Rest Index summary block fills anything it leaves out.
  const meta = { ...((raw.rest && raw.rest.meta) || {}), ...(raw.meta || {}) };
  const kpiRows = Array.isArray(raw.kpi) ? raw.kpi : [];
  const kpi = new Map();
  const periodsSeen = {};
  for (const row of kpiRows) {
    const key = norm(row.metric);
    if (!key) continue;

    const period = normalizePeriod(row.period);
    if (period === null) {
      console.warn(`[talon] ignoring KPI row with unknown Period "${row.period}":`, row.metric);
      continue;
    }

    // Keyed by period + metric, so the same eight labels can appear twice.
    const mapKey = `${period}::${key}`;
    if (kpi.has(mapKey)) continue; // first row wins, as before

    periodsSeen[period] = true;
    kpi.set(mapKey, {
      ...row,
      period,
      number: parseValue(row.value),
      targetNumber: parseValue(row.target),
      percent: parsePercent(row.value),
      targetPercent: parsePercent(row.target),
    });
  }

  const top5 = (Array.isArray(raw.top5) ? raw.top5 : []).map((row) => ({
    person: row.person,
    today: validToday(parsePercent(row.today), row),
    week: inRange(parsePercent(row.week)),
    updated: row.updated || '',
  }));

  const restRaw = raw.rest || {};
  const people = (restRaw.people || []).map((row) => ({
    person: row.person,
    days: parseValue(row.days),
    projects: parseValue(row.projects),
    updated: row.updated || '',
  }));

  let index = restRaw.index === null || restRaw.index === undefined
    ? null
    : parseValue(restRaw.index);
  let computed = false;

  if (index === null) {
    // Fallback: mean of the locked owners that actually have a number.
    const owned = people.filter(
      (p) => CONFIG.restOwners.some((o) => norm(o) === norm(p.person)) && p.days !== null
    );
    if (owned.length) {
      index = owned.reduce((sum, p) => sum + p.days, 0) / owned.length;
      computed = true;
    }
  }

  const metaStamp = meta.lastupdatedet || meta.lastUpdatedEt || '';
  const updated = freshest(metaStamp, [
    ...kpiRows.map((r) => r.updated),
    ...top5.map((r) => r.updated),
    ...people.map((r) => r.updated),
  ]);

  return {
    mode: raw.mode || 'live',
    example: Boolean(raw.example),
    meta: {
      lastUpdatedEt: metaStamp,
      periodLabel: meta.periodlabel || meta.periodLabel || '',
      periodLabels: {
        monthly: meta.periodlabelmonthly || meta.periodLabelMonthly || '',
        weekly: meta.periodlabelweekly || meta.periodLabelWeekly || '',
      },
      defaultPeriod: normalizePeriod(meta.defaultperiod || meta.defaultPeriod || '')
        || CONFIG.defaultPeriod,
      refreshSeconds: parseValue(meta.refreshseconds ?? meta.refreshSeconds),
    },
    periodsSeen,
    kpi,
    top5,
    rest: { index, computed, people },
    /* Weekly series per measurable for the tile sparklines. Always a Map, so a
       caller never has to guard - an absent history tab is an empty one. */
    trends: raw.trends instanceof Map ? raw.trends : new Map(),
    /* Always an object, so the card can render its frame whether or not the
       Sheet has the tab yet. */
    salesYtd: raw.salesYtd || buildSalesYtd('', raw.meta || {}),
    salesDetail: raw.salesDetail || buildSalesDetail(''),
    updated,
    sources: raw.sources || {},
    sourceErrors: raw.sourceErrors || [],
    fetchedAt: new Date(),
  };
}

/* CSV text (all four tabs) -> board model. Exported so it can be exercised
   without a network: see scripts/test-parsers.mjs. */
export function buildModelFromCsv({ kpi = '', top5 = '', rest = '', meta = '', l10History = '', salesYtd = '', salesDetail = '', sources, sourceErrors }) {
  const parsed = {
    kpi: parseKpi(kpi),
    top5: parseTop5(top5),
    rest: parseRest(rest),
    meta: parseMeta(meta),
  };

  /* Weekly series per measurable, for the tile sparklines. Keyed the same way
     the L10 page keys them, so one parser serves both, and ordered by WeekStart
     rather than sheet order. A blank Value stays null - it is a gap in the
     line, never a zero. */
  const trends = new Map();
  for (const row of parseL10History(l10History)) {
    const key = norm(row.measurable);
    if (!trends.has(key)) trends.set(key, []);
    trends.get(key).push({
      weekStart: row.weekStart,
      label: row.weekLabel || row.weekStart,
      value: parseValue(row.value),
    });
  }
  for (const series of trends.values()) {
    series.sort((a, b) => String(a.weekStart).localeCompare(String(b.weekStart)));
  }

  /* A tab that fetched fine but yielded nothing usable is a parse failure, not
     an empty tab, and it must not read as healthy. This is how the mangled
     gviz header went unnoticed: CSV arrived, every row was dropped, and the
     zone just went blank. */
  const marks = { ...(sources || {}) };
  const errors = [...(sourceErrors || [])];
  const rowCount = {
    kpi: parsed.kpi.length,
    top5: parsed.top5.length,
    rest: parsed.rest.people.length + (parsed.rest.index === null ? 0 : 1),
    meta: Object.keys(parsed.meta).length,
  };

  /* l10History is deliberately absent here: it is decoration, so an empty or
     missing history tab is not a fault to badge. */
  for (const [key, csv] of Object.entries({ kpi, top5, rest, meta })) {
    const hasContent = String(csv).trim().split('\n').length > 1;
    if (hasContent && rowCount[key] === 0) {
      marks[key] = 'unparsed';
      errors.push(`${key}: CSV arrived but no rows parsed - check the header row`);
      console.warn(`[talon] tab "${key}" returned CSV but parsed to zero rows`);
    }
  }

  return normalizeModel({
    mode: 'live',
    ...parsed,
    salesYtd: buildSalesYtd(salesYtd, parsed.meta),
    salesDetail: buildSalesDetail(salesDetail),
    trends,
    sources: marks,
    sourceErrors: errors,
  });
}

/**
 * Fetches the four tabs independently. A tab that is missing, renamed or
 * unwritten must not take the rest of the board down: Talon adds tabs over
 * time, and the Top 5 strip has to light up the day it is wired even though
 * `Rest Index` may not exist yet. The board only reports a data-source failure
 * when every data tab fails.
 */
export async function loadLive() {
  const { tabs } = CONFIG;
  const wanted = [
    ['kpi', tabs.kpi],
    ['top5', tabs.top5],
    ['rest', tabs.rest],
    ['meta', tabs.meta],
    /* Weekly history for the tile sparklines. Decoration, like Meta: if this
       tab is missing the tiles simply show no line, which is the honest
       outcome - a board with eight numbers and no trends still works. */
    ['l10History', tabs.l10History],
    /* The YTD scoreboard, and the job list behind each closer on it. Both are
       tolerated failures: the card renders its frame with em dashes, and the
       drill-down panel says the detail tab is not ready. */
    ['salesYtd', tabs.salesYtd],
    ['salesDetail', tabs.salesDetail],
  ];

  const settled = await Promise.all(wanted.map(async ([key, tab]) => {
    try {
      return { key, tab, csv: await fetchTabCsv(tab) };
    } catch (error) {
      return { key, tab, csv: '', error };
    }
  }));

  const csv = { kpi: '', top5: '', rest: '', meta: '', l10History: '', salesYtd: '', salesDetail: '' };
  const sources = {};
  const sourceErrors = [];
  let noSource = 0;

  for (const result of settled) {
    csv[result.key] = result.csv;
    if (result.error) {
      sources[result.key] = 'unavailable';
      sourceErrors.push(`${result.tab}: ${result.error.message}`);
      if (result.error instanceof NoSourceError) noSource += 1;
      console.warn(`[talon] tab "${result.tab}" unavailable:`, result.error.message);
    } else {
      sources[result.key] = 'ok';
    }
  }

  // Meta is decoration; kpi/top5/rest are the data. All three gone = no feed.
  const dataTabsOk = ['kpi', 'top5', 'rest'].filter((key) => sources[key] === 'ok').length;
  if (!dataTabsOk) {
    if (noSource) {
      throw new NoSourceError(
        'No data source: set SHEET_ID in Netlify env (Function proxy) or CONFIG.sheetId (direct CSV).'
      );
    }
    throw new Error(sourceErrors.join(' · ') || 'No tabs could be read');
  }

  return buildModelFromCsv({ ...csv, sources, sourceErrors });
}

export async function loadFixture(name) {
  // Root-absolute: the board also serves from the secret /t/<random> path.
  const file = name === 'empty' ? '/fixtures/empty.json' : '/fixtures/example.json';
  const res = await fetch(file, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Fixture ${file} not found (${res.status})`);
  const raw = await res.json();
  return normalizeModel({ ...raw, mode: name, example: true });
}

export function kpiFor(model, metric, period) {
  const want = period || CONFIG.defaultPeriod;
  return model.kpi.get(`${want}::${norm(metric)}`) || null;
}

/* The label describing the view currently on screen. A period-specific label
   wins; the generic `period_label` only describes the default view, so it is
   never reused for the other one; otherwise just the period's name. */
export function periodLabel(model, period) {
  const want = period || CONFIG.defaultPeriod;
  const labels = (model.meta && model.meta.periodLabels) || {};
  if (labels[want]) return labels[want];
  if (want === (model.meta?.defaultPeriod || CONFIG.defaultPeriod) && model.meta?.periodLabel) {
    return model.meta.periodLabel;
  }
  return want === 'weekly' ? 'Weekly' : 'Monthly';
}

/* Just the Top Five tab, for the fast celebration poll. The board's own
   refresh stays on the Meta cadence: this exists so a closed item shows up in
   seconds without re-fetching five tabs, the HUD, and everything else.
   Throws on failure - the caller keeps the last good rows on screen. */
export async function loadTop5() {
  const csv = await fetchTabCsv(CONFIG.tabs.top5);
  const rows = parseTop5(csv);
  if (!rows.length && String(csv).trim().split('\n').length > 1) {
    throw new Error('Top Five: CSV arrived but no rows parsed - check the header row');
  }
  return rows.map((row) => ({
    person: row.person,
    today: validToday(parseValue(row.today), row),
    week: inRange(parseValue(row.week)),
    updated: row.updated,
  }));
}

/* The weekly series behind a tile's sparkline, newest last and trimmed to the
   number of weeks a tile can legibly show. Unknown measurable -> empty. */
export function trendFor(model, measurable, weeks = CONFIG.tileTrendWeeks) {
  const series = (model.trends instanceof Map ? model.trends : new Map()).get(norm(measurable)) || [];
  return series.slice(-Math.max(1, weeks));
}
