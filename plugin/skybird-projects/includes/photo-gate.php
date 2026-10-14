<?php
/**
 * The photo approval gate.
 *
 * ## Why this exists
 *
 * "Nothing publishes automatically" was only ever true of the POST.
 *
 * WordPress attachments are files on disk under /wp-content/uploads/, served
 * straight by the web server. They have a public URL the moment the upload
 * returns, and that URL does not care what status any post is in. A draft is
 * invisible; its attachments are not.
 *
 * The original pipeline uploaded every curated photo and *then* created a
 * draft for a human to review. So the only irreversible step happened before
 * anyone looked. It cost us twice in two days:
 *
 * - 2026-09-28: a photo of a signed checklist carrying the homeowner's name
 *   and street address was public for ~2 hours (docs/07 §16.1).
 * - 2026-09-29: a published photo carried GPS 17.6 ft from the front door,
 *   defeating the quarter-mile pin offset entirely (docs/07 §16.9).
 *
 * Neither was a bad photo *filter*. Both were photos nobody had looked at.
 *
 * ## What changed
 *
 * The automation now sends candidate photo URLs instead of uploading them.
 * The draft is created with no images and nothing on the server. This screen
 * shows the candidates **served from CompanyCam**, and only what a human ticks
 * is ever fetched, stored, or given a URL on skybirdroofing.net.
 *
 * ## Why the plugin imports rather than a second workflow
 *
 * docs/07 §16.4 proposed a second n8n workflow for this. Doing it in the
 * plugin keeps the import inside WordPress's own upload path, which means
 * includes/exif.php strips location metadata from every approved photo
 * automatically. Handing approval back to n8n would mean a second webhook, a
 * second credential, and a second route by which a photo could reach the
 * library without passing the stripper.
 *
 * @package Skybird_Projects
 */

defined( 'ABSPATH' ) || exit;

/**
 * Candidate photos still waiting on a decision.
 *
 * Re-sanitised on the way out, not trusted from storage. The field is written
 * over REST by the automation, and the value that matters is the one at the
 * moment we act on it.
 *
 * @param int $post_id Project post ID.
 * @return array URLs.
 */
function skybird_projects_pending_photos( $post_id ) {
	$stored = get_post_meta( $post_id, 'pending_photos', true );

	return skybird_projects_sanitize_photo_urls( is_array( $stored ) ? $stored : array() );
}

/**
 * Which of the submitted URLs may actually be imported.
 *
 * The intersection is the control. A reviewer's browser posts back a list of
 * ticked photos, and a POST body is attacker-controlled — so the answer is not
 * "whatever was submitted, sanitised", it is "whichever of the submitted URLs
 * we had already stored as candidates". Sanitising alone would still let
 * somebody post a different CompanyCam URL and have the site fetch it.
 *
 * Order follows the pending list rather than the submission, so the gallery
 * keeps its oldest-first curation regardless of how the form serialises.
 *
 * @param array $submitted URLs posted by the reviewer.
 * @param array $pending   URLs we offered.
 * @return array
 */
function skybird_projects_approved_photo_urls( $submitted, $pending ) {
	if ( ! is_array( $submitted ) || ! is_array( $pending ) ) {
		return array();
	}

	$submitted = skybird_projects_sanitize_photo_urls( $submitted );
	$approved  = array();

	foreach ( $pending as $url ) {
		if ( in_array( $url, $submitted, true ) && ! in_array( $url, $approved, true ) ) {
			$approved[] = $url;
		}
	}

	return $approved;
}

/**
 * Register the meta box.
 */
function skybird_projects_add_photo_gate() {
	add_meta_box(
		'skybird-projects-photo-gate',
		__( 'Photos awaiting approval', 'skybird-projects' ),
		'skybird_projects_render_photo_gate',
		SKYBIRD_PROJECTS_POST_TYPE,
		'normal',
		'high'
	);
}
add_action( 'add_meta_boxes', 'skybird_projects_add_photo_gate' );

/**
 * Render the gate.
 *
 * Thumbnails come from CompanyCam's own URLs. That is the point: looking at a
 * photo must not require it to exist on our server first.
 *
 * @param WP_Post $post Current post.
 */
function skybird_projects_render_photo_gate( $post ) {
	$pending = skybird_projects_pending_photos( $post->ID );

	if ( ! $pending ) {
		echo '<p>' . esc_html__( 'No photos waiting. Anything already approved is in the gallery below.', 'skybird-projects' ) . '</p>';
		return;
	}

	printf(
		'<p><strong>%s</strong></p>',
		esc_html(
			sprintf(
				/* translators: %d: number of photos. */
				_n(
					'%d photo is waiting. Nothing has been downloaded yet — these are still on CompanyCam.',
					'%d photos are waiting. Nothing has been downloaded yet — these are still on CompanyCam.',
					count( $pending ),
					'skybird-projects'
				),
				count( $pending )
			)
		)
	);

	echo '<p>' . esc_html__( 'Look at every one before you tick it. Check for house numbers, mailboxes, vehicle plates, faces, and any paperwork with writing on it. Only ticked photos are downloaded and published.', 'skybird-projects' ) . '</p>';

	printf(
		'<form method="post" action="%s">',
		esc_url( admin_url( 'admin-post.php' ) )
	);

	wp_nonce_field( 'skybird_approve_photos_' . $post->ID, 'skybird_photo_gate_nonce' );

	printf( '<input type="hidden" name="action" value="skybird_approve_photos">' );
	printf( '<input type="hidden" name="post_id" value="%d">', (int) $post->ID );

	echo '<div style="display:flex;flex-wrap:wrap;gap:16px;margin:12px 0;">';

	foreach ( $pending as $i => $url ) {
		printf(
			'<label style="width:200px;display:block;">
				<img src="%1$s" alt="" style="width:200px;height:150px;object-fit:cover;display:block;border:1px solid #dcdcde;">
				<span style="display:block;margin-top:6px;">
					<input type="checkbox" name="skybird_photos[]" value="%1$s"> %2$s
				</span>
				<span style="display:block;">
					<input type="radio" name="skybird_cover" value="%1$s"%3$s> %4$s
				</span>
				<a href="%1$s" target="_blank" rel="noopener noreferrer">%5$s</a>
			</label>',
			esc_url( $url ),
			esc_html__( 'Publish this one', 'skybird-projects' ),
			0 === $i ? ' checked' : '',
			esc_html__( 'Use as cover', 'skybird-projects' ),
			esc_html__( 'View full size', 'skybird-projects' )
		);
	}

	echo '</div>';

	submit_button( __( 'Download and attach the ticked photos', 'skybird-projects' ) );

	echo '</form>';
}

