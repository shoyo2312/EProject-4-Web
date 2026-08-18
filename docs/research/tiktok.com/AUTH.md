# TikTok.com — `/login` and `/signup`

Measured live on **2026-08-11** at **1920×936, DPR 1, 100% zoom** — so every number
below is a CSS pixel. Screenshots come back 1568 wide, a 0.8167 scale.

The pages render the same signed out or signed in, so they were measured on the
browser's existing session without touching it.

## Six URLs, not two

Each step of each flow is its own route, and the live site pushes real history
entries — so the browser's back button walks the flow. The clone keeps all six:

| URL | What it shows |
|---|---|
| `/login` | option list |
| `/login/phone-or-email` | phone + code, "Log in with password" under it |
| `/login/phone-or-email/email` | email-or-username + password |
| `/signup` | option list |
| `/signup/phone-or-email/phone` | birthday + phone + code |
| `/signup/phone-or-email/email` | birthday + email + password + code + opt-in |

`/signup/phone-or-email` is a prefix only; landing on it forwards to `/phone`.

## Shell

Neither page has the sidebar or the top bar. They are the only routes on the
site with chrome of their own.

```
.DivContainer            full viewport, #121212
  .DivHeaderContainer    60 tall, flex space-between, padding 0 20px 0 16px
    a.StyledLinkLogo     118 × 42
    a.AHelpTag           20px glyph + 7px gap + "Feedback and help" 14/17/600
  .DivBodyContainer      flex-1, overflow-y auto      ← the scroller
  .DivFooterContainer
    .DivAgreement        landing pages only, padding 16px 30px, margin-bottom 80
    .DivContainer        64 tall, border-top 1px rgba(255,255,255,.12)
    .DivBottomContainer  84 tall, padding 0 144px
```

**The body scrolls, not the window.** That is why the seventh option row is
clipped by the agreement on a 936-tall viewport instead of pushing the footer
down — the agreement belongs to the footer, not to the list.

