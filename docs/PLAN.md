# High level steps for project

Part 1: Plan

Enrich this document to plan out each of these parts in detail, with substeps listed out as a checklist to be checked off by the agent, and with tests and success critieria for each. Also create an AGENTS.md file inside the frontend directory that describes the existing code there. Ensure the user checks and approves the plan.

**Decisions locked in for this plan:**
- Frontend is served by FastAPI as a Next.js static export (`output: "export"`), not a Node server.
- Auth uses a JWT (issued on login against the hardcoded `user`/`password`, sent by the client on subsequent requests).
- `backend/AGENTS.md` and `scripts/AGENTS.md` stay as placeholder stubs until the parts that populate those directories (Parts 2 and 6) land.

- [x] Enrich `docs/PLAN.md` with per-part checklists, tests, and success criteria
- [x] Create `frontend/AGENTS.md` describing the existing frontend code
- [ ] User approves this plan before Part 2 starts

**Tests:** none (planning only).
**Success criteria:** user explicitly approves this plan.

---

Part 2: Scaffolding

Set up the Docker infrastructure, the backend in backend/ with FastAPI, and write the start and stop scripts in the scripts/ directory. This should serve example static HTML to confirm that a 'hello world' example works running locally and also make an API call.

- [x] Initialize `backend/` as a `uv`-managed Python project (`pyproject.toml`; `uv.lock` is generated inside the Docker build)
- [x] Minimal FastAPI app (`backend/app/main.py`) with:
  - [x] `GET /api/ping` returning a small JSON payload (e.g. `{"status": "ok"}`)
  - [x] `GET /` serving a static placeholder HTML page (plain file, not the real frontend yet)
