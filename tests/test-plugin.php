<?php
/**
 * Registration and validation tests for the Skybird Projects plugin.
 *
 * Run: php tests/test-plugin.php
 *
 * No PHPUnit — this has to run anywhere PHP does, including a machine with no
 * Composer install. The assertions below are the ones worth having: each maps
 * to a decision recorded in docs/, so a future change that quietly reverses
 * one of them fails here instead of on the live site.
 *
 * @package Skybird_Projects
 */

require_once __DIR__ . '/wp-stubs.php';
require_once dirname( __DIR__ ) . '/plugin/skybird-projects/skybird-projects.php';

$passed = 0;
$failed = array();

/**
 * Assert a condition.
 *
 * @param string $name Test name.
 * @param bool   $cond Condition.
 * @param string $note Optional detail shown on failure.
 */
function it( $name, $cond, $note = '' ) {
	global $passed, $failed;

	if ( $cond ) {
		$passed++;
		return;
	}

	$failed[] = $note ? "$name — $note" : $name;
}

/**
 * Assert equality, reporting both sides on failure.
 *
 * @param string $name     Test name.
 * @param mixed  $expected Expected.
 * @param mixed  $actual   Actual.
 */
function eq( $name, $expected, $actual ) {
	it(
		$name,
		$expected === $actual,
		sprintf( 'expected %s, got %s', var_export( $expected, true ), var_export( $actual, true ) )
	);
}

// The plugin registers on `init`; fire the stubbed hook.
foreach ( $GLOBALS['wp_stub']['actions']['init'] as $callback ) {
	call_user_func( $callback );
}

$stub = $GLOBALS['wp_stub'];

// --- Post type -------------------------------------------------------------

$pt = isset( $stub['post_types']['project'] ) ? $stub['post_types']['project'] : null;

it( 'post type `project` is registered', null !== $pt );

if ( $pt ) {
	// docs/09-euan-answers.md §3.5 — Euan wants a hub per service area, not a
	// global projects archive.
	eq( 'has_archive is false (no global projects hub)', false, $pt['has_archive'] );

	// docs/01-api-audit.md §2.3 — endpoint must be /wp-json/wp/v2/projects.
	eq( 'rest_base is `projects`', 'projects', $pt['rest_base'] );
	eq( 'show_in_rest is true', true, $pt['show_in_rest'] );

	// Without custom-fields support, registered meta never appears in REST and
	// the whole n8n write silently drops every field.
	it( 'supports custom-fields (required for meta in REST)', in_array( 'custom-fields', $pt['supports'], true ) );
	it( 'supports thumbnail (the Showcase Cover photo)', in_array( 'thumbnail', $pt['supports'], true ) );

	eq( 'rewrite slug is `projects`', 'projects', $pt['rewrite']['slug'] );
	eq( 'post type is public', true, $pt['public'] );
}

// --- Taxonomy --------------------------------------------------------------

$tax = isset( $stub['taxonomies']['service_area'] ) ? $stub['taxonomies']['service_area'] : null;

it( 'taxonomy `service_area` is registered', null !== $tax );

if ( $tax ) {
	// A public taxonomy would create /service-area/{slug}/ term archives — a
	// second set of indexable hubs, which is what §3.5 rules out.
	eq( 'taxonomy is not public (no competing term archives)', false, $tax['public'] );
	eq( 'taxonomy is not publicly queryable', false, $tax['publicly_queryable'] );

	// Independent of `public`, and required for n8n to assign the term.
	eq( 'taxonomy is in REST', true, $tax['show_in_rest'] );
	eq( 'taxonomy shows in the admin UI', true, $tax['show_ui'] );
}

// --- Service areas ---------------------------------------------------------

$areas = skybird_projects_service_areas();

eq( 'eight service areas', 8, count( $areas ) );

$slugs = wp_list_pluck_stub( $areas, 'slug' );
sort( $slugs );

eq(
	'the eight expected slugs',
	array( 'franklinton', 'goldsboro', 'greenville', 'knightdale', 'raleigh', 'rolesville', 'wake-forest', 'youngsville' ),
	$slugs
);

