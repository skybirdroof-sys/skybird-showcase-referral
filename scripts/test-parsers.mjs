/* Smoke tests for the Sheet -> model pipeline. No network, no browser.
   Run: npm test */

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { buildL10FromCsv, buildModelFromCsv, buildSalesYtd, detailFor, monthKeyOf, periodRange, hitStatus, historyFor, normalizeL10View, kpiFor, loadLive, NoSourceError, normalizePeriod, periodLabel } from '../assets/js/sheet.js';
import { segments } from '../assets/js/chart.js';
import { createCelebrations } from '../assets/js/celebrate.js';
import { monthLabel, dayLabel } from '../assets/js/drilldown.js';
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

test('cash never shows cents on the TV', () => {
  // A wall display rounds to the dollar; the cents stay in the Sheet. Values
  // here are the live ones from 2026-09-18.
  assert.equal(fmtUsd(320.26), '$320');
  assert.equal(fmtUsd(46750.07), '$46,750');
  assert.equal(fmtUsd(26624.53), '$26,625'); // rounds, not truncates
  assert.equal(fmtUsd(108367.14), '$108,367');
  assert.equal(fmtUsd(51915.73), '$51,916');
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

/* --- monthly / weekly periods ------------------------------------------ */

test('a KPI tab with no Period column still reads as monthly', () => {
  // The live Sheet today. This must not change behaviour.
  const model = buildModelFromCsv({ kpi: KPI_CSV });
  assert.equal(kpiFor(model, 'Appointments Set', 'monthly').number, 41);
  assert.equal(kpiFor(model, 'Appointments Set').number, 41, 'default period is monthly');
  assert.equal(kpiFor(model, 'Appointments Set', 'weekly'), null, 'no weekly rows yet');
});

test('the same metric can appear once per period without colliding', () => {
  const csv = [
    'Metric,Period,Value,Target,Unit',
    'Cash Collected,monthly,"$142,900",,USD',
    'Cash Collected,weekly,"$31,450",,USD',
    'Close Rates,Monthly,38.5%,45%,pct',
    'Close Rates,WEEKLY,35%,45%,pct',
  ].join('\n');
  const model = buildModelFromCsv({ kpi: csv });
  assert.equal(kpiFor(model, 'Cash Collected', 'monthly').number, 142900);
  assert.equal(kpiFor(model, 'Cash Collected', 'weekly').number, 31450);
  assert.equal(kpiFor(model, 'Close Rates', 'monthly').percent, 38.5);
  assert.equal(kpiFor(model, 'Close Rates', 'weekly').percent, 35);
});

test('period spellings normalise, and unknown ones are dropped', () => {
  assert.equal(normalizePeriod(''), 'monthly');
  assert.equal(normalizePeriod('MTD'), 'monthly');
  assert.equal(normalizePeriod(' Weekly '), 'weekly');
  assert.equal(normalizePeriod('L10'), 'weekly');
  assert.equal(normalizePeriod('quarterly'), null);

  const csv = [
    'Metric,Period,Value,Unit',
    'Cash Collected,quarterly,"$999,999",USD',
  ].join('\n');
  const model = buildModelFromCsv({ kpi: csv });
  assert.equal(kpiFor(model, 'Cash Collected', 'monthly'), null, 'a quarter must not show as the month');
  assert.equal(kpiFor(model, 'Cash Collected', 'weekly'), null);
});

test('the label always describes the view on screen', () => {
  const meta = [
    'Key,Value',
    'period_label_monthly,September MTD',
    'period_label_weekly,Week of Sep 14-20',
    'default_period,monthly',
  ].join('\n');
  const model = buildModelFromCsv({ meta });
  assert.equal(periodLabel(model, 'monthly'), 'September MTD');
  assert.equal(periodLabel(model, 'weekly'), 'Week of Sep 14-20');
  assert.equal(model.meta.defaultPeriod, 'monthly');
});

test('a generic period_label describes the default view only, never the other', () => {
  // Today's Meta tab: one generic label and nothing period-specific.
  const meta = ['Key,Value', 'period_label,as-of Morning Runway live'].join('\n');
  const model = buildModelFromCsv({ meta });
  assert.equal(periodLabel(model, 'monthly'), 'as-of Morning Runway live');
  assert.equal(periodLabel(model, 'weekly'), 'Weekly', 'must not relabel weekly with the monthly string');
});

/* --- gviz header auto-detection ---------------------------------------- */

test('a mangled multi-row gviz header is reported, not silently empty', () => {
  // Exactly what the live endpoint returned without headers=1: gviz folded the
  // first three rows into the header and space-joined them.
  const mangled = [
    '"Metric Appointments Set Cost per Appt","Period monthly monthly","Value ","Target ","Unit count USD"',
    '"Contracts Signed $$","monthly","46750.07","","USD"',
    '"Jobs Completed","monthly","8","","count"',
  ].join('\n');

  const model = buildModelFromCsv({ kpi: mangled });
  assert.equal(kpiFor(model, 'Contracts Signed $$'), null, 'the mangled header makes rows unusable');
  assert.equal(model.sources.kpi, 'unparsed', 'and that must be visible, not silent');
  assert.match(model.sourceErrors.join(' '), /no rows parsed/);
});

test('the same tab parses correctly once gviz is pinned to one header row', () => {
  const clean = [
    'Metric,Period,Value,Target,Unit',
    'Appointments Set,monthly,,,count',
    'Cost per Appt,monthly,,,USD',
    'Contracts Signed $$,monthly,46750.07,,USD',
    'Jobs Completed,monthly,8,,count',
  ].join('\n');

  const model = buildModelFromCsv({ kpi: clean });
  assert.equal(kpiFor(model, 'Contracts Signed $$').number, 46750.07);
  assert.equal(kpiFor(model, 'Jobs Completed').number, 8);
  assert.equal(kpiFor(model, 'Appointments Set').number, null, 'blank stays blank');
  assert.notEqual(model.sources.kpi, 'unparsed');
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
    // Rest + Meta + L10 History + Sales YTD + Sales YTD Detail, all tolerated.
    assert.equal(model.sourceErrors.length, 5);
    assert.equal(model.salesYtd.present, false, 'no Sales YTD tab is a frame of em dashes, not a broken board');
    assert.equal(model.trends.size, 0, 'no history tab means no sparklines, not a broken board');
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

await (async function gvizErrorPayloadIsNotData() {
  // gviz answers a stale gid with HTTP 200 and a JS payload, not an error.
  // Treating it as CSV made the tab report success and parse to zero rows,
  // which is how the KPI and Meta zones went blank with no badge at all.
  const payload = '/*O_o*/\ngoogle.visualization.Query.setResponse({"status":"error"});';
  stubFetch(async (tab) => (okCsv[tab]
    ? { ok: true, status: 200, text: async () => okCsv[tab] }
    : { ok: true, status: 200, text: async () => payload }));

  const model = await loadLive();
  test('a gviz error payload counts as an unavailable tab, not empty data', () => {
    assert.equal(model.sources.top5, 'ok');
    assert.equal(model.sources.rest, 'unavailable', 'must not be reported as a healthy, empty tab');
    assert.match(model.sourceErrors.join(' '), /non-CSV/);
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

/* --- L10 scorecard ----------------------------------------------------- */

test('hitStatus honours every goal operator the sheet uses', () => {
  assert.equal(hitStatus(12, 12, '>='), true);
  assert.equal(hitStatus(11, 12, '>='), false);
  assert.equal(hitStatus(12, 12, '≥'), true);      // the sheet may store the glyph
  assert.equal(hitStatus(13, 12, '>'), true);
  assert.equal(hitStatus(12, 12, '>'), false);
  assert.equal(hitStatus(240, 250, '<'), true);
  assert.equal(hitStatus(250, 250, '<'), false);
  assert.equal(hitStatus(250, 250, '<='), true);
  assert.equal(hitStatus(250, 250, '≤'), true);
});

test('hitStatus refuses a verdict when either side is unknown', () => {
  assert.equal(hitStatus(null, 12, '>='), null, 'a blank value is unknown, not a miss');
  assert.equal(hitStatus(12, null, '>='), null);
  assert.equal(hitStatus(12, 12, ''), null, 'no operator means no pill');
  assert.equal(hitStatus(12, 12, 'about'), null);
  assert.equal(hitStatus(0, 3, '>='), false, 'an explicit zero still gets judged');
});

(function l10FromCsv() {
  /* Shaped like the real tabs: out-of-order Sort, an intentionally blank
     current Value, a literal zero, and history rows shuffled so the ordering
     has to come from WeekStart rather than sheet order. */
  const current = [
    'Sort,Group,Measurable,Owner,GoalOp,Goal,Value,Unit,WeekLabel,Source,Notes,Updated ET',
    '7,Production,Jobs Completed,Ops,>=,3,0,count,Sep 14–20,CompanyCam,,Mon Sep 21 · 9:01 PM ET',
    '1,Sales,Appointments Set,Team,>=,12,14,count,Sep 14–20,CRM,,Mon Sep 21 · 9:01 PM ET',
    '4,Sales,Close Rate - John,John,>=,40,,percent,Sep 14–20,CRM,,Mon Sep 21 · 9:01 PM ET',
    '2,Sales,Cost per Appointment Set,Team,<,250,212.5,usd,Sep 14–20,Ads,,Mon Sep 21 · 9:01 PM ET',
  ].join('\n');

  const history = [
    'WeekStart,WeekEnd,WeekLabel,Sort,Group,Measurable,Owner,GoalOp,Goal,Value,Unit,Source,SourceDetail,Updated ET',
    '2026-09-14,2026-09-20,Sep 14–20,1,Sales,Appointments Set,Team,>=,12,14,count,CRM,,',
    '2026-06-29,2026-07-05,Jun 29–Jul 5,1,Sales,Appointments Set,Team,>=,12,9,count,CRM,,',
    '2026-08-31,2026-09-06,Aug 31–Sep 6,1,Sales,Appointments Set,Team,>=,12,,count,CRM,,',
    '2026-09-07,2026-09-13,Sep 7–13,1,Sales,Appointments Set,Team,>=,12,0,count,CRM,,',
    '2026-09-14,2026-09-20,Sep 14–20,7,Production,Jobs Completed,Ops,>=,3,0,count,CompanyCam,,',
  ].join('\n');

  const meta = [
    'key,value',
    'l10_week_label,Week of Sep 14–20',
    'l10_trend_weeks,13',
    'refresh_seconds,120',
  ].join('\n');

  const model = buildL10FromCsv({ current, history, meta });

  test('L10 cards come back in Sort order, not sheet order', () => {
    assert.deepEqual(model.cards.map((c) => c.measurable), [
      'Appointments Set',
      'Cost per Appointment Set',
      'Close Rate - John',
      'Jobs Completed',
    ]);
  });

  test('L10 keeps the corrected Appointments Set spelling', () => {
    assert.ok(model.cards.some((c) => c.measurable === 'Appointments Set'));
    assert.ok(!/Appoinments/i.test(current + JSON.stringify(model.cards)));
  });

  test('a blank current Value stays null while a literal zero survives', () => {
    const byName = new Map(model.cards.map((c) => [c.measurable, c]));
    assert.equal(byName.get('Close Rate - John').value, null);
    assert.equal(byName.get('Close Rate - John').hit, null, 'blank must not render a Miss pill');
    assert.equal(byName.get('Jobs Completed').value, 0);
    assert.equal(byName.get('Jobs Completed').hit, false);
    assert.equal(byName.get('Cost per Appointment Set').value, 212.5);
    assert.equal(byName.get('Cost per Appointment Set').hit, true);
  });

  test('L10 history is ordered by WeekStart and keeps gaps as null', () => {
    const series = historyFor(model, 'Appointments Set');
    assert.deepEqual(series.map((p) => p.weekStart), [
      '2026-06-29', '2026-08-31', '2026-09-07', '2026-09-14',
    ]);
    assert.deepEqual(series.map((p) => p.value), [9, null, 0, 14]);
  });

  test('history joins on the measurable name, trim-tolerant', () => {
    assert.equal(historyFor(model, '  Appointments Set ').length, 4);
    assert.equal(historyFor(model, 'Close Rate - John').length, 0, 'no history yet is an empty series');
  });

  test('L10 reads its week label and trend width from Meta', () => {
    assert.equal(model.weekLabel, 'Week of Sep 14–20');
    assert.equal(model.trendWeeks, 13);
    assert.equal(model.refreshSeconds, 120);
  });

  test('the week label falls back to the current rows when Meta is silent', () => {
    const bare = buildL10FromCsv({ current, history, meta: 'key,value\n' });
    assert.equal(bare.weekLabel, 'Sep 14–20');
    assert.equal(bare.trendWeeks, CONFIG.l10TrendWeeks);
  });
})();

(function l10PeriodColumn() {
  /* The live tab grew a Period column: nine rows for the completed week the
     Level 10 meeting reviews, and nine for the week in progress. Without a
     filter every measurable rendered twice. */
  const current = [
    'Period,Sort,Group,Measurable,Owner,GoalOp,Goal,Value,Unit,WeekLabel,Source,Notes,Updated ET',
    'last,1,Marketing > Leads,Appointments Set,JV,>=,8,6,count,Sep 14–20,GHL,,x',
    'last,3,Claims > Contracts,Contracts Signed - $$,JV,>=,60000,80525.48,usd,Sep 14–20,ProLine,,x',
    'current,1,Marketing > Leads,Appointments Set,JV,>=,8,1,count,Sep 21–27,GHL,,x',
    'current,3,Claims > Contracts,Contracts Signed - $$,JV,>=,60000,,usd,Sep 21–27,ProLine,,x',
  ].join('\n');

  test('each measurable appears once, from the completed week by default', () => {
    const model = buildL10FromCsv({ current, meta: 'key,value\n' });
    assert.equal(model.cards.length, 2, 'one card per measurable, not one per row');
    assert.equal(model.view, 'last');
    assert.deepEqual(model.cards.map((c) => c.value), [6, 80525.48]);
  });

  test('Meta l10_view_default can select the week in progress', () => {
    const meta = 'key,value\nl10_view_default,current\nl10_week_label_current,Sep 21–27\n';
    const model = buildL10FromCsv({ current, meta });
    assert.equal(model.view, 'current');
    assert.deepEqual(model.cards.map((c) => c.value), [1, null]);
    assert.equal(model.weekLabel, 'Sep 21–27', 'the header follows the view');
  });

  test('the week label prefers the per-view Meta key', () => {
    const meta = 'key,value\nl10_week_label,stale\nl10_week_label_last,Sep 14–20\n';
    assert.equal(buildL10FromCsv({ current, meta }).weekLabel, 'Sep 14–20');
  });

  test('a tab with no Period column still renders every row', () => {
    const bare = [
      'Sort,Group,Measurable,Owner,GoalOp,Goal,Value,Unit,WeekLabel',
      '1,Sales,Appointments Set,JV,>=,8,6,count,Sep 14–20',
      '3,Sales,Contracts Signed - $$,JV,>=,60000,80525.48,usd,Sep 14–20',
    ].join('\n');
    assert.equal(buildL10FromCsv({ current: bare, meta: 'key,value\n' }).cards.length, 2);
  });

  test('a sheet holding only the other view shows it rather than nothing', () => {
    const onlyCurrent = [
      'Period,Sort,Measurable,GoalOp,Goal,Value,Unit,WeekLabel',
      'current,1,Appointments Set,>=,8,1,count,Sep 21–27',
    ].join('\n');
    const model = buildL10FromCsv({ current: onlyCurrent, meta: 'key,value\n' });
    assert.equal(model.cards.length, 1, 'an empty page would hide a number that exists');
  });

  test('normalizeL10View is tolerant but never guesses', () => {
    assert.equal(normalizeL10View('last'), 'last');
    assert.equal(normalizeL10View('Last Week'), 'last');
    assert.equal(normalizeL10View('current'), 'current');
    assert.equal(normalizeL10View('This Week'), 'current');
    assert.equal(normalizeL10View(''), null, 'blank belongs to whichever view is showing');
    assert.equal(normalizeL10View('quarterly'), null);
  });
})();

test('a null in a trend series breaks the line instead of bridging it', () => {
  const points = [
    { label: 'w1', value: 9 },
    { label: 'w2', value: null },
    { label: 'w3', value: 0 },
    { label: 'w4', value: 14 },
  ];
  const runs = segments(points);
  assert.equal(runs.length, 2, 'the gap must end one run and start another');
  assert.deepEqual(runs[0].map((p) => p.index), [0]);
  assert.deepEqual(runs[1].map((p) => p.index), [2, 3], 'an explicit zero is plotted, not skipped');
});

test('a series with no values at all yields no runs to draw', () => {
  assert.deepEqual(segments([{ value: null }, { value: undefined }]), []);
});

/* --- Sheet watchdog contract ------------------------------------------- */

(function watchdogContract() {
  const require_ = createRequire(import.meta.url);
  const tabs = require_('../netlify/lib/tabs.js');

  /* The headers the live Sheet actually serves today. If one of these starts
     failing, either the Sheet changed or the contract drifted - and finding out
     here beats finding out from a blank zone on the wall. */
  const LIVE = {
    KPI: 'Metric,Period,Value,Target,Unit,Source,Owner,Notes,Updated ET',
    TOP5: 'Person,Today %,~5-day avg,Updated ET',
    REST: 'Person,Days at rest avg,Project count,Updated ET',
    META: 'Key,Value',
    L10: 'Period,Sort,Group,Measurable,Owner,GoalOp,Goal,Value,Unit,WeekLabel,Source,Notes,Updated ET',
    L10_HISTORY: 'WeekStart,WeekEnd,WeekLabel,Sort,Group,Measurable,Owner,GoalOp,Goal,Value,Unit,Source,SourceDetail,Updated ET',
  };

  test('every live tab header satisfies the contract with no drift', () => {
    for (const [slot, header] of Object.entries(LIVE)) {
      const drift = tabs.driftFor(slot, `${header}\nx`);
      assert.deepEqual(drift.missing, [], `${slot} reports a missing column`);
      assert.deepEqual(drift.added, [], `${slot} reports undocumented columns`);
    }
  });

  test('a required column is satisfied by any spelling the board accepts', () => {
    assert.deepEqual(tabs.driftFor('TOP5', 'Person,Today %,Avg\nx').missing, []);
    assert.deepEqual(tabs.driftFor('TOP5', 'Name,Today Pct,Avg\nx').missing, []);
    assert.deepEqual(tabs.driftFor('TOP5', 'Crew,Today Percent\nx').missing, []);
    assert.deepEqual(tabs.driftFor('TOP5', 'Person,Avg\nx').missing, ['todaypct']);
  });

  test('a new column is reported as drift, which is how the Period column got missed', () => {
    const before = tabs.driftFor('L10', 'Sort,Group,Measurable,Owner,GoalOp,Goal,Value,Unit\nx');
    assert.deepEqual(before.added, [], 'the documented shape is quiet');
    const after = tabs.driftFor('L10', `${LIVE.L10},Confidence\nx`);
    assert.deepEqual(after.added, ['confidence']);
  });

  test('quoted commas in a header do not split a column', () => {
    assert.deepEqual(tabs.headerCells('Metric,"Value, net",Unit'), ['Metric', 'Value, net', 'Unit']);
  });

  test('staleness is measured only from stamps that carry a zone', () => {
    const now = Date.parse('2026-09-22T12:00:00Z');
    const withZone = 'Metric,Value,Updated ET\nCash,5,2026-09-18T21:51:00-04:00\n';
    const age = tabs.stampAgeHours(withZone, now);
    assert.ok(age, 'an ISO stamp with an offset is comparable');
    assert.equal(Math.round(age.ageHours), 82, "Sep 18 21:51 -04:00 is Sep 19 01:51 UTC");

    const humanOnly = 'Metric,Value,Updated ET\nCash,5,Mon Sep 21 - 9:01 PM ET\n';
    assert.equal(tabs.stampAgeHours(humanOnly, now), null,
      'a stamp with no zone is skipped, not guessed at');
  });

  test('a partly refreshed tab is visible, not hidden by its newest row', () => {
    const now = Date.parse('2026-10-05T22:00:00Z');
    /* The real shape that caused this: eight fresh close-rate rows written
       beside fourteen cash rows seventeen days old. Reading the newest stamp
       alone reports a perfectly healthy tab. */
    const kpi = [
      'Metric,Period,Value,Updated ET',
      'Cash Collected,monthly,108367.14,2026-09-18T21:51:00-04:00',
      'Close Rate - John,monthly,22.22,2026-10-05T17:58:00-04:00',
    ].join('\n');
    const age = tabs.stampAgeHours(kpi, now);
    assert.ok(age.ageHours < 5, 'the newest row is current');
    assert.ok(age.oldestAgeHours > 400, 'and the oldest is seventeen days behind it');
  });

  test('an append-only tab keeps old rows without reading as stale', () => {
    assert.equal(tabs.CONTRACT.L10_HISTORY.appendOnly, true,
      'a record of past weeks keeps its stamps forever and that is correct');
    for (const slot of ['KPI', 'TOP5', 'REST', 'META', 'L10', 'SALES_YTD', 'SALES_YTD_DETAIL']) {
      assert.ok(!tabs.CONTRACT[slot].appendOnly, `${slot} is rewritten each run, so every row counts`);
    }
  });

  test('the Meta tab stamp is read from its key/value row', () => {
    const now = Date.parse('2026-09-22T12:00:00Z');
    const meta = 'Key,Value\nlast_updated_et,2026-09-22T08:00:00-04:00\nrefresh_seconds,180\n';
    assert.equal(Math.round(tabs.stampAgeHours(meta, now).ageHours), 0);
  });

  test('staleness limits are per tab and overridable by env', () => {
    assert.equal(tabs.maxAgeFor('TOP5'), 30, 'a daily tab tolerates a day and a bit');
    assert.equal(tabs.maxAgeFor('L10'), 192, 'a weekly tab tolerates a week and a day');
    process.env.HEALTH_MAX_AGE_TOP5 = '6';
    assert.equal(tabs.maxAgeFor('TOP5'), 6);
    delete process.env.HEALTH_MAX_AGE_TOP5;
  });

  /* gviz answers an unknown tab name with the FIRST sheet of the workbook, at
     HTTP 200 and as perfectly valid CSV. Asking for a tab that does not exist
     therefore returns KPI, which parses cleanly and is completely wrong - the
     Sales YTD Detail drill-down read KPI rows for a day and reported "no jobs
     for this closer" rather than "that tab does not exist". */
  const KPI_HEADER = 'Metric,Period,Value,Target,Unit,Source,Owner,Notes,Updated ET\nx';

  test('every tab accepts its own header', () => {
    for (const [slot, header] of Object.entries(LIVE)) {
      assert.equal(tabs.wrongTab(slot, `${header}\nx`), null, `${slot} rejects its own live header`);
    }
  });

  test('no tab can be satisfied by the sheet gviz substitutes for a missing one', () => {
    for (const slot of Object.keys(LIVE)) {
      if (slot === 'KPI') continue;      // KPI is the substitute; it is itself
      assert.ok(tabs.wrongTab(slot, KPI_HEADER),
        `${slot} would accept KPI's columns - a missing tab would read as present`);
    }
  });

  test('the required sets avoid KPI\'s own column names', () => {
    /* The specific collisions that let three tabs through on the first
       attempt: KPI has Owner, Value, Metric and Target. */
    const kpiCols = new Set(['metric', 'period', 'value', 'target', 'unit', 'source', 'owner', 'notes', 'updatedet']);
    for (const [slot, spec] of Object.entries(tabs.CONTRACT)) {
      if (slot === 'KPI') continue;
      const satisfiable = spec.required.every((aliases) => aliases.some((a) => kpiCols.has(a)));
      assert.ok(!satisfiable, `${slot}'s required columns are all ones KPI also has`);
    }
  });

  test('the watchdog knows about every tab the proxy serves', () => {
    const served = tabs.slots().map((s) => s.slot).sort();
    assert.deepEqual(served, Object.keys(tabs.CONTRACT).sort(),
      'a tab with no contract entry is a tab the watchdog cannot check');
  });
})();

/* --- Sales YTD scoreboard ----------------------------------------------- */

(function salesYtd() {
  const CSV = [
    'Closer,Contract $$,Contracts Count,Month $$,Notes,Updated ET',
    'John,412000,14,38000,,2026-10-05T14:30:00-04:00',
    'Anas,288500.50,9,12500,,2026-10-05T14:30:00-04:00',
    'Henry,197000,7,0,,2026-10-05T14:30:00-04:00',
    'Other,38500,2,0,Jacob $38500 (2),2026-10-05T14:30:00-04:00',
    'Total,936000.50,32,50500,,2026-10-05T14:30:00-04:00',
  ].join('\n');

  test('the scoreboard reads closers in the board order, with the Sheet total', () => {
    const s = buildSalesYtd(CSV, { ytdlabel: '2026 YTD', ytdbasis: 'ProLine Won Date' });
    assert.deepEqual(s.closers.map((c) => c.closer), ['John', 'Anas', 'Henry', 'Other']);
    assert.deepEqual(s.closers.map((c) => c.periods.ytd.dollars), [412000, 288500.5, 197000, 38500]);
    assert.equal(s.total.periods.ytd.dollars, 936000.5);
    assert.equal(s.label, '2026 YTD');
    assert.equal(s.basis, 'ProLine Won Date');
    assert.equal(s.present, true);
  });

  test('the Other bucket carries its breakdown through', () => {
    const other = buildSalesYtd(CSV, {}).closers.find((c) => c.closer === 'Other');
    assert.equal(other.notes, 'Jacob $38500 (2)', 'a real closer must not hide inside Other');
  });

  test('a total that disagrees with its parts is flagged, never corrected', () => {
    assert.equal(buildSalesYtd(CSV, {}).reconciles, true);
    const wrong = CSV.replace('Total,936000.50', 'Total,900000.00');
    const s = buildSalesYtd(wrong, {});
    assert.equal(s.reconciles, false);
    assert.equal(s.total.periods.ytd.dollars, 900000, "the Sheet's total is shown as written");
  });

  test('a missing closer is unknown, not zero, and keeps its row', () => {
    const partial = [
      'Closer,Contract $$,Contracts Count',
      'John,412000,14',
      'Total,412000,14',
    ].join('\n');
    const s = buildSalesYtd(partial, {});
    assert.deepEqual(s.closers.map((c) => c.closer), ['John', 'Anas', 'Henry', 'Other'],
      'a scoreboard that silently drops a person is worse than one showing em dashes');
    assert.deepEqual(s.closers.map((c) => c.periods.ytd.dollars), [412000, null, null, null]);
    assert.equal(s.reconciles, null, 'a partial set cannot be reconciled either way');
  });

  test('a real zero survives and is not confused with a blank', () => {
    const s = buildSalesYtd(CSV, {});
    const henry = s.closers.find((c) => c.closer === 'Henry');
    assert.equal(henry.periods.month.dollars, 0, 'nothing closed this month is zero');
    const noMonth = buildSalesYtd('Closer,Contract $$\nJohn,10\n', {});
    assert.equal(noMonth.closers[0].periods.month.dollars, null, 'a column the Sheet lacks is unknown');
  });

  test('no Sales YTD tab yields a frame of em dashes, never a derived figure', () => {
    const s = buildSalesYtd('', {});
    assert.equal(s.present, false);
    assert.equal(s.total.periods.ytd.dollars, null);
    assert.deepEqual(s.closers.map((c) => c.periods.ytd.dollars), [null, null, null, null]);
  });

  test('the board still never invents the year from the month', () => {
    const model = buildModelFromCsv({
      kpi: 'Metric,Period,Value,Unit\nContracts Signed $$,monthly,46750.07,USD\n',
      salesYtd: '',
    });
    assert.equal(model.salesYtd.total.periods.ytd.dollars, null,
      'a monthly tile is not a year, however tempting');
    assert.equal(kpiFor(model, 'Contracts Signed $$').number, 46750.07);
  });
})();

/* --- Sales YTD drill-down ----------------------------------------------- */

(function salesDrilldown() {
  const SUMMARY = [
    'Closer,Contract $$,Contracts Count,Updated ET',
    'John,231847.84,15,2026-10-05T16:57:01-04:00',
    'Henry,71750.50,3,2026-10-05T16:57:01-04:00',
    'Total,303598.34,18,2026-10-05T16:57:01-04:00',
  ].join('\n');

  /* Deliberately out of order, and one job whose Won Month is blank, because
     the Sheet's row order is a convenience and not a contract. */
  const DETAIL = [
    'Closer,Project Number,Customer,Won Date,Won Month,Contract $$,Updated ET',
    'Henry,P-0988,Shay Peterson,2026-09-14,2026-09,22100.50,2026-10-05T16:57:01-04:00',
    'Henry,P-1001,James Marlowe,2026-10-04,,31200.00,2026-10-05T16:57:01-04:00',
    'Henry,P-1042,Bryan Law,2026-10-02,2026-10,18450.00,2026-10-05T16:57:01-04:00',
    'John,P-0900,Deb Glaser,2026-08-11,2026-08,231847.84,2026-10-05T16:57:01-04:00',
  ].join('\n');

  const model = buildModelFromCsv({ salesYtd: SUMMARY, salesDetail: DETAIL });

  test('a closer drills to only their own jobs', () => {
    const henry = detailFor(model, 'Henry');
    assert.equal(henry.count, 3);
    assert.deepEqual(
      henry.months.flatMap((m) => m.jobs).map((j) => j.customer).sort(),
      ['Bryan Law', 'James Marlowe', 'Shay Peterson'],
    );
    assert.equal(detailFor(model, 'John').count, 1);
  });

  test('jobs group by month, newest month and newest job first', () => {
    const henry = detailFor(model, 'Henry');
    assert.deepEqual(henry.months.map((m) => m.monthKey), ['2026-10', '2026-09']);
    assert.deepEqual(henry.months[0].jobs.map((j) => j.customer), ['James Marlowe', 'Bryan Law']);
    assert.deepEqual(henry.months.map((m) => m.count), [2, 1]);
    assert.equal(henry.months[0].subtotal, 49650);
  });

  test('a blank Won Month falls back to the Won Date rather than losing the job', () => {
    assert.equal(monthKeyOf({ wonMonth: '', wonDate: '2026-10-04' }), '2026-10');
    assert.equal(monthKeyOf({ wonMonth: '2026-07', wonDate: '2026-10-04' }), '2026-07');
    assert.equal(monthKeyOf({ wonMonth: '', wonDate: '' }), '', 'unknown, but still counted');
  });

  test('month and day labels never go through Date, so no timezone slip', () => {
    assert.equal(monthLabel('2026-10'), 'October 2026');
    assert.equal(monthLabel('2026-01'), 'January 2026');
    assert.equal(dayLabel('2026-01-01'), 'Jan 1', 'UTC parsing would call this Dec 31');
    assert.equal(dayLabel('2026-12-31'), 'Dec 31');
    assert.equal(monthLabel('nonsense'), 'Month not recorded');
  });

  test('the footer total is what the rows add up to, and agrees with the card', () => {
    const henry = detailFor(model, 'Henry');
    assert.equal(henry.total, 71750.5);
    assert.equal(henry.summaryDollars, 71750.5);
    assert.equal(henry.agrees, true);
  });

  test('the panel is checked against its OWN period, not always against YTD', () => {
    const today = new Date(2026, 9, 5);
    const summary = [
      'Closer,Contract $$,Contracts Count,Last Month $$,Last Month Count',
      'Henry,326816.58,3,44828.22,2',
    ].join('\n');
    const detail = [
      'Closer,Customer,Won Date,Won Month,Contract $$',
      'Henry,Sep One,2026-09-19,2026-09,26236.00',
      'Henry,Sep Two,2026-09-19,2026-09,18592.22',
      'Henry,March Job,2026-03-05,2026-03,281988.36',
    ].join('\n');
    const m = buildModelFromCsv({ salesYtd: summary, salesDetail: detail });

    const lastMonth = detailFor(m, 'Henry', 'lastmonth', today);
    assert.equal(lastMonth.total, 44828.22);
    assert.equal(lastMonth.summaryDollars, 44828.22, 'it compares against Last Month $$');
    assert.equal(lastMonth.agrees, true,
      'a narrowed total measured against the YTD figure cried mismatch on every period but YTD');

    const ytd = detailFor(m, 'Henry', 'ytd', today);
    assert.equal(ytd.summaryDollars, 326816.58, 'and year to date still checks the YTD column');
    assert.equal(ytd.agrees, true);
  });

  test('a period the Sheet has no column for cannot be judged either way', () => {
    const today = new Date(2026, 9, 5);
    const m = buildModelFromCsv({
      salesYtd: 'Closer,Contract $$\nHenry,10000\n',
      salesDetail: 'Closer,Customer,Won Date,Won Month,Contract $$\nHenry,A Job,2026-09-14,2026-09,10000\n',
    });
    const v = detailFor(m, 'Henry', 'lastmonth', today);
    assert.equal(v.total, 10000, 'the rows still total up');
    assert.equal(v.summaryDollars, null);
    assert.equal(v.agrees, null, 'nothing to disagree with is not a disagreement');
  });

  test('a summary that disagrees is reported, never reconciled away', () => {
    const wrong = SUMMARY.replace('Henry,71750.50,3', 'Henry,80000.00,4');
    const m = buildModelFromCsv({ salesYtd: wrong, salesDetail: DETAIL });
    const henry = detailFor(m, 'Henry');
    assert.equal(henry.agrees, false);
    assert.equal(henry.total, 71750.5, 'the panel shows what the detail rows hold');
    assert.equal(henry.count, 3, 'no row is invented to reach the summary count');
    assert.equal(henry.summaryDollars, 80000, 'and the card figure is named alongside it');
  });

  test('each card period reads its own column and never borrows another', () => {
    const csv = [
      'Closer,Contract $$,Contracts Count,Last Month $$,Last Month Count',
      'Henry,326816.58,21,44828.22,2',
    ].join('\n');
    const henry = buildSalesYtd(csv, {}).closers.find((c) => c.closer === 'Henry');
    assert.equal(henry.periods.ytd.dollars, 326816.58);
    assert.equal(henry.periods.lastmonth.dollars, 44828.22);
    assert.equal(henry.periods.lastmonth.count, 2);
    assert.equal(henry.periods.quarter.dollars, null,
      'a period the Sheet does not carry stays unknown - never derived from YTD');
    assert.equal(henry.periods.month.dollars, null);
  });

  test('the card periods cover the windows Jacob asked for', () => {
    const today = new Date(2026, 9, 5);                 // Mon Oct 5 2026
    assert.deepEqual(periodRange('ytd', today), { start: '2026-01-01', end: '2026-10-05' });
    assert.deepEqual(periodRange('month', today), { start: '2026-10-01', end: '2026-10-05' });
    assert.deepEqual(periodRange('lastmonth', today), { start: '2026-09-01', end: '2026-09-30' });
    assert.deepEqual(periodRange('quarter', today), { start: '2026-10-01', end: '2026-10-05' });
    assert.deepEqual(periodRange('lastquarter', today), { start: '2026-07-01', end: '2026-09-30' });
  });

  test('period windows roll over a year boundary correctly', () => {
    const jan = new Date(2026, 0, 9);                   // Jan 9 2026
    assert.deepEqual(periodRange('lastmonth', jan), { start: '2025-12-01', end: '2025-12-31' });
    assert.deepEqual(periodRange('lastquarter', jan), { start: '2025-10-01', end: '2025-12-31' });
    const mar = new Date(2026, 2, 31);                  // Mar 31, a 31-day month end
    assert.deepEqual(periodRange('lastmonth', mar), { start: '2026-02-01', end: '2026-02-28' });
  });

  test('the pop-up narrows the job list to the chosen window', () => {
    const today = new Date(2026, 9, 5);
    const detail = [
      'Closer,Customer,Won Date,Won Month,Contract $$',
      'Henry,October Job,2026-10-02,2026-10,10000',
      'Henry,September Job,2026-09-14,2026-09,20000',
      'Henry,July Job,2026-07-08,2026-07,30000',
      'Henry,No Date,,,,'.replace(/,$/, ''),
    ].join('\n');
    const m = buildModelFromCsv({ salesYtd: 'Closer,Contract $$\nHenry,60000\n', salesDetail: detail });

    assert.equal(detailFor(m, 'Henry', 'ytd', today).count, 4, 'YTD keeps every row, dated or not');
    assert.equal(detailFor(m, 'Henry', 'month', today).count, 1);
    assert.equal(detailFor(m, 'Henry', 'lastmonth', today).total, 20000);
    assert.equal(detailFor(m, 'Henry', 'lastquarter', today).count, 2, 'Jul and Sep are both in Q3');
    const q3 = detailFor(m, 'Henry', 'lastquarter', today);
    assert.equal(q3.total, 50000, 're-totalled from the rows actually in the window');
  });

  test('an undated job is kept out of a narrowed window rather than guessed into one', () => {
    const today = new Date(2026, 9, 5);
    const detail = [
      'Closer,Customer,Won Date,Won Month,Contract $$',
      'Henry,No Date,,,15000',
    ].join('\n');
    const m = buildModelFromCsv({ salesDetail: detail });
    assert.equal(detailFor(m, 'Henry', 'ytd', today).count, 1, 'it still shows under year to date');
    assert.equal(detailFor(m, 'Henry', 'lastmonth', today).count, 0);
  });

  test('a closer with no detail rows is empty, not fabricated', () => {
    const anas = detailFor(model, 'Anas');
    assert.deepEqual(anas.months, []);
    assert.equal(anas.count, 0);
    assert.equal(anas.present, true, 'the tab exists, this closer just has no jobs');
  });

  test('no detail tab at all is reported as not ready', () => {
    const m = buildModelFromCsv({ salesYtd: SUMMARY, salesDetail: '' });
    const henry = detailFor(m, 'Henry');
    assert.equal(henry.present, false);
    assert.equal(henry.count, 0);
    assert.deepEqual(henry.months, [], 'never derive job rows from the summary count');
    assert.equal(m.salesYtd.closers.find((c) => c.closer === 'Henry').periods.ytd.dollars, 71750.5,
      'the card keeps its summary number regardless');
  });

  test('a blank dollar cell leaves the subtotal unknown rather than wrong', () => {
    const gap = [
      'Closer,Customer,Won Date,Won Month,Contract $$',
      'Henry,Bryan Law,2026-10-02,2026-10,18450',
      'Henry,Unpriced Job,2026-10-03,2026-10,',
    ].join('\n');
    const m = buildModelFromCsv({ salesYtd: SUMMARY, salesDetail: gap });
    const henry = detailFor(m, 'Henry');
    assert.equal(henry.months[0].subtotal, null, 'a partial sum is a number nobody can reconcile');
    assert.equal(henry.months[0].count, 2, 'but the job count is still true');
    assert.equal(henry.total, null);
  });
})();

/* --- Top Five celebrations --------------------------------------------- */

(function celebrations() {
  /* A controllable clock, so the queue can be stepped without waiting on real
     timers and the one-at-a-time rule can actually be asserted. */
  function harness() {
    const fired = [];
    const states = [];
    let pending = [];
    const engine = createCelebrations({
      onCelebrate: (item) => fired.push(item),
      onState: (s) => states.push({ lastCloser: s.lastCloser, scoring: [...s.scoring].sort() }),
      now: () => 0,
      schedule: (fn) => { pending.push(fn); },
    });
    return {
      engine,
      fired,
      states,
      // Let the current celebration's dwell expire.
      advance() { const run = pending; pending = []; for (const fn of run) fn(); },
      get pendingTimers() { return pending.length; },
    };
  }

  const rows = (obj) => Object.entries(obj).map(([person, today]) => ({ person, today }));

  test('the first poll is a baseline and never celebrates', () => {
    const h = harness();
    const out = h.engine.observe(rows({ Margaret: 100, Travis: 40, John: 0, Jacob: null }));
    assert.deepEqual(out, [], 'a TV booting at 8am must not ding for yesterday');
    assert.equal(h.fired.length, 0);
    assert.equal(h.engine.state.baselined, true);
  });

  test('an increase after baseline fires once, with who and how far', () => {
    const h = harness();
    h.engine.observe(rows({ Henry: 40 }));
    const out = h.engine.observe(rows({ Henry: 60 }));
    assert.equal(out.length, 1);
    assert.deepEqual(
      { person: out[0].person, from: out[0].from, to: out[0].to, hundred: out[0].hundred },
      { person: 'Henry', from: 40, to: 60, hundred: false },
    );
    assert.equal(h.fired.length, 1);
  });

  test('the same value observed twice does not fire again', () => {
    const h = harness();
    h.engine.observe(rows({ Henry: 40 }));
    h.engine.observe(rows({ Henry: 60 }));
    h.engine.observe(rows({ Henry: 60 }));
    h.engine.observe(rows({ Henry: 60 }));
    assert.equal(h.fired.length, 1, 'the fast poll and the board refresh both feed this');
  });

  test('a decrease never celebrates, but is remembered as a correction', () => {
    const h = harness();
    h.engine.observe(rows({ Anas: 60 }));
    assert.deepEqual(h.engine.observe(rows({ Anas: 40 })), [], 'the bot corrected itself');
    assert.equal(h.fired.length, 0);
    // Climbing back from the corrected figure is a real close, not a replay.
    const out = h.engine.observe(rows({ Anas: 60 }));
    assert.equal(out.length, 1);
    assert.equal(out[0].from, 40);
  });

  test('an invalid or blank cell is held, not treated as a change', () => {
    const h = harness();
    h.engine.observe(rows({ John: 40 }));
    assert.deepEqual(h.engine.observe(rows({ John: null })), [], 'a write in progress is not news');
    assert.deepEqual(h.engine.observe(rows({ John: 45 })), [], '45 is a broken cell, not a smaller win');
    assert.deepEqual(h.engine.observe(rows({ John: 'Sep 21' })), []);
    // The held value means coming back to 40 is not a fresh close.
    assert.deepEqual(h.engine.observe(rows({ John: 40 })), []);
    assert.equal(h.fired.length, 0);
  });

  test('blank at baseline then 20 is a real first close', () => {
    const h = harness();
    h.engine.observe(rows({ Jacob: null }));
    const out = h.engine.observe(rows({ Jacob: 20 }));
    assert.equal(out.length, 1);
    assert.equal(out[0].from, null);
    assert.equal(out[0].to, 20);
  });

  test('blank to a literal zero is not a close', () => {
    const h = harness();
    h.engine.observe(rows({ Jacob: null }));
    assert.deepEqual(h.engine.observe(rows({ Jacob: 0 })), [], 'zero of five is not an achievement');
    assert.equal(h.fired.length, 0);
  });

  test('landing on 100 is flagged for the pulse', () => {
    const h = harness();
    h.engine.observe(rows({ Margaret: 80 }));
    const out = h.engine.observe(rows({ Margaret: 100 }));
    assert.equal(out[0].hundred, true);
  });

  test('a multi-person write celebrates one at a time, in board order', () => {
    const h = harness();
    h.engine.observe(rows({ Margaret: 0, Travis: 0, John: 0 }));
    const out = h.engine.observe(rows({ Margaret: 20, Travis: 40, John: 60 }));
    assert.equal(out.length, 3, 'all three are queued');
    assert.equal(h.fired.length, 1, 'but only the first has played');
    assert.deepEqual(h.fired.map((f) => f.person), ['Margaret']);

    h.advance();
    assert.deepEqual(h.fired.map((f) => f.person), ['Margaret', 'Travis']);
    h.advance();
    assert.deepEqual(h.fired.map((f) => f.person), ['Margaret', 'Travis', 'John']);
    h.advance();
    assert.equal(h.engine.state.running, false);
    assert.equal(h.engine.state.queued, 0);
  });

  test('the bright-green closer moves to whoever closed most recently', () => {
    const h = harness();
    h.engine.observe(rows({ Henry: 20, Anas: 20 }));
    h.engine.observe(rows({ Henry: 40, Anas: 20 }));
    assert.equal(h.engine.state.lastCloser, 'henry');
    h.advance();
    h.engine.observe(rows({ Henry: 40, Anas: 40 }));
    assert.equal(h.engine.state.lastCloser, 'anas');
  });

  test('everyone at 20 or more reads as scoring; zero and blank do not', () => {
    const h = harness();
    h.engine.observe(rows({ Margaret: 100, Travis: 20, John: 0, Henry: null }));
    const latest = h.states[h.states.length - 1];
    assert.deepEqual(latest.scoring, ['margaret', 'travis']);
  });

  test('someone added to the tab mid-day baselines rather than celebrating', () => {
    const h = harness();
    h.engine.observe(rows({ Henry: 40 }));
    assert.deepEqual(h.engine.observe(rows({ Henry: 40, Kayla: 80 })), [],
      'their first reading is not a close we watched happen');
    const out = h.engine.observe(rows({ Henry: 40, Kayla: 100 }));
    assert.deepEqual(out.map((o) => o.person), ['Kayla']);
  });
})();

test('config keeps Talon\'s locked scoring set', () => {
  assert.deepEqual(CONFIG.top5ValidToday, [0, 20, 40, 60, 80, 100]);
});

console.log(`\n${passed} passing`);
