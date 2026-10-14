<?php
/**
 * The product vocabulary: shingle line, manufacturer, colour.
 *
 * Built from the real one. `Production HQ` holds 201 completed roofs going
 * back to January 2025, and reading all of it on 2026-10-14 settled three
 * things that guesswork had got wrong:
 *
 * 1. **Not every roof is GAF.** Alongside 104 HDZ, 67 NS and 25 UHDZ there
 *    are CertainTeed Landmark, Grand Manor and Highland Slate, and an IKO
 *    Cambridge. Deriving "GAF" from the presence of a shingle line would have
 *    put the wrong manufacturer on four pages, two of them large jobs.
 * 2. **Warranty cannot be derived from the package.** 26 jobs took the Peace
 *    of Mind package; only 4 have a Golden Pledge warranty filed, and 89 of
 *    the 201 have no extended warranty at all. The warranty is read, never
 *    inferred. See skybird_projects_sanitize_warranty() in meta.php.
 * 3. **Colours are spelled several ways.** "Pewter Gray" 15, "Pewter Grey"
 *    10, one "Charoal". These reach the page and the alt text behind every
 *    photo, so they are normalised — but conservatively (see below).
 *
 * @package Skybird_Projects
 */

defined( 'ABSPATH' ) || exit;

/**
 * Shingle line as recorded in production, mapped to what goes on the page.
 *
 * Keys are lowercased and trimmed before lookup, so "hdz" and "HDZ " both
 * land. `NS` is Natural Shadow — confirmed by Jacob, not inferred from the
 * initials, which is the kind of guess that puts a wrong product name next to
 * a manufacturer's certification claim.
 *
 * @return array[] line => array( manufacturer, product_line )
 */
function skybird_projects_shingle_lines() {
	return array(
		'ns'                => array( 'GAF', 'Timberline Natural Shadow' ),
		'hdz'               => array( 'GAF', 'Timberline HDZ' ),
		'uhdz'              => array( 'GAF', 'Timberline UHDZ' ),
		'ct landmark'       => array( 'CertainTeed', 'Landmark' ),
		'ct grand manor'    => array( 'CertainTeed', 'Grand Manor' ),
		'ct highland slate' => array( 'CertainTeed', 'Highland Slate' ),
		'iko cambridge'     => array( 'IKO', 'Cambridge' ),
	);
}

/**
 * Resolve a shingle line into manufacturer and product line.
 *
 * An unrecognised value returns empty strings rather than a guess. A page with
 * no product named is thin; a page naming the wrong manufacturer alongside a
 * certification claim is a different kind of problem, and the reviewer can see
 * an empty field but cannot see a plausible wrong one.
 *
 * @param string $line Value from the production sheet.
 * @return array { @type string $manufacturer @type string $product_line }
 */
function skybird_projects_resolve_shingle( $line ) {
	$key   = strtolower( trim( (string) $line ) );
	$lines = skybird_projects_shingle_lines();

	if ( ! isset( $lines[ $key ] ) ) {
		return array(
			'manufacturer' => '',
			'product_line' => '',
		);
	}

	return array(
		'manufacturer' => $lines[ $key ][0],
		'product_line' => $lines[ $key ][1],
	);
}

/**
 * Known spelling corrections for shingle colours.
 *
 * Deliberately short. These are the cases where the intended value is not in
 * doubt: a manufacturer's own spelling ("Gray", in GAF's catalogue) and an
 * outright typo.
 *
 * Everything else passes through as typed. The temptation is to "correct"
 * every colour against a manufacturer's catalogue, and the reason not to is
 * that a wrong correction is invisible — "Golden Harvest" silently becoming
 * "Golden Amber" reads perfectly well and is false. An unfamiliar colour
 * reaching the reviewer unchanged is the safer failure.
 *
 * @return array lowercased input => corrected output
 */
function skybird_projects_color_corrections() {
	return array(
		'pewter grey'      => 'Pewter Gray',
		'charoal'          => 'Charcoal',
		'fox hollow grey'  => 'Fox Hollow Gray',
		'oyster grey'      => 'Oyster Gray',
	);
}

/**
 * Normalise a shingle colour for display.
 *
 * Applies the known corrections, then tidies capitalisation so "CHARCOAL" and
 * "charcoal" both render as "Charcoal". Does not invent, expand or substitute.
 *
 * @param string $color Value from the production sheet.
 * @return string
 */
function skybird_projects_normalize_color( $color ) {
	$color = trim( preg_replace( '/\s+/', ' ', (string) $color ) );

	if ( '' === $color ) {
		return '';
	}

	$corrections = skybird_projects_color_corrections();
	$key         = strtolower( $color );

	if ( isset( $corrections[ $key ] ) ) {
		return $corrections[ $key ];
	}

	// Title case, but leave a value that is already mixed-case alone — the
	// sheet's own spelling is more likely right than a mechanical recase.
	if ( $color === strtolower( $color ) || $color === strtoupper( $color ) ) {
		return ucwords( strtolower( $color ) );
	}

	return $color;
}

/**
 * Expand the town abbreviations production uses.
 *
 * "WF" appears on 21 rows and "Wake Forest" on 6 — the same town, and the
 * service-area lookup matches on slug, so an unexpanded "WF" fails to file
 * 21 jobs. The typos are the two found in the real data.
 *
 * @param string $town Town as written in the production sheet.
 * @return string
 */
function skybird_projects_normalize_town( $town ) {
	$town = trim( preg_replace( '/\s+/', ' ', (string) $town ) );

	$map = array(
		'wf'          => 'Wake Forest',
		'goldboro'    => 'Goldsboro',
		'younsgville' => 'Youngsville',
	);

	$key = strtolower( $town );

	return isset( $map[ $key ] ) ? $map[ $key ] : $town;
}
