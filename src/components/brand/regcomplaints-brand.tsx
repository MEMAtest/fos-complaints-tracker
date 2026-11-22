import React from 'react';

/**
 * The RegComplaints Brand System
 *
 * Option 6 ("Editorial Determination Nib") — Approved Brand Mark
 * A minimalist Ombudsman fountain-pen determination nib enclosed in a deep
 * midnight navy crest (#08162f), rendered in split Champagne Gold (#f5daa3)
 * and Adjudication Gold (#e2b12f) with a burnished deep gold collar (#c9971a).
 *
 * On dark navy grounds (tone="on-dark"), a crisp gold perimeter ring frames the
 * circular crest so the mark reads vividly against #08162f / #0f1f4f surfaces.
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

export interface RegComplaintsMarkProps {
  width?: number;
  height?: number;
  tone?: 'light' | 'on-dark';
  className?: string;
}

export function RegComplaintsMark({
  width = 36,
  height,
  tone = 'light',
  className,
}: RegComplaintsMarkProps) {
  const resolvedHeight = height ?? width;
  const isDark = tone === 'on-dark';

  return (
    <svg
      width={width}
      height={resolvedHeight}
      viewBox="0 0 100 100"
      focusable="false"
      aria-hidden="true"
      className={className}
    >
      <circle cx="50" cy="50" r="46" fill={BRAND.navy} />
      <circle
        cx="50"
        cy="50"
        r={isDark ? 44.5 : 41.5}
        fill="none"
        stroke={BRAND.gold}
        strokeWidth={isDark ? 3.2 : 1.6}
        opacity={isDark ? 1 : 0.35}
      />
      <path d="M50 14L27 56L36 76H50Z" fill={BRAND.goldPale} />
      <path d="M50 14L73 56L64 76H50Z" fill={BRAND.gold} />
      <rect x="35" y="79" width="30" height="5.5" rx="2.5" fill={BRAND.goldDeep} />
      <line
        x1="50"
        y1="14"
        x2="50"
        y2="50"
        stroke={BRAND.navy}
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <circle cx="50" cy="52" r="5.6" fill={BRAND.navy} />
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
  const isDark = tone === 'on-dark';

  return (
    <span className={`inline-flex items-center gap-2.5 ${className || ''}`.trim()}>
      <span className="inline-flex shrink-0 items-center justify-center">
        <RegComplaintsMark width={markWidth} height={markWidth} tone={tone} />
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
            className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${
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
