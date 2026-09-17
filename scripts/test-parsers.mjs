/* Smoke tests for the Sheet -> model pipeline. No network, no browser.
   Run: npm test */

import assert from 'node:assert/strict';
import { buildModelFromCsv, kpiFor, loadLive, NoSourceError } from '../assets/js/sheet.js';
import { CONFIG } from '../assets/js/config.js';
import { parseCsv } from '../assets/js/csv.js';
import { fmtUsd, fmtPct, fmtCount, fmtRest, EMPTY } from '../assets/js/format.js';

let passed = 0;
const test = (name, fn) => {
  try {
    fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FAIL  ${name}\n      ${err.message}`);
    process.exitCode = 1;
  }
};

/* --- csv --------------------------------------------------------------- */

test('csv handles quoted commas and escaped quotes', () => {
  const rows = parseCsv('a,b\n"1,200","say ""hi"""\n');
  assert.deepEqual(rows, [['a', 'b'], ['1,200', 'say "hi"']]);
});

test('csv drops fully blank rows', () => {
  assert.equal(parseCsv('a,b\n,\n1,2\n').length, 2);
});

/* --- formatting -------------------------------------------------------- */

test('formatters render em dash for null, never a fake zero', () => {
  assert.equal(fmtUsd(null), EMPTY);
  assert.equal(fmtPct(null), EMPTY);
  assert.equal(fmtCount(null), EMPTY);
  assert.equal(fmtRest(null), EMPTY);
});

test('literal zero renders as zero', () => {
  assert.equal(fmtUsd(0), '$0');
  assert.equal(fmtPct(0), '0%');
  assert.equal(fmtCount(0), '0');
  assert.equal(fmtRest(0), '0.0');
});

test('number formats match the TV spec', () => {
  assert.equal(fmtUsd(186400), '$186,400');
  assert.equal(fmtPct(38.46), '38.5%');
  assert.equal(fmtPct(42), '42%');
  assert.equal(fmtCount(1234), '1,234');
  assert.equal(fmtRest(2.44), '2.4');
});

/* --- model ------------------------------------------------------------- */

const KPI_CSV = [
  'Metric,Value,Target,Unit,Source,Owner,Notes,Updated',
  'Appointments Set,41,50,count,GHL,Jacob,,2026-09-17T16:05:00-04:00',
  'Cost per Appt,"$212",,USD,GHL,Jacob,,',
  'Contracts Signed $$,"$186,400",,USD,ProLine,John,,',
  'Close Rates,38.5%,45%,pct,ProLine,Anas,combined,',
  'Jobs Completed,0,,count,ProLine,Henry,,',
  'Sent CoC cash sitting,,,USD,ProLine,John,,',
  'Total AR Over 60 Days,"$28,150",,USD,ProLine,Margaret,,',
  'Cash Collected,"$142,900",,USD,ProLine,Margaret,,',
].join('\n');

const TOP5_CSV = [
  'Person,Today %,~5-day avg,Updated ET',
  'Margaret,80%,76%,Wed Sep 17 4:00 PM',
  'Travis,60,68,Wed Sep 17 4:00 PM',
  'John,100%,88%,Wed Sep 17 4:00 PM',
  'Henry,,,',
  'Anas,0.8,0.84,Wed Sep 17 4:00 PM',
  'Jacob,60%,72%,Wed Sep 17 4:00 PM',
  'Notes: count-based scoring,,,',
].join('\n');

const REST_CSV = [
  'Person,Days at rest avg,Project count,Updated ET',
  'Jacob,1.8,9,Wed Sep 17 7:10 AM',
  'John,3.1,14,Wed Sep 17 7:10 AM',
  'Henry,2.2,11,Wed Sep 17 7:10 AM',
  'Anas,2.5,13,Wed Sep 17 7:10 AM',
  'Rest Index,2.4,,Wed Sep 17 7:10 AM',
].join('\n');

const META_CSV = [
  'Key,Value',
  'last_updated_et,2026-09-17T16:05:00-04:00',
  'period_label,Week of Sep 7–13',
  'site_title,Talon',
  'refresh_seconds,180',
].join('\n');

const model = buildModelFromCsv({ kpi: KPI_CSV, top5: TOP5_CSV, rest: REST_CSV, meta: META_CSV });

test('kpi rows parse with currency and percent cleanup', () => {
  assert.equal(kpiFor(model, 'Appointments Set').number, 41);
  assert.equal(kpiFor(model, 'Cost per Appt').number, 212);
  assert.equal(kpiFor(model, 'Contracts Signed $$').number, 186400);
  assert.equal(kpiFor(model, 'Close Rates').percent, 38.5);
});

test('blank kpi value stays null; literal 0 stays 0', () => {
  assert.equal(kpiFor(model, 'Sent CoC cash sitting').number, null);
  assert.equal(kpiFor(model, 'Jobs Completed').number, 0);
});

test('targets parse when present and stay null when blank', () => {
  assert.equal(kpiFor(model, 'Appointments Set').targetNumber, 50);
  assert.equal(kpiFor(model, 'Cash Collected').targetNumber, null);
});

test('top 5 reads percents, fractions and blanks; notes row ignored', () => {
  const by = (name) => model.top5.find((p) => p.person === name);
  assert.equal(by('Margaret').today, 80);
  assert.equal(by('Travis').today, 60);
  assert.equal(by('Anas').today, 80);        // 0.8 read as a fraction
  assert.equal(by('Anas').week, 84);
  assert.equal(by('Henry').today, null);
  assert.equal(model.top5.length, 6);        // "Notes:" row dropped
});

test('rest index comes from the Sheet summary row', () => {
  assert.equal(model.rest.index, 2.4);
  assert.equal(model.rest.computed, false);
  assert.equal(model.rest.people.length, 4);
});

test('rest index falls back to the mean of the four owners', () => {
  const withoutSummary = buildModelFromCsv({
    kpi: KPI_CSV,
    top5: TOP5_CSV,
    rest: REST_CSV.split('\n').filter((line) => !line.startsWith('Rest Index')).join('\n'),
  });
  assert.equal(withoutSummary.rest.computed, true);
  assert.equal(fmtRest(withoutSummary.rest.index), '2.4'); // (1.8+3.1+2.2+2.5)/4 = 2.4
});

test('meta tab drives period label and refresh seconds', () => {
  assert.equal(model.meta.periodLabel, 'Week of Sep 7–13');
  assert.equal(model.meta.refreshSeconds, 180);
  assert.equal(model.meta.lastUpdatedEt, '2026-09-17T16:05:00-04:00');
});

test('an empty sheet yields a model of nulls, not zeros', () => {
  const blank = buildModelFromCsv({ kpi: '', top5: '', rest: '', meta: '' });
  assert.equal(blank.rest.index, null);
  assert.equal(blank.top5.length, 0);
  assert.equal(kpiFor(blank, 'Cash Collected'), null);
});

/* --- Talon's live tab quirks -------------------------------------------- */

test('Today % outside the count-based set is treated as missing', () => {
  // A cell corrupted into a timestamp, and a value no count-based score produces.
  const csv = [
    'Person,Today %,~5-day avg,Updated ET',
    'Margaret,9/17/2026 16:00:00,92%,Wed Sep 17 4:00 PM',
    'Travis,20,56%,Wed Sep 17 4:00 PM',
    'John,45,84%,Wed Sep 17 4:00 PM',
    'Henry,100,88%,Wed Sep 17 4:00 PM',
  ].join('\n');
  const model = buildModelFromCsv({ top5: csv });
  const by = (name) => model.top5.find((p) => p.person === name);
  assert.equal(by('Margaret').today, null); // timestamp string
  assert.equal(by('Margaret').week, 92);    // its average is still good
  assert.equal(by('Travis').today, 20);
  assert.equal(by('John').today, null);     // 45 is not a count-based score
  assert.equal(by('Henry').today, 100);
});

test('out-of-range weekly average is dropped, not clamped', () => {
  const csv = ['Person,Today %,~5-day avg', 'John,20,140'].join('\n');
  assert.equal(buildModelFromCsv({ top5: csv }).top5[0].week, null);
});

test('Rest Index tab with a Key/Value summary block parses cleanly', () => {
  // Talon's proposed layout: person rows, then a second block lower down.
  const csv = [
    'Person,Days at rest avg,Project count,Updated ET',
    'Jacob,2.6,10,Wed Sep 17 7:10 AM',
    'John,4.4,16,Wed Sep 17 7:10 AM',
    'Henry,1.9,12,Wed Sep 17 7:10 AM',
    'Anas,3.2,15,Wed Sep 17 7:10 AM',
    ',,,',
    'Key,Value,Updated ET,',
    'Rest Index,3.0,,Wed Sep 17 7:10 AM',
    'period_label,as-of Morning Runway rebuild,,Wed Sep 17 7:10 AM',
  ].join('\n');
  const model = buildModelFromCsv({ rest: csv });
  assert.equal(model.rest.index, 3);
  assert.equal(model.rest.computed, false);
  assert.equal(model.rest.people.length, 4, 'the Key header and meta keys must not become people');
  assert.deepEqual(model.rest.people.map((p) => p.person), ['Jacob', 'John', 'Henry', 'Anas']);
  assert.equal(model.meta.periodLabel, 'as-of Morning Runway rebuild');
});

test('annotation rows on the Rest Index tab never become person chips', () => {
  // Talon will state the blank-clock rule on this tab; free text must not render.
  const csv = [
    'Person,Days at rest avg,Project count,Updated ET',
    'Jacob,2.6,10,2026-09-17T07:10:00-04:00',
    'John,,,2026-09-17T07:10:00-04:00',
    'Henry,1.9,12,2026-09-17T07:10:00-04:00',
    'Anas,3.2,15,2026-09-17T07:10:00-04:00',
    'Travis,1.2,4,2026-09-17T07:10:00-04:00',
    'Rule,blank clocks excluded from the average,,',
    'Notes: sorted longest days-in-stage first,,,',
    'Rest Index,2.6,,2026-09-17T07:10:00-04:00',
  ].join('\n');
  const model = buildModelFromCsv({ rest: csv });
  assert.equal(model.rest.index, 2.6);
  assert.deepEqual(
    model.rest.people.map((p) => p.person),
    ['Jacob', 'John', 'Henry', 'Anas', 'Travis'],
    'owners stay (blank or not), an extra person with a number stays, prose is dropped'
  );
  assert.equal(model.rest.people.find((p) => p.person === 'John').days, null);
});

test('Meta tab wins over the Rest Index summary block', () => {
  const rest = ['Person,Days at rest avg', 'period_label,from summary block'].join('\n');
  const meta = ['Key,Value', 'period_label,from Meta tab'].join('\n');
  assert.equal(buildModelFromCsv({ rest, meta }).meta.periodLabel, 'from Meta tab');
});

test('Last updated takes the newest parseable stamp across tabs', () => {
  const kpi = [
    'Metric,Value,Target,Unit,Source,Owner,Notes,Updated',
    'Cash Collected,100,,USD,ProLine,,,2026-09-17T09:00:00-04:00',
  ].join('\n');
  const top5 = [
    'Person,Today %,~5-day avg,Updated ET',
    'John,20,40,2026-09-17T16:00:00-04:00',
  ].join('\n');
  const model = buildModelFromCsv({ kpi, top5 });
  assert.equal(model.updated.date.toISOString(), new Date('2026-09-17T16:00:00-04:00').toISOString());
});

test('a human stamp with no zone is kept verbatim rather than guessed at', () => {
  const meta = ['Key,Value', 'last_updated_et,Wed Sep 17 4:05 PM'].join('\n');
  const model = buildModelFromCsv({ meta });
  assert.equal(model.updated.date, null);
  assert.equal(model.updated.raw, 'Wed Sep 17 4:05 PM');
});

/* --- one missing tab must not take the board down ---------------------- */

const okCsv = {
  KPI: ['Metric,Value,Target,Unit', 'Cash Collected,"$88,240",,USD'].join('\n'),
  'Daily Top-Five Progress': ['Person,Today %,~5-day avg', 'Margaret,100,92', 'Travis,40,56'].join('\n'),
};

function stubFetch(handler) {
  globalThis.fetch = async (url) => {
    const tab = decodeURIComponent(new URL(url, 'http://board.test').searchParams.get('tab'));
    return handler(tab);
  };
}

await (async function missingRestTabStillRenders() {
  // The live sheet today: KPI and Top Five exist, `Rest Index` does not.
  stubFetch(async (tab) => (okCsv[tab]
    ? { ok: true, status: 200, text: async () => okCsv[tab] }
    : { ok: false, status: 502, text: async () => 'Google returned 400' }));

  const model = await loadLive();
  test('a missing Rest Index tab leaves the rest of the board live', () => {
    assert.equal(model.top5.length, 2);
    assert.equal(kpiFor(model, 'Cash Collected').number, 88240);
    assert.equal(model.rest.index, null);
    assert.equal(model.sources.top5, 'ok');
    assert.equal(model.sources.rest, 'unavailable');
    assert.equal(model.sourceErrors.length, 2); // Rest Index + Meta
  });
})();

await (async function proxyStaysAliveAcrossRefreshes() {
  // A tab-level 502 must not convince the client the Function is gone: the very
  // next refresh has to keep reading the tabs that do work.
  stubFetch(async (tab) => (okCsv[tab]
    ? { ok: true, status: 200, text: async () => okCsv[tab] }
    : { ok: false, status: 502, text: async () => 'Google returned 400' }));

  await loadLive();
  const second = await loadLive();
  test('a missing tab does not disable the proxy for later refreshes', () => {
    assert.equal(second.sources.kpi, 'ok');
    assert.equal(second.sources.top5, 'ok');
    assert.equal(second.sources.rest, 'unavailable');
    assert.match(second.sourceErrors.join(' '), /Proxy error 502/);
    assert.equal(second.top5.length, 2);
  });
})();

await (async function everyTabDown() {
  stubFetch(async () => ({ ok: false, status: 502, text: async () => 'boom' }));
  let thrown = null;
  try { await loadLive(); } catch (err) { thrown = err; }
  test('losing every data tab is a real failure', () => {
    assert.ok(thrown, 'loadLive should reject when no data tab can be read');
    assert.match(thrown.message, /Rest Index|KPI|Daily Top-Five/);
  });
})();

test('config keeps Talon\'s locked scoring set', () => {
  assert.deepEqual(CONFIG.top5ValidToday, [0, 20, 40, 60, 80, 100]);
});

console.log(`\n${passed} passing`);
