/* Sales YTD drill-down — the job list behind a closer's number.
 *
 * Henry sees "21" on the wall and says "only 21?". This is the answer: one
 * click on his name and there is every job, which month it was signed, and for
 * how much, with the total at the bottom that has to match the card.
 *
 * Deliberately a <dialog> with showModal(). Esc, the focus trap, returning
 * focus to the name that was clicked, and inert-ing the board behind it are all
 * native, and a hand-rolled overlay gets at least one of those wrong. The only
 * things left to write are backdrop-click and the anchoring.
 *
 * Jacob's Oct 5 lock: no rotate, no flip, no 3D, nothing tumbles. A fade under
 * 200ms and the list is there.
 */

import { CONFIG } from './config.js';
import { detailFor } from './sheet.js';
import { EMPTY, fmtByUnit } from './format.js';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/* "2026-10" -> "October". Split rather than parsed: Date would read it as UTC
   midnight and name the previous month west of Greenwich.

   The year is left off, because the panel's own title already states it -
   repeating it on every header is eight copies of something nobody is in doubt
   about. It comes back only when a list genuinely spans more than one year,
   where "October" alone would be ambiguous. */
export function monthLabel(key, withYear = false) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(key || ''));
  if (!m) return 'Month not recorded';
  const name = MONTHS[Number(m[2]) - 1];
  if (!name) return 'Month not recorded';
  return withYear ? `${name} ${m[1]}` : name;
}

/* True only when the months on show cross a year, which is the one case where
   a bare month name could mean two different things. */
export function spansYears(months) {
  const years = new Set(
    (months || []).map((m) => String(m.monthKey || '').slice(0, 4)).filter(Boolean),
  );
  return years.size > 1;
}

/* "2026-10-02" -> "Oct 2". Same reasoning: never through Date. */
export function dayLabel(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  if (!m) return '';
  const name = MONTHS[Number(m[2]) - 1];
  return name ? `${name.slice(0, 3)} ${Number(m[3])}` : '';
}

const usd = (v) => (v === null || v === undefined ? EMPTY : fmtByUnit(v, 'usd'));

