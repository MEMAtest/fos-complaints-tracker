'use client';

import React, { useEffect, useRef, useState } from 'react';
import { BRAND } from './regcomplaints-brand';

/**
 * Scroll-choreographed & interactive Determination Quill motion system for RegComplaints.
 *
 * Design principles (mirroring RegCanary's deliberate brand-character motion):
 *  1. Play-once on arrival (`IntersectionObserver`), then rest poised — never a jittery
 *     infinite snap-back loop that distracts from reading.
 *  2. Interactive replay on hover or tab switch so the nib responds to user intent.
 *  3. GPU-composited properties only (`transform`, `opacity`, `stroke-dashoffset`) and
 *     100% `prefers-reduced-motion: reduce` compliance.
 */

export function useRevealOnce(threshold = 0.2) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, visible };
}

/**
 * Hero calligraphic signature underline:
 * Draws an organic golden Ombudsman determination flourish once on mount,
 * settles into a gentle poised rest, and replays cleanly on hover.
 */
export function WritingQuillUnderline({ className }: { className?: string }) {
  const [replayKey, setReplayKey] = useState(0);

  return (
    <div
      className={`rc-quill-underline group inline-flex cursor-default items-center gap-2 ${className || ''}`.trim()}
      onMouseEnter={() => setReplayKey((k) => k + 1)}
      aria-hidden="true"
    >
      <svg
        key={replayKey}
        width="256"
        height="30"
        viewBox="0 0 256 30"
        fill="none"
        className="overflow-visible"
      >
        {/* Faint editorial rule baseline */}
        <path
          d="M 4 22 C 62 18, 128 24, 196 19 C 214 17.5, 224 18.5, 232 20"
          stroke="rgba(8, 22, 47, 0.08)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* Primary calligraphic gold ink stroke — draws once smoothly */}
        <path
          className="rc-ink-stroke-once"
          d="M 4 22 C 62 18, 128 24, 196 19 C 214 17.5, 224 18.5, 232 20"
          stroke="url(#rc-ink-grad)"
          strokeWidth="2.8"
          strokeLinecap="round"
        />
        {/* Subtle ink-sheen dot at the signature terminus */}
        <circle
          cx="232"
          cy="20"
          r="2.4"
          fill={BRAND.gold}
          className="rc-ink-terminus"
        />
        {/* Gliding angled Determination Nib that draws the stroke then rests poised */}
        <g className="rc-quill-write-once">
          <g className="rc-quill-poise" transform="translate(0, 19) rotate(40)">
            <rect x="-4.5" y="-23" width="9" height="3.2" rx="1.2" fill={BRAND.navy} />
            <path d="M 0 0 L -6.8 -14.5 L -4.2 -19.5 L 0 -19.5 Z" fill={BRAND.goldPale} />
            <path d="M 0 0 L 6.8 -14.5 L 4.2 -19.5 L 0 -19.5 Z" fill={BRAND.gold} />
            <line x1="0" y1="0" x2="0" y2="-11.5" stroke={BRAND.navy} strokeWidth="1.25" />
            <circle cx="0" cy="-12.5" r="1.8" fill={BRAND.navy} />
          </g>
        </g>
        <defs>
          <linearGradient id="rc-ink-grad" x1="4" y1="20" x2="232" y2="20" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={BRAND.goldDeep} />
            <stop offset="55%" stopColor={BRAND.gold} />
            <stop offset="100%" stopColor={BRAND.goldPale} />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

/**
 * Scroll-triggered Determination Ledger Sketch beside "How it works":
 * Sketches three progressive precedent lines (Signal -> Evidence -> Determination)
 * as the section scrolls into view, then settles with a poised nib.
 */
export function QuillLedgerSketch({ className }: { className?: string }) {
  const { ref, visible } = useRevealOnce(0.25);

  return (
    <div
      ref={ref}
      className={`hidden items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/95 px-3.5 py-2 shadow-sm md:inline-flex ${className || ''}`.trim()}
      aria-hidden="true"
    >
      <svg width="156" height="36" viewBox="0 0 156 36" fill="none">
        <line
          x1="4"
          y1="9"
          x2="86"
          y2="9"
          stroke={BRAND.navy}
          strokeWidth="2"
          strokeLinecap="round"
          className={visible ? 'rc-ledger-draw-1' : 'opacity-0'}
        />
        <line
          x1="4"
          y1="18"
          x2="116"
          y2="18"
          stroke={BRAND.gold}
          strokeWidth="2.3"
          strokeLinecap="round"
          className={visible ? 'rc-ledger-draw-2' : 'opacity-0'}
        />
        <line
          x1="4"
          y1="27"
          x2="98"
          y2="27"
          stroke="rgba(8, 22, 47, 0.38)"
          strokeWidth="2"
          strokeLinecap="round"
          className={visible ? 'rc-ledger-draw-3' : 'opacity-0'}
        />
        <g className={visible ? 'rc-ledger-nib rc-ledger-nib-active' : 'rc-ledger-nib'}>
          <g transform="translate(128, 24) rotate(36)">
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

/**
 * Scroll-drawn golden ink precedent thread connecting Phase 1 -> 2 -> 3 -> 4
 * across the top of the workflow grid.
 */
export function PrecedentInkRail({ visible }: { visible: boolean }) {
  return (
    <div className="mb-3 hidden items-center px-1 lg:flex" aria-hidden="true">
      <svg width="100%" height="14" viewBox="0 0 1200 14" preserveAspectRatio="none" fill="none">
        <line x1="12" y1="7" x2="1188" y2="7" stroke="rgba(15, 31, 79, 0.10)" strokeWidth="2" strokeLinecap="round" />
        <line
          x1="12"
          y1="7"
          x2="1188"
          y2="7"
          stroke={BRAND.gold}
          strokeWidth="2.2"
          strokeLinecap="round"
          className={visible ? 'rc-rail-draw' : 'rc-rail-hidden'}
        />
        {[12, 404, 796, 1188].map((cx, i) => (
          <circle
            key={cx}
            cx={cx}
            cy="7"
            r="4.5"
            fill={i === 0 || i === 3 ? BRAND.navy : BRAND.gold}
            stroke="#ffffff"
            strokeWidth="2"
            className={visible ? 'rc-rail-node' : 'opacity-0'}
            style={{ animationDelay: `${i * 220}ms` }}
          />
        ))}
      </svg>
    </div>
  );
}

/**
 * State-reactive mini Determination Nib icon inside the interactive GuidedDemoPanel:
 * Gently responds with a tailored micro-motion whenever the user switches tabs.
 */
export function DemoStepNibBadge({ stepKey }: { stepKey: 'search' | 'compare' | 'work' | 'report' }) {
  return (
    <span
      key={stepKey}
      className="rc-nib-pop inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#e2b12f]/40 bg-[#08162f] shadow-sm"
      aria-hidden="true"
    >
      <svg width="18" height="18" viewBox="0 0 100 100" fill="none">
        <path d="M50 14L27 56L36 76H50Z" fill={BRAND.goldPale} />
        <path d="M50 14L73 56L64 76H50Z" fill={BRAND.gold} />
        <rect x="35" y="79" width="30" height="5.5" rx="2.5" fill={BRAND.goldDeep} />
        <line x1="50" y1="14" x2="50" y2="50" stroke={BRAND.navy} strokeWidth="3.5" strokeLinecap="round" />
        <circle cx="50" cy="52" r="5.6" fill={BRAND.navy} />
      </svg>
    </span>
  );
}
