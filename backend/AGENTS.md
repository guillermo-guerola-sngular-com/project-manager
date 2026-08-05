# Backend

FastAPI + SQLAlchemy 2.0 (typed ORM style), served by `uv`. Serves the built frontend as static files and the JSON API under `/api`.

## Structure

- `app/main.py` — app setup: `lifespan` creates tables (`Base.metadata.create_all`) and runs the seed on startup, includes the auth and board routers, defines `GET /api/ping`, mounts `../static` (the frontend's static export) at `/`.
- `app/auth.py` — hardcoded `user`/`password` check, JWT issue/verify (HS256, secret generated fresh at process startup — restarting the server invalidates existing sessions, which is fine for the MVP). `router` provides `POST /login`, `POST /logout`, `GET /me`. `get_current_user` is the reusable auth dependency (reads the `session` httpOnly cookie); every board route depends on it.
- `app/db.py` — SQLite engine/session setup. `DATABASE_PATH` is `backend/data/app.db`; `get_db()` is the per-request session dependency.
- `app/models.py` — SQLAlchemy models matching `docs/schema.json` exactly: `User` (1) -> `Board` (1, unique `user_id`) -> `Column` (many) -> `Card` (many). Cascade deletes configured but not yet exercised by any route.
- `app/seed.py` — `seed_default_user_and_board`: on a fresh database, creates the `user` row and seeds one board with the same 5 columns / 8 cards as the frontend's original `initialData` demo content. Only runs once — checks for existing rows first, so restarts never duplicate data.
- `app/board.py` — board CRUD, all routes behind `get_current_user`:
  - `GET /api/board` — full board (columns with nested cards, ordered by `position`)
  - `PATCH /api/columns/{id}` — rename
  - `POST /api/cards` — create (appended to end of the column)
  - `PATCH /api/cards/{id}` — edit `title`/`details`, and/or move via `column_id`/`position`
  - `DELETE /api/cards/{id}`
  - Ownership is enforced: columns/cards are looked up scoped to the current user's board, so `404` (not someone else's data) is returned for ids outside it. `_insert_at_position`/`_compact_positions` keep `position` values contiguous (0-based) after a move, matching the reordering semantics the frontend demo already had client-side.

## Persistence

SQLite file at `backend/data/app.db` inside the container. **`scripts/start.sh`/`start.ps1` bind-mount a `data/` folder from the project root to `/app/data`** — without that mount, the file would live only in the container's writable layer and be lost every time `scripts/stop` + `scripts/start` recreates the container. Don't run the image without that mount if persistence matters (e.g. the Playwright e2e `docker run` intentionally omits it, so every e2e run starts from a clean seeded board).

## Testing

`backend/tests/`, pytest (run via `uv run pytest`, only inside Docker — no local Python on this machine). `conftest.py` provides `client` (fresh in-memory SQLite via `StaticPool`, seeded, `get_db` overridden) and `auth_client` (same, pre-logged-in) fixtures — tests never touch the real `backend/data/app.db`. `test_main.py`, `test_auth.py`, `test_board.py` cover static serving, auth, and board CRUD (happy paths, 404s, auth rejection, reorder/move correctness) respectively.
