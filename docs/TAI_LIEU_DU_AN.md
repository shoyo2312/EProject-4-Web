# Tài liệu dự án (dành cho thành viên mới)

> Tài liệu này giải thích **dự án thực tế đang được xây dựng trong repo này** — một bản clone TikTok chạy thật với backend microservices — chứ không phải tài liệu của "template clone website" gốc (xem `README.md` cho phần đó). Nếu có mâu thuẫn giữa tài liệu này và code, **code luôn đúng hơn** — hãy cập nhật lại tài liệu.

## 1. Dự án này là gì?

Đây là bản clone giao diện + tính năng của TikTok, gồm:

- **Frontend**: Next.js 16 (App Router) trong thư mục này (`tiktok-cloned/`).
- **Backend**: một hệ thống **microservices Spring Cloud** (nằm ở repo/thư mục khác, thường là `tiktok-backend/`) gồm `auth-service`, `user-service`, `video-service`, `chat-service`, `media-worker`... đứng sau một **Spring Cloud Gateway**.

Frontend **không** gọi thẳng từng service — mọi request đều đi qua Gateway. Đây không phải là một trang tĩnh (static) giả lập dữ liệu, mà là ứng dụng full-stack có đăng nhập, upload video thật, realtime (WebSocket), v.v.

### Lưu ý quan trọng: đây không phải Next.js bạn từng biết

Bản Next.js dùng trong dự án có breaking changes so với kiến thức huấn luyện thông thường của AI. Trước khi viết code liên quan đến API Next.js, đọc tài liệu tại `node_modules/next/dist/docs/`.

## 2. Kiến trúc tổng quan

```
Trình duyệt
   │  (fetch tới /api/v1/..., cùng origin)
   ▼
Next.js server (rewrite trong next.config.ts)
   │  /api/:path*  ──▶  API_GATEWAY_URL (Spring Cloud Gateway, mặc định :8080)
   ▼
Gateway ──▶ auth-service / user-service / video-service / chat-service ...
```

- Trình duyệt gọi `/api/v1/...` trên **cùng origin** với Next.js. `next.config.ts` có cấu hình `rewrites()` để proxy các request này sang Gateway (`API_GATEWAY_URL`, mặc định `http://localhost:8080`).
- Lý do dùng rewrite thay vì gọi thẳng cross-origin: Gateway không cấu hình CORS, và giữ same-origin để sau này có thể chuyển token sang httpOnly cookie mà không phải sửa từng nơi gọi API.
- **WebSocket (STOMP/SockJS)** cho tính năng realtime (chat, thông báo, cập nhật video/like...) **không** đi qua rewrite này (rewrite chỉ proxy HTTP, không proxy WS Upgrade) — nó kết nối thẳng tới Gateway qua `NEXT_PUBLIC_WS_GATEWAY_URL`.
- **Media (ảnh/video)**: avatar và thumbnail được phục vụ qua CDN (`MEDIA_CDN_HOST`) hoặc trực tiếp từ MinIO (`MEDIA_ORIGIN`, dev dùng cổng `:9000`). Avatar từ Google/Facebook (đăng nhập social) được phục vụ trực tiếp từ domain của Google/Facebook cho tới khi `media-worker` mirror nó về MinIO.

## 3. Công nghệ sử dụng (Tech stack)

| Thành phần | Công nghệ |
|---|---|
| Framework | Next.js 16 (App Router, React 19, TypeScript strict) |
| UI | shadcn/ui (dựa trên Radix), Tailwind CSS v4 (design token dạng oklch) |
| Icon | Lucide React + SVG tự trích xuất (`src/components/icons.tsx`) |
| State/data | Zustand, TanStack React Query |
| Form | react-hook-form + zod (validate schema) |
| HTTP | `fetch` thuần qua wrapper riêng (`src/lib/api/client.ts`), có dùng `axios` cho vài trường hợp |
| Realtime | `@stomp/stompjs` + `sockjs-client` (WebSocket/STOMP) |
| Video | `hls.js` (phát HLS) |
| Test | Vitest + Testing Library (jsdom) |
| Lint/Type | ESLint 9 + TypeScript strict |
| Deploy | Docker (`Dockerfile`, `Dockerfile.dev`, `docker-compose.yml`), Vercel |

