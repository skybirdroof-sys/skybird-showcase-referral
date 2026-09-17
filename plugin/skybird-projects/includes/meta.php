<?php
/**
 * Project meta fields.
 *
 * Everything the automation writes and the reviewer edits lives here as native
 * post meta, registered with show_in_rest so n8n can set it in the same REST
 * call that creates the draft.
 *
 * Why native meta rather than ACF fields (decided 2026-09-17, see
 * docs/09-euan-answers.md §3.1): ACF on this site is the free tier, which has
 * no Gallery field, and the gallery is machine-populated from the CompanyCam
 * `Showcase` tag so it needs no editing UI. Native meta is also a single,
 * predictable REST write rather than ACF's separate `acf` object with its own
 * field-key conventions. ACF free still supplies the *form* for the
 * reviewer-edited fields — see includes/acf-fields.php, which points at these
 * same meta keys rather than creating a second set.
 *
 * NOT registered here, deliberately: the true CompanyCam coordinates. Per
 * docs/05-data-model.md §1 they are never written to WordPress at all. The
 * offset is generated once in n8n and only the offset arrives. If the real
 * location is not stored here it cannot leak from here.
 *
 * @package Skybird_Projects
 */

defined( 'ABSPATH' ) || exit;

/**
 * Referral code charset, from docs/05-data-model.md §5.
 *
 * Six characters, no ambiguous glyphs and no vowels, so a code can't be
 * misread over the phone or accidentally spell something. Excludes 0/O, 1/I/L
 * and A/E/I/O/U. Y is kept — "vowels" in the source doc is read as AEIOU.
 */
const SKYBIRD_PROJECTS_CODE_CHARS = 'BCDFGHJKMNPQRSTVWXYZ23456789';

/** Length of a referral code. */
const SKYBIRD_PROJECTS_CODE_LENGTH = 6;

/**
 * Field definitions.
 *
 * @return array[] Keyed by meta key.
 */
function skybird_projects_meta_fields() {
	return array(
		// Written by the automation.
		'companycam_project_id'     => array(
			'type'        => 'string',
			'sanitize'    => 'sanitize_text_field',
			'description' => 'CompanyCam project ID. The bridge back for any future re-sync.',
		),
		'proline_project_id'        => array(
			'type'        => 'string',
			'sanitize'    => 'sanitize_text_field',
			'description' => 'ProLine job ID. Nothing populates this today — no CompanyCam/ProLine link exists for new jobs (docs/07-phase-4-preflight.md §2.4.2). The field is the slot a future bridge fills.',
		),
		// Stored as strings, but the REST schema accepts a number too. Both
		// halves of that are deliberate — see the note under
		// skybird_projects_sanitize_lat().
		'approx_lat'                => array(
			'type'        => 'string',
			'rest_schema' => array( 'type' => array( 'string', 'number' ) ),
			'sanitize'    => 'skybird_projects_sanitize_lat',
			'description' => 'Offset latitude for the map pin, stored as a numeric string. Accepts a number or a string. Empty means not set. Never the true location.',
		),
		'approx_lng'                => array(
			'type'        => 'string',
			'rest_schema' => array( 'type' => array( 'string', 'number' ) ),
			'sanitize'    => 'skybird_projects_sanitize_lng',
			'description' => 'Offset longitude for the map pin, stored as a numeric string. Accepts a number or a string. Empty means not set. Never the true location.',
		),
		'gallery'                   => array(
			'type'        => 'array',
			'sanitize'    => 'skybird_projects_sanitize_gallery',
			'items'       => 'integer',
			'description' => 'Media Library attachment IDs for the Showcase-tagged photos, excluding the cover.',
		),
		'ambassador_referral_code'  => array(
			'type'        => 'string',
			'sanitize'    => 'skybird_projects_sanitize_code',
			'description' => 'Pointer to the ambassador\'s code so the share URL can be built without a live lookup. Owned in GHL.',
		),

		// Edited by the reviewer at the human review gate.
		'city'                      => array(
			'type'     => 'string',
			'sanitize' => 'sanitize_text_field',
			'reviewer' => true,
			'label'    => 'City',
		),
		'neighborhood'              => array(
			'type'     => 'string',
			'sanitize' => 'sanitize_text_field',
			'reviewer' => true,
			'label'    => 'Neighborhood',
		),
		'zip'                       => array(
			'type'     => 'string',
			'sanitize' => 'skybird_projects_sanitize_zip',
			'reviewer' => true,
			'label'    => 'ZIP',
		),
		'manufacturer'              => array(
			'type'     => 'string',
			'sanitize' => 'sanitize_text_field',
			'reviewer' => true,
			'label'    => 'Manufacturer',
		),
		'product_line'              => array(
			'type'     => 'string',
			'sanitize' => 'sanitize_text_field',
			'reviewer' => true,
			'label'    => 'Product line',
		),
		'color'                     => array(
			'type'     => 'string',
			'sanitize' => 'sanitize_text_field',
			'reviewer' => true,
			'label'    => 'Color',
		),
		'warranty'                  => array(
			'type'     => 'string',
			'sanitize' => 'sanitize_text_field',
			'reviewer' => true,
			'label'    => 'Warranty',
		),
		'completion_date'           => array(
			'type'     => 'string',
			'sanitize' => 'skybird_projects_sanitize_date',
			'reviewer' => true,
			'label'    => 'Completion date',
		),
	);
}

