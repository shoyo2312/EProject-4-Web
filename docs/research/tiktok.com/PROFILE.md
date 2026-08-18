# TikTok.com — User profile page (`/@handle`)

Measured live on **2026-08-11** against two accounts, because one page cannot show both states:

| Account | What it gave |
|---|---|
| `@mh91938` (the session's own account, 0 posts) | owner header (Edit profile / Promote post), empty state |
| `@tiktok` (public, many posts) | visitor header (Follow / Message), video grid, playlists row, bio link, verified badge |

Viewport at measurement: **1920×992, DPR 1**. Screenshots returned by the extension are
scaled to 1518px wide — multiply screenshot coordinates by **1.265** to compare them with the
`getBoundingClientRect()` numbers below.

## Page shell

`.DivShareLayoutBase--StyledShareLayoutV2` — the content column beside the sidebar.

```css
display: flex; flex-direction: column; flex: 1 1 auto;
min-height: calc(1px + 100vh);
margin-inline: auto; box-sizing: content-box;
max-width: 1296px;                 /* content box, padding sits outside it */
padding-block: 1.5rem; padding-inline: 2rem;

@media (max-width: 1200px) { padding-inline: 1.25rem; }
@media (max-width: 1024px) { padding-block: 1.25rem; padding-inline: 1.25rem; }
@media (max-width:  840px) { padding-block: 0.75rem; padding-inline: 0.75rem; }
```

Note the breakpoints here are **1200 / 1024 / 840 / 600**, not the feed's 1280/1024/768.

## Header

`.DivShareLayoutHeader--StyledDivShareLayoutHeaderV2--CreatorPageHeader`
`display: flex; align-items: flex-start; gap: 28px; margin-bottom: 20px;` — height 172–178px.

| Part | Measurement |
|---|---|
| Avatar wrapper | 172×172, `border-radius: 50%`, placeholder fill `rgba(136,136,136,.5)` |
| Column gap avatar → text | 28px |
| `h1[data-e2e="user-title"]` | 24px / lh 30 / **700**, `rgba(255,255,255,.9)` |
| Divider `\|` then `h2[data-e2e="user-subtitle"]` | 16px / lh 21 / 400, `rgba(255,255,255,.6)`, `max-width: 450px` |
| Verified badge | 16px disc, `#20D5EC`, follows the handle |
| Stats row `h3` | starts 11px under the title row |
| Bio `[data-e2e="user-bio"]` | 16px / lh 21 / 400, `rgba(255,255,255,.9)`, `max-width: 600px` |
| Bio link `[data-e2e="user-link"]` | 16px / lh 18 / **600**, `#FF3B5C`, 16×16 link glyph, `max-width: 256px` |

### Stats row

`h3` is a flex row of `.DivNumber` items:

```
<div margin-right: 20px>        ← every item except the last
  <strong>  16px / 700 / #F6F6F6
  <span>    16px / 400 / #F6F6F6, margin-left: 6px
```

So the number and its label differ **only in weight**, and the groups are 20px apart —
not the 24–32px it looks like at a glance.

### Buttons row

Sits 35px under the stats row, `gap: 12px`, every control **44px** tall.

| Control | Owner view | Visitor view |
|---|---|---|
| Primary | "Edit profile" 115×44, `bg rgba(255,255,255,.13)`, `#F6F6F6` | "Follow" 108×44, `bg #FE2C55`, `#FFF` |
| Secondary | "Promote post" 136×44, same neutral fill | "Message" 100×44, same neutral fill |
| Icon buttons | settings + share, 44×44 | add-friend + share + more, 44×44 |

All pills: `border-radius: 9999px`, horizontal padding 16px.
Label: **16px / 600 / lh 20.8** (the TUX button wrapper reports 14px — read `.tux-web-canary
Headline-*`, the leaf that owns the text, or you will get this wrong).

## Tab bar

`.DivFeedTabWrapper` (46px tall, `position: relative`) wraps `.DivVideoFeedTab` (44px).

| Part | Measurement |
|---|---|
| Tab `p` | height 44, `padding-inline: 32px`, icon 20×20 + `gap: 4px` + label |
| Label | 18px / lh 24 / **600** |
| Active colour | `rgba(255,255,255,.9)` |
| Inactive colour | `rgba(255,255,255,.5)` |
| Underline `.DivBottomLine` | `position: absolute`, height **2px**, width = active tab's width, `bg rgba(255,255,255,.9)`, `transition: transform .3s` — it *slides*, it is not re-rendered per tab |

Tabs, in order: **Videos · Reposts · Favorites · Liked** (a hidden `Short dramas` tab exists in
the DOM and stays 0×0 unless the account has that content). No `::after` involved — the
underline is a real element.

### Sort control

`.TUXSegmentedControl`, right-aligned on the tab row:
`height 36, bg rgba(255,255,255,.13), border-radius 6px, padding 2px`.
Buttons 58×32, `border-radius: 4px`, `padding: 6px 10px`; the selected one gets `bg #3A3A3A`.
Options: **Latest · Popular · Oldest**.

## Video grid

`.DivVideoFeedV2`:

```css
display: grid; width: 100%; gap: 24px 16px;      /* row 24, column 16 */
grid-template-columns: repeat(6, minmax(0, 1fr));
@media (max-width: 1200px) { repeat(4, ...) }
@media (max-width:  840px) { repeat(3, ...) }
@media (max-width:  600px) { repeat(2, ...); gap: 0.75rem }
```

Card (`.DivItemContainerV2` → `.StyledDivContainerV2`):

| Property | Value |
|---|---|
| Aspect | height / width = **1.3265** on every card (a `padding-top: 132.65%` box, not `aspect-ratio`) — 202.7×268.8 at 1920 |
| Radius | 8px on the inner container, `overflow: hidden` |
| `::after` | bottom gradient, 28px tall, `transparent → rgba(0,0,0,.3)` |
| `::before` | 28–36px transparent strip at the top, `z-index: 1` — a hit area, no paint |
| View count | absolute bottom-left, container `padding: 20px 12px 8px`, play glyph 14×14 + 4px gap, count **14px / 600 / #FFF** |
| Hover | a `<video>` is inserted into the card and plays muted — same behaviour the Explore grid already implements |

There is **no caption under the card** in this version of the grid; the Explore tile keeps its
caption, the profile tile does not.

## Empty state (own profile, no posts)

Centred in the content column:

| Part | Measurement |
|---|---|
| Icon disc `.DivErrorIconWrapper` | 92×92, `border-radius: 50%`, `bg #2D2D2D` |
| Glyph | 44×44, `#F6F6F6` |
| Title | 24px / lh 30 / **700**, `rgba(255,255,255,.9)`, `margin-top: 24px` — "Upload your first video" |
| Description | 16px / lh 21 / 400, `rgba(255,255,255,.75)`, `margin-top: 8px` — "Your videos will appear here" |

## Playlists row (only when the account has playlists)

Heading "Playlists" 16px / lh 20 / 600. Row of cards, each ~340×72 wide with a 56×56 cover,
title 16/600 and "<n> posts" 14px muted underneath, with a chevron button at the right edge
that scrolls the row. Not cloned — no mock account has playlists.

## Edit profile modal

Opened by `[data-e2e="edit-profile-entrance"]`, the first pill in the owner header. Measured
on **2026-08-11** against `@mihhuq1223` (the signed-in account). The browser sat at **80%
zoom**, so every number below is from `getComputedStyle` — the rects are 0.8× these.

```
.DivModalMask            fixed, rgba(0, 0, 0, .68)
.ModalContentSection     radius 8, background #121212,
                         box-shadow 0 2px 12px rgba(0, 0, 0, .12)
.DivModalContainer       700 × 700
```

| Part | Measurement |
|---|---|
| `.DivHeaderContainer` | flex, space-between, `padding: 24px 24px 12px`, `border-bottom: 1px solid rgba(255,255,255,.2)` → 73 tall |
| `.H1Header` | "Edit profile", 24px / lh 36 / **600** |
| `.DivCloseContainer` | 24×24 ✕ glyph, `margin-right: 12px` (so 36 in from the card edge) |
| `.DivContentContainer` | `padding: 8px 24px 0` |
| `.StyledItemContainerWithLine` | flex, `padding: 16px 0`, `border-bottom: .5px solid rgba(255,255,255,.5)`; the last row (`.DivItemContainer`) has no line |
| `.DivLabel` | 120 wide, `margin-right: 24px`, 16px / lh 24 / **600** |
| `.DivEditAreaContainer` | 360 wide |
| `.InputText` | 360 × 38, radius 4, `rgba(255,255,255,.12)`, `padding: 7px 12px`, 16px / lh 24, `caret-color: #FE2C55`, `:focus` → background `rgba(255,255,255,.08)` + `outline: 1.5px solid rgba(22,24,35,.2)` |
| `.StyledInputTextArea` | 360 × 100, radius 4, same fill, `padding: 12px`, `resize: none` |
| `.PProfileSite` | `www.tiktok.com/@<handle>`, 12px / lh 18 / `rgba(255,255,255,.75)`, `margin-top: 16px` |
| `.StyledTip` | 12px / lh 18 / `rgba(255,255,255,.75)`, `margin-top: 8px` |
| `.DivTextCount` | `n/80`, same type, 6px under the textarea |
| `.DivFooterContainer` | **absolute**, 86 tall, `padding-inline: 24px`, `justify-content: flex-end` |
| `.StyledBtn` | 96 × 36, radius 4, 14px / lh 24 / **600**, `margin-left: 16px` |

Row heights, which is the quickest way to check a rebuild: **129 / 167.5 / 97.5 / 156**.

The content column is 557 tall and the footer starts at 614, so the footer floats over the
last row's 16px of bottom padding — that overlap is why four rows fit a 700px card without
scrolling. Reproduce it by *not* padding the scroll area for the footer.

### Behaviour

- **Save starts disabled** — `rgba(255,255,255,.08)` on `rgba(255,255,255,.34)` — and turns
  `#FF3B5C` on white the moment any field differs from the saved profile.
- **Clicking the mask does not close the modal.** Verified twice; only ✕ and Cancel do. The
  login modal's mask *does* close, so this is specific to the form.
- The three fields are Username, Name and Bio. Only the bio is length-capped (80).
- The avatar's pencil badge is a 32px disc, `#2E2E2E` with a `1px solid #D0D0D3` ring, sitting
  at the avatar's bottom-right corner (96px avatar offset 128 into the field column; badge at
  x 192, y 64). It opens a file picker and then a crop modal.

