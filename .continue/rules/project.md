<!-- AUTO-GENERATED from AGENTS.md — do not edit directly.
     Run `bash scripts/sync-agent-rules.sh` to regenerate. -->

---
description: Project conventions for AI Website Clone Template
alwaysApply: true
---
<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Website Reverse-Engineer Template

## What This Is
A reusable template for reverse-engineering any website into a clean, modern Next.js codebase using AI coding agents. The Next.js + shadcn/ui + Tailwind v4 base is pre-scaffolded — just run `/clone-website <url1> [<url2> ...]`.

## Tech Stack
- **Framework:** Next.js 16 (App Router, React 19, TypeScript strict)
- **UI:** shadcn/ui (Radix primitives, Tailwind CSS v4, `cn()` utility)
- **Icons:** Lucide React (default — will be replaced/supplemented by extracted SVGs)
- **Styling:** Tailwind CSS v4 with oklch design tokens
- **Deployment:** Vercel

## Commands
- `npm run dev` — Start dev server
- `npm run build` — Production build
- `npm run lint` — ESLint check
- `npm run typecheck` — TypeScript check
- `npm run check` — Run lint + typecheck + build

## Code Style
- TypeScript strict mode, no `any`
- Named exports, PascalCase components, camelCase utils
- Tailwind utility classes, no inline styles
- 2-space indentation
- Responsive: mobile-first
- Hook files are kebab-case (`src/hooks/use-foo.ts`); tests live in a sibling `__tests__/`
- Pure logic (list merging, parsing, formatting) goes in `src/lib/` with a unit test, not inside a component
- Popover/menu dismissal uses `useDismiss` (click-outside + Escape); modal/drawer Escape uses `useEscapeKey`; portals gate on `useMounted`
- When a component file outgrows ~500 lines, move its private sub-components into a sibling folder named after it (`feed/comments/`, `video/detail/`) and keep the public component at its original path

## Design Principles
- **Pixel-perfect emulation** — match the target's spacing, colors, typography exactly
- **No personal aesthetic changes during emulation phase** — match 1:1 first, customize later
- **Real content** — use actual text and assets from the target site, not placeholders
- **Beauty-first** — every pixel matters

## Project Structure
```
src/
  app/              # Next.js routes
  components/       # React components
    ui/             # shadcn/ui primitives
    icons.tsx       # Extracted SVG icons as React components
  lib/
    utils.ts        # cn() utility (shadcn)
  types/            # TypeScript interfaces
  hooks/            # Custom React hooks
public/
  images/           # Downloaded images from target site
  videos/           # Downloaded videos from target site
  seo/              # Favicons, OG images, webmanifest
docs/
  research/         # Inspection output (design tokens, components, layout)
scripts/            # Asset download scripts
```

## MOST IMPORTANT NOTES
- When launching Claude Code agent teams, ALWAYS have each teammate work in their own worktree branch and merge everyone's work at the end, resolving any merge conflicts smartly since you are basically serving the orchestrator role and have full context to our goals, work given, work achieved, and desired outcomes.
- After editing `AGENTS.md`, run `bash scripts/sync-agent-rules.sh` to regenerate platform-specific instruction files.
- After editing `.claude/skills/clone-website/SKILL.md`, run `node scripts/sync-skills.mjs` to regenerate the skill for all platforms.

# Website Inspection Guide

## How to Reverse-Engineer Any Website

This guide outlines what to capture when inspecting a target website via Chrome MCP or browser DevTools.

## Phase 1: Visual Audit

### Screenshots to Capture
- [ ] Every distinct page — desktop, tablet, mobile
- [ ] Dark mode variants (if applicable)
- [ ] Light mode variants (if applicable)
- [ ] Key interaction states (hover, active, open menus, modals)
- [ ] Loading/skeleton states
- [ ] Empty states
- [ ] Error states

