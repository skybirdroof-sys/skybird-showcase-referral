<?php
/**
 * The banned-phrase scan.
 *
 * ## Why this exists
 *
 * docs/13-page-definition.md §5 guard 4 and the §5 publish gate both call for
 * a mechanical scan of the visible copy. Two separate reasons:
 *
 * 1. **Claim language.** CLAUDE.md's hard rules put "hail", "insurance claim"
 *    and the storm date off the page entirely. The page exists to be shared by
 *    the homeowner, and a page they post to their own friends announcing that
 *    they filed a claim is a page they quietly decide not to post. The
 *    storm_date field is private and unrendered, which closes the automated
 *    route — this closes the hand-typed one.
 *
 * 2. **Boilerplate.** 200 pages reading "stunning transformation" is what
 *    "mass-produced" looks like to a reader and to Google.
 *
 * ## What it deliberately does NOT do
 *
 * It warns. It does not block, and it does not rewrite. "Nothing publishes
 * automatically — a human reviews every page" is a closed decision, and a
 * scanner that silently edited copy would be making the judgement instead of
 * surfacing it. A reviewer who reads "this says hail" and decides the sentence
 * has to stay is allowed to be right; there is no list of phrases that knows
 * more about a specific roof than the person who sold it.
 *
 * ## What it scans, and what it must never scan
 *
 * Free text a human typed: the title, the body copy, photo captions.
 *
 * NOT fields read from the job record. Manufacturer, product line, colour and
 * warranty come from ProLine and the Production HQ sheet, and flagging those
 * would mean telling a reviewer that a true, recorded product name is a
 * marketing violation. "Peace of Mind" is the clearest case: it is banned as
 * copy, and it is also the real name of one of the three packages. The package
 * tier is private and never rendered, so there is no live conflict — but the
 * line matters, because the moment this scan starts policing record data,
 * somebody starts editing the record to satisfy it.
 *
 * @package Skybird_Projects
 */

defined( 'ABSPATH' ) || exit;

/**
 * Phrases that fail a page, with the reason a reviewer needs to see.
 *
 * Grouped so the reason can be specific. A warning that just says "banned
 * phrase" gets overridden; one that says why gets fixed.
 *
 * @return array[] Each: pattern (regex, no delimiters), label, why.
 */
function skybird_projects_banned_phrases() {
	$claim = __( 'Claim and storm language stays off the page entirely — the homeowner shares this with their own friends, and their claim is their private business.', 'skybird-projects' );
	$boiler = __( 'Boilerplate. It appears on every roofer\'s site, so it tells a reader nothing and makes 200 pages look mass-produced.', 'skybird-projects' );
	$invent = __( 'No invented specifics. Prices, offers and figures are not ours to put on a project page.', 'skybird-projects' );
	$scare = __( 'Scare or urgency copy. If the page reads like a flyer, sharing it makes the homeowner a billboard.', 'skybird-projects' );

	return array(
		// Claim / storm framing.
		array( 'pattern' => '\bhail\w*',            'label' => 'hail',                'why' => $claim ),
		array( 'pattern' => '\binsurance\b',        'label' => 'insurance',           'why' => $claim ),
		array( 'pattern' => '\bclaims?\b',          'label' => 'claim',               'why' => $claim ),
		array( 'pattern' => '\badjuster\w*',        'label' => 'adjuster',            'why' => $claim ),
		array( 'pattern' => '\bdeductible\w*',      'label' => 'deductible',          'why' => $claim ),
		array( 'pattern' => '\bstorm\s*season\b',   'label' => 'storm season',        'why' => $claim ),
		array( 'pattern' => '\bstorm\s*damage\b',   'label' => 'storm damage',        'why' => $claim ),

		// Boilerplate.
		array( 'pattern' => '\bstunning\b',         'label' => 'stunning',            'why' => $boiler ),
		array( 'pattern' => '\btransformation\b',   'label' => 'transformation',      'why' => $boiler ),
		array( 'pattern' => '\bdream roof\b',       'label' => 'dream roof',          'why' => $boiler ),
		array( 'pattern' => '\banother happy customer\b', 'label' => 'another happy customer', 'why' => $boiler ),
		array( 'pattern' => "\bwe('|)re proud to announce\b", 'label' => "we're proud to announce", 'why' => $boiler ),
		array( 'pattern' => '\bpeace of mind\b',    'label' => 'peace of mind',       'why' => $boiler ),
		array( 'pattern' => '\bprotect your biggest investment\b', 'label' => 'protect your biggest investment', 'why' => $boiler ),
		array( 'pattern' => '\btop[- ]quality\b',   'label' => 'top-quality',         'why' => $boiler ),
		array( 'pattern' => '\bstate[- ]of[- ]the[- ]art\b', 'label' => 'state-of-the-art', 'why' => $boiler ),
		array( 'pattern' => '#1\b',                 'label' => '#1',                  'why' => $boiler ),
		array( 'pattern' => '\bbest in\b',          'label' => 'best in',             'why' => $boiler ),

		// Scare / urgency.
		array( 'pattern' => "\bdon('|)t wait\b",    'label' => "don't wait",          'why' => $scare ),
		array( 'pattern' => '\bbefore it(\'|)s too late\b', 'label' => "before it's too late", 'why' => $scare ),
		array( 'pattern' => '\bact now\b',          'label' => 'act now',             'why' => $scare ),
		array( 'pattern' => '\blimited time\b',     'label' => 'limited time',        'why' => $scare ),

		// Invented specifics. Patterns, not phrases.
		array( 'pattern' => '\$\s*[\d,]',           'label' => 'a dollar figure',     'why' => $invent ),
		array( 'pattern' => '\b\d+\+?\s*years\s+(in business|of (experience|service))\b', 'label' => 'years in business', 'why' => $invent ),
		array( 'pattern' => '\b\d(\.\d)?\s*[- ]?stars?\b', 'label' => 'a star rating', 'why' => $invent ),
		array( 'pattern' => '\bfree roof\b',        'label' => 'free roof',           'why' => $invent ),

		// "free" on its own is the one judgement call in the list. It is in
		// docs/13's ban with an explicit carve-out for a documented live offer,
		// and it also appears in sentences nobody should have to rewrite
		// ("free of debris"). So it is flagged with its own reason rather than
		// left out: the reviewer decides, which is the whole posture here.
		array(
			'pattern' => '\bfree\b',
			'label'   => 'free',
			'why'     => __( 'Only allowed if it names a real, currently documented offer. Never as a figure of speech about price.', 'skybird-projects' ),
		),
	);
}

