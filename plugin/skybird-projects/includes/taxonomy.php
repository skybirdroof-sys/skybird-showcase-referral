<?php
/**
 * The `service_area` taxonomy, and the eight terms it ships with.
 *
 * @package Skybird_Projects
 */

defined( 'ABSPATH' ) || exit;

/**
 * The eight service areas, from docs/03-structure-signoff.md §4.
 *
 * The `page` value is the canonical service-area page each project links back
 * to. Euan confirmed (docs/09-euan-answers.md §1) that the `-nc` form is
 * canonical and the bare form redirects to it, so the back-link must use
 * `-nc` — linking to a redirect on every project page would be a needless hop
 * on the exact internal link the SEO structure depends on.
 *
 * @return array[] Each entry: name, slug, page.
 */
function skybird_projects_service_areas() {
	$areas = array(
		'franklinton' => 'Franklinton',
		'goldsboro'   => 'Goldsboro',
		'greenville'  => 'Greenville',
		'knightdale'  => 'Knightdale',
		'raleigh'     => 'Raleigh',
		'rolesville'  => 'Rolesville',
		'wake-forest' => 'Wake Forest',
		'youngsville' => 'Youngsville',
	);

	$out = array();

	foreach ( $areas as $slug => $name ) {
		$out[] = array(
			'name' => $name,
			'slug' => $slug,
			'page' => '/service-areas/' . $slug . '-nc/',
		);
	}

	/**
	 * Filter the service areas.
	 *
	 * Here so a ninth area can be added without editing the plugin, and so the
	 * page paths can be corrected if Pitch Peak restructures the URLs.
	 *
	 * @param array[] $out Service area definitions.
	 */
	return apply_filters( 'skybird_projects_service_areas', $out );
}

/**
 * Register the taxonomy.
 *
 * `public => false` with `publicly_queryable => false` is deliberate. A
 * public taxonomy would give every area a term archive at
 * /service-area/{slug}/ — a second set of indexable hubs, which is precisely
 * what Euan ruled out (docs/09-euan-answers.md §3.5). The eight existing
 * service-area pages are the hubs; this taxonomy exists to group projects for
 * the map shortcode and the back-link, not to generate pages of its own.
 *
 * `show_in_rest` stays true regardless — it is independent of `public`, and
 * n8n has to be able to assign the term when it creates the draft.
 */
