<?php
/**
 * Per-photo captions and per-photo alt text.
 *
 * ## Why this exists
 *
 * Two defects on the same page, with the same cause — nobody had ever written
 * anything about an individual photo.
 *
 * 1. **No captions at all.** docs/13-page-definition.md §1: captions are what
 *    turn a photo into proof of workmanship. "New ridge vent along the full
 *    ridge line" is the sentence that tells a homeowner's friend these people
 *    knew what they were doing. Without it the gallery is decoration.
 *
 * 2. **Every photo on the page shared one alt attribute.** The template called
 *    skybird_projects_image_alt( $project_id ) once per image, so a page with
 *    six photos emitted the same "New GAF Timberline HDZ shingle roof,
 *    Charcoal, Wake Forest NC" six times. For a screen-reader user that is six
 *    identical announcements and no information. It is also, as it happens,
 *    the most machine-generated thing on the page.
 *
 * ## Where a caption lives
 *
 * On the attachment, in WordPress's own caption field (post_excerpt) — not in
 * project meta keyed by attachment ID. The caption belongs to the photo, so it
 * survives the photo being reordered, reused, or edited in the Media Library,
 * and it is visible to anyone who opens the attachment rather than only to
 * code that knows our meta key.
 *
 * ## The alt fallback chain
 *
 * 1. An explicit alt set on the attachment, if someone wrote one.
 * 2. The caption. A plain description of what is visible is exactly what alt
 *    text is for, so asking the reviewer for the same sentence twice would be
 *    a way of guaranteeing one of them stays empty.
 * 3. The generated project-level sentence, as before.
 *
 * ## Captions are public free text, which is new
 *
 * Every other public string on the page is either generated from structured
 * fields or typed into the WordPress editor. A caption box next to a jobsite
 * photo invites the sentence a person actually thinks — "Bill wanted the ridge
 * vent run the full length" — and that sentence names the homeowner.
 *
 * So: the field carries the warning, the copy guard scans what is typed, and
 * the sanitiser strips markup and caps length. None of that can detect a name,
 * and this file does not pretend otherwise. The human reading the page before
 * it publishes is the control (CLAUDE.md: nothing publishes automatically).
 *
 * @package Skybird_Projects
 */

defined( 'ABSPATH' ) || exit;

/**
 * Longest caption we store.
 *
 * Was 160, on the review's "one line per photo" model — "New ridge vent along
 * the full ridge line". Jacob then wrote the first real set by hand and five
 * of his nine ran past it, the longest at 358 characters. The cap did not
 * reject them, it truncated mid-word:
 *
 *     "...so that we can catch as much debris as possible and keep things
 *      out of the ya"
 *
 * His captions are not labels. They carry the page's narrative — why the
 * tarps are down, what ice-and-water is doing on a sub-4/12 pitch, that the
 * plywood repair took half an hour. A cap tuned for labels would have
 * silently mangled the most valuable copy on the page.
 *
 * 600 keeps a sanity bound — it stops a whole document being pasted into a
 * caption field — without constraining how he writes. Raise it again rather
 * than cut a sentence in half.
 */
const SKYBIRD_PROJECTS_CAPTION_MAX = 600;

/**
 * Clean a caption on the way in.
 *
 * @param string $text Raw submitted caption.
 * @return string
 */
function skybird_projects_sanitize_caption( $text ) {
	$text = sanitize_text_field( (string) $text );
	$text = preg_replace( '/\s+/', ' ', $text );
	$text = trim( $text );

	if ( '' === $text ) {
		return '';
	}

	// mb_substr when it exists: a caption truncated mid-character renders as a
	// replacement glyph, and the inch marks in shingle and vent descriptions
	// are a short hop from multibyte punctuation.
	if ( function_exists( 'mb_substr' ) ) {
		return mb_substr( $text, 0, SKYBIRD_PROJECTS_CAPTION_MAX );
	}

	return substr( $text, 0, SKYBIRD_PROJECTS_CAPTION_MAX );
}

/**
 * The stored caption for one photo.
 *
 * @param int $attachment_id Attachment ID.
 * @return string
 */
function skybird_projects_photo_caption( $attachment_id ) {
	$caption = get_post_field( 'post_excerpt', (int) $attachment_id );

	return skybird_projects_sanitize_caption( $caption );
}

/**
 * Alt text for one photo on one project.
 *
 * @param int $attachment_id Attachment ID.
 * @param int $post_id       Project post ID.
 * @return string
 */
function skybird_projects_photo_alt( $attachment_id, $post_id ) {
	$explicit = get_post_meta( (int) $attachment_id, '_wp_attachment_image_alt', true );
	$explicit = skybird_projects_sanitize_caption( $explicit );

	if ( '' !== $explicit ) {
		return $explicit;
	}

	$caption = skybird_projects_photo_caption( $attachment_id );

	if ( '' !== $caption ) {
		return $caption;
	}

	return skybird_projects_image_alt( $post_id );
}

/**
 * Every photo attached to a project, cover first.
 *
 * Cover first because that is the order the gallery was curated in and the
 * order the share image is chosen from, and deduped because a cover that also
 * appears in the gallery array would otherwise be captioned twice and render
 * twice in the warning list.
 *
 * @param int $post_id Project post ID.
 * @return int[]
 */
function skybird_projects_project_photo_ids( $post_id ) {
	$ids = array();

	$cover = (int) get_post_thumbnail_id( $post_id );

	if ( $cover ) {
		$ids[] = $cover;
	}

	$gallery = get_post_meta( $post_id, 'gallery', true );

	if ( is_array( $gallery ) ) {
		foreach ( $gallery as $id ) {
			$id = (int) $id;

			if ( $id && ! in_array( $id, $ids, true ) ) {
				$ids[] = $id;
			}
		}
	}

	return $ids;
}

