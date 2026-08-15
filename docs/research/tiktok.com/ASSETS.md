# TikTok.com — Assets

## What was extracted verbatim

### SVG icons (14) → `src/components/icons.tsx`
Every `d` attribute below is copied exactly from the live DOM. All use a 48×48 viewBox and
are rendered at a 19px glyph size inside a 32×32 `.TUXButton-iconContainer`.

| Icon | Paths | Source |
|---|---|---|
| `ForYouIcon` | 1 | sidebar nav |
| `ExploreIcon` | 2 | sidebar nav |
| `FollowingIcon` | 1 | sidebar nav |
| `FriendsIcon` | 1 | sidebar nav |
| `LiveIcon` | 2 | sidebar nav |
| `MessagesIcon` | 1 | sidebar nav |
| `ActivityIcon` | 2 | sidebar nav |
| `UploadIcon` | 2 | sidebar nav |
| `MoreIcon` | 1 | sidebar nav |
| `SearchIcon` | 1 | sidebar search field |
| `PlusIcon` | 1 | follow badge on avatar |
| `HeartIcon` | 1 | action rail |
| `CommentIcon` | 1 | action rail |
| `BookmarkIcon` | 1 | action rail |
| `ShareIcon` | 1 | action rail |

The Profile nav row has **no SVG** on the live site — it renders the user's avatar image.

### Text content
Sidebar nav labels, hrefs and order are verbatim (see `src/lib/mock-feed.ts` →
`NAV_ITEMS`). The Activity badge count is **not**: the live value was the account owner's
real unread count, which is personal data rather than a design token, so it is replaced
with an arbitrary number.

Footer headings **and** their link lists are now verbatim — see `BEHAVIORS.md`. The links
had to be read by clicking each heading in turn, because the footer is a single-open
accordion that renders nothing until expanded; an earlier pass mistook that for "no links"
and shipped fillers. Only the hrefs are still missing (they carry query strings).

## What was deliberately NOT downloaded

**No TikTok video files, poster frames, avatars, or album art are vendored into this repo.**
This is a deliberate decision, not an extraction failure. Three reasons:

1. **Copyright.** The feed served was a personalised, authenticated For You feed. Those videos
   are third-party creators' copyrighted work. Committing them into a clone repo redistributes
   them.
2. **Personal data.** The session was logged in. The feed, the profile handle, the avatar and
   the Activity badge count are the account owner's personal data. The handle observed on the
   live site has been replaced with a generic `/@user` in `NAV_ITEMS`.
3. **Signed URLs expire.** TikTok's CDN URLs carry short-lived signatures, so any download
   would rot and the build would break later.

### What stands in instead
Media supplied by the repo owner — **not** sourced from TikTok, so the three reasons above
still hold. The earlier gradient-SVG placeholders have been deleted.

| Path | Content |
|---|---|
| `public/videos/video-{1,2,3}.mp4` | Owner-supplied clips — 1024×576, 576×1024, 576×1024 |
| `public/images/posters/poster-{1,2,3}.jpg` | First frame of the matching clip |
| `public/images/avatars/avatar-{1,2,3}.jpeg` | Owner-supplied avatars (non-square; `object-cover`) |

Posters were extracted without ffmpeg — `qlmanage -t -s 1024 -o <dir> <file>` writes a PNG
thumbnail of the first frame, then `sips -s format jpeg`. Durations came from
`mdls -name kMDItemDurationSeconds` and are stored in `FEED_VIDEOS.durationSeconds`, so the
progress bar is correct before `loadedmetadata` fires.

Captions, handles and stats in `FEED_VIDEOS` are invented but formatted to TikTok's real
conventions (`355.8K`, `20.1K`, `6834` — no suffix below 10,000; see `formatCount`).

`video-1` is landscape (16:9) and deliberately kept that way — it exercises the second of
TikTok's two card branches. See `PAGE_TOPOLOGY.md` § Media card sizing.

## Fonts
`TikTokFont` is proprietary and self-hosted — it is not on Google Fonts and cannot be
redistributed. Substituted with **Inter** (weights 500 and 700, the only two weights the target
uses) via `next/font/google`. Glyph shapes differ slightly from the original; this is
unavoidable, not an implementation defect.

## Favicons / SEO
Not downloaded. `layout.tsx` carries the target's verbatim `<title>` and meta description.
`public/seo/` was not populated.
