/* DOM rendering. Pure output: it reads a normalized model and writes text.
   Anything null becomes an em dash, never a 0. */

import { CONFIG } from './config.js';
import { kpiFor, periodLabel, trendFor } from './sheet.js';
import { sparkline, sparkSummary } from './chart.js';
import {
  EMPTY, fmtByUnit, fmtPct, fmtRest, fmtEtStamp, normalizeUnit, clamp,
} from './format.js';

const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

const el = {
  board: () => document.getElementById('board'),
  tiles: () => document.getElementById('tiles'),
  top5: () => document.getElementById('top5-rows'),
  restValue: () => document.getElementById('rest-value'),
  restChips: () => document.getElementById('rest-chips'),
  period: () => document.getElementById('period-label'),
  periodToggle: () => document.getElementById('period-toggle'),
  updated: () => document.getElementById('last-updated'),
  badgeStale: () => document.getElementById('badge-stale'),
  badgeExample: () => document.getElementById('badge-example'),
};

/* --- one-time scaffolding ---------------------------------------------- */

export function buildTiles() {
  const host = el.tiles();
  host.textContent = '';

  for (const tile of CONFIG.tiles) {
    const node = document.createElement('article');
    node.className = `tile${tile.alert ? ' tile--alert' : ''}`;
    node.dataset.metric = norm(tile.metric);

    const label = document.createElement('h3');
    label.className = 'tile__label';
    label.textContent = tile.metric;

    const value = document.createElement('p');
    value.className = 'tile__value is-empty';
    value.textContent = EMPTY;

    const foot = document.createElement('p');
    foot.className = 'tile__foot';

    const target = document.createElement('span');
    target.className = 'tile__target';
    target.hidden = true;

    const note = document.createElement('span');
    note.className = 'tile__note';
    note.textContent = tile.note || '';

    foot.append(target, note);
    node.append(label, value);

    /* Only the tiles with a weekly series get a sparkline slot. The others get
       no empty box either - a reserved gap reads as a chart that failed. */
    if (tile.trend) {
      const trend = document.createElement('div');
      trend.className = 'tile__trend';

      const span = document.createElement('span');
      span.className = 'tile__trend-label';
      /* Says what the line covers, because the big number above it may be
         showing the MONTH while the line is always weekly. */
      span.textContent = `${CONFIG.tileTrendWeeks}-WK`;

      trend.append(span);
      node.append(trend);
    }

    node.append(foot);
    host.append(node);
  }
}

/* Rebuild a list only when its row identities change, so bar transitions and
   the browser's layout work survive a refresh. */
function syncRows(host, keys, create) {
  const signature = keys.join('|');
  if (host.dataset.signature === signature) return;
  host.dataset.signature = signature;
  host.textContent = '';
  for (const key of keys) host.append(create(key));
}

function orderPeople(people, order) {
  const seen = new Set();
  const out = [];
  for (const wanted of order) {
    const match = people.find((p) => norm(p.person) === norm(wanted));
    out.push(match || { person: wanted, today: null, week: null, days: null, projects: null });
    seen.add(norm(wanted));
  }
  // Tolerate extra people the Sheet grows later (Margaret/Travis on Rest Index, etc.)
  for (const person of people) {
    if (!seen.has(norm(person.person))) out.push(person);
  }
  return out;
}

/* --- zones -------------------------------------------------------------- */

function renderRest(model) {
  const value = el.restValue();
  const text = fmtRest(model.rest.index);
  value.textContent = text;
  value.classList.toggle('is-empty', text === EMPTY);
  value.title = model.rest.computed
    ? 'Computed client-side as the mean of Jacob / John / Henry / Anas'
    : 'Rest Index provided by the Sheet';

  const people = orderPeople(model.rest.people, CONFIG.restOwners);
  const host = el.restChips();
  syncRows(host, people.map((p) => p.person), (name) => {
    const li = document.createElement('li');
    li.className = 'chip';
    li.dataset.person = norm(name);
    const label = document.createElement('span');
    label.className = 'chip__name';
    label.textContent = name;
    const val = document.createElement('span');
    val.className = 'chip__value is-empty';
    val.textContent = EMPTY;
    li.append(label, val);
    return li;
  });

  for (const person of people) {
    const chip = host.querySelector(`[data-person="${norm(person.person)}"] .chip__value`);
    if (!chip) continue;
    const text = fmtRest(person.days);
    chip.textContent = text;
    chip.classList.toggle('is-empty', text === EMPTY);
  }
}

