<?php
/**
 * The per-service-area map widget, as a shortcode.
 *
 * A shortcode because the site runs WPBakery Page Builder, which is
 * shortcode-based (docs/09-euan-answers.md §3.4). `[skybird_project_map
 * area="wake-forest"]` drops into a WPBakery text or raw-HTML element with no
 * custom WPBakery element development and no work from Pitch Peak beyond
 * pasting one line onto each of the eight service-area pages.
 *
 * IMPORTANT DESIGN DECISION — the pin list is server-rendered.
 *
 * The shortcode always outputs a real <ul> of real <a> links to the project
 * pages, in the HTML, before any JavaScript runs. The map then progressively
 * enhances that list into a Google Map and hides it visually.
 *
 * This is deliberate. docs/handoff-buy-vs-build-decision.md flagged that
 * Roman Roofing's PSAI-built project listing renders client-side — raw HTML
 * full of placeholders and "Loading…" — and called it "fragile for indexing".
 * That is the failure mode this whole project exists to avoid: the internal
 * links from each service-area page to its projects are the entire mechanism
 * Euan signed off on, and a link that only exists after JS executes is a link
 * Google may never follow. Server-rendering the list also means the widget
 * degrades to something useful with no API key, no JS, or a failed map load.
 *
 * @package Skybird_Projects
 */

defined( 'ABSPATH' ) || exit;

/** Shortcode tag. */
const SKYBIRD_PROJECTS_MAP_SHORTCODE = 'skybird_project_map';

/**
 * Render the widget.
 *
 * @param array $atts Shortcode attributes.
 * @return string HTML.
 */
function skybird_projects_map_shortcode( $atts ) {
	$atts = shortcode_atts(
		array(
			'area'  => '',
			'limit' => 50,
		),
		$atts,
		SKYBIRD_PROJECTS_MAP_SHORTCODE
	);

	$area = sanitize_title( $atts['area'] );

	if ( ! $area ) {
		return skybird_projects_map_notice( __( 'No service area set on this map.', 'skybird-projects' ) );
	}

	$term = get_term_by( 'slug', $area, SKYBIRD_PROJECTS_TAXONOMY );

	if ( ! $term ) {
		return skybird_projects_map_notice(
			sprintf(
				/* translators: %s: service area slug. */
				__( 'Unknown service area "%s".', 'skybird-projects' ),
				$area
			)
		);
	}

	$projects = get_posts(
		array(
			'post_type'        => SKYBIRD_PROJECTS_POST_TYPE,
			'post_status'      => 'publish',
			'posts_per_page'   => absint( $atts['limit'] ),
			'orderby'          => 'date',
			'order'            => 'DESC',
			'suppress_filters' => false,
			'tax_query'        => array(
				array(
					'taxonomy' => SKYBIRD_PROJECTS_TAXONOMY,
					'field'    => 'term_id',
					'terms'    => $term->term_id,
				),
			),
		)
	);

	if ( ! $projects ) {
		// Not an error — a service area with no published projects yet. Render
		// nothing on the front end rather than an empty box.
		return '';
	}

	$pins  = array();
	$items = array();

	foreach ( $projects as $project ) {
		$lat = get_post_meta( $project->ID, 'approx_lat', true );
		$lng = get_post_meta( $project->ID, 'approx_lng', true );
		$url = get_permalink( $project );

		$items[] = sprintf(
			'<li class="skybird-map__item"><a href="%s">%s</a></li>',
			esc_url( $url ),
			esc_html( get_the_title( $project ) )
		);

		// A project with no offset coordinates still appears in the list — it
		// just gets no pin. Better a linked project with no pin than a pin at
		// 0,0 or a project missing from the page entirely.
		if ( '' === $lat || '' === $lng ) {
			continue;
		}

		$pins[] = array(
			'lat'   => (float) $lat,
			'lng'   => (float) $lng,
			'title' => get_the_title( $project ),
			'url'   => $url,
			'thumb' => get_the_post_thumbnail_url( $project, 'medium' ),
		);
	}

	$map_id  = 'skybird-map-' . $area;
	$api_key = skybird_projects_maps_api_key();

	$html  = '<div class="skybird-map" data-skybird-map="' . esc_attr( $area ) . '">';
	$html .= '<ul class="skybird-map__list">' . implode( '', $items ) . '</ul>';

	if ( $api_key && $pins ) {
		$html .= sprintf(
			'<div class="skybird-map__canvas" id="%s" data-pins="%s" aria-hidden="true"></div>',
			esc_attr( $map_id ),
			esc_attr( wp_json_encode( $pins ) )
		);

		skybird_projects_enqueue_map( $api_key );
	}

	$html .= '</div>';

	return $html;
}
add_shortcode( SKYBIRD_PROJECTS_MAP_SHORTCODE, 'skybird_projects_map_shortcode' );

/**
 * An editor-only message.
 *
 * A misconfigured shortcode should be obvious to whoever is editing the page
 * and invisible to visitors — a visitor can't fix a bad `area` attribute, and
 * showing them an error is worse than showing them nothing.
 *
 * @param string $message Message text.
 * @return string
 */
function skybird_projects_map_notice( $message ) {
	if ( ! current_user_can( 'edit_pages' ) ) {
		return '';
	}

	return '<p class="skybird-map__notice"><strong>' .
		esc_html__( 'Skybird project map:', 'skybird-projects' ) . '</strong> ' .
		esc_html( $message ) . '</p>';
}

/**
 * The Google Maps JavaScript API key.
 *
 * docs/03-structure-signoff.md §4 recommends the Google Maps JS API — the same
 * family as the single-pin embed already near the site footer — which needs a
 * key and a billing account set up separately. There is no key yet, so this
 * returns '' and the widget stays a server-rendered link list until one
 * exists. That is a working state, not a broken one.
 *
 * Settable by option or filter so no credential lives in this repo.
 *
 * @return string
 */
function skybird_projects_maps_api_key() {
	$key = get_option( 'skybird_projects_maps_api_key', '' );

	/**
	 * Filter the Google Maps API key.
	 *
	 * @param string $key API key.
	 */
	return (string) apply_filters( 'skybird_projects_maps_api_key', $key );
}

/**
 * Queue the map script once, however many widgets are on the page.
 *
 * @param string $api_key Google Maps JS API key.
 */
function skybird_projects_enqueue_map( $api_key ) {
	if ( wp_script_is( 'skybird-projects-map', 'enqueued' ) ) {
		return;
	}

	wp_enqueue_script(
		'skybird-projects-map',
		SKYBIRD_PROJECTS_URL . 'assets/map.js',
		array(),
		SKYBIRD_PROJECTS_VERSION,
		true
	);

	wp_enqueue_script(
		'google-maps',
		add_query_arg(
			array(
				'key'      => $api_key,
				'callback' => 'skybirdProjectsInitMaps',
				'loading'  => 'async',
			),
			'https://maps.googleapis.com/maps/api/js'
		),
		array( 'skybird-projects-map' ),
		null,
		true
	);
}

/**
 * Does the current page run the map shortcode?
 *
 * Used to decide whether to load the stylesheet.
 *
 * @return bool
 */
function skybird_projects_page_has_map() {
	$post = get_post();

	if ( ! $post ) {
		return false;
	}

	return has_shortcode( (string) $post->post_content, SKYBIRD_PROJECTS_MAP_SHORTCODE );
}
