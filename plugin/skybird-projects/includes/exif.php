<?php
/**
 * Strip location metadata out of uploaded images.
 *
 * Found live on 2026-09-29. A published project photo carried GPS coordinates
 * inside the JPEG, **17.6 feet** from the homeowner's front door
 * (docs/07-phase-4-preflight.md §16.9).
 *
 * Everything else in this system exists to keep that number secret. The map
 * pin is offset a quarter mile and regenerated per project so the offset
 * cannot be solved for; the street address is never stored; the plugin has no
 * field for true coordinates and the suite asserts none is ever added. And the
 * photo carried the answer in its own header, one right-click away.
 *
 * Three of the four photos on that project were clean — the drone shots had no
 * GPS block at all. The one that did was a phone close-up taken by a crew
 * member with location services on. So the failure mode is invisible to
 * sampling: check three photos and conclude you are fine.
 *
 * ## Where this hooks, and why not earlier
 *
 * `wp_generate_attachment_metadata`, not `wp_handle_upload`.
 *
 * WordPress reads EXIF **orientation** during `wp_create_image_subsizes()` and
 * rotates the image to match. Strip EXIF before that runs and every photo shot
 * in portrait lands sideways, with nothing left to say it should not be.
 * Stripping afterwards means the rotation has already been applied and baked
 * into the pixels, which is where it belongs.
 *
 * ## What is removed
 *
 * APP1 segments only, and only the two that carry location:
 *
 * - **Exif** — `GPSLatitude`, `GPSLongitude`, and the rest of the GPS IFD.
 * - **XMP** — an Adobe/XML block that carries its own copy of the
 *   coordinates. Drones in particular write GPS here as well as to Exif, so
 *   removing Exif alone would leave the location sitting in the next segment.
 *
 * ICC colour profiles (APP2), JFIF (APP0) and everything else are left
 * untouched, so colour rendering is unchanged. The pixels are never
 * re-encoded — the segments are cut out of the byte stream — so there is no
 * generation loss.
 *
 * @package Skybird_Projects
 */

defined( 'ABSPATH' ) || exit;

/**
 * Remove EXIF and XMP from every file WordPress made for this attachment.
 *
 * Intermediate sizes are usually stripped already, because GD and Imagick
 * re-encode them and drop unknown segments. "Usually" is not a guarantee
 * across image libraries and WordPress versions, so all of them are run
 * through it. The work is a byte scan, not a decode.
 *
 * @param array $metadata      Attachment metadata.
 * @param int   $attachment_id Attachment ID.
 * @return array Metadata, unchanged — this filter is here for the side effect.
 */
function skybird_projects_strip_upload_location( $metadata, $attachment_id ) {
	/**
	 * Whether to strip location metadata from this attachment.
	 *
	 * Defaults to true for every image on the site, not only the ones the
	 * Showcase automation uploads. On a roofing company's site every photo is
	 * of somebody's house, and the manual path — dragging a phone photo into
	 * the media library — is the one most likely to carry coordinates.
	 *
	 * @param bool  $strip         Whether to strip.
	 * @param int   $attachment_id Attachment ID.
	 */
	if ( ! apply_filters( 'skybird_projects_strip_exif', true, $attachment_id ) ) {
		return $metadata;
	}

	$file = get_attached_file( $attachment_id );

	if ( ! $file ) {
		return $metadata;
	}

	$dir     = dirname( $file );
	$targets = array( $file );

	// The full-size original, when WordPress made a -scaled copy to serve.
	if ( ! empty( $metadata['original_image'] ) ) {
		$targets[] = $dir . '/' . $metadata['original_image'];
	}

	if ( ! empty( $metadata['sizes'] ) && is_array( $metadata['sizes'] ) ) {
		foreach ( $metadata['sizes'] as $size ) {
			if ( ! empty( $size['file'] ) ) {
				$targets[] = $dir . '/' . $size['file'];
			}
		}
	}

	foreach ( array_unique( $targets ) as $target ) {
		skybird_projects_strip_jpeg_location( $target );
	}

	return $metadata;
}
add_filter( 'wp_generate_attachment_metadata', 'skybird_projects_strip_upload_location', 10, 2 );