/**
 * Import the approved photos.
 *
 * Everything here is deliberately ordered: capability, then nonce, then the
 * intersection, then the fetch. A failure at any step imports nothing rather
 * than importing some.
 */
function skybird_projects_handle_photo_approval() {
	$post_id = isset( $_POST['post_id'] ) ? (int) $_POST['post_id'] : 0;

	if ( ! $post_id || ! current_user_can( 'edit_post', $post_id ) ) {
		wp_die( esc_html__( 'You cannot edit this project.', 'skybird-projects' ) );
	}

	check_admin_referer( 'skybird_approve_photos_' . $post_id, 'skybird_photo_gate_nonce' );

	$submitted = isset( $_POST['skybird_photos'] ) ? (array) wp_unslash( $_POST['skybird_photos'] ) : array(); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput
	$pending   = skybird_projects_pending_photos( $post_id );
	$approved  = skybird_projects_approved_photo_urls( $submitted, $pending );

	if ( ! $approved ) {
		wp_safe_redirect( add_query_arg( 'skybird_photos', 'none', get_edit_post_link( $post_id, 'url' ) ) );
		exit;
	}

	$cover_url = isset( $_POST['skybird_cover'] ) ? wp_unslash( $_POST['skybird_cover'] ) : ''; // phpcs:ignore WordPress.Security.ValidatedSanitizedInput
	$cover_url = skybird_projects_approved_photo_urls( array( $cover_url ), $approved );
	$cover_url = $cover_url ? $cover_url[0] : $approved[0];

	require_once ABSPATH . 'wp-admin/includes/media.php';
	require_once ABSPATH . 'wp-admin/includes/file.php';
	require_once ABSPATH . 'wp-admin/includes/image.php';

	$area    = (string) get_post_meta( $post_id, 'city', true );
	$slug    = sanitize_title( $area ? $area : 'project' );
	$ccam_id = (string) get_post_meta( $post_id, 'companycam_project_id', true );

	$gallery  = array();
	$cover_id = 0;
	$failed   = 0;

	foreach ( $approved as $i => $url ) {
		// Filenames are built from the area and the CompanyCam ID, NEVER from
		// the project name, which is the customer's name
		// (docs/06-trigger-design.md §3).
		$name = sprintf( 'skybird-roof-%s-%s-%d.jpeg', $slug, $ccam_id ? $ccam_id : $post_id, $i + 1 );

		$id = skybird_projects_sideload( $url, $post_id, $name );

		if ( ! $id ) {
			$failed++;
			continue;
		}

		if ( $url === $cover_url ) {
			$cover_id = $id;
		} else {
			$gallery[] = $id;
		}
	}

	if ( $cover_id ) {
		set_post_thumbnail( $post_id, $cover_id );
	}

	if ( $gallery ) {
		update_post_meta( $post_id, 'gallery', $gallery );
	}

	// Approved photos leave the waiting list. Anything the reviewer did not
	// tick stays, so a rejected photo is still there to reconsider — and so a
	// half-finished review can be picked up rather than restarted.
	$remaining = array_values( array_diff( $pending, $approved ) );
	update_post_meta( $post_id, 'pending_photos', $remaining );

	wp_safe_redirect(
		add_query_arg(
			array(
				'skybird_photos' => count( $approved ) - $failed,
				'skybird_failed' => $failed,
			),
			get_edit_post_link( $post_id, 'url' )
		)
	);
	exit;
}
add_action( 'admin_post_skybird_approve_photos', 'skybird_projects_handle_photo_approval' );

/**
 * Pull one photo into the media library.
 *
 * Goes through WordPress's own sideload path on purpose: that is what runs
 * wp_generate_attachment_metadata, and therefore what runs the EXIF stripper
 * in includes/exif.php. A hand-rolled download writing straight to uploads/
 * would skip it and put the coordinates back.
 *
 * @param string $url     Photo URL, already checked against the candidate list.
 * @param int    $post_id Project post ID.
 * @param string $name    Filename to store it under.
 * @return int Attachment ID, or 0.
 */
function skybird_projects_sideload( $url, $post_id, $name ) {
	$tmp = download_url( $url );

	if ( is_wp_error( $tmp ) ) {
		return 0;
	}

	$file = array(
		'name'     => $name,
		'tmp_name' => $tmp,
	);

	$id = media_handle_sideload( $file, $post_id, null );

	if ( is_wp_error( $id ) ) {
		// download_url() made this; nothing else will clean it up.
		if ( file_exists( $tmp ) ) {
			wp_delete_file( $tmp );
		}
		return 0;
	}

	return (int) $id;
}
