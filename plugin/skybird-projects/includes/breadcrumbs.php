<?php
/**
 * Breadcrumbs, and the BreadcrumbList that matches them.
 *
 * ## Why this exists
 *
 * docs/13-page-definition.md §6 makes this item 1 of the page, for the
 * stranger more than for Google: a referred visitor arrives on a page about
 * somebody else's house with no idea where they are on the site. Google's own
 * guidance asks for breadcrumbs "that represent a typical user path to a page"
 * [G-BC].
 *
 * ## The 404 this closes
 *
 * `skybird_projects_get_area_page()` falls back to a guessed path —
 * `/service-areas/{slug}-nc/` — when a term has no stored page. That guess was
 * written when there were eight service areas and every one had a hub page on
 * skybirdroofing.net. There are now fourteen, and six of them (Pikeville,
 * Wilson, La Grange, Winterville, Durham, Zebulon) were added from the
 * Production HQ sheet without anyone checking whether a hub page exists. So
 * the footer back-link on any project in those towns points at a page that
 * almost certainly 404s, and a breadcrumb would have made it two dead links
 * instead of one.
 *
 * So every crumb here is resolved before it is rendered. A crumb whose page
 * does not exist is dropped from the HTML *and* from the JSON-LD — not
 * rendered as plain text, because the publish gate requires the visible trail
 * and the structured data to match, and because Google's spec only lets the
 * LAST item omit its `item` URL [G-BC]. An unresolvable crumb in the middle
 * cannot be expressed as valid BreadcrumbList at all.
 *
 * A missing hub is therefore quietly invisible rather than broken. It is still
 * a thing to fix — the hub pages need building — but a visitor never meets it.
 *
 * @package Skybird_Projects
 */

defined( 'ABSPATH' ) || exit;

/**
 * Does a page exist at this site-relative path?
 *
 * @param string $path Site-relative path, with or without slashes.
 * @return bool
 */
function skybird_projects_page_exists( $path ) {
	$path = trim( (string) $path, '/' );

	if ( '' === $path ) {
		return false;
	}

	return (bool) get_page_by_path( $path );
}

/**
 * The service-area hub URL for a project, but only if it is really there.
 *
 * @param int $post_id Project post ID.
 * @return string Absolute URL, or '' when there is no hub page to point at.
 */
function skybird_projects_area_page_url( $post_id ) {
	$path = skybird_projects_get_area_page( $post_id );

	if ( ! $path || ! skybird_projects_page_exists( $path ) ) {
		return '';
	}

	return home_url( $path );
}

/**
 * The trail, resolved.
 *
 * The last crumb is the current page and carries no URL, which is what
 * Google's spec permits for the final item [G-BC].
 *
 * @param int $post_id Project post ID.
 * @return array[] Each: label, url ('' on the current page).
 */
function skybird_projects_breadcrumbs( $post_id ) {
	$crumbs = array(
		array(
			'label' => __( 'Home', 'skybird-projects' ),
			'url'   => home_url( '/' ),
		),
	);

	// The index of service-area pages, if the site has one. It is a theme page
	// outside this plugin's control, so it is checked rather than assumed.
	if ( skybird_projects_page_exists( 'service-areas' ) ) {
		$crumbs[] = array(
			'label' => __( 'Service areas', 'skybird-projects' ),
			'url'   => home_url( '/service-areas/' ),
		);
	}

	$area_url = skybird_projects_area_page_url( $post_id );

	if ( $area_url ) {
		$terms = get_the_terms( $post_id, SKYBIRD_PROJECTS_TAXONOMY );
		$name  = ( ! empty( $terms ) && ! is_wp_error( $terms ) ) ? reset( $terms )->name : '';

		if ( $name ) {
			$crumbs[] = array(
				'label' => $name,
				'url'   => $area_url,
			);
		}
	}

	// Mirrors the H1 rather than re-deriving a name, so the trail reads as the
	// path to the heading the visitor is looking at.
	$crumbs[] = array(
		'label' => skybird_projects_og_title( $post_id ),
		'url'   => '',
	);

	return $crumbs;
}

/**
 * The BreadcrumbList, as JSON-LD.
 *
 * Google wants at least two ListItems, and allows the last to omit `item`
 * [G-BC]. Returns '' below two, because a one-item list is invalid structured
 * data and emitting invalid markup is worse than emitting none.
 *
 * @param int $post_id Project post ID.
 * @return string JSON, or ''.
 */
function skybird_projects_breadcrumb_jsonld( $post_id ) {
	$crumbs = skybird_projects_breadcrumbs( $post_id );

	if ( count( $crumbs ) < 2 ) {
		return '';
	}

	$items = array();

	foreach ( $crumbs as $i => $crumb ) {
		$item = array(
			'@type'    => 'ListItem',
			'position' => $i + 1,
			'name'     => $crumb['label'],
		);

		if ( '' !== $crumb['url'] ) {
			$item['item'] = $crumb['url'];
		}

		$items[] = $item;
	}

	return wp_json_encode(
		array(
			'@context'        => 'https://schema.org',
			'@type'           => 'BreadcrumbList',
			'itemListElement' => $items,
		)
	);
}

/**
 * Print the JSON-LD.
 */
function skybird_projects_print_breadcrumb_jsonld() {
	if ( ! is_singular( SKYBIRD_PROJECTS_POST_TYPE ) ) {
		return;
	}

	$post_id = get_the_ID();

	if ( ! $post_id ) {
		return;
	}

	$json = skybird_projects_breadcrumb_jsonld( $post_id );

	if ( ! $json ) {
		return;
	}

	printf(
		'<script type="application/ld+json">%s</script>' . "\n",
		$json // phpcs:ignore WordPress.Security.EscapeOutput -- wp_json_encode output, inside a script tag.
	);
}
add_action( 'wp_head', 'skybird_projects_print_breadcrumb_jsonld', 6 );

/**
 * Render the visible trail.
 *
 * @param int $post_id Project post ID.
 * @return string HTML, or '' when there is nothing worth showing.
 */
function skybird_projects_breadcrumb_html( $post_id ) {
	$crumbs = skybird_projects_breadcrumbs( $post_id );

	if ( count( $crumbs ) < 2 ) {
		return '';
	}

	$parts = array();

	foreach ( $crumbs as $crumb ) {
		if ( '' === $crumb['url'] ) {
			$parts[] = sprintf(
				'<span aria-current="page">%s</span>',
				esc_html( $crumb['label'] )
			);
			continue;
		}

		$parts[] = sprintf(
			'<a href="%s">%s</a>',
			esc_url( $crumb['url'] ),
			esc_html( $crumb['label'] )
		);
	}

	return sprintf(
		'<nav class="skybird-project__breadcrumbs" aria-label="%s">%s</nav>',
		esc_attr__( 'Breadcrumb', 'skybird-projects' ),
		implode( ' <span aria-hidden="true">&rsaquo;</span> ', $parts )
	);
}
