<?php
/**
 * The ACF form for the reviewer-edited fields.
 *
 * Registered in PHP via acf_add_local_field_group() rather than clicked
 * together in the ACF admin UI, so the field group is versioned in this repo
 * alongside everything else the plugin owns. Nobody has to reproduce a field
 * group by hand on a second install.
 *
 * These fields point at the SAME meta keys registered in includes/meta.php —
 * ACF is the editing surface, native meta is the storage and the REST
 * contract. That is why the group sets `show_in_rest => false`: exposing it
 * would give every field two write paths (the `acf` object and the `meta`
 * object) with no way to say which wins.
 *
 * All of these are ACF free field types. Nothing here needs ACF Pro — the one
 * field that would have (Gallery) is native meta instead, per
 * docs/09-euan-answers.md §3.1.
 *
 * @package Skybird_Projects
 */

defined( 'ABSPATH' ) || exit;

/**
 * Register the field group.
 *
 * Guarded: if ACF is inactive the plugin still works and the admin sees a
 * notice (see skybird_projects_admin_notices()). The data does not depend on
 * ACF being present.
 */
function skybird_projects_register_acf_fields() {
	if ( ! function_exists( 'acf_add_local_field_group' ) ) {
		return;
	}

	$fields = array();

	// Location block. City/neighborhood/ZIP are display text only — the street
	// address is never stored (docs/05-data-model.md §1).
	$fields[] = array(
		'key'   => 'field_skybird_tab_location',
		'label' => __( 'Location', 'skybird-projects' ),
		'type'  => 'tab',
	);

	foreach ( array( 'city', 'neighborhood', 'zip' ) as $key ) {
		$fields[] = skybird_projects_acf_text_field( $key );
	}

	$fields[] = array(
		'key'     => 'field_skybird_location_note',
		'label'   => '',
		'type'    => 'message',
		'message' => __( 'City, neighborhood and ZIP only. Never the street address. The map pin uses stored offset coordinates, not the real location.', 'skybird-projects' ),
	);

	// Product block. Pulled from the ProLine job record, not guessed from the
	// photos (docs/06-trigger-design.md §3).
	$fields[] = array(
		'key'   => 'field_skybird_tab_product',
		'label' => __( 'Product', 'skybird-projects' ),
		'type'  => 'tab',
	);

	foreach ( array( 'manufacturer', 'product_line', 'color', 'warranty' ) as $key ) {
		$fields[] = skybird_projects_acf_text_field( $key );
	}

	$fields[] = array(
		'key'     => 'field_skybird_product_note',
		'label'   => '',
		'type'    => 'message',
		'message' => __( 'Take these from the ProLine job record — do not guess them from the photos. Nothing populates them automatically yet.', 'skybird-projects' ),
	);

	// Job block.
	$fields[] = array(
		'key'   => 'field_skybird_tab_job',
		'label' => __( 'Job', 'skybird-projects' ),
		'type'  => 'tab',
	);

	$fields[] = array(
		'key'           => 'field_skybird_completion_date',
		'label'         => __( 'Completion date', 'skybird-projects' ),
		'name'          => 'completion_date',
		'type'          => 'date_picker',
		'display_format'=> 'F j, Y',
		'return_format' => 'Y-m-d',
		'first_day'     => 0,
	);

	acf_add_local_field_group(
		array(
			'key'                   => 'group_skybird_project',
			'title'                 => __( 'Project details', 'skybird-projects' ),
			'fields'                => $fields,
			'location'              => array(
				array(
					array(
						'param'    => 'post_type',
						'operator' => '==',
						'value'    => SKYBIRD_PROJECTS_POST_TYPE,
					),
				),
			),
			'position'              => 'normal',
			'style'                 => 'default',
			'label_placement'       => 'top',
			'active'                => true,
			'show_in_rest'          => false,
			'hide_on_screen'        => array( 'custom_fields' ),
			'description'           => 'Registered in PHP by the Skybird Projects plugin. Edit the plugin, not this screen.',
		)
	);
}
add_action( 'acf/init', 'skybird_projects_register_acf_fields' );

/**
 * A plain ACF text field bound to one of our meta keys.
 *
 * @param string $key Meta key, which is also the ACF field name.
 * @return array ACF field definition.
 */
function skybird_projects_acf_text_field( $key ) {
	$fields = skybird_projects_meta_fields();
	$label  = isset( $fields[ $key ]['label'] ) ? $fields[ $key ]['label'] : $key;

	return array(
		'key'   => 'field_skybird_' . $key,
		'label' => $label,
		'name'  => $key,
		'type'  => 'text',
	);
}
