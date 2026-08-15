# TikTok.com — Design Tokens

All values below were read via `getComputedStyle()` / emotion rule text **while the tab was
visible and rendering** (viewport 1280×576, DPR 2, root font-size 16px — confirmed because
`--side-nav-width: 15rem` computes to exactly 240px).

## Typography

**Family (all text):** `TikTokFont, Arial, Tahoma, PingFangSC, sans-serif`
TikTokFont is a self-hosted proprietary webfont. It is **not** on Google Fonts and is not
redistributable — the clone must fall back to a stack with similar metrics (see note below).

> **Measure the element that owns the text node, not its container.** Every one of these values
> was re-taken from the leaf element holding the text. Reading `getComputedStyle()` on the
> wrapper (`a`, `div`) returns *inherited* values that the child then overrides — that produced
> three wrong rows on the first pass (nav label read as 21px/700 when it is really 16px/500).

| Role | Element that owns the text | size | weight | line-height | color |
|---|---|---|---|---|---|
| Sidebar nav label | `div.TUXButton-label` | 16px | 500 | 21px | active `#FF3B5C` / inactive `#F6F6F6` |
| Sidebar footer heading | `h3` ("Company") | 15px | 700 | 22px | `rgba(255,255,255,.5)` |
| Video author name | `p` ("SASH TALK") | 17px | 500 | 22.1px | `#F6F6F6` |
| Action-rail count | `strong.StrongText` | 12px | 700 | 16px | `rgba(255,255,255,.75)` |

Only two weights appear across the page: **500** and **700**.

## Colors

### Brand
| Token | Value | Usage |
|---|---|---|
| `--tt-red` | `#FE2C55` `rgb(254,44,85)` | Follow button, notification badges — primary brand red |
| `--tt-red-active` | `#FF3B5C` `rgb(255,59,92)` | Active sidebar nav item (For You) |
| `--tt-red-hover` | `#EA284E` | `--tux-colorPrimary-tint-8` — follow button `:hover` (corrected; an earlier pass guessed `#F1204A`) |
| `--tt-progress-elapsed` | `#FE2C55` | `--ui-shape-primary` — the played portion of the progress bar |
| `--tt-progress-track` | `rgba(255,255,255,.4)` | `--ui-image-overlay-white-a40` — unplayed track |
| `--tt-scrub-shadow` | `rgba(0,0,0,.15)` | `--ui-image-overlay-black-a15` — scrub head shadow |

### Border radius (measured — beware shadcn)

| Element | Radius |
|---|---|
| Media card & its overlays | `1rem` (16px) |
| Volume control | `1.5rem` (24px) |
| Sidebar nav row | `6px` |
| Scrub head, avatars, rail buttons | `50%` |

The shadcn preset remaps Tailwind's named radii off `--radius` (`rounded-2xl` resolves to
**18px**, `rounded-md` to 8px), so every radius above is written as an absolute arbitrary
value in the components rather than a named class.

### TUX design-system tokens (read from `getComputedStyle(document.body)`)
These are the site's own CSS custom properties — prefer mapping these into `globals.css`
rather than the raw rgb() values below.

| Token | Value |
|---|---|
| `--ui-page-flat-1` | `#000` |
| `--ui-shape-primary` | `#fe2c55` |
| `--ui-shape-neutral-3` | `hsla(0,0%,100%,.19)` |
| `--ui-shape-neutral-4` | `hsla(0,0%,100%,.13)` |
| `--ui-sheet-flat-3` | `#3a3a3a` |
| `--ui-sheet-grouped-3` | `#3a3a3a` |
| `--ui-text-1-display` | `#f0f0f0` |
| `--ui-text-placeholder` | `hsla(0,0%,100%,.4)` |
| `--ui-image-overlay-white` | `#fff` |
| `--ui-image-overlay-white-a20` | `hsla(0,0%,100%,.2)` |
| `--ui-image-overlay-white-a40` | `hsla(0,0%,100%,.4)` |
| `--ui-image-overlay-black-a15` | `rgba(0,0,0,.15)` |

