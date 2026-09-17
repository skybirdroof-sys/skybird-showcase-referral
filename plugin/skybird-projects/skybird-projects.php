<?php
/**
 * Plugin Name:       Skybird Projects
 * Plugin URI:        https://github.com/skybirdroof-sys/skybird-showcase-referral
 * Description:       Registers the project post type, the service-area taxonomy, and the fields the Showcase automation writes to. Ships the project page template and the per-service-area map shortcode.
 * Version:           0.1.0
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            Skybird Roofing
 * License:           GPL-2.0-or-later
 * Text Domain:       skybird-projects
 *
 * Owned by Skybird, installed by Pitch Peak — see docs/09-euan-answers.md.
 *
 * Deliberately NOT in the theme: a theme update must not be able to remove the
 * post type or its data. Hub Child is already a child theme, but keeping this
 * in a plugin also keeps it versioned in Skybird's repo.
 *
 * @package Skybird_Projects
 */

defined( 'ABSPATH' ) || exit;

define( 'SKYBIRD_PROJECTS_VERSION', '0.1.0' );
define( 'SKYBIRD_PROJECTS_FILE', __FILE__ );
define( 'SKYBIRD_PROJECTS_DIR', plugin_dir_path( __FILE__ ) );
define( 'SKYBIRD_PROJECTS_URL', plugin_dir_url( __FILE__ ) );

/** Post type key. `rest_base` is `projects`, so n8n posts to /wp-json/wp/v2/projects. */
define( 'SKYBIRD_PROJECTS_POST_TYPE', 'project' );

/** Service-area taxonomy key. */
define( 'SKYBIRD_PROJECTS_TAXONOMY', 'service_area' );

require_once SKYBIRD_PROJECTS_DIR . 'includes/post-type.php';
require_once SKYBIRD_PROJECTS_DIR . 'includes/taxonomy.php';
require_once SKYBIRD_PROJECTS_DIR . 'includes/meta.php';
require_once SKYBIRD_PROJECTS_DIR . 'includes/rest.php';
require_once SKYBIRD_PROJECTS_DIR . 'includes/acf-fields.php';
require_once SKYBIRD_PROJECTS_DIR . 'includes/template.php';
require_once SKYBIRD_PROJECTS_DIR . 'includes/map-shortcode.php';

/**
 * Seed the eight service areas and flush rewrites.
 *
 * Terms are seeded rather than left to whoever sets the site up, so the
 * taxonomy the automation assigns against exists the moment the plugin is
 * active. Re-running is harmless: wp_insert_term returns an error for a slug
 * that already exists and we ignore it.
 */
function skybird_projects_activate() {
	skybird_projects_register_post_type();
	skybird_projects_register_taxonomy();
	skybird_projects_seed_service_areas();

	flush_rewrite_rules();
}
register_activation_hook( __FILE__, 'skybird_projects_activate' );

/**
 * Drop the /projects/{slug}/ rules on the way out so they don't 404 silently.
 *
 * Content is left alone — deactivating must not delete anyone's project pages.
 */
function skybird_projects_deactivate() {
	flush_rewrite_rules();
}
register_deactivation_hook( __FILE__, 'skybird_projects_deactivate' );

/**
 * Warn in the admin if ACF is missing.
 *
 * ACF free supplies the editing UI for the reviewer-edited fields (see
 * includes/acf-fields.php). Without it every field is still registered and
 * still writable over REST — the human review gate just loses its form. That
 * is worth a notice, not a hard dependency.
 */
function skybird_projects_admin_notices() {
	if ( function_exists( 'acf_add_local_field_group' ) ) {
		return;
	}

	if ( ! current_user_can( 'activate_plugins' ) ) {
		return;
	}

	printf(
		'<div class="notice notice-warning"><p>%s</p></div>',
		esc_html__(
			'Skybird Projects: Advanced Custom Fields is not active. Project data still saves and the automation still works, but the product, location and warranty fields have no editing form on the project screen.',
			'skybird-projects'
		)
	);
}
add_action( 'admin_notices', 'skybird_projects_admin_notices' );
