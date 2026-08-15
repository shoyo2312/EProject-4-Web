# TikTok.com — Behaviors

## Interaction model: scroll-driven (confirmed)

This is the single most important finding, and it was verified **before** any clicking,
exactly as the skill's Principle 6 requires.

| Property | Element | Value |
|---|---|---|
| `overflow-y` | `.DivColumnListContainer` | `scroll` |
| `scroll-snap-type` | `.DivColumnListContainer` | `y mandatory` |
| `scroll-snap-align` | `article.ArticleItemContainer` | `start center` |
| `scroll-snap-stop` | `article.ArticleItemContainer` | `always` |

`scroll-snap-stop: always` is what forces exactly one video per scroll gesture — the feed
cannot fast-scroll past items. The up/down arrow buttons on the right edge are a **secondary**
affordance that programmatically scrolls by one item height; they are not the primary
mechanism. Building this as a click-driven carousel would be wrong.

**No smooth-scroll library.** `document.querySelector('.lenis')` → `null`. Scrolling is native.

## Layout transition
`article` animates `margin, height, width, padding` over `300ms cubic-bezier(0.25, 0, 0.25, 1)`.
This fires when the viewport crosses a breakpoint and the padding formula changes.

## Video playback (scroll-driven)

Implemented in `src/hooks/use-video-playback.ts`.

| Trigger | Behaviour |
|---|---|
| Card enters the viewport (IntersectionObserver, threshold 0.6) | plays from `currentTime = 0` |
| Card leaves | pauses **and rewinds to 0** |
| Click on the media | toggles play/pause; a centred play glyph shows while paused |
| Tab hidden | pauses; returning resumes the active card |
| Mute | a **feed-wide** preference held in `Feed`, not per card |

`scroll-snap-stop: always` means exactly one card can clear the 0.6 threshold at rest,
so "the active card" is unambiguous.

Because no video files are vendored (see `ASSETS.md`), the hook runs a simulated rAF
clock over `durationSeconds` when `videoUrl` is empty and switches to real `<video>`
`timeupdate` events when it is not. Both paths expose one interface, so dropping real
media into `FEED_VIDEOS` needs no component change.

> Rewind-on-exit is the observed TikTok behaviour but was **not** verified against the
> live site rule-by-rule; it is the one playback decision that is a judgement call.

## Double-tap to like

| Gesture | Result |
|---|---|
| single tap on the media | play / pause |
| double tap | **likes** the video (never un-likes) and pops a heart at the tap point |

A double click always fires two `click` events first, so the play toggle is held
for 250ms and cancelled if a second click lands inside that window. Without it,
double-tapping would also pause and instantly resume. Verified in the clone: the
button's label stayed `Pause` across a double tap while `aria-pressed` went
`false → true`; a second double tap kept it `true` and still spawned a heart.

Like state is lifted into `Feed` because two controls drive it — the action
rail's heart button (toggles) and the double tap (likes only).

> **This animation is a RECONSTRUCTION, not an extraction.** TikTok drives the
> heart from JS, so no keyframes exist in its stylesheets to copy, and
> reproducing it on the live site would have meant liking a real video from the
> signed-in account. The only extracted value is `.HeartWrapper`:
> `display: inline-flex; transform-origin: 50% 100%; will-change: auto` — the
> heart grows from its bottom point, not its centre.

The clone's `tt-heart-pop` keyframe (globals.css) runs 1s ease-out: scale
`0.3 → 1.15 → 0.95 → 1 → 1.1` with a 40px upward drift and a fade out, plus a
random ±25° rotation per heart. The scale/drift numbers and the jitter range are
invented; only the origin is real.

## Hover states (extracted)

Read from the live site's `:hover` rules and resolved through the TUX custom properties.