/**
 * Register every field.
 *
 * Note the dependency on the post type declaring `custom-fields` support —
 * without it these all register cleanly and then never appear in REST.
 */
function skybird_projects_register_meta() {
	foreach ( skybird_projects_meta_fields() as $key => $field ) {
		$show_in_rest = true;

		if ( 'array' === $field['type'] ) {
			$show_in_rest = array(
				'schema' => array(
					'type'  => 'array',
					'items' => array( 'type' => $field['items'] ),
				),
			);
		} elseif ( isset( $field['rest_schema'] ) ) {
			// An explicit REST schema, where what we accept on input is wider
			// than what we store. REST validates the incoming value against
			// this schema BEFORE sanitize_callback runs, so a field that only
			// declares 'string' rejects a JSON number outright and the
			// sanitiser never gets a chance to cast it.
			$show_in_rest = array( 'schema' => $field['rest_schema'] );
		}

		register_post_meta(
			SKYBIRD_PROJECTS_POST_TYPE,
			$key,
			array(
				'type'              => $field['type'],
				'single'            => true,
				'default'           => 'array' === $field['type'] ? array() : '',
				'show_in_rest'      => $show_in_rest,
				'sanitize_callback' => $field['sanitize'],
				'description'       => isset( $field['description'] ) ? $field['description'] : '',
				'auth_callback'     => 'skybird_projects_meta_auth',
			)
		);
	}
}
add_action( 'init', 'skybird_projects_register_meta' );

/**
 * Only someone who can edit the project may write its meta.
 *
 * This is what keeps the Editor-level `skybird-sync` user able to write drafts
 * while nobody unauthenticated can touch the fields.
 *
 * @param bool   $allowed   Unused default.
 * @param string $meta_key  Unused.
 * @param int    $object_id Post ID.
 * @return bool
 */
function skybird_projects_meta_auth( $allowed, $meta_key, $object_id ) {
	return current_user_can( 'edit_post', $object_id );
}

/**
 * Latitude: must be a real offset, not blank and not 0.
 *
 * Rejecting exactly 0 implements a check the review gate already asks a human
 * to make by eye (docs/06-trigger-design.md §3: "Confirm the approximate map
 * coordinates were generated, not left blank or defaulted"). A 0,0 pin is the
 * signature of an offset step that silently didn't run, and 0,0 is in the Gulf
 * of Guinea — far more obvious in code than on a map the reviewer may not open.
 *
 * WHY THIS RETURNS A STRING, and why the field is registered as `string`
 * rather than `number` — found on a real install, 2026-09-17:
 *
 * A meta field registered as `type => 'number'` with `single => true` has no
 * way to represent "not set". WordPress returns 0 for a missing numeric meta,
 * and 0 is precisely the sentinel this function exists to reject — so absent
 * and invalid would be indistinguishable in the REST response. Worse, a
 * `default` of '' against a numeric schema is itself invalid, which is why
 * both coordinate fields were silently dropped from the REST schema
 * altogether and never stored at all.
 *
 * A numeric string sidesteps both: '' is unambiguously "not set", and every
 * consumer already casts (see includes/map-shortcode.php).
 *
 * AND the REST schema accepts a number as well as a string — found on the
 * second real run, 2026-09-17. REST validates the incoming value against the
 * schema BEFORE this callback runs, so declaring only 'string' rejected a
 * JSON number outright with `rest_invalid_type` and this function never saw
 * it. A coordinate is naturally a number at the point it is calculated;
 * forcing every caller to stringify it first is a footgun that would have
 * bitten n8n in exactly the same way. So: accept either, normalise here.
 *
 * @param mixed $value Incoming value — number or numeric string.
 * @return string Empty string for "not set", or the coordinate as a string.
 */