### Design Tokens to Extract
- [ ] **Colors** — background, text (primary/secondary/muted), accent, border, hover, error, success, warning
- [ ] **Typography** — font family, sizes (h1-h6, body, caption, label), weights, line heights, letter spacing
- [ ] **Spacing** — padding/margin patterns (look for a scale: 4px, 8px, 12px, 16px, 24px, 32px, etc.)
- [ ] **Border radius** — buttons, cards, avatars, inputs
- [ ] **Shadows/elevation** — card shadows, dropdown shadows, modal overlay
- [ ] **Breakpoints** — when does the layout shift? (inspect with DevTools responsive mode)
- [ ] **Icons** — which icon library? custom SVGs? sizes?
- [ ] **Avatars** — sizes, shapes, fallback behavior
- [ ] **Buttons** — all variants (primary, secondary, ghost, icon-only, danger)
- [ ] **Inputs** — text fields, textareas, selects, checkboxes, toggles

## Phase 2: Component Inventory

For each distinct UI component, document:
1. **Name** — what would you call this component?
2. **Structure** — what HTML elements / child components does it contain?
3. **Variants** — does it have different sizes, colors, or states?
4. **States** — default, hover, active, disabled, loading, error, empty
5. **Responsive behavior** — how does it change at different breakpoints?
6. **Interactions** — click, hover, focus, keyboard navigation
7. **Animations** — transitions, entrance/exit animations, micro-interactions

### Common Components to Look For
- Navigation (top bar, sidebar, bottom bar)
- Cards / list items
- Buttons and links
- Forms and inputs
- Modals and dialogs
- Dropdowns and menus
- Tabs and segmented controls
- Avatars and user badges
- Loading skeletons
- Toast notifications
- Tooltips and popovers

## Phase 3: Layout Architecture

- [ ] **Grid system** — CSS Grid? Flexbox? Fixed widths?
- [ ] **Column layout** — how many columns at each breakpoint?
- [ ] **Max-width** — main content area max-width
- [ ] **Sticky elements** — header, sidebar, floating buttons
- [ ] **Z-index layers** — navigation, modals, tooltips, overlays
- [ ] **Scroll behavior** — infinite scroll, pagination, virtual scrolling

## Phase 4: Technical Stack Analysis

- [ ] **Framework** — React? Vue? Angular? Check `__NEXT_DATA__`, `__NUXT__`, `ng-version`
- [ ] **CSS approach** — Tailwind (utility classes), CSS Modules, Styled Components, Emotion, vanilla CSS
- [ ] **State management** — Redux (check DevTools), React Query, Zustand, Pinia
- [ ] **API patterns** — REST, GraphQL (check network tab for `/graphql` requests)
- [ ] **Font loading** — Google Fonts, self-hosted, system fonts
- [ ] **Image strategy** — CDN, lazy loading, srcset, WebP/AVIF
- [ ] **Animation library** — Framer Motion, GSAP, CSS transitions only

## Phase 5: Documentation Output

After inspection, create these files in `docs/research/`:
1. `DESIGN_TOKENS.md` — All extracted colors, typography, spacing
2. `COMPONENT_INVENTORY.md` — Every component with structure notes
3. `LAYOUT_ARCHITECTURE.md` — Page layouts, grid system, responsive behavior
4. `INTERACTION_PATTERNS.md` — Animations, transitions, hover states
5. `TECH_STACK_ANALYSIS.md` — What the site uses and our chosen equivalents

# Frontend Rules (shared across projects)

This file holds the frontend coding rules that are meant to stay **identical across every Next.js frontend on this team** — currently `tiktok-cloned` (the public app) and `tiktok-admin` (the admin dashboard). It exists so that Claude Code produces the same shape of code regardless of which repo it's working in, and so a developer moving between repos doesn't have to relearn conventions.

**Precedence:** this file is the floor, not the ceiling. Each project's own `AGENTS.md` / `CLAUDE.md` covers what's specific to that codebase (exact folder layout, tech choices unique to it, domain rules) and wins if the two ever disagree. Don't duplicate project-specific detail here — put it in the project's own file and, if it's a pattern worth sharing, promote it here instead.

This file is imported by each project's `AGENTS.md`, so Claude Code picks it up automatically — no need to paste it into a prompt.

## Before writing any code