// Euan confirmed the -nc form is canonical and the bare form redirects to it.
// Linking to the redirect on every project page would add a hop to the exact
// internal link the SEO structure depends on.
$all_nc = true;
foreach ( $areas as $area ) {
	if ( ! preg_match( '#^/service-areas/[a-z-]+-nc/$#', $area['page'] ) ) {
		$all_nc = false;
	}
}
it( 'every area page path uses the canonical -nc form', $all_nc );

// --- Meta ------------------------------------------------------------------

$expected_meta = array(
	'companycam_project_id',
	'proline_project_id',
	'approx_lat',
	'approx_lng',
	'gallery',
	'ambassador_referral_code',
	'city',
	'neighborhood',
	'zip',
	'manufacturer',
	'product_line',
	'color',
	'warranty',
	'completion_date',
);

foreach ( $expected_meta as $key ) {
	it( "meta `$key` is registered", isset( $stub['post_meta'][ $key ] ) );
}

eq( 'no unexpected meta fields', count( $expected_meta ), count( $stub['post_meta'] ) );

// docs/05-data-model.md §1 — the true coordinates are never written to
// WordPress at all. If the real location isn't stored here it can't leak from
// here. This asserts no one ever adds such a field.
foreach ( array( 'lat', 'lng', 'latitude', 'longitude', 'coordinates', 'address', 'street_address', 'primary_contact', 'customer_name', 'phone', 'email' ) as $forbidden ) {
	it( "no `$forbidden` field exists (PII / true location)", ! isset( $stub['post_meta'][ $forbidden ] ) );
}

if ( isset( $stub['post_meta']['gallery'] ) ) {
	$g = $stub['post_meta']['gallery'];
	eq( 'gallery is single', true, $g['single'] );
	eq( 'gallery type is array', 'array', $g['type'] );
	eq( 'gallery REST schema is an array', 'array', $g['show_in_rest']['schema']['type'] );
	eq( 'gallery REST items are integers', 'integer', $g['show_in_rest']['schema']['items']['type'] );
}

$all_rest = true;
foreach ( $stub['post_meta'] as $key => $args ) {
	if ( empty( $args['show_in_rest'] ) ) {
		$all_rest = false;
	}
	if ( true !== $args['single'] ) {
		$all_rest = false;
	}
}
it( 'every meta field is single and exposed in REST', $all_rest );

// --- Sanitisers: coordinates ----------------------------------------------

// Rejecting 0 implements the review-gate check in docs/06-trigger-design.md §3
// — a 0,0 pin is the signature of an offset step that didn't run.
eq( 'lat 0 is rejected (offset never generated)', '', skybird_projects_sanitize_lat( 0 ) );
eq( 'lat "0" is rejected', '', skybird_projects_sanitize_lat( '0' ) );
eq( 'lat empty stays empty', '', skybird_projects_sanitize_lat( '' ) );
eq( 'lat out of range is rejected', '', skybird_projects_sanitize_lat( 91 ) );
eq( 'valid lat is kept', 36.07117, skybird_projects_sanitize_lat( 36.07117 ) );
eq( 'valid negative lat is kept', -33.5, skybird_projects_sanitize_lat( '-33.5' ) );

eq( 'lng 0 is rejected', '', skybird_projects_sanitize_lng( 0 ) );
eq( 'lng out of range is rejected', '', skybird_projects_sanitize_lng( -181 ) );
eq( 'valid lng is kept', -78.5583, skybird_projects_sanitize_lng( -78.5583 ) );

// --- Sanitisers: gallery ---------------------------------------------------

eq( 'gallery non-array becomes empty', array(), skybird_projects_sanitize_gallery( 'nope' ) );
eq( 'gallery casts and drops junk', array( 4, 7 ), skybird_projects_sanitize_gallery( array( '4', 0, -2, 'x', 7 ) ) );
eq( 'gallery de-duplicates', array( 5, 6 ), skybird_projects_sanitize_gallery( array( 5, 5, 6, 5 ) ) );
eq( 'gallery preserves order (captured_at sequence)', array( 9, 3, 5 ), skybird_projects_sanitize_gallery( array( 9, 3, 5 ) ) );
eq( 'gallery caps at 20', 20, count( skybird_projects_sanitize_gallery( range( 1, 40 ) ) ) );