| Element | Rule | Resolved |
|---|---|---|
| Sidebar nav row (`StyledTUXNavButton`) | base `background-color: unset`, `:hover var(--ui-shape-neutral-4)` | transparent → `rgba(255,255,255,.13)` |
| Search button (`StyledTUXSearchButton`) | `:hover var(--tux-v2-color-ui-shape-neutral-3)` | `rgba(255,255,255,.19)` |
| Follow button (`StyledAvatarFollowButton`) | base `var(--tux-v2-color-ui-shape-primary)`, `:hover var(--tux-colorPrimary-tint-8)` | `#fe2c55` → **`#ea284e`** |
| Volume control (`DivVolumeControlContainer`) | base transparent, `padding .5rem`, `border-radius 1.5rem`, `:hover var(--tux-v2-color-ui-shape-neutral-4)` | → `rgba(255,255,255,.13)` |
| Player (`DivVideoPlayerContainer`) | `:hover --css-overlay-gradient-opacity: 0.3` and `opacity: 1` on the scrub head / time label | top gradient fades in, scrub head + `00:20 / 01:39` appear |
| Progress bar (`DivProgressBar`) | `:hover` bounds `height: 0.375rem`, head `translateY(0.125rem)` | 4px → 6px track |
| Caption links, "See translation" | `:hover { text-decoration: underline }` | — |

**Correction to an earlier guess:** the clone previously used `#f1204a` as the red hover.
The real value is `#ea284e` (`--tux-colorPrimary-tint-8`).

**Still a reconstruction:** the action-rail button's `:hover`. Its base is confirmed
(`.tux-interaction-container`, 48×48, `rgba(255,255,255,.13)`, 21px glyph) but the hover
rule lives in a cross-origin TUX stylesheet whose `cssRules` throws. The clone uses
neutral-3 (`.19`), consistent with the other TUX surfaces, and says so in the component.

## Progress bar (extracted verbatim)

| Part | Value |
|---|---|
| container | `height: max(0.25rem, 1rem)` → 16px hit area, `clip-path: inset(0 round 0 0 1rem 1rem)` |
| bounds (track) | `height: 0.25rem` → `0.375rem` on hover, `background: --ui-image-overlay-white-a40` = `rgba(255,255,255,.4)`, `align-self: end`, `transition: height 150ms ease-in-out` |
| elapsed | `transform: scaleX(n)` with `transform-origin: left center`, `background: --ui-shape-primary` = **`#fe2c55`** (red, not white) |
| scrub head | `0.75rem` square, `border-radius: 50%`, `opacity: 0`, `bottom: 0`, `transform: translateX(-50%) translateY(0.25rem)` → `translateY(0.125rem)` on bar hover, `box-shadow: 0 0 1px 1px rgba(0,0,0,.15)`, `cursor: grab`, `transition: transform, opacity 150ms ease-in-out` |

## Media card overlays (extracted verbatim)

- Card corner radius is **1rem (16px)**, from `border-bottom-left-radius: 1rem` on
  `DivMediaCardOverlayBottom` and the matching top radius on the top overlay.
- Top overlay gradient: `linear-gradient(to top, rgba(18,18,18,0) 0%, rgba(0,0,0, var(--css-overlay-gradient-opacity, 0)) 100%)` — invisible until the player is hovered.
- Bottom overlay, collapsed caption: `linear-gradient(transparent 0%, rgba(0,0,0,0.5) 100%)`.
- Bottom overlay, expanded caption: `linear-gradient(transparent 0%, rgba(0,0,0,0.4) 30%, rgba(0,0,0,0.85) 100%)`.

## Comment sidebar (extracted verbatim)

Opened by the action-rail comment button. It is a **flex sibling** of the feed
column inside `DivMainContainer` (`display: flex; flex-direction: row`) — not an
overlay. Opening it narrows the feed by exactly the panel width.

### `.DivCommentSidebarTransitionWrapper`
```css
flex-grow: 1; overflow: hidden; z-index: 8; height: 100%;
transition-duration: 300ms; transition-timing-function: linear;

/* enter-active / exit-active */
transition-property: flex, width;
flex-basis: 24rem; width: 24rem;                       /* 384px */
@media screen and (max-width: 1280px) { … 21rem }      /* 336px */
@media screen and (max-width: 1024px) { … 18rem }      /* 288px */

/* enter-done */ overflow: visible;
/* exit-active */ width: 0; flex: 0 1 0; opacity: 0;
```

