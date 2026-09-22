/* Level 10 scorecard page: nine flip cards, front = this week, back = 13-week
 * trend. Reads the same Sheet through the same proxy as the board; writes
 * nothing anywhere.
 *
 * Flip state is per card and keyed by measurable, so a refresh that changes
 * values cannot flip cards or move focus, and a card only resets if its
 * measurable disappears from the Sheet.
 */

import { CONFIG } from './config.js';
import { loadL10, historyFor, NoSourceError } from './sheet.js';
import { ensureAccess } from './gate.js';
import { EMPTY, fmtEtStamp, normalizeUnit, clamp } from './format.js';
import { trendChart, trendTable, trendSummary } from './chart.js';

const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

const state = {
  model: null,
  flipped: new Set(),   // measurable keys currently showing their trend
  order: [],            // flip order, so Esc restores the most recent
  timer: null,
  refreshMs: CONFIG.refreshSeconds * 1000,
  loading: false,
};

/* --- formatting ------------------------------------------------------- */

/* Cents are kept here, unlike the TV tiles. This page exists to be typed into
   Ninety, and a rounded figure would be transcribed wrong. */
function formatterFor(unit) {
  switch (normalizeUnit(unit)) {
    case 'usd':
      return (n) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'pct':
      return (n) => `${Number.isInteger(n) ? n : Number(n.toFixed(1))}%`;
    case 'count':
      return (n) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });
    default:
      return (n) => String(n);
  }
}

const GOAL_OP = { '>=': '≥', '>': '>', '<=': '≤', '<': '<', '=': '=' };

function goalText(card, format) {
  if (card.goal === null) return 'no goal set';
  const op = GOAL_OP[String(card.goalOp).trim()] || card.goalOp || '';
  return `goal ${op} ${format(card.goal)}`.replace(/\s+/g, ' ').trim();
}

/* --- cards ------------------------------------------------------------ */

function cardElement(card) {
  const key = norm(card.measurable);
  const format = formatterFor(card.unit);

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'card';
  button.dataset.key = key;
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-label', `Show trend for ${card.measurable}`);

  const inner = document.createElement('div');
  inner.className = 'card__inner';

  /* front */
  const front = document.createElement('div');
  front.className = 'card__face card__face--front';

  const name = document.createElement('h2');
  name.className = 'card__measurable';
  name.textContent = card.measurable;

  const value = document.createElement('p');
  value.className = 'card__value';
  if (card.value === null) {
    value.textContent = EMPTY;
    value.classList.add('is-empty');
  } else {
    value.textContent = format(card.value);
  }

  const foot = document.createElement('div');
  foot.className = 'card__foot';

  const left = document.createElement('span');
  left.className = 'card__goal';
  left.textContent = goalText(card, format);

  const right = document.createElement('span');
  // A verdict only where there is a number to judge; blank is unknown, not a miss.
  if (card.hit === null) {
    right.className = 'card__owner';
    right.textContent = card.owner || EMPTY;
  } else {
    right.className = `pill ${card.hit ? 'pill--hit' : 'pill--miss'}`;
    right.textContent = card.hit ? 'HIT' : 'MISS';
  }

  foot.append(left, right);

  const owner = document.createElement('span');
  owner.className = 'card__foot';
  owner.textContent = card.hit === null ? '' : `owner ${card.owner || EMPTY}`;

  front.append(name, value, foot);
  if (card.hit !== null) front.append(owner);

  /* back */
  const back = document.createElement('div');
  back.className = 'card__face card__face--back';
  back.dataset.role = 'back';

  front.setAttribute('aria-hidden', 'false');
  back.setAttribute('aria-hidden', 'true');
  back.inert = true;

  inner.append(front, back);
  button.append(inner);
  return button;
}

function fillBack(button, card, model) {
  const back = button.querySelector('[data-role="back"]');
  if (!back || back.dataset.filled === signatureFor(card, model)) return;
  back.dataset.filled = signatureFor(card, model);
  back.textContent = '';

  const format = formatterFor(card.unit);
  const series = historyFor(model, card.measurable);
  const weeks = clamp(model.trendWeeks || CONFIG.l10TrendWeeks, 1, 52);
  const points = series.slice(-weeks).map((row) => ({ label: row.weekLabel, value: row.value }));

  const head = document.createElement('div');
  head.className = 'card__back-head';
  const title = document.createElement('h3');
  title.className = 'card__back-title';
  title.textContent = card.measurable;
  const count = document.createElement('span');
  count.className = 'card__weeks';
  const withData = points.filter((p) => p.value !== null).length;
  count.textContent = `${withData}/${points.length} weeks`;
  head.append(title, count);

  const goal = card.goal !== null ? card.goal : (series.find((r) => r.goal !== null) || {}).goal ?? null;
  const summaryText = trendSummary({
    measurable: card.measurable, points, goal, goalOp: GOAL_OP[card.goalOp] || card.goalOp, format,
  });

  const figure = trendChart({
    points, goal, goalOp: GOAL_OP[card.goalOp] || card.goalOp, format, title: summaryText,
  });

  const summary = document.createElement('p');
  summary.className = 'card__summary';
  summary.textContent = summaryText;

  back.append(head, figure, summary, trendTable(points, format));
}

/* Refills the back only when its data actually changed. */
function signatureFor(card, model) {
  const series = historyFor(model, card.measurable);
  return `${card.goal}|${card.goalOp}|${card.unit}|${series.map((r) => r.value).join(',')}`;
}

