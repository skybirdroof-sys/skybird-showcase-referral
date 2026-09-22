/* Talon board bootstrap: gate -> first paint -> auto-refresh loop. */

import { CONFIG } from './config.js';
import { loadLive, loadFixture, loadTop5, normalizeModel, NoSourceError } from './sheet.js';
import {
  buildTiles, renderModel, setStale,
  renderCelebrationState, pulsePerson, announce, renderSoundButton, renderTop5Rows,
} from './render.js';
import { createCelebrations, createSound } from './celebrate.js';
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

/* The celebration engine and the ding. Both are created before the first
   fetch, so the very first set of rows the board sees becomes the baseline and
   nothing is celebrated on boot. */
const sound = createSound();

const celebrations = createCelebrations({
  onCelebrate(item) {
    sound.play();
    if (item.hundred) pulsePerson(item.key, CONFIG.celebrate.hundredPulseMs);
    announce(item.hundred
      ? `${item.person} completed all five, ${item.to} percent.`
      : `${item.person} is at ${item.to} percent, up from ${item.from === null ? 'none' : item.from + ' percent'}.`);
  },
  onState: renderCelebrationState,
});

const state = {
  lastModel: null,
  lastFetchAt: null,
  refreshMs: CONFIG.refreshSeconds * 1000,
  timer: null,
  loading: false,
  top5Timer: null,
  pollingTop5: false,
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
    /* The full refresh sees the same rows as the fast poll. Identical values
       are a no-op in the engine, so feeding it from both paths cannot
       double-fire, and whichever arrives first wins the ding. */
    celebrations.observe(model.top5);
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

/* --- the fast Top Five poll -------------------------------------------- */

/* One tab, every dozen seconds, entirely separate from the board refresh. A
   failure here is silent on purpose: the numbers already on screen stay, and
   the board's own refresh owns the stale badge. A celebration nobody gets is
   better than a red flag on the wall every time a poll blips. */
async function pollTop5() {
  if (MODE !== 'live' || state.pollingTop5) return;
  state.pollingTop5 = true;
  try {
    const rows = await loadTop5();
    if (rows.length) {
      renderTop5Rows(rows);
      celebrations.observe(rows);
    }
  } catch (err) {
    console.warn('[talon] Top Five poll failed (board unaffected):', err && err.message ? err.message : err);
  } finally {
    state.pollingTop5 = false;
    scheduleTop5();
  }
}

function scheduleTop5() {
  clearTimeout(state.top5Timer);
  if (document.hidden || MODE !== 'live') return;
  state.top5Timer = setTimeout(pollTop5, CONFIG.top5PollSeconds * 1000);
}

function onVisibility() {
  if (document.hidden) {
    clearTimeout(state.timer);
    clearTimeout(state.top5Timer);
    return;
  }
  scheduleTop5();
  const age = state.lastFetchAt ? Date.now() - state.lastFetchAt.getTime() : Infinity;
  if (age >= state.refreshMs) tick();
  else schedule();
}

async function start() {
  buildTiles();
  await ensureAccess();

  /* Typing the passphrase is a real user gesture, and Chrome's activation is
     sticky for the life of the document - so the person who unlocks the board
     unlocks the ding with it, and nobody has to find the sound control. On a
     screen with no gate this no-ops and the control says "SOUND - TAP". */
  sound.unlock();

  startHud();

  // Paint the empty skeleton immediately so the TV is never a black screen.
  renderModel(emptyModel(), { stale: false, lastFetchAt: null, period: state.period });

  await tick();
  scheduleTop5();

  document.addEventListener('visibilitychange', onVisibility);

  /* The control is also the gesture that unlocks audio, which is why it says
     "SOUND - TAP" until playback has actually been allowed. */
  sound.onChange(renderSoundButton);
  document.getElementById('sound-toggle').addEventListener('click', () => sound.toggle());

  /* Any click or key anywhere counts as the gesture too, so on a screen that
     someone does touch the control never has to be found. */
  const unlockOnce = () => { sound.unlock(); };
  document.addEventListener('pointerdown', unlockOnce, { once: true });
  document.addEventListener('keydown', unlockOnce, { once: true });

  document.getElementById('period-toggle').addEventListener('click', (event) => {
    const btn = event.target.closest('.period__btn');
    if (btn) setPeriod(btn.dataset.period);
  });

  document.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if (key === 'r') tick();                 // manual refresh, for tuning
    if (key === 'm') setPeriod('monthly');   // monthly / weekly from a keyboard
    if (key === 'w') setPeriod('weekly');
    if (key === 'l') window.location.href = '/l10';   // Level 10 scorecard
    if (key === 's') sound.toggle();                 // silence the ding
  });
}

start();