function skybird_projects_sanitize_lat( $value ) {
	if ( '' === $value || null === $value ) {
		return '';
	}

	$lat = (float) $value;

	if ( 0.0 === $lat || $lat < -90.0 || $lat > 90.0 ) {
		return '';
	}

	return (string) $lat;
}

/**
 * Longitude, same reasoning as latitude.
 *
 * @param mixed $value Incoming value.
 * @return string
 */
function skybird_projects_sanitize_lng( $value ) {
	if ( '' === $value || null === $value ) {
		return '';
	}

	$lng = (float) $value;

	if ( 0.0 === $lng || $lng < -180.0 || $lng > 180.0 ) {
		return '';
	}

	return (string) $lng;
}

/**
 * Gallery: positive integers, de-duplicated, capped.
 *
 * The cap matches docs/01-api-audit.md §6 ("Max 20 photos"). Order is
 * preserved — n8n sends them sorted by captured_at, which is the
 * before/during/after sequence the page reads in.
 *
 * @param mixed $value Incoming value.
 * @return int[]
 */
function skybird_projects_sanitize_gallery( $value ) {
	if ( ! is_array( $value ) ) {
		return array();
	}

	$ids = array();

	foreach ( $value as $id ) {
		// Cast, don't absint(). absint() is abs(intval()), so a negative ID
		// would come back positive — -2 would silently become attachment 2,
		// putting an unrelated image in the gallery. Dropping it is correct;
		// quietly substituting a different photo is not.
		$id = (int) $id;

		if ( $id > 0 && ! in_array( $id, $ids, true ) ) {
			$ids[] = $id;
		}
	}

	return array_slice( $ids, 0, 20 );
}

/**
 * Referral code: exactly six characters from the documented charset.
 *
 * Anything else is dropped rather than coerced. A half-valid code would build
 * a share URL that silently attributes nothing, which is worse than an absent
 * one — the absent case is visible at review, the malformed case is not.
 *
 * @param mixed $value Incoming value.
 * @return string
 */
function skybird_projects_sanitize_code( $value ) {
	$code = strtoupper( trim( (string) $value ) );

	if ( '' === $code ) {
		return '';
	}

	if ( strlen( $code ) !== SKYBIRD_PROJECTS_CODE_LENGTH ) {
		return '';
	}

	$allowed = str_split( SKYBIRD_PROJECTS_CODE_CHARS );

	foreach ( str_split( $code ) as $char ) {
		if ( ! in_array( $char, $allowed, true ) ) {
			return '';
		}
	}

	return $code;
}

/**
 * ZIP: five digits, or empty.
 *
 * @param mixed $value Incoming value.
 * @return string
 */
function skybird_projects_sanitize_zip( $value ) {
	$zip = preg_replace( '/[^0-9]/', '', (string) $value );

	return 5 === strlen( (string) $zip ) ? $zip : '';
}

/**
 * Completion date: YYYY-MM-DD, and a real date.
 *
 * checkdate() rejects 2026-02-30, which a regex alone would accept.
 *
 * @param mixed $value Incoming value.
 * @return string
 */
function skybird_projects_sanitize_date( $value ) {
	$date = trim( (string) $value );

	if ( ! preg_match( '/^(\d{4})-(\d{2})-(\d{2})$/', $date, $m ) ) {
		return '';
	}

	if ( ! checkdate( (int) $m[2], (int) $m[3], (int) $m[1] ) ) {
		return '';
	}

	return $date;
}
