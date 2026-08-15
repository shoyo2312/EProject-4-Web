# TikTok.com — Page Topology

**Target:** https://www.tiktok.com/ (For You feed, authenticated session)
**Extracted at:** viewport 1280×576 CSS px, DPR 2
**Extraction note:** The host display is 1280×720 CSS px, so the skill's default 1440px desktop
viewport was unreachable. Desktop extraction ran at **1280px** — this sits exactly on the
`max-width: 1280px` breakpoint, so the ≤1280 branch of every media query is the active one.
Values for >1280px are taken from the **CSS rule text**, not from observation. See "Breakpoints".

## Tech stack observed
- **Framework:** React SPA (`#app` root), Next-like SSR shell
- **CSS:** Emotion CSS-in-JS, "speedy" mode — rules live in `CSSStyleSheet.cssRules`, not in
  `<style>` textContent. Class names are `css-<hash>-<build>--<ComponentName>`; the *rule*
  selector is only `.css-<hash>-<build>`.
- **Design system:** TUX (TikTok's internal DS) — `StyledTUXText`, `SpanTuxIconWrapper`
- **Font:** `TikTokFont, Arial, Tahoma, PingFangSC, sans-serif`
- **Scrolling:** native scroll-snap. **No Lenis / Locomotive** (`document.querySelector('.lenis')` → null)

### How to re-extract rule text (this site needs it)
Computed styles alone lose the `calc()`/`var()` formulas that drive this layout. Use:

```js
window.__rules = (sel) => {
  const el = typeof sel === 'string' ? document.querySelector(sel) : sel;
  const hashes = [...el.classList].map(c => (c.match(/^css-([a-z0-9]+)-/)||[])[1]).filter(Boolean);
  const hits = [];
  for (const ss of document.styleSheets) {
    let rules; try { rules = ss.cssRules } catch(e) { continue }
    const scan = (rs, ctx) => { for (const r of rs) {
      if (r.cssRules && !r.selectorText) { scan(r.cssRules, r.conditionText || r.media?.mediaText || ctx); continue }
      if (r.selectorText && hashes.some(h => r.selectorText.includes(h)))
        hits.push((ctx ? '@' + ctx + ' | ' : '') + r.cssText);
    }};
    scan(rules, '');
  }
  return hits;
};
```

## Global CSS custom properties
| Variable | Value | Scope |
|---|---|---|
| `--side-nav-width` | `15rem` (240px) | document-wide |
| `--feed-nav-button-width` | `3rem` (48px) | `.DivColumnListContainer` and descendants |
| `--one-column-top-content-height` | `0px` | `.DivColumnListContainer` |
| `--one-column-item-bottom-content-height` | `0px` | `.DivColumnListContainer` |
| `--css-overlay-gradient-opacity` | `0` | media card overlay (animates) |

## Breakpoints
`1280px`, `1024px`, `768px` (all `max-width`).

## Layout tree (desktop, 1280px)

```
body                     bg #000, color rgba(255,255,255,.9)
└ #app                                    flex column, 1280×100vh
  └ .BaseBodyContainer                    flex row, justify-content: space-between, bg #000
    ├ .DivSideNavPlaceholderContainer     240×100vh, z-index 99   (reserves space)
    │ └ .DivSideNavContainer              position: fixed, 240×100vh
    │   ├ .DivAnimationCover              absolute, 200×100vh
    │   ├ .DivFixedContentContainer       x16 y0, 208×104
    │   │ ├ .DivLogoWrapper               208×48, relative, z-index 100
    │   │ └ .DivSearchWrapper             208×40, y64
    │   ├ .DivScrollingContentContainer   208, y104, overflow-y: scroll
    │   │ ├ .DivMainNavContainer          208×436
    │   │ └ .SubMainNavFooterContainer    208×115
    │   └ .DivDrawerContainer             position: fixed, 320×100vh, z-index 99   (Activity drawer)
    │     ├ .DivActivityContainer         318×259
    │     └ .DivDrawerCloseButtonContainer  absolute, 28×28
    └ main.DivMainContainer               x240, 1040×100vh, flex row, justify-content: center
      └ .DivColumnListContainer           1040×100vh, overflow-y: scroll,
                                          scroll-snap-type: y mandatory, padding-right 56px
        └ article.ArticleItemContainer    (one per video — the snap item)
```

### `article.ArticleItemContainer` — source rule (verbatim)
```css
min-height: calc(100vh - 0px
  - var(--one-column-top-content-height, 0px)
  - var(--one-column-item-bottom-content-height, 0px));
position: relative;
display: flex; flex-direction: row;
justify-content: center; align-items: center;
gap: 1rem;
padding: 1rem;
padding-inline-start: calc(var(--feed-nav-button-width) + 1rem);      /* 64px */
padding-inline-end:   calc(15rem - var(--feed-nav-button-width) - 1rem); /* 176px */
padding-block: 1rem;
margin: 0 auto;
transition-property: margin, height, width, padding;
transition-duration: 300ms;
transition-timing-function: cubic-bezier(0.25, 0, 0.25, 1);
overflow: hidden clip;
scroll-snap-stop: always;
scroll-snap-align: start center;
```
```css
@media (max-width: 1280px) {
  padding-inline-start: 1rem;
  padding-inline-end: calc(15rem - (var(--feed-nav-button-width) * 2) - 1rem); /* 128px */
}
@media (max-width: 1024px) {
  padding-inline-start: var(--feed-nav-button-width);
  padding-inline-end: 1rem;
}
@media (max-width: 768px) { padding-inline: 1rem; }
```
Observed at 1280px: `padding: 16px 128px 16px 16px` ✓ (confirms the ≤1280 branch)

## Article internals

```
article.ArticleItemContainer              984×651, flex row, justify center, align center, gap 16
└ .DivContentFlexLayout                   840×619, flex row, align-items: flex-end, gap 16
  ├ section.SectionMediaCardContainer     348×619  aspect-ratio 9/16, min-height 618.667px
  │ ├ canvas.CanvasMediaCardPlaceholder   346×619   (blurhash/poster placeholder)
  │ ├ .BasePlayerContainer                absolute, 348×619
  │ │ └ .DivContainer > .Box > .DivBasicPlayerWrapper
  │ ├ .DivMediaCardOverlay                absolute, 348×619
  │ │ ├ .DivMediaCardOverlayTop           348×56
  │ │ │ ├ .DivVolumeControlContainer      48×48 collapsed, 200×48 on hover
  │ │ │ └ .DivMediaCardOverlayTopActions  48×48
  │ │ └ .DivMediaCardOverlayBottomSection 348×108   (author, caption, "See translation")
  │ └ .DivVideoProgressContainer          absolute, 348×16
  │   ├ p.StyledTUXText                   "00:02 / 01:39"
  │   └ .DivProgressBar                   348×16
  │     ├ .DivProgressBarScrubHead        12×12, absolute, z1
  │     └ .DivProgressBarContainer        348×16, absolute
  └ section.SectionActionBarContainer     48×432   (right action rail)
    ├ .DivAvatarActionItemContainer       48×48  + follow button 24×24 absolute
    ├ .ButtonActionItemV1  like           48×78   icon 48×48 + StrongText "355.8K"
    ├ .ButtonActionItemV1  comment        48×78   "6834"
    ├ .ButtonActionItemV1  bookmark       48×78   "20.1K"
    ├ .ButtonActionItemV1  share          48×78   "38.4K"
    └ music disc                          48×48
```

## Media card sizing — **two branches, portrait and landscape**

TikTok does **not** normalise uploads to 9:16. `SectionMediaCardContainer` takes its
`aspect-ratio` straight from the media's intrinsic size, and `width > height` selects a second
sizing branch. Both emotion classes were read from the stylesheet with a feed holding one of
each; the ratios are literally `videoWidth / videoHeight` (1080×1920 → `0.5625 / 1`,
1278×720 → `1.775 / 1` — note **1.775, not 16/9 = 1.7778**, so there is no rounding to a
canonical ratio).

Write `A` for the height budget, which both branches repeat verbatim:

```
A = calc(100vh
         - var(--one-column-top-content-height, 0px)
         - var(--one-column-item-bottom-content-height, 0px)
         - (1rem * 2))
```

Shared by both: `aspect-ratio: R / 1`, `min-width: calc(500px - 9.5rem)` (= 348px),
`min-height: calc((500/R)px - (9.5/R)rem)` (= 348 / R), `align-self: center`, `flex-grow: 1`,
`transform-origin: right bottom`, `container: media-card / size`,
`transition: transform 600ms cubic-bezier(0.25,0,0.25,1) 200ms`.

| | Portrait (R < 1) | Landscape (R > 1) |
|---|---|---|
| `max-width` | `calc(A * R)` | `min(calc(A * R), 60vw)` |
| `max-height` | `A` | `min(A, calc(60vw / R))` |
| main-axis size | `height: A` | `width: 100%` |
| `object-fit` on `<video>` | `cover` | `contain` |
| row `align-items` | `end` | `center` |
| ≤1280px | — | **60vw cap dropped**, reverts to the portrait formulas with R |

The `60vw` cap is the only structural difference, and on a wide screen it is what binds:
measured at 1920×936 (so A = 904px), the landscape card resolved to **1152×649**
(60vw = 1152 beats A·R = 1604), while the portrait card resolved to **509×904** (height-bound).

There is **no letterbox fill**: the card background is transparent and `border-radius: 0` at
this level, so `contain` vs `cover` is visually inert — the card already carries the media's
exact ratio. The two values are mirrored in the clone for fidelity, not for effect.

Row placement (`.DivContentFlexLayout`, 1376px = full article content width,
`justify-content: center`, gap 16px) at 1920×936:

| | card x | card w×h | rail x | rail y offset in row |
|---|---|---|---|---|
| Landscape | 384 | 1152×649 | 1552 | 108 (centred) |
| Portrait | 706 | 509×904 | 1230 | 524 (bottom) |

Portrait also carries a `-webkit-fill-available` feature-detect: Chrome matches
`@media (width: -webkit-fill-available)` and gets `width: -webkit-fill-available`, other engines
fall through to `height: A`. The clone uses `height: A` for both, which resolves identically
because `max-width: calc(A * R)` binds first.

**Superseded note:** an earlier pass here recorded `max-height: 544px; max-width: 306px` as
fixed pixel values and called `min-height` an override quirk. Those were the *computed* values
at one viewport, not the authored rule — the authored rule is the `A`-based calc above.

## Fixed / overlay layers (z-index)
| Layer | z-index | Position |
|---|---|---|
| `.DivLogoWrapper` | 100 | relative |
| `.DivSideNavPlaceholderContainer` | 99 | static (reserves 240px) |
| `.DivSideNavContainer` | — | fixed |
| `.DivDrawerContainer` (Activity) | 99 | fixed, 320px wide |
| Top-right header actions (Get Coins / Get App / avatar) | — | fixed, top-right |
| Feed nav arrows (up/down) | — | fixed, right edge, 48px wide |

## Interaction model — **scroll-driven, not click-driven**
The feed is native CSS scroll-snap:
- `.DivColumnListContainer`: `overflow-y: scroll; scroll-snap-type: y mandatory`
- `article`: `scroll-snap-align: start center; scroll-snap-stop: always`

`scroll-snap-stop: always` means one video per scroll gesture — the feed cannot skip items.
The up/down arrow buttons are a *secondary* affordance that programmatically scrolls; they are
not the primary mechanism. **Do not build this as a click-driven carousel.**

## Section inventory (build order)
1. `SideNav` — logo, search, main nav (For You / Explore / Following / Friends / LIVE /
   Messages / Activity / Upload / Profile / More), footer links
2. `TopBar` — Get Coins, Get App, avatar (fixed, top-right)
3. `VideoCard` — player, overlay (volume, caption, author), progress bar
4. `ActionRail` — avatar+follow, like, comment, bookmark, share, music disc
5. `FeedNavArrows` — fixed up/down buttons
6. `ActivityDrawer` — 320px slide-out panel
7. `CommentPanel` — sidebar, comment list with one level of replies, composer
8. `ShareSheet` — 480×333 centred modal, z-index 3500
9. `Feed` — scroll-snap container assembling VideoCard + ActionRail per item

---

## `/@handle` — the profile page

Measured separately and written up in full in `PROFILE.md`, because one account cannot show
both of its states: the owner header (Edit profile / Promote post) came from an empty account,
the visitor header (Follow / Message) and the video grid from a populated public one.

Its breakpoint ladder is **1200 / 1024 / 840 / 600**, not the feed's 1280/1024/768, and the
grid steps 6 → 4 → 3 → 2 columns across it. In the clone the route is
`src/app/(shell)/[username]/page.tsx` — a dynamic segment rather than an `@user` folder,
which the App Router would read as a parallel-route slot.

---

## `/following` — the suggestion grid

Measured live at 1440 / 1280 / 1024 / 820 / 700px, signed in.

The route has **two faces**. A viewer who already follows creators gets a vertical video feed
laid out exactly like For You. A viewer who follows nobody gets this grid instead — and that is
the state the live site was measured in, so it is the state the clone reproduces. There is no
page heading, no tab bar and no scrim anywhere: the grid starts 20px below the top of the
content column and the card text sits directly on the cover frame.

```
main#main-content-homepage_follow          flex row, starts after the 240px sidebar
└ .DivUserListWrapper                      width 736px, margin-inline auto, padding 20px 0 0
  └ .DivUserCard × 20                      226 × 302, radius 8, overflow hidden,
    │                                      margin 0 18px 18px 0  → 18px gutters both axes
    └ a.AUserCard  → /@<handle>            fills the card
      └ .DivContainer                      background #252525
        ├ .Box > picture > img             cover frame, absolute inset 0, object-fit cover
        ├ .DivBasicPlayerWrapper > video   absolute inset 0; src is a blob attached on hover
        └ .DivInfoContainer                absolute, top 102px, height 200px,
                                           padding 30px 12px 20px, flex column,
                                           align center, justify flex-end, text-align center
          ├ .SpanAvatarContainer > img     48 × 48, radius 50%, bg rgba(136,136,136,.5),
          │                                margin-bottom 14px
          ├ h3.H3Username                  18px / 700 / 24px, #fff, ellipsised
          ├ h4.H4UniqueIdContainer         flex, centred, 4px gap
          │ ├ span.SpanUniqueId            14px / 600 / 18px, #fff
          │ └ .DivVerifiedBadgeContainer   12 × 12 svg, #20D5EC disc + white tick
          └ .DivButtonContainer            width 164px, margin-top 8px
            └ button                       164 × 37, radius 4, 18px / 600 / 25px, #fff
```

The 200px info box resolves exactly: `30 + 48 + 14 + 24 + 18 + 8 + 37 + 20 = 199`, and the
card's own height falls out as `102 + 200 = 302`.

### Responsive
The wrapper is a fixed 736px capped at the column width; the cards are a fixed 226px, so the
column count falls out of the wrap rather than out of a media query.

| content column | wrapper | cards per row |
| --- | --- | --- |
| ≥ 736px | 736px, centred | 3 |
| ~620px | full width, flush left | 2 |
| ~400px | full width, flush left | 1 |

### Behaviour
- **Hover** — the card's `<video>` gets a blob source and plays **muted, once, without
  looping**, over the cover frame. No transform, no shadow, no scale on the card itself.
- **Follow button** — base `#FF3B5C` (`--tt-red-active`), `:hover` `#FE2C55` (`--tt-red`).
  Note this is the *inverse* of the feed's follow button, which goes `#FE2C55 → #EA284E`.
- **Infinite scroll** — reaching the bottom appends another 20 cards (20 → 40 observed). The
  clone renders a single page of 20.
- `.DivFixedBottomContainer` (fixed, right 24px, z-index 7) is present but empty on this route.

### What the clone does *not* copy
The live grid is 20 real accounts. Their names, handles, avatars and cover frames are real
people's data read from an authenticated session, so — as with `FEED_COMMENTS` — only the shape
is reproduced (`SUGGESTED_CREATORS` in `lib/mock-feed.ts`); the identities are invented from the
same three fictional creators the rest of the mock data uses. For the same reason there is no
`desktop-1280-following.jpg` reference shot in `docs/design-references/`, only the clone's.

---

## Signed-out ("guest") state

Measured live at 1440px in an incognito window, on `/foryou`, `/explore` and
`/following`. The three pages' **content is identical to the signed-in state** —
same feed, same Explore grid, same suggestion grid. Everything that differs is
chrome plus a gate in front of the actions that need an account.

### SideNav
Three rows are absent: **Friends, Messages, Activity**. The guest nav is seven
rows — For You / Explore / Following / LIVE / Upload / Profile / More — on the
same 44px pitch, and `Following` still lights up red on its own route.

Below the last row sits `.SubMainNavContentContainer > .DivPrimaryButtonContainer`:

| | |
| --- | --- |
| button | 200 × 40 at x = 20, i.e. inset 4px inside the 208px nav column |
| colour | `#FE2C55`, `border-radius: 6px`, white 16px/500/21px |
| spacing | 16px above, `margin-bottom: 24px` — this is what pushes the footer to y = 500 |

### TopBar
`[Get Coins][Get App][1 × 20 divider, margin 0 8px][Log in]` — the avatar slot
becomes a capsule: **76 × 32**, `#FE2C55`, `border-radius: 999px`, 15px/500/19px,
`padding: 1px 8px`. Everything before the divider is unchanged.

### Login modal — `.DivModalContainer` → `.DivContentContainer`

| part | measurement |
| --- | --- |
| mask | `.DivModalMask`, fixed, `rgba(0, 0, 0, .68)` |
| container | fixed, **z-index 3001**, centres the card |
| card | **428 × 562**, `#1E1E1E`, `border-radius: 24px` |
| close | 32 × 32 disc, `rgba(255, 255, 255, .04)`, absolute top/right 24 |
| title | "Log in to TikTok", 33px/700, line-height 49.5, `margin: 56px 0 16px`, centred |
| option list | 380 wide, `padding: 8px 32px 0 40px`, `overflow-y: auto`, 296 tall |
| option | 300 × 48 pill, `rgba(255, 255, 255, .13)`, radius 24, 16px/600, `padding: 0 14px 0 10px`, 20px icon, 8px between rows |
| legal | 300 wide, 10px/400/13px, `rgba(255, 255, 255, .5)`, centred, 39px below the list |
| footer | absolute, 428 × 64, `border-top: .5px solid rgba(255, 255, 255, .12)`, 15px/400, "Sign up" in `#FF3B5C` |

Options, verbatim and in order: Use QR code · Use phone or email · Continue with
Facebook · Continue with Google · Continue with LINE · Continue with KakaoTalk ·
Continue with Apple. The list is taller than its box, so the sixth row is clipped
— that clip is how the scroll is signalled.

The modal is **not** the same design as `/login`, which is a full page with
345 × 46 rows at radius 8. Both are written up where they belong; the page is in
`docs/research/tiktok.com/AUTH.md`.

### What is gated, and what is not
- **Opens the modal** (verified by clicking): the action rail's **like**, and
  **Follow** on a `/following` creator card. The URL does not change.
- **Not gated**: the **comment panel opens and every comment is readable**. Only
  the composer is replaced, by `.StyledLoginButton` inside `.DivCommentFooter`:
  **352 × 40** (full width of the comment column), `#FE2C55`,
  `border-radius: 999px`, centred, 4px between a 20px glyph and a 16px/600
  "Log in to comment"; the footer keeps its 64px and the bar sits 16px below the
  list.
- **Not established**: whether Share, Profile and Upload gate. Repeated clicks on
  the live share control produced no sheet and no modal, so nothing is claimed —
  in the clone, Share keeps its sheet and the nav rows stay plain links.

### How the clone models it
`CURRENT_SESSION` in `lib/mock-feed.ts` is the default (signed in); `?guest=1` on
any URL forces the signed-out state for a look. `SessionProvider` owns the modal
and exposes `requireSignIn()`, which every gated action calls before acting.

The four third-party option rows keep their verbatim labels and layout but render
a plain 20px disc in the brand colour rather than the provider's logo — other
companies' trademarks are not vendored into this repo.
