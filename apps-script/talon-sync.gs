/**
 * Talon board — Google Sheet sync.
 *
 * Runs inside the Talon Board spreadsheet (Extensions -> Apps Script) and does
 * three jobs:
 *
 *   ensureTabs()     build every tab and header the TV board expects
 *   syncRestIndex()  read the Morning Runway sheet -> write the Rest Index tab
 *   syncTopFive()    read the Top-Five Entry tab   -> write Daily Top-Five Progress
 *
 * It runs as you, so it reads Morning Runway with your own Drive access — no
 * sharing, API keys or service accounts involved.
 *
 * Rules it never breaks (the TV board depends on them):
 *   - unknown = blank cell, never 0. A real 0 is written as 0.
 *   - it only writes the four board tabs; it never touches Morning Runway.
 *
 * Install: see apps-script/README.md in the talon-tv repo.
 */

/* ------------------------------------------------------------------ config */

var CONFIG = {
  // Morning Runway spreadsheet (the weekday stale clock lives here).
  runwayId: '1qpAJYkdxByPNPynUMcXJZQ5EWFF3UVxjnlgKDJkUdj0',

  // Tab inside Morning Runway to read. '' = the first tab.
  runwayTab: '',

  // Morning Runway column headers. Put the exact header text here; if a header
  // can't be found, set the fallback column letter instead (e.g. daysLetter: 'A').
  runway: {
    ownerHeader: 'Owner',
    daysHeader: 'Days at rest',
    projectHeader: 'Project',
    statusHeader: 'Status',

    ownerLetter: '',
    daysLetter: 'A',
    projectLetter: '',
    statusLetter: '',

    // Rows whose status matches any of these (case-insensitive) are not open
    // projects and are skipped. Empty list = every row counts.
    closedStatuses: ['closed', 'complete', 'completed', 'done', 'won', 'lost', 'dead', 'archived'],
  },

  // Rest Index owners, in board order. Extra people found in Morning Runway are
  // appended after these, and are left out of the company summary number.
  restOwners: ['Jacob', 'John', 'Henry', 'Anas'],

  // Daily Top Five people, in board order.
  top5People: ['Margaret', 'Travis', 'John', 'Henry', 'Anas', 'Jacob'],

  // How many weekdays the "~5-day avg" column averages over.
  avgWindow: 5,

  timeZone: 'America/New_York',

  tabs: {
    kpi: 'KPI',
    top5: 'Daily Top-Five Progress',
    rest: 'Rest Index',
    meta: 'Meta',
    entry: 'Top-Five Entry',
  },
};

var KPI_METRICS = [
  ['Appointments Set', 'count', 'GHL'],
  ['Cost per Appt', 'USD', 'GHL'],
  ['Contracts Signed $$', 'USD', 'ProLine'],
  ['Close Rates', 'pct', 'ProLine'],
  ['Jobs Completed', 'count', 'ProLine'],
  ['Sent CoC cash sitting', 'USD', 'ProLine'],
  ['Total AR Over 60 Days', 'USD', 'ProLine'],
  ['Cash Collected', 'USD', 'ProLine'],
];

/* ------------------------------------------------------------------ menu */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Talon')
    .addItem('Build / repair tabs', 'ensureTabs')
    .addItem('Sync Rest Index now', 'syncRestIndex')
    .addItem('Sync Top Five now', 'syncTopFive')
    .addSeparator()
    .addItem('Install weekday triggers', 'installTriggers')
    .addToUi();
}

/* ------------------------------------------------------------- tab set-up */