- This Next.js is **not** the one you were trained on — breaking changes exist. Read the relevant guide under `node_modules/next/dist/docs/` before touching anything Next.js-specific (routing, data fetching, config, images...). This applies per repo — each has its own `node_modules`.
- Check the current project's own `AGENTS.md`/`CLAUDE.md` first for anything that overrides or adds to this file.
- Before introducing a new pattern (a new state library, a new folder, a new abstraction), grep the repo for how the same problem is already solved. Reuse the existing pattern unless there's a concrete reason not to.

## TypeScript & style

- TypeScript **strict mode**, no `any`. If a type is genuinely unknown, narrow it — don't escape-hatch around it.
- Named exports. Components `PascalCase`, functions/variables `camelCase`.
- Tailwind utility classes only — no inline `style={}`, no CSS-in-JS, no new global stylesheets for component-level styling.
- 2-space indentation.
- Mobile-first responsive design.
- Default to **no comments**. Add one only when the *why* isn't obvious from the code (a non-obvious constraint, a workaround for a specific bug, a subtle invariant) — never to restate *what* the code does.

## File & folder conventions

- Group components by **feature/domain**, not by type (`feed/`, `moderation/`, `videos/` — not a flat `components/` dump).
- Hook files are kebab-case (`use-foo.ts`).
- Tests live beside the code they test, in a sibling `__tests__/` folder.
- Pure logic — parsing, formatting, merging lists, computing derived values — goes in a `lib/`-style module with a unit test. It does not live inside a component or a route handler.
- When a component file outgrows roughly 500 lines, split its private sub-components into a sibling folder named after it (e.g. `feed/comments/`, `video/detail/`) and keep the public component at its original path. Don't let files grow indefinitely instead.
- Reusable, cross-cutting UI primitives (buttons, badges, tooltips, modals) live in a dedicated `ui/` folder, separate from feature components.

## API layer

- Every project talks to the backend through **exactly one** client module (e.g. `lib/api/client.ts`). No component, hook, or page calls `fetch`/`axios` directly — it goes through this client.
- The client owns: base URL / gateway routing, response-envelope unwrapping, auth header attachment, and a single typed error (`ApiError`) that call sites check with an `isApiError`-style guard.
- New endpoints are added as small, named functions in domain-specific files under `lib/api/` (e.g. `videos.ts`, `users.ts`) — not inlined ad hoc where they're used.
- Never duplicate token-refresh, session, or auth-header logic outside the client — these are exactly the kind of subtle, once-per-project mechanisms (rotating refresh tokens, single-flight refresh, httpOnly session cookies, whichever a given project uses) that silently break the whole app if reimplemented in two places.
- All backend traffic goes through the API gateway — never straight to an individual service's port. That's a gateway-enforced rule (rate limiting, auth checks, routing), not just a convention.

## State, data, and forms

- Prefer the data-fetching approach the project already uses (server components / server-side fetch, or a client hook layer) — don't mix in a new one without a reason.
- Keep client state minimal and colocated with what uses it; don't reach for global state for something one component tree needs.
- Validate form input with schemas at the boundary (e.g. zod) rather than scattering ad hoc `if` checks through submit handlers.

## Testing

- Use the test runner the project already has configured — don't add a second one.
- Any new pure-logic function in `lib/` gets a unit test alongside it. This is not optional.
- Run the project's `check` script (or equivalent `lint && typecheck && build`) before considering work done.

## Scope discipline (applies to Claude Code specifically)

- Don't add abstractions, config options, or error handling for scenarios that can't happen. A bug fix doesn't need a refactor riding along with it.
- Don't invent a new folder or pattern when grep shows an existing one already covers the case.
- Match the scope of a change to what was actually asked. If a task reveals a larger structural issue, say so and ask before expanding scope — don't just do it.
- Never commit secrets, `.env` values, or real credentials.

## Git / PR hygiene

- Small, focused commits with messages that explain *why*, not just *what*.
- Run lint + typecheck + build (the project's `check` script) before opening a PR.
- If working with multiple Claude Code agents in parallel on one repo, each agent works in its own git worktree/branch; merge and resolve conflicts at the end rather than having agents share a working tree.
