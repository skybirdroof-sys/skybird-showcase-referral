/* Talon centre HUD — concentric instrument cluster.
 *
 * Structure: every ring is one absolutely-positioned div, masked to an annulus
 * in CSS and filled with a conic/repeating-conic gradient (ticks, bars, arcs).
 * Only `transform` animates, so the cluster runs on the compositor.
 *
 * Motion: each ring gets one infinite Web Animations rotation, and a scheduler
 * keeps re-shaping their playback rates — slow drifts, quick bursts, reversals
 * that stall through zero, radar sweeps, flickers. Playback rate is used rather
 * than CSS keyframe durations because changing a rate never makes a ring jump.
 *
 * Tuning: everything is in RINGS and VARIANT_GAP below.
 */

const C = {
  blue: (a) => `rgba(47, 230, 255, ${a})`,
  blueDeep: (a) => `rgba(43, 140, 255, ${a})`,
  green: (a) => `rgba(63, 240, 180, ${a})`,
  greenDeep: (a) => `rgba(16, 200, 140, ${a})`,
  ice: (a) => `rgba(205, 252, 255, ${a})`,
};

/* Radii are percentages of the cluster radius; `spin` is seconds per rotation
 * at rate 1; `dir` is +1 clockwise / -1 counter-clockwise. */
const RINGS = [
  // outer brackets
  { id: 'brackets', kind: 'arcs', in: '93%', out: '98.5%', spin: 300, dir: 1,
    arcs: [[8, 58], [100, 62], [190, 54], [278, 66]], color: C.blue(0.5) },

  // fine graticule — light, it is texture rather than data
  { id: 'graticule', kind: 'ticks', in: '88%', out: '93%', spin: 210, dir: -1,
    period: 2.4, duty: 0.5, color: C.blue(0.3) },

  // coarse dashes over three quarters of the circle
  { id: 'dashes', kind: 'ticks', in: '82%', out: '86.5%', spin: 150, dir: 1,
    period: 12, duty: 4.5, color: C.green(0.34), win: [20, 268] },

  // mid arc band
  { id: 'band', kind: 'arcs', in: '75%', out: '80%', spin: 170, dir: -1,
    arcs: [[20, 108], [150, 66], [242, 38]], color: C.blueDeep(0.6) },

  // three bar layers at one pitch and speed, inside one angular window:
  // overlapping depths read as a single bar readout with uneven bar heights
  { id: 'barsA', kind: 'bars', in: '63%', out: '74%', spin: 115, dir: 1,
    period: 6, duty: 1.5, color: C.blue(0.42), win: [-96, 214] },
  { id: 'barsB', kind: 'bars', in: '67.5%', out: '74%', spin: 115, dir: 1,
    period: 6, duty: 0.8, from: 3, color: C.green(0.5), win: [-96, 214] },
  { id: 'barsC', kind: 'bars', in: '71%', out: '74%', spin: 115, dir: 1,
    period: 18, duty: 2.4, color: C.green(0.72), win: [-96, 214] },

  // a short counter-band of bars on the opposite side
  { id: 'barsD', kind: 'bars', in: '63%', out: '70%', spin: 115, dir: 1,
    period: 7, duty: 1.6, color: C.greenDeep(0.45), win: [130, 74] },

  // inner rings
  { id: 'innerTicks', kind: 'ticks', in: '52%', out: '58.5%', spin: 85, dir: -1,
    period: 3.2, duty: 0.8, color: C.blue(0.34) },
  { id: 'innerArcs', kind: 'arcs', in: '45%', out: '50%', spin: 60, dir: 1,
    arcs: [[0, 84], [140, 52], [230, 20]], color: C.greenDeep(0.55) },
  { id: 'innerFine', kind: 'ticks', in: '40%', out: '43.5%', spin: 44, dir: -1,
    period: 7, duty: 2.2, color: C.ice(0.22) },

  // radar sweep, mostly idle
  { id: 'sweep', kind: 'sweep', in: '24%', out: '92%', spin: 26, dir: 1 },
];

