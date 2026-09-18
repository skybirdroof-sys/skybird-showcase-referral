<?php
/**
 * Minimal WordPress stubs, so the plugin can be loaded and inspected without
 * a WordPress install.
 *
 * This is not a substitute for running the plugin on a real site — it cannot
 * tell you whether the REST write actually works, whether Application
 * Passwords authenticate, or whether the rewrite rules flush cleanly. What it
 * does catch, cheaply and on every change, is the class of mistake that is
 * invisible to `php -l` and expensive to find on a live site: a misspelled
 * argument key, a post type that forgot `custom-fields` support, a meta field
 * that never got registered, a sanitiser that accepts a value it should
 * reject.
 *
 * Every stub records what the plugin asked for so the tests can assert on it.
 *
 * @package Skybird_Projects
 */

define( 'ABSPATH', __DIR__ . '/' );

/** Captured calls, keyed by kind. */
$GLOBALS['wp_stub'] = array(
	'actions'     => array(),
	'filters'     => array(),
	'shortcodes'  => array(),
	'post_types'  => array(),
	'taxonomies'  => array(),
	'post_meta'   => array(),
	'term_meta'   => array(),
	'options'     => array(),
);

/** Test fixtures the stubs read from. */
$GLOBALS['wp_fixture'] = array(
	'post_meta' => array(),
	'terms'     => array(),
	'permalink' => 'https://skybirdroofing.net/projects/test-project/',
	'caps'      => true,
);

// --- Hooks -----------------------------------------------------------------

function add_action( $hook, $callback, $priority = 10, $args = 1 ) {
	$GLOBALS['wp_stub']['actions'][ $hook ][] = $callback;
	return true;
}

function add_filter( $hook, $callback, $priority = 10, $args = 1 ) {
	$GLOBALS['wp_stub']['filters'][ $hook ][] = $callback;
	return true;
}

function add_shortcode( $tag, $callback ) {
	$GLOBALS['wp_stub']['shortcodes'][ $tag ] = $callback;
}

function apply_filters( $hook, $value ) {
	return $value;
}

function register_activation_hook( $file, $callback ) {}
function register_deactivation_hook( $file, $callback ) {}

// --- Registration ----------------------------------------------------------

function register_post_type( $type, $args = array() ) {
	$GLOBALS['wp_stub']['post_types'][ $type ] = $args;
	return (object) array( 'name' => $type );
}

function register_taxonomy( $taxonomy, $object_type, $args = array() ) {
	$GLOBALS['wp_stub']['taxonomies'][ $taxonomy ] = $args;
	return true;
}

function register_post_meta( $post_type, $key, $args = array() ) {
	$GLOBALS['wp_stub']['post_meta'][ $key ] = $args;
	return true;
}

function register_term_meta( $taxonomy, $key, $args = array() ) {
	$GLOBALS['wp_stub']['term_meta'][ $key ] = $args;
	return true;
}

// --- Paths -----------------------------------------------------------------

function plugin_dir_path( $file ) {
	return rtrim( dirname( $file ), '/' ) . '/';
}

function plugin_dir_url( $file ) {
	return 'https://example.test/wp-content/plugins/skybird-projects/';
}

// --- i18n ------------------------------------------------------------------

function __( $text, $domain = null ) {
	return $text;
}

function _x( $text, $context, $domain = null ) {
	return $text;
}

function esc_html__( $text, $domain = null ) {
	return $text;
}

function esc_html_e( $text, $domain = null ) {
	echo $text;
}

// --- Escaping / sanitising -------------------------------------------------

function esc_html( $text ) {
	return htmlspecialchars( (string) $text, ENT_QUOTES );
}

function esc_attr( $text ) {
	return htmlspecialchars( (string) $text, ENT_QUOTES );
}

function esc_url( $url ) {
	return $url;
}

function sanitize_text_field( $str ) {
	return trim( strip_tags( (string) $str ) );
}

function sanitize_title( $str ) {
	$str = strtolower( trim( (string) $str ) );
	$str = preg_replace( '/[^a-z0-9_-]+/', '-', $str );
	return trim( (string) $str, '-' );
}

