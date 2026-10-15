<?php
/**
 * Single project page.
 *
 * Overridable by dropping single-project.php into the Hub Child theme.
 *
 * Requirements this template implements, with sources:
 * - "Back to all [area] projects" link — docs/03-structure-signoff.md §2
 * - Share to Facebook button — docs/03-structure-signoff.md §2
 * - Link back to the service-area page, using the canonical -nc URL
 * - Mobile/tablet first: a project page doubles as a kitchen-table sales tool
 *   on a rep's tablet, not only an SEO asset — docs/06-trigger-design.md §4
 * - No homeowner name, phone, email or street address anywhere, including alt
 *   text — docs/06-trigger-design.md §3
 *
 * @package Skybird_Projects
 */

defined( 'ABSPATH' ) || exit;

// Not get_header() -- that only works on a classic theme. See
// includes/template.php for why.
skybird_projects_header();

$project_id = get_the_ID();
// Resolved, not guessed. The raw path falls back to /service-areas/{slug}-nc/
// and six of the fourteen areas have no hub page, so the old back-link pointed
// at a 404 (includes/breadcrumbs.php).
$area_url   = skybird_projects_area_page_url( $project_id );
$area_terms = get_the_terms( $project_id, SKYBIRD_PROJECTS_TAXONOMY );
$area_name  = ( ! empty( $area_terms ) && ! is_wp_error( $area_terms ) ) ? reset( $area_terms )->name : '';
$gallery    = get_post_meta( $project_id, 'gallery', true );
$share_url  = skybird_projects_share_url( $project_id );

$manufacturer = get_post_meta( $project_id, 'manufacturer', true );
$product_line = get_post_meta( $project_id, 'product_line', true );
$color        = get_post_meta( $project_id, 'color', true );
$warranty     = get_post_meta( $project_id, 'warranty', true );
?>

<main class="skybird-project" id="content">
	<article <?php post_class( 'skybird-project__article' ); ?>>

		<?php
		// Item 1 of the docs/13 §6 outline, and the first thing a referred
		// visitor needs: they have landed on a page about a stranger's house.
		echo skybird_projects_breadcrumb_html( $project_id ); // phpcs:ignore WordPress.Security.EscapeOutput -- escaped per crumb.
		?>

		<header class="skybird-project__header">
			<?php
			// docs/13-page-definition.md §3 wants a human H1 ("A new Charcoal
			// roof for a two-story Youngsville home") while the <title> tag
			// stays keyword-first. docs/06-trigger-design.md §3 locks the
			// post title to the keyword-first form, and docs/01–06 are ground
			// truth unless something contradicts them — this does, so it is
			// FLAGGED rather than overridden: the share title is used as the
			// H1 only when a human has written one, and a project without one
			// renders exactly as it does today. Jacob decides whether the
			// human H1 becomes the default.
			//
			// the_title() is not used because this needs the same string
			// og:title resolved to, and resolving it twice is how the eyebrow
			// line shipped broken twice (includes/template.php).
			$heading = skybird_projects_og_title( $project_id );
			?>
			<h1 class="skybird-project__title"><?php echo esc_html( $heading ); ?></h1>

			<?php
			// The eyebrow rule lives in includes/template.php so the suite can
			// exercise it -- it has shipped broken twice from being inline here.
			$meta_line = skybird_projects_meta_line( $project_id );

			if ( $meta_line ) :
				?>
				<p class="skybird-project__meta"><?php echo esc_html( $meta_line ); ?></p>
			<?php endif; ?>
		</header>

		<?php if ( has_post_thumbnail() ) : ?>
			<figure class="skybird-project__cover">
				<?php
				// Alt text is generated from product and place — never from
				// CompanyCam data, which carries the homeowner's name. See
				// docs/09-euan-answers.md and docs/07-phase-4-preflight.md §2.4.1.
				the_post_thumbnail(
					'large',
					array(
						'alt'     => esc_attr( skybird_projects_photo_alt( get_post_thumbnail_id( $project_id ), $project_id ) ),
						'loading' => 'eager',
					)
				);
				?>
			</figure>
		<?php endif; ?>

		<div class="skybird-project__body">
			<?php the_content(); ?>
		</div>

		<?php if ( $manufacturer || $product_line || $color || $warranty ) : ?>
			<section class="skybird-project__specs" aria-labelledby="skybird-specs-heading">
				<h2 id="skybird-specs-heading"><?php esc_html_e( 'What we installed', 'skybird-projects' ); ?></h2>
				<dl class="skybird-project__spec-list">
					<?php
					$specs = array(
						__( 'Manufacturer', 'skybird-projects' ) => $manufacturer,
						__( 'Product', 'skybird-projects' )      => $product_line,
						__( 'Color', 'skybird-projects' )        => $color,
						__( 'Warranty', 'skybird-projects' )     => $warranty,
					);

					foreach ( $specs as $label => $value ) {
						if ( ! $value ) {
							continue;
						}
						printf(
							'<dt>%s</dt><dd>%s</dd>',
							esc_html( $label ),
							esc_html( $value )
						);
					}
					?>
				</dl>
			</section>
		<?php endif; ?>

		<?php if ( is_array( $gallery ) && $gallery ) : ?>
			<section class="skybird-project__gallery" aria-labelledby="skybird-gallery-heading">
				<h2 id="skybird-gallery-heading"><?php esc_html_e( 'The work', 'skybird-projects' ); ?></h2>
				<ul class="skybird-project__grid">
					<?php
					foreach ( $gallery as $attachment_id ) :
						$attachment_id = (int) $attachment_id;
						// Per photo, not per project. The same alt on every
						// image announced itself six times to a screen reader
						// and said nothing (includes/photo-captions.php).
						$caption = skybird_projects_photo_caption( $attachment_id );
						?>
						<li>
							<figure class="skybird-project__photo">
								<?php
								echo wp_get_attachment_image(
									$attachment_id,
									'large',
									false,
									array(
										'alt'     => esc_attr( skybird_projects_photo_alt( $attachment_id, $project_id ) ),
										'loading' => 'lazy',
									)
								);
								?>
								<?php if ( '' !== $caption ) : ?>
									<figcaption class="skybird-project__caption"><?php echo esc_html( $caption ); ?></figcaption>
								<?php endif; ?>
							</figure>
						</li>
					<?php endforeach; ?>
				</ul>
			</section>
		<?php endif; ?>

		<footer class="skybird-project__footer">
			<?php if ( $area_url && $area_name ) : ?>
				<a class="skybird-project__back" href="<?php echo esc_url( $area_url ); ?>">
					<?php
					printf(
						/* translators: %s: service area name. */
						esc_html__( 'Back to all %s projects', 'skybird-projects' ),
						esc_html( $area_name )
					);
					?>
				</a>
			<?php endif; ?>

			<?php if ( $share_url ) : ?>
				<a
					class="skybird-project__share"
					href="<?php echo esc_url( $share_url ); ?>"
					target="_blank"
					rel="noopener noreferrer"
				>
					<?php esc_html_e( 'Share to Facebook', 'skybird-projects' ); ?>
				</a>
			<?php endif; ?>
		</footer>

	</article>
</main>

<?php
skybird_projects_footer();
