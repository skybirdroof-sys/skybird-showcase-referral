/* Compact weekly trend line, as inline SVG.
 *
 * Deliberately not Chart.js from a CDN: this page hangs on an office wall and a
 * remote script is a failure mode the board doesn't need. Hand-rolling also
 * makes the gap rule structural rather than a flag — a run of missing weeks
 * ends one polyline and starts another, so nothing can bridge a gap even if
 * someone later changes the styling.
 *
 * One series per chart, so no legend: the card title names the measurable
 * (per the visualization guidance — a legend for a single series is noise).
 * Colours are the data cyan plus an amber dashed goal reference; the grid and
 * axes stay recessive ink. Green never appears here — it lives only in the
 * text-labelled Hit pill, because cyan and green sit too close together to
 * carry meaning side by side.
 */

const NS = 'http://www.w3.org/2000/svg';

/* Inside a small chart the goal only needs its magnitude, so money loses the
   cents here. The card front keeps full precision, because that is the number
   being typed into Ninety. */
function compact(value, format) {
  const full = format(value);
  return full.startsWith('$') ? full.replace(/\.\d{2}$/, '') : full;
}

const el = (name, attrs = {}) => {
  const node = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== null && value !== undefined) node.setAttribute(key, String(value));
  }
  return node;
};

/* Consecutive runs of real numbers. A null ends the run: that is the gap.
   Exported so the no-bridging rule has a unit test and not only a browser one. */
export function segments(points) {
  const runs = [];
  let run = [];
  points.forEach((point, index) => {
    if (point.value === null || point.value === undefined) {
      if (run.length) runs.push(run);
      run = [];
      return;
    }
    run.push({ ...point, index });
  });
  if (run.length) runs.push(run);
  return runs;
}

/**
 * @param {object} opts
 * @param {{label: string, value: number|null}[]} opts.points chronological
 * @param {number|null} opts.goal        reference line, or null
 * @param {string} opts.goalOp           ">=", "<", "<=" …
 * @param {(n: number) => string} opts.format value formatter
 * @param {string} opts.title            accessible name for the figure
 */
export function trendChart({ points, goal = null, goalOp = '', format = String, title = 'Weekly trend' }) {
  /* The viewBox is close to the shape of the box it lands in. It is scaled with
     "meet", so a wider-than-the-card aspect would letterbox and leave a band of
     dead space above and below the plot inside a tall card. */
  const W = 420;
  const H = 250;
  const PAD = { top: 22, right: 10, bottom: 30, left: 8 };

  const svg = el('svg', {
    viewBox: `0 0 ${W} ${H}`,
    class: 'trend',
    role: 'img',
    'aria-label': title,
    preserveAspectRatio: 'xMidYMid meet',
  });

  const real = points.filter((p) => p.value !== null && p.value !== undefined).map((p) => p.value);

  if (!real.length) {
    // Honest empty state; the goal line still gives the reader a scale.
    const note = el('text', { x: W / 2, y: H / 2, class: 'trend__empty', 'text-anchor': 'middle' });
    note.textContent = 'No weekly history yet';
    svg.append(note);
    return svg;
  }

  const candidates = goal === null ? real : [...real, goal];
  let min = Math.min(...candidates);
  let max = Math.max(...candidates);
  if (min === max) { min -= 1; max += 1; }          // a flat series still needs a band
  const pad = (max - min) * 0.12;
  min -= pad;
  max += pad;

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (i) => PAD.left + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = (v) => PAD.top + plotH - ((v - min) / (max - min)) * plotH;

  // Recessive grid: three lines, no axis box.
  for (const t of [0, 0.5, 1]) {
    svg.append(el('line', {
      x1: PAD.left, x2: PAD.left + plotW,
      y1: PAD.top + plotH * t, y2: PAD.top + plotH * t,
      class: 'trend__grid',
    }));
  }

  if (goal !== null) {
    svg.append(el('line', {
      x1: PAD.left, x2: PAD.left + plotW,
      y1: y(goal), y2: y(goal),
      class: 'trend__goal',
    }));
    /* Labelled above its own line at the left edge rather than out in the right
       margin, where a long money value used to be clipped. Flips below the line
       when the goal sits near the top of the plot. */
    const high = y(goal) < PAD.top + 16;
    const label = el('text', {
      x: PAD.left + 2,
      y: high ? y(goal) + 14 : y(goal) - 6,
      class: 'trend__goal-label',
      'text-anchor': 'start',
    });
    label.textContent = `goal ${goalOp || ''} ${compact(goal, format)}`.replace(/\s+/g, ' ').trim();
    svg.append(label);
  }

  // One polyline per unbroken run — gaps cannot be bridged by construction.
  for (const run of segments(points)) {
    if (run.length === 1) {
      svg.append(el('circle', { cx: x(run[0].index), cy: y(run[0].value), r: 3.5, class: 'trend__lone' }));
      continue;
    }
    svg.append(el('polyline', {
      points: run.map((p) => `${x(p.index)},${y(p.value)}`).join(' '),
      class: 'trend__line',
    }));
  }

  // Markers, 8px across so they are real hover targets. Native title elements
  // give every point a tooltip; the table beside the chart is the non-hover
  // route to the same numbers.
  const lastReal = [...points].reverse().find((p) => p.value !== null && p.value !== undefined);
  points.forEach((point, index) => {
    if (point.value === null || point.value === undefined) return;
    const isLatest = point === lastReal;
    const dot = el('circle', {
      cx: x(index), cy: y(point.value), r: isLatest ? 5 : 4,
      class: isLatest ? 'trend__dot trend__dot--latest' : 'trend__dot',
    });
    const tip = el('title');
    tip.textContent = `${point.label}: ${format(point.value)}`;
    dot.append(tip);
    svg.append(dot);
  });

  // Direct-label the latest point only — never a number on every point.
  if (lastReal) {
    const index = points.indexOf(lastReal);
    const above = y(lastReal.value) > PAD.top + 26;
    const label = el('text', {
      x: Math.min(x(index), PAD.left + plotW - 4),
      y: above ? y(lastReal.value) - 10 : y(lastReal.value) + 18,
      class: 'trend__latest-label',
      'text-anchor': index === points.length - 1 ? 'end' : 'middle',
    });
    label.textContent = format(lastReal.value);
    svg.append(label);
  }

  // Reduced tick density: first, middle, last. Full labels live in the table.
  const ticks = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])];
  for (const index of ticks) {
    const point = points[index];
    if (!point) continue;
    const tick = el('text', {
      x: x(index), y: H - 8,
      class: 'trend__tick',
      'text-anchor': index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle',
    });
    tick.textContent = point.label;
    svg.append(tick);
  }

  return svg;
}

