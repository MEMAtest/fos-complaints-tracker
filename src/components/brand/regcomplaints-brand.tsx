import React from 'react';

/**
 * The RegComplaints Brand System
 *
 * Variant 1 ("Modern & Premium") — Ombudsman Owl & Adjudication Balance Scales
 * Traced from the approved master symbol (docs/brand/regcomplaints-symbol-transparent-source-20261122.png)
 * into three distinct tonal zones (Adjudication Gold, Champagne Pale Gold, and Midnight Navy).
 *
 * On dark navy grounds (tone="on-dark"), the right scale and pillar zone is remapped
 * to burnished deep gold (--rc-gold-deep, #c9971a) so the full equilibrium silhouette
 * reads vividly against #08162f / #0f1f4f headers, sidebars, and footers.
 */

export const BRAND = {
  navy: '#08162f',
  navyHeader: '#0f1f4f',
  gold: '#e2b12f',
  goldDeep: '#c9971a',
  goldPale: '#f5daa3',
  onNavy: '#f8fafc',
} as const;

export const BRAND_TAGLINE = 'Ombudsman insight. Decisive resolution.';
export const LOCKUP_ALT = 'RegComplaints - ombudsman insight. Decisive resolution.';
export const OG_IMAGE_PATH = '/images/brand/regcomplaints-og.png';

const OWL_GOLD_PATH =
  'M69.01 0.18L69.11 2.81L67.24 6.57L56.73 14.10L52.75 19.55L60.37 14.06L61.78 16.17L60.90 19.79L58.11 21.23L54.62 20.14L50.25 27.11L50.25 2.85L55.71 3.52L60.08 5.06L65.69 2.92Z M66.33 10.16L68.65 13.96L69.57 19.65L81.91 19.86L77.40 30.34L64.46 29.11L55.75 31.18L63.58 24.71L65.59 18.56L63.93 11.85Z M33.60 10.44L36.07 11.85L34.41 16.59L34.70 20.81L36.00 24.15L38.82 27.39L44.39 31.18L34.84 29.11L22.74 30.34L18.37 20.00L30.71 19.93L31.45 14.63Z M14.14 28.44L17.74 29.14L19.04 32.77L33.43 31.08L40.20 31.78L45.38 34.35L48.80 38.11L45.87 44.26L42.42 39.55L36.39 36.56L17.38 36.46L29.09 63.81L30.61 64.69L28.17 68.59L24.65 71.82L21.26 73.65L16.22 74.67L12.13 74.39L6.95 72.39L3.42 69.57L0.14 64.69L1.80 63.53L13.50 36.53L11.32 33.57L11.14 31.22L12.73 28.86Z M30.08 38.14L35.12 38.25L38.75 39.41L42.00 41.94L43.69 44.61L44.29 49.50L41.47 63.56L41.43 70.28L26.66 38.81Z M49.96 40.54L50.32 89.82L24.15 89.82L24.58 87.93L26.69 85.96L32.58 84.80L37.62 82.79L41.71 79.98L45.10 76.18L43.44 68.77L43.72 62.02L46.83 48.23Z M15.37 40.92L5.68 64.09L25.35 63.95Z';

const OWL_PALE_PATH =
  'M30.92 0.18L34.73 3.20L40.06 5.20L44.99 3.52L50.18 2.85L50.18 27.11L45.52 19.86L41.89 21.09L39.10 19.37L38.50 16.31L39.77 14.20L44.96 17.47L47.81 20.39L44.11 14.52L33.04 6.57L31.17 2.81Z';

const SCALE_NAVY_PATH =
  'M84.52 28.30L87.27 28.86L88.68 30.55L88.68 33.71L86.35 35.96L98.48 64.09L99.96 64.16L98.98 66.48L93.90 71.82L87.31 74.39L80.96 74.11L74.79 71.12L71.97 68.31L69.53 64.27L71.19 63.81L83.04 36.18L66.29 36.00L60.97 37.30L56.31 40.82L53.74 46.69L56.70 65.11L56.42 70.31L54.72 75.94L58.29 79.98L61.81 82.51L67.14 84.80L72.88 85.82L75.14 87.50L76.02 89.58L50.11 89.68L50.39 39.69L54.34 34.91L58.99 32.24L66.85 31.22L81.24 32.91L81.84 30.13Z M65.90 38.29L73.48 38.67L58.71 70.42L58.82 63.84L56.14 50.63L56.14 45.98L57.72 42.64L59.84 40.54Z M84.87 40.54L74.51 64.09L95.03 64.09Z';

export interface RegComplaintsMarkProps {
  width?: number;
  height?: number;
  tone?: 'light' | 'on-dark';
  className?: string;
}

export function RegComplaintsMark({
  width = 34,
  height = 31,
  tone = 'light',
  className,
}: RegComplaintsMarkProps) {
  const rightZoneFill = tone === 'on-dark' ? BRAND.goldDeep : BRAND.navy;
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 100 90"
      focusable="false"
      aria-hidden="true"
      className={className}
    >
      <path d={OWL_GOLD_PATH} fill={BRAND.gold} />
      <path d={OWL_PALE_PATH} fill={BRAND.goldPale} />
      <path d={SCALE_NAVY_PATH} fill={rightZoneFill} />
    </svg>
  );
}

export interface RegComplaintsWordmarkProps {
  tone?: 'light' | 'on-dark';
  markWidth?: number;
  subtitle?: string;
  className?: string;
}

export function RegComplaintsWordmark({
  tone = 'light',
  markWidth = 36,
  subtitle = 'FOS Complaints Intelligence',
  className,
}: RegComplaintsWordmarkProps) {
  const markHeight = Math.round(markWidth * 0.9);
  const isDark = tone === 'on-dark';

  return (
    <span className={`inline-flex items-center gap-3 ${className || ''}`.trim()}>
      <span className="inline-flex shrink-0 items-center justify-center">
        <RegComplaintsMark width={markWidth} height={markHeight} tone={tone} />
      </span>
      <span className="flex flex-col leading-tight">
        <span
          className="text-lg font-bold tracking-[-0.02em] md:text-xl"
          style={{
            fontFamily: 'var(--font-heading), Georgia, serif',
            color: isDark ? BRAND.onNavy : BRAND.navy,
          }}
        >
          Reg
          <span style={{ color: isDark ? BRAND.gold : BRAND.navy }}>Complaints</span>
        </span>
        {subtitle ? (
          <span
            className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${
              isDark ? 'text-white/65' : 'text-slate-500'
            }`}
          >
            {subtitle}
          </span>
        ) : null}
      </span>
    </span>
  );
}

const LOCKUP_RATIO = 2000 / 667;
const LOCKUP_WIDTHS = [360, 720, 1080] as const;

export interface RegComplaintsLockupProps {
  width?: number;
  tone?: 'light' | 'on-dark';
  className?: string;
}

export function RegComplaintsLockup({
  width = 320,
  tone = 'light',
  className,
}: RegComplaintsLockupProps) {
  const height = Math.round(width / LOCKUP_RATIO);
  const variant = tone === 'on-dark' ? '-on-dark' : '';
  const srcSet = LOCKUP_WIDTHS.map(
    (w) => `/images/brand/regcomplaints-lockup${variant}-${w}.png ${w}w`
  ).join(', ');

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/images/brand/regcomplaints-lockup${variant}-720.png`}
      srcSet={srcSet}
      sizes={`${width}px`}
      width={width}
      height={height}
      alt={LOCKUP_ALT}
      decoding="async"
      className={className}
    />
  );
}