// --- Sanitisers: referral code --------------------------------------------

// docs/05-data-model.md §5 — 6 chars, no vowels, no 0/O/1/I/L.
eq( 'valid code is kept', 'BCDFGH', skybird_projects_sanitize_code( 'BCDFGH' ) );
eq( 'code is upper-cased', 'BCDFGH', skybird_projects_sanitize_code( 'bcdfgh' ) );
eq( 'code is trimmed', 'BCDFGH', skybird_projects_sanitize_code( '  BCDFGH  ' ) );
eq( 'short code is rejected', '', skybird_projects_sanitize_code( 'BCDF' ) );
eq( 'long code is rejected', '', skybird_projects_sanitize_code( 'BCDFGHJ' ) );
eq( 'code with a vowel is rejected', '', skybird_projects_sanitize_code( 'BCDFGA' ) );
eq( 'code with O is rejected', '', skybird_projects_sanitize_code( 'BCDFGO' ) );
eq( 'code with 0 is rejected', '', skybird_projects_sanitize_code( 'BCDFG0' ) );
eq( 'code with 1 is rejected', '', skybird_projects_sanitize_code( 'BCDFG1' ) );
eq( 'code with L is rejected', '', skybird_projects_sanitize_code( 'BCDFGL' ) );
eq( 'code with a symbol is rejected', '', skybird_projects_sanitize_code( 'BCDF-H' ) );
eq( 'empty code stays empty', '', skybird_projects_sanitize_code( '' ) );

// The charset itself should contain nothing it excludes.
$bad = 0;
foreach ( str_split( SKYBIRD_PROJECTS_CODE_CHARS ) as $c ) {
	if ( false !== strpos( 'AEIOU01OIL', $c ) ) {
		$bad++;
	}
}
eq( 'charset excludes vowels and ambiguous glyphs', 0, $bad );
eq( 'code length constant is 6', 6, SKYBIRD_PROJECTS_CODE_LENGTH );

// --- Sanitisers: zip and date ---------------------------------------------

eq( 'valid zip is kept', '27596', skybird_projects_sanitize_zip( '27596' ) );
eq( 'short zip is rejected', '', skybird_projects_sanitize_zip( '2759' ) );
eq( 'zip+4 is rejected', '', skybird_projects_sanitize_zip( '27596-1234' ) );

eq( 'valid date is kept', '2026-09-10', skybird_projects_sanitize_date( '2026-09-10' ) );
eq( 'unpadded date is rejected', '', skybird_projects_sanitize_date( '2026-9-10' ) );
eq( 'impossible date is rejected', '', skybird_projects_sanitize_date( '2026-02-30' ) );
eq( 'prose is rejected', '', skybird_projects_sanitize_date( 'last Tuesday' ) );

// --- Alt text --------------------------------------------------------------

// With product fields, it reads like the example in docs/07 §2.4.1.
$GLOBALS['wp_fixture']['post_meta'] = array(
	'manufacturer' => 'GAF',
	'product_line' => 'Timberline HDZ',
	'color'        => 'Charcoal',
);
$GLOBALS['wp_fixture']['terms'] = array( (object) array( 'term_id' => 3, 'name' => 'Wake Forest', 'slug' => 'wake-forest' ) );

eq(
	'alt text is built from the ProLine-sourced product fields',
	'New GAF Timberline HDZ shingle roof, Charcoal, Wake Forest NC',
	skybird_projects_image_alt( 1 )
);

// Empty product fields is the live state until the ProLine read path is
// resolved, so the fallback matters more than the happy path right now.
$GLOBALS['wp_fixture']['post_meta'] = array();
$GLOBALS['wp_fixture']['terms'] = array( (object) array( 'term_id' => 8, 'name' => 'Youngsville', 'slug' => 'youngsville' ) );

eq(
	'alt text falls back to a PII-free sentence',
	'Completed roof replacement in Youngsville, NC',
	skybird_projects_image_alt( 1 )
);

$GLOBALS['wp_fixture']['terms'] = array();
eq(
	'alt text survives no area at all',
	'Completed roof replacement by Skybird Roofing',
	skybird_projects_image_alt( 1 )
);

