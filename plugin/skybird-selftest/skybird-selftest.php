<?php
/**
 * Plugin Name:       Skybird Projects — Self Test
 * Description:       Adds Tools &rarr; Skybird Self Test, which checks that the Skybird Projects plugin registered correctly and that the REST write the automation depends on actually works. TEST SANDBOX ONLY — do not install on the live site.
 * Version:           0.1.0
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            Skybird Roofing
 * License:           GPL-2.0-or-later
 *
 * Why this exists: the checks it runs were originally a shell script, which
 * assumed a terminal and an Application Password. This does the same work
 * from inside wp-admin, which is the workflow that was already working.
 *
 * It exercises the real REST controller in-process via rest_do_request(), so
 * a pass here means the endpoint, the registered meta and the sanitisers all
 * behave — the same code path n8n hits over HTTP. What it deliberately does
 * NOT test is the HTTP auth layer (Application Passwords) or whether a
 * security plugin blocks REST, because those are properties of the host, not
 * of this plugin, and they can only be answered on the real site.
 *
 * It creates two draft posts and deletes them again. Nothing is published.
 *
 * @package Skybird_Projects
 */

defined( 'ABSPATH' ) || exit;

add_action( 'admin_menu', function () {
	add_management_page(
		'Skybird Self Test',
		'Skybird Self Test',
		'manage_options',
		'skybird-selftest',
		'skybird_selftest_page'
	);
} );

/**
 * One check result.
 *
 * @param array  $results By-reference result list.
 * @param string $name    What was checked.
 * @param bool   $ok      Did it pass.
 * @param string $detail  Value seen, shown either way.
 */
function skybird_selftest_check( &$results, $name, $ok, $detail = '' ) {
	$results[] = array(
		'name'   => $name,
		'ok'     => (bool) $ok,
		'detail' => $detail,
	);
}

/**
 * Run every check.
 *
 * @return array
 */
