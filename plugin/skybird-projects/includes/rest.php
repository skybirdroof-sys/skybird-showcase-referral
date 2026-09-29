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

/**
 * Keep private meta out of the REST response for anyone who can't edit.
 *
 * `field_notes` mirrors CompanyCam's Project Description — the project
 * manager's own words about the job — and it is the one field in this plugin
 * that deliberately holds homeowner PII. It exists so the reviewer has real
 * specifics while writing the copy (docs/12-project-notes-path.md §4).
 *
 * Every field in includes/meta.php is registered `show_in_rest`, because n8n
 * has to write them. Read access rides along with the post: the moment a
 * project is **published**, `GET /wp-json/wp/v2/projects/{id}` hands its whole
 * `meta` object to anybody who asks. No template printing the notes does not
 * make them unreachable — and this project has already been bitten once by
 * exactly that distinction, when a photo nobody had looked at was public from
 * the instant it uploaded (docs/07-phase-4-preflight.md §16.3).
 *
 * So: written over REST by the automation, readable over REST only by someone
 * who could open the post in wp-admin anyway.
 *
 * Capability, not role. `edit_post` on this specific post is the same check
 * wp-admin makes, so a contributor who cannot edit a published project cannot
 * read its notes either.
 *
 * @param WP_REST_Response $response The response.
 * @param WP_Post          $post     The post.
 * @return WP_REST_Response
 */
function skybird_projects_hide_private_meta( $response, $post ) {
	if ( current_user_can( 'edit_post', $post->ID ) ) {
		return $response;
	}

	$data = $response->get_data();

	if ( ! isset( $data['meta'] ) || ! is_array( $data['meta'] ) ) {
		return $response;
	}

	foreach ( skybird_projects_meta_fields() as $key => $field ) {
		if ( ! empty( $field['private'] ) ) {
			unset( $data['meta'][ $key ] );
		}
	}

	$response->set_data( $data );

	return $response;
}
add_filter( 'rest_prepare_' . SKYBIRD_PROJECTS_POST_TYPE, 'skybird_projects_hide_private_meta', 10, 2 );