## 4. Cấu trúc thư mục

```
src/
  app/                    # Route của Next.js (App Router)
    (auth)/               # Nhóm route đăng nhập/đăng ký (route group, không lộ trong URL)
      login/
      signup/
    (shell)/              # Nhóm route chính có layout khung sườn (top bar, side nav)
      [username]/         # Trang profile theo username
      explore/, following/, friends/, search/, setting/, upload/
      page.tsx            # Trang chủ (feed "For You")
    video/[id]/            # Trang xem chi tiết 1 video (route độc lập, full-screen player)
    layout.tsx             # Root layout
    not-found.tsx

  components/             # React components, chia theo tính năng
    auth/                 # Đăng nhập, đăng ký, social login, Turnstile captcha
    feed/                 # Feed video (For You), thẻ video, action rail, comment, share
      comments/           #   sub-component riêng của CommentPanel (khi file > ~500 dòng)
    video/                # Trang chi tiết video
      detail/             #   sub-component riêng của BackendVideoDetail/VideoDetail
    profile/               # Trang cá nhân, chỉnh sửa hồ sơ, danh sách follow
    explore/, following/   # Trang khám phá, trang đang theo dõi
    layout/                 # TopBar, SideNav, các drawer (thông báo, tìm kiếm)
    player/                 # Cấu hình player video (tốc độ phát, cài đặt...)
    search/                 # Kết quả tìm kiếm
    session/                 # SessionProvider (quản lý trạng thái đăng nhập toàn app), LoginModal
    settings/                # Trang cài đặt tài khoản
    upload/                  # Trang upload video
    report/                  # Dialog báo cáo vi phạm
    ui/                      # shadcn/ui primitives (Button, Modal, Toast, Skeleton, Tooltip...)
    icons.tsx                # Icon SVG trích xuất từ TikTok gốc

  hooks/                  # Custom hook, đặt tên kebab-case (vd: use-video-feed.ts)
    __tests__/            # Test đặt cạnh hook, trong thư mục __tests__ sibling
    use-video-feed.ts, use-follow-feed.ts, use-explore-feed.ts  # Lấy dữ liệu feed
    use-video-like.ts, use-like-debounce.ts, use-video-save.ts  # Tương tác (like/save có debounce)
    use-*-realtime.ts     # Lắng nghe cập nhật realtime qua STOMP (comment, notification, user, video)
    use-dismiss.ts        # Đóng popover/menu khi click ra ngoài hoặc nhấn Escape
    use-escape-key.ts     # Đóng modal/drawer khi nhấn Escape
    use-mounted.ts        # Gate cho portal (tránh lỗi SSR/hydration)
    use-hls-source.ts     # Phát video HLS
    use-watch-session.ts  # Theo dõi phiên xem video (để tính view/analytics)

  lib/
    api/                   # Toàn bộ giao tiếp với backend
      client.ts            #   Hàm apiFetch() duy nhất gọi backend — xem mục 6
      auth.ts, users.ts, videos.ts, notifications.ts, search.ts, ...  # API theo domain
      adapters.ts          #   Chuyển response backend -> kiểu dữ liệu FE dùng (Author, VideoCard...)
      tokens.ts            #   Lưu/đọc access & refresh token
      errors.ts            #   ApiError, isApiError()
    auth/                   # Social login (Google/Facebook), Cloudflare Turnstile
    forms/                  # Schema zod dùng chung + hook wrapper cho react-hook-form
    realtime/
      stompClient.ts        # Client STOMP dùng chung toàn app (singleton)
    comments/                # Logic thuần xử lý comment (build/merge cây comment...)
    comment-cache.ts, comment-panel.ts, repost-context.ts, overlay-origin.ts, mock-feed.ts, data.ts
    format.ts                # Format số/thời gian hiển thị (vd: 1.2K, "3 giờ trước")
    utils.ts                 # cn() — merge class Tailwind (từ shadcn)
    __tests__/               # Test cho lib/ thuần (không phải component)

  types/tiktok.ts          # Định nghĩa TypeScript dùng chung (Author, VideoCard, Comment...)

public/
  images/, videos/, seo/    # Asset tải về từ site gốc khi dùng skill /clone-website

docs/
  research/                 # Kết quả "khảo sát" site gốc (design token, spec component...) — do skill /clone-website tạo ra
  TAI_LIEU_DU_AN.md          # File bạn đang đọc

scripts/
  sync-agent-rules.sh        # Đồng bộ AGENTS.md -> CLAUDE.md/GEMINI.md/... (chạy sau khi sửa AGENTS.md)
  sync-skills.mjs             # Đồng bộ skill /clone-website ra mọi nền tảng

AGENTS.md                    # Quy ước & hướng dẫn cho AI coding agent — NGUỒN SỰ THẬT DUY NHẤT (single source of truth)
CLAUDE.md, GEMINI.md, ...     # Các bản "import" AGENTS.md cho từng công cụ AI (tự sinh ra, đừng sửa tay)
```

