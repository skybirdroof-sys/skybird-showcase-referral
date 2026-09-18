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
 * Open the page, whichever kind of theme is active.
 *
 * `get_header()` only works on a *classic* theme. A block theme has no
 * header.php, so WordPress falls through to the deprecated
 * wp-includes/theme-compat/header.php — which renders a bare site title and
 * tagline instead of the real site chrome. The page still loads, so this
 * fails quietly and looks like a styling problem rather than a template one.
 *
 * Found on a real preview, 2026-09-17: a TasteWP sandbox runs a block theme,
 * and the project page rendered inside "Just another WordPress site by
 * TasteWP.com" with none of the theme around it.
 *
 * Skybird's own site is Hub Child + WPBakery, which is classic, so production
 * was never at risk. Two reasons to handle it anyway: any sandbox used to
 * check this page is likely to be a block theme, so without this we cannot
 * see the real layout while verifying (docs/06-trigger-design.md §4 needs the
 * page eyeballed on a tablet); and if Pitch Peak ever re-themes, every project
 * page would silently lose its header and footer.
 */
function skybird_projects_header() {
	if ( ! function_exists( 'wp_is_block_theme' ) || ! wp_is_block_theme() ) {
		get_header();
		return;
	}

	printf(
		'<!DOCTYPE html><html %s><head><meta charset="%s">',
		get_language_attributes(), // phpcs:ignore WordPress.Security.EscapeOutput
		esc_attr( get_bloginfo( 'charset' ) )
	);

	wp_head();

	printf( '</head><body class="%s">', esc_attr( implode( ' ', get_body_class() ) ) );

	wp_body_open();

	if ( function_exists( 'block_template_part' ) ) {
		block_template_part( 'header' );
	}
}

/**
 * Close the page. Mirror of skybird_projects_header().
 */
function skybird_projects_footer() {
	if ( ! function_exists( 'wp_is_block_theme' ) || ! wp_is_block_theme() ) {
		get_footer();
		return;
	}

	if ( function_exists( 'block_template_part' ) ) {
		block_template_part( 'footer' );
	}

	wp_footer();

	echo '</body></html>';
}

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
 * The eyebrow line under the H1: where and when.
 *
 * Lives here rather than inline in the template so the suite can exercise it.
 * It has now shipped broken twice off the same assumption — that the H1 and
 * this line carry different facts — and both times a rendered page was the
 * only thing that caught it:
 *
 * - 2026-09-17: the line read "Roof replacement in {Area}, NC" under an H1
 *   already reading exactly that.
 * - 2026-09-18: shortened to area + completion date, it collapsed to
 *   "Youngsville, NC" under "Roof Replacement in Youngsville, NC" on a
 *   project with no completion_date. The first fix only hid the duplication
 *   on projects that happened to have a date set.
 *
 * So the area is printed only when the title does not already contain it.
 * Under the locked SEO title format (docs/06-trigger-design.md §3 — one job,
 * one town, roof replacement) the title always does, and this returns the
 * date alone. An editor who rewrites a title and drops the town gets the
 * area back automatically. Checked against the rendered title rather than
 * assumed in either direction.
 *
 * @param int $post_id Project post ID.
 * @return string Eyebrow text, or '' when there is nothing non-redundant.
 */
function skybird_projects_meta_line( $post_id ) {
	$terms = get_the_terms( $post_id, SKYBIRD_PROJECTS_TAXONOMY );
	$area  = ( ! empty( $terms ) && ! is_wp_error( $terms ) ) ? reset( $terms )->name : '';

	$bits = array();

	if ( $area && false === stripos( (string) get_the_title( $post_id ), $area ) ) {
		$bits[] = $area . ', NC';
	}

	$completed = get_post_meta( $post_id, 'completion_date', true );

	if ( $completed ) {
		// strtotime() returns false on junk, and date_i18n( 'F Y', false )
		// renders "December 1969" rather than failing. A malformed date from
		// the import is a bug to leave blank, not to publish as 1969.
		$timestamp = strtotime( (string) $completed );

		if ( $timestamp ) {
			$bits[] = sprintf(
				/* translators: %s: month and year, e.g. September 2026. */
				__( 'Completed %s', 'skybird-projects' ),
				date_i18n( 'F Y', $timestamp )
			);
		}
	}

	return implode( ' · ', $bits );
}

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