function renderTop5(model) {
  renderTop5Rows(model.top5);
}

/* Takes rows rather than a model, so the fast celebration poll can repaint the
   strip from one tab without a whole board model to hand. */
export function renderTop5Rows(rows) {
  const people = orderPeople(rows, CONFIG.top5Order);
  const host = el.top5();

  syncRows(host, people.map((p) => p.person), (name) => {
    const li = document.createElement('li');
    li.className = 'top5__row';
    li.dataset.person = norm(name);

    const label = document.createElement('span');
    label.className = 'top5__name';

    /* Always in the DOM, transparent until this person is the latest closer.
       Reserving the width means switching it on cannot nudge the name sideways,
       and it means the state is not carried by colour alone. */
    const marker = document.createElement('span');
    marker.className = 'top5__marker';
    marker.setAttribute('aria-hidden', 'true');
    marker.textContent = '●';

    const who = document.createElement('span');
    who.className = 'top5__who';
    who.textContent = name;

    label.append(marker, who);

    const track = document.createElement('div');
    track.className = 'top5__track';
    const fill = document.createElement('span');
    fill.className = 'top5__fill';
    const avg = document.createElement('span');
    avg.className = 'top5__avg';
    avg.hidden = true;
    track.append(fill, avg);

    const nums = document.createElement('div');
    nums.className = 'top5__nums';
    const today = document.createElement('span');
    today.className = 'top5__today is-empty';
    today.textContent = EMPTY;
    const week = document.createElement('span');
    week.className = 'top5__week is-empty';
    week.textContent = EMPTY;
    nums.append(today, week);

    li.append(label, track, nums);
    return li;
  });

  for (const person of people) {
    const row = host.querySelector(`[data-person="${norm(person.person)}"]`);
    if (!row) continue;

    const todayText = fmtPct(person.today);
    // Blank rather than a second em dash — the today figure already reads empty.
    const weekText = person.week === null ? '' : `avg ${fmtPct(person.week)}`;

    const todayEl = row.querySelector('.top5__today');
    todayEl.textContent = todayText;
    todayEl.classList.toggle('is-empty', todayText === EMPTY);

    const weekEl = row.querySelector('.top5__week');
    weekEl.textContent = weekText;
    weekEl.classList.toggle('is-empty', person.week === null);

    row.querySelector('.top5__fill').style.width =
      person.today === null ? '0%' : `${clamp(person.today, 0, 100)}%`;

    const avgEl = row.querySelector('.top5__avg');
    if (person.week === null) {
      avgEl.hidden = true;
    } else {
      avgEl.hidden = false;
      avgEl.style.left = `calc(${clamp(person.week, 0, 100)}% - ${0.15}%)`;
    }
  }
}

function renderTiles(model, period) {
  for (const spec of CONFIG.tiles) {
    const node = el.tiles().querySelector(`[data-metric="${norm(spec.metric)}"]`);
    if (!node) continue;

    const row = kpiFor(model, spec.metric, period);
    const unit = normalizeUnit(row?.unit) || spec.unit;
    const number = unit === 'pct' ? (row ? row.percent : null) : (row ? row.number : null);
    const text = row ? fmtByUnit(number, unit) : EMPTY;

    const value = node.querySelector('.tile__value');
    value.textContent = text;
    value.classList.toggle('is-empty', text === EMPTY);

    const targetNumber = unit === 'pct' ? row?.targetPercent : row?.targetNumber;
    const target = node.querySelector('.tile__target');
    if (targetNumber === null || targetNumber === undefined) {
      target.hidden = true;
      target.textContent = '';
    } else {
      target.hidden = false;
      target.textContent = `target ${fmtByUnit(targetNumber, unit)}`;
    }

    renderTileTrend(node, spec, model, unit);
  }
}

/* The weekly shape behind the number. Redrawn each refresh rather than diffed:
   an SVG this small is cheaper to rebuild than to reconcile, and the tile keeps
   its label so nothing flashes. */
function renderTileTrend(node, spec, model, unit) {
  const host = node.querySelector('.tile__trend');
  if (!host || !spec.trend) return;

  const series = trendFor(model, spec.trend);
  const points = series.map((row) => ({ label: row.label, value: row.value }));
  const format = (n) => fmtByUnit(n, unit);
  const label = spec.metric;

  host.querySelector('svg')?.remove();

  const real = points.filter((p) => p.value !== null && p.value !== undefined);
  /* One point is not a trend and no points is not a chart. Either way the tile
     shows its number alone rather than a line implying history that isn't
     there. */
  if (real.length < 2) {
    host.hidden = true;
    return;
  }

  host.hidden = false;
  host.append(sparkline({ points, format, label }));
  host.title = sparkSummary({ points, format, label });
}

