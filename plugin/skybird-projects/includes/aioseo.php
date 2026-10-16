<?php
/**
 * The bridge into All in One SEO.
 *
 * ## Why this exists
 *
 * skybirdroofing.net runs All in One SEO Pro, and `includes/open-graph.php`
 * stands down when it finds a competing SEO plugin — two sets of `og:title`
 * in one document means Facebook picks between them and nothing on our side
 * decides which. Correct, and it left the share preview entirely in AIOSEO's
 * hands: its own title (with the site name appended, which Meta says not to
 * do), its own description, and the full-size featured image rather than the
 * reviewed 1200×630 crop.
 *
 * So instead of competing, we hand AIOSEO our values and let it print them.
 *
 * ## What the filter actually receives
 *
 * Read from the plugin source (`app/Common/Social/Output.php`), not guessed:
 *
 * - `getFacebookMeta()` builds a flat `property => content` string array and
 *   ends with `array_filter( apply_filters( 'aioseo_facebook_tags', $meta ) )`.
 * - **`array_filter()` runs AFTER the filter**, so setting a value to `''`
 *   removes that tag rather than printing an empty one.
 * - The view (`app/Common/Views/main/social.php`) prints each value through
 *   `esc_attr()`. So we pass **raw, unencoded** strings. Pre-escaping here
 *   would be escaping something that is about to be escaped.
 * - `og:image:width` and `og:image:height` are only in the array when AIOSEO
 *   found an image of its own, and it builds that block with `+=`, which does
 *   not overwrite existing keys. We therefore set every image tag explicitly
 *   rather than assuming the dimensions already there belong to our crop.
 * - `og:image:type` and `og:image:alt` are not in AIOSEO's array at all.
 *
 * ## The hole this also closes
 *
 * `getFacebookMeta()` returns early — before the filter — when AIOSEO's
 * Facebook module is switched off in its settings. In that state AIOSEO
 * prints no Open Graph tags, our filter never runs, and our own printer is
 * standing down: **nobody emits anything and nothing says so.** That is the
 * same silent-nothing shape as the n8n empty-array bug (docs/07 §15.4).
 *
 * AIOSEO hooks `wp_head` at priority 1, so a check at 99 can tell whether the
 * filter fired and print our own tags if it did not. Deliberately narrow to
 * AIOSEO: it is the one plugin whose source has been read here, and the one
 * whose filter is known to run whenever it emits. Yoast and Rank Math keep
 * the plain stand-down, because a fallback that guessed wrong would print the
 * duplicate tags the stand-down exists to prevent.
 *
 * @package Skybird_Projects
 */

defined( 'ABSPATH' ) || exit;

/**
 * Did our filter run on this request?
 *
 * @param bool|null $set Pass true to record that it ran.
 * @return bool
 */
function skybird_projects_aioseo_handled( $set = null ) {
	static $handled = false;

	if ( true === $set ) {
		$handled = true;
	}

	return $handled;
}

/**
 * Is AIOSEO the plugin in play?
 *
 * @return bool
 */
function skybird_projects_aioseo_active() {
	return defined( 'AIOSEO_VERSION' );
}

/**
 * Merge our values into AIOSEO's Open Graph array.
 *
 * Takes the post ID rather than reading it, so the suite can exercise the
 * merge without a request.
 *
 * @param array $tags    AIOSEO's tags.
 * @param int   $post_id Project post ID.
 * @param bool  $is_ssl  Whether the request is HTTPS.
 * @return array
 */
