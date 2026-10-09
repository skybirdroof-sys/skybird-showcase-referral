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

// A hierarchical taxonomy with a partial label set silently falls back to the
// default *category* wording, so the term screen reads "Add Category" /
// "Parent Category". Found on a real install 2026-09-17, invisible to a stub
// that never renders admin copy — so assert the labels exist instead.
if ( $tax ) {
	// Includes the labels nobody thinks to set -- no_terms, filter_by_item,
	// items_list, items_list_navigation, archives, template_name. Those are
	// exactly the ones that were still reading "category" after a first,
	// partial fix, because WordPress fills any omission from the hierarchical
	// (i.e. category) defaults.
	$required_labels = array(
		'name', 'singular_name', 'menu_name', 'all_items', 'edit_item',
		'add_new_item', 'new_item_name', 'parent_item', 'parent_item_colon',
		'search_items', 'not_found', 'update_item', 'view_item',
		'no_terms', 'filter_by_item', 'items_list', 'items_list_navigation',
		'archives', 'template_name', 'item_link', 'item_link_description',
		'back_to_items', 'most_used',
	);

	$missing = array();
	foreach ( $required_labels as $label ) {
		if ( empty( $tax['labels'][ $label ] ) ) {
			$missing[] = $label;
		}
	}
	it( 'taxonomy defines a full label set (no "Add Category" fallback)', empty( $missing ), 'missing: ' . implode( ', ', $missing ) );

	$says_category = false;
	foreach ( $tax['labels'] as $value ) {
		if ( false !== stripos( (string) $value, 'categor' ) ) {
			$says_category = true;
		}
	}
	it( 'no taxonomy label says "category"', ! $says_category );
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
	'storm_date',
	'package',
	'field_notes',
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

// The assertion that was missing when approx_lat/approx_lng were registered as
// `number` with a `default` of ''. WordPress validates a registered meta
// field's default against its own schema; a mismatch drops the field from the
// REST schema entirely and it is never stored. Nothing here caught that,
// because the stub records args without validating them. Found on a real
// install 2026-09-17.
$type_mismatches = array();
foreach ( $stub['post_meta'] as $key => $args ) {
	$type    = $args['type'];
	$default = $args['default'];

	$matches = ( 'array' === $type && is_array( $default ) )
		|| ( 'string' === $type && is_string( $default ) )
		|| ( 'number' === $type && ( is_int( $default ) || is_float( $default ) ) )
		|| ( 'boolean' === $type && is_bool( $default ) )
		|| ( 'integer' === $type && is_int( $default ) );

	if ( ! $matches ) {
		$type_mismatches[] = sprintf( '%s (type %s, default %s)', $key, $type, gettype( $default ) );
	}
}
it( "every meta field's default matches its declared type", empty( $type_mismatches ), implode( '; ', $type_mismatches ) );

// Coordinates specifically must NOT be numeric. A number-typed single meta
// returns 0 when unset, and 0 is the sentinel the sanitiser rejects, so absent
// and invalid would be indistinguishable. See skybird_projects_sanitize_lat().
foreach ( array( 'approx_lat', 'approx_lng' ) as $coord ) {
	eq( "$coord is a plain number", 'number', $stub['post_meta'][ $coord ]['type'] );
	eq( "$coord defaults to 0, matching its type", 0, $stub['post_meta'][ $coord ]['default'] );
}

// Both input shapes must land on the same value. n8n sends a number; a human
// or a different caller might send a numeric string.
eq( 'a numeric lat is kept', 36.074512, skybird_projects_sanitize_lat( 36.074512 ) );
eq( 'a string lat is coerced', 36.074512, skybird_projects_sanitize_lat( '36.074512' ) );
eq( 'a numeric lng is kept', -78.561238, skybird_projects_sanitize_lng( -78.561238 ) );
eq( 'a string lng is coerced', -78.561238, skybird_projects_sanitize_lng( '-78.561238' ) );

// WordPress meta REST does not support union types: WP_REST_Meta_Fields
// resolves the type and does in_array( $type, [six scalar names], true ), so
// an array never matches and the field is skipped from REST entirely --
// silently, and with the same symptom as a default/type mismatch. Assert every
// field declares exactly one scalar type. Found the hard way, 2026-09-17.
$non_scalar = array();
foreach ( $stub['post_meta'] as $key => $args ) {
	if ( ! is_string( $args['type'] ) || ! in_array( $args['type'], array( 'string', 'boolean', 'integer', 'number', 'array', 'object' ), true ) ) {
		$non_scalar[] = $key . ' (' . wp_json_encode( $args['type'] ) . ')';
	}

	if ( isset( $args['show_in_rest']['schema']['type'] ) && ! is_string( $args['show_in_rest']['schema']['type'] ) ) {
		$non_scalar[] = $key . ' REST schema (' . wp_json_encode( $args['show_in_rest']['schema']['type'] ) . ')';
	}
}
it( 'every meta type is a single scalar (no union types)', empty( $non_scalar ), implode( '; ', $non_scalar ) );

// --- Sanitisers: coordinates ----------------------------------------------

// Rejecting 0 implements the review-gate check in docs/06-trigger-design.md §3
// — a 0,0 pin is the signature of an offset step that didn't run.
eq( 'lat 0 is rejected (offset never generated)', 0, skybird_projects_sanitize_lat( 0 ) );
eq( 'lat "0" is rejected', 0, skybird_projects_sanitize_lat( '0' ) );
eq( 'lat empty becomes 0 (not set)', 0, skybird_projects_sanitize_lat( '' ) );
eq( 'lat out of range is rejected', 0, skybird_projects_sanitize_lat( 91 ) );
eq( 'valid lat is kept', 36.07117, skybird_projects_sanitize_lat( 36.07117 ) );
eq( 'valid negative lat is kept', -33.5, skybird_projects_sanitize_lat( '-33.5' ) );

eq( 'lng 0 is rejected', 0, skybird_projects_sanitize_lng( 0 ) );
eq( 'lng out of range is rejected', 0, skybird_projects_sanitize_lng( -181 ) );
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

$template_path = dirname( __DIR__ ) . '/plugin/skybird-projects/templates/single-project.php';
it( 'single template file exists', file_exists( $template_path ) );

// get_header()/get_footer() only work on a CLASSIC theme. On a block theme
// WordPress falls through to the deprecated theme-compat stubs and the page
// renders outside the real site chrome -- quietly, so it reads as a styling
// problem rather than a template one. Found on a real preview 2026-09-17.
// The wrappers in includes/template.php handle both; assert the template uses
// them rather than calling core directly.
$template_src = file_get_contents( $template_path );

it( 'template opens via the theme-aware wrapper', false !== strpos( $template_src, 'skybird_projects_header()' ) );
it( 'template closes via the theme-aware wrapper', false !== strpos( $template_src, 'skybird_projects_footer()' ) );

// Strip comments before looking for a bare call. The first version of this
// assertion matched the word get_header() inside the comment explaining why
// the template does NOT call it -- a test failing on its own documentation.
$code_only = '';
foreach ( token_get_all( $template_src ) as $token ) {
	if ( is_array( $token ) && in_array( $token[0], array( T_COMMENT, T_DOC_COMMENT ), true ) ) {
		continue;
	}
	$code_only .= is_array( $token ) ? $token[1] : $token;
}

it( 'template does not call get_header() directly', false === strpos( $code_only, 'get_header()' ), 'a bare get_header() renders outside the site chrome on a block theme' );
it( 'template does not call get_footer() directly', false === strpos( $code_only, 'get_footer()' ), 'a bare get_footer() renders outside the site chrome on a block theme' );

// The locked SEO title format (docs/06-trigger-design.md §3) is one job, one
// town, roof replacement -- so the H1 always carries both the service and the
// town. A subtitle that also says "Roof replacement in {Area}, NC" just
// restates it. Seen on a real render 2026-09-17; the eyebrow now carries
// where and when instead.
it(
	'no subtitle restating the title',
	false === stripos( $code_only, 'Roof replacement in %s' ),
	'the H1 already says the service and the town'
);

// Each fact once: the completion date belongs to the eyebrow, not also the
// spec list.
$specs_block = substr( $code_only, strpos( $code_only, 'skybird-specs-heading' ) );
it(
	'completion date is not duplicated into the spec list',
	false === strpos( $specs_block, "'Completed'" ),
	'completion date appears in the eyebrow already'
);

// The eyebrow rule, exercised rather than grepped. This defect shipped twice
// off the same assumption, and both times only a rendered page caught it:
// 2026-09-17 the line restated the H1 verbatim; 2026-09-18 the shortened
// version still collapsed to "Youngsville, NC" under "Roof Replacement in
// Youngsville, NC" whenever completion_date was empty. Grepping the template
// could not have caught the second one -- the bug was in what the code
// produced, not in what it said. Hence the extraction to a function.
$GLOBALS['wp_fixture']['terms'] = array( (object) array( 'term_id' => 8, 'name' => 'Youngsville', 'slug' => 'youngsville' ) );

// The real 2026-09-18 case: locked title, no completion date.
$GLOBALS['wp_fixture']['title']     = 'Roof Replacement in Youngsville, NC';
$GLOBALS['wp_fixture']['post_meta'] = array();
eq( 'title already carries the town, no date -> empty eyebrow', '', skybird_projects_meta_line( 1 ) );

// Same title, with a date: the date alone, never the town again.
$GLOBALS['wp_fixture']['post_meta'] = array( 'completion_date' => '2026-09-04' );
eq( 'title carries the town -> date only', 'Completed September 2026', skybird_projects_meta_line( 1 ) );

// An editor rewrote the title and dropped the town: the eyebrow restores it.
$GLOBALS['wp_fixture']['title']     = 'Storm damage repair after the September hail';
eq(
	'title without the town -> town and date',
	'Youngsville, NC ' . chr( 0xC2 ) . chr( 0xB7 ) . ' Completed September 2026',
	skybird_projects_meta_line( 1 )
);

// Case must not decide it -- a lowercased title still contains the town.
$GLOBALS['wp_fixture']['title']     = 'roof replacement in youngsville, nc';
$GLOBALS['wp_fixture']['post_meta'] = array();
eq( 'town match is case-insensitive', '', skybird_projects_meta_line( 1 ) );

// A malformed date must not publish as December 1969. strtotime() returns
// false on junk and date_i18n( 'F Y', false ) renders the epoch quite happily.
$GLOBALS['wp_fixture']['title']     = 'Roof Replacement in Youngsville, NC';
$GLOBALS['wp_fixture']['post_meta'] = array( 'completion_date' => 'not a date' );
eq( 'unparseable completion date is dropped, not rendered as 1969', '', skybird_projects_meta_line( 1 ) );

// No area assigned at all: no crash, no stray ", NC".
$GLOBALS['wp_fixture']['terms']     = array();
$GLOBALS['wp_fixture']['post_meta'] = array( 'completion_date' => '2026-09-04' );
eq( 'no service area -> date only', 'Completed September 2026', skybird_projects_meta_line( 1 ) );

unset( $GLOBALS['wp_fixture']['title'] );
$GLOBALS['wp_fixture']['post_meta'] = array();

// --- Map pin readout -------------------------------------------------------
//
// docs/06-trigger-design.md section 3 asks the reviewer to confirm the pin was
// offset and not defaulted to the true location. Until 2026-09-28 there was no
// screen showing it: the coordinates are machine-written so the ACF group
// omits them, and that same group hides WordPress's native Custom Fields box.
// Reading them off the first real draft needed a REST call from a browser
// console (docs/07-phase-4-preflight.md section 16.7).

skybird_projects_add_pin_meta_box();

it(
	'the pin meta box is registered on the project screen',
	isset( $GLOBALS['wp_stub']['meta_boxes']['skybird-projects-pin'] )
		&& SKYBIRD_PROJECTS_POST_TYPE === $GLOBALS['wp_stub']['meta_boxes']['skybird-projects-pin']['screen']
);

$GLOBALS['wp_fixture']['post_meta'] = array();
$pin = skybird_projects_pin_status( 1 );

it( 'an unset pin reads as missing', 'missing' === $pin['status'] );
it( 'a missing pin says not to publish', false !== stripos( $pin['message'], 'do not publish' ) );

// 0 is the sentinel skybird_projects_sanitize_lat() returns for anything
// unusable, so a rejected value and an absent one are indistinguishable here.
// Both mean there is no pin, which is the only thing the reviewer needs.
$GLOBALS['wp_fixture']['post_meta'] = array( 'approx_lat' => 0, 'approx_lng' => 0 );
it( 'the zero sentinel reads as missing', 'missing' === skybird_projects_pin_status( 1 )['status'] );

$GLOBALS['wp_fixture']['post_meta'] = array( 'approx_lat' => 36.069334, 'approx_lng' => 0 );
it( 'half a pin is no pin', 'missing' === skybird_projects_pin_status( 1 )['status'] );

// The real values from the first draft, 2026-09-28.
$GLOBALS['wp_fixture']['post_meta'] = array( 'approx_lat' => 36.069334, 'approx_lng' => -78.554441 );
$pin = skybird_projects_pin_status( 1 );

it( 'a real offset pin passes', 'ok' === $pin['status'] );
it( 'a passing pin does not claim the offset was verified', false === stripos( $pin['message'], 'offset' ) );

// Latitude and longitude swapped -- the mistake this box exists to catch,
// because the numbers look plausible on their own.
$GLOBALS['wp_fixture']['post_meta'] = array( 'approx_lat' => -78.554441, 'approx_lng' => 36.069334 );
it( 'swapped lat/lng is caught', 'out_of_bounds' === skybird_projects_pin_status( 1 )['status'] );

// A dropped minus sign puts Youngsville in China.
$GLOBALS['wp_fixture']['post_meta'] = array( 'approx_lat' => 36.069334, 'approx_lng' => 78.554441 );
it( 'a dropped minus sign is caught', 'out_of_bounds' === skybird_projects_pin_status( 1 )['status'] );

// Every seeded service area must sit inside the bounds, or the check would
// reject real jobs. Rough centres, good enough for a bounding box.
$area_centres = array(
	'franklinton' => array( 36.1024, -78.4583 ),
	'goldsboro'   => array( 35.3849, -77.9928 ),
	'greenville'  => array( 35.6127, -77.3664 ),
	'knightdale'  => array( 35.7877, -78.4803 ),
	'raleigh'     => array( 35.7796, -78.6382 ),
	'rolesville'  => array( 35.9232, -78.4578 ),
	'wake-forest' => array( 35.9799, -78.5097 ),
	'youngsville' => array( 36.0263, -78.4767 ),
);

$outside = array();
foreach ( $area_centres as $slug => $point ) {
	$GLOBALS['wp_fixture']['post_meta'] = array( 'approx_lat' => $point[0], 'approx_lng' => $point[1] );
	if ( 'ok' !== skybird_projects_pin_status( 1 )['status'] ) {
		$outside[] = $slug;
	}
}

it(
	'all eight service areas fall inside the bounds',
	array() === $outside,
	implode( ', ', $outside )
);

$GLOBALS['wp_fixture']['post_meta'] = array();

// --- Field notes (private meta) --------------------------------------------
//
// field_notes mirrors CompanyCam's Project Description -- the project
// manager's own words -- so the reviewer has real specifics to write from
// (docs/12-project-notes-path.md). It is the one field in this plugin that
// deliberately holds homeowner PII, which makes every assertion below a
// containment check rather than a feature check.

it(
	'field_notes is marked private',
	! empty( skybird_projects_meta_fields()['field_notes']['private'] )
);

// Pinned as an exact set, not a count. A field added with `private` and no
// containment test of its own would otherwise ride in silently — and a field
// that LOSES the flag would too.
$private_fields = array_keys(
	array_filter(
		skybird_projects_meta_fields(),
		function ( $f ) {
			return ! empty( $f['private'] );
		}
	)
);
sort( $private_fields );

it(
	'the private fields are exactly the two we mean',
	array( 'field_notes', 'package' ) === $private_fields,
	'got: ' . implode( ', ', $private_fields ) . ' — a new private field needs its own containment tests'
);

// The package name is a price tier. The page says what is on the roof, never
// what the household spent (docs/12 section 9).
$GLOBALS['wp_fixture']['post_meta'] = array();

it(
	'package is private',
	! empty( skybird_projects_meta_fields()['package']['private'] )
);

it(
	'storm_date is NOT private',
	empty( skybird_projects_meta_fields()['storm_date']['private'] ),
	'the storm date is a published fact about the job'
);

it(
	'storm_date goes through the date sanitiser',
	'skybird_projects_sanitize_date' === skybird_projects_meta_fields()['storm_date']['sanitize'],
	'a free-typed date must not reach the page as "early Sept"'
);

// Sanitiser.
it(
	'notes keep their text',
	"Wasps in the soffit.\nHomeowner made sweet tea." === skybird_projects_sanitize_notes( "Wasps in the soffit.\nHomeowner made sweet tea." )
);

it(
	'notes strip markup',
	false === strpos( skybird_projects_sanitize_notes( 'Found <b>rot</b> under the <script>alert(1)</script>decking' ), '<' ),
	'CompanyCam accepts basic HTML in the description'
);

it(
	'notes are capped at 10000 characters',
	10000 === strlen( skybird_projects_sanitize_notes( str_repeat( 'a', 12000 ) ) )
);

// REST containment. Every field here is show_in_rest so n8n can write, which
// means a PUBLISHED project's meta is world-readable unless something strips
// it. "No template prints it" is not the same as "nobody can read it" -- the
// distinction that put a homeowner's address on a public URL once already
// (docs/07-phase-4-preflight.md section 16.3).
$notes_payload = "Wasps in the soffit. Bill made the crew sweet tea.";

$response_for = function ( $can_edit ) use ( $notes_payload ) {
	$GLOBALS['wp_fixture']['caps'] = $can_edit;
	$response = new WP_REST_Response(
		array(
			'id'   => 1183,
			'meta' => array(
				'field_notes'            => $notes_payload,
				'package'                => 'Bare Bones',
				'storm_date'             => '2026-09-03',
				'city'                   => 'Youngsville',
				'companycam_project_id'  => '110848078',
			),
		)
	);
	return skybird_projects_hide_private_meta( $response, (object) array( 'ID' => 1183 ) )->get_data();
};

$anon_data = $response_for( false );

it( 'a visitor cannot read the notes over REST', ! isset( $anon_data['meta']['field_notes'] ) );
it( 'a visitor cannot read the package tier over REST', ! isset( $anon_data['meta']['package'] ) );
it( 'no trace of the tier name survives', false === strpos( wp_json_encode( $anon_data ), 'Bare Bones' ) );
it( 'the storm date IS public', '2026-09-03' === $anon_data['meta']['storm_date'], 'it is a fact about the job, not about the household' );
it( 'stripping the notes leaves the public fields alone', 'Youngsville' === $anon_data['meta']['city'] );
it(
	'no trace of the notes survives anywhere in the public response',
	false === strpos( wp_json_encode( $anon_data ), 'sweet tea' )
);

$editor_data = $response_for( true );

it( 'an editor can read the notes over REST', $notes_payload === $editor_data['meta']['field_notes'] );

$GLOBALS['wp_fixture']['caps'] = true;

it(
	'the REST filter is attached to the project post type',
	isset( $GLOBALS['wp_stub']['filters'][ 'rest_prepare_' . SKYBIRD_PROJECTS_POST_TYPE ] )
);

// And the front end. $code_only is the template with comments stripped -- a
// bare strpos would otherwise match the word in a comment explaining why the
// template does NOT print it.
it(
	'no template prints the field notes',
	false === strpos( $code_only, 'field_notes' ),
	'the notes are reviewer reference, never page content'
);

it(
	'the ACF form shows the notes read-only',
	false !== strpos(
		file_get_contents( dirname( __DIR__ ) . '/plugin/skybird-projects/includes/acf-fields.php' ),
		"'readonly'     => 1"
	),
	'editing the snapshot here would not write back to CompanyCam'
);

// --- Location metadata in uploads ------------------------------------------
//
// A published project photo carried GPS inside the JPEG, 17.6 ft from the
// homeowner's front door (docs/07-phase-4-preflight.md section 16.9). The
// quarter-mile pin offset, the withheld street address and the meta field the
// plugin refuses to register were all defeated by the image header.
//
// The fixture below is synthetic on purpose: a real photo with real
// coordinates does not belong in this repository either.

/**
 * A 1x1 JPEG (SOI + APP0/JFIF + the rest) with an APP1 segment spliced in.
 *
 * @param string $payload APP1 payload, starting with its identifier.
 * @return string JPEG bytes.
 */
function skybird_test_jpeg_with_app1( $payload ) {
	$jpeg = base64_decode(
		'/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRof'
		. 'Hh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAAB'
		. 'AAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q=='
	);

	$segment = "\xFF\xE1" . pack( 'n', strlen( $payload ) + 2 ) . $payload;

	// After SOI, before APP0 -- so a surviving APP0 proves only APP1 was cut.
	return substr( $jpeg, 0, 2 ) . $segment . substr( $jpeg, 2 );
}

/**
 * An Exif APP1 payload carrying a GPS IFD. Coordinates are invented.
 *
 * @return string
 */
function skybird_test_exif_with_gps() {
	$gps_ifd_offset = 26;
	$lat_offset     = 80;
	$lng_offset     = 104;

	$tiff  = 'II' . pack( 'v', 42 ) . pack( 'V', 8 );
	// IFD0: one entry, the pointer to the GPS IFD.
	$tiff .= pack( 'v', 1 );
	$tiff .= pack( 'v', 0x8825 ) . pack( 'v', 4 ) . pack( 'V', 1 ) . pack( 'V', $gps_ifd_offset );
	$tiff .= pack( 'V', 0 );
	// GPS IFD: ref + value for each of latitude and longitude.
	$tiff .= pack( 'v', 4 );
	$tiff .= pack( 'v', 0x0001 ) . pack( 'v', 2 ) . pack( 'V', 2 ) . "N\x00\x00\x00";
	$tiff .= pack( 'v', 0x0002 ) . pack( 'v', 5 ) . pack( 'V', 3 ) . pack( 'V', $lat_offset );
	$tiff .= pack( 'v', 0x0003 ) . pack( 'v', 2 ) . pack( 'V', 2 ) . "W\x00\x00\x00";
	$tiff .= pack( 'v', 0x0004 ) . pack( 'v', 5 ) . pack( 'V', 3 ) . pack( 'V', $lng_offset );
	$tiff .= pack( 'V', 0 );
	// 35 deg 00' 00" N, 79 deg 00' 00" W -- open country, nobody's house.
	$tiff .= pack( 'VVVVVV', 35, 1, 0, 1, 0, 1 );
	$tiff .= pack( 'VVVVVV', 79, 1, 0, 1, 0, 1 );

	return "Exif\x00\x00" . $tiff;
}

$tmp_dir  = sys_get_temp_dir();
$gps_file = $tmp_dir . '/skybird-test-gps.jpeg';

file_put_contents( $gps_file, skybird_test_jpeg_with_app1( skybird_test_exif_with_gps() ) );

it( 'the fixture really does carry location metadata', skybird_projects_jpeg_has_location( $gps_file ), 'otherwise the strip test proves nothing' );

$before_bytes = file_get_contents( $gps_file );
$stripped     = skybird_projects_strip_jpeg_location( $gps_file );
$after_bytes  = file_get_contents( $gps_file );

it( 'stripping reports that it changed the file', true === $stripped );
it( 'the GPS is gone', ! skybird_projects_jpeg_has_location( $gps_file ) );
it( 'no trace of the coordinates survives', false === strpos( $after_bytes, "Exif\x00\x00" ) );
it( 'the result is still a JPEG', "\xFF\xD8" === substr( $after_bytes, 0, 2 ) );
it( 'the result still decodes', false !== @getimagesize( $gps_file ) );
it( 'the JFIF header is left alone', false !== strpos( $after_bytes, 'JFIF' ), 'only APP1 should be cut' );
it( 'the image data is untouched', substr( $before_bytes, strpos( $before_bytes, "\xFF\xDA" ) ) === substr( $after_bytes, strpos( $after_bytes, "\xFF\xDA" ) ), 'segments are cut out, pixels are never re-encoded' );

// XMP carries its own copy of the coordinates. Drones write both, so removing
// Exif alone would leave the location in the very next segment.
$xmp_file = $tmp_dir . '/skybird-test-xmp.jpeg';
file_put_contents(
	$xmp_file,
	skybird_test_jpeg_with_app1( "http://ns.adobe.com/xap/1.0/\x00<x:xmpmeta><rdf:Description drone-dji:GpsLatitude=\"35.0\"/></x:xmpmeta>" )
);

it( 'XMP counts as location metadata', skybird_projects_jpeg_has_location( $xmp_file ) );
it( 'XMP is stripped too', skybird_projects_strip_jpeg_location( $xmp_file ) && ! skybird_projects_jpeg_has_location( $xmp_file ) );

// An ICC colour profile is APP2 and must survive, or colours shift.
$icc_file = $tmp_dir . '/skybird-test-icc.jpeg';
$icc      = "\xFF\xE2" . pack( 'n', 2 + strlen( "ICC_PROFILE\x00" ) + 4 ) . "ICC_PROFILE\x00" . 'ABCD';
$with_gps = skybird_test_jpeg_with_app1( skybird_test_exif_with_gps() );
file_put_contents( $icc_file, substr( $with_gps, 0, 2 ) . $icc . substr( $with_gps, 2 ) );

skybird_projects_strip_jpeg_location( $icc_file );
$icc_after = file_get_contents( $icc_file );

it( 'an ICC profile survives the strip', false !== strpos( $icc_after, 'ICC_PROFILE' ), 'cutting APP2 would shift the colours' );
it( 'and the GPS still went', ! skybird_projects_jpeg_has_location( $icc_file ) );

// A file with nothing to remove must be left exactly as it was, not rewritten.
$clean_file = $tmp_dir . '/skybird-test-clean.jpeg';
file_put_contents( $clean_file, skybird_test_jpeg_with_app1( "Exif\x00\x00" ) );
skybird_projects_strip_jpeg_location( $clean_file );
$clean_once = file_get_contents( $clean_file );

it( 'stripping twice changes nothing the second time', false === skybird_projects_strip_jpeg_location( $clean_file ) && $clean_once === file_get_contents( $clean_file ) );

// Anything not understood is left alone rather than half-written.
$not_jpeg = $tmp_dir . '/skybird-test-not.jpeg';
file_put_contents( $not_jpeg, 'PK' . str_repeat( 'x', 64 ) );

it( 'a non-JPEG is refused, not mangled', false === skybird_projects_strip_jpeg_location( $not_jpeg ) && 'PK' === substr( file_get_contents( $not_jpeg ), 0, 2 ) );

it(
	'the strip runs on every upload, after WordPress has applied EXIF rotation',
	isset( $GLOBALS['wp_stub']['filters']['wp_generate_attachment_metadata'] ),
	'hooking earlier would strip the orientation tag and land portrait photos sideways'
);

foreach ( array( $gps_file, $xmp_file, $icc_file, $clean_file, $not_jpeg ) as $f ) {
	@unlink( $f );
}

// --- Stylesheet ------------------------------------------------------------
//
// The front end is not otherwise testable here, but one CSS declaration is
// load-bearing: skybirdroofing.net sets `h1 { color: #ffff }` site-wide from
// the theme Customizer, so without an explicit colour the project title
// renders white on white and the page ships with no visible headline
// (docs/07-phase-4-preflight.md section 16.8).

$css = file_get_contents( dirname( __DIR__ ) . '/plugin/skybird-projects/assets/skybird-projects.css' );

// Strip comments FIRST. The rule below is documented with a comment quoting
// the offending `h1 { color: #ffff }`, and a naive match reads that quote as
// the rule's own declarations -- which made the first version of these
// assertions pass with the colour deleted. Caught by reintroducing the bug,
// which is the only reason to bother reintroducing it.
$declarations = preg_replace( '#/\*.*?\*/#s', '', $css );
$title_rule   = '';

if ( preg_match( '/\.skybird-project__title\s*\{([^}]*)\}/s', $declarations, $m ) ) {
	$title_rule = $m[1];
}

it( 'the stylesheet defines a rule for the project title', '' !== $title_rule );

it(
	'the project title sets its own colour',
	(bool) preg_match( '/(^|;)\s*color\s*:/', $title_rule ),
	'without it the site-wide white h1 wins and the headline is invisible'
);

it(
	'the title colour is not white',
	! preg_match( '/color\s*:\s*(#fff|#ffff|#ffffff|white)\s*;?\s*$/im', $title_rule )
);

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
