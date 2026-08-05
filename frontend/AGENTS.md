# Frontend

Next.js 16 (App Router) + React 19 + TypeScript, built as a static export (`output: "export"`) and served by the FastAPI backend. Board state still lives in memory only (`useState`), not yet persisted via the backend (that's a later plan part) — but login/logout is real, backed by the FastAPI JWT endpoints.

## Structure

- `src/app/layout.tsx` — root layout; loads Space Grotesk (display font) and Manrope (body font) via `next/font/google`, sets page metadata.
- `src/app/page.tsx` — `/` route, renders `AppShell`.
- `src/app/globals.css` — Tailwind v4 import plus the app's CSS custom properties (colors from AGENTS.md's Color Scheme, surface/stroke/shadow tokens).
- `src/lib/kanban.ts` — domain types (`Card`, `Column`, `BoardData`), `initialData` seed (5 columns, 8 cards), and pure helpers: `moveCard` (reorder/move a card by id between/within columns) and `createId` (random id generator). No I/O.
- `src/lib/auth.ts` — `fetchSession`/`login`/`logout`, thin wrappers around `fetch` calls to `/api/auth/*`. No token handling on the client — the JWT lives in an httpOnly cookie set by the backend.
- `src/components/AppShell.tsx` — top-level client component. On mount, calls `fetchSession()` to decide whether to render `LoginForm` or the board; owns the logout button.
- `src/components/LoginForm.tsx` — username/password form, calls `lib/auth.login`, shows an error on failure.
- `src/components/KanbanBoard.tsx` — client component. Owns all board state, wraps columns in `@dnd-kit/core`'s `DndContext`, handles drag start/end, column rename, add card, delete card.
- `src/components/KanbanColumn.tsx` — one column: droppable zone, editable title input, sortable list of cards, empty-state placeholder, renders `NewCardForm`.
- `src/components/KanbanCard.tsx` — one sortable/draggable card with a delete button.
- `src/components/KanbanCardPreview.tsx` — static (non-interactive) card render used inside `DragOverlay` while dragging.
- `src/components/NewCardForm.tsx` — inline toggle form (title + details) for adding a card to a column.

## Auth model

Login is enforced client-side: `AppShell` always renders the same static HTML/JS (it's a static export, there's no server-rendered gate), and on mount asks the backend "am I logged in?" via `GET /api/auth/me`. Unauthenticated → `LoginForm`; authenticated → the board plus a logout button. The actual security boundary is server-side: the JWT cookie is httpOnly (unreadable from JS) and future Kanban API routes will require it via the backend's `get_current_user` dependency. Don't rely on this client-side gate alone to protect data — it's UI routing, not the auth boundary.

## State model

Board state is a single `BoardData` object: `columns` (ordered array with `cardIds`) plus `cards` (id-keyed map). All mutations in `KanbanBoard.tsx` are immutable updates via `setBoard`. `moveCard` in `lib/kanban.ts` is the only place drag-and-drop reordering logic lives, and it's unit-tested directly — reuse it rather than re-deriving column/card index math elsewhere.

## Styling

Tailwind v4, configured via `@theme inline` in `globals.css` (no `tailwind.config.*` file). Colors are referenced as CSS vars (`var(--navy-dark)`, etc.), not Tailwind color utilities — keep using the vars for consistency when adding UI.

## Testing

- Unit/component tests: Vitest + Testing Library + jsdom. Files live next to source as `*.test.ts(x)` (see `src/lib/kanban.test.ts`, `src/components/KanbanBoard.test.tsx`, `src/components/LoginForm.test.tsx`, `src/components/AppShell.test.tsx`). Auth tests mock `global.fetch` via `vi.stubGlobal`. Config: `vitest.config.ts`, setup in `src/test/setup.ts`. Run with `npm run test:unit`.
- E2E: Playwright, tests in `tests/*.spec.ts` (`tests/kanban.spec.ts`, `tests/auth.spec.ts`; shared login helper in `tests/utils.ts`). Since login is server-backed, `playwright.config.ts`'s `webServer` builds and runs the real Docker image (`docker build .. && docker run ... -p 3000:8000`) rather than a frontend-only `next dev` server — a plain `next dev` has no `/api/*` routes to log in against. Run with `npm run test:e2e` (requires Docker running; downloads browsers once via `npx playwright install chromium`).
- `npm run test:all` runs both.

## Known gaps to address in later plan parts

- No API client / fetch layer for the board itself — board state is still local only (Part 7).
- No AI chat sidebar yet.
