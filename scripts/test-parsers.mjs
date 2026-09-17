/* Smoke tests for the Sheet -> model pipeline. No network, no browser.
   Run: npm test */

import assert from 'node:assert/strict';
import { buildModelFromCsv, kpiFor } from '../assets/js/sheet.js';
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

console.log(`\n${passed} passing`);