- [x] Placeholder HTML page includes a small script that calls `/api/ping` and renders the result, proving frontend-to-backend wiring
- [x] `Dockerfile` at project root: Python base image, install deps with `uv`, copy backend, expose port, run with `uvicorn`
- [x] `.dockerignore` covering `node_modules`, `__pycache__`, `.venv`, `frontend/.next`, `frontend/out`, test artifacts
- [x] `scripts/start.sh` (Mac/Linux) and `scripts/start.ps1` (Windows): build image if needed, run container, print the URL
- [x] `scripts/stop.sh` and `scripts/stop.ps1`: stop/remove the running container
- [x] Container reads `OPENROUTER_API_KEY` from the root `.env` (not needed yet functionally, just confirm it's passed through, e.g. via `--env-file`)

**Tests:**
- `docker build` completes without errors
- After `scripts/start`, `curl http://localhost:<port>/` returns the placeholder HTML
- `curl http://localhost:<port>/api/ping` returns the expected JSON
- `scripts/stop` stops the container cleanly; re-running `scripts/start` works again

**Success criteria:** a fresh clone can run `scripts/start` (or the OS-appropriate equivalent), open the printed URL, see "hello world" HTML that itself displays a successful API call result, then run `scripts/stop`.

---

Part 3: Add in Frontend

Now update so that the frontend is statically built and served, so that the app has the demo Kanban board displayed at /. Comprehensive unit and integration tests.

- [x] Add `output: "export"` to `frontend/next.config.ts`
- [x] Update `Dockerfile` to a multi-stage build: Node stage runs `npm ci && npm run build` producing `frontend/out`, final Python stage copies that output into the backend image
- [x] FastAPI serves `frontend/out` as static files at `/` (and its assets), replacing the Part 2 placeholder page
- [x] Remove the Part 2 placeholder HTML once the real build is wired in
- [x] Confirm the existing frontend unit tests (`npm run test:unit`) still pass unmodified — no backend dependency yet, board state is still in-memory
- [x] Add a backend integration test that starts the app (via FastAPI `TestClient`) and asserts `GET /` returns HTML containing the Kanban page's heading

**Tests:**
- `npm run test:unit` (frontend, unchanged) passes
- New backend integration test asserting `/` serves the built Kanban page
- Manual/e2e: `docker build` + `scripts/start`, browse to `/`, confirm the Kanban board renders with drag-and-drop working (still in-memory, resets on reload — expected at this stage)

**Success criteria:** the dockerized app serves the real Kanban demo at `/`, indistinguishable in the browser from the standalone frontend demo today.

---

Part 4: Add in a fake user sign in experience

Now update so that on first hitting /, you need to log in with dummy credentials ("user", "password") in order to see the Kanban, and you can log out. Comprehensive tests.

- [x] Backend: `POST /api/auth/login` — validates hardcoded `user`/`password`, returns a signed JWT (secret generated at process startup)
- [x] Backend: `POST /api/auth/logout` — clears the client's session (deletes the cookie)
- [x] Backend: `GET /api/auth/me` — returns 200 if the JWT is valid, 401 otherwise; used by the frontend to decide whether to show the board or the login form
- [x] Backend: dependency/guard (`get_current_user`) applied now, ready to be reused by the Kanban API routes in Part 6
- [x] Frontend: login form (username/password fields, submit calls `/api/auth/login`)
- [x] Frontend: on load, call `/api/auth/me`; show login form if unauthenticated, Kanban board if authenticated (client-side gating, since the page is a static export)
- [x] Frontend: logout control visible when authenticated, calls `/api/auth/logout` and returns to the login form
- [x] JWT storage on the client: httpOnly cookie set by the backend (preferred over localStorage to avoid exposing the token to JS)

**Tests:**
- [x] Backend unit tests (`backend/tests/test_auth.py`): login with correct/incorrect credentials, `/api/auth/me` with valid/missing token, logout clears the session — 5/5 passing in Docker
- [x] Frontend unit tests (`LoginForm.test.tsx`, `AppShell.test.tsx`): login form validation, shows board after successful login, shows login form again after logout — passing
- [x] Manually verified in-browser against the real Docker container: wrong credentials → error, correct credentials → board, reload → session persists, logout → back to login form
- [ ] E2E (Playwright, `tests/auth.spec.ts` + updated `tests/kanban.spec.ts`) — written, not yet executed (deferred by the user; `playwright.config.ts` now builds/runs the real Docker image since login needs the backend)

**Success criteria:** the Kanban board is never visible without first logging in with `user`/`password`; logging out returns to the login form; wrong credentials are rejected with a visible error. Met, confirmed via automated backend/frontend tests plus a manual browser pass; e2e coverage is written but still pending an actual run.

---

Part 5: Database modeling

Now propose a database schema for the Kanban, saving it as JSON. Document the database approach in docs/ and get user sign off.

- [x] Design schema: `users`, `boards` (one per user for MVP, schema allows more later), `columns` (ordered, belongs to a board), `cards` (belongs to a column, ordered within it)
- [x] Save the schema as `docs/schema.json` (tables, columns, types, keys/relationships)
- [x] Write `docs/DATABASE.md`: chosen engine (SQLite), access approach (e.g. SQLAlchemy models vs. raw `sqlite3`), migration strategy (create-tables-if-missing on startup — no formal migration tool needed for MVP), and how the hardcoded user's board is seeded on first run
- [x] Present schema + doc to the user for explicit sign-off

**Tests:** none (design/documentation only).

**Success criteria:** user approves `docs/schema.json` and `docs/DATABASE.md` before Part 6 begins. Approved.

---

Part 6: Backend

Now add API routes to allow the backend to read and change the Kanban for a given user; test this thoroughly with backend unit tests. The database should be created if it doesn't exist.

- [x] Implement models per the approved schema; create the SQLite DB file and tables on startup if missing
- [x] Seed the hardcoded user's default board (columns + sample cards) on first run only
- [x] `GET /api/board` — full board (columns + cards) for the current user
- [x] `PATCH /api/columns/{id}` — rename a column
- [x] `POST /api/cards` — create a card in a column
- [x] `PATCH /api/cards/{id}` — edit card fields and/or move it to another column/position
- [x] `DELETE /api/cards/{id}` — remove a card
- [x] All routes above require a valid JWT (reuse the Part 4 guard); unauthenticated requests get 401
- [x] Fill in `backend/AGENTS.md` with a real description of the backend code (routes, models, DB access) now that it exists
- [x] (Added, not originally listed) Bind-mount `data/` in `scripts/start.sh`/`start.ps1` — without it, the container's writable layer would discard the SQLite file on every restart, silently failing the persistence success criterion below

**Tests:**
- [x] Pytest suite (`backend/tests/test_board.py`, in-memory `StaticPool` test DB, not the real one) covering: each route's happy path, auth rejection without a token, not-found handling for missing column/card ids, and that card moves/reorders update ordering correctly — 20/20 backend tests passing in Docker
- [x] Restart-persistence check: logged in, created a card via the real `/api/cards` endpoint against the running container, ran `scripts/stop` + `scripts/start`, logged in again (JWT secret regenerates on restart so the old session cookie no longer validates — expected), confirmed the card was still on the board

**Success criteria:** every board mutation is persisted in SQLite and survives a server restart; all backend tests pass; routes are rejected without a valid JWT. Met.

---

Part 7: Frontend + Backend

Now have the frontend actually use the backend API, so that the app is a proper persistent Kanban board. Test very throughly.

- [x] Replace the frontend's in-memory `initialData` state with data fetched from `GET /api/board` on load
- [x] Wire rename column, add card, delete card, and drag-and-drop move to call the corresponding Part 6 API routes
- [x] Reconcile local UI state with the server response after each mutation — went with the "apply directly" half of the option (optimistic local update immediately, background API call, error banner on failure rather than rollback — no refetch-after-every-mutation, to keep drag feeling instant)
- [x] Minimal loading state while the initial board fetch is in flight; no elaborate error UI beyond what's needed to not silently fail

**Tests:**
- [x] Frontend unit tests updated to mock the API layer for each interaction (rename, add, delete) — `KanbanBoard.test.tsx`, `AppShell.test.tsx` — 11/11 passing
- [x] Backend tests from Part 6 remain green — 20/20 passing in Docker after the frontend changes (frontend and backend are independently testable; this just confirms nothing backend-side regressed)
- [x] Playwright e2e run against the full dockerized stack — 6/6 passing (`auth.spec.ts` x3, `kanban.spec.ts` x3 including the drag-and-drop move-and-reload test). Fixed two real bugs found in the specs along the way (not app bugs): `page.getByRole("alert")` collided with Next.js's own route-announcer element (also `role="alert"`) — switched to `getByText(/invalid username or password/i)`; `page.getByDisplayValue(...)` doesn't exist in Playwright's API (that's a Testing Library method) — replaced with a small helper that finds a column by reading each title input's live `.inputValue()`. Also hit `reuseExistingServer: true` picking up an orphaned `pm-app-e2e` container from an earlier failed run, which made a later run look like it double-created a card — removing the stray container fixed it; worth remembering if a future run looks flaky (`docker rm -f pm-app-e2e` before re-running).
- [x] Manual verification in-browser against the real container: logged in, renamed a column, added a card, deleted a card, reloaded — all three persisted correctly