/* Paints who has closed something today and who closed most recently. Kept
   apart from renderTop5 so the fast celebration poll can repaint just this
   without touching the bars, the numbers or anything else on the board. */
export function renderCelebrationState({ lastCloser = null, scoring = new Set() } = {}) {
  for (const row of el.top5().querySelectorAll('.top5__row')) {
    const key = row.dataset.person;
    row.classList.toggle('is-scoring', scoring.has(key));
    row.classList.toggle('is-last-closer', key === lastCloser);
  }
}

/* The pulse for a full five of five. transform and opacity only: a font-size
   or padding change here would reflow the strip, and the board must not twitch
   while somebody is looking at it. */
export function pulsePerson(personKey, ms) {
  const row = el.top5().querySelector(`.top5__row[data-person="${personKey}"]`);
  if (!row) return;
  row.classList.remove('is-pulsing');
  void row.offsetWidth;            // restart the animation if it is still running
  row.classList.add('is-pulsing');
  setTimeout(() => row.classList.remove('is-pulsing'), ms);
}

/* A wall display has no hover and no screen reader, but the announcement is
   also the non-visual channel for the celebration, so it is real markup rather
   than a console log. */
export function announce(text) {
  const live = document.getElementById('top5-live');
  if (live) live.textContent = text;
}

export function renderSoundButton({ enabled, unlocked }) {
  const btn = document.getElementById('sound-toggle');
  if (!btn) return;
  const blocked = enabled && !unlocked;
  btn.classList.toggle('is-off', !enabled);
  btn.classList.toggle('is-blocked', blocked);
  btn.setAttribute('aria-pressed', String(enabled));
  btn.textContent = enabled ? (blocked ? 'SOUND — TAP' : 'SOUND ON') : 'SOUND OFF';
  btn.title = !enabled
    ? 'Celebrations are visual only. Click to turn the ding on.'
    : blocked
      ? 'This browser blocks audio until the page is clicked. Click here once to allow the ding.'
      : 'Celebration ding is on. Click to silence it.';
  btn.setAttribute('aria-label', btn.title);
}

function renderChrome(model, state) {
  const period = state.period || CONFIG.defaultPeriod;

  // The label always describes what is on screen, so a board left on weekly
  // says so rather than quietly showing week numbers under a monthly heading.
  el.period().textContent = periodLabel(model, period);

  for (const btn of el.periodToggle().querySelectorAll('.period__btn')) {
    const active = btn.dataset.period === period;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', String(active));
  }

  // Newest timestamp the Sheet gave us (Meta, or any tab's Updated column),
  // reformatted only when it carried a real offset; otherwise shown as written.
  // Falls back to this client's fetch time so the TV is never blank.
  const stamped = model.updated || { date: null, raw: '' };
  const stamp = stamped.date
    ? fmtEtStamp(stamped.date)
    : (stamped.raw || fmtEtStamp(model.fetchedAt));

  const updated = el.updated();
  updated.textContent = stamp || EMPTY;

  const notes = [`Board last fetched ${fmtEtStamp(state.lastFetchAt || model.fetchedAt)}`];
  const missing = Object.keys(model.sources || {}).filter((k) => model.sources[k] !== 'ok');
  if (missing.length) notes.push(`Tabs unavailable: ${missing.join(', ')}`);
  updated.title = notes.join(' · ');

  el.badgeExample().hidden = !model.example;

  const badge = el.badgeStale();
  badge.hidden = !state.stale;
  if (!state.stale) {
    badge.textContent = 'feed stale';
    badge.title = '';
  }
}

export function renderModel(model, state = {}) {
  const period = state.period || CONFIG.defaultPeriod;
  document.documentElement.dataset.mode = model.mode;
  document.documentElement.dataset.period = period;
  renderRest(model);
  renderTop5(model);
  renderTiles(model, period);
  renderChrome(model, state);
  el.board().hidden = false;
}

export function setStale(stale, opts = {}) {
  const badge = el.badgeStale();
  badge.hidden = !stale;
  badge.textContent = opts.label || 'feed stale';
  badge.title = opts.note || '';
}
