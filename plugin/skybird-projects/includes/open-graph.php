<?php
/**
 * The Facebook / link preview tags.
 *
 * ## Why this exists
 *
 * Nobody had defined what a shared project page looks like in a feed. Meta's
 * own documentation says that without these tags Facebook "uses internal
 * heuristics to make a best guess about the title, description, and preview
 * image" (docs/vendor/reviews/grok-page-definition-2026-10-15.md [M-WM]).
 *
 * On a roofing project page that guess picks a photo of a house. It could
 * pick the one with the house number in it.
 *
 * This is the one part of the page that the person sharing it sees *before*
 * they decide to share. Get it wrong and the referral layer — the North Star
 * — never starts.
 *
 * ## The share image
 *
 * A dedicated 1200×630 hard crop, registered as its own image size so it has
 * its own URL and its own file. Meta: "Use images that are at least
 * 1200 x 630 pixels", as close to 1.91:1 as possible, and declare
 * og:image:width / og:image:height or "the first person who shares a piece of
 * content won't see a rendered image" [M-IMG].
 *
 * Two things follow from the crop being its own file:
 *
 * 1. **It is stripped.** includes/exif.php walks `$metadata['sizes']`, so the
 *    crop is cleaned alongside the original. The one published photo that
 *    carried GPS 17.6 ft from a front door (docs/07 §16.9) is exactly the
 *    failure a separate, unstripped derivative would reintroduce.
 * 2. **The crop is not the photo.** A centred 1.91:1 crop pulls in what the
 *    original framing left out — the review's warning, and the reason the
 *    admin box below shows the reviewer the actual cropped share image rather
 *    than the photo they already approved. You cannot check a crop you have
 *    never seen.
 *
 * Meta caches images by URL and says to publish a changed image at a new URL
 * [M-IMG]. WordPress regenerates a crop under the same filename, so the URL
 * carries a short version marker derived from the attachment's modified time.
 * Query strings are fine on og:image — it is og:url that Meta requires to be
 * undecorated.
 *
 * ## No invented specifics
 *
 * og:title and og:description come from fields a human filled in. When they
 * are empty the tag is omitted, never generated from a template. A generated
 * two-sentence description across 200 pages is the thing docs/13 §5 is trying
 * to prevent, and an invented credential is a CLAUDE.md hard rule.
 *
 * @package Skybird_Projects
 */

defined( 'ABSPATH' ) || exit;

/** The share image crop. 1.91:1, per Meta's guidance. */
const SKYBIRD_PROJECTS_SHARE_IMAGE_SIZE = 'skybird-share';
const SKYBIRD_PROJECTS_SHARE_IMAGE_W    = 1200;
const SKYBIRD_PROJECTS_SHARE_IMAGE_H    = 630;

/** Meta says og:title should carry no branding; this is the length it reads well at. */
const SKYBIRD_PROJECTS_OG_TITLE_MAX = 60;

/**
 * Register the share crop.
 *
 * Hard crop (the `true`), because a soft resize of a 4:3 phone photo gives a
 * 1200×900 image, which Facebook then letterboxes or crops itself — and a
 * crop Facebook chooses is a crop nobody reviewed.
 */
function skybird_projects_register_share_size() {
	add_image_size(
		SKYBIRD_PROJECTS_SHARE_IMAGE_SIZE,
		SKYBIRD_PROJECTS_SHARE_IMAGE_W,
		SKYBIRD_PROJECTS_SHARE_IMAGE_H,
		true
	);
}
add_action( 'init', 'skybird_projects_register_share_size' );

/**
 * The canonical page URL: absolute, and with nothing on the end.
 *
 * Meta requires og:url to be "the undecorated URL, without session variables,
 * user identifying parameters, or counters" [M-WM], and treats every link
 * sharing an og:url as one resource for metrics [M-CANON].
 *
 * The referral code is a user-identifying parameter, so it is deliberately
 * NOT here — the share link carries it, this does not. Whether a posted share
 * actually delivers a visitor to the shared URL or to this one is the open
 * question in docs/13 §3, and it has to be tested with a real share before
 * any link goes to a customer.
 *
 * @param int $post_id Project post ID.
 * @return string
 */
