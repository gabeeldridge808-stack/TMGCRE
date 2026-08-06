# Design system

`app/globals.css` is the single source of truth for color, type, spacing,
buttons, cards, tables, badges, and form fields. When adding or editing UI:

- Use the existing classes (`.btn`/`.btn-primary`/`.btn-secondary`/`.btn-danger`,
  `.card`, `.field`, `.table`, `.tab-bar`/`.tab-button`, `.stat-tile`) instead
  of writing new inline colors, borders, or radii. If nothing fits, add a new
  class to `globals.css` following the existing token names (`--color-*`,
  `--radius-*`) rather than hardcoding a hex value in a component.
- Use `app/Badge.tsx` for status-like labels (stage, asset class). Stage
  color-coding lives in `STAGE_BADGE_VARIANT` (`lib/dealConstants.ts`).
- Site-wide chrome (header, page container) lives in `app/layout.tsx` and the
  `.page`/`.page-narrow` classes — wrap new top-level pages in `<main
  className="page">` rather than repeating padding/maxWidth inline.
- Light theme only, intentionally — this is an internal tool, not a
  consumer product.
- Font is Inter via `next/font/google` (see `app/layout.tsx`), not a raw
  `font-family` string.

Inline `style={{...}}` is still fine for one-off layout (flex/grid
structure, spacing between specific elements) — it's just colors, borders,
radii, and component chrome that should come from the classes above.
