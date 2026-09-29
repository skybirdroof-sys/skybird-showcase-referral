/**
 * Tests for the Code nodes inside n8n/companycam-showcase-to-wordpress.json.
 *
 * Run: node tests/test-workflow.js
 *
 * No framework and no n8n — this reads the workflow JSON, pulls the jsCode out
 * of each Code node and runs it against fixtures shaped like the real
 * CompanyCam and WordPress responses.
 *
 * Why this file exists. The first three failures of the live workflow were all
 * the same mistake in different clothes, and none of them was visible by
 * reading the JSON:
 *
 *   1. "Already Drafted?" returned [] and everything downstream was skipped.
 *      The execution reported SUCCESS having created nothing.
 *   2. "Curate" threw `Node 'Get Cover Photo' hasn't been executed` — two
 *      branches fed its one input, so it fired as soon as the first arrived.
 *   3. Underneath that, `showcase.filter is not a function`.
 *
 * All three follow from one rule that is easy to forget:
 *
 *      An HTTP Request node SPLITS a JSON array response into one item per
 *      element. A five-element array is five items, and `.first().json` is the
 *      first ELEMENT, not the array. An empty array is ZERO items, which n8n
 *      treats as "this node produced nothing" — the rest of the branch is
 *      skipped and the run still reports success.
 *
 * So the emulator below models exactly that, and the assertions pin the
 * behaviour the docs require: no PII leaves Curate, the true coordinates never
 * do either, the pin lands in the 0.2–0.3 mi annulus, and every curation
 * problem throws loudly instead of producing a half-built draft.
 */

const fs = require('fs');
const path = require('path');

const WORKFLOW = path.join(__dirname, '..', 'n8n', 'companycam-showcase-to-wordpress.json');

const workflow = JSON.parse(fs.readFileSync(WORKFLOW, 'utf8'));
const code = {};
for (const node of workflow.nodes) {
  if (node.type === 'n8n-nodes-base.code') {
    code[node.name] = node.parameters.jsCode;
  }
}

// --- the n8n bits that matter -------------------------------------------

/**
 * What an HTTP Request node hands downstream.
 *
 * @param {*} response       Parsed JSON body.
 * @param {boolean} always   The node's "Always Output Data" setting.
 */
function split(response, always) {
  const arr = Array.isArray(response) ? response : [response];
  if (arr.length === 0) {
    // Without alwaysOutputData this is the silent-success trap: zero items,
    // branch skipped, run green.
    return always ? [{ json: {} }] : [];
  }
  return arr.map((json) => ({ json }));
}

/**
 * Run one Code node. `outputs` maps node name -> items; a name that is absent
 * has "not been executed", which is what $() throws on in n8n.
 */
function run(nodeName, outputs) {
  const $ = (name) => {
    if (!(name in outputs)) {
      throw new Error(`Node '${name}' hasn't been executed`);
    }
    return { all: () => outputs[name], first: () => outputs[name][0] };
  };
  const input = outputs.__input || [];
  const $input = { all: () => input, first: () => input[0] };
  // eslint-disable-next-line no-new-func
  return new Function('$', '$input', '"use strict";' + code[nodeName])($, $input);
}

// --- fixtures -------------------------------------------------------------
//
// Invented values in the exact shape of the real responses (shape checked
// against project 110848078 and its photos on 2026-09-28 — the values here are
// not that project's). The contact block is deliberately populated: half these
// tests exist to prove that PII which IS in the input never reaches the
// output, and an empty contact block would prove nothing.

// Every one of these is invented. Nothing real belongs in a fixture, and a
// fixture that carries a real customer's address to prove addresses don't leak
// has already leaked it.
const PII = ['Wexler', 'Fernbrook', 'awexler', '5550147', '+19195550147'];