function skybird_selftest_run() {
	$r = array();

	// --- Is the plugin even here? -------------------------------------------
	if ( ! post_type_exists( 'project' ) ) {
		skybird_selftest_check( $r, 'Skybird Projects plugin is active', false, 'post type "project" does not exist — activate Skybird Projects first' );
		return $r;
	}

	// --- Post type ----------------------------------------------------------
	$pt = get_post_type_object( 'project' );

	skybird_selftest_check( $r, 'Post type "project" registered', true, 'label: ' . $pt->labels->name );
	skybird_selftest_check( $r, 'REST base is "projects"', 'projects' === $pt->rest_base, (string) $pt->rest_base );
	skybird_selftest_check( $r, 'Exposed in the REST API', (bool) $pt->show_in_rest, $pt->show_in_rest ? 'yes' : 'no' );

	// The one that silently breaks everything if wrong.
	$supports_cf = post_type_supports( 'project', 'custom-fields' );
	skybird_selftest_check(
		$r,
		'Supports custom-fields (required for meta in REST)',
		$supports_cf,
		$supports_cf ? 'yes' : 'NO — every meta field would be invisible to n8n'
	);

	skybird_selftest_check( $r, 'Supports a featured image (the Showcase Cover)', post_type_supports( 'project', 'thumbnail' ) );
	skybird_selftest_check( $r, 'No global /projects/ archive', false === $pt->has_archive, $pt->has_archive ? 'has_archive is ON — Euan asked for no master hub' : 'correct' );

	// --- Taxonomy -----------------------------------------------------------
	$tax = get_taxonomy( 'service_area' );

	if ( ! $tax ) {
		skybird_selftest_check( $r, 'Taxonomy "service_area" registered', false );
	} else {
		skybird_selftest_check( $r, 'Taxonomy "service_area" registered', true );
		skybird_selftest_check( $r, 'Taxonomy has no public term archives', ! $tax->public, $tax->public ? 'public — would create competing hubs' : 'correct' );
		skybird_selftest_check( $r, 'Taxonomy is in REST (n8n can assign it)', (bool) $tax->show_in_rest );

		$says_cat = false;
		foreach ( (array) $tax->labels as $label ) {
			if ( is_string( $label ) && false !== stripos( $label, 'categor' ) ) {
				$says_cat = true;
			}
		}
		skybird_selftest_check( $r, 'Admin screen does not say "Category"', ! $says_cat, $says_cat ? 'some labels still say Category' : 'labels are all Service Area' );
	}

	// --- Seeded terms -------------------------------------------------------
	$terms = get_terms( array(
		'taxonomy'   => 'service_area',
		'hide_empty' => false,
		'fields'     => 'slugs',
	) );

	$expected = array( 'franklinton', 'goldsboro', 'greenville', 'knightdale', 'raleigh', 'rolesville', 'wake-forest', 'youngsville' );

	if ( is_wp_error( $terms ) ) {
		skybird_selftest_check( $r, 'Eight service areas seeded', false, $terms->get_error_message() );
	} else {
		sort( $terms );
		skybird_selftest_check( $r, 'Eight service areas seeded', $expected === $terms, count( $terms ) . ' found: ' . implode( ', ', $terms ) );
	}

	// --- Meta in the REST schema -------------------------------------------
	$expected_meta = array(
		'ambassador_referral_code', 'approx_lat', 'approx_lng', 'city', 'color',
		'companycam_project_id', 'completion_date', 'gallery', 'manufacturer',
		'neighborhood', 'product_line', 'proline_project_id', 'warranty', 'zip',
	);

	$opts   = rest_do_request( new WP_REST_Request( 'OPTIONS', '/wp/v2/projects' ) );
	$data   = $opts->get_data();
	$schema = isset( $data['schema']['properties']['meta']['properties'] )
		? array_keys( $data['schema']['properties']['meta']['properties'] )
		: array();
	sort( $schema );

	$missing = array_diff( $expected_meta, $schema );
	skybird_selftest_check(
		$r,
		'All 14 meta fields in the REST schema',
		empty( $missing ),
		empty( $missing ) ? count( $schema ) . ' fields present' : 'missing: ' . implode( ', ', $missing )
	);

	// --- Idempotency lookup -------------------------------------------------
	$params = isset( $data['endpoints'][0]['args'] ) ? array_keys( $data['endpoints'][0]['args'] ) : array();
	skybird_selftest_check(
		$r,
		'Duplicate-check parameter accepted',
		in_array( 'companycam_project_id', $params, true ),
		in_array( 'companycam_project_id', $params, true ) ? 'companycam_project_id is queryable' : 'not registered'
	);

	// --- The write the automation makes ------------------------------------
	$created = array();

	$req = new WP_REST_Request( 'POST', '/wp/v2/projects' );
	$req->set_header( 'Content-Type', 'application/json' );
	$req->set_body( wp_json_encode( array(
		'status' => 'draft',
		'title'  => 'Self test — will be deleted',
		'meta'   => array(
			'companycam_project_id' => '110848078',

			// Deliberately mixed shapes in one request: a JSON number and a
			// JSON string. REST validates against the schema before the
			// sanitiser runs, so a string-only schema rejects the number
			// outright -- which is exactly what happened on the second real
			// run. n8n's offset code produces numbers, so both must work.
			'approx_lat'            => 36.074512,
			'approx_lng'            => '-78.561238',

			'city'                  => 'Youngsville',
			'zip'                   => '27596',
			'completion_date'       => '2026-09-10',
		),
	) ) );

	$res = rest_do_request( $req );

	if ( $res->is_error() ) {
		$err = $res->as_error();
		skybird_selftest_check( $r, 'Creating a draft over REST', false, $err->get_error_code() . ': ' . $err->get_error_message() );
	} else {
		$body      = $res->get_data();
		$created[] = $body['id'];
		$m         = isset( $body['meta'] ) ? $body['meta'] : array();

		skybird_selftest_check( $r, 'Creating a draft over REST', true, 'post id ' . $body['id'] );
		skybird_selftest_check( $r, 'Saved as a draft, not published', 'draft' === $body['status'], $body['status'] );
		skybird_selftest_check( $r, 'CompanyCam project ID stored', '110848078' === (string) ( $m['companycam_project_id'] ?? '' ), (string) ( $m['companycam_project_id'] ?? '(empty)' ) );
		skybird_selftest_check( $r, 'Map pin latitude stored (sent as a number)', abs( (float) ( $m['approx_lat'] ?? 0 ) - 36.074512 ) < 0.0001, (string) ( $m['approx_lat'] ?? '(empty)' ) );
		skybird_selftest_check( $r, 'Map pin longitude stored (sent as a string)', abs( (float) ( $m['approx_lng'] ?? 0 ) + 78.561238 ) < 0.0001, (string) ( $m['approx_lng'] ?? '(empty)' ) );

		// Both must land as strings, whichever shape arrived, so '' can mean
		// "not set" without colliding with a real 0.
		skybird_selftest_check(
			$r,
			'Both coordinates normalised to strings',
			is_string( $m['approx_lat'] ?? null ) && is_string( $m['approx_lng'] ?? null ),
			'lat ' . gettype( $m['approx_lat'] ?? null ) . ', lng ' . gettype( $m['approx_lng'] ?? null )
		);
		skybird_selftest_check( $r, 'City stored', 'Youngsville' === ( $m['city'] ?? '' ), (string) ( $m['city'] ?? '(empty)' ) );
		skybird_selftest_check( $r, 'Completion date stored', '2026-09-10' === ( $m['completion_date'] ?? '' ), (string) ( $m['completion_date'] ?? '(empty)' ) );

		// Does the duplicate check find it? Build the request, set params, THEN
		// dispatch — rest_do_request() returns a response, not a request.
		$look = new WP_REST_Request( 'GET', '/wp/v2/projects' );
		$look->set_param( 'companycam_project_id', '110848078' );
		$look->set_param( 'status', 'any' );

		$look_res = rest_do_request( $look );
		$look_out = $look_res->get_data();
		$hits     = is_array( $look_out ) ? count( $look_out ) : 0;
		skybird_selftest_check( $r, 'Duplicate check finds an existing project', $hits >= 1, $hits . ' match(es) — stops a second draft being created' );
	}

	// --- Bad input must be rejected, not stored ----------------------------
	$bad = new WP_REST_Request( 'POST', '/wp/v2/projects' );
	$bad->set_header( 'Content-Type', 'application/json' );
	$bad->set_body( wp_json_encode( array(
		'status' => 'draft',
		'title'  => 'Self test (bad input) — will be deleted',
		'meta'   => array(
			'approx_lat'               => 0,
			'approx_lng'               => '0',
			'ambassador_referral_code' => 'BADGUY',
			'completion_date'          => '2026-02-30',
			'zip'                      => '123',
			'gallery'                  => array( 5, 5, -2, 0 ),
		),
	) ) );

	$bres = rest_do_request( $bad );

	if ( $bres->is_error() ) {
		$err = $bres->as_error();
		skybird_selftest_check( $r, 'Bad-input test ran', false, $err->get_error_code() . ': ' . $err->get_error_message() );
	} else {
		$bb        = $bres->get_data();
		$created[] = $bb['id'];
		$m         = isset( $bb['meta'] ) ? $bb['meta'] : array();

		// The key must EXIST and be empty. Checking only emptiness gave a
		// false pass on 2026-09-17: both coordinate fields had been dropped
		// from the REST schema entirely, so they read as empty and this
		// "passed" while actually being broken. An absent key is a failure,
		// not a rejection.
		$lat_present = array_key_exists( 'approx_lat', $m );
		$lng_present = array_key_exists( 'approx_lng', $m );

		skybird_selftest_check(
			$r,
			'Rejects 0,0 coordinates (offset never ran)',
			$lat_present && $lng_present && '' === (string) $m['approx_lat'] && '' === (string) $m['approx_lng'],
			( $lat_present && $lng_present )
				? 'lat "' . $m['approx_lat'] . '" lng "' . $m['approx_lng'] . '"'
				: 'coordinate fields are MISSING from the response, not rejected'
		);
		skybird_selftest_check( $r, 'Rejects an invalid referral code', empty( $m['ambassador_referral_code'] ), '"' . ( $m['ambassador_referral_code'] ?? '' ) . '"' );
		skybird_selftest_check( $r, 'Rejects February 30th', empty( $m['completion_date'] ), '"' . ( $m['completion_date'] ?? '' ) . '"' );
		skybird_selftest_check( $r, 'Rejects a 3-digit ZIP', empty( $m['zip'] ), '"' . ( $m['zip'] ?? '' ) . '"' );
		skybird_selftest_check( $r, 'Cleans the photo list (dedupes, drops negatives)', array( 5 ) === ( $m['gallery'] ?? null ), wp_json_encode( $m['gallery'] ?? null ) );
	}

	// --- Clean up -----------------------------------------------------------
	$deleted = 0;
	foreach ( $created as $id ) {
		if ( wp_delete_post( $id, true ) ) {
			$deleted++;
		}
	}
	skybird_selftest_check( $r, 'Test drafts cleaned up', $deleted === count( $created ), $deleted . ' of ' . count( $created ) . ' deleted' );

	return $r;
}