export function createDrilldown() {
  const dialog = document.getElementById('drill');
  if (!dialog) return { open() {}, close() {} };

  const title = document.getElementById('drill-title');
  const body = document.getElementById('drill-body');
  const foot = document.getElementById('drill-foot');

  /* Clicking the backdrop closes. A <dialog> reports backdrop clicks as clicks
     on the dialog itself, so anything inside the panel has to be ruled out -
     and a click that began inside and ended on the backdrop (a drag off the end
     of a selection) must not count either. */
  let openCloser = null;
  let openPeriod = null;
  let downInside = false;
  dialog.addEventListener('pointerdown', (e) => { downInside = e.target !== dialog; });
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog && !downInside) dialog.close();
    downInside = false;
  });
  dialog.querySelector('.drill__x').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { openCloser = null; openPeriod = null; });

  function render(view, label) {
    /* Title carries the period; there is no subtitle. The basis paragraph that
       used to sit here was a formula dump nobody reads on a wall. */
    title.textContent = `${view.closer} · ${label}`;
    body.textContent = '';
    foot.textContent = '';

    if (!view.present) {
      body.append(note('Detail tab not ready',
        'Talon has not shipped the Sales YTD Detail tab yet. The card total above is from the summary tab.'));
      return;
    }

    if (!view.months.length) {
      body.append(note(`No jobs in ${label}`,
        `The detail tab has no rows for ${view.closer} in this period.`));
      /* Zero, not an em dash. We hold the whole job list and none of it falls
         in this window, so the total is KNOWN to be nothing - and the Sheet's
         own column agrees, writing a literal 0. An em dash would say we could
         not tell. */
      foot.append(footLine(usd(0), 0));
      return;
    }

    const withYear = spansYears(view.months);

    for (const month of view.months) {
      const section = document.createElement('section');
      section.className = 'drill__month';

      const head = document.createElement('div');
      head.className = 'drill__month-head';
      const name = document.createElement('h3');
      name.className = 'drill__month-name';
      name.textContent = monthLabel(month.monthKey, withYear);
      const sum = document.createElement('span');
      sum.className = 'drill__month-sum';
      sum.textContent = `${usd(month.subtotal)} · ${month.count} ${month.count === 1 ? 'job' : 'jobs'}`;
      head.append(name, sum);

      const list = document.createElement('ul');
      list.className = 'drill__jobs';
      for (const job of month.jobs) {
        const li = document.createElement('li');
        li.className = 'drill__job';

        const who = document.createElement('span');
        who.className = 'drill__customer';
        who.textContent = job.customer || EMPTY;
        /* A long name ellipsizes in a fixed column, so the full one goes on the
           title where it can be recovered - along with the project number,
           which is for settling an argument rather than reading across a
           room. */
        who.title = [job.customer, job.projectNumber && `Project ${job.projectNumber}`]
          .filter(Boolean).join(' · ');

        /* The panel is wide now, so the eye needs help getting from a name on
           the left to a figure on the right. Dotted leader, the way a contents
           page does it. */
        const leader = document.createElement('span');
        leader.className = 'drill__leader';
        leader.setAttribute('aria-hidden', 'true');

        const when = document.createElement('span');
        when.className = 'drill__when';
        when.textContent = dayLabel(job.wonDate) || monthLabel(job.monthKey, withYear);

        const amount = document.createElement('span');
        amount.className = 'drill__amount';
        amount.textContent = usd(job.dollars);

        li.append(who, leader, when, amount);
        list.append(li);
      }

      section.append(head, list);
      body.append(section);
    }

    foot.append(footLine(usd(view.total), view.count));

    /* The footer is what the detail rows actually add up to. When the summary
       tab disagrees, both numbers are shown and the difference is named - no
       row is invented or dropped to make them match. */
    if (view.agrees === false) {
      const warn = document.createElement('p');
      warn.className = 'drill__warn';
      warn.textContent = `Sheet summary ≠ detail — card says ${usd(view.summaryDollars)}`
        + `${view.summaryCount === null ? '' : ` · ${view.summaryCount} jobs`}`;
      foot.append(warn);
    }
  }

  function footLine(amount, count) {
    const line = document.createElement('p');
    line.className = 'drill__total';
    const money = document.createElement('span');
    money.className = 'drill__total-amount';
    money.textContent = amount;
    const jobs = document.createElement('span');
    jobs.className = 'drill__total-jobs';
    jobs.textContent = `${count} ${count === 1 ? 'job' : 'jobs'}`;
    line.append(money, jobs);
    return line;
  }

  function note(heading, detail) {
    const wrap = document.createElement('div');
    wrap.className = 'drill__note';
    const h = document.createElement('p');
    h.className = 'drill__note-head';
    h.textContent = heading;
    const p = document.createElement('p');
    p.className = 'drill__note-body';
    p.textContent = detail;
    const dash = document.createElement('p');
    dash.className = 'drill__note-dash';
    dash.textContent = EMPTY;
    wrap.append(h, dash, p);
    return wrap;
  }

  return {
    /* One panel, reused. Opening a second closer replaces the list rather than
       stacking another dialog on top. */
    open(model, closer, period = CONFIG.salesDefaultView) {
      const view = detailFor(model, closer, period);
      const spec = CONFIG.salesPeriods.find((p) => p.key === period)
        || CONFIG.salesPeriods.find((p) => p.key === CONFIG.salesDefaultView);
      const label = period === 'ytd'
        ? (model.salesYtd?.label || spec.label)
        : spec.label;

      /* A repaint from a background refresh keeps the reader's scroll position;
         a fresh open, or a change of period, starts at the top. */
      const reopening = openCloser !== closer || openPeriod !== period || !dialog.open;
      const scroll = body.scrollTop;

      render(view, label);
      openCloser = closer;
      openPeriod = period;
      if (!dialog.open) dialog.showModal();
      body.scrollTop = reopening ? 0 : scroll;
      return view;
    },
    close() { if (dialog.open) dialog.close(); },
    get isOpen() { return dialog.open; },
    get openCloser() { return openCloser; },
  };
}