// Whatever the inputs, alt text must never contain homeowner PII. The function
// only reads our own fields, so this asserts the property rather than hoping.
$GLOBALS['wp_fixture']['post_meta'] = array(
	'manufacturer' => 'GAF',
	'product_line' => 'Timberline HDZ',
	'city'         => 'Youngsville',
);
$alt = skybird_projects_image_alt( 1 );
it( 'alt text contains no street number', ! preg_match( '/\d{3,}/', $alt ), $alt );

// --- Share URL -------------------------------------------------------------

$GLOBALS['wp_fixture']['post_meta'] = array();
eq( 'no share URL without a referral code', '', skybird_projects_share_url( 1 ) );

$GLOBALS['wp_fixture']['post_meta'] = array( 'ambassador_referral_code' => 'BCDFGH' );
$share = skybird_projects_share_url( 1 );

it( 'share URL points at Facebook sharer', 0 === strpos( $share, 'https://www.facebook.com/sharer/sharer.php?u=' ) );
it( 'share URL carries the ref parameter', false !== strpos( rawurldecode( $share ), 'ref=BCDFGH' ), $share );
it( 'share URL targets the project page', false !== strpos( rawurldecode( $share ), '/projects/test-project/' ), $share );

// --- Shortcode -------------------------------------------------------------

it( 'map shortcode is registered', isset( $stub['shortcodes']['skybird_project_map'] ) );
eq( 'shortcode tag matches the documented name', 'skybird_project_map', SKYBIRD_PROJECTS_MAP_SHORTCODE );

// A missing area is an editor error, not something a visitor should see.
$GLOBALS['wp_fixture']['caps'] = false;
eq( 'bad shortcode shows visitors nothing', '', skybird_projects_map_shortcode( array( 'area' => '' ) ) );

$GLOBALS['wp_fixture']['caps'] = true;
it(
	'bad shortcode warns an editor',
	false !== strpos( skybird_projects_map_shortcode( array( 'area' => '' ) ), 'No service area set' )
);

// --- REST lookup (idempotency) --------------------------------------------

// project.label_added fires for ANY of the account's eight project labels, so
// the workflow must be able to ask whether a draft already exists before
// creating a second one.
it( 'projects collection accepts companycam_project_id', isset( $GLOBALS['wp_stub']['filters']['rest_project_collection_params'] ) );
it( 'projects query applies the lookup', isset( $GLOBALS['wp_stub']['filters']['rest_project_query'] ) );

$params = skybird_projects_rest_collection_params( array() );
it( 'lookup param is in the endpoint schema', isset( $params['companycam_project_id'] ) );

$args = skybird_projects_rest_query( array(), new Stub_Request( array( 'companycam_project_id' => '110848078' ) ) );
eq( 'lookup builds a meta_query', 1, count( $args['meta_query'] ) );
eq( 'lookup keys on companycam_project_id', 'companycam_project_id', $args['meta_query'][0]['key'] );
eq( 'lookup matches the requested ID', '110848078', $args['meta_query'][0]['value'] );

$untouched = skybird_projects_rest_query( array( 'foo' => 'bar' ), new Stub_Request( array() ) );
eq( 'no lookup param leaves the query alone', array( 'foo' => 'bar' ), $untouched );

// --- Template --------------------------------------------------------------

it( 'template_include filter is attached', isset( $GLOBALS['wp_stub']['filters']['template_include'] ) );
it( 'single template file exists', file_exists( dirname( __DIR__ ) . '/plugin/skybird-projects/templates/single-project.php' ) );

// --- Report ----------------------------------------------------------------

/**
 * Tiny stand-in for wp_list_pluck.
 *
 * @param array  $list  List of arrays.
 * @param string $field Field to pluck.
 * @return array
 */
function wp_list_pluck_stub( $list, $field ) {
	return array_map(
		function ( $item ) use ( $field ) {
			return $item[ $field ];
		},
		$list
	);
}

echo "\n";
printf( "passed: %d\n", $passed );
printf( "failed: %d\n", count( $failed ) );

if ( $failed ) {
	echo "\nFailures:\n";
	foreach ( $failed as $f ) {
		echo "  - $f\n";
	}
	exit( 1 );
}

echo "\nAll assertions passed.\n";
exit( 0 );
