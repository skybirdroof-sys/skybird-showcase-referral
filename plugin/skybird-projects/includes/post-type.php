<?php
/**
 * The `project` post type.
 *
 * @package Skybird_Projects
 */

defined( 'ABSPATH' ) || exit;

/**
 * Register the post type.
 *
 * Three settings here are decisions rather than defaults, and each has a
 * reason recorded in docs/:
 *
 * - `has_archive => false`. Euan was explicit (docs/09-euan-answers.md §3.5):
 *   a hub per service area, not one master projects page. Left at the default
 *   WordPress would publish an indexable /projects/ archive listing every
 *   project, competing with the eight service-area pages this whole structure
 *   exists to funnel into. Individual pages still resolve at
 *   /projects/{slug}/ — the rewrite slug does that, not the archive.
 *
 * - `supports` includes `custom-fields`. This is not cosmetic: post meta
 *   registered with show_in_rest is only exposed on a post type that declares
 *   custom-fields support. Without it every field in includes/meta.php would
 *   register cleanly and then be invisible to the REST write n8n makes.
 *
 * - `rest_base => 'projects'`. Matches docs/01-api-audit.md §2.3 so the
 *   endpoint is /wp-json/wp/v2/projects, not /wp-json/wp/v2/project.
 */
function skybird_projects_register_post_type() {
	$labels = array(
		'name'               => _x( 'Projects', 'post type general name', 'skybird-projects' ),
		'singular_name'      => _x( 'Project', 'post type singular name', 'skybird-projects' ),
		'menu_name'          => _x( 'Projects', 'admin menu', 'skybird-projects' ),
		'add_new_item'       => __( 'Add New Project', 'skybird-projects' ),
		'edit_item'          => __( 'Edit Project', 'skybird-projects' ),
		'view_item'          => __( 'View Project', 'skybird-projects' ),
		'all_items'          => __( 'All Projects', 'skybird-projects' ),
		'search_items'       => __( 'Search Projects', 'skybird-projects' ),
		'not_found'          => __( 'No projects found.', 'skybird-projects' ),
		'featured_image'     => __( 'Cover photo', 'skybird-projects' ),
		'set_featured_image' => __( 'Set cover photo', 'skybird-projects' ),
	);

	register_post_type(
		SKYBIRD_PROJECTS_POST_TYPE,
		array(
			'labels'       => $labels,
			'public'       => true,
			'has_archive'  => false,
			'rewrite'      => array(
				'slug'       => 'projects',
				'with_front' => false,
			),
			'show_in_rest' => true,
			'rest_base'    => 'projects',
			'menu_icon'    => 'dashicons-camera',
			'menu_position'=> 21,
			'supports'     => array(
				'title',
				'editor',
				'excerpt',
				'thumbnail',
				'custom-fields',
				'revisions',
			),
			'taxonomies'   => array( SKYBIRD_PROJECTS_TAXONOMY ),
			'map_meta_cap' => true,
		)
	);
}
add_action( 'init', 'skybird_projects_register_post_type' );