/** Creates any missing tab and writes the exact headers the board parses. */
function ensureTabs() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var kpi = tab_(ss, CONFIG.tabs.kpi);
  setRow_(kpi, 1, ['Metric', 'Value', 'Target', 'Unit', 'Source', 'Owner', 'Notes', 'Updated']);
  // Seed the eight metric rows (labels only — values stay blank until written).
  var existing = columnValues_(kpi, 1, 2);
  for (var i = 0; i < KPI_METRICS.length; i++) {
    var metric = KPI_METRICS[i];
    if (existing.indexOf(metric[0]) === -1) {
      kpi.appendRow([metric[0], '', '', metric[1], metric[2], '', '', '']);
    }
  }

  var top5 = tab_(ss, CONFIG.tabs.top5);
  setRow_(top5, 1, ['Person', 'Today %', '~5-day avg', 'Updated ET']);

  var rest = tab_(ss, CONFIG.tabs.rest);
  setRow_(rest, 1, ['Person', 'Days at rest avg', 'Project count', 'Updated ET']);

  var meta = tab_(ss, CONFIG.tabs.meta);
  setRow_(meta, 1, ['Key', 'Value']);
  metaDefault_(meta, 'last_updated_et', '');
  metaDefault_(meta, 'period_label', '');
  metaDefault_(meta, 'site_title', 'Talon');
  metaDefault_(meta, 'refresh_seconds', 180);

  // Daily check-off sheet: one row per person per weekday, five checkboxes.
  var entry = tab_(ss, CONFIG.tabs.entry);
  setRow_(entry, 1, ['Date', 'Person', 'Item 1', 'Item 2', 'Item 3', 'Item 4', 'Item 5', 'Done (0-5)']);
  if (entry.getLastRow() < 2) seedEntryRows_(entry, new Date());

  SpreadsheetApp.getActiveSpreadsheet().toast('Talon tabs are in place.');
}

/** Adds today's six blank check-off rows, with checkboxes. */
function seedEntryRows_(entry, when) {
  var date = etDate_(when);
  var rows = CONFIG.top5People.map(function (person) {
    return [date, person, false, false, false, false, false, ''];
  });
  var start = entry.getLastRow() + 1;
  entry.getRange(start, 1, rows.length, rows[0].length).setValues(rows);
  entry.getRange(start, 3, rows.length, 5).insertCheckboxes();
}

/** Trigger target: run each weekday morning so the crew has rows to tick. */
function addTodaysEntryRows() {
  if (!isWeekday_(new Date())) return;
  var entry = tab_(SpreadsheetApp.getActiveSpreadsheet(), CONFIG.tabs.entry);
  var today = etDate_(new Date());
  var dates = columnValues_(entry, 1, 2).map(normalizeDate_);
  if (dates.indexOf(today) === -1) seedEntryRows_(entry, new Date());
}

/* --------------------------------------------------------- rest index sync */

/**
 * Averages each owner's open-project days at rest from Morning Runway and
 * writes the Rest Index tab, including the company summary row the board reads
 * as its hero number.
 */
function syncRestIndex() {
  var runway = openRunway_();
  var grid = runway.getDataRange().getValues();
  if (grid.length < 2) throw new Error('Morning Runway looks empty — check CONFIG.runwayTab.');

  var head = grid[0].map(headerKey_);
  var col = {
    owner: findColumn_(head, CONFIG.runway.ownerHeader, CONFIG.runway.ownerLetter),
    days: findColumn_(head, CONFIG.runway.daysHeader, CONFIG.runway.daysLetter),
    status: findColumn_(head, CONFIG.runway.statusHeader, CONFIG.runway.statusLetter),
  };

  if (col.owner < 0) throw new Error('No owner column in Morning Runway — set CONFIG.runway.ownerHeader or ownerLetter.');
  if (col.days < 0) throw new Error('No days-at-rest column in Morning Runway — set CONFIG.runway.daysHeader or daysLetter.');

  // owner -> { sum, count }
  var byOwner = {};
  var order = [];

  for (var r = 1; r < grid.length; r++) {
    var row = grid[r];
    var owner = String(row[col.owner] || '').trim();
    if (!owner) continue;
    if (col.status > -1 && isClosed_(row[col.status])) continue;

    var days = toNumber_(row[col.days]);
    if (days === null) continue; // no clock on this project yet — not a zero

    var key = owner.toLowerCase();
    if (!byOwner[key]) { byOwner[key] = { name: owner, sum: 0, count: 0 }; order.push(key); }
    byOwner[key].sum += days;
    byOwner[key].count += 1;
  }

  // Board order first, then anyone else Morning Runway knows about.
  var people = CONFIG.restOwners.slice();
  order.forEach(function (key) {
    if (people.map(lower_).indexOf(key) === -1) people.push(byOwner[key].name);
  });

  var stamp = etStamp_(new Date());
  var rows = [];
  var ownerAverages = [];

  people.forEach(function (person) {
    var entry = byOwner[person.toLowerCase()];
    if (!entry || !entry.count) {
      rows.push([person, '', '', stamp]); // blank, never 0
      return;
    }
    var avg = round1_(entry.sum / entry.count);
    rows.push([person, avg, entry.count, stamp]);
    if (CONFIG.restOwners.map(lower_).indexOf(person.toLowerCase()) > -1) ownerAverages.push(avg);
  });

  // Company Rest Index: unweighted mean of the four owners' averages, matching
  // "average of each owner's open-project days at rest".
  var index = ownerAverages.length
    ? round1_(ownerAverages.reduce(function (a, b) { return a + b; }, 0) / ownerAverages.length)
    : '';
  rows.push(['Rest Index', index, '', stamp]);

  writeBody_(tab_(SpreadsheetApp.getActiveSpreadsheet(), CONFIG.tabs.rest), rows);
  touchMeta_(stamp);
}

