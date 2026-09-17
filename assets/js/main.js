/* Talon board bootstrap: gate -> first paint -> auto-refresh loop. */

import { CONFIG } from './config.js';
import { loadLive, loadFixture, normalizeModel, NoSourceError } from './sheet.js';
import { buildTiles, renderModel, setStale } from './render.js';
import { ensureAccess } from './gate.js';
import { startHud } from './hud.js';
import { clamp } from './format.js';

const params = new URLSearchParams(location.search);
const MODE = (params.get('mode') || 'live').toLowerCase();

const state = {
  lastModel: null,
  lastFetchAt: null,
  refreshMs: CONFIG.refreshSeconds * 1000,
  timer: null,
  loading: false,
};

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
    renderModel(model, { stale: false, lastFetchAt: state.lastFetchAt });
  } catch (err) {
    console.error('[talon] refresh failed', err);

    if (state.lastModel) {
      // Keep the last good numbers on screen — never wipe to fake zeros.
      renderModel(state.lastModel, { stale: true, lastFetchAt: state.lastFetchAt });
    } else {
      renderModel(emptyModel(), { stale: true, lastFetchAt: null });
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
  renderModel(emptyModel(), { stale: false, lastFetchAt: null });

  await tick();

  document.addEventListener('visibilitychange', onVisibility);

  // Manual refresh for tuning sessions.
  document.addEventListener('keydown', (event) => {
    if (event.key === 'r' || event.key === 'R') tick();
  });
}

start();
