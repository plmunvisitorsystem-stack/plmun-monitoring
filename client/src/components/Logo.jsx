/**
 * Official Barangay Landayan logo (transparent PNG).
 * The browser picks the 64, 192, or 512px file that fits the size and screen density.
 *   size:    width and height in px (the logo is never stretched)
 *   loading: 'lazy' (default) or 'eager' (e.g. the print letterhead, which is hidden on screen)
 */
const SRC_SET = [64, 192, 512].map((w) => `/images/landayan-logo-${w}.png ${w}w`).join(', ');

export default function Logo({ size = 48, loading = 'lazy', className = '' }) {
  return (
    <img
      className={`logo ${className}`}
      src="/images/landayan-logo-192.png"
      srcSet={SRC_SET}
      sizes={`${size}px`}
      width={size}
      height={size}
      alt="Barangay Landayan logo"
      loading={loading}
      decoding="async"
      style={{ objectFit: 'contain', flexShrink: 0 }}
    />
  );
}