/* ----------------------------------------------------------- top five sync */

/**
 * Count-based scoring, locked: each of five items done = 20%. Today % comes
 * from today's row; the ~5-day average covers the most recent CONFIG.avgWindow
 * weekdays that have a row for that person.
 */
function syncTopFive() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var entry = tab_(ss, CONFIG.tabs.entry);
  var grid = entry.getDataRange().getValues();

  // person -> [{ date, pct }], newest first
  var history = {};

  for (var r = 1; r < grid.length; r++) {
    var row = grid[r];
    var date = normalizeDate_(row[0]);
    var person = String(row[1] || '').trim();
    if (!date || !person) continue;

    var pct = scoreRow_(row);
    if (pct === null) continue;

    var key = person.toLowerCase();
    if (!history[key]) history[key] = [];
    history[key].push({ date: date, pct: pct });
  }

  Object.keys(history).forEach(function (key) {
    history[key].sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  });

  var today = etDate_(new Date());
  var stamp = etStamp_(new Date());

  var people = CONFIG.top5People.slice();
  Object.keys(history).forEach(function (key) {
    if (people.map(lower_).indexOf(key) === -1) people.push(key);
  });

  var rows = people.map(function (person) {
    var log = history[person.toLowerCase()] || [];
    var todayEntry = log.filter(function (e) { return e.date === today; })[0];
    var window = log.slice(0, CONFIG.avgWindow);
    var avg = window.length
      ? round1_(window.reduce(function (sum, e) { return sum + e.pct; }, 0) / window.length)
      : '';
    return [
      person,
      todayEntry ? todayEntry.pct : '', // no row yet today = blank, not 0
      avg,
      stamp,
    ];
  });

  writeBody_(tab_(ss, CONFIG.tabs.top5), rows);
  touchMeta_(stamp);
}

/**
 * A row scores from its five checkboxes, or from the "Done (0-5)" column when
 * someone would rather type a number. A row with neither is unscored (blank),
 * which is different from a scored zero.
 */
function scoreRow_(row) {
  var done = toNumber_(row[7]);
  if (done !== null) return clamp_(Math.round(done), 0, 5) * 20;

  var ticked = 0;
  var seen = 0;
  for (var c = 2; c <= 6; c++) {
    var cell = row[c];
    if (cell === '' || cell === null || cell === undefined) continue;
    seen += 1;
    if (cell === true || String(cell).toLowerCase() === 'true' || String(cell).toLowerCase() === 'yes'
        || String(cell).toLowerCase() === 'x' || cell === 1 || String(cell) === '1') ticked += 1;
  }
  return seen ? ticked * 20 : null;
}

/* ------------------------------------------------------------- triggers */

