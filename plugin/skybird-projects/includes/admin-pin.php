<?php
/**
 * The map pin readout on the project edit screen.
 *
 * docs/06-trigger-design.md §3 asks the reviewer, before publishing, to
 * "confirm the approximate map coordinates were generated, not left blank or
 * defaulted to the true location."
 *
 * Until now there was no way to do that. `approx_lat` and `approx_lng` are
 * written by the automation, not by a human, so includes/acf-fields.php
 * deliberately leaves them out of the reviewer's form — and that same field
 * group sets `hide_on_screen => custom_fields`, which removes WordPress's
 * native Custom Fields box from the screen entirely. Between the two, the
 * numbers were invisible in the admin. Confirmed the hard way on 2026-09-28:
 * reading them off the first real draft took a REST call from the browser
 * console (docs/07-phase-4-preflight.md §16.7).
 *
 * A checklist item nobody can perform is not a control.
 *
 * A meta box rather than another ACF field, for two reasons: these values are
 * read-only and an editable input invites someone to "fix" a pin by hand, and
 * the plugin is built to work with ACF absent (see the admin notice in
 * skybird-projects.php) — the one screen that proves the pin was offset should
 * not disappear along with ACF.
 *
 * @package Skybird_Projects
 */

defined( 'ABSPATH' ) || exit;

/**
 * North Carolina's bounding box, loosely.
 *
 * Only wide enough to catch the failures worth catching: a latitude and
 * longitude swapped, a dropped minus sign, a decimal in the wrong place. A
 * tighter box would start rejecting real jobs at the edge of the service area.
 */
const SKYBIRD_PROJECTS_NC_BOUNDS = array(
	'lat_min' => 33.75,
	'lat_max' => 36.60,
	'lng_min' => -84.35,
	'lng_max' => -75.40,
);

/**
 * Register the meta box.
 */
function skybird_projects_add_pin_meta_box() {
	add_meta_box(
		'skybird-projects-pin',
		__( 'Map pin (read only)', 'skybird-projects' ),
		'skybird_projects_render_pin_meta_box',
		SKYBIRD_PROJECTS_POST_TYPE,
		'side',
		'default'
	);
}
add_action( 'add_meta_boxes', 'skybird_projects_add_pin_meta_box' );

/**
 * Work out what can honestly be said about a stored pin.
 *
 * Split out from the rendering so the suite can exercise the judgement without
 * a screen. Returns a status key, a sentence, and the values as floats.
 *
 * The statuses are deliberately three, not two. `ok` does NOT mean the pin is
 * correctly offset — see the note in the renderer.
 *
 * @param int $post_id Project post ID.
 * @return array {
 *     @type string $status One of 'missing', 'out_of_bounds', 'ok'.
 *     @type string $message Sentence for the reviewer.
 *     @type float  $lat
 *     @type float  $lng
 * }
 */
function skybird_projects_pin_status( $post_id ) {
	$lat = (float) get_post_meta( $post_id, 'approx_lat', true );
	$lng = (float) get_post_meta( $post_id, 'approx_lng', true );

	// 0 is the sentinel the sanitiser returns for anything unusable, so an
	// unset pin and a rejected one look the same here. Both mean "no pin".
	if ( 0.0 === $lat || 0.0 === $lng ) {
		return array(
			'status'  => 'missing',
			'message' => __( 'No pin stored. This project will not appear on any service-area map. Do not publish — check the automation run.', 'skybird-projects' ),
			'lat'     => $lat,
			'lng'     => $lng,
		);
	}

	$bounds = SKYBIRD_PROJECTS_NC_BOUNDS;

	if (
		$lat < $bounds['lat_min'] || $lat > $bounds['lat_max'] ||
		$lng < $bounds['lng_min'] || $lng > $bounds['lng_max']
	) {
		return array(
			'status'  => 'out_of_bounds',
			'message' => __( 'This pin is not in North Carolina. Latitude and longitude may be swapped, or a sign dropped. Do not publish.', 'skybird-projects' ),
			'lat'     => $lat,
			'lng'     => $lng,
		);
	}

	return array(
		'status'  => 'ok',
		'message' => __( 'A pin is stored and it lands in North Carolina.', 'skybird-projects' ),
		'lat'     => $lat,
		'lng'     => $lng,
	);
}

/**
 * Render the box.
 *
 * @param WP_Post $post Current post.
 */
function skybird_projects_render_pin_meta_box( $post ) {
	$pin = skybird_projects_pin_status( $post->ID );

	$colors = array(
		'missing'       => '#d63638',
		'out_of_bounds' => '#d63638',
		'ok'            => '#00a32a',
	);

	printf(
		'<p style="margin-top:0;color:%s;">%s</p>',
		esc_attr( $colors[ $pin['status'] ] ),
		esc_html( $pin['message'] )
	);

	if ( 'missing' !== $pin['status'] ) {
		printf(
			'<p><code>%s</code><br><code>%s</code></p>',
			esc_html( number_format( $pin['lat'], 6 ) ),
			esc_html( number_format( $pin['lng'], 6 ) )
		);

		printf(
			'<p><a href="%s" target="_blank" rel="noopener noreferrer">%s</a></p>',
			esc_url(
				sprintf(
					'https://www.openstreetmap.org/?mlat=%1$F&mlon=%2$F#map=16/%1$F/%2$F',
					$pin['lat'],
					$pin['lng']
				)
			),
			esc_html__( 'See where this pin lands', 'skybird-projects' )
		);
	}

	// The honest part, and the reason this box says "a pin is stored" rather
	// than "the pin is offset".
	//
	// The plugin CANNOT verify the offset. docs/05-data-model.md §1 forbids
	// storing the true coordinates at all, so there is nothing here to measure
	// against — by design, and the right design. The offset is computed once
	// in n8n and only the result travels.
	//
	// So this box rules out the failures it can see (no pin, a pin in the
	// wrong state) and tells the reviewer plainly that the remaining check is
	// theirs. A green tick that implied more than it checked would be worse
	// than no box at all.
	echo '<p style="border-top:1px solid #dcdcde;padding-top:8px;font-size:12px;color:#646970;">';
	esc_html_e(
		'This cannot confirm the pin is offset from the real address — the true coordinates are never stored here, on purpose. Open the map and check it lands in the right town but not on a specific house.',
		'skybird-projects'
	);
	echo '</p>';
}