const VARIANT_GAP = [2200, 6200]; // ms between variant firings
const REDUCED = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const rand = (min, max) => min + Math.random() * (max - min);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

function arcBg(arcs, color) {
  return arcs
    .map(([from, span]) =>
      `conic-gradient(from ${from}deg at 50% 50%, ${color} 0 ${span}deg, transparent ${span}deg 360deg)`)
    .join(', ');
}

function ringEl(spec) {
  const el = document.createElement('div');
  el.className = `hud__ring hud__ring--${spec.kind}`;
  el.dataset.ring = spec.id;
  el.style.setProperty('--in', spec.in);
  el.style.setProperty('--out', spec.out);
  if (spec.color) el.style.setProperty('--c', spec.color);
  if (spec.period) el.style.setProperty('--period', `${spec.period}deg`);
  if (spec.duty) el.style.setProperty('--duty', `${spec.duty}deg`);
  if (spec.from) el.style.setProperty('--from', `${spec.from}deg`);
  if (spec.arcs) el.style.setProperty('--bg', arcBg(spec.arcs, spec.color));
  if (spec.win) {
    el.style.setProperty('--win-from', `${spec.win[0]}deg`);
    el.style.setProperty('--win-span', `${spec.win[1]}deg`);
  }
  return el;
}

/* One layer = a ring element, its rotation animation, and its current rate. */
class Layer {
  constructor(el, spec) {
    this.el = el;
    this.spec = spec;
    this.busy = false;
    this.anim = el.animate(
      [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }],
      { duration: spec.spin * 1000, iterations: Infinity, easing: 'linear' }
    );

    // Start deep inside the timeline: an infinite animation played backwards
    // finishes the moment it reaches time 0, so a ring spinning (or later
    // reversed) counter-clockwise needs room behind it. The random fraction
    // also desynchronises the rings so they never line up.
    this.anim.currentTime = spec.spin * 1000 * (1e6 + Math.random());

    this.rate = spec.dir * (REDUCED ? 0.25 : rand(0.4, 1));
    this.anim.playbackRate = this.rate;
    this.ramping = null;
  }

  /* Ease the playback rate to a new value. Rate changes preserve position, so
     this reads as the ring speeding up or slowing down, never as a jump. */
  rampTo(target, ms) {
    cancelAnimationFrame(this.ramping);
    const from = this.rate;
    const start = performance.now();

    const step = (now) => {
      const t = Math.min(1, (now - start) / ms);
      this.rate = from + (target - from) * easeInOut(t);
      this.anim.playbackRate = this.rate;
      if (t < 1) this.ramping = requestAnimationFrame(step);
    };

    this.ramping = requestAnimationFrame(step);
  }

  flicker(pulses = 3) {
    const base = Number(getComputedStyle(this.el).opacity) || 1;
    const frames = [];
    for (let i = 0; i < pulses; i += 1) frames.push({ opacity: base * 0.25 }, { opacity: base });
    this.el.animate(frames, { duration: 140 * pulses * 2, easing: 'steps(1, end)' });
  }
}

