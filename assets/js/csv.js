/* Minimal RFC4180-ish CSV parser — handles quoted fields, embedded commas,
   escaped quotes and CRLF. Google's gviz CSV export is well behaved but does
   quote any cell containing a comma (money with separators, notes). */

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  let i = 0;

  const src = String(text ?? '').replace(/^﻿/, '');

  const endField = () => { row.push(field); field = ''; };
  const endRow = () => { endField(); rows.push(row); row = []; };

  while (i < src.length) {
    const ch = src[i];

    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i += 2; continue; }
        quoted = false; i += 1; continue;
      }
      field += ch; i += 1; continue;
    }

    if (ch === '"') { quoted = true; i += 1; continue; }
    if (ch === ',') { endField(); i += 1; continue; }
    if (ch === '\r') { i += 1; continue; }
    if (ch === '\n') { endRow(); i += 1; continue; }

    field += ch; i += 1;
  }

  if (field !== '' || row.length) endRow();

  return rows.filter((r) => r.some((cell) => String(cell).trim() !== ''));
}

const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/* Turn a CSV table into objects keyed by normalized header, so `Today %`,
   `today %` and `Today%` all resolve the same way. */
export function toRecords(rows) {
  if (!rows.length) return [];
  const headers = rows[0].map(norm);
  return rows.slice(1).map((cells) => {
    const rec = { _cells: cells };
    headers.forEach((h, idx) => {
      if (!h) return;
      if (!(h in rec)) rec[h] = cells[idx] ?? '';
    });
    return rec;
  });
}

/* Find the first present key among candidates (already normalized). */
export function pick(rec, candidates) {
  for (const key of candidates) {
    if (rec && key in rec && String(rec[key]).trim() !== '') return rec[key];
  }
  for (const key of candidates) {
    if (rec && key in rec) return rec[key];
  }
  return '';
}