/**
 * Cut the Exif and XMP segments out of one JPEG, in place.
 *
 * Walks the marker chain rather than decoding the image. A JPEG is a sequence
 * of segments: `0xFF`, a marker byte, then — for all but a handful of
 * standalone markers — a two-byte big-endian length that includes itself.
 * Everything from Start of Scan onwards is entropy-coded pixel data with no
 * further segments, so the walk stops there and copies the remainder whole.
 *
 * Returns false and changes nothing on anything it does not fully understand.
 * A photo that fails to strip must fail loudly at review, not silently become
 * a corrupted file.
 *
 * @param string $path Absolute path to a file.
 * @return bool True if the file was rewritten.
 */
function skybird_projects_strip_jpeg_location( $path ) {
	if ( ! is_readable( $path ) || ! is_writable( $path ) ) {
		return false;
	}

	$data = file_get_contents( $path ); // phpcs:ignore WordPress.WP.AlternativeFunctions

	if ( false === $data || strlen( $data ) < 4 || "\xFF\xD8" !== substr( $data, 0, 2 ) ) {
		return false; // Not a JPEG.
	}

	$out     = "\xFF\xD8";
	$i       = 2;
	$len     = strlen( $data );
	$removed = false;

	while ( $i < $len ) {
		if ( "\xFF" !== $data[ $i ] ) {
			return false; // Out of step with the marker chain; leave it alone.
		}

		// Padding: a run of 0xFF bytes before a marker is legal.
		while ( $i < $len && "\xFF" === $data[ $i ] && "\xFF" === $data[ $i + 1 ] ) {
			$out .= "\xFF";
			$i++;
		}

		$marker = ord( $data[ $i + 1 ] );

		// Start of Scan: pixel data follows, no more segments.
		if ( 0xDA === $marker ) {
			$out .= substr( $data, $i );
			break;
		}

		// Standalone markers carry no length.
		if ( 0xD8 === $marker || ( $marker >= 0xD0 && $marker <= 0xD9 ) || 0x01 === $marker ) {
			$out .= substr( $data, $i, 2 );
			$i   += 2;
			continue;
		}

		if ( $i + 4 > $len ) {
			return false; // Truncated.
		}

		$seg_len = ( ord( $data[ $i + 2 ] ) << 8 ) | ord( $data[ $i + 3 ] );

		if ( $seg_len < 2 || $i + 2 + $seg_len > $len ) {
			return false; // Nonsense length.
		}

		$payload = substr( $data, $i + 4, $seg_len - 2 );

		// APP1 is the only segment that carries location, in two flavours.
		$is_exif = 0xE1 === $marker && 0 === strpos( $payload, "Exif\x00\x00" );
		$is_xmp  = 0xE1 === $marker && 0 === strpos( $payload, 'http://ns.adobe.com/xap/1.0/' );

		if ( $is_exif || $is_xmp ) {
			$removed = true;
		} else {
			$out .= substr( $data, $i, 2 + $seg_len );
		}

		$i += 2 + $seg_len;
	}

	if ( ! $removed ) {
		return false;
	}

	// Only touch the file once the whole walk succeeded.
	return false !== file_put_contents( $path, $out ); // phpcs:ignore WordPress.WP.AlternativeFunctions
}

/**
 * Does this file still carry location metadata?
 *
 * Used by the tests, and by the reviewer's pre-publish check — a control that
 * nobody can verify is not a control (see includes/admin-pin.php).
 *
 * @param string $path Absolute path to a file.
 * @return bool
 */
function skybird_projects_jpeg_has_location( $path ) {
	if ( ! is_readable( $path ) ) {
		return false;
	}

	$data = file_get_contents( $path ); // phpcs:ignore WordPress.WP.AlternativeFunctions

	if ( false === $data ) {
		return false;
	}

	return false !== strpos( $data, "Exif\x00\x00" )
		|| false !== strpos( $data, 'http://ns.adobe.com/xap/1.0/' );
}