## 5. Chạy dự án ở local

### Yêu cầu
- Node.js >= 24
- Backend Gateway đang chạy (hoặc trỏ `API_GATEWAY_URL` tới môi trường dev chung)

### Biến môi trường (`.env` / `.env.local`)

```env
# Địa chỉ Spring Cloud Gateway — dùng phía server (Next.js proxy /api/* tới đây)
API_GATEWAY_URL=http://localhost:8080

# Cùng Gateway nhưng gọi thẳng từ trình duyệt — dùng riêng cho kết nối STOMP/WebSocket
# vì rewrite /api/* chỉ proxy HTTP, không proxy WS Upgrade
NEXT_PUBLIC_WS_GATEWAY_URL=http://localhost:8080

# Đăng nhập social — chỉ là client ID công khai, không phải secret
NEXT_PUBLIC_GOOGLE_CLIENT_ID=
NEXT_PUBLIC_FACEBOOK_APP_ID=

NEXT_PUBLIC_TURNSTILE_SITE_KEY=
```

Nếu để trống `NEXT_PUBLIC_GOOGLE_CLIENT_ID` / `NEXT_PUBLIC_FACEBOOK_APP_ID`, nút đăng nhập tương ứng sẽ báo "chưa cấu hình trên môi trường này" thay vì mở một dialog lỗi.

### Lệnh chạy

```bash
npm install
npm run dev        # Chạy dev server (http://localhost:3000)
npm run build       # Build production
npm run start        # Chạy bản build
npm run lint          # Kiểm tra ESLint
npm run typecheck      # Kiểm tra kiểu TypeScript (tsc --noEmit)
npm run test            # Chạy test (vitest run)
npm run check             # lint + typecheck + build (nên chạy trước khi mở PR)
```

### Chạy bằng Docker

```bash
docker compose up app --build   # build & chạy bản production
docker compose up dev --build    # chạy chế độ dev, cổng 3001
```

## 6. Giao tiếp với backend — điểm quan trọng nhất cần hiểu

Toàn bộ giao tiếp với backend đi qua **một hàm duy nhất**: `apiFetch<T>()` trong `src/lib/api/client.ts`. **Không** gọi `fetch` trực tiếp ở component — luôn thêm hàm mới vào `src/lib/api/*.ts` theo domain (vd: `videos.ts`, `users.ts`) rồi gọi qua đó.

Những quy tắc `apiFetch` đã xử lý sẵn, đừng tự làm lại:

1. **Base URL**: luôn là `/api/v1` (same-origin, được Next rewrite sang Gateway).
2. **Bọc response (envelope)**: backend trả về dạng `{ success, data, code, message }`. `apiFetch` tự "bóc" (`unwrap`) để trả thẳng `data`, và ném `ApiError` (kiểm tra bằng `isApiError()`) khi `success === false` hoặc HTTP lỗi.
3. **Auth token**: mỗi request có tham số `auth`:
   - `"required"`: bắt buộc gửi token; nếu 401 thì tự refresh 1 lần rồi gọi lại 1 lần (không lặp vô hạn).
   - `"optional"`: gửi token nếu có — dùng cho các GET công khai nhưng có thể cá nhân hoá kết quả (vd: video PRIVATE/PROCESSING chỉ chủ sở hữu thấy).
   - `"none"`: không bao giờ gửi token (login, register, refresh...).