> The wrapper eases **`linear`**, while the article it displaces eases
> `cubic-bezier(0.25, 0, 0.25, 1)`. Both run 300ms. This is deliberate on the
> live site, so the clone keeps them different.

### `.SectionCommentSidebarContainer`
```css
display: flex; flex-direction: column;
min-width: 18rem; max-width: 24rem; --comment-panel-max-width: 24rem;
padding: 16px 16px 20px; z-index: 10;
position: sticky; top: 0; bottom: 0; height: 100%;
max-height: calc(0px + 100vh); inset-inline-end: 0;
background-color: var(--ui-page-flat-1);
box-shadow: rgba(255,255,255,.12) -1px 0 1px;
```

### Inner structure
| Element | Rule |
|---|---|
| `.DivCommentHeader` | `flex; justify-content: space-between; align-items: center; padding-bottom: 16px` |
| `.DivCommentHeaderTextWrapper` | `flex; align-items: center; gap: .25rem` |
| `.DivCommentMain` | `flex-grow: 1; overflow-y: scroll; overscroll-behavior: contain; scrollbar-width: none` |
| `.DivCommentObjectWrapper` | `flex; flex-direction: column; gap: 16px; margin-bottom: 24px` |
| `.DivCommentItemWrapper` | `flex; flex-direction: row; align-items: center; gap: **8px**` |
| `.DivCommentContentWrapper` | `flex; flex-direction: column; align-items: flex-start; flex: 1 1 auto; gap: **6px**; word-break: break-word` |
| `.DivCommentHeaderWrapper` | `flex; align-items: center` — username left, `.DivMore` (14×21) right |
| `.DivCommentSubContentSplitWrapper` | `flex; align-items: center; **justify-content: space-between**` |
| `.DivCommentSubContentWrapper` | `flex; align-items: center; gap: 12px` — timestamp, "Reply" |
| `.DivLikeContainer` | `flex; align-items/justify-content: center` — 20×20 glyph `rgba(255,255,255,.6)` + count |
| `.DivCommentFooter` | `flex-grow: 0` |

The row is a **two-column** layout, avatar + content — not three. An earlier
pass put the like button as a third sibling of the row; it actually lives at the
right end of the sub-content row, opposite the timestamp. Likewise the item gap
is 8px and the content gap 6px (an earlier read of the rule text said 12px; the
computed values disagree and the geometry confirms 8px: avatar ends at 1584,
content starts at 1592).

The measured 77px row height is exactly `21 + 6 + 23 + 6 + 21`.

> **Replies are deliberately not modelled.** The live site nests them; this clone
> renders a single flat level by choice, so `Comment` has no `replyCount` and
> there is no "View N replies" affordance. "Reply" remains as an action because
> it is part of the live sub-content row.

Timestamps use TikTok's two formats: relative ("3d ago") for recent, `M-D`
("6-30") for older.

### Comment typography (measured on the text-owning leaves)
| Role | size | weight | line-height | color |
|---|---|---|---|---|
| Header "Comments (N)" | 17px | 700 | 25.5px | `rgba(255,255,255,.9)` |
| Username | 13px | 500 | 16.9px | `#f6f6f6` |
| Comment body | 15px | **478** | 22.5px | `#f6f6f6` |
| Timestamp | 13px | 400 | 19.5px | `rgba(255,255,255,.4)` |
| "Reply" | 14px | 500 | 18.2px | `rgba(255,255,255,.6)` |
| Like count | 14px | 400 | 21px | `rgba(255,255,255,.6)` |
| Like glyph | 20×20 | — | — | `rgba(255,255,255,.6)` |
| `.DivMore` "⋯" | 14×21 | — | — | — |