function setFlipped(button, flipped) {
  const key = button.dataset.key;
  const card = state.model.cards.find((c) => norm(c.measurable) === key);
  if (!card) return;

  if (flipped) fillBack(button, card, state.model);

  button.classList.toggle('is-flipped', flipped);
  button.setAttribute('aria-expanded', String(flipped));
  button.setAttribute('aria-label',
    flipped ? `Show current week for ${card.measurable}` : `Show trend for ${card.measurable}`);

  const front = button.querySelector('.card__face--front');
  const back = button.querySelector('.card__face--back');
  // The hidden face must not be focusable or read twice.
  front.setAttribute('aria-hidden', String(flipped));
  front.inert = flipped;
  back.setAttribute('aria-hidden', String(!flipped));
  back.inert = !flipped;

  if (flipped) {
    state.flipped.add(key);
    state.order = [...state.order.filter((k) => k !== key), key];
  } else {
    state.flipped.delete(key);
    state.order = state.order.filter((k) => k !== key);
  }
}

function toggle(button) {
  setFlipped(button, !button.classList.contains('is-flipped'));
}

/* --- render ----------------------------------------------------------- */

function render(model) {
  state.model = model;
  const grid = document.getElementById('l10-grid');

  document.getElementById('l10-week').textContent = model.weekLabel || '';

  const signature = model.cards.map((c) => norm(c.measurable)).join('|');
  const rebuild = grid.dataset.signature !== signature;
  if (rebuild) {
    grid.dataset.signature = signature;
    grid.textContent = '';

    let lastGroup = null;
    for (const card of model.cards) {
      if (card.group && card.group !== lastGroup) {
        lastGroup = card.group;
        const label = document.createElement('p');
        label.className = 'l10__group-label';
        label.textContent = card.group;
        grid.append(label);
      }
      grid.append(cardElement(card));
    }

    // A measurable that vanished loses its flip state; the rest keep theirs.
    const present = new Set(model.cards.map((c) => norm(c.measurable)));
    state.flipped = new Set([...state.flipped].filter((k) => present.has(k)));
    state.order = state.order.filter((k) => present.has(k));
  }

  // Update in place, then restore each card's own flip state. No card flips
  // because data arrived, and focus is never moved.
  for (const card of model.cards) {
    const key = norm(card.measurable);
    const button = grid.querySelector(`.card[data-key="${key}"]`);
    if (!button) continue;

    if (!rebuild) {
      const fresh = cardElement(card);
      button.querySelector('.card__face--front').replaceWith(fresh.querySelector('.card__face--front'));
      const back = button.querySelector('[data-role="back"]');
      if (back.dataset.filled && back.dataset.filled !== signatureFor(card, model)) {
        delete back.dataset.filled;
        if (state.flipped.has(key)) fillBack(button, card, model);
      }
    }

    setFlipped(button, state.flipped.has(key));
  }

  const note = document.getElementById('l10-note');
  const missing = Object.keys(model.sources || {}).filter((k) => model.sources[k] !== 'ok');
  const stamp = model.updated && model.updated.date
    ? fmtEtStamp(model.updated.date)
    : (model.updated && model.updated.raw) || fmtEtStamp(model.fetchedAt);
  note.textContent = missing.length
    ? `Updated ${stamp} · unavailable: ${missing.join(', ')}`
    : `Updated ${stamp}`;

  document.getElementById('badge-stale').hidden = true;
  document.getElementById('l10').hidden = false;
}

/* --- refresh ---------------------------------------------------------- */

async function tick() {
  if (state.loading) return;
  state.loading = true;
  try {
    const model = await loadL10();
    state.refreshMs = clamp(model.refreshSeconds || CONFIG.refreshSeconds,
      CONFIG.refreshMin, CONFIG.refreshMax) * 1000;
    render(model);
  } catch (err) {
    console.error('[talon] L10 refresh failed', err);
    const note = document.getElementById('l10-note');
    note.textContent = err instanceof NoSourceError
      ? 'No data source configured for the L10 scorecard.'
      : `Could not read the scorecard: ${err.message}`;
    document.getElementById('badge-stale').hidden = false;
    document.getElementById('l10').hidden = false;
  } finally {
    state.loading = false;
    schedule();
  }
}

function schedule() {
  clearTimeout(state.timer);
  if (document.hidden) return;
  state.timer = setTimeout(tick, state.refreshMs);
}

/* --- wiring ----------------------------------------------------------- */

async function start() {
  await ensureAccess();
  await tick();

  const grid = document.getElementById('l10-grid');

  grid.addEventListener('click', (event) => {
    const button = event.target.closest('.card');
    if (button) toggle(button);
  });

  /* No keydown handler for Enter/Space on purpose. A native <button> already
     handles both - Enter on keydown, Space on keyUP - and a focused button
     does not scroll the page on Space. An earlier preventDefault() here
     cancelled the Space activation entirely, so the card flipped open and
     would not flip back. */

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      const last = state.order[state.order.length - 1];
      if (last) {
        const button = grid.querySelector(`.card[data-key="${last}"]`);
        if (button) setFlipped(button, false);
      } else {
        window.location.href = '/';   // nothing flipped: Esc leaves the page
      }
      return;
    }
    if (event.key === 'r' || event.key === 'R') tick();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { clearTimeout(state.timer); return; }
    tick();
  });
}

start();