/** Weekday rows in the morning, Rest Index at 7am, Top Five at 4pm ET. */
function installTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });

  ScriptApp.newTrigger('addTodaysEntryRows').timeBased().atHour(6).everyDays(1).create();
  ScriptApp.newTrigger('syncRestIndex').timeBased().atHour(7).everyDays(1).create();
  ScriptApp.newTrigger('syncTopFive').timeBased().atHour(16).everyDays(1).create();

  SpreadsheetApp.getActiveSpreadsheet().toast('Triggers installed: 6am rows, 7am Rest Index, 4pm Top Five.');
}

/* -------------------------------------------------------------- helpers */

function openRunway_() {
  var ss = SpreadsheetApp.openById(CONFIG.runwayId);
  return CONFIG.runwayTab ? ss.getSheetByName(CONFIG.runwayTab) : ss.getSheets()[0];
}

function tab_(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function setRow_(sheet, rowIndex, values) {
  sheet.getRange(rowIndex, 1, 1, values.length).setValues([values]).setFontWeight('bold');
  sheet.setFrozenRows(1);
}

/** Replaces everything below the header, so stale people don't linger. */
function writeBody_(sheet, rows) {
  var last = sheet.getLastRow();
  if (last > 1) sheet.getRange(2, 1, last - 1, sheet.getLastColumn()).clearContent();
  if (rows.length) sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
}

function columnValues_(sheet, column, fromRow) {
  var last = sheet.getLastRow();
  if (last < fromRow) return [];
  return sheet.getRange(fromRow, column, last - fromRow + 1, 1)
    .getValues().map(function (r) { return r[0]; });
}

function metaDefault_(meta, key, value) {
  if (metaRow_(meta, key) === -1) meta.appendRow([key, value]);
}

function metaRow_(meta, key) {
  var keys = columnValues_(meta, 1, 2).map(function (k) { return String(k).trim().toLowerCase(); });
  var idx = keys.indexOf(key);
  return idx === -1 ? -1 : idx + 2;
}

function touchMeta_(stamp) {
  var meta = tab_(SpreadsheetApp.getActiveSpreadsheet(), CONFIG.tabs.meta);
  var row = metaRow_(meta, 'last_updated_et');
  if (row === -1) { meta.appendRow(['last_updated_et', stamp]); return; }
  meta.getRange(row, 2).setValue(stamp);
}

function headerKey_(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Header match first, configured column letter as the fallback. */
function findColumn_(headerKeys, headerText, letter) {
  var want = headerKey_(headerText);
  if (want) {
    var exact = headerKeys.indexOf(want);
    if (exact > -1) return exact;
    for (var i = 0; i < headerKeys.length; i++) {
      if (headerKeys[i] && headerKeys[i].indexOf(want) > -1) return i;
    }
  }
  if (letter) return letter.toUpperCase().charCodeAt(0) - 65;
  return -1;
}

function isClosed_(value) {
  var status = String(value || '').trim().toLowerCase();
  if (!status) return false;
  return CONFIG.runway.closedStatuses.some(function (closed) {
    return status.indexOf(closed) > -1;
  });
}

function toNumber_(value) {
  if (value === '' || value === null || value === undefined) return null;
  if (typeof value === 'number') return isNaN(value) ? null : value;
  var cleaned = String(value).replace(/[$,%\s]/g, '');
  if (cleaned === '' || !/^-?\d*\.?\d+$/.test(cleaned)) return null;
  var n = Number(cleaned);
  return isNaN(n) ? null : n;
}

function normalizeDate_(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]') return etDate_(value);
  var text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  var parsed = new Date(text);
  return isNaN(parsed.getTime()) ? '' : etDate_(parsed);
}

function etDate_(when) {
  return Utilities.formatDate(when, CONFIG.timeZone, 'yyyy-MM-dd');
}

function etStamp_(when) {
  return Utilities.formatDate(when, CONFIG.timeZone, "EEE MMM d '·' h:mm a") + ' ET';
}

function isWeekday_(when) {
  var day = Number(Utilities.formatDate(when, CONFIG.timeZone, 'u')); // 1 Mon .. 7 Sun
  return day >= 1 && day <= 5;
}

function round1_(n) { return Math.round(n * 10) / 10; }
function clamp_(n, min, max) { return Math.min(max, Math.max(min, n)); }
function lower_(s) { return String(s).toLowerCase(); }