export function startHud() {
  const host = document.getElementById('hud');
  if (!host || host.dataset.ready === '1') return;
  host.dataset.ready = '1';

  const haze = document.createElement('div');
  haze.className = 'hud__haze';
  host.prepend(haze);

  const core = host.querySelector('.hud__core');
  const layers = RINGS.map((spec) => {
    const el = ringEl(spec);
    host.insertBefore(el, core);
    return new Layer(el, spec);
  });

  // The core hex and crosshair counter-rotate as two more layers.
  const coreLayers = [
    ['.hud__hex', 190, -1],
    ['.hud__cross', 120, 1],
  ].map(([sel, spin, dir]) => {
    const el = host.querySelector(sel);
    return el ? new Layer(el, { id: sel, spin, dir }) : null;
  }).filter(Boolean);

  const all = [...layers, ...coreLayers];
  const byId = (id) => layers.find((l) => l.spec.id === id);
  const spinners = all.filter((l) => l.spec.id !== 'sweep');
  const sweep = byId('sweep');

  if (sweep) sweep.rate = 0.35;
  if (sweep) sweep.anim.playbackRate = 0.35;

  if (REDUCED) return; // constant slow rotation, no variants

  /* --- variants -------------------------------------------------------- */

  const hold = (layer, ms, then) => {
    layer.busy = true;
    setTimeout(() => { layer.busy = false; then(); }, ms);
  };

  const free = () => spinners.filter((l) => !l.busy);

  const variants = [
    // slow drift to a new lazy rate
    function drift() {
      const layer = pick(free());
      if (!layer) return;
      layer.rampTo(Math.sign(layer.rate || 1) * rand(0.15, 0.7), rand(1400, 2800));
    },

    // quick burst, then settle back down
    function burst() {
      const layer = pick(free());
      if (!layer) return;
      const dir = Math.sign(layer.rate || 1);
      layer.rampTo(dir * rand(2.6, 5.5), rand(350, 700));
      hold(layer, rand(1400, 2800), () => layer.rampTo(dir * rand(0.25, 0.8), rand(900, 1800)));
    },

    // reverse through zero: the ring stalls for a beat, then unwinds
    function reverse() {
      const layer = pick(free());
      if (!layer) return;
      const target = -Math.sign(layer.rate || 1) * rand(0.3, 1.2);
      layer.rampTo(target, rand(1500, 2400));
      hold(layer, 2600, () => {});
    },

    // the three bar layers snap into a fast synchronised spin
    function barSync() {
      const bars = ['barsA', 'barsB', 'barsC', 'barsD'].map(byId).filter((l) => l && !l.busy);
      if (bars.length < 2) return;
      const rate = rand(1.8, 3.4);
      bars.forEach((layer) => {
        layer.rampTo(rate, 600);
        hold(layer, rand(2000, 3600), () => layer.rampTo(rand(0.3, 0.7), 1400));
      });
      pick(bars).flicker(2);
    },

    // radar sweep takes a fast lap and brightens
    function scan() {
      if (!sweep || sweep.busy) return;
      sweep.rampTo(rand(5, 9), 500);
      sweep.el.animate(
        [{ opacity: 0.22 }, { opacity: 0.55 }, { opacity: 0.22 }],
        { duration: 2600, easing: 'ease-in-out' }
      );
      hold(sweep, 2600, () => sweep.rampTo(rand(0.3, 0.6), 1200));
    },

    // readout blink on a bar or tick ring
    function blink() {
      const layer = pick(free().filter((l) => l.spec.kind === 'bars' || l.spec.kind === 'ticks'));
      if (layer) layer.flicker(Math.round(rand(2, 4)));
    },

    // outer shell and inner core swing opposite ways at once
    function counterSwing() {
      const outer = byId('graticule');
      const inner = byId('innerTicks');
      if (!outer || !inner || outer.busy || inner.busy) return;
      const rate = rand(1.6, 3);
      outer.rampTo(rate, 900);
      inner.rampTo(-rate, 900);
      [outer, inner].forEach((layer) =>
        hold(layer, rand(2400, 4200), () => layer.rampTo(Math.sign(layer.rate) * rand(0.2, 0.6), 1600)));
    },
  ];

  let timer = null;

  const schedule = () => {
    timer = setTimeout(() => {
      pick(variants)();
      schedule();
    }, rand(...VARIANT_GAP));
  };

  // A TV tab that gets hidden shouldn't burn frames.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clearTimeout(timer);
      timer = null;
      all.forEach((l) => l.anim.pause());
    } else {
      all.forEach((l) => l.anim.play());
      if (!timer) schedule();
    }
  });

  schedule();
}