| Part | Measurement |
|---|---|
| Alt bar | 15/18/400; the link 15/600 `#FF3B5C`, `margin-left: 5px` |
| Language select | 172 × 36, `1px solid #8A8B91`, radius **2**, `padding: 0 16px`, 14/36 white |
| Copyright | "© 2026 TikTok", 14/28/**500**, `#8A8B91` |

## Landing pages

Column 363 wide, centred, 64px below the header, `text-align: center`.

| Part | Login | Signup |
|---|---|---|
| Title | "Log in to TikTok" | "Sign up for TikTok" |
| Description | "Manage your account, check notifications, comment on videos, and more." | "Create a profile, follow other accounts, make your own videos, and more." |
| Rows | 7, starting with Use QR code | 6, no QR |
| Alt bar | "Don't have an account? Sign up" | "Already have an account? Log in" |

Title 33/49.5/**700**, 16px above the description; description 15/18/400 at
`rgba(255,255,255,.34)`, 20px above the first row.

`.DivBoxContainer` — **345 × 46, radius 8**, `rgba(255,255,255,.08)`,
`padding: 0 14px 0 10px`, 16/24/**600**, 20px glyph, rows 12px apart.

Note this is *not* the login modal's pill: that one is 300 × 48 at radius 24 on
`rgba(255,255,255,.13)`. Same seven labels, two different designs, and the
modal's phone row reads "Use phone or email" where the page's reads "Use phone
/ email / username". Both are reproduced as measured.

`.DivLastLoginMethodContainer` — 11/16/**600** `#161823` on `#20D5EC`, radius
`10px 10px 10px 2px`, `padding: 0 8px`, `margin: -8px 12px -8px auto` so it
overlaps the row's top-right corner without adding height.

`.DivAgreement` — 337 wide, 12/15/400 `rgba(255,255,255,.5)`, with "Vietnam",
"Terms of Service" and "Privacy Policy" at the same size in
`rgba(255,255,255,.9)`.

## Form steps

Title 32/48/**700**. The login form starts 8px under it; the signup form starts
**28px** under it. Both columns are 363 wide.

| Part | Measurement |
|---|---|
| Label row | flex space-between, 15/22.5/**600**; 10.5 under it on login, 5 on signup |
| Switch link | 12/18/**600** `rgba(255,255,255,.9)`, `underline rgba(255,255,255,.75)` |
| `.InputContainer` | 44 tall, `rgba(255,255,255,.12)`, radius **2**, `padding-left: 12px`, 16px, `caret-color: #FE2C55`, placeholder `rgba(255,255,255,.34)`, 9px apart |
| Password eye | 20px, 16px in from the field's right edge |
| `.StyledForgetPasswordLink` | 21 tall, link 12/18/600 at `rgba(255,255,255,.75)` |
| `.ButtonSendCode` | 47 tall, `padding: 0 16px`, 16/24/600, radius `0 4px 4px 0`, welded to a 47-tall code field |
| `.DivAreaSelectionContainer` | 108 wide, inside one 46-tall bordered row with the number field |
| `.Button-StyledButton` | 46 tall, radius 4, 16/22/**700**, `margin-top: 21px`; disabled `rgba(255,255,255,.08)` on `rgba(255,255,255,.34)`, enabled **#FF3B5C on white** |
| `.DivBack` | "Go back", 40px under the form, 14/21/600, centred |

Row tops on `/signup/phone-or-email/email`, the quickest way to check a
rebuild: **124 · 200 · 226 · 274 · 310 · 338 · 391 · 444 · 500 · 553**.

### Signup extras

- `.DivTitle` "When's your birthday?" 16/22/600, then three **115-wide**
  selects 8px apart, each 44 tall at radius 4 on `rgba(255,255,255,.12)` with
  the label at 16/24 and a solid caret.
- `.DivDescription` "Your birthday won't be shown publicly." 14/20/400 at
  `rgba(255,255,255,.5)`, 16px above the contact block.
- `.DivCheckboxWrapper` — a **22px square** box (not a rounded one), `#121212`
  inside a `1px solid rgba(255,255,255,.5)` border, 8px before 12/16/400 text
  at `rgba(255,255,255,.75)`. Only the email form has it.

## Deviations in our build

- **The form column is 363, not 375.** The live form wrapper carries
  `margin-right: -12px`, so the fields hang 12px past the title above them.
  The signup form has no such offset, which is what marks it as a
  scrollbar-compensation artifact rather than a design. Same reason the landing
  list's `padding: 8px 5px 2px 13px` is evened out to 9px a side here — live,
  it leaves the rows 4px off centre.
- **No real auth.** Any input that satisfies the form's own rules signs the
  viewer in as the mock account and lands on the feed. The live signup then
  continues into a code check and a username step that only a backend can
  drive.
- **"Send code" only starts the countdown.** It cannot mail or text anything,
  so the form accepts any six digits. The 60-second "Resend" state is live.
- **The third-party rows keep their labels but not their logos** — a 20px disc
  in the provider's brand colour instead. Those are other companies'
  trademarks. Same call the login modal already made.
- **The language select is the native control.** Live, a transparent `<select>`
  is stretched over a styled `<p>` so the caret can be TikTok's; with one
  locale in the clone the overlay would buy nothing but the caret.
- **The login modal now links here.** Live, its phone row and its "Sign up"
  link swap the modal's own contents. This clone has the real pages, so they
  navigate — otherwise `/login` and `/signup` would be unreachable from the UI.
- `TopBar` returns `null` on these routes. It is one check rather than a second
  root layout, because these are the only two routes that drop it.

## Gotchas

- These pages load first time — no bot interstitial, unlike `/@handle` and
  `/setting`. See `docs/research/tiktok.com/PROFILE.md`.
- The submit button's enabled colour reads back as the *disabled* fill from
  `getComputedStyle` for a while after the form becomes valid: the value is
  mid-`transition-colors`, and in the automation browser it can stay that way
  far longer than the 150ms transition. Confirm the enabled state from a
  screenshot, not from a computed style.