### Surfaces & text
| Token | Value | Usage |
|---|---|---|
| Page background | `rgb(0,0,0)` `#000` | `body`, `.BaseBodyContainer` |
| Text primary | `rgba(255,255,255,.9)` | body default, nav labels, captions |
| Text secondary | `rgba(255,255,255,.75)` | action-rail counts |
| Icon / nav inactive | `rgb(246,246,246)` `#F6F6F6` | inactive nav icon fill |
| Search field bg | `rgba(255,255,255,.13)` | sidebar search input |
| Scrub head | `rgb(255,255,255)` | progress-bar scrub handle |

## Spacing & sizing

| Token | Value |
|---|---|
| `--side-nav-width` | `15rem` = 240px |
| `--feed-nav-button-width` | `3rem` = 48px |
| `--one-column-top-content-height` | `0px` |
| `--one-column-item-bottom-content-height` | `0px` |
| Sidebar inner content width | 208px (240 − 2×16 padding) |
| Feed column right padding | **64px** (corrected from 56px; constant whether or not the comment sidebar is open) |
| Comment sidebar width | 24rem / 21rem `<=1280` / 18rem `<=1024` |
| Comment sidebar padding | `16px 16px 20px` |
| Comment composer field | 42px tall, radius 22px |
| Activity drawer width | 20rem (320px), offset `inset-inline-start: 4.5rem` |
| Activity notification row | 72px tall, icon 48×48 radius 24px |
| Sidebar width, drawer open | 4.5rem (72px), border dropped |
| Article gap | `1rem` (16px) |
| Action-rail item | 48×78px (icon 48×48 + 16px count line) |
| Action-rail icon | 48×48px |
| Avatar (nav / action rail) | 48×48px |
| Follow badge | 24×24px |

## Radii
| Element | Value |
|---|---|
| Search field | `999px` (pill) |
| Scrub head | `50%` |
| Avatars | `50%` |

## Breakpoints
`max-width: 1280px`, `max-width: 1024px`, `max-width: 768px`

### Responsive behaviour (from CSS rule text — see note at bottom)
`.DivSideNavContainer`
```css
/* base */
width: 15rem; height: 100vh; position: fixed;
display: flex; flex-direction: column; align-items: center; flex-shrink: 0;
overflow: clip hidden; overscroll-behavior: contain;
background-color: var(--ui-page-flat-1); padding-inline: 16px; box-sizing: border-box;

@media (max-width: 1024px) {
  width: 4.5rem;                                   /* 72px — collapses to icon rail */
  border-right: 1px solid rgba(255,255,255,.12);
}
```
`.DivSearchWrapper`
```css
display: flex; width: 100%;
@media (min-width: 1025px) { width: 13rem; }        /* 208px */
@media (max-width: 1024px) { padding-inline-start: unset; justify-content: center; }
```
So at **≤1024px the sidebar collapses from 240px to a 72px icon-only rail** and gains a
right border; labels are dropped and the search field centres as an icon.

## Sidebar nav button (TUX secondary button)
| Property | Value |
|---|---|
| Button box | 208×40px |
| `border-radius` | 6px |
| `background` | transparent |
| `justify-content` | center |
| `display` | inline-flex |
| `.TUXButton-content` | 204×32, `gap: 12px` |
| `.TUXButton-iconContainer` | 32×32 |
| Icon glyph size | 19px |
| Label | 16px / 500 / lh 21px |

## Motion
| Property | Value |
|---|---|
| Article layout transition | `margin, height, width, padding` — `300ms cubic-bezier(0.25, 0, 0.25, 1)` |
| Comment sidebar transition | `flex, width` — `300ms linear` (**not** the article's easing) |
| Activity drawer transition | `transform, opacity` — `400ms ease` |

## Font substitution note
`TikTokFont` cannot be downloaded and redistributed. Recommended clone stack, chosen for
metric proximity to TikTokFont (a humanist sans close to Proxima Nova / Inter):

```css
font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, Tahoma,
             "PingFang SC", sans-serif;
```

Load `Inter` via `next/font/google` with weights 400 and 700 (the only two weights observed).

---

## Not yet captured
- Action-rail button `:hover` (cross-origin TUX stylesheet — see `BEHAVIORS.md`)
- Mobile (390px) layout values
