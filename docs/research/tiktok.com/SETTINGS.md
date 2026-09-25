# TikTok.com — `/setting` (Privacy and Settings)

Measured live on **2026-08-11** at **1920×992, DPR 1, 100% zoom** (so the rects below are CSS
pixels; screenshots come back at 1518px wide, a 0.79 scale). Signed in as the account the
browser already had — the page has no signed-out state at all.

Reached from the cog in the owner's profile header, which is a link to `/setting`, not a menu.

## Shell

The live page **replaces the sidebar with a header of its own** — a 60px bar holding the logo,
the search box, Upload, the two inbox glyphs and the avatar. Everything else on the site keeps
the 240px sidebar.

```
.DivSettingContainer      full width, viewport height − 60 (932 measured)
  .DivSettingBack         absolute, 40×40 disc, top 32, 21px left of the card
  .DivLayoutContainer     1100 wide, margin-inline auto, padding-top 16, flex row
    .DivLayoutNav         356 wide
    .DivContentContainer  728 wide, 16px gap
```

Both panes are `#252525` with `border-radius: 8px 8px 0 0` and run to the bottom of the
viewport. **The right pane is the scroller** (`overflow: auto`, 916 tall against a 2957
scrollHeight) — the window itself never scrolls, and the nav therefore never moves.

## Nav

| Part | Measurement |
|---|---|
| Rail | `padding: 16px 0` |
| Item | 356 × **52**, `padding: 14px 24px` |
| Glyph | 24×24, 12px before the label |
| Label | 18px / lh 27 / **600** |
| Active | `#FE2C55` on both glyph and label — no pill, no bar, no background |

Eight sections, in this order: Manage account · Privacy · Push notifications · Business
verification · Ads · Screen time · Content preferences · Accessibility.

Clicking scrolls the panel to that section; scrolling the panel moves the highlight. Neither
is a link and the URL never changes.

## Panel

`padding: 16px 24px 24px`. Sections are 680 wide with `margin-top: 32px` and
`padding-bottom: 16px`.

| Part | Measurement |
|---|---|
| Section title `.DivSettingTitle` | 24px / lh 32 / **700**, `margin: 0 8px 20px`, and 8px of container padding above it — 28px of air below the previous section |
| Group heading `.DivSettingSubTitle` | 18px / lh 24 / **600**, `rgba(255,255,255,.9)`, indented 16, `margin-bottom: 12px` |
| Group heading *(Ads section only)* | 18px / lh 24 / **500**, `rgba(255,255,255,.6)`, flush with the panel edge |
| Group description | 12px / lh 15 / 400, `rgba(255,255,255,.6)` |
| Row title | 16px / lh 21–22 / 400, `rgba(255,255,255,.9)` |
| Row description | 12px / lh 15.6 / 400, `rgba(255,255,255,.6)`, max 583 wide |
| Row value (right side) | 16px / lh 20.8 / 400, `rgba(255,255,255,.6)` |
| Row separator | `1px solid rgba(255,255,255,.12)` |
| Chevron `.DivArrowIcon` | 16×16 |
| Switch `.DivSwitchWrapper` | 44 × 24 track, `border-radius: 100px`; **off** `rgba(255,255,255,.12)`, **on** `#0BE09B`; knob 20×20 white with `0 1px 2px rgba(0,0,0,.15)`, inset 2, `translateX(20)` when on |

Five row shapes: plain link (chevron), link with a current value ("Comments … Everyone ›"),
switch, expand-in-place (caret), and external link (red out-arrow, only "Digital well-being
tips"). Only the switch is its own hit area; the other kinds make the whole row clickable.

The switch is **green, not brand red** — `/setting` is the only place on the site that uses it.

### Two design generations on one page

Privacy's Discoverability/Interactions rows come from the newer TUX kit: a 48 × 28 switch on
`rgba(255,255,255,.19)`, and row titles at 16/600 `#F6F6F6`. Everything else uses the 44 × 24
switch and 16/400 `rgba(255,255,255,.9)` titles. The Ads section is a third variant again,
with the muted, unindented headings noted above.

## Deviations in our build

- **The sidebar stays.** `/setting` lives in the `(shell)` route group, so it keeps the app's
  sidebar and top bar instead of the live page's bespoke header. Rebuilding that header would
  mean a second global chrome for one route, and the settings card itself — the part this page
  is actually about — is reproduced at full fidelity beside it.
- **The Ads section is dropped, not reproduced.** Seven rows and a nav entry, gone from
  `SETTINGS_SECTIONS` entirely rather than rendered inert — there is no ads subsystem anywhere in
  the backend, so every one of them would be permanently dead. The live section's measurements stay
  documented above as research; only our build omits it. Two things went with it: the
  `SettingsGroup.muted` flag, which existed solely for the Ads headings' 500-weight unindented
  style and had no other source of truth, and `AdsIcon` — both recoverable from git history if
  advertising is ever built.
- **One row-title style**, 16/400 `rgba(255,255,255,.9)`, rather than carrying the TUX
  generation's 16/600, which the live page uses for three of its rows.
- **One switch size**, the 44 × 24 majority.
- `Business verification`'s nav glyph is redrawn on the 48 grid; the live one is a 3.2KB
  multi-part mark on a 20 viewBox. Every other nav glyph is the live path.
- **Eight rows are live; the rest are inert.** A row is only wired when the backend has
  somewhere to keep its answer:
  - *Privacy → Comments* and *Direct messages*, and *Screen time → Daily screen time*,
    *Sleep hours* and *Weekly screen time updates* read and write user-service's
    `GET/PATCH /users/me/settings` (`useAccountSettings`, one read for the page). The two
    audiences are enforced server-side; the screen-time fields are stored only — nothing,
    client or server, acts on them yet. The pickers are the app's own dialogs, not
    measured off the live site.
  - *Privacy → Blocked accounts* opens a list backed by `GET /users/me/blocked` and
    `DELETE /users/{id}/block`, both of which already existed.
  - *Push notifications → Allow in browser* asks for the browser's Notification permission and
    gates the desktop notification raised for a frame arriving on the STOMP socket. It registers
    nothing with a push service: real pushes to a closed tab need FCM web credentials and a
    `platform` field `DeviceToken` does not carry.
  - *Accessibility → Increase color contrast* writes `.high-contrast` on `<html>`, which shifts
    the alpha-blended tokens in `globals.css`. Browser-local, exactly as the row's own copy says.

  Each is keyed by `SettingsRow.action`, so the layout stays data and only behaviour branches.
- Every other row is inert, and deliberately so: the remaining switches hold their position for
  the session and are forgotten on reload, and the link rows open flows (a region picker, a
  keyword filter editor, account deletion) that this clone has no screens for. A control
  that appears to save something it cannot is worse than one that visibly does nothing.

## Gotchas

- Same bot interstitial as `/@handle`: the first load can come back blank. Bring the tab to
  the front — a `hidden` tab never clears the challenge. See
  `docs/research/tiktok.com/PROFILE.md`.
- Programmatic `element.scrollTop = n` scrolls the panel but fires **no scroll event** in the
  automation browser, and `behavior: "smooth"` is dropped entirely. Verify scroll-spy with a
  real wheel event (`computer` → `scroll`), not by assigning `scrollTop`.
