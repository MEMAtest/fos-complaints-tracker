import React from 'react';
import { BRAND } from './regcomplaints-brand';

/**
 * Animated Determination Quill / Fountain Nib visual motifs for RegComplaints.
 * Echoes RegCanary's signature brand-character animations while respecting
 * `prefers-reduced-motion: reduce` and keeping vertical footprint minimal.
 */

export function WritingQuillUnderline({ className }: { className?: string }) {
  return (
    <div
      className={`rc-quill-underline inline-flex items-center gap-2 ${className || ''}`.trim()}
      aria-hidden="true"
    >
      <svg
        width="236"
        height="28"
        viewBox="0 0 236 28"
        fill="none"
        className="overflow-visible"
      >
        {/* Subtle ink track guide */}
        <path
          d="M 4 21 Q 58 17 112 21 T 212 20"
          stroke="rgba(8, 22, 47, 0.10)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* Animated gold determination ink stroke */}
        <path
          className="rc-ink-stroke"
          d="M 4 21 Q 58 17 112 21 T 212 20"
          stroke={BRAND.gold}
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        {/* Gliding angled Determination Nib drawing the stroke */}
        <g className="rc-quill-glide">
          <g transform="translate(0, 19) rotate(42)">
            {/* Nib collar */}
            <rect x="-4.5" y="-22" width="9" height="3.2" rx="1.2" fill={BRAND.navy} />
            {/* Split gold nib body */}
            <path d="M 0 0 L -6.5 -14 L -4 -19 L 0 -19 Z" fill={BRAND.goldPale} />
            <path d="M 0 0 L 6.5 -14 L 4 -19 L 0 -19 Z" fill={BRAND.gold} />
            {/* Nib slit + breather hole */}
            <line x1="0" y1="0" x2="0" y2="-11" stroke={BRAND.navy} strokeWidth="1.2" />
            <circle cx="0" cy="-12" r="1.8" fill={BRAND.navy} />
          </g>
        </g>
      </svg>
    </div>
  );
}

export function QuillLedgerSketch({ className }: { className?: string }) {
  return (
    <div
      className={`hidden items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/90 px-3.5 py-2 shadow-sm md:inline-flex ${className || ''}`.trim()}
      aria-hidden="true"
    >
      <svg width="152" height="36" viewBox="0 0 152 36" fill="none">
        {/* Three progressive determination lines written in sequence */}
        <line
          x1="4"
          y1="9"
          x2="82"
          y2="9"
          stroke={BRAND.navy}
          strokeWidth="2"
          strokeLinecap="round"
          className="rc-ledger-line-1"
        />
        <line
          x1="4"
          y1="18"
          x2="112"
          y2="18"
          stroke={BRAND.gold}
          strokeWidth="2.2"
          strokeLinecap="round"
          className="rc-ledger-line-2"
        />
        <line
          x1="4"
          y1="27"
          x2="96"
          y2="27"
          stroke="rgba(8, 22, 47, 0.35)"
          strokeWidth="2"
          strokeLinecap="round"
          className="rc-ledger-line-3"
        />
        {/* Poised writing nib sketching the active determination line */}
        <g className="rc-ledger-nib">
          <g transform="translate(124, 24) rotate(36)">
            <rect x="-4" y="-20" width="8" height="2.8" rx="1" fill={BRAND.navy} />
            <path d="M 0 0 L -5.8 -12.5 L -3.5 -17.5 L 0 -17.5 Z" fill={BRAND.goldPale} />
            <path d="M 0 0 L 5.8 -12.5 L 3.5 -17.5 L 0 -17.5 Z" fill={BRAND.gold} />
            <line x1="0" y1="0" x2="0" y2="-10" stroke={BRAND.navy} strokeWidth="1.1" />
            <circle cx="0" cy="-11" r="1.5" fill={BRAND.navy} />
          </g>
        </g>
      </svg>
      <div className="pr-1 text-right">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#08162f]">
          Precedent to ruling
        </p>
        <p className="text-[11px] text-slate-500">Live Ombudsman corpus</p>
      </div>
    </div>
  );
}
