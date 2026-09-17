<?php
/**
 * REST additions the automation needs.
 *
 * One thing: a way to ask "does a project already exist for this CompanyCam
 * ID?" before creating another one.
 *
 * Why this is needed rather than nice to have — `project.label_added` fires
 * for ANY label added to a project, and the account has eight project labels
 * (docs/07-phase-4-preflight.md §2.3). So the workflow gets woken by a
 * `Pipedrive Deal` label on a project that was already showcased last month,
 * and the payload alone can't tell it that a draft already exists. Without a
 * lookup the workflow would create a second draft every time anyone touches
 * any label on a showcased project.
 *
 * WordPress has no built-in way to filter a REST collection by meta value, so
 * this adds exactly one parameter and nothing else.
 *
 * @package Skybird_Projects
 */

defined( 'ABSPATH' ) || exit;

/**
 * Allow ?companycam_project_id= on the projects collection.
 *
 * Registered as a collection param so it appears in the endpoint's schema —
 * self-documenting for whoever builds the workflow, rather than an
 * undocumented parameter that happens to work.
 *
 * @param array $params Collection parameters.
 * @return array
 */
function skybird_projects_rest_collection_params( $params ) {
	$params['companycam_project_id'] = array(
		'description'       => 'Limit results to the project mirroring this CompanyCam project ID.',
		'type'              => 'string',
		'sanitize_callback' => 'sanitize_text_field',
	);

	return $params;
}
add_filter( 'rest_project_collection_params', 'skybird_projects_rest_collection_params' );

/**
 * Apply the filter to the query.
 *
 * @param array           $args    WP_Query args.
 * @param WP_REST_Request $request The request.
 * @return array
 */
function skybird_projects_rest_query( $args, $request ) {
	$companycam_id = $request->get_param( 'companycam_project_id' );

	if ( ! $companycam_id ) {
		return $args;
	}

	if ( ! isset( $args['meta_query'] ) || ! is_array( $args['meta_query'] ) ) {
		$args['meta_query'] = array();
	}

	$args['meta_query'][] = array(
		'key'     => 'companycam_project_id',
		'value'   => (string) $companycam_id,
		'compare' => '=',
	);

	return $args;
}
add_filter( 'rest_project_query', 'skybird_projects_rest_query', 10, 2 );