Weight **478** is only reachable because TikTokFont is a variable font. Inter is
loaded at discrete weights, so the clone rounds it to 500 — a known, documented
deviation rather than a mistake.

### Replies — one level, collapsed by default (extracted verbatim)

TikTok nests **exactly one level**. Replying to a reply appends to the same flat list; there is
no second tier anywhere in the DOM.

`.DivReplyContainer` is a sibling of `.DivCommentItemWrapper` inside the comment's
`.DivCommentObjectWrapper` (flex column, gap 16px):

```
.DivReplyContainer              flex column, gap 16px, margin-left: 52px
├ .DivReplyScrollBasis          0px tall — scroll anchor for newly loaded replies
├ reply items                   (only after expanding)
└ .DivViewMoreRepliesWrapper    flex row, gap 8px, margin-left: -6px
  └ .DivViewRepliesContainer    flex row, gap 6px       (collapsed state only)
    ├ button "View N replies"   14px / 500 / 18px, rgba(255,255,255,.6), padding 1px 0
    └ chevron                   13×13, same colour, viewBox 0 0 48 48
```

The **52px indent is measured from the comment row's left edge**, which is 12px *past* where
the parent's own text begins (32px avatar + 8px gap = 40px) — replies deliberately do not line
up with the text above them. The `-6px` margin on the wrapper pulls the control back toward
that edge.

Expanded, the chevron is dropped and the wrapper holds plain 14px / 500 / **21px** controls:
"View N more" beside "Hide". Singular/plural is respected: *View 1 reply* / *View 2 replies*.

A reply item reuses the comment structure with exactly three differences:

| | Top-level | Reply |
|---|---|---|
| Avatar | 32×32 | **24×24** |
| Header gap (username ↔ pill) | 6px | **3px** |
| "Reply" label | 14px / 500 / 18.2px | **13px / 600 / 16.9px** |

Content gap (6px), sub-row gap (12px), the 20px like glyph, the 14×21 "⋯", and the body/
timestamp/like-count typography are identical at both levels.

**Not captured:** what clicking "Reply" does to the composer. The live control did not respond
to a synthetic click or to a positioned real click, and I stopped after two attempts rather
than keep clicking near a comment box on a signed-in account. The clone's reply mode
(placeholder → `Reply to @user...`, focus, ✕ to cancel) is a **reconstruction**.

### Composer (`.DivCommentBarContainer`, 42px tall)
| Part | Value |
|---|---|
| Avatar | 32×32, `border-radius: 50%` |
| `.DivTextInputContainer` | 42px tall, `background: rgba(255,255,255,.13)`, `border-radius: 22px`, `padding: 0 8px` |
| Emoji / mention buttons | 32×32, `border-radius: 8px`, `padding: 4px`, transparent |
| `.ArrowPostButton` | 32×32, `background: #fe2c55`, `border-radius: 999px`, `padding: 8px` |

### What opening it does to the feed
The article swaps to an emotion class whose **only** padding declaration is
`padding-inline: 1rem` — all four breakpoint branches collapse into it.

Verified live at 1920px, and reproduced exactly in the clone:

| | article width | padding | nav arrows x |
|---|---|---|---|
| closed | 1616px | `64px / 176px` | 1856 |
| open | 1232px | `16px / 16px` | 1472 |

The 384px delta is the panel width and nothing more — the feed column's
`padding-right: 64px` is **constant** across both states. Arithmetic confirms it:
`1920 − 64 − 240 = 1616` and `1536 − 64 − 240 = 1232`.

> **Correction:** an earlier pass recorded the feed column's right padding as
> 56px. It is **64px**, in both states.

The `[data-e2e="feed-navigation-prev"|"feed-navigation-next"]` buttons sit 16px
from the feed column's right edge with a 16px gap, inside the column — so they
shift with it rather than staying pinned to the viewport.

**Not captured for this panel:** the reply thread expansion ("View N replies"
renders but does not expand), comment sorting, and the emoji picker. The panel's
icon glyphs come from a cross-origin TUX sprite that could not be read; the four
in `icons.tsx` are marked as reconstructions.