function skybird_projects_canonical_url( $post_id ) {
	$url = get_permalink( $post_id );

	if ( ! $url ) {
		return '';
	}

	// Dropping the whole query string is right only when the path identifies
	// the post. Under WordPress's "Plain" permalink setting get_permalink()
	// returns https://site/?post_type=project&p=1183 — the query string IS the
	// address — and stripping it would point og:url at the homepage, so every
	// project page in every feed would share one preview and Meta would treat
	// them all as one resource [M-CANON]. Caught by breaking this function
	// deliberately; the live site uses pretty permalinks, so it would have sat
	// here harmlessly until the day somebody changed that setting.
	$path = (string) wp_parse_url( $url, PHP_URL_PATH );

	if ( '' === $path || '/' === $path ) {
		return strtok( $url, '#' );
	}

	// Otherwise drop everything: not a named list of parameters, because the
	// one that leaks is the one nobody thought of.
	return strtok( $url, '?#' );
}

/**
 * The human share title.
 *
 * Falls back to the post title, which under the locked SEO format
 * (docs/06-trigger-design.md §3) reads "GAF Timberline HDZ Roof Replacement in
 * Youngsville, NC" — keyword-first, and not what anyone writes above a photo
 * of their own house.
 *
 * docs/13 §3 resolves that tension by making og:title human and leaving the
 * <title> tag keyword-first. The fallback keeps a page that nobody has written
 * a share title for working exactly as it does today.
 *
 * @param int $post_id Project post ID.
 * @return string
 */
function skybird_projects_og_title( $post_id ) {
	$human = sanitize_text_field( (string) get_post_meta( $post_id, 'share_title', true ) );

	if ( '' !== trim( $human ) ) {
		return trim( $human );
	}

	return (string) get_the_title( $post_id );
}

/**
 * The share description, plus the credentials sentence if one is configured.
 *
 * Returns '' when no human has written a description. Omitting the tag lets
 * Facebook fall back to its own excerpt; generating one from the product and
 * town would put the same two sentences on 200 pages, which is the failure
 * docs/13 §5 names.
 *
 * The credentials line is an option, not a constant, and it ships empty. The
 * review's example sentence names a generation count and a manufacturer
 * programme, and "no invented specifics" (CLAUDE.md) covers claims about us
 * too — those words go in once Jacob has confirmed them.
 *
 * @param int $post_id Project post ID.
 * @return string
 */
function skybird_projects_og_description( $post_id ) {
	$written = sanitize_text_field( (string) get_post_meta( $post_id, 'share_description', true ) );
	$written = trim( $written );

	if ( '' === $written ) {
		return '';
	}

	$credentials = trim( (string) get_option( 'skybird_projects_credentials_line', '' ) );

	return $credentials ? $written . ' ' . $credentials : $written;
}

/**
 * The share image, as a declared set of attributes.
 *
 * @param int $post_id Project post ID.
 * @return array url, width, height, alt — or array() when there is no cover.
 */
function skybird_projects_share_image( $post_id ) {
	$cover = (int) get_post_thumbnail_id( $post_id );

	if ( ! $cover ) {
		return array();
	}

	$src = wp_get_attachment_image_src( $cover, SKYBIRD_PROJECTS_SHARE_IMAGE_SIZE );

	if ( empty( $src[0] ) ) {
		return array();
	}

	// An attachment imported before the crop was registered has no 1200×630
	// file, and WordPress quietly hands back the full-size image instead. That
	// is a usable preview but it is not the declared one, so say so rather
	// than declaring dimensions the file does not have.
	$cropped = (int) $src[1] === SKYBIRD_PROJECTS_SHARE_IMAGE_W
		&& (int) $src[2] === SKYBIRD_PROJECTS_SHARE_IMAGE_H;

	return array(
		'url'     => skybird_projects_version_url( $src[0], $cover ),
		'width'   => (int) $src[1],
		'height'  => (int) $src[2],
		'alt'     => skybird_projects_photo_alt( $cover, $post_id ),
		'cropped' => $cropped,
	);
}

/**
 * Add a short version marker to an image URL.
 *
 * Meta caches by URL and says to publish a changed image at a new one
 * [M-IMG]. WordPress regenerates a crop over the top of the old file, so
 * without this a re-cropped share image keeps showing the previous picture in
 * every feed that has already scraped the page.
 *
 * @param string $url           Image URL.
 * @param int    $attachment_id Attachment ID.
 * @return string
 */
function skybird_projects_version_url( $url, $attachment_id ) {
	$modified = (string) get_post_field( 'post_modified_gmt', (int) $attachment_id );

	if ( '' === $modified ) {
		return $url;
	}

	return add_query_arg( 'v', substr( md5( $modified ), 0, 8 ), $url );
}