const PROJECT = {
  id: '110848078',
  company_id: '798255',
  creator_name: 'Jacob Vollmer',
  name: 'Alan Wexler #2561',
  status: 'active',
  archived: false,
  address: {
    street_address_1: '2001 Fernbrook Drive',
    street_address_2: null,
    city: 'Youngsville',
    state: 'NC',
    postal_code: '27596',
    country: 'US',
  },
  // Inside the Youngsville service area, but not anyone's house.
  coordinates: { lat: 36.0311, lon: -78.4762 },
  primary_contact: {
    name: 'Alan Wexler',
    email: 'awexler@example.com',
    phone_number: '+19195550147',
  },
  photo_count: 419,
};

// CompanyCam sends Unix epoch SECONDS, as an integer. The first version of
// this fixture used ISO strings -- taken from an MCP tool that normalises them
// -- and the suite passed while the live run wrote an empty completion_date.
// A fixture in the wrong shape is worse than no fixture: it certifies the bug.
const epoch = (iso) => Math.floor(Date.parse(iso) / 1000);

const photo = (id, capturedAt) => ({
  id,
  company_id: '798255',
  project_id: '110848078',
  creator_name: 'Jacob Vollmer',
  description: null,
  internal: false,
  processing_status: 'processed',
  captured_at: epoch(capturedAt),
  coordinates: { lat: 0, lon: 0 },
  uris: [
    { type: 'original', uri: `https://static.companycam.com/p/${id}.jpeg?d=4032x4032` },
    { type: 'web', uri: `https://static.companycam.com/p/${id}.jpeg?d=400x400` },
    { type: 'thumbnail', uri: `https://static.companycam.com/p/${id}.jpeg?d=250x250` },
  ],
});

// Oldest last, the order CompanyCam returns them in (newest first).
const COVER = photo('3553007383', '2026-09-10T14:12:05Z');
const SHOWCASE = [
  photo('3553086721', '2026-09-10T14:46:54Z'),
  COVER,
  photo('3553007048', '2026-09-10T14:11:43Z'),
  photo('3553006923', '2026-09-10T14:11:35Z'),
];
const AREA_TERM = { id: 37, name: 'Youngsville', slug: 'youngsville', taxonomy: 'service-areas' };

/** The three nodes Curate reads, wired as the workflow wires them. */
const curateInputs = (over) =>
  Object.assign(
    {
      'Get Project': split(PROJECT, false),
      'Get Cover Photo': split([COVER], true),
      'Get Showcase Photos': split(SHOWCASE, true),
    },
    over
  );

