/* Talon board bootstrap: gate -> first paint -> auto-refresh loop. */

import { CONFIG } from './config.js';
import { loadLive, loadFixture, normalizeModel, NoSourceError } from './sheet.js';
import { buildTiles, renderModel, setStale } from './render.js';
import { ensureAccess } from './gate.js';
import { startHud } from './hud.js';
import { clamp } from './format.js';

const params = new URLSearchParams(location.search);
const MODE = (params.get('mode') || 'live').toLowerCase();

/* Remembered per browser, so the TV stays where it was left. Nothing
   auto-reverts: the label and the amber Weekly pill say which view is up. */
function storedPeriod() {
  try {
    const saved = localStorage.getItem(CONFIG.periodStorageKey);
    return CONFIG.periods.includes(saved) ? saved : null;
  } catch {
    return null;
  }
}

const state = {
  lastModel: null,
  lastFetchAt: null,
  refreshMs: CONFIG.refreshSeconds * 1000,
  timer: null,
  loading: false,
  period: storedPeriod() || CONFIG.defaultPeriod,
  periodPinned: storedPeriod() !== null,
};

function setPeriod(period, { remember = true } = {}) {
  if (!CONFIG.periods.includes(period) || period === state.period) return;
  state.period = period;

  if (remember) {
    state.periodPinned = true;
    try { localStorage.setItem(CONFIG.periodStorageKey, period); } catch { /* private mode */ }
  }

  // Both periods are already in the model, so switching needs no fetch.
  if (state.lastModel) {
    renderModel(state.lastModel, {
      stale: false,
      lastFetchAt: state.lastFetchAt,
      period: state.period,
    });
  }
}

const emptyModel = () => normalizeModel({
  mode: MODE === 'live' ? 'live' : MODE,
  example: MODE !== 'live',
  kpi: [],
  top5: [],
  rest: {},
  meta: {},
});

function refreshMsFor(model) {
  const override = Number(params.get('refresh'));
  const seconds = Number.isFinite(override) && override > 0
    ? override
    : (model?.meta.refreshSeconds ?? CONFIG.refreshSeconds);
  return clamp(seconds, CONFIG.refreshMin, CONFIG.refreshMax) * 1000;
}

async function load() {
  if (MODE === 'example' || MODE === 'empty') return loadFixture(MODE);
  return loadLive();
}

async function tick() {
  if (state.loading) return;
  state.loading = true;

  try {
    const model = await load();
    state.lastModel = model;
    state.lastFetchAt = new Date();
    state.refreshMs = refreshMsFor(model);
    // Meta can set the house default, but a choice made on this screen wins.
    if (!state.periodPinned && model.meta.defaultPeriod) {
      state.period = model.meta.defaultPeriod;
    }
    renderModel(model, { stale: false, lastFetchAt: state.lastFetchAt, period: state.period });
  } catch (err) {
    console.error('[talon] refresh failed', err);

    if (state.lastModel) {
      // Keep the last good numbers on screen — never wipe to fake zeros.
      renderModel(state.lastModel, { stale: true, lastFetchAt: state.lastFetchAt, period: state.period });
    } else {
      renderModel(emptyModel(), { stale: true, lastFetchAt: null, period: state.period });
    }

    setStale(true, {
      label: err instanceof NoSourceError ? 'no data source' : 'feed stale',
      note: String(err && err.message ? err.message : err),
    });
  } finally {
    state.loading = false;
    schedule();
  }
}

function schedule() {
  clearTimeout(state.timer);
  if (document.hidden) return; // resumed by visibilitychange
  state.timer = setTimeout(tick, state.refreshMs);
}

function onVisibility() {
  if (document.hidden) {
    clearTimeout(state.timer);
    return;
  }
  const age = state.lastFetchAt ? Date.now() - state.lastFetchAt.getTime() : Infinity;
  if (age >= state.refreshMs) tick();
  else schedule();
}

async function start() {
  buildTiles();
  await ensureAccess();
  startHud();

  // Paint the empty skeleton immediately so the TV is never a black screen.
  renderModel(emptyModel(), { stale: false, lastFetchAt: null, period: state.period });

  await tick();

  document.addEventListener('visibilitychange', onVisibility);

  document.getElementById('period-toggle').addEventListener('click', (event) => {
    const btn = event.target.closest('.period__btn');
    if (btn) setPeriod(btn.dataset.period);
  });

  document.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if (key === 'r') tick();                 // manual refresh, for tuning
    if (key === 'm') setPeriod('monthly');   // monthly / weekly from a keyboard
    if (key === 'w') setPeriod('weekly');
  });
}

start();