**Success criteria:** any change made in the UI (rename, add, delete, move) survives a full page reload, because it round-trips through the backend and SQLite. Fully verified — manually for rename/add/delete, and via the Playwright e2e suite (real mouse-driven drag) for move.

---

Additional work (requested by the user after Part 7, before starting Part 8)

These weren't in the original 10 parts — they came from direct user feedback on the running app. Documented here so the plan stays a complete record of what's been built and why, even though they don't map onto Part 8/9/10's numbering.

### Card editing popup, trash icon, and delete confirmation

Requested: a way to edit existing cards (reusing the same popup used for creation), replace the wide "Remove" text button with a small trash icon (it was squeezing the title/details column narrow), and require confirmation before a card is actually deleted.

- [x] Extracted `Modal` (shared overlay/dialog shell), `CardFormModal` (the title/details form — the same component now used for both create and edit, distinguished only by props), and `ConfirmModal` (generic confirm/cancel) as reusable components
- [x] Clicking a card's title opens `CardFormModal` in edit mode, pre-filled, saving via the existing `PATCH /api/cards/{id}`
- [x] Replaced the "Remove" text button with a small trash-icon button (inline SVG, no new dependency)
- [x] Deleting now opens `ConfirmModal` ("Delete card?", showing the card's title) before calling `DELETE /api/cards/{id}`
- [x] Follow-up fix: the trash icon and the description were still in the same flex row, so the row's height (and the icon's reserved column) was set by the description's full height, capping its width. Split into two blocks: a header row (title + trash icon, sized to the title only) and the description as a separate full-width block below.
- [x] No backend changes — editing and deleting already used the existing `PATCH`/`DELETE` endpoints from Part 6

**Tests:** unit tests for edit/confirm-delete in `KanbanBoard.test.tsx`; e2e coverage in `kanban.spec.ts` (edit via popup, cancel-then-confirm delete). Found and fixed a locator bug along the way: dnd-kit gives each card's outer `<article>` `role="button"` too (for keyboard drag), and its computed accessible name contains the inner Edit/Delete buttons' names — a fuzzy `getByRole` name match resolves to both, so these use `exact: true`.

**Success criteria:** met — verified manually against the real container (edit, cancel delete, confirm delete) and via 11/11 unit + 7/7 e2e tests. Frontend bumped to `1.1.0` (popup) → `1.2.0` (edit/trash/confirm) → `1.2.1` (layout fix). No backend version change.

### Drag-and-drop reliability fix

Reported: the column-drop highlight didn't always appear, dropping a card onto a column sometimes didn't move it, and reordering cards within a column rarely worked.

Root causes, all in `KanbanBoard.tsx`'s `DndContext` setup:
- `closestCorners` collision detection could resolve to a card in a neighboring column instead of the column being hovered, so the column never registered as the drop target (missing highlight, drops that silently did nothing).
- A plain pointer-based check over a non-empty column resolved to the *column* rather than the specific card under the pointer, so `moveCard` always appended to the end instead of inserting at that position — the real cause of same-column reordering being unreliable.
- The refined per-card check could match the dragged card's own (pointer-following) rect as its closest collision, making a real drop look like "no move" (`active.id === over.id`).
- An intermediate fix mutated `board` on every `dragover` event, which reshuffled the DOM mid-gesture and shifted the very rects collision detection measures against, causing moves to thrash/undo themselves — reverted in favor of the design below.