function skybird_projects_aioseo_merge( $tags, $post_id, $is_ssl = true ) {
	if ( ! is_array( $tags ) ) {
		return $tags;
	}

	// Always ours. Meta says og:title carries "no branding such as your site
	// name", and AIOSEO's title templates append it by default. Our fallback
	// is the plain post title, so this never invents anything — it only
	// strips the suffix and uses the human share title when one exists.
	$tags['og:url']   = skybird_projects_canonical_url( $post_id );
	$tags['og:title'] = skybird_projects_og_title( $post_id );

	// Only when a human wrote one. With no share description, AIOSEO's own
	// description is a better answer than ours, which would be nothing —
	// and generating one here would put the same two sentences on 200 pages.
	$description = skybird_projects_og_description( $post_id );

	if ( '' !== $description ) {
		$tags['og:description'] = $description;
	}

	$image = skybird_projects_share_image( $post_id );

	if ( $image ) {
		$tags['og:image']            = $image['url'];
		$tags['og:image:width']      = (string) $image['width'];
		$tags['og:image:height']     = (string) $image['height'];
		$tags['og:image:type']       = 'image/jpeg';
		$tags['og:image:secure_url'] = $is_ssl ? $image['url'] : '';

		if ( '' !== $image['alt'] ) {
			$tags['og:image:alt'] = $image['alt'];
		}
	}

	return $tags;
}

/**
 * The Open Graph filter callback.
 *
 * @param array $tags AIOSEO's tags.
 * @return array
 */
function skybird_projects_aioseo_facebook_tags( $tags ) {
	if ( ! is_singular( SKYBIRD_PROJECTS_POST_TYPE ) ) {
		return $tags;
	}

	$post_id = get_the_ID();

	if ( ! $post_id ) {
		return $tags;
	}

	skybird_projects_aioseo_handled( true );

	return skybird_projects_aioseo_merge( $tags, $post_id, is_ssl() );
}
add_filter( 'aioseo_facebook_tags', 'skybird_projects_aioseo_facebook_tags' );

/**
 * Merge our values into AIOSEO's Twitter array.
 *
 * A wide card, because the share image is a 1.91:1 crop and the default
 * `summary` card renders it as a small square.
 *
 * @param array $tags    AIOSEO's tags.
 * @param int   $post_id Project post ID.
 * @return array
 */
function skybird_projects_aioseo_merge_twitter( $tags, $post_id ) {
	if ( ! is_array( $tags ) ) {
		return $tags;
	}

	$image = skybird_projects_share_image( $post_id );

	if ( $image ) {
		$tags['twitter:card']  = 'summary_large_image';
		$tags['twitter:image'] = $image['url'];
	}

	$tags['twitter:title'] = skybird_projects_og_title( $post_id );

	$description = skybird_projects_og_description( $post_id );

	if ( '' !== $description ) {
		$tags['twitter:description'] = $description;
	}

	return $tags;
}

/**
 * The Twitter filter callback.
 *
 * @param array $tags AIOSEO's tags.
 * @return array
 */
function skybird_projects_aioseo_twitter_tags( $tags ) {
	if ( ! is_singular( SKYBIRD_PROJECTS_POST_TYPE ) ) {
		return $tags;
	}

	$post_id = get_the_ID();

	if ( ! $post_id ) {
		return $tags;
	}

	return skybird_projects_aioseo_merge_twitter( $tags, $post_id );
}
add_filter( 'aioseo_twitter_tags', 'skybird_projects_aioseo_twitter_tags' );

/**
 * Should we print our own tags after AIOSEO has had its turn?
 *
 * True only when AIOSEO is the active plugin, this is a project page, and the
 * Open Graph filter never ran — which means AIOSEO's Facebook module is off
 * and nothing at all has been emitted.
 *
 * @param bool $handled Whether the filter ran.
 * @param bool $aioseo  Whether AIOSEO is active.
 * @param bool $project Whether this is a single project page.
 * @return bool
 */
function skybird_projects_needs_og_fallback( $handled, $aioseo, $project ) {
	return $project && $aioseo && ! $handled;
}

/**
 * Print our tags when AIOSEO emitted none.
 */
function skybird_projects_print_og_fallback() {
	$needed = skybird_projects_needs_og_fallback(
		skybird_projects_aioseo_handled(),
		skybird_projects_aioseo_active(),
		is_singular( SKYBIRD_PROJECTS_POST_TYPE )
	);

	if ( ! $needed ) {
		return;
	}

	$post_id = get_the_ID();

	if ( $post_id ) {
		skybird_projects_echo_og_tags( $post_id );
	}
}
// 99, because AIOSEO hooks wp_head at 1 and the question this answers is
// whether it printed anything.
add_action( 'wp_head', 'skybird_projects_print_og_fallback', 99 );