/**
 * Should the plugin print its own tags?
 *
 * Two sets of og:title in one document is worse than one set we did not
 * choose — Facebook picks between them and nothing on our side decides which.
 * Yoast and Rank Math both emit a full Open Graph block, so when either is
 * active this stands down and says so in the admin box instead of competing.
 *
 * Wiring our 1200×630 crop into whichever one the site runs is the right fix,
 * and it needs to be written against the plugin that is actually installed
 * rather than guessed at. The filter is the escape hatch in the meantime.
 *
 * @return bool
 */
function skybird_projects_should_emit_og() {
	$conflict = defined( 'WPSEO_VERSION' ) || defined( 'RANK_MATH_VERSION' ) || defined( 'AIOSEO_VERSION' );

	return (bool) apply_filters( 'skybird_projects_emit_og', ! $conflict );
}

/**
 * The tags for one project, in order.
 *
 * Built as data so the suite can assert on it and the admin box can show the
 * reviewer exactly what will be printed. A tag with no content is omitted
 * entirely rather than printed empty.
 *
 * @param int $post_id Project post ID.
 * @return array property => content.
 */
function skybird_projects_og_tags( $post_id ) {
	$tags = array();

	$url = skybird_projects_canonical_url( $post_id );

	if ( $url ) {
		$tags['og:url'] = $url;
	}

	$title = skybird_projects_og_title( $post_id );

	if ( '' !== $title ) {
		$tags['og:title'] = $title;
	}

	$description = skybird_projects_og_description( $post_id );

	if ( '' !== $description ) {
		$tags['og:description'] = $description;
	}

	$tags['og:type'] = 'article';

	$image = skybird_projects_share_image( $post_id );

	if ( $image ) {
		$tags['og:image']        = $image['url'];
		$tags['og:image:width']  = (string) $image['width'];
		$tags['og:image:height'] = (string) $image['height'];
		$tags['og:image:type']   = 'image/jpeg';

		if ( '' !== $image['alt'] ) {
			$tags['og:image:alt'] = $image['alt'];
		}

		// Without this the same page in an iMessage or X preview falls back to
		// a small square thumbnail of a wide photo.
		$tags['twitter:card'] = 'summary_large_image';
	}

	return $tags;
}

/**
 * Print them.
 */
function skybird_projects_print_og_tags() {
	if ( ! is_singular( SKYBIRD_PROJECTS_POST_TYPE ) || ! skybird_projects_should_emit_og() ) {
		return;
	}

	$post_id = get_the_ID();

	if ( ! $post_id ) {
		return;
	}

	skybird_projects_echo_og_tags( $post_id );
}
add_action( 'wp_head', 'skybird_projects_print_og_tags', 5 );

/**
 * Emit the tags for one project, with no guards.
 *
 * Separated from the guard above so includes/aioseo.php can reuse it as a
 * last-resort fallback when AIOSEO's social module is switched off and
 * nothing at all has been printed.
 *
 * @param int $post_id Project post ID.
 */
function skybird_projects_echo_og_tags( $post_id ) {
	foreach ( skybird_projects_og_tags( $post_id ) as $property => $content ) {
		// Twitter uses name=, Open Graph uses property=. Printing twitter:card
		// as a property is silently ignored.
		$attribute = 0 === strpos( $property, 'twitter:' ) ? 'name' : 'property';

		printf(
			"<meta %s=\"%s\" content=\"%s\">\n",
			esc_attr( $attribute ),
			esc_attr( $property ),
			esc_attr( $content )
		);
	}

	printf( "<link rel=\"canonical\" href=\"%s\">\n", esc_url( skybird_projects_canonical_url( $post_id ) ) );
}

/**
 * What a reviewer needs to be told about the preview before publishing.
 *
 * @param int $post_id Project post ID.
 * @return string[] Plain sentences, worst first. Empty when the preview is sound.
 */