## Volume control (extracted verbatim)

Collapsed it is only the 48px mute button. Hovering it grows the pill sideways and mounts a
slider beside the button — the slider does **not** exist in the DOM until then.

This is the class-swap pattern again: two emotion classes differing in exactly **two**
declarations.

| | collapsed `tiktok-8071rl` | expanded `tiktok-5xj2l3` |
|---|---|---|
| `max-width` | `3rem` | `12.5rem` |
| `background-color` | transparent | `neutral-4` = `rgba(255,255,255,.13)` |

Everything else is shared: `display: flex; align-items: center; gap: .5rem; padding: .5rem;
padding-inline-end: 1rem; padding-inline-start: 0` (that last one only at `min-width: 767px`),
`position: relative; border-radius: 24px; min-width: 3rem; height: 3rem;` and
`transition-property: max-width, max-height; transition-duration: 300ms`.

200px is fully accounted for: 0 (start) + 48 (button) + 8 (gap) + 128 (slider) + 16 (end).
Note this means the button **overflows** the collapsed 48px box by its 16px end padding —
`overflow` is `visible` and the box is transparent, so it is invisible. Reproduced as-is.

Slider internals, measured with the control expanded:

| Part | Size | Style |
|---|---|---|
| wrapper | 128 × 32 | `position: relative`, 56px from the container's start edge |
| `.VolumeSliderTrack` | 128 × 6 | `border-radius: 3px`, `rgba(255,255,255,.19)` |
| `.VolumeSliderNotch` | 3 × 10 | `border-radius: 2px`, `rgba(255,255,255,.32)`, absolute at exactly 50% |
| `.VolumeSliderKnob` | 20 × 24 | `border-radius: 8px`, `rgb(250,250,250)`, absolute, `role="slider"` |

There is **no filled/elapsed portion** — the track is one flat colour and only the knob moves,
unlike the red progress bar under the video. At volume 0 the knob sits at `-10px`, i.e. it is
centred on the value rather than contained by the track.

**Reconstructed, not extracted:** how the slider value relates to mute. The live slider was
never dragged — that would change a real account's playback preference — so "drag above 0
unmutes, drag to 0 mutes" is this clone's own choice, as is keeping the pill expanded while a
drag is in progress.

## Share sheet (extracted verbatim)

The rail's share button opens a **modal**, not a popover. Hovering does nothing; a click mounts
a `.TUXModal` overlay. Measured live at 1920×936:

```
overlay   position: fixed, inset 0, z-index 3500
          background: rgba(0,0,0,.7), flex column, centred, padding 16px
dialog    480 × 333, background: rgb(30,30,30), border-radius: 12px
.TUXModalNavBar   52px tall, padding: 0 8px
  ├ 44×44 icon button   search
  ├ h2 "Share to"       17px / 500 / 25.5px
  └ 44×44 icon button   close
body      flex column, gap 12px
  ├ friends row   128 tall, inner scroller 124, overflow-x auto
  ├ divider       1px, rgba(255,255,255,.19)
  └ targets row   128 tall, inner scroller 124, overflow-x auto
```

52 + (128 + 12 + 1 + 12 + 128) = **333**, so the dialog height is fully accounted for.

Both rows reuse one tile shape — they differ only in what fills the 64px slot:

| Part | Value |
|---|---|
| tile | 88 × 124, first tile inset 12px from the dialog edge |
| `.DivActionContainer` | `padding: 12px 12px 8px` |
| `.DivAction` | flex column, gap 6px, width 64 |
| icon / avatar | 64 × 64 (avatar `border-radius: 50%`) |
| label | 12px / 400 / 15.6px, centred, `#f6f6f6`, width 64 |

Targets, verbatim and in order (11 tiles, the row scrolls horizontally):
**Repost, Copy, WhatsApp, Embed, Facebook, Telegram, X, LinkedIn, Email, Reddit, Line.**