/* The non-hover route to the values, and the screen-reader view. */
export function trendTable(points, format) {
  const table = el2('table', 'trend__table');
  const caption = document.createElement('caption');
  caption.textContent = 'Weekly values';
  const head = document.createElement('thead');
  head.innerHTML = '<tr><th scope="col">Week</th><th scope="col">Value</th></tr>';
  const body = document.createElement('tbody');

  for (const point of points) {
    const row = document.createElement('tr');
    const week = document.createElement('th');
    week.setAttribute('scope', 'row');
    week.textContent = point.label;
    const value = document.createElement('td');
    value.textContent = point.value === null || point.value === undefined ? 'no data' : format(point.value);
    row.append(week, value);
    body.append(row);
  }

  table.append(caption, head, body);
  return table;
}

function el2(name, className) {
  const node = document.createElement(name);
  node.className = className;
  return node;
}

/* Metric, latest value, goal, and how many of the weeks actually have data —
   so the figure is never only obtainable by hovering. */
export function trendSummary({ measurable, points, goal, goalOp, format }) {
  const real = points.filter((p) => p.value !== null && p.value !== undefined);
  const latest = real[real.length - 1];
  const parts = [];
  parts.push(latest ? `latest ${latest.label} ${format(latest.value)}` : 'no values recorded');
  if (goal !== null && goal !== undefined) parts.push(`goal ${goalOp || ''} ${format(goal)}`.trim());
  parts.push(`${real.length} of ${points.length} weeks have data`);
  return `${measurable}: ${parts.join(' · ')}`;
}

/* --- tile sparkline ---------------------------------------------------- */

/* A sparkline is not a small chart, it is a shape. No axes, no grid, no goal
 * line, no numbers: the tile already shows the current figure in 54px type, so
 * all this has to add is the direction it came from. Anything more competes
 * with the number for attention across a room.
 *
 * It reuses segments(), so the no-bridging rule holds here too - a week with no
 * data breaks the line rather than drawing a slope nobody measured.
 */
export function sparkline({ points, format = String, label = 'Trend' }) {
  const W = 120;
  const H = 34;
  const PAD = 3;

  const svg = el('svg', {
    viewBox: `0 0 ${W} ${H}`,
    class: 'spark',
    role: 'img',
    preserveAspectRatio: 'none',
    'aria-label': sparkSummary({ points, format, label }),
  });

  const real = points.filter((p) => p.value !== null && p.value !== undefined);
  if (real.length < 2) return svg;   // one point is not a trend; draw nothing

  const values = real.map((p) => p.value);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) { min -= 1; max += 1; }

  const x = (i) => PAD + (i / (points.length - 1)) * (W - PAD * 2);
  const y = (v) => PAD + (H - PAD * 2) - ((v - min) / (max - min)) * (H - PAD * 2);

  for (const run of segments(points)) {
    if (run.length === 1) {
      svg.append(el('circle', { cx: x(run[0].index), cy: y(run[0].value), r: 1.6, class: 'spark__lone' }));
      continue;
    }
    svg.append(el('polyline', {
      points: run.map((p) => `${x(p.index)},${y(p.value)}`).join(' '),
      class: 'spark__line',
    }));
  }

  /* The latest week gets a dot, so the eye knows which end is now. */
  const lastIndex = points.reduce((acc, p, i) => (
    p.value === null || p.value === undefined ? acc : i
  ), -1);
  if (lastIndex >= 0) {
    svg.append(el('circle', {
      cx: x(lastIndex), cy: y(points[lastIndex].value), r: 2.2, class: 'spark__now',
    }));
  }

  return svg;
}

/* The sparkline's whole meaning in words, for the accessible name: a wall
   display has no hover, so the shape must also be readable as a sentence. */
export function sparkSummary({ points, format = String, label = 'Trend' }) {
  const real = points.filter((p) => p.value !== null && p.value !== undefined);
  if (!real.length) return `${label}: no weekly history`;
  if (real.length === 1) return `${label}: one week only, ${format(real[0].value)}`;
  const first = real[0];
  const last = real[real.length - 1];
  const direction = last.value > first.value ? 'up from' : last.value < first.value ? 'down from' : 'level with';
  return `${label}: ${real.length} of ${points.length} weeks, ` +
    `${direction} ${format(first.value)} (${first.label}) to ${format(last.value)} (${last.label})`;
}
