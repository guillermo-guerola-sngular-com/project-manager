# Frontend

Next.js 16 (App Router) + React 19 + TypeScript, built as a static export (`output: "export"`) and served by the FastAPI backend. The Kanban board and login are both fully backend-backed now — no in-memory demo data left; everything round-trips through `/api/*`.

## Structure

- `src/app/layout.tsx` — root layout; loads Space Grotesk (display font) and Manrope (body font) via `next/font/google`, sets page metadata.
- `src/app/page.tsx` — `/` route, renders `AppShell`.
- `src/app/globals.css` — Tailwind v4 import plus the app's CSS custom properties (colors from AGENTS.md's Color Scheme, surface/stroke/shadow tokens).
- `src/lib/kanban.ts` — domain types (`Card`, `Column`, `BoardData`; ids are `number`, matching the backend's integer primary keys) and the pure `moveCard` helper (reorder/move a card by id between/within columns, operating on `Column[]`). No I/O — this is the same reducer logic used for the optimistic local update on drag.
- `src/lib/api.ts` — `fetchBoard` (fetches `GET /api/board` and flattens the nested `{columns: [{..., cards: [...]}]}` response into the normalized `BoardData` shape `lib/kanban.ts` and the dnd-kit-driven UI expect), `renameColumn`, `createCard`, `updateCard` (edit and/or move — sends `column_id`/`position`), `deleteCard`.
- `src/lib/auth.ts` — `fetchSession`/`login`/`logout`, thin wrappers around `fetch` calls to `/api/auth/*`. No token handling on the client — the JWT lives in an httpOnly cookie set by the backend.
- `src/components/AppShell.tsx` — top-level client component. On mount, calls `fetchSession()` to decide whether to render `LoginForm` or the board; owns the logout button.
- `src/components/LoginForm.tsx` — username/password form, calls `lib/auth.login`, shows an error on failure.
- `src/components/KanbanBoard.tsx` — client component. Fetches the board from the API on mount (shows "Loading board…" until it resolves). Every interaction (rename, add, delete, drag move) updates local state immediately (optimistic) and fires the matching `lib/api.ts` call in the background; a failed call surfaces a dismissable-by-next-action error banner rather than rolling back — acceptable for an MVP local app where the backend is on the same host.
- `src/components/KanbanColumn.tsx` — one column: droppable zone, editable title input, sortable list of cards, empty-state placeholder, renders `NewCardForm`.
- `src/components/KanbanCard.tsx` — one sortable/draggable card with a delete button.
- `src/components/KanbanCardPreview.tsx` — static (non-interactive) card render used inside `DragOverlay` while dragging.
- `src/components/NewCardForm.tsx` — inline toggle form (title + details) for adding a card to a column.

## Auth model

Login is enforced client-side: `AppShell` always renders the same static HTML/JS (it's a static export, there's no server-rendered gate), and on mount asks the backend "am I logged in?" via `GET /api/auth/me`. Unauthenticated → `LoginForm`; authenticated → the board plus a logout button. The actual security boundary is server-side: the JWT cookie is httpOnly (unreadable from JS), and every board route requires it via the backend's `get_current_user` dependency. Don't rely on this client-side gate alone to protect data — it's UI routing, not the auth boundary.

## State model

Board state is a single `BoardData` object: `columns` (ordered array with `cardIds`) plus `cards` (id-keyed map), populated from `fetchBoard()` on mount. All mutations in `KanbanBoard.tsx` are immutable local updates via `setBoard`, paired with a background API call. `moveCard` in `lib/kanban.ts` is the only place drag-and-drop reordering logic lives — reuse it rather than re-deriving column/card index math elsewhere. Card/column ids are whatever the database assigned; there's no client-side id generation anymore.

## Styling

Tailwind v4, configured via `@theme inline` in `globals.css` (no `tailwind.config.*` file). Colors are referenced as CSS vars (`var(--navy-dark)`, etc.), not Tailwind color utilities — keep using the vars for consistency when adding UI.

## Testing

- Unit/component tests: Vitest + Testing Library + jsdom. Files live next to source as `*.test.ts(x)` (see `src/lib/kanban.test.ts`, `src/components/KanbanBoard.test.tsx`, `src/components/LoginForm.test.tsx`, `src/components/AppShell.test.tsx`). Board/auth tests mock `global.fetch` via `vi.stubGlobal`, routing on `(url, options.method)` — see `createFetchMock` in `KanbanBoard.test.tsx` for the pattern. Config: `vitest.config.ts`, setup in `src/test/setup.ts`. Run with `npm run test:unit`.
- E2E: Playwright, tests in `tests/*.spec.ts` (`tests/kanban.spec.ts`, `tests/auth.spec.ts`; shared login helper in `tests/utils.ts`). Since login and the board are both server-backed, `playwright.config.ts`'s `webServer` builds and runs the real Docker image (`docker build .. && docker run ... -p 3000:8000`) rather than a frontend-only `next dev` server. `kanban.spec.ts` locates columns/cards by their rendered title/testid rather than hardcoded ids, since the database assigns its own ids independent of the old frontend demo's `col-backlog`-style ones. Run with `npm run test:e2e` (requires Docker running; downloads browsers once via `npx playwright install chromium`).
- `npm run test:all` runs both.

## Known gaps

- No AI chat sidebar yet (Parts 8-10).

## Running the e2e suite

`npm run test:e2e` builds and runs the real Docker image (see `playwright.config.ts`'s `webServer`), so it needs Docker running. Because `reuseExistingServer: true` is set, a container left over from a previous crashed/failed run (`pm-app-e2e`) will be reused instead of a fresh one — if a run looks like it's seeing stale or duplicated data, run `docker rm -f pm-app-e2e` first. `kanban.spec.ts` locates columns/cards by their rendered title/testid rather than hardcoded ids, since the database assigns its own ids. Note: `page.getByDisplayValue(...)` is a Testing Library method, not a Playwright one — to find a column by its current title, read `column.locator("input").first().inputValue()` instead (see `findColumnByTitle` in `kanban.spec.ts`).
