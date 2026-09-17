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

async function fetchTabCsv(tab) {
  if (proxyWorks !== false) {
    try {
      const res = await fetch(`${CONFIG.proxyPath}?tab=${encodeURIComponent(tab)}`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const text = await res.text();
        if (looksLikeCsv(text)) { proxyWorks = true; return text; }
        throw new Error(`Proxy returned non-CSV for "${tab}"`);
      }
      // 404 = no functions running (plain static serve). 501 = SHEET_ID unset.
      if (res.status === 404 || res.status === 501) {
        proxyWorks = false;
      } else {
        throw new Error(`Proxy error ${res.status} for "${tab}"`);
      }
    } catch (err) {
      if (proxyWorks === true) throw err;
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

function parseRest(csv) {
  const rows = records(csv).map((r) => ({
    person: String(pick(r, ['person', 'name', 'owner'])).trim(),
    days: pick(r, ['daysatrestavg', 'daysatrest', 'restdays', 'avgdaysatrest', 'days']),
    projects: pick(r, ['projectcount', 'projects', 'openprojects', 'count']),
    updated: String(pick(r, ['updatedet', 'updated'])).trim(),
  }));

  let index = null;
  const people = [];

  for (const row of rows) {
    if (row.person === '' || /^note/i.test(row.person)) continue;
    if (norm(row.person) === 'restindex') {
      // Summary row: `Rest Index | <company avg> | Updated ET`
      index = parseValue(row.days);
      continue;
    }
    people.push(row);
  }

  return { index, people };
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

/* --- model ------------------------------------------------------------- */

export function normalizeModel(raw) {
  const meta = raw.meta || {};
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
    today: parsePercent(row.today),
    week: parsePercent(row.week),
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

  return {
    mode: raw.mode || 'live',
    example: Boolean(raw.example),
    meta: {
      lastUpdatedEt: meta.lastupdatedet || meta.lastUpdatedEt || '',
      periodLabel: meta.periodlabel || meta.periodLabel || '',
      refreshSeconds: parseValue(meta.refreshseconds ?? meta.refreshSeconds),
    },
    kpi,
    top5,
    rest: { index, computed, people },
    fetchedAt: new Date(),
  };
}

/* CSV text (all four tabs) -> board model. Exported so it can be exercised
   without a network: see scripts/test-parsers.mjs. */
export function buildModelFromCsv({ kpi = '', top5 = '', rest = '', meta = '' }) {
  return normalizeModel({
    mode: 'live',
    kpi: parseKpi(kpi),
    top5: parseTop5(top5),
    rest: parseRest(rest),
    meta: parseMeta(meta),
  });
}

export async function loadLive() {
  const { tabs } = CONFIG;

  const [kpi, top5, rest] = await Promise.all([
    fetchTabCsv(tabs.kpi),
    fetchTabCsv(tabs.top5),
    fetchTabCsv(tabs.rest),
  ]);

  // Meta is optional — a missing tab must not take the board down.
  let meta = '';
  try {
    meta = await fetchTabCsv(tabs.meta);
  } catch {
    meta = '';
  }

  return buildModelFromCsv({ kpi, top5, rest, meta });
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
