# The RegComplaints brand

The source of truth for the mark, the palette and the tagline. If a colour,
an asset or a strapline anywhere in this repository disagrees with this file,
this file is right and that thing is a bug.

## The approved lockup

**Variant 1, "Modern & Premium"** (the Ombudsman Owl & Balance Scales), is the
primary lockup, and the only approved one. It was chosen from a sheet of five
options; the other four were rejected.

- Master artwork: `public/images/brand/regcomplaints-primary.png` — 2000x667,
  RGBA with real transparency.
- Transparent symbol source: `docs/brand/regcomplaints-symbol-transparent-source-20261122.png`.
- The rejected options sheet is kept here for reference only, as
  `docs/brand/regcomplaints-variants-reference.png`. It is deliberately **not**
  under `public/`: anything there is served, and a rejected logo at a
  guessable URL is a brand leak.

The lockup is a gold-and-navy Ombudsman Owl crowning a balanced adjudication
scale, a serif "RegComplaints" wordmark, and the tagline in letter-spaced
navy caps.

## The tagline

> **Ombudsman insight. Decisive resolution.**

This is the official tagline, carried directly by the master lockup and the
social card.

## The palette, and where it came from

Every figure below was measured off the master symbol artwork by classifying
each opaque pixel into its tonal zone and taking the pixel-count-weighted
mean. 176,439 opaque pixels across three distinct tonal zones:

| Zone | Pixels | Weighted mean | Token |
| --- | ---: | --- | --- |
| Owl & left adjudication scale (Gold) | 91,321 | `#e2b12f` | `BRAND.gold` |
| Owl upper-left crest & brow (Champagne) | 20,883 | `#f5daa3` (`#f8e7b9` raw) | `BRAND.goldPale` |
| Right adjudication scale & pillar (Navy) | 64,235 | `#08162f` (`#102038` raw) | `BRAND.navy` |
| Deep burnished gold (dark-ground right scale) | — | `#c9971a` | `BRAND.goldDeep` |

## The mark at small sizes

At 24–36px in navigation headers and the 64px collapsed workspace sidebar,
the full 2000x667 lockup with tagline would blur. Instead:

- **Top navigation (`MarketingHeader`, `PublicInsightsShell`, `AppHeader`) and
  the workspace sidebar (`SidebarNav`)** use the simplified inline SVG in
  `src/components/brand/regcomplaints-brand.tsx` (`<RegComplaintsMark />`),
  traced from the master symbol's alpha channel (`eps = 0.52` Douglas-Peucker)
  into its three tonal zones (`OWL_GOLD_PATH`, `OWL_PALE_PATH`,
  `SCALE_NAVY_PATH`, `viewBox="0 0 100 90"`).
- On dark navy surfaces (`tone="on-dark"`), the right scale's navy zone is
  remapped to `BRAND.goldDeep` (`#c9971a`) so the right scale does not vanish
  into a navy bar.

## The assets

| File | What it is |
| --- | --- |
| `public/images/brand/regcomplaints-primary.png` | The 2000x667 RGBA master lockup. |
| `public/images/brand/regcomplaints-lockup-{360,720,1080}.png` | Responsive lockups for **light** grounds. |
| `public/images/brand/regcomplaints-lockup-on-dark-{360,720,1080}.png` | Responsive lockups for **dark** grounds (`#08162f` / `#0f1f4f`). |
| `public/images/brand/regcomplaints-og.png`, `public/og-image.png` | 1200x630 Open Graph / Twitter social card on brand navy `#08162f`. |
| `public/favicon.ico` | 16 / 32 / 48, three independently rendered frames. |
| `public/favicon.svg`, `public/regcomplaints-mark.svg` | Vector SVG favicon and standalone mark. |
| `public/favicon.png`, `public/images/favicon.png` | 32px PNG favicon. |
| `public/icons/icon-{180,192,512}.png` | Apple touch icon and PWA icons on brand navy. |
| `public/icons/icon-maskable-512.png` | Maskable 512px icon with 19% safe-area inset on full-bleed navy square. |