### Deviations in our build

- No crop step: the picked file is previewed straight from an `URL.createObjectURL()`.
- The username rule the tip describes is actually **enforced**, with the error replacing the
  tip in `#FF3B5C`. The live modal validates server-side on Save.
- Saving does not change the URL. `getProfile` reads the unedited mock data, so navigating to
  the new handle would discard the edit; the edited profile lives in page state instead, and
  is also pushed into the session so the sidebar and top bar repaint.

## Settings

The cog in the owner header is a **link to `/setting`**, not a menu. That page is written up
separately in `docs/research/tiktok.com/SETTINGS.md`.

## Gotchas hit while measuring

- `https://www.tiktok.com/@handle` serves a **"Please wait…" bot interstitial on the first
  hit**. Navigating to the same URL a second time renders the real page. Budget two
  navigations plus a ~6s wait for every profile you measure. If it still will not clear, the
  reason is that the tab is **hidden** — bring the Chrome window and tab to the front
  (`osascript … set active tab index`) and the challenge resolves on the next attempt. That
  also removes the rate limit noted below.
- The Edit profile modal only exists for the account that is actually signed in — read
  `[data-e2e="nav-profile"]`'s `href` to find which handle that is rather than assuming.
- `resize_window` did not change this window's viewport (it stayed 1920 wide, and
  `document.visibilityState` stayed `hidden`). The rects are still correct — verified by
  checking element x-positions against the screenshot at the 1518/1920 scale. Confirm the
  same way before trusting numbers from a hidden tab, rather than assuming a breakpoint.
- Dumping `cssText` in bulk can trip the extension's `[BLOCKED: Cookie/query string data]`
  filter (the sheets contain URLs with query strings). Filter to one selector per call.
