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
$area_page  = skybird_projects_get_area_page( $project_id );
$area_terms = get_the_terms( $project_id, SKYBIRD_PROJECTS_TAXONOMY );
$area_name  = ( ! empty( $area_terms ) && ! is_wp_error( $area_terms ) ) ? reset( $area_terms )->name : '';
$gallery    = get_post_meta( $project_id, 'gallery', true );
$share_url  = skybird_projects_share_url( $project_id );

$city         = get_post_meta( $project_id, 'city', true );
$manufacturer = get_post_meta( $project_id, 'manufacturer', true );
$product_line = get_post_meta( $project_id, 'product_line', true );
$color        = get_post_meta( $project_id, 'color', true );
$warranty     = get_post_meta( $project_id, 'warranty', true );
$completed    = get_post_meta( $project_id, 'completion_date', true );
?>

<main class="skybird-project" id="content">
	<article <?php post_class( 'skybird-project__article' ); ?>>

		<header class="skybird-project__header">
			<h1 class="skybird-project__title"><?php the_title(); ?></h1>

			<?php if ( $area_name ) : ?>
				<p class="skybird-project__area">
					<?php
					printf(
						/* translators: %s: service area name. */
						esc_html__( 'Roof replacement in %s, NC', 'skybird-projects' ),
						esc_html( $area_name )
					);
					?>
				</p>
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
						'alt'     => esc_attr( skybird_projects_image_alt( $project_id ) ),
						'loading' => 'eager',
					)
				);
				?>
			</figure>
		<?php endif; ?>

		<div class="skybird-project__body">
			<?php the_content(); ?>
		</div>

		<?php if ( $manufacturer || $product_line || $color || $warranty || $completed ) : ?>
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

					if ( $completed ) {
						$specs[ __( 'Completed', 'skybird-projects' ) ] = date_i18n(
							(string) get_option( 'date_format' ),
							strtotime( $completed )
						);
					}

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
					<?php foreach ( $gallery as $attachment_id ) : ?>
						<li>
							<?php
							echo wp_get_attachment_image(
								(int) $attachment_id,
								'large',
								false,
								array(
									'alt'     => esc_attr( skybird_projects_image_alt( $project_id ) ),
									'loading' => 'lazy',
								)
							);
							?>
						</li>
					<?php endforeach; ?>
				</ul>
			</section>
		<?php endif; ?>

		<footer class="skybird-project__footer">
			<?php if ( $area_page && $area_name ) : ?>
				<a class="skybird-project__back" href="<?php echo esc_url( home_url( $area_page ) ); ?>">
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