function skybird_projects_share_preview_problems( $post_id ) {
	$problems = array();

	if ( skybird_projects_aioseo_active() ) {
		// Handled: includes/aioseo.php hands these values to AIOSEO rather
		// than competing with it, so there is nothing to warn about.
		$problems[] = '';
	} elseif ( ! skybird_projects_should_emit_og() ) {
		$problems[] = __( 'Yoast or Rank Math is active and is writing its own preview tags, so these are not being printed. Tell Claude which one so the share image can be wired into it.', 'skybird-projects' );
	}

	$image = skybird_projects_share_image( $post_id );

	if ( ! $image ) {
		$problems[] = __( 'No cover photo, so Facebook will choose a picture for you. Approve a cover above.', 'skybird-projects' );
	} elseif ( empty( $image['cropped'] ) ) {
		$problems[] = __( 'This cover was imported before the 1200x630 share crop existed, so the full-size photo is being used. Regenerate thumbnails for it.', 'skybird-projects' );
	}

	if ( '' === trim( (string) get_post_meta( $post_id, 'share_title', true ) ) ) {
		$problems[] = __( 'No share title. The feed will show the SEO title, which is written for Google, not for the homeowner.', 'skybird-projects' );
	} elseif ( mb_strlen( skybird_projects_og_title( $post_id ) ) > SKYBIRD_PROJECTS_OG_TITLE_MAX ) {
		$problems[] = sprintf(
			/* translators: %d: character limit. */
			__( 'The share title is longer than %d characters and will be cut off in a feed.', 'skybird-projects' ),
			SKYBIRD_PROJECTS_OG_TITLE_MAX
		);
	}

	if ( '' === skybird_projects_og_description( $post_id ) ) {
		$problems[] = __( 'No share description, so Facebook will write its own from the page. Two sentences about this specific job.', 'skybird-projects' );
	}

	if ( '' === trim( (string) get_option( 'skybird_projects_credentials_line', '' ) ) ) {
		$problems[] = __( 'No credentials sentence is configured site-wide, so the preview says nothing about who did the work.', 'skybird-projects' );
	}

	return array_values( array_filter( $problems ) );
}

/**
 * Register the share preview box.
 */
function skybird_projects_add_share_preview_box() {
	add_meta_box(
		'skybird-projects-share-preview',
		__( 'How this looks when it is shared', 'skybird-projects' ),
		'skybird_projects_render_share_preview_box',
		SKYBIRD_PROJECTS_POST_TYPE,
		'side',
		'high'
	);
}
add_action( 'add_meta_boxes', 'skybird_projects_add_share_preview_box' );

/**
 * Render it.
 *
 * The point of this box is the image. A reviewer approved the cover photo as
 * a photo; what gets shared is a centred 1.91:1 crop of it, which can contain
 * a house number the original framing left at the edge of the frame. Showing
 * the crop is the only way that gets checked.
 *
 * @param WP_Post $post Current post.
 */
function skybird_projects_render_share_preview_box( $post ) {
	$image = skybird_projects_share_image( $post->ID );

	if ( $image ) {
		printf(
			'<img src="%s" alt="" style="width:100%%;height:auto;display:block;border:1px solid #dcdcde;">',
			esc_url( $image['url'] )
		);
		echo '<p><strong>' . esc_html__( 'Check THIS crop, not the original photo:', 'skybird-projects' ) . '</strong> ' . esc_html__( 'house number, mailbox, street sign, plates, people, the neighbour\'s house number.', 'skybird-projects' ) . '</p>';
	}

	$title = skybird_projects_og_title( $post->ID );
	$desc  = skybird_projects_og_description( $post->ID );

	echo '<p style="margin-bottom:4px;"><strong>' . esc_html( $title ) . '</strong></p>';

	if ( '' !== $desc ) {
		echo '<p style="margin-top:0;color:#50575e;">' . esc_html( $desc ) . '</p>';
	}

	printf(
		'<p style="color:#50575e;">%s</p>',
		esc_html( skybird_projects_canonical_url( $post->ID ) )
	);

	$problems = skybird_projects_share_preview_problems( $post->ID );

	if ( $problems ) {
		echo '<div style="border-left:4px solid #dba617;background:#fcf9e8;padding:8px 12px;">';
		echo '<ul style="margin:0;">';

		foreach ( $problems as $problem ) {
			echo '<li>' . esc_html( $problem ) . '</li>';
		}

		echo '</ul></div>';
	}

	echo '<p>' . esc_html__( 'Before sending anyone a share link, run the page through Meta\'s Sharing Debugger so the image is cached and the preview is checked.', 'skybird-projects' ) . '</p>';
	echo '<p><a href="https://developers.facebook.com/tools/debug/" target="_blank" rel="noopener noreferrer">developers.facebook.com/tools/debug</a></p>';
}
