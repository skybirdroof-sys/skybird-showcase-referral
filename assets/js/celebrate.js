/* Top Five celebrations — Phase 1.
 *
 * Someone finishes an item on their Daily Top Five, the ops bot writes the new
 * percentage, and within a few seconds the board dings once and turns that
 * person's name bright green. That is the whole feature. It is a reward
 * mechanism pointed at a room full of people, so the rules that matter are the
 * ones that stop it lying or nagging:
 *
 *   - The first successful poll is a BASELINE and never celebrates. A TV that
 *     boots at 8am must not ding six times for work done yesterday.
 *   - Only an INCREASE celebrates. A decrease is the bot correcting itself, and
 *     a blank cell is a write in progress, not an achievement.
 *   - One celebration at a time. The 4pm write can move three people at once;
 *     three dings on top of each other is noise, and nobody can tell who it was
 *     for. They queue and play in turn.
 *
 * This module owns no DOM. It decides WHAT should happen and hands each
 * celebration to callbacks, so it can be tested without a browser.
 */

import { CONFIG } from './config.js';

const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/* The Sheet's Today % is count-based - five items, 20% each - so these are the
   only values it can legitimately hold. Anything else (a cell corrupted into a
   timestamp, a stray 45) is not a smaller achievement, it is a broken cell, and
   it must never be the thing that fires a ding. */
function validToday(value) {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const allowed = CONFIG.top5ValidToday;
  if (allowed && allowed.length && !allowed.includes(n)) return null;
  return n;
}

export function createCelebrations({
  onCelebrate = () => {},
  onState = () => {},
  now = () => Date.now(),
  schedule = (fn, ms) => setTimeout(fn, ms),
} = {}) {
  /* last: person -> the last VALID percentage seen. A person who is blank at
     baseline is stored as null on purpose, because null -> 20 later in the day
     is a real first close and has to celebrate. */
  const last = new Map();
  const queue = [];

  let baselined = false;
  let running = false;
  let lastCloser = null;

  function emitState() {
    onState({
      lastCloser,
      // Everyone currently on the board with something closed today.
      scoring: new Set([...last.entries()]
        .filter(([, v]) => typeof v === 'number' && v >= CONFIG.celebrate.softGreenAt)
        .map(([k]) => k)),
    });
  }

  function pump() {
    if (running) return;
    const next = queue.shift();
    if (!next) return;

    running = true;
    lastCloser = next.key;
    emitState();
    onCelebrate(next);

    /* A hundred holds the floor longer, because its pulse is still running and
       a second ding underneath it would land on top of the moment it is for. */
    const dwell = next.hundred ? CONFIG.celebrate.hundredDwellMs : CONFIG.celebrate.dwellMs;
    schedule(() => { running = false; pump(); }, dwell);
  }

  return {
    /* Feed it every set of Top Five rows, from the fast poll and from the full
       board refresh alike. Identical values observed twice are a no-op, so the
       two paths cannot double-fire. Returns the celebrations queued, which is
       what the tests assert on. */
    observe(rows) {
      const seen = new Map();
      for (const row of rows || []) {
        const key = norm(row.person);
        if (!key) continue;
        seen.set(key, { person: row.person, today: validToday(row.today) });
      }

      if (!baselined) {
        for (const [key, row] of seen) last.set(key, row.today);
        baselined = true;
        emitState();
        return [];
      }

      const fired = [];
      const order = CONFIG.top5Order.map(norm);
      const keys = [...seen.keys()].sort((a, b) => {
        const ia = order.indexOf(a);
        const ib = order.indexOf(b);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      });

      for (const key of keys) {
        const { person, today } = seen.get(key);
        const had = last.has(key);
        const prev = last.get(key);

        /* An invalid or blank cell tells us nothing: hold the last known value
           rather than overwrite it, so a mid-write blank cannot manufacture an
           increase when the number comes back. */
        if (today === null) continue;

        /* Somebody added to the tab mid-day. Their first reading is their
           baseline, not a close we watched happen. */
        if (!had) { last.set(key, today); continue; }

        const from = prev === null || prev === undefined ? null : prev;
        const rose = from === null ? today >= CONFIG.celebrate.softGreenAt : today > from;

        /* A decrease still updates the stored value - it is the bot correcting
           itself, and if they climb back later that IS a real close. */
        last.set(key, today);
        if (!rose) continue;

        const item = { key, person, from, to: today, hundred: today === 100, at: now() };
        queue.push(item);
        fired.push(item);
      }

      if (fired.length) pump(); else emitState();
      return fired;
    },

    /* Test and diagnostic surface. */
    get state() {
      return { baselined, running, queued: queue.length, lastCloser, last: new Map(last) };
    },
  };
}

/* --- the ding ---------------------------------------------------------- */

/* Browsers refuse to play audio until the page has been interacted with, and a
 * wall display is never interacted with. So sound is a control rather than an
 * assumption: the preference persists, and until a real gesture has unlocked
 * playback the control says so instead of silently doing nothing. A kiosk that
 * nobody ever touches wants Chrome's --autoplay-policy=no-user-gesture-required
 * (see README).
 */
export function createSound({ src = CONFIG.celebrate.dingPath, storageKey = CONFIG.celebrate.soundStorageKey } = {}) {
  let enabled = true;
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved === 'off') enabled = false;
  } catch { /* private mode: fall back to on */ }

  let unlocked = false;
  let audio = null;
  const listeners = new Set();

  function element() {
    if (!audio) {
      audio = new Audio(src);
      audio.preload = 'auto';
    }
    return audio;
  }

  const notify = () => { for (const fn of listeners) fn({ enabled, unlocked }); };

  return {
    get enabled() { return enabled; },
    get unlocked() { return unlocked; },
    onChange(fn) { listeners.add(fn); fn({ enabled, unlocked }); },

    toggle() {
      enabled = !enabled;
      try { localStorage.setItem(storageKey, enabled ? 'on' : 'off'); } catch { /* private mode */ }
      if (enabled) this.unlock();
      notify();
      return enabled;
    },

    /* Called from a real user gesture. Playing and immediately pausing a muted
       clip is what convinces the browser the page may make noise later. */
    unlock() {
      if (unlocked) return Promise.resolve(true);
      const el = element();
      const wasMuted = el.muted;
      el.muted = true;
      return Promise.resolve(el.play())
        .then(() => {
          el.pause();
          el.currentTime = 0;
          el.muted = wasMuted;
          unlocked = true;
          notify();
          return true;
        })
        .catch(() => {
          el.muted = wasMuted;
          return false;
        });
    },

    play() {
      if (!enabled) return;
      const el = element();
      try {
        el.currentTime = 0;
        const p = el.play();
        if (p && p.catch) {
          p.catch(() => {
            // Blocked: surface it on the control rather than failing silently.
            unlocked = false;
            notify();
          });
        } else {
          unlocked = true;
        }
      } catch {
        unlocked = false;
        notify();
      }
    },
  };
}
