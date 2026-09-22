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
