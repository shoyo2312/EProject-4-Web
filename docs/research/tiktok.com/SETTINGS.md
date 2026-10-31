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
.DivHeaderContainer       fixed, 60 tall, #121212, box-shadow 0 1px 1px rgba(255,255,255,.12)
  .DivHeaderWrapperMain   padding 0 24 0 16, flex, space-between
    .DivHeaderLeft        300 wide; logo 118×42
    .DivSearchForm        500×46, radius 92, rgba(255,255,255,.12); 1×28 divider, 52-wide button
    .DivHeaderRight       Upload 116×36 (radius 2, rgba(255,255,255,.08), "+" 20, 16/600),
                          then messages, inbox, avatar — 32×32 each, 32 / 16 / 24 apart
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

- **The header's inbox opens the rail's Activity panel**, hung under the bar at the right edge
  (`ActivityDrawer placement="header"`), rather than the live dropdown. Its messages glyph is
  inert, like the rail's Messages row — there is no chat UI yet.
- **The Ads section is dropped, not reproduced.** Seven rows and a nav entry, gone from
  `SETTINGS_SECTIONS` entirely rather than rendered inert — there is no ads subsystem anywhere in
  the backend, so every one of them would be permanently dead. The live section's measurements stay
  documented above as research; only our build omits it. Two things went with it: the
  `SettingsGroup.muted` flag, which existed solely for the Ads headings' 500-weight unindented
  style and had no other source of truth, and `AdsIcon` — both recoverable from git history if
  advertising is ever built.
- **One row-title style**, 16/400 `rgba(255,255,255,.9)`, rather than carrying the TUX
  generation's 16/600, which the live page uses for three of its rows.
- **Switches**: 44 × 24 on the panel. The Daily screen time page draws its switch with a dark
  knob and Sleep hours draws a 48 × 28 cyan (#20D5EC) one, both as live does.
- **Pages in the panel are state, not routes.** Live, Daily screen time, Sleep hours and Filter
  keywords are routes under `/setting/…`; here they take over the panel like Deactivate and
  Download your data, and the back arrow leaves them for the sections first.
- **Every row does what it says.** Each is keyed by `SettingsRow.action`, which every row must
  have (`src/lib/__tests__/site-config.test.ts`), so the layout stays data and only behaviour
  branches:
  - *Privacy → Comments* and *Direct messages* read and write user-service's
    `GET/PATCH /users/me/settings` (`AccountSettingsProvider`, one read for the whole app), and
    are enforced server-side. *Comment filters* is not a row on the live panel; its place and
    dialog are the app's own, and interaction-service applies it to each new comment.
  - *Push notifications → Interactions* (Likes, Comments, New followers) and *In-app
    notifications* (+ Reposts) open in place as live does. notification-service skips the push,
    and the web the desktop notification and the in-app banner, for a switch that is off; the
    inbox entry is always written.
  - *Screen time → Daily screen time* is live's page: the same-every-day chips or a limit per
    weekday, picked in live's hours/minutes scroll picker, and a four-digit passcode set the
    first time. Reaching the limit covers every page but `/setting` until the passcode is
    entered (that cover was not observable live; it follows the Sleep hours screen).
  - *Sleep hours* is live's page: Start time in the 12/00–59/AM-PM picker, End time eight hours
    later and never chosen. Push is muted during the window, and the web shows a reminder ten
    minutes before and at the start.
  - *Weekly screen time updates* sends one inbox entry a week, which opens *Summary* — live's
    chart of day and night time over the last four weeks, measured from the web's heartbeats.
  - *Content preferences → Filter keywords* is live's list and add/edit form; video-service
    leaves matching videos out of For You, Following and Friends.
  - *Blocked accounts*, *Allow in browser* and *Increase color contrast* as before: the blocked
    list over `GET /users/me/blocked`, the browser's Notification permission (nothing is
    registered with a push service: that needs FCM web credentials and a `platform` on
    `DeviceToken`), and `.high-contrast` on `<html>`.
- **Rows left out on purpose**, since nothing here could back them:
  - *Account information → Account region*: TikTok sets it from where the account signed up and
    it cannot be changed; this app stores no region and nothing reads one.
  - *Screen time → Help and resources → Digital well-being tips*: a link out to TikTok's help
    site, which this app has no counterpart for.
  - *Business verification* (its nav entry and section): TikTok's business-account programme,
    which has no backing here.
  - *Mentions and tags* and *LIVE* switches under Interactions and In-app notifications: the app
    raises no mention notifications and has no LIVE.
  - *Direct messages* switches under In-app notifications: the web has no Messages page to show
    them from (decided at handoff, 2026-10-24).

## Gotchas

- Same bot interstitial as `/@handle`: the first load can come back blank. Bring the tab to
  the front — a `hidden` tab never clears the challenge. See
  `docs/research/tiktok.com/PROFILE.md`.
- Programmatic `element.scrollTop = n` scrolls the panel but fires **no scroll event** in the
  automation browser, and `behavior: "smooth"` is dropped entirely. Verify scroll-spy with a
  real wheel event (`computer` → `scroll`), not by assigning `scrollTop`.