/**
 * Scan a string of visible copy.
 *
 * Apostrophes are normalised before matching, and this is not a detail.
 * WordPress runs wptexturize() on post content, which turns a typed `don't`
 * into `don’t` with a curly U+2019. A scan written against the straight
 * apostrophe silently stops matching every contraction in the list the moment
 * the copy is saved and re-read — it would pass, and it would be passing for
 * the wrong reason, which is the specific failure this suite has already had
 * twice (CLAUDE.md).
 *
 * @param string $text Visible copy.
 * @return array[] Each: label, why. Empty when the copy is clean.
 */
function skybird_projects_copy_warnings( $text ) {
	$text = (string) $text;

	if ( '' === trim( $text ) ) {
		return array();
	}

	// Curly quotes and dashes back to their typed forms, and tags out, so a
	// phrase split by markup ("<em>don't</em> wait") still matches.
	$haystack = wp_strip_all_tags( $text );
	$haystack = str_replace(
		array( "\xE2\x80\x98", "\xE2\x80\x99", "\xE2\x80\x9C", "\xE2\x80\x9D", "\xE2\x80\x93", "\xE2\x80\x94", "\xC2\xA0" ),
		array( "'", "'", '"', '"', '-', '-', ' ' ),
		$haystack
	);
	$haystack = preg_replace( '/\s+/', ' ', $haystack );

	$found = array();

	foreach ( skybird_projects_banned_phrases() as $rule ) {
		if ( preg_match( '/' . $rule['pattern'] . '/i', $haystack ) ) {
			$found[ $rule['label'] ] = array(
				'label' => $rule['label'],
				'why'   => $rule['why'],
			);
		}
	}

	return array_values( $found );
}

/**
 * Scan everything visible on a project: title, body, and every photo caption.
 *
 * @param int $post_id Project post ID.
 * @return array[] Each: where, label, why.
 */
function skybird_projects_project_copy_warnings( $post_id ) {
	$sources = array(
		__( 'the title', 'skybird-projects' )     => get_the_title( $post_id ),
		__( 'the body copy', 'skybird-projects' ) => get_post_field( 'post_content', $post_id ),
	);

	foreach ( skybird_projects_project_photo_ids( $post_id ) as $attachment_id ) {
		$caption = skybird_projects_photo_caption( $attachment_id );

		if ( '' !== $caption ) {
			$sources[ sprintf(
				/* translators: %d: attachment ID. */
				__( 'the caption on photo #%d', 'skybird-projects' ),
				$attachment_id
			) ] = $caption;
		}
	}

	$warnings = array();

	foreach ( $sources as $where => $text ) {
		foreach ( skybird_projects_copy_warnings( $text ) as $warning ) {
			$warning['where'] = $where;
			$warnings[]       = $warning;
		}
	}

	return $warnings;
}
