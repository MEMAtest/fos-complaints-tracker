# The RegComplaints brand

The source of truth for the mark, the palette, typography, motion motifs and tagline.

## The approved lockup

**Option 6, "Editorial Determination Nib"**, is the primary brand mark and the only
approved one. It was chosen from a 6-option non-owl exploration sheet; the other five
were rejected.

- Master artwork: `public/images/brand/regcomplaints-primary.png` — 2000×667 RGBA with transparency.
- Transparent symbol source: `docs/brand/regcomplaints-symbol-transparent-source-20261122.png`.
- Rejected options sheet: `docs/brand/regcomplaints-variants-reference.png` (kept out of `public/`).

The lockup pairs an upward-poised Ombudsman determination fountain nib enclosed in a deep
midnight navy crest (`#08162f`), split into Champagne Gold (`#f5daa3`) and Adjudication Gold
(`#e2b12f`) with a burnished collar (`#c9971a`), beside the serif `"RegComplaints"` wordmark
and letter-spaced tagline **`OMBUDSMAN INSIGHT. DECISIVE RESOLUTION.`**

## Typography

- **Display / Headings & Wordmark:** `Playfair Display` (matching RegCanary & RegDuty)
- **Body / UI / Data Tables:** `IBM Plex Sans`

## Signature Motion (Determination Quill)

Echoing RegCanary's signature brand-character motion, `src/components/brand/determination-quill-motion.tsx`
provides subtle, `prefers-reduced-motion`-safe writing-nib animations:
- `<WritingQuillUnderline />` — glides a gold determination nib across an ink rule beneath the hero headline.
- `<QuillLedgerSketch />` — sketches three progressive precedent lines beside the workflow section heading.