- [x] Custom `collisionDetectionStrategy`: `pointerWithin` (falling back to `rectIntersection`), refined by narrowing a column-level collision down to the closest actual card via `closestCenter`, explicitly excluding the dragged card itself from that refinement
- [x] Column highlight decoupled from board data: a dedicated `overColumnId` state, updated on every `dragover`, drives the highlight; `board` itself is only mutated once, in `onDragEnd`
- [x] Added an e2e test for same-column reordering (`kanban.spec.ts`)

**Tests:** all 11 unit tests pass. e2e: cross-column move now passes reliably (was previously intermittent). Same-column reordering **could not be confirmed** via this session's automated browser tooling — Playwright's synthetic drag didn't reliably trigger the drop for this specific gesture even after several rounds of fixes and mouse-choreography adjustments, and the in-session interactive browser tool requires the user to have its pane open to perform a real drag, which wasn't the case this session. The underlying logic (`moveCard`) is unit-tested and is the same code path already proven for cross-column moves, but this specific scenario is flagged as unverified in `frontend/AGENTS.md`'s Known Gaps.

**Success criteria:** highlight and cross-column drop are fixed and verified. Same-column reorder is implemented and believed fixed (same root-cause fixes apply) but **pending manual confirmation by the user** — asked directly, awaiting their test. Frontend bumped to `1.2.2`. No backend version change.

---

Part 8: AI connectivity

Now allow the backend to make an AI call via OpenRouter. Test connectivity with a simple "2+2" test and ensure the AI call is working.

- [ ] Backend OpenRouter client using `OPENROUTER_API_KEY` from `.env` and model `openai/gpt-oss-20b:free`
- [ ] `POST /api/ai/ping` (or equivalent internal call exercised by a test) that sends a simple prompt like "What is 2+2? Answer with only the number." and returns the model's reply

**Tests:**
- Backend test that calls the real OpenRouter API (this one intentionally hits the network — no mocking, since the goal is to prove connectivity) and asserts the reply contains "4"

**Success criteria:** a real round trip to OpenRouter succeeds and returns a correct answer to the arithmetic check.

---

Part 9: Structured AI responses over the Kanban board

Now extend the backend call so that it always calls the AI with the JSON of the Kanban board, plus the user's question (and conversation history). The AI should respond with Structured Outputs that includes the response to the user and optionaly an update to the Kanban. Test thoroughly.

- [ ] Define the structured output schema: `reply` (string, always present) and `board_update` (optional; a small set of typed operations — e.g. rename column, add card, edit card, move card, delete card — rather than requiring the model to emit the entire board back)
- [ ] `POST /api/ai/chat` accepting `{ message, history }`; backend assembles a system prompt containing the current board JSON, the conversation history, and the user's message, then calls OpenRouter with the structured output schema enforced
- [ ] Apply any returned `board_update` operations using the Part 6 CRUD logic (don't duplicate persistence logic)
- [ ] Response includes both the `reply` text and enough info for the frontend to know the board changed

**Tests:**
- Unit tests with a mocked OpenRouter response to verify: parsing of `reply`-only responses, parsing and correct DB application of each `board_update` operation type, and that malformed/unexpected model output doesn't corrupt the board
- One real-call test (network, like Part 8) using a simple instruction such as "rename the first column to Todo" and asserting the column is actually renamed in the DB afterward

**Success criteria:** chatting with an instruction that implies a board change actually mutates the SQLite board and returns a sensible confirmation message; a plain question with no board change leaves the board untouched.

---

Part 10: AI chat sidebar UI

Now add a beautiful sidebar widget to the UI supporting full AI chat, and allowing the LLM (as it determines) to update the Kanban based on its Structured Outputs. If the AI updates the Kanban, then the UI should refresh automatically.

- [ ] Sidebar component: scrollable message history, text input, send button, styled per the project color scheme
- [ ] Sends `{ message, history }` to `POST /api/ai/chat`, appends the AI's `reply` to the message history
- [ ] When the response indicates a `board_update` was applied, refetch `GET /api/board` (or apply the update client-side) so the Kanban view refreshes without a manual page reload
- [ ] Sidebar is available alongside the board once the user is logged in; hidden on the login screen

**Tests:**
- Frontend unit tests: sending a message renders the reply, board-refresh is triggered only when a `board_update` was present
- E2E: log in, send a chat instruction that changes the board (e.g. "add a card called X to the Backlog column"), confirm the card appears on the board without a manual reload

**Success criteria:** a user can converse with the AI in the sidebar and watch the Kanban board update live when the AI decides to change it, with no manual refresh needed.