/** Great-circle distance in miles. */
function milesBetween(a, b) {
  const R = 3958.8;
  const rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad;
  const dLon = (b[1] - a[1]) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// --- runner ---------------------------------------------------------------

let passed = 0;
const failed = [];

function it(name, fn) {
  try {
    fn();
    passed += 1;
  } catch (e) {
    failed.push(`${name}\n      ${e.message}`);
  }
}

function eq(actual, expected, what) {
  if (actual !== expected) {
    throw new Error(`${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function same(actual, expected, what) {
  eq(JSON.stringify(actual), JSON.stringify(expected), what);
}

function throwsMatching(fn, pattern, what) {
  let message = null;
  try {
    fn();
  } catch (e) {
    message = e.message;
  }
  if (message === null) {
    throw new Error(`${what}: expected a throw, got none`);
  }
  if (!pattern.test(message)) {
    throw new Error(`${what}: threw "${message}"`);
  }
}

// --- wiring ---------------------------------------------------------------
//
// These four assertions are the ones that would have caught the live failure
// before it happened. They check the graph, not the code.

it('Curate has exactly one node feeding it', () => {
  const feeders = [];
  for (const [from, conn] of Object.entries(workflow.connections)) {
    for (const outputs of conn.main || []) {
      for (const link of outputs || []) {
        if (link.node === 'Curate') feeders.push(from);
      }
    }
  }
  // Two feeders on one input is not a join: n8n runs the node as soon as
  // EITHER arrives, and $() on the other branch throws "hasn't been executed".
  same(feeders, ['Get Showcase Photos'], 'nodes feeding Curate');
});

it('the CompanyCam fetches run in series ahead of Curate', () => {
  const targets = (name) =>
    (workflow.connections[name].main[0] || []).map((l) => l.node);
  same(targets('Get Project'), ['Get Cover Photo'], 'after Get Project');
  same(targets('Get Cover Photo'), ['Get Showcase Photos'], 'after Get Cover Photo');
  same(targets('Get Showcase Photos'), ['Curate'], 'after Get Showcase Photos');
});

it('Get Cover Photo runs before Get Showcase Photos, not after', () => {
  // Cover first is deliberate: it returns exactly one item, so the showcase
  // fetch runs once. The other order would fire it once per showcase photo.
  const after = (workflow.connections['Get Cover Photo'].main[0] || []).map((l) => l.node);
  same(after, ['Get Showcase Photos'], 'cover feeds the showcase fetch');
});

it('every node whose response can be an empty array outputs data anyway', () => {
  const byName = Object.fromEntries(workflow.nodes.map((n) => [n.name, n]));
  for (const name of ['Already Drafted?', 'Get Cover Photo', 'Get Showcase Photos', 'Get Area Term']) {
    eq(byName[name].alwaysOutputData, true, `${name} alwaysOutputData`);
  }
});

// --- Curate ---------------------------------------------------------------

it('Curate reads a split array response', () => {
  const out = run('Curate', curateInputs());
  eq(out.length, 1, 'item count');
  const c = out[0].json;
  eq(c.companycamProjectId, '110848078', 'project id');
  eq(c.city, 'Youngsville', 'city');
  eq(c.areaSlug, 'youngsville', 'area slug');
  eq(c.zip, '27596', 'zip');
  eq(c.completionDate, '2026-09-10', 'completion date from the cover');
  eq(c.galleryUrls.length, 3, 'gallery is the showcase set minus the cover');
  eq(c.coverUrl, COVER.uris[0].uri, 'cover url is the original');
});

it('Curate turns an epoch timestamp into a YYYY-MM-DD completion date', () => {
  // String(1789035125).slice(0, 10) is "1789035125", which the plugin's date
  // sanitiser correctly rejects -- so the draft stored nothing and nothing
  // errored. docs/07-phase-4-preflight.md section 16.7.
  const c = run('Curate', curateInputs())[0].json;
  eq(c.completionDate, '2026-09-10', 'completion date');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.completionDate)) {
    throw new Error(`not a date the plugin will accept: ${c.completionDate}`);
  }
});

it('Curate still reads an ISO captured_at, if CompanyCam ever sends one', () => {
  const iso = (p) => Object.assign({}, p, {
    captured_at: new Date(p.captured_at * 1000).toISOString(),
  });
  const c = run('Curate', curateInputs({
    'Get Cover Photo': split([iso(COVER)], true),
    'Get Showcase Photos': split(SHOWCASE.map(iso), true),
  }))[0].json;
  eq(c.completionDate, '2026-09-10', 'completion date from ISO');
  eq(c.galleryUrls.length, 3, 'gallery still built');
});

it('Curate leaves the completion date empty rather than inventing one', () => {
  const undated = Object.assign({}, COVER, { captured_at: null });
  const c = run('Curate', curateInputs({
    'Get Cover Photo': split([undated], true),
    'Get Showcase Photos': split([undated].concat(SHOWCASE.slice(0, 1), SHOWCASE.slice(2)), true),
  }))[0].json;
  eq(c.completionDate, '', 'no date rather than 1970-01-01');
});

it('Curate orders the gallery oldest first', () => {
  const c = run('Curate', curateInputs())[0].json;
  const expected = SHOWCASE.slice()
    .sort((a, b) => a.captured_at - b.captured_at)
    .filter((p) => p.id !== COVER.id)
    .map((p) => p.uris[0].uri);
  same(c.galleryUrls, expected, 'gallery order (before -> during -> after)');
});

it('Curate carries no homeowner data out of CompanyCam', () => {
  const out = JSON.stringify(run('Curate', curateInputs())[0].json);
  for (const needle of PII) {
    if (out.includes(needle)) throw new Error(`PII in Curate output: ${needle}`);
  }
});

it('Curate never passes the true coordinates on', () => {
  const c = run('Curate', curateInputs())[0].json;
  if (c.approxLat === PROJECT.coordinates.lat) throw new Error('real latitude passed through');
  if (c.approxLng === PROJECT.coordinates.lon) throw new Error('real longitude passed through');
  const keys = JSON.stringify(Object.keys(c));
  if (/lat\b|"lon"/.test(keys.replace(/approxLat|approxLng/g, ''))) {
    throw new Error(`unexpected coordinate field: ${keys}`);
  }
});

it('Curate offsets the pin into the 0.2-0.3 mi annulus, every draw', () => {
  // The offset is random, so one run proves nothing. docs/04 §4 requires an
  // annulus rather than a disc precisely so the pin can never land on the house.
  for (let i = 0; i < 2000; i += 1) {
    const c = run('Curate', curateInputs())[0].json;
    const d = milesBetween([PROJECT.coordinates.lat, PROJECT.coordinates.lon], [c.approxLat, c.approxLng]);
    if (d < 0.1995 || d > 0.3005) {
      throw new Error(`draw ${i} landed ${d.toFixed(4)} mi out`);
    }
  }
});

it('Curate spreads the pin around the compass', () => {
  const quadrants = new Set();
  for (let i = 0; i < 400; i += 1) {
    const c = run('Curate', curateInputs())[0].json;
    quadrants.add(
      `${c.approxLat > PROJECT.coordinates.lat}${c.approxLng > PROJECT.coordinates.lon}`
    );
  }
  eq(quadrants.size, 4, 'quadrants used');
});

it('Curate throws when no photo is tagged Showcase Cover', () => {
  throwsMatching(
    () => run('Curate', curateInputs({ 'Get Cover Photo': split([], true) })),
    /no photo tagged "Showcase Cover"/,
    'empty cover response'
  );
});

it('Curate throws when two photos are tagged Showcase Cover', () => {
  throwsMatching(
    () => run('Curate', curateInputs({ 'Get Cover Photo': split([COVER, SHOWCASE[0]], true) })),
    /2 photos tagged "Showcase Cover"/,
    'two covers'
  );
});

it('Curate throws when the Showcase set is nothing but the cover', () => {
  throwsMatching(
    () => run('Curate', curateInputs({ 'Get Showcase Photos': split([COVER], true) })),
    /no gallery photos left/,
    'cover-only showcase set'
  );
});

it('Curate throws when nothing is tagged Showcase at all', () => {
  throwsMatching(
    () => run('Curate', curateInputs({ 'Get Showcase Photos': split([], true) })),
    /no gallery photos left/,
    'empty showcase response'
  );
});

it('Curate throws when the project has no coordinates', () => {
  const noCoords = Object.assign({}, PROJECT, { coordinates: null });
  throwsMatching(
    () => run('Curate', curateInputs({ 'Get Project': split(noCoords, false) })),
    /no coordinates to offset/,
    'missing coordinates'
  );
});

it('Curate drops an internal photo even when it is tagged Showcase', () => {
  const sneaky = Object.assign({}, SHOWCASE[0], { internal: true });
  const set = [sneaky].concat(SHOWCASE.slice(1));
  const c = run('Curate', curateInputs({ 'Get Showcase Photos': split(set, true) }))[0].json;
  eq(c.galleryUrls.length, 2, 'internal photo excluded');
  if (c.galleryUrls.some((u) => u.includes(sneaky.id))) throw new Error('internal photo published');
});

it('Curate drops a photo that is still processing', () => {
  const pending = Object.assign({}, SHOWCASE[0], { processing_status: 'pending' });
  const set = [pending].concat(SHOWCASE.slice(1));
  const c = run('Curate', curateInputs({ 'Get Showcase Photos': split(set, true) }))[0].json;
  eq(c.galleryUrls.length, 2, 'unprocessed photo excluded');
});

it('Curate caps the set it curates at 20 photos', () => {
  // The cap is applied to the Showcase set and the cover is removed after, so
  // a project whose cover falls inside the first 20 yields 19 gallery photos
  // and one whose cover falls outside yields 20. That is what the spec in
  // docs/10-n8n-workflow.md does, and it is pinned here rather than quietly
  // changed. It is academic at Skybird's volumes — the sets run to four
  // photos — but if the gallery is ever meant to be exactly 20, the fix is to
  // drop the cover before slicing, not after.
  const many = [];
  for (let i = 0; i < 40; i += 1) {
    many.push(photo(`99${i}`, `2026-09-10T14:${String(i).padStart(2, '0')}:00Z`));
  }

  // Cover captured at 14:12, i.e. inside the first 20 oldest.
  const inside = run('Curate', curateInputs({ 'Get Showcase Photos': split(many.concat([COVER]), true) }))[0].json;
  eq(inside.galleryUrls.length, 19, 'cover inside the cap');

  // Cover captured last, i.e. outside it.
  const late = Object.assign({}, COVER, { captured_at: '2026-09-10T23:59:00Z' });
  const outside = run('Curate', curateInputs({
    'Get Cover Photo': split([late], true),
    'Get Showcase Photos': split(many.concat([late]), true),
  }))[0].json;
  eq(outside.galleryUrls.length, 20, 'cover outside the cap');
});

// --- Prepare Photo Items --------------------------------------------------

// Lazy, and memoised: computed at the top level, a broken Curate would crash
// the runner with a stack trace instead of reporting failures.
let curatedCache;
const CURATED = () => {
  if (!curatedCache) curatedCache = run('Curate', curateInputs())[0].json;
  return curatedCache;
};

it('Prepare Photo Items puts the cover first', () => {
  const out = run('Prepare Photo Items', { __input: [{ json: CURATED() }] });
  eq(out.length, 4, 'one item per photo');
  eq(out[0].json.isCover, true, 'cover first');
  eq(out.filter((i) => i.json.isCover).length, 1, 'exactly one cover');
});

it('Prepare Photo Items builds filenames from the area and project id', () => {
  const out = run('Prepare Photo Items', { __input: [{ json: CURATED() }] });
  eq(out[0].json.filename, 'skybird-roof-youngsville-110848078-cover.jpeg', 'cover filename');
  eq(out[1].json.filename, 'skybird-roof-youngsville-110848078-1.jpeg', 'first gallery filename');
  eq(out[3].json.filename, 'skybird-roof-youngsville-110848078-3.jpeg', 'last gallery filename');
});

it('Prepare Photo Items keeps the homeowner out of filenames', () => {
  // The CompanyCam project name IS the customer's name, so a filename built
  // from it would publish PII in a URL. docs/06 §3.
  const out = run('Prepare Photo Items', { __input: [{ json: CURATED() }] });
  for (const item of out) {
    for (const needle of PII) {
      if (item.json.filename.toLowerCase().includes(needle.toLowerCase())) {
        throw new Error(`PII in filename: ${item.json.filename}`);
      }
    }
  }
});

// --- Collect Media --------------------------------------------------------

const prepared = () => run('Prepare Photo Items', { __input: [{ json: CURATED() }] });

it('Collect Media splits the cover back out of the uploads', () => {
  const uploads = [4011, 4012, 4013, 4014].map((id) => ({ json: { id } }));
  const out = run('Collect Media', { __input: uploads, 'Prepare Photo Items': prepared() });
  eq(out[0].json.coverId, 4011, 'cover attachment id');
  same(out[0].json.galleryIds, [4012, 4013, 4014], 'gallery attachment ids');
});

it('Collect Media throws when an upload comes back without an id', () => {
  const uploads = [{ json: { id: 4011 } }, { json: { code: 'rest_upload_unknown_error' } }];
  throwsMatching(
    () => run('Collect Media', { __input: uploads, 'Prepare Photo Items': prepared() }),
    /returned no id/,
    'failed upload'
  );
});

// --- Build Payload --------------------------------------------------------

const MEDIA = { coverId: 4011, galleryIds: [4012, 4013, 4014] };
const payloadInputs = (terms) => ({
  Curate: [{ json: CURATED() }],
  'Collect Media': [{ json: MEDIA }],
  'Get Area Term': split(terms, true),
});

it('Build Payload reads the term out of a split array response', () => {
  const p = run('Build Payload', payloadInputs([AREA_TERM]))[0].json;
  eq(p.status, 'draft', 'status');
  eq(p.title, 'Roof Replacement in Youngsville, NC', 'title');
  eq(p.featured_media, 4011, 'featured media');
  same(p['service-areas'], [37], 'service area term');
  eq(p.meta.companycam_project_id, '110848078', 'meta project id');
  eq(p.meta.completion_date, '2026-09-10', 'meta completion date');
  same(p.meta.gallery, [4012, 4013, 4014], 'meta gallery');
  eq(p.meta.approx_lat, CURATED().approxLat, 'meta approx_lat');
  eq(p.meta.approx_lng, CURATED().approxLng, 'meta approx_lng');
});

it('Build Payload never asks WordPress to publish', () => {
  const p = run('Build Payload', payloadInputs([AREA_TERM]))[0].json;
  eq(p.status, 'draft', 'nothing publishes automatically');
});

it('Build Payload writes no homeowner data into the draft', () => {
  const p = JSON.stringify(run('Build Payload', payloadInputs([AREA_TERM]))[0].json);
  for (const needle of PII) {
    if (p.includes(needle)) throw new Error(`PII in the draft payload: ${needle}`);
  }
});

it('Build Payload throws when the city matches no service area', () => {
  throwsMatching(
    () => run('Build Payload', payloadInputs([])),
    /No service_area term for slug "youngsville"/,
    'unmatched area'
  );
});

// --- Check Label ----------------------------------------------------------
//
// The real payload nests two deep: the webhook body has its own `payload`, and
// the project sits inside that. docs/01 §1.3 said the body "matches the
// object"; it does not, and reading it one level shallow sent an empty project
// id into the URL — which looked exactly like a dead API host.

const WEBHOOK_BODY = {
  event_type: 'project.label_added',
  created_at: 1790631381,
  webhook_id: '282006',
  payload: {
    project: { id: '110848078', name: 'Alan Wexler #2561' },
    label: { id: '1360867', value: 'website showcase', display_value: 'Website Showcase' },
  },
};

it('Check Label digs the project id out of the nested payload', () => {
  const out = run('Check Label', { __input: [{ json: { payload: WEBHOOK_BODY } }] });
  eq(out[0].json.projectId, '110848078', 'project id');
  eq(out[0].json.isOurs, true, 'recognised as ours');
  eq(out[0].json.needsLabelFetch, false, 'no label fetch needed');
});

it('Check Label ignores a label that is not Website Showcase', () => {
  const body = JSON.parse(JSON.stringify(WEBHOOK_BODY));
  body.payload.label.value = 'needs invoice';
  body.payload.label.display_value = 'Needs Invoice';
  const out = run('Check Label', { __input: [{ json: { payload: body } }] });
  eq(out[0].json.isOurs, false, 'other labels are not ours');
});

it('Check Label survives a body with no label block', () => {
  const body = JSON.parse(JSON.stringify(WEBHOOK_BODY));
  delete body.payload.label;
  const out = run('Check Label', { __input: [{ json: { payload: body } }] });
  eq(out[0].json.needsLabelFetch, true, 'falls back to fetching the labels');
  eq(out[0].json.projectId, '110848078', 'project id still found');
});

// --- report ---------------------------------------------------------------

console.log(`\n${passed} passed, ${failed.length} failed`);
if (failed.length) {
  for (const f of failed) console.log(`  FAIL  ${f}`);
  process.exit(1);
}
