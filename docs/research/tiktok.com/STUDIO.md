# TikTok Studio (`/tiktokstudio`) — measured 2026-10-26

Measured in Chrome on a signed-in account with no posts (1707px-wide viewport). Only the parts
the Nowa backend serves were built; see "Not built" at the end.

## Entry point

The feed sidebar's **More** panel groups its rows under grey section headings
(15px/400, `rgba(255,255,255,.5)`, padding `16px 8px 8px`). TikTok Studio is the first row of
**Tools**: 18px app icon, label 15px/600 `#F6F6F6`, row padding `14px 8px`, gap 8px, radius 8px.

## Frame

- Light theme: page `#F8F8F8`, text `#000`, secondary `rgba(0,0,0,.65)`, muted `rgba(0,0,0,.34)`.
- Header 68px tall, hairline `rgba(0,0,0,.08)` underneath; avatar 32px top-right.
- Sidebar 248px, padding `32px 19px 48px 20px`, hairline on the right.
  - Upload: 208×36, `#FE2C55`, white 14px/500, radius 8px.
  - Section label: 10px/700 uppercase `rgba(0,0,0,.34)`.
  - Nav row: 208×35, padding `9px 10px`, radius 8px, label 14px/500 `rgba(0,0,0,.65)`.
    Active: black label, `rgba(0,0,0,.05)` fill, 1px `rgba(0,0,0,.08)` border.
  - "Back to TikTok" pinned at the bottom, 14px/500 `rgba(0,0,0,.65)`.
- Content column starts 32px under the header and 32px right of the sidebar.
- Card: white, 1px `rgba(0,0,0,.08)`, radius 8px.

## Home

Profile card (padding 20px: 48px avatar, bold 16px name, counts 14px) · "Key metrics ›" (16px/700)
with the range dropdown on the right (152×32, white, 1px border, radius 6px, 14px/500) · metric
tabs: one row of equal cells, padding `20px 0`, label 14px/500, value 24px/500 (selected one
`#0075DB` with a 4px `#0075DB` bar on top; others separated by hairlines `rgba(0,0,0,.12)`),
change line 13px muted `0 (--)` · line chart with day labels under it · "Recent posts ›" and
"Latest comments ›" cards.

## Posts (`/content`)

Filter chips (white, 1px border, radius 8px, 14px/600, three-line icon) — Views, Likes, Comments
(ranges) and Privacy (Everyone / Only me / Friends, checkboxes, Clear + Apply). Search box on the
right "Search for post description". Table: Content (Created on ⇕), Privacy, Views ⇕, Likes ⇕,
Comments ⇕, Actions. Header row 12px muted.

## Analytics

Tabs live in the header (Overview · Content · Viewers · Followers), 14px; active black with a 2px
black underline, others `rgba(0,0,0,.34)`. Range dropdown (Last 7/28/60/365 days, Custom) and
"Download data" sit at the header's right.

- Overview: metric tabs + chart, then Traffic source / Search queries cards.
- Content: "Your top posts" — tabs Most views / Most new viewers / Most likes / New followers;
  columns Post, Views in last N days, Total views, Posted on, Actions.
- Viewers: Total viewers / New viewers tabs + chart; "Most active times" card with Hours/Days
  toggle and a bar chart; demographics cards.

## Comments (`/comment`)

Chips: All comments (All / Not replied / Replied), Posted by everyone, Follower count, Comment
date (range calendar, Reset + Apply). Search "Search for comments or usernames". Empty state:
14px muted "No comments yet".

## Built for Nowa (backend-backed only)

| TikTok | Nowa | Endpoint |
|---|---|---|
| Home metrics (views, likes, comments, shares) | + net followers instead of profile views/rewards | `GET /analytics/creator/overview` |
| Posts table, Privacy chip, column sorts, search | + Status chip | `GET /videos/me` |
| Analytics Overview / Content / Viewers | Content tabs: Most views, Most new viewers, Most likes | `/analytics/creator/*` |
| Video analytics | retention curve + daily views | `GET /analytics/creator/videos/{id}` |
| Comments chips, date range, search | type = All / Held for review / Published, + Post chip | `GET /interactions/users/me/comments` |

Not built (no backend): profile views, estimated rewards, traffic source, search queries,
Followers tab, demographics, view/like/comment range chips, follower-based comment filters,
custom date range, Download data, the Tools section of the Studio sidebar.