4. **Refresh token xoay vòng (rotate)**: mỗi lần refresh sẽ cấp token mới và **vô hiệu hoá token refresh cũ**. Vì vậy `client.ts` có cơ chế "single-flight" (`inFlightRefresh`) để đảm bảo nhiều request 401 cùng lúc chỉ gọi `/auth/refresh` **một lần duy nhất** — gọi trùng sẽ bị backend coi là token bị đánh cắp và **đăng xuất tất cả thiết bị**. Không được tự viết logic refresh riêng ở nơi khác.
5. **Access token sống 15 phút** — các kết nối realtime (STOMP) phải tự rebuild khi token đổi (xem `stompClient.ts`).

## 7. Xác thực & quản lý phiên đăng nhập

- `src/components/session/SessionProvider.tsx` là nơi quản lý trạng thái người dùng đăng nhập cho toàn app (Context), bao gồm: load thông tin `me`, đăng nhập/đăng xuất, mở `LoginModal` khi cần.
- Hỗ trợ đăng nhập bằng email/password và social login (Google, Facebook) — logic social nằm ở `src/lib/auth/social.ts`.
- Có Cloudflare Turnstile (captcha) khi đăng ký/đăng nhập — `src/lib/auth/turnstile.ts`, `src/components/auth/TurnstileWidget.tsx`.
- Một tài khoản social đăng ký xong có thể **chưa có email ngay** (chờ `user-service` xử lý event từ Kafka, thường mất vài trăm ms) — có route riêng `signup/add-email` để bổ sung.

## 8. Realtime (WebSocket/STOMP)

- `src/lib/realtime/stompClient.ts` giữ **một kết nối STOMP dùng chung cho cả app** (singleton) — nếu thêm tính năng realtime mới, hãy dùng lại client này, đừng mở kết nối riêng.
- Token gửi qua **query param** `?token=...` khi bắt tay WebSocket (không dùng header `Authorization`), vì trình duyệt không thể gắn header tuỳ ý vào request Upgrade của WebSocket/SockJS.
- Client tự rebuild kết nối khi access token đổi (do refresh), và giữ nguyên danh sách listener (`connectListeners`) khi rebuild để không làm mất các subscription đang mở (feed, comment panel...).
- Các hook `use-*-realtime.ts` trong `src/hooks/` là nơi các component đăng ký nhận cập nhật realtime (comment mới, thông báo mới, video/user thay đổi...).

## 9. Các tính năng chính & nơi tìm code

| Tính năng | Route | Component chính |
|---|---|---|
| Feed "For You" | `/` | `components/feed/Feed.tsx`, `VideoCard.tsx`, `ActionRail.tsx` |
| Xem chi tiết 1 video | `/video/[id]` | `components/video/VideoDetail.tsx` / `BackendVideoDetail.tsx` |
| Khám phá (Explore) | `/explore` | `components/explore/ExploreGrid.tsx` (dùng `use-explore-feed.ts`) |
| Đang theo dõi | `/following` | `components/following/FollowFeed.tsx`, `SuggestedCreators.tsx` |
| Bạn bè | `/friends` | route riêng trong `(shell)/friends` |
| Tìm kiếm | `/search` | `components/search/SearchResults.tsx` |
| Trang cá nhân | `/[username]` | `components/profile/ProfileRouter.tsx` → `BackendProfilePage.tsx`/`ProfilePage.tsx` |
| Upload video | `/upload` | `components/upload/UploadPage.tsx` |
| Cài đặt tài khoản | `/setting` | `components/settings/SettingsPage.tsx` |
| Đăng nhập/Đăng ký | `(auth)/login`, `(auth)/signup` | `components/auth/*` |
| Thông báo (activity) | Drawer trong layout | `components/layout/ActivityDrawer.tsx` + `use-notifications.ts`, `use-notification-realtime.ts` |
| Bình luận | Panel trong feed/video | `components/feed/CommentPanel.tsx` + `components/feed/comments/` |
| Báo cáo vi phạm | Dialog | `components/report/ReportDialog.tsx` |
| Chia sẻ / repost | Sheet trong feed | `components/feed/ShareSheet.tsx`, `RepostBadge.tsx` |

