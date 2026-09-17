/* Number formatting for a TV. Core rule: a blank Sheet cell is NOT zero.
   parseValue() returns null for blank/unparseable, and every formatter turns
   null into an em dash. A literal 0 in the Sheet renders as 0. */

export const EMPTY = '—';

export function parseValue(raw) {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (s === '' || s === '-' || s === '—' || s === '…' || s === 'n/a' || s === 'N/A') return null;

  const cleaned = s.replace(/[$,\s]/g, '').replace(/%$/, '');
  if (cleaned === '' || !/^-?\d*\.?\d+$/.test(cleaned)) return null;

  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/* Percent cells arrive either formatted ("40%", "38.5%") or raw. Sheets cells
   formatted as percent can export as a fraction, so 0 < n <= 1 is read as a
   fraction. Count-based Top 5 scoring only ever yields 0/20/40/60/80/100, so
   there is no ambiguous case in practice. Documented in SHEET_SCHEMA.md. */
export function parsePercent(raw) {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (s === '') return null;
  const n = parseValue(s);
  if (n === null) return null;
  if (s.includes('%')) return n;
  if (n > 0 && n <= 1) return n * 100;
  return n;
}

const round1 = (n) => Math.round(n * 10) / 10;

export function fmtUsd(n) {
  if (n === null) return EMPTY;
  const abs = Math.abs(n);
  const body = abs.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return `${n < 0 ? '-' : ''}$${body}`;
}

export function fmtPct(n) {
  if (n === null) return EMPTY;
  const r = round1(n);
  return `${Number.isInteger(r) ? r : r.toFixed(1)}%`;
}

export function fmtCount(n) {
  if (n === null) return EMPTY;
  return Math.round(n).toLocaleString('en-US');
}

export function fmtRest(n) {
  if (n === null) return EMPTY;
  return round1(n).toFixed(1);
}

export function fmtByUnit(n, unit) {
  switch (normalizeUnit(unit)) {
    case 'usd': return fmtUsd(n);
    case 'pct': return fmtPct(n);
    case 'count': return fmtCount(n);
    default: return n === null ? EMPTY : String(n);
  }
}

export function normalizeUnit(unit) {
  const u = String(unit ?? '').trim().toLowerCase();
  if (!u) return '';
  if (u.startsWith('$') || u === 'usd' || u === 'dollars' || u === 'cash' || u === 'money') return 'usd';
  if (u === '%' || u.startsWith('pct') || u.startsWith('percent') || u.startsWith('rate')) return 'pct';
  if (u.startsWith('count') || u === '#' || u.startsWith('int') || u.startsWith('num')) return 'count';
  return u;
}

const ET_STAMP = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

/* `Wed Sep 17 · 4:05 PM ET` */
export function fmtEtStamp(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return EMPTY;
  const parts = ET_STAMP.formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value ?? '';
  const day = `${get('weekday')} ${get('month')} ${get('day')}`;
  const time = `${get('hour')}:${get('minute')} ${get('dayPeriod')}`;
  return `${day} · ${time} ET`;
}

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}
