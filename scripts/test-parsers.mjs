/* Smoke tests for the Sheet -> model pipeline. No network, no browser.
   Run: npm test */

import assert from 'node:assert/strict';
import { buildL10FromCsv, buildModelFromCsv, hitStatus, historyFor, normalizeL10View, kpiFor, loadLive, NoSourceError, normalizePeriod, periodLabel } from '../assets/js/sheet.js';
import { segments } from '../assets/js/chart.js';
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

test('config keeps Talon\'s locked scoring set', () => {
  assert.deepEqual(CONFIG.top5ValidToday, [0, 20, 40, 60, 80, 100]);
});

console.log(`\n${passed} passing`);
