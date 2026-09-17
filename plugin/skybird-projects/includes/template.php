<?php
/**
 * Template loading and the share URL.
 *
 * The single-project template ships from the plugin via `template_include`
 * rather than as single-project.php in the Hub Child theme. Hub Child is
 * already a child theme so a parent update wouldn't remove it — but keeping
 * the template here keeps it versioned in this repo, which is the point of
 * Skybird owning the plugin (docs/09-euan-answers.md §3.4).
 *
 * The theme can still win: if Pitch Peak ever drops a single-project.php into
 * Hub Child, locate_template() finds it and we stand aside.
 *
 * @package Skybird_Projects
 */

defined( 'ABSPATH' ) || exit;

/**
 * Serve the plugin's template for a single project.
 *
 * @param string $template Template path WordPress resolved.
 * @return string
 */
function skybird_projects_template_include( $template ) {
	if ( ! is_singular( SKYBIRD_PROJECTS_POST_TYPE ) ) {
		return $template;
	}

	$theme_template = locate_template( array( 'single-' . SKYBIRD_PROJECTS_POST_TYPE . '.php' ) );

	if ( $theme_template ) {
		return $theme_template;
	}

	return SKYBIRD_PROJECTS_DIR . 'templates/single-project.php';
}
add_filter( 'template_include', 'skybird_projects_template_include' );

/**
 * Front-end styles.
 *
 * Loaded on single projects and on any page running the map shortcode. Kept as
 * one small file rather than inline so Pitch Peak's caching can serve it.
 */
function skybird_projects_enqueue_styles() {
	if ( ! is_singular( SKYBIRD_PROJECTS_POST_TYPE ) && ! skybird_projects_page_has_map() ) {
		return;
	}

	wp_enqueue_style(
		'skybird-projects',
		SKYBIRD_PROJECTS_URL . 'assets/skybird-projects.css',
		array(),
		SKYBIRD_PROJECTS_VERSION
	);
}
add_action( 'wp_enqueue_scripts', 'skybird_projects_enqueue_styles' );

/**
 * Generated alt text for a project's images.
 *
 * Built from this project's own stored product and location fields — which
 * originate in the ProLine job record — and never from CompanyCam.
 *
 * Two reasons, both from decisions already taken:
 *
 * 1. There is nothing to read from CompanyCam. Every curated photo on the
 *    Phase 1 test project has `description: null`
 *    (docs/07-phase-4-preflight.md §2.4). The caption seed the original audit
 *    assumed simply isn't there.
 * 2. More importantly, CompanyCam project data carries the homeowner's name,
 *    phone, email and street address. Deriving alt text from it would put PII
 *    into the pipeline and then require scrubbing it back out of every
 *    generated string — a control that fails silently, where one unusual
 *    address format ships a street address in an `alt` attribute. Building
 *    from structured product fields means the PII is never in the pipeline
 *    (docs/07-phase-4-preflight.md §2.4.1).
 *
 * Falls back to a deliberately PII-free sentence while the product fields are
 * empty, which they are until the ProLine read path is resolved.
 *
 * @param int $post_id Project post ID.
 * @return string
 */
function skybird_projects_image_alt( $post_id ) {
	$manufacturer = (string) get_post_meta( $post_id, 'manufacturer', true );
	$product_line = (string) get_post_meta( $post_id, 'product_line', true );
	$color        = (string) get_post_meta( $post_id, 'color', true );

	$terms = get_the_terms( $post_id, SKYBIRD_PROJECTS_TAXONOMY );
	$area  = ( ! empty( $terms ) && ! is_wp_error( $terms ) ) ? reset( $terms )->name : '';

	if ( ! $area ) {
		$area = (string) get_post_meta( $post_id, 'city', true );
	}

	$product = trim( $manufacturer . ' ' . $product_line );

	if ( $product ) {
		// "New GAF Timberline HDZ shingle roof, Charcoal, Wake Forest NC"
		$parts = array( sprintf( 'New %s shingle roof', $product ) );

		if ( $color ) {
			$parts[] = $color;
		}

		if ( $area ) {
			$parts[] = $area . ' NC';
		}

		return implode( ', ', $parts );
	}

	if ( $area ) {
		return sprintf( 'Completed roof replacement in %s, NC', $area );
	}

	return 'Completed roof replacement by Skybird Roofing';
}

/**
 * The Facebook share URL for a project, with the referral code attached.
 *
 * Per docs/03-structure-signoff.md §2 this is a confirmed requirement, and
 * docs/05-data-model.md §6 specifies the `?ref=` parameter that starts the
 * attribution chain. The code comes from the project's own meta so the page
 * builds the URL without a live lookup.
 *
 * Returns '' when there is no code — Phase 4 has no ambassadors yet, and a
 * share button that attributes nothing is worse than no button, because the
 * share still happens and the credit silently goes nowhere.
 *
 * @param int $post_id Project post ID.
 * @return string Absolute sharer URL, or ''.
 */
function skybird_projects_share_url( $post_id ) {
	$code = get_post_meta( $post_id, 'ambassador_referral_code', true );

	if ( ! $code ) {
		return '';
	}

	$project_url = add_query_arg( 'ref', $code, get_permalink( $post_id ) );

	return 'https://www.facebook.com/sharer/sharer.php?u=' . rawurlencode( $project_url );
}