/**
 * Register the captions meta box.
 */
function skybird_projects_add_captions_box() {
	add_meta_box(
		'skybird-projects-captions',
		__( 'Photo captions', 'skybird-projects' ),
		'skybird_projects_render_captions_box',
		SKYBIRD_PROJECTS_POST_TYPE,
		'normal',
		'high'
	);
}
add_action( 'add_meta_boxes', 'skybird_projects_add_captions_box' );

/**
 * Render the captions box.
 *
 * Lives on the project screen rather than sending the reviewer to the Media
 * Library one photo at a time. Captions that take six clicks each do not get
 * written, and an uncaptioned gallery fails the publish gate.
 *
 * @param WP_Post $post Current post.
 */
function skybird_projects_render_captions_box( $post ) {
	$ids = skybird_projects_project_photo_ids( $post->ID );

	if ( ! $ids ) {
		echo '<p>' . esc_html__( 'No photos attached yet. Approve some above first.', 'skybird-projects' ) . '</p>';
		return;
	}

	wp_nonce_field( 'skybird_captions_' . $post->ID, 'skybird_captions_nonce' );

	echo '<p>' . esc_html__( 'One line per photo, describing what is visible — "New ridge vent along the full ridge line". This is published under the photo and used as its alt text.', 'skybird-projects' ) . '</p>';

	echo '<p><strong>' . esc_html__( 'Never name the homeowner, and never give the street. A caption is public.', 'skybird-projects' ) . '</strong></p>';

	echo '<div style="display:flex;flex-direction:column;gap:12px;margin:12px 0;">';

	foreach ( $ids as $attachment_id ) {
		printf(
			'<label style="display:flex;gap:12px;align-items:center;">
				%1$s
				<span style="flex:1;">
					<input type="text" name="skybird_captions[%2$d]" value="%3$s" maxlength="%4$d" style="width:100%%;" placeholder="%5$s">
				</span>
			</label>',
			wp_get_attachment_image( $attachment_id, array( 120, 90 ), false, array( 'alt' => '' ) ),
			(int) $attachment_id,
			esc_attr( skybird_projects_photo_caption( $attachment_id ) ),
			(int) SKYBIRD_PROJECTS_CAPTION_MAX,
			esc_attr__( 'What does this photo show?', 'skybird-projects' )
		);
	}

	echo '</div>';

	skybird_projects_render_copy_warnings( $post->ID );
}

/**
 * Show what the copy guard found, inside the captions box.
 *
 * @param int $post_id Project post ID.
 */
function skybird_projects_render_copy_warnings( $post_id ) {
	$warnings = skybird_projects_project_copy_warnings( $post_id );

	if ( ! $warnings ) {
		return;
	}

	echo '<div style="border-left:4px solid #dba617;background:#fcf9e8;padding:12px;margin-top:16px;">';
	echo '<p style="margin-top:0;"><strong>' . esc_html__( 'Check this copy before publishing', 'skybird-projects' ) . '</strong></p>';
	echo '<ul style="margin:0;">';

	foreach ( $warnings as $warning ) {
		printf(
			'<li><code>%1$s</code> %2$s — %3$s</li>',
			esc_html( $warning['label'] ),
			esc_html(
				sprintf(
					/* translators: %s: where the phrase was found, e.g. "the title". */
					__( 'in %s', 'skybird-projects' ),
					$warning['where']
				)
			),
			esc_html( $warning['why'] )
		);
	}

	echo '</ul>';
	echo '<p style="margin-bottom:0;">' . esc_html__( 'These are warnings, not blocks. If a phrase belongs on the page, leave it.', 'skybird-projects' ) . '</p>';
	echo '</div>';
}

/**
 * Save the captions.
 *
 * On save_post rather than its own admin-post endpoint, because these fields
 * are part of the project form and a reviewer expects Update to save them. The
 * photo gate needs its own endpoint because it fetches files and redirects;
 * this only writes text.
 *
 * @param int $post_id Post being saved.
 */
function skybird_projects_save_captions( $post_id ) {
	if ( ! isset( $_POST['skybird_captions_nonce'] ) ) {
		return;
	}

	if ( ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['skybird_captions_nonce'] ) ), 'skybird_captions_' . $post_id ) ) {
		return;
	}

	if ( ! current_user_can( 'edit_post', $post_id ) ) {
		return;
	}

	// An autosave posts the form without the editor having touched these
	// fields; writing then would blank every caption on a timer.
	if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
		return;
	}

	$submitted = isset( $_POST['skybird_captions'] ) ? (array) wp_unslash( $_POST['skybird_captions'] ) : array(); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput

	// Same intersection rule as the photo gate: a POST body is
	// attacker-controlled, so the question is not "is this a valid caption" but
	// "is this a photo we attached to this project". Without it, a crafted
	// form could rewrite the caption on any attachment on the site.
	$allowed = skybird_projects_project_photo_ids( $post_id );

	foreach ( $submitted as $attachment_id => $caption ) {
		$attachment_id = (int) $attachment_id;

		if ( ! in_array( $attachment_id, $allowed, true ) ) {
			continue;
		}

		wp_update_post(
			array(
				'ID'           => $attachment_id,
				'post_excerpt' => skybird_projects_sanitize_caption( $caption ),
			)
		);
	}
}
add_action( 'save_post_' . SKYBIRD_PROJECTS_POST_TYPE, 'skybird_projects_save_captions' );
