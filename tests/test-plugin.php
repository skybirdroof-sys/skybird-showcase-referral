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

eq( 'fourteen service areas', 14, count( $areas ) );

$slugs = wp_list_pluck_stub( $areas, 'slug' );
sort( $slugs );

// Five added 2026-10-14. Of 201 completed roofs in Production HQ, 68 were in
// towns with no area to be filed under — a third of the company's own work,
// unpublishable. Goldsboro is 54 jobs on its own and Pikeville and La Grange
// are next door to it.
eq(
	'the fourteen expected slugs',
	array(
		'durham',
		'franklinton',
		'goldsboro',
		'greenville',
		'knightdale',
		'la-grange',
		'pikeville',
		'raleigh',
		'rolesville',
		'wake-forest',
		'wilson',
		'winterville',
		'youngsville',
		'zebulon',
	),
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
	'share_title',
	'share_description',
	'storm_date',
	'package',
	'pending_photos',
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
// reject real jobs. Rough centres, good enough for a bounding box. The list
// is asserted complete below, so adding an area without a centre fails here
// rather than silently going unchecked.
$area_centres = array(
	'franklinton' => array( 36.1024, -78.4583 ),
	'goldsboro'   => array( 35.3849, -77.9928 ),
	'greenville'  => array( 35.6127, -77.3664 ),
	'knightdale'  => array( 35.7877, -78.4803 ),
	'raleigh'     => array( 35.7796, -78.6382 ),
	'rolesville'  => array( 35.9232, -78.4578 ),
	'wake-forest' => array( 35.9799, -78.5097 ),
	'youngsville' => array( 36.0263, -78.4767 ),
	'pikeville'   => array( 35.4985, -77.9803 ),
	'wilson'      => array( 35.7213, -77.9155 ),
	'la-grange'   => array( 35.3085, -77.7889 ),
	'winterville' => array( 35.5293, -77.4005 ),
	'durham'      => array( 35.9940, -78.8986 ),
	'zebulon'     => array( 35.8266, -78.3139 ),
);

$outside = array();
foreach ( $area_centres as $slug => $point ) {
	$GLOBALS['wp_fixture']['post_meta'] = array( 'approx_lat' => $point[0], 'approx_lng' => $point[1] );
	if ( 'ok' !== skybird_projects_pin_status( 1 )['status'] ) {
		$outside[] = $slug;
	}
}

it(
	'all fourteen service areas fall inside the bounds',
	array() === $outside,
	implode( ', ', $outside )
);

$area_slugs = wp_list_pluck_stub( skybird_projects_service_areas(), 'slug' );
sort( $area_slugs );
$centre_slugs = array_keys( $area_centres );
sort( $centre_slugs );

it(
	'every service area has a centre to check',
	$area_slugs === $centre_slugs,
	'a new area without one would go unchecked'
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
	'the private fields are exactly the four we mean',
	array( 'field_notes', 'package', 'pending_photos', 'storm_date' ) === $private_fields,
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
	'storm_date is private',
	! empty( skybird_projects_meta_fields()['storm_date']['private'] ),
	'a page the homeowner shares must not announce that they filed a claim (docs/13 §1)'
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
it( 'a visitor cannot read the storm date over REST', ! isset( $anon_data['meta']['storm_date'] ) );
it(
	'no trace of the storm date survives',
	false === strpos( wp_json_encode( $anon_data ), '2026-09-03' ),
	'the date itself identifies the claim even without the word "hail"'
);
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

// --- Product vocabulary ----------------------------------------------------
//
// Every value below is one that actually appears in Production HQ across 201
// completed roofs. The point of this block is that guessing at any of it
// would have published something false.

// Not every roof is GAF. Four jobs are CertainTeed or IKO, and deriving the
// manufacturer from "there is a shingle line" would have named GAF on all of
// them — next to a Master Elite certification claim.
$shingle = function ( $line ) {
	return skybird_projects_resolve_shingle( $line );
};

it( 'HDZ resolves to GAF Timberline HDZ', array( 'manufacturer' => 'GAF', 'product_line' => 'Timberline HDZ' ) === $shingle( 'HDZ' ) );
it( 'UHDZ resolves to GAF Timberline UHDZ', 'Timberline UHDZ' === $shingle( 'UHDZ' )['product_line'] );

// NS is Natural Shadow. Confirmed by Jacob, not inferred from the initials.
it( 'NS resolves to Timberline Natural Shadow', 'Timberline Natural Shadow' === $shingle( 'NS' )['product_line'] );

it( 'CT Landmark is CertainTeed, not GAF', 'CertainTeed' === $shingle( 'CT Landmark' )['manufacturer'] );
it( 'CT Grand Manor is CertainTeed', 'Grand Manor' === $shingle( 'CT Grand Manor' )['product_line'] );
it( 'IKO Cambridge is IKO', 'IKO' === $shingle( 'IKO Cambridge' )['manufacturer'] );

it( 'case and padding do not matter', 'GAF' === $shingle( '  hdz ' )['manufacturer'] );

it(
	'an unknown line names no manufacturer at all',
	array( 'manufacturer' => '', 'product_line' => '' ) === $shingle( 'Owens Corning Duration' ),
	'an empty field is visible to the reviewer; a plausible wrong one is not'
);

it( 'an empty line names nothing', '' === $shingle( '' )['manufacturer'] );

// Colours. Normalise the certain cases, pass everything else through.
it( 'the British spelling becomes the manufacturer\'s', 'Pewter Gray' === skybird_projects_normalize_color( 'Pewter Grey' ) );
it( 'the typo in the sheet is fixed', 'Charcoal' === skybird_projects_normalize_color( 'Charoal' ) );
it( 'a correct colour is untouched', 'Weathered Wood' === skybird_projects_normalize_color( 'Weathered Wood' ) );
it( 'shouting is tidied', 'Charcoal' === skybird_projects_normalize_color( 'CHARCOAL' ) );
it( 'lower case is tidied', 'Barkwood' === skybird_projects_normalize_color( 'barkwood' ) );
it( 'whitespace is collapsed', 'Hunter Green' === skybird_projects_normalize_color( '  Hunter   Green ' ) );
it( 'empty stays empty', '' === skybird_projects_normalize_color( '' ) );

it(
	'an unfamiliar colour is passed through, not corrected',
	'Golden Harvest' === skybird_projects_normalize_color( 'Golden Harvest' ),
	'a wrong correction reads perfectly well and is false'
);

it(
	'the correction list stays short',
	count( skybird_projects_color_corrections() ) <= 8,
	'every entry is a judgement that the intended value is not in doubt'
);

// Towns. "WF" is on 21 rows and the service-area lookup matches on slug, so
// an unexpanded abbreviation fails to file 21 jobs.
it( 'WF expands to Wake Forest', 'Wake Forest' === skybird_projects_normalize_town( 'WF' ) );
it( 'the Goldsboro typo is fixed', 'Goldsboro' === skybird_projects_normalize_town( 'Goldboro' ) );
it( 'the Youngsville typo is fixed', 'Youngsville' === skybird_projects_normalize_town( 'Younsgville' ) );
it( 'a normal town is untouched', 'Pikeville' === skybird_projects_normalize_town( 'Pikeville' ) );

// And the thing that makes the backlog work: every normalised town that
// appears more than twice in the real data must resolve to a seeded area.
$area_lookup = array();
foreach ( skybird_projects_service_areas() as $a ) {
	$area_lookup[ $a['slug'] ] = true;
}

$real_towns = array(
	'Goldsboro', 'WF', 'Raleigh', 'Pikeville', 'Wilson', 'Youngsville',
	'Knightdale', 'La Grange', 'Wake Forest', 'Greenville', 'Winterville',
	'Durham', 'Rolesville', 'Franklinton', 'Zebulon',
);

$unfiled = array();
foreach ( $real_towns as $town ) {
	$slug = sanitize_title( skybird_projects_normalize_town( $town ) );
	if ( ! isset( $area_lookup[ $slug ] ) ) {
		$unfiled[] = $town;
	}
}

it(
	'every town with real volume has somewhere to be filed',
	array() === $unfiled,
	'unfiled: ' . implode( ', ', $unfiled )
);

// --- Candidate photo URLs (the upload gate) --------------------------------
//
// pending_photos holds CompanyCam URLs that WordPress will fetch SERVER-SIDE
// when a reviewer approves them. That makes this sanitiser a security control,
// not a tidiness one: anything that can write the field can make the site
// issue a request, and without a host check that is server-side request
// forgery.

$urls = function ( $in ) {
	return skybird_projects_sanitize_photo_urls( $in );
};

$good = 'https://static.companycam.com/lambda/projects/110848078/photos/abc.jpeg';

it( 'a real CompanyCam photo URL is kept', array( $good ) === $urls( array( $good ) ) );

it(
	'a second CompanyCam host is kept',
	array( 'https://img.companycam.com/x.jpeg' ) === $urls( array( 'https://img.companycam.com/x.jpeg' ) )
);

it( 'the bare domain is kept', array( 'https://companycam.com/a.jpg' ) === $urls( array( 'https://companycam.com/a.jpg' ) ) );

// --- The SSRF cases --------------------------------------------------------

it(
	'the AWS metadata endpoint is refused',
	array() === $urls( array( 'http://169.254.169.254/latest/meta-data/iam/security-credentials/' ) ),
	'the classic server-side request forgery target'
);

it( 'localhost is refused', array() === $urls( array( 'https://127.0.0.1/admin' ) ) );
it( 'an internal host is refused', array() === $urls( array( 'https://intranet.local/secrets' ) ) );
it( 'file:// is refused', array() === $urls( array( 'file:///etc/passwd' ) ) );
it( 'plain http is refused even on CompanyCam', array() === $urls( array( 'http://static.companycam.com/a.jpeg' ) ) );

// The suffix trap. str_ends_with( $host, 'companycam.com' ) would accept this,
// and it is somebody else's domain entirely.
it(
	'a lookalike domain is refused',
	array() === $urls( array( 'https://evil-companycam.com/a.jpeg' ) ),
	'suffix matching without the dot accepts an attacker-registered domain'
);

it(
	'a subdomain-prefixed lookalike is refused',
	array() === $urls( array( 'https://companycam.com.attacker.net/a.jpeg' ) )
);

it( 'case in the host does not defeat the check', array() === $urls( array( 'https://EVIL-COMPANYCAM.COM/a.jpeg' ) ) );

it(
	'an uppercase CompanyCam host is still accepted',
	1 === count( $urls( array( 'https://STATIC.COMPANYCAM.COM/a.jpeg' ) ) )
);

// --- Shape -----------------------------------------------------------------

it( 'a non-array is dropped', array() === $urls( 'https://static.companycam.com/a.jpeg' ) );
it( 'duplicates collapse', 1 === count( $urls( array( $good, $good ) ) ) );

$many = array();
for ( $i = 0; $i < 40; $i++ ) {
	$many[] = "https://static.companycam.com/p/$i.jpeg";
}
it( 'the list is capped at 20', 20 === count( $urls( $many ) ), 'a runaway list is a runaway number of server-side fetches' );

it(
	'a mixed list keeps only the safe entries',
	array( $good ) === $urls( array( 'http://169.254.169.254/', $good, 'file:///etc/passwd', '' ) )
);

// And containment: the candidate set is unreviewed, so a visitor must not be
// able to read the photos the reviewer is about to reject.
it(
	'pending_photos is private',
	! empty( skybird_projects_meta_fields()['pending_photos']['private'] )
);

// --- The approval gate -----------------------------------------------------
//
// The intersection is the security control. A reviewer's browser posts back
// the ticked photos, and a POST body is attacker-controlled — so the question
// is not "is this URL well-formed", it is "did WE offer this URL". Sanitising
// alone would still let somebody post a different CompanyCam URL and have the
// site fetch it server-side.

$offered = array(
	'https://static.companycam.com/p/one.jpeg',
	'https://static.companycam.com/p/two.jpeg',
	'https://static.companycam.com/p/three.jpeg',
);

it(
	'a ticked photo we offered is approved',
	array( $offered[1] ) === skybird_projects_approved_photo_urls( array( $offered[1] ), $offered )
);

it(
	'a CompanyCam URL we never offered is refused',
	array() === skybird_projects_approved_photo_urls(
		array( 'https://static.companycam.com/p/someone-elses-job.jpeg' ),
		$offered
	),
	'passing the sanitiser is not the same as being a candidate'
);

it(
	'an off-site URL is refused twice over',
	array() === skybird_projects_approved_photo_urls( array( 'http://169.254.169.254/' ), $offered )
);

it(
	'approval order follows the curated order, not the submission',
	array( $offered[0], $offered[2] ) === skybird_projects_approved_photo_urls(
		array( $offered[2], $offered[0] ),
		$offered
	),
	'the gallery must stay oldest-first however the form serialises'
);

it(
	'ticking nothing approves nothing',
	array() === skybird_projects_approved_photo_urls( array(), $offered )
);

it( 'a non-array submission approves nothing', array() === skybird_projects_approved_photo_urls( 'everything', $offered ) );
it( 'with no candidates, nothing can be approved', array() === skybird_projects_approved_photo_urls( $offered, array() ) );
it( 'duplicates in the submission collapse', 1 === count( skybird_projects_approved_photo_urls( array( $offered[0], $offered[0] ), $offered ) ) );

// Reading the waiting list re-sanitises rather than trusting storage: the
// field is written over REST, and the value that matters is the one at the
// moment we act on it.
$GLOBALS['wp_fixture']['post_meta'] = array(
	'pending_photos' => array( $offered[0], 'http://169.254.169.254/', 'file:///etc/passwd' ),
);

it(
	'the waiting list is re-sanitised on read',
	array( $offered[0] ) === skybird_projects_pending_photos( 1 ),
	'a poisoned stored value must not become a server-side fetch'
);

$GLOBALS['wp_fixture']['post_meta'] = array();
it( 'no stored value means nothing waiting', array() === skybird_projects_pending_photos( 1 ) );

skybird_projects_add_photo_gate();

it(
	'the gate is registered on the project screen',
	isset( $GLOBALS['wp_stub']['meta_boxes']['skybird-projects-photo-gate'] )
);

it(
	'approval is an explicit action, not a side effect of saving',
	isset( $GLOBALS['wp_stub']['actions']['admin_post_skybird_approve_photos'] ),
	'importing on save_post would fire on an autosave'
);

// The import must go through WordPress's own sideload path, because that is
// what runs wp_generate_attachment_metadata and therefore the EXIF stripper.
// A hand-rolled download straight into uploads/ would put the coordinates back
// (docs/07 §16.9).
$gate_src = file_get_contents( dirname( __DIR__ ) . '/plugin/skybird-projects/includes/photo-gate.php' );

it(
	'photos are imported via media_handle_sideload',
	false !== strpos( $gate_src, 'media_handle_sideload' ),
	'anything else bypasses the EXIF stripper'
);

it(
	'the gate never writes to uploads directly',
	false === strpos( $gate_src, 'wp_upload_dir' ) && false === strpos( $gate_src, 'file_put_contents' )
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


// --- Photo captions and per-photo alt text ---------------------------------
//
// Before this existed the template called skybird_projects_image_alt( $post_id )
// once per image, so every photo on the page carried one identical alt
// attribute. Six photos, six identical announcements, no information.

$GLOBALS['wp_fixture']['post_meta']       = array();
$GLOBALS['wp_fixture']['post_meta_by_id'] = array();
$GLOBALS['wp_fixture']['post_fields']     = array();
$GLOBALS['wp_fixture']['thumbnail_id']    = 0;

// Sanitiser.
eq(
	'a caption keeps its text',
	'New ridge vent along the full ridge line',
	skybird_projects_sanitize_caption( 'New ridge vent along the full ridge line' )
);

eq(
	'a caption collapses whitespace',
	'Step flashing at the dormer',
	skybird_projects_sanitize_caption( "  Step flashing\n\n   at the dormer  " )
);

it(
	'a caption strips markup',
	false === strpos( skybird_projects_sanitize_caption( 'Ridge <script>alert(1)</script>vent' ), '<' )
);

eq(
	'a caption is capped at 160 characters',
	160,
	strlen( skybird_projects_sanitize_caption( str_repeat( 'a', 300 ) ) )
);

eq( 'an empty caption stays empty', '', skybird_projects_sanitize_caption( '   ' ) );

// The alt fallback chain, per photo.
$GLOBALS['wp_fixture']['post_meta'] = array(
	'manufacturer' => 'GAF',
	'product_line' => 'Timberline HDZ',
	'color'        => 'Charcoal',
	'city'         => 'Youngsville',
);

$GLOBALS['wp_fixture']['post_fields'] = array(
	501 => array( 'post_excerpt' => 'New ridge vent along the full ridge line' ),
	502 => array( 'post_excerpt' => '' ),
	503 => array( 'post_excerpt' => 'Step flashing where the roof meets the dormer' ),
	504 => array( 'post_excerpt' => 'Copper accents over the bay window' ),
);

$GLOBALS['wp_fixture']['post_meta_by_id'] = array(
	503 => array( '_wp_attachment_image_alt' => 'Freshly installed step flashing' ),
);

eq(
	'a captioned photo uses its caption as alt text',
	'New ridge vent along the full ridge line',
	skybird_projects_photo_alt( 501, 1183 )
);

eq(
	'an uncaptioned photo falls back to the generated project alt',
	skybird_projects_image_alt( 1183 ),
	skybird_projects_photo_alt( 502, 1183 )
);

eq(
	'an explicit attachment alt wins over the caption',
	'Freshly installed step flashing',
	skybird_projects_photo_alt( 503, 1183 )
);

// 501 and 504 differ ONLY by caption -- neither has an explicit attachment
// alt. Comparing 501 against 503 would pass even with the caption step ripped
// out of the chain, because 503 has an explicit alt that would still differ.
// Verified by removing that step and watching this fail.
it(
	'two captioned photos on one project get different alt text',
	skybird_projects_photo_alt( 501, 1183 ) !== skybird_projects_photo_alt( 504, 1183 ),
	'the whole point: identical alt on every image is what this replaced'
);

// Which photos belong to a project.
$GLOBALS['wp_fixture']['thumbnail_id'] = 501;
$GLOBALS['wp_fixture']['post_meta']['gallery'] = array( 502, 503 );

eq(
	'the cover comes first, then the gallery',
	array( 501, 502, 503 ),
	skybird_projects_project_photo_ids( 1183 )
);

// A cover that is also listed in the gallery would otherwise be captioned
// twice in the box and scanned twice by the copy guard.
$GLOBALS['wp_fixture']['post_meta']['gallery'] = array( 501, 502, 503 );

eq(
	'a cover duplicated in the gallery appears once',
	array( 501, 502, 503 ),
	skybird_projects_project_photo_ids( 1183 )
);

$GLOBALS['wp_fixture']['post_meta']['gallery'] = array( 502, 503 );

// --- The copy guard --------------------------------------------------------
//
// docs/13-page-definition.md §5 guard 4. Claim language is a CLAUDE.md hard
// rule, and the storm_date field being private closes only the automated
// route -- this closes the hand-typed one.

$claim_cases = array(
	'hail'            => 'The hail damage was extensive.',
	'insurance'       => 'We worked with the insurance company throughout.',
	'claim'           => 'The claim was approved in two weeks.',
	'adjuster'        => 'The adjuster met us on site.',
	'deductible'      => 'The homeowner paid only their deductible.',
	'storm season'    => 'Just in time for storm season.',
	'storm damage'    => 'Significant storm damage to the north slope.',
);

foreach ( $claim_cases as $label => $sentence ) {
	$labels = wp_list_pluck_stub( skybird_projects_copy_warnings( $sentence ), 'label' );
	it( "the copy guard flags `$label`", in_array( $label, $labels, true ), 'got: ' . implode( ', ', $labels ) );
}

// "hail" has to catch the forms a person actually types.
foreach ( array( 'hailstorm', 'hailstones', 'Hail' ) as $variant ) {
	$labels = wp_list_pluck_stub( skybird_projects_copy_warnings( "Damage from $variant." ), 'label' );
	it( "the copy guard flags `$variant`", in_array( 'hail', $labels, true ) );
}

// Boilerplate and urgency.
$boiler_cases = array(
	'stunning'          => 'A stunning result.',
	'transformation'    => 'What a transformation.',
	'peace of mind'     => 'Real peace of mind for the family.',
	'#1'               => 'The #1 roofer in Wake County.',
	'a dollar figure'   => 'The job came to $18,400.',
	'years in business' => 'Over 40 years in business.',
	'a star rating'     => 'Rated 5 stars by our customers.',
	'free roof'        => 'Ask about a free roof.',
);

foreach ( $boiler_cases as $label => $sentence ) {
	$labels = wp_list_pluck_stub( skybird_projects_copy_warnings( $sentence ), 'label' );
	it( "the copy guard flags `$label`", in_array( $label, $labels, true ), 'got: ' . implode( ', ', $labels ) );
}

// Curly apostrophes. WordPress runs wptexturize() on post content, so a typed
// `don't` is stored and re-read as `don\xE2\x80\x99t`. A scan written against the
// straight apostrophe passes every contraction in the list -- and passes for
// the wrong reason, which is the exact failure mode this suite has had twice.
$curly = "Don\xE2\x80\x99t wait \xE2\x80\x94 call us before it\xE2\x80\x99s too late.";
$labels = wp_list_pluck_stub( skybird_projects_copy_warnings( $curly ), 'label' );
it( "the copy guard flags `don't wait` through a curly apostrophe", in_array( "don't wait", $labels, true ), 'got: ' . implode( ', ', $labels ) );
it( "the copy guard flags `before it's too late` through a curly apostrophe", in_array( "before it's too late", $labels, true ) );

// A phrase broken by markup still matches -- the editor emits <em> and <strong>
// inside sentences, and a scan of the raw HTML would miss it.
$labels = wp_list_pluck_stub( skybird_projects_copy_warnings( 'A <em>stunning</em> job.' ), 'label' );
it( 'the copy guard sees through inline markup', in_array( 'stunning', $labels, true ) );

// Clean copy, and it has to be genuinely clean -- a guard that flags ordinary
// roofing sentences gets switched off.
$clean = array(
	'We replaced the full roof deck on the north slope and matched the new drip edge to the existing gutters.',
	'New ridge vent along the full ridge line.',
	'Copper accents over the bay window, fabricated on site.',
	'Charcoal Timberline HDZ, with the valleys rebuilt.',
);

foreach ( $clean as $i => $sentence ) {
	$found = skybird_projects_copy_warnings( $sentence );
	it(
		"clean copy passes the guard (#$i)",
		array() === $found,
		'flagged: ' . implode( ', ', wp_list_pluck_stub( $found, 'label' ) )
	);
}

eq( 'empty copy raises nothing', array(), skybird_projects_copy_warnings( '' ) );

// Each warning carries the reason, because a warning that only says "banned
// phrase" gets overridden and one that says why gets fixed.
$warning = skybird_projects_copy_warnings( 'The hail damage was extensive.' );
it( 'a warning explains itself', isset( $warning[0]['why'] ) && strlen( $warning[0]['why'] ) > 30 );

// Repeats collapse: one mention of a phrase and five are the same fix.
$labels = wp_list_pluck_stub( skybird_projects_copy_warnings( 'Hail, hail and more hail.' ), 'label' );
eq( 'a phrase repeated is reported once', array( 'hail' ), $labels );

// The guard scans what a human typed, and nothing read from the job record.
// "Peace of Mind" is banned as copy AND is the real name of one of the three
// packages. The package is private and never rendered, so there is no live
// conflict -- this pins the boundary, because the moment the scan polices
// record data, somebody edits the record to satisfy it.
$GLOBALS['wp_fixture']['title'] = 'Roof Replacement in Youngsville, NC';
$GLOBALS['wp_fixture']['post_fields'][1183] = array(
	'post_content' => '<p>We rebuilt both valleys and matched the drip edge to the existing gutters.</p>',
);
$GLOBALS['wp_fixture']['post_meta']['warranty'] = 'Golden Pledge';
$GLOBALS['wp_fixture']['post_meta']['package']  = 'Peace of Mind';

$project_warnings = skybird_projects_project_copy_warnings( 1183 );

eq(
	'a clean project raises nothing, with a Peace of Mind package on file',
	array(),
	$project_warnings
);

// And it does scan the captions, which are the public free text this gate
// newly accepts from a human.
$GLOBALS['wp_fixture']['post_fields'][502] = array( 'post_excerpt' => 'Replaced after the hail claim was approved.' );

$project_warnings = skybird_projects_project_copy_warnings( 1183 );
$labels           = wp_list_pluck_stub( $project_warnings, 'label' );

it( 'the project scan reaches photo captions', in_array( 'hail', $labels, true ), 'got: ' . implode( ', ', $labels ) );
it( 'a caption warning says which photo', isset( $project_warnings[0]['where'] ) && false !== strpos( $project_warnings[0]['where'], '502' ), 'got: ' . ( isset( $project_warnings[0]['where'] ) ? $project_warnings[0]['where'] : 'nothing' ) );

$GLOBALS['wp_fixture']['post_fields'][502] = array( 'post_excerpt' => '' );

// --- The captions meta box -------------------------------------------------

// Registered on add_meta_boxes, which the stub records but never fires.
skybird_projects_add_captions_box();

it(
	'the captions box is registered on the project screen',
	isset( $GLOBALS['wp_stub']['meta_boxes']['skybird-projects-captions'] )
);

eq(
	'the captions box is registered against the project post type',
	'project',
	$GLOBALS['wp_stub']['meta_boxes']['skybird-projects-captions']['screen']
);


// --- Open Graph / the link preview ----------------------------------------
//
// Without these tags Facebook "uses internal heuristics to make a best guess
// about the title, description, and preview image" (Meta, via
// docs/vendor/reviews/grok-page-definition-2026-10-15.md [M-WM]). On a page
// full of photos of one house, that guess could be the photo with the house
// number in it.

// The crop has to exist, at the dimensions Meta is told about.
$share_size = isset( $GLOBALS['wp_stub']['image_sizes']['skybird-share'] )
	? $GLOBALS['wp_stub']['image_sizes']['skybird-share']
	: null;

it( 'the 1200x630 share crop is registered', null !== $share_size );

if ( $share_size ) {
	eq( 'the share crop is 1200 wide', 1200, $share_size['width'] );
	eq( 'the share crop is 630 tall', 630, $share_size['height'] );
	it(
		'the share crop is a hard crop',
		true === $share_size['crop'],
		'a soft resize gives 1200x900 and lets Facebook choose its own crop'
	);
}

// og:url must be undecorated. Meta: "without session variables, user
// identifying parameters, or counters" [M-WM]. The referral code is a user
// identifying parameter, and this is the tag it must never reach.
$GLOBALS['wp_fixture']['permalink'] = 'https://skybirdroofing.net/projects/youngsville-charcoal/?ref=ABC123&utm_source=fb#gallery';

eq(
	'og:url strips the referral code and everything else',
	'https://skybirdroofing.net/projects/youngsville-charcoal/',
	skybird_projects_canonical_url( 1183 )
);

$GLOBALS['wp_fixture']['permalink'] = 'https://skybirdroofing.net/projects/youngsville-charcoal/';

eq(
	'a clean permalink passes through untouched',
	'https://skybirdroofing.net/projects/youngsville-charcoal/',
	skybird_projects_canonical_url( 1183 )
);

// Under WordPress's "Plain" permalink setting the query string IS the address.
// Stripping it would point every project's og:url at the homepage, so every
// page would share one preview and Meta would treat them as one resource
// [M-CANON]. Found by breaking the stripper and reading what it actually does.
$GLOBALS['wp_fixture']['permalink'] = 'https://skybirdroofing.net/?post_type=project&p=1183';

eq(
	'plain permalinks keep the query string that identifies the post',
	'https://skybirdroofing.net/?post_type=project&p=1183',
	skybird_projects_canonical_url( 1183 )
);

$GLOBALS['wp_fixture']['permalink'] = 'https://skybirdroofing.net/?post_type=project&p=1183#gallery';

eq(
	'and the fragment still goes',
	'https://skybirdroofing.net/?post_type=project&p=1183',
	skybird_projects_canonical_url( 1183 )
);

$GLOBALS['wp_fixture']['permalink'] = 'https://skybirdroofing.net/projects/youngsville-charcoal/';

// Titles.
$GLOBALS['wp_fixture']['title'] = 'GAF Timberline HDZ Roof Replacement in Youngsville, NC';
$GLOBALS['wp_fixture']['post_meta']['share_title'] = '';

eq(
	'with no share title the SEO title is used',
	'GAF Timberline HDZ Roof Replacement in Youngsville, NC',
	skybird_projects_og_title( 1183 )
);

$GLOBALS['wp_fixture']['post_meta']['share_title'] = 'A new Charcoal roof for a two-story Youngsville home';

eq(
	'a human share title wins',
	'A new Charcoal roof for a two-story Youngsville home',
	skybird_projects_og_title( 1183 )
);

$GLOBALS['wp_fixture']['post_meta']['share_title'] = '   ';

it(
	'a share title of only whitespace does not win',
	'GAF Timberline HDZ Roof Replacement in Youngsville, NC' === skybird_projects_og_title( 1183 ),
	'an empty-looking field must not blank the preview title'
);

$GLOBALS['wp_fixture']['post_meta']['share_title'] = 'A new Charcoal roof for a two-story Youngsville home';

// Descriptions. An absent one is omitted, NOT generated -- the same two
// sentences on 200 pages is what docs/13 §5 guard 4 is for.
$GLOBALS['wp_fixture']['post_meta']['share_description'] = '';
$GLOBALS['wp_stub']['options']['skybird_projects_credentials_line'] = '';

eq( 'no share description means no description', '', skybird_projects_og_description( 1183 ) );

$GLOBALS['wp_fixture']['post_meta']['share_description'] = 'The original roof came off down to the deck and both valleys were rebuilt. Copper accents over the bay window were fabricated on site.';

eq(
	'a written description is used as written, with no credentials configured',
	'The original roof came off down to the deck and both valleys were rebuilt. Copper accents over the bay window were fabricated on site.',
	skybird_projects_og_description( 1183 )
);

// The credentials sentence ships EMPTY on purpose. "No invented specifics"
// (CLAUDE.md) covers claims about us too, and the review's example sentence
// names a generation count and a manufacturer programme that nobody has
// confirmed in writing.
$GLOBALS['wp_stub']['options']['skybird_projects_credentials_line'] = 'Installed by Skybird Roofing.';

it(
	'a configured credentials sentence is appended',
	false !== strpos( skybird_projects_og_description( 1183 ), 'Installed by Skybird Roofing.' )
);

$GLOBALS['wp_stub']['options']['skybird_projects_credentials_line'] = '';

// The image, with declared dimensions. Meta: without og:image:width and
// og:image:height "the first person who shares a piece of content won't see a
// rendered image" [M-IMG] -- and the first person to share it is the customer.
$GLOBALS['wp_fixture']['thumbnail_id'] = 501;
$GLOBALS['wp_fixture']['image_src']    = array(
	'skybird-share' => array( 'https://skybirdroofing.net/wp-content/uploads/2026/09/skybird-roof-youngsville-110848078-1-1200x630.jpeg', 1200, 630, true ),
);
$GLOBALS['wp_fixture']['post_fields'][501]['post_modified_gmt'] = '2026-10-15 14:02:11';

$image = skybird_projects_share_image( 1183 );

eq( 'the share image is 1200 wide', 1200, $image['width'] );
eq( 'the share image is 630 tall', 630, $image['height'] );
it( 'the share image is the real crop, not a fallback', true === $image['cropped'] );

// Meta caches images by URL and says to publish a changed image at a new URL
// [M-IMG]. WordPress regenerates a crop over the top of the old file, so
// without a version marker a re-crop keeps showing the old picture in every
// feed that already scraped the page.
it(
	'the share image URL carries a version marker',
	false !== strpos( $image['url'], '?v=' ),
	'got: ' . $image['url']
);

$before = $image['url'];
$GLOBALS['wp_fixture']['post_fields'][501]['post_modified_gmt'] = '2026-10-16 09:30:00';

it(
	're-cropping the photo changes the share image URL',
	$before !== skybird_projects_share_image( 1183 )['url'],
	'otherwise Facebook serves the cached old crop forever'
);

// A cover imported before the crop existed: WordPress hands back the
// full-size file and we must not claim it is 1200x630.
$GLOBALS['wp_fixture']['image_src'] = array(
	'skybird-share' => array( 'https://skybirdroofing.net/wp-content/uploads/2026/09/old.jpeg', 2016, 1512, false ),
);

$fallback = skybird_projects_share_image( 1183 );

it( 'an un-cropped fallback is flagged as such', empty( $fallback['cropped'] ) );
eq( 'and its real dimensions are declared, not the ideal ones', 2016, $fallback['width'] );

it(
	'the reviewer is told the crop is missing',
	(bool) array_filter(
		skybird_projects_share_preview_problems( 1183 ),
		function ( $p ) {
			return false !== strpos( $p, 'Regenerate thumbnails' );
		}
	)
);

$GLOBALS['wp_fixture']['image_src'] = array(
	'skybird-share' => array( 'https://skybirdroofing.net/wp-content/uploads/2026/09/skybird-roof-youngsville-110848078-1-1200x630.jpeg', 1200, 630, true ),
);

// No cover at all: no image tags, and the reviewer is told why.
$GLOBALS['wp_fixture']['thumbnail_id'] = 0;

eq( 'no cover means no share image', array(), skybird_projects_share_image( 1183 ) );

it(
	'no cover is reported as Facebook choosing the picture',
	(bool) array_filter(
		skybird_projects_share_preview_problems( 1183 ),
		function ( $p ) {
			return false !== strpos( $p, 'Facebook will choose' );
		}
	)
);

$GLOBALS['wp_fixture']['thumbnail_id'] = 501;

// The whole tag set, first with nobody having written a description.
$GLOBALS['wp_fixture']['post_meta']['share_description'] = '';

$tags = skybird_projects_og_tags( 1183 );

foreach ( array( 'og:url', 'og:title', 'og:type', 'og:image', 'og:image:width', 'og:image:height', 'og:image:type' ) as $required ) {
	it( "og tags include $required", isset( $tags[ $required ] ) );
}

it(
	'og:description is omitted rather than invented',
	! isset( $tags['og:description'] ),
	'no human wrote one, and generating it is the 200-identical-pages failure'
);

it( 'og:image:alt describes the photo', isset( $tags['og:image:alt'] ) && '' !== $tags['og:image:alt'] );

it(
	'the referral code never reaches og:url',
	false === strpos( $tags['og:url'], 'ref=' ),
	'Meta requires og:url to be undecorated [M-WM]'
);

it( 'a wide card is declared for the other previews', isset( $tags['twitter:card'] ) );

// The eyebrow prints the town only when the visible heading does not already.
// Since the heading may now be the human share title, which carries no town,
// checking the post title instead would leave the town nowhere in the header
// -- the same bug as 2026-09-17 and 2026-09-18, a third time.
$GLOBALS['wp_fixture']['terms'] = array( (object) array( 'term_id' => 7, 'name' => 'Youngsville', 'slug' => 'youngsville' ) );
$GLOBALS['wp_fixture']['post_meta']['completion_date'] = '2026-09-10';
$GLOBALS['wp_fixture']['title'] = 'GAF Timberline HDZ Roof Replacement in Youngsville, NC';

$GLOBALS['wp_fixture']['post_meta']['share_title'] = '';

it(
	'with the keyword-first title as the heading, the eyebrow drops the town',
	false === strpos( skybird_projects_meta_line( 1183 ), 'Youngsville' ),
	'got: ' . skybird_projects_meta_line( 1183 )
);

$GLOBALS['wp_fixture']['post_meta']['share_title'] = 'A new Charcoal roof for a two-story home';

it(
	'with a human heading that omits the town, the eyebrow puts it back',
	false !== strpos( skybird_projects_meta_line( 1183 ), 'Youngsville, NC' ),
	'got: ' . skybird_projects_meta_line( 1183 )
);

$GLOBALS['wp_fixture']['post_meta']['share_title'] = 'A new Charcoal roof for a Youngsville home';

it(
	'and leaves it out when the human heading already names it',
	false === strpos( skybird_projects_meta_line( 1183 ), 'Youngsville, NC' ),
	'got: ' . skybird_projects_meta_line( 1183 )
);

// And again with one written.
$GLOBALS['wp_fixture']['post_meta']['share_description'] = 'Both valleys were rebuilt and the copper accents over the bay window were fabricated on site.';

$tags = skybird_projects_og_tags( 1183 );

it(
	'a written description does reach og:description',
	isset( $tags['og:description'] ) && false !== strpos( $tags['og:description'], 'copper accents' )
);

// Two sets of og:title in one document is worse than one set we did not
// choose, because Facebook picks between them and nothing on our side decides
// which. Yoast and Rank Math both emit a full Open Graph block.
it( 'tags are emitted when no SEO plugin is active', true === skybird_projects_should_emit_og() );

define( 'WPSEO_VERSION', '24.0' );

it(
	'the plugin stands down when Yoast is active',
	false === skybird_projects_should_emit_og(),
	'duplicate og:title lets Facebook choose, and nothing on our side decides which'
);

it(
	'and says so where the reviewer will see it',
	(bool) array_filter(
		skybird_projects_share_preview_problems( 1183 ),
		function ( $p ) {
			return false !== strpos( $p, 'SEO plugin is active' );
		}
	)
);


// --- Breadcrumbs and BreadcrumbList ---------------------------------------
//
// docs/13 §6 item 1, and the place the flagged 404 gets closed:
// skybird_projects_get_area_page() falls back to a guessed
// /service-areas/{slug}-nc/, and six of the fourteen areas were added from the
// Production HQ sheet without anyone checking a hub page exists.

$GLOBALS['wp_fixture']['terms'] = array( (object) array( 'term_id' => 7, 'name' => 'Youngsville', 'slug' => 'youngsville' ) );
$GLOBALS['wp_fixture']['post_meta']['share_title'] = 'A new Charcoal roof for a two-story Youngsville home';

// Nothing exists yet: no hub index, no area page.
$GLOBALS['wp_fixture']['page_paths'] = array();

eq( 'with no hub page there is no area URL', '', skybird_projects_area_page_url( 1183 ) );

$crumbs = skybird_projects_breadcrumbs( 1183 );
$labels = wp_list_pluck_stub( $crumbs, 'label' );

eq(
	'a missing hub drops the crumb rather than linking a 404',
	array( 'Home', 'A new Charcoal roof for a two-story Youngsville home' ),
	$labels
);

it(
	'no crumb points at a page that does not exist',
	! in_array( 'Youngsville', $labels, true ),
	'got: ' . implode( ' > ', $labels )
);

// Now the area hub exists, but the /service-areas/ index does not.
$GLOBALS['wp_fixture']['page_paths'] = array( 'service-areas/youngsville-nc' );

eq(
	'the area URL resolves once the hub exists',
	'https://skybirdroofing.net/service-areas/youngsville-nc/',
	skybird_projects_area_page_url( 1183 )
);

$labels = wp_list_pluck_stub( skybird_projects_breadcrumbs( 1183 ), 'label' );

eq(
	'the area crumb appears, the missing index does not',
	array( 'Home', 'Youngsville', 'A new Charcoal roof for a two-story Youngsville home' ),
	$labels
);

// And with both.
$GLOBALS['wp_fixture']['page_paths'] = array( 'service-areas', 'service-areas/youngsville-nc' );

$crumbs = skybird_projects_breadcrumbs( 1183 );
$labels = wp_list_pluck_stub( $crumbs, 'label' );

eq(
	'the full trail',
	array( 'Home', 'Service areas', 'Youngsville', 'A new Charcoal roof for a two-story Youngsville home' ),
	$labels
);

eq( 'the last crumb carries no URL', '', $crumbs[ count( $crumbs ) - 1 ]['url'] );

it(
	'every other crumb carries one',
	'' !== $crumbs[0]['url'] && '' !== $crumbs[1]['url'] && '' !== $crumbs[2]['url']
);

// The JSON-LD has to match the visible trail exactly -- the publish gate
// requires it, and Google's spec only lets the LAST item omit `item` [G-BC],
// so a middle crumb we could not resolve could not be expressed at all.
$json = json_decode( skybird_projects_breadcrumb_jsonld( 1183 ), true );

eq( 'the JSON-LD is a BreadcrumbList', 'BreadcrumbList', $json['@type'] );
eq( 'schema.org is the context', 'https://schema.org', $json['@context'] );
eq( 'it has one item per visible crumb', count( $crumbs ), count( $json['itemListElement'] ) );

eq(
	'the names match the visible labels',
	$labels,
	wp_list_pluck_stub( $json['itemListElement'], 'name' )
);

eq( 'positions are 1-based and in order', array( 1, 2, 3, 4 ), wp_list_pluck_stub( $json['itemListElement'], 'position' ) );

it( 'every item but the last has an item URL', isset( $json['itemListElement'][0]['item'] ) && isset( $json['itemListElement'][2]['item'] ) );
it( 'the last item omits its URL, as the spec allows', ! isset( $json['itemListElement'][3]['item'] ) );

// A one-crumb trail is invalid structured data. Emitting none beats emitting
// something Google rejects.
$GLOBALS['wp_fixture']['page_paths'] = array();
$GLOBALS['wp_fixture']['terms']      = array();
$GLOBALS['wp_fixture']['post_meta']['share_title'] = '';
$GLOBALS['wp_fixture']['title']      = 'Roof Replacement in Youngsville, NC';

$labels = wp_list_pluck_stub( skybird_projects_breadcrumbs( 1183 ), 'label' );
eq( 'with no area at all the trail is Home plus this page', 2, count( $labels ) );

// The visible HTML.
$GLOBALS['wp_fixture']['terms']      = array( (object) array( 'term_id' => 7, 'name' => 'Youngsville', 'slug' => 'youngsville' ) );
$GLOBALS['wp_fixture']['page_paths'] = array( 'service-areas', 'service-areas/youngsville-nc' );

$html = skybird_projects_breadcrumb_html( 1183 );

it( 'the trail is a nav with an accessible name', false !== strpos( $html, '<nav' ) && false !== strpos( $html, 'aria-label' ) );
it( 'the current page is marked', false !== strpos( $html, 'aria-current="page"' ) );
it( 'the current page is not a link', false === strpos( $html, '<a href="">' ) );
it( 'the separators are hidden from screen readers', false !== strpos( $html, 'aria-hidden="true"' ) );
it( 'the area hub is linked', false !== strpos( $html, 'service-areas/youngsville-nc' ) );

// Never a bare guessed path in the rendered trail. This is the regression
// that matters: the guess is still in get_area_page() for callers that want
// the raw value, and it must not reach a visitor unchecked.
$GLOBALS['wp_fixture']['page_paths'] = array();
$html = skybird_projects_breadcrumb_html( 1183 );

it(
	'a guessed hub path never reaches the rendered trail',
	false === strpos( $html, 'service-areas' ),
	'got: ' . $html
);

$GLOBALS['wp_fixture']['page_paths'] = array( 'service-areas', 'service-areas/youngsville-nc' );

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
