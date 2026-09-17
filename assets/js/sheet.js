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

function gvizUrl(tab) {
  return `https://docs.google.com/spreadsheets/d/${CONFIG.sheetId}` +
    `/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;
}

function looksLikeCsv(text) {
  const t = String(text ?? '').trim();
  // Google hands back an HTML error page for a bad id / unshared Sheet.
  return t !== '' && !t.startsWith('<');
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
  for (const row of kpiRows) {
    const key = norm(row.metric);
    if (!key || kpi.has(key)) continue;
    kpi.set(key, {
      ...row,
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
      refreshSeconds: parseValue(meta.refreshseconds ?? meta.refreshSeconds),
    },
    kpi,
    top5,
    rest: { index, computed, people },
    updated,
    sources: raw.sources || {},
    sourceErrors: raw.sourceErrors || [],
    fetchedAt: new Date(),
  };
}

/* CSV text (all four tabs) -> board model. Exported so it can be exercised
   without a network: see scripts/test-parsers.mjs. */
export function buildModelFromCsv({ kpi = '', top5 = '', rest = '', meta = '', sources, sourceErrors }) {
  return normalizeModel({
    mode: 'live',
    kpi: parseKpi(kpi),
    top5: parseTop5(top5),
    rest: parseRest(rest),
    meta: parseMeta(meta),
    sources,
    sourceErrors,
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
  ];

  const settled = await Promise.all(wanted.map(async ([key, tab]) => {
    try {
      return { key, tab, csv: await fetchTabCsv(tab) };
    } catch (error) {
      return { key, tab, csv: '', error };
    }
  }));

  const csv = { kpi: '', top5: '', rest: '', meta: '' };
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

export function kpiFor(model, metric) {
  return model.kpi.get(norm(metric)) || null;
}