function absint( $value ) {
	return abs( (int) $value );
}

function wp_json_encode( $data ) {
	return json_encode( $data );
}

// --- Data ------------------------------------------------------------------

function get_option( $name, $default = false ) {
	return array_key_exists( $name, $GLOBALS['wp_stub']['options'] )
		? $GLOBALS['wp_stub']['options'][ $name ]
		: $default;
}

function get_post_meta( $post_id, $key, $single = false ) {
	return isset( $GLOBALS['wp_fixture']['post_meta'][ $key ] )
		? $GLOBALS['wp_fixture']['post_meta'][ $key ]
		: '';
}

function get_the_terms( $post_id, $taxonomy ) {
	return $GLOBALS['wp_fixture']['terms'];
}

function get_term_meta( $term_id, $key, $single = false ) {
	return '';
}

function get_term_by( $field, $value, $taxonomy ) {
	return false;
}

function get_permalink( $post = 0 ) {
	return $GLOBALS['wp_fixture']['permalink'];
}

function add_query_arg( $key, $value, $url ) {
	$sep = false === strpos( $url, '?' ) ? '?' : '&';
	return $url . $sep . rawurlencode( $key ) . '=' . rawurlencode( $value );
}

function current_user_can( $cap, $object_id = null ) {
	return (bool) $GLOBALS['wp_fixture']['caps'];
}

function is_wp_error( $thing ) {
	return $thing instanceof WP_Error;
}

class WP_Error {
	public $message;

	public function __construct( $code = '', $message = '' ) {
		$this->message = $message;
	}
}

// --- Unused by the loaded files, present so includes don't fatal ----------

function is_singular( $type = '' ) {
	return false;
}

function locate_template( $names ) {
	return '';
}

function wp_enqueue_style() {}
function wp_enqueue_script() {}
function wp_script_is() {
	return false;
}
function get_post() {
	return null;
}
function has_shortcode() {
	return false;
}
function get_posts() {
	return array();
}
function get_the_title( $post = 0 ) {
	return isset( $GLOBALS['wp_fixture']['title'] )
		? $GLOBALS['wp_fixture']['title']
		: 'Test Project';
}
function get_the_post_thumbnail_url() {
	return '';
}
function home_url( $path = '' ) {
	return 'https://skybirdroofing.net' . $path;
}
function shortcode_atts( $pairs, $atts, $shortcode = '' ) {
	$atts = (array) $atts;
	$out  = array();
	foreach ( $pairs as $name => $default ) {
		$out[ $name ] = array_key_exists( $name, $atts ) ? $atts[ $name ] : $default;
	}
	return $out;
}
function wp_insert_term( $term, $taxonomy, $args = array() ) {
	return array( 'term_id' => 1 );
}
function update_term_meta() {
	return true;
}
function flush_rewrite_rules() {}
function date_i18n( $format, $timestamp ) {
	return date( $format, $timestamp );
}
function wp_get_attachment_image() {
	return '';
}
function the_post_thumbnail() {}
function has_post_thumbnail() {
	return false;
}
function post_class() {}
function the_title() {}
function the_content() {}
function get_header() {}
function get_footer() {}
function get_the_ID() {
	return 1;
}

/**
 * Stand-in for WP_REST_Request, for the collection-filter tests.
 */
class Stub_Request {
	private $params;

	public function __construct( $params = array() ) {
		$this->params = $params;
	}

	public function get_param( $key ) {
		return isset( $this->params[ $key ] ) ? $this->params[ $key ] : null;
	}
}

// Block-theme detection and the block header/footer parts. The wrappers in
// includes/template.php branch on these.
function wp_is_block_theme() {
	return false;
}
function block_template_part( $part ) {}
function get_language_attributes() {
	return 'lang="en-US"';
}
function get_bloginfo( $show = '' ) {
	return 'UTF-8';
}
function get_body_class( $class = '' ) {
	return array( 'single', 'single-project' );
}
function wp_body_open() {}
function wp_head() {}
function wp_footer() {}