## 10. Quy ước code (trích từ `AGENTS.md` — đọc file gốc để đầy đủ)

- TypeScript **strict mode**, không dùng `any`.
- Named export, component đặt tên PascalCase, hàm tiện ích camelCase.
- Class Tailwind trực tiếp, **không** dùng inline style.
- Thụt lề 2 space. Ưu tiên responsive mobile-first.
- File hook đặt tên kebab-case (`src/hooks/use-foo.ts`); test đặt trong thư mục `__tests__/` cạnh file.
- Logic thuần (merge list, parse, format...) đặt ở `src/lib/` kèm unit test — **không** nhét vào trong component.
- Đóng popover/menu: dùng `useDismiss` (click ra ngoài + Escape). Đóng modal/drawer bằng Escape: dùng `useEscapeKey`. Portal phải gate bằng `useMounted`.
- Khi một file component vượt quá ~500 dòng, tách các sub-component riêng tư ra một thư mục con cùng tên (vd: `feed/comments/`, `video/detail/`), giữ nguyên component công khai ở đường dẫn gốc.
- **Pixel-perfect**: khi clone UI từ site gốc, bám sát khoảng cách, màu sắc, typography — không tự ý đổi thẩm mỹ trong giai đoạn emulation.
- **Nội dung thật**: dùng text/asset thật từ site gốc, không dùng placeholder.

### Lưu ý quan trọng khác

- Nếu dùng team nhiều AI agent làm song song: **mỗi agent phải làm trên một worktree/branch riêng** rồi merge lại ở cuối, người điều phối (orchestrator) tự xử lý conflict.
- Sau khi sửa `AGENTS.md`, phải chạy `bash scripts/sync-agent-rules.sh` để sinh lại các file cấu hình nền tảng khác (CLAUDE.md, GEMINI.md...).
- Sau khi sửa `.claude/skills/clone-website/SKILL.md`, phải chạy `node scripts/sync-skills.mjs`.
- Dòng ghi chú ở đầu `AGENTS.md` về "Next.js không giống bạn từng biết" là do `next dev` tự sinh ra (`node_modules/next/dist/server/lib/generate-agent-files.js`) — nếu commit nó thì cây làm việc (working tree) sẽ sạch, đừng cố xoá.

## 11. Kiểm thử (Testing)

- Dùng **Vitest** + **Testing Library** (môi trường `jsdom`), cấu hình tại `vitest.config.ts`.
- Chạy: `npm run test`.
- Test cho hook: `src/hooks/__tests__/*.test.ts`.
- Test cho logic thuần trong `lib/`: đặt trong `__tests__/` cạnh file nguồn (vd: `src/lib/__tests__/format.test.ts`, `src/lib/api/__tests__/resolveAuthors.test.ts`, `src/lib/comments/__tests__/`).
- Khi thêm logic thuần mới vào `lib/`, luôn kèm unit test tương ứng (đây là quy ước bắt buộc, không phải tuỳ chọn).

## 12. Checklist trước khi mở Pull Request

1. `npm run check` (lint + typecheck + build) chạy sạch, không lỗi.
2. `npm run test` pass.
3. Nếu sửa `AGENTS.md`: đã chạy `scripts/sync-agent-rules.sh` và commit các file sinh ra (CLAUDE.md, GEMINI.md...).
4. Không hardcode secret/API key vào code — dùng biến môi trường.
5. Nếu thêm gọi API mới: đã đặt trong `src/lib/api/`, dùng `apiFetch`, không gọi `fetch` trực tiếp trong component.
6. UI mới bám sát pixel-perfect với thiết kế gốc (nếu là phần clone từ TikTok).

## 13. Tài liệu liên quan

- `AGENTS.md` — quy ước bắt buộc, nguồn sự thật duy nhất cho mọi công cụ AI.
- `docs/research/INSPECTION_GUIDE.md` — hướng dẫn khảo sát UI khi clone một trang mới (dùng bởi skill `/clone-website`).
- `README.md` — tài liệu gốc của template "AI Website Cloner" (không mô tả tính năng backend thật của dự án này).