function skybird_projects_register_taxonomy() {
	register_taxonomy(
		SKYBIRD_PROJECTS_TAXONOMY,
		array( SKYBIRD_PROJECTS_POST_TYPE ),
		array(
			// EVERY label, not just the obvious ones.
			//
			// WordPress fills any label you omit from a per-type default set,
			// and for a hierarchical taxonomy those defaults are the
			// *category* ones. A first pass here defined the fifteen obvious
			// labels and the admin still read "Filter by category", "No
			// categories", "Categories list" — because those are the labels
			// nobody thinks to set. Found on a real install 2026-09-17, twice:
			// once in a screenshot, then again by the self-test after a
			// partial fix.
			//
			// The rule: with a custom taxonomy, define the whole set or accept
			// category wording somewhere you are not looking.
			'labels'             => array(
				'name'                       => _x( 'Service Areas', 'taxonomy general name', 'skybird-projects' ),
				'singular_name'              => _x( 'Service Area', 'taxonomy singular name', 'skybird-projects' ),
				'menu_name'                  => __( 'Service Areas', 'skybird-projects' ),
				'all_items'                  => __( 'All Service Areas', 'skybird-projects' ),
				'edit_item'                  => __( 'Edit Service Area', 'skybird-projects' ),
				'view_item'                  => __( 'View Service Area', 'skybird-projects' ),
				'update_item'                => __( 'Update Service Area', 'skybird-projects' ),
				'add_new_item'               => __( 'Add New Service Area', 'skybird-projects' ),
				'new_item_name'              => __( 'New Service Area Name', 'skybird-projects' ),
				'parent_item'                => __( 'Parent Service Area', 'skybird-projects' ),
				'parent_item_colon'          => __( 'Parent Service Area:', 'skybird-projects' ),
				'search_items'               => __( 'Search Service Areas', 'skybird-projects' ),
				'not_found'                  => __( 'No service areas found.', 'skybird-projects' ),
				'no_terms'                   => __( 'No service areas', 'skybird-projects' ),
				'filter_by_item'             => __( 'Filter by service area', 'skybird-projects' ),
				'items_list_navigation'      => __( 'Service areas list navigation', 'skybird-projects' ),
				'items_list'                 => __( 'Service areas list', 'skybird-projects' ),
				'most_used'                  => __( 'Most Used', 'skybird-projects' ),
				'back_to_items'              => __( '&larr; Go to Service Areas', 'skybird-projects' ),
				'archives'                   => __( 'All Service Areas', 'skybird-projects' ),
				'template_name'              => __( 'Service Area Archives', 'skybird-projects' ),
				'item_link'                  => _x( 'Service Area Link', 'navigation link block title', 'skybird-projects' ),
				'item_link_description'      => _x( 'A link to a service area.', 'navigation link block description', 'skybird-projects' ),
				'name_field_description'     => __( 'The service area name, as it appears on the project page and its back-link.', 'skybird-projects' ),
				'slug_field_description'     => __( 'The URL-friendly version of the name. Must match the area page slug, without the -nc suffix.', 'skybird-projects' ),
				'parent_field_description'   => __( 'Service areas are flat in practice — leave this as None.', 'skybird-projects' ),
				'desc_field_description'     => __( 'Not shown anywhere on the site. Optional.', 'skybird-projects' ),
			),
			'public'             => false,
			'publicly_queryable' => false,
			'show_ui'            => true,
			'show_admin_column'  => true,
			'hierarchical'       => true,
			'show_in_rest'       => true,
			'rest_base'          => 'service-areas',
			'meta_box_cb'        => 'post_categories_meta_box',
		)
	);

	register_term_meta(
		SKYBIRD_PROJECTS_TAXONOMY,
		'service_area_page',
		array(
			'type'              => 'string',
			'single'            => true,
			'show_in_rest'      => true,
			'sanitize_callback' => 'sanitize_text_field',
			'description'       => 'Site-relative path of this area\'s canonical service-area page.',
		)
	);
}
add_action( 'init', 'skybird_projects_register_taxonomy' );

/**
 * Create any of the eight terms that don't exist yet.
 *
 * Runs on activation only. Idempotent — an existing slug comes back as a
 * WP_Error which we skip, so re-activating never duplicates or renames.
 * The page path is refreshed on every run so a corrected path in
 * skybird_projects_service_areas() propagates on reactivation.
 */
function skybird_projects_seed_service_areas() {
	foreach ( skybird_projects_service_areas() as $area ) {
		$term = get_term_by( 'slug', $area['slug'], SKYBIRD_PROJECTS_TAXONOMY );

		if ( ! $term ) {
			$result = wp_insert_term(
				$area['name'],
				SKYBIRD_PROJECTS_TAXONOMY,
				array( 'slug' => $area['slug'] )
			);

			if ( is_wp_error( $result ) ) {
				continue;
			}

			$term_id = $result['term_id'];
		} else {
			$term_id = $term->term_id;
		}

		update_term_meta( $term_id, 'service_area_page', $area['page'] );
	}
}

/**
 * The canonical service-area page path for a project, for the back-link.
 *
 * @param int $post_id Project post ID.
 * @return string Site-relative path, or '' if the project has no area.
 */
function skybird_projects_get_area_page( $post_id ) {
	$terms = get_the_terms( $post_id, SKYBIRD_PROJECTS_TAXONOMY );

	if ( empty( $terms ) || is_wp_error( $terms ) ) {
		return '';
	}

	$term = reset( $terms );
	$path = get_term_meta( $term->term_id, 'service_area_page', true );

	return $path ? $path : '/service-areas/' . $term->slug . '-nc/';
}