/**
 * The admin page.
 */
function skybird_selftest_page() {
	$run     = isset( $_POST['skybird_run'] ) && check_admin_referer( 'skybird_selftest' );
	$results = $run ? skybird_selftest_run() : array();

	$pass = 0;
	$fail = 0;
	foreach ( $results as $x ) {
		$x['ok'] ? $pass++ : $fail++;
	}

	echo '<div class="wrap">';
	echo '<h1>Skybird Projects — Self Test</h1>';

	echo '<p>Checks that the Skybird Projects plugin registered correctly and that the REST write the automation depends on actually works. Creates two drafts and deletes them again. <strong>Nothing is published.</strong></p>';
	echo '<p><em>Sandbox only — this plugin is not meant for the live site.</em></p>';

	echo '<form method="post">';
	wp_nonce_field( 'skybird_selftest' );
	echo '<p><button type="submit" name="skybird_run" value="1" class="button button-primary button-hero">Run the checks</button></p>';
	echo '</form>';

	if ( ! $run ) {
		echo '</div>';
		return;
	}

	printf(
		'<h2>%d passed, %d failed</h2>',
		(int) $pass,
		(int) $fail
	);

	if ( 0 === $fail ) {
		echo '<div class="notice notice-success"><p><strong>Everything passed.</strong> The plugin is working on this site and the automation can write to it.</p></div>';
	} else {
		echo '<div class="notice notice-error"><p><strong>' . (int) $fail . ' check(s) failed.</strong> Copy the results below and send them over.</p></div>';
	}

	echo '<table class="widefat striped" style="max-width:56rem">';
	echo '<thead><tr><th style="width:5rem">Result</th><th>Check</th><th>Value seen</th></tr></thead><tbody>';

	$plain = array();

	foreach ( $results as $x ) {
		$label = $x['ok'] ? 'PASS' : 'FAIL';
		$color = $x['ok'] ? '#008a20' : '#d63638';

		printf(
			'<tr><td><strong style="color:%s">%s</strong></td><td>%s</td><td><code>%s</code></td></tr>',
			esc_attr( $color ),
			esc_html( $label ),
			esc_html( $x['name'] ),
			esc_html( $x['detail'] )
		);

		$plain[] = sprintf( '%s  %s%s', $label, $x['name'], $x['detail'] ? '  [' . $x['detail'] . ']' : '' );
	}

	echo '</tbody></table>';

	$summary = sprintf(
		"Skybird Projects self test\nWordPress %s | PHP %s | %d passed, %d failed\nACF: %s\n\n%s",
		get_bloginfo( 'version' ),
		PHP_VERSION,
		$pass,
		$fail,
		function_exists( 'acf_add_local_field_group' ) ? 'active' : 'not active',
		implode( "\n", $plain )
	);

	echo '<h2>Copy this and send it over</h2>';
	echo '<textarea readonly rows="22" style="width:100%;max-width:56rem;font-family:monospace;font-size:12px" onclick="this.select()">';
	echo esc_textarea( $summary );
	echo '</textarea>';
	echo '<p>Click inside the box to select it all, then Ctrl+C.</p>';

	echo '</div>';
}