**Not reproduced — friends row.** On the live sheet this row is the signed-in account's real
contact list (it opened with one person's name and avatar). That is personal data belonging to
the account owner and to a third party, so the clone invents its three entries; only the row's
existence and geometry are taken from the live sheet.

**Not reproduced — brand logos.** Each live tile draws the service's own logo. Those are
third-party trademarks and are not TikTok's assets either. The clone keeps the measured disc,
spacing and label but substitutes a Lucide glyph or the service's initial on the brand colour.
Lucide v1 has dropped its brand icons anyway, so there was no logo set to substitute from.

**Not captured:** what any tile *does* when clicked. Nothing inside the sheet was activated —
every tile on a signed-in account either posts, opens a share dialog, or writes to the
clipboard. The clone's tiles are inert for the same reason.

## Activity drawer (extracted verbatim)

Opened by the sidebar's Activity button. Unlike the comment sidebar this is an
**overlay**, not a layout participant: `position: fixed`, and the 240px
`.DivSideNavPlaceholderContainer` never changes, so the feed does not move.
Verified live and reproduced in the clone — the article stayed at `x = 240`,
`width = 1616px`, `padding 64px / 176px` with the drawer both open and closed.

### `.DivDrawerContainer`
```css
--drawer-animation-duration: 400ms;
--drawer-animation-easing: ease;
--drawer-animation-delay: 0ms;
width: var(--drawer-content-width, 20rem);   /* 320px */
height: 100vh; position: fixed; top: 0;
inset-inline-start: 4.5rem;                  /* 72px — beside the collapsed nav */
background-color: var(--ui-page-flat-1);
z-index: 99;
border-inline: 1px solid rgba(255,255,255,.12);
overscroll-behavior: contain;
visibility: hidden; pointer-events: none;

.drawer-enter        { transform: translateX(-24rem); opacity: .3; z-index: -1 }
.drawer-enter-active { transform: translateX(0);      opacity: 1 }
.drawer-exit         { transform: translateX(0);      opacity: 1; z-index: -1 }
.drawer-exit-active  { transform: translateX(-24rem); opacity: .3;
                       transition: transform 400ms ease, opacity 400ms ease }
```

### The sidebar collapses with it
Found by diffing the emotion class on `.DivSideNavContainer` (`dznzmc` →
`1r9paic`), not by looking for a media query — there isn't one:

| variant | base | `@media (max-width: 1024px)` |
|---|---|---|
| expanded | `width: 15rem` | `width: 4.5rem` + `border-right: 1px solid rgba(255,255,255,.12)` |
| collapsed | `width: 4.5rem` | `width: 4.5rem` (no border) |

The collapsed variant **drops the border entirely** — the drawer pressed against
it carries its own `border-inline` instead. There is no transition on the
sidebar width, so it snaps while the drawer slides.

### Inbox contents
| Element | Rule |
|---|---|
| `.DivInboxContainer` | `height: 100%; flex column; padding: 20px 8px 0; gap: 16px` |
| `.DivInboxHeaderContainer` | `flex column; gap: 16px; flex: 0 0 auto` |
| `.H2InboxTitle` | "Notifications" — **TikTokDisplayFont** 20px/25px/600, `rgba(255,255,255,.9)` |
| `.DivGroupContainer` | `flex; flex-flow: wrap; gap: 12px 8px`; 14px/18px/600 |
| `.ButtonGroupItem` | `padding: 6px 12px; border-radius: 999px` |
| `.DivInboxContentContainer` | `flex: 1 1 auto; overflow: auto; margin-inline-end: -8px; padding-inline-end: 8px` |
| `.PTimeGroupTitle` | 14px/18px/600, `padding: 0 8px 4px` |
| `.LiInboxItemWrapper` | `margin: 0 0 16px`; `:last-child { margin-bottom: 0 }` |
| `.DivSystemNotifItemContainer` | `flex row; align-items: center; height: 72px; padding: 0 8px; cursor: pointer` |
| `.DivSystemNotifIconContainer` | 48×48, `border-radius: 24px`, `background: rgb(50,54,75)` |
| `.DivContentContainer` | `padding: 0 8px 0 0; flex: 1 1 auto; min-width: 0` |
| `.PTitleText` | 14px/600/18px, `-webkit-line-clamp: 1`, `word-break: break-all` |
| `.PSystemNotifDescText` | 13px/400/17px, `-webkit-line-clamp: 1`, `max-height: 130px` |
| `.DivSystemNotifTrailingContainer` | `padding-left: 12px; gap: 10px; flex-shrink: 0` |
| `TUXAlertBadgeDot` | 6px, `#fe2c55`, `border-radius: 999px` |
| `.DivDrawerCloseButtonContainer` | `position: absolute; top: 1.5rem; inset-inline-end: 1rem`; button 28×28, `rgba(255,255,255,.13)`, radius 999px |

Chip states:

| State | color | background |
|---|---|---|
| selected | `rgb(18,18,18)` | `rgba(255,255,255,.9)` |
| unselected | `rgba(255,255,255,.9)` | `rgba(255,255,255,.08)` |
| unselected `:hover` | — | `rgba(255,255,255,.12)` |

Filter labels, verbatim and in order: **All activity · Likes · Comments ·
Mentions and tags · Followers**. Group headings use the "Yesterday" style.

Item `:hover` background is **`rgb(37,37,37)`** — two rules declare a hover
background (`rgba(255,255,255,.04)` first, then `rgb(37,37,37)`); the later one
wins at equal specificity.

> **Tailwind gotcha:** `-translate-x-96` compiles to the **`translate`**
> property in v4, which `transition-[transform]` does not cover — the slide
> snapped instantly while opacity eased. The clone writes
> `[transform:translateX(-24rem)]` so it matches the extracted rule.

**Not captured:** the notification icons (cross-origin TUX sprite — the bell in
`ActivityDrawer.tsx` is a reconstruction), what each filter chip actually
filters, and whether the live drawer closes on `Escape` (the clone adds it as a
baseline affordance and says so inline).

## Sidebar footer (extracted verbatim)

It is a **single-open accordion that starts fully collapsed**. `.DivFooterContainer`
holds only four children at rest — three `h3.H4LinkListHeader` and one
`span.SpanCopyright`. The link lists are **not in the DOM** until their heading
is clicked; clicking an open heading removes them again.

That is why an earlier pass shipped invented links: reading the footer without
clicking shows no links at all. All three sections had to be opened in turn.

```css
.DivFooterContainer {
  position: relative; padding-top: 16px; padding-left: 8px;
}
.DivFooterContainer::before {          /* a hairline, NOT a border-top */
  content: ""; position: absolute; left: 8px; right: 8px; top: 0;
  height: 1px; background: rgba(255,255,255,.12); transform: scaleY(.5);
}
@media screen and (max-width: 1071px) { .DivFooterContainer { display: none } }
```

> **The footer has its own breakpoint: 1071px.** It is not the 1024px the
> sidebar collapse uses — do not fold the two together. Added as
> `@custom-variant tt-1071`.

| Element | Value |
|---|---|
| `.H4LinkListHeader` | 15px/700/22px, TikTokDisplayFont, `cursor: pointer`, `margin-top: 5px` (0 on the first) |
| — closed | `rgba(255,255,255,.5)` |
| — open | `rgba(255,255,255,.9)` |
| `.DivLinkContainer` | `margin-bottom: 8px`; `display: block` |
| `.StyledNavLink` | 12px/600/16px, `rgba(255,255,255,.5)`, `display: inline-block`, `margin-right: 6px`, `margin-top: 5px` |
| — `:hover` | same colour, **no underline** |
| `.SpanCopyright` | same type as the links, `inline-block`, `margin-top: 5px` |

Links are `inline-block` inside a `block` container, so they **flow inline and
wrap** rather than stacking one per line. Verified live (`x=24`, `x=120` on the
same row) and in the clone (`x=24`, `x=123` — the 3px is Inter running wider
than TikTokFont, not a layout difference).

### Link lists, verbatim
- **Company** — About · Newsroom · Contact · Careers
- **Program** — TikTok for Good · Advertise · Sell on TikTok Shop · TikTok LIVE
  Creator Networks · Developers · Transparency · TikTok Embeds · SoundOn Music
  Distribution · TikTok Live · TikTok Shop
- **Terms & Policies** — Help · Safety · Terms · Privacy Policy · Accessibility ·
  Privacy Center · Creator Academy · Community Guidelines · Copyright · Law
  Enforcement Guidelines

Hrefs were **not** captured — they carry query strings, so the clone renders the
labels as non-navigating spans.

The live markup puts the click handler on a bare `h3`. The clone keeps the tag
but adds `role="button"`, `tabIndex` and Enter/Space handling so the accordion is
operable from the keyboard.

## Responsive behaviour

Every breakpoint below was read from the **emotion rule text**, which is a strictly more
authoritative source than sampled computed values: it carries the actual `calc()`/`var()`
formulas rather than one resolved instance of them.

They have since been verified live at 1280, 1024 and 768 CSS px. (The `> 1280px` branch
cannot be rendered on this 1280px-wide display; it is the unconditional base rule.)

### Breakpoints are inclusive — Tailwind's are not

TikTok writes `@media (max-width: 1280px)`, which applies **at** 1280. Tailwind's `max-xl`
*and* its arbitrary `max-[1280px]` both compile to `not (min-width: 1280px)`, which stops
one pixel short. At exactly 1280/1024/768 the clone rendered the wrong branch.

Fixed with `@custom-variant tt-1280 / tt-1024 / tt-768` in `globals.css`, which emit the
site's own inclusive queries. Verified: 1280 → `16px / 128px`, 1024 → `48px / 16px`
(sidebar 72px), 768 → `16px / 16px`.

> When measuring padding right after a resize, disable the transition first — `article`
> animates `padding` over 300ms, so `getComputedStyle` returns an interpolated value and
> makes a correct branch look like the previous one.

### `article.ArticleItemContainer` padding
| Viewport | padding-inline-start | padding-inline-end |
|---|---|---|
| `> 1280px` | `calc(--feed-nav-button-width + 1rem)` = 64px | `calc(15rem - --feed-nav-button-width - 1rem)` = 176px |
| `<= 1280px` | `1rem` | `calc(15rem - (--feed-nav-button-width * 2) - 1rem)` = 128px |
| `<= 1024px` | `var(--feed-nav-button-width)` = 48px | `1rem` |
| `<= 768px` | `1rem` | `1rem` |

### `.DivSideNavContainer`
| Viewport | Behaviour |
|---|---|
| `> 1024px` | 240px wide, labels visible |
| `<= 1024px` | **collapses to 4.5rem (72px)**, icon-only, gains `border-right: 1px solid rgba(255,255,255,.12)` |

### `.DivSearchWrapper`
| Viewport | Behaviour |
|---|---|
| `>= 1025px` | `width: 13rem` (208px) |
| `<= 1024px` | `justify-content: center`, start padding removed — collapses to an icon |

## Not captured

The following were **not** observed and are therefore **not** implemented from evidence.
They are listed as gaps rather than guessed at:

- **Action-rail button `:hover`.** Base state confirmed; hover is a reconstruction (above).
- **Mobile 390px layout.** Never observed; only the `<= 768px` rule branch is known.
- **Comment sorting, emoji picker.** The panel and its reply threads are built (above);
  these two sub-behaviours inside it were not opened.
- **Volume-to-mute coupling.** The control and its slider are now fully measured (above);
  only what dragging the live slider *does* is unverified.
- **"More" menu.** Not opened. (The share sheet is now built — see above.)
- **Footer link hrefs.** The labels are now verbatim (above); the destination URLs were
  not captured because they carry query strings.
