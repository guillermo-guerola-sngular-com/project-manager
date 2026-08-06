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
  - Its route functions (`rename_column`, `create_card`, `update_card`, `delete_card`) are plain functions under FastAPI decorators — `app/chat.py` calls them directly (passing `db`/`username` explicitly, bypassing their `Depends(...)` defaults) so board-mutation logic lives in exactly one place.
- `app/ai.py` — OpenRouter connectivity, via the `openai` SDK pointed at `base_url="https://openrouter.ai/api/v1"`, model `openai/gpt-oss-20b:free`, `api_key` from `OPENROUTER_API_KEY` (read lazily per call, not at import time, so the app still starts without it set).
  - `ask(prompt)` — single-turn completion, no structured output (used by `test_ai.py`'s connectivity check).
  - `ask_structured(board, history, message)` — builds a system prompt containing the current board JSON and a JSON-only response contract, sends it plus `history`/`message` as chat turns, and parses the reply into a `ChatReply` (`reply: str`, `operations: list[Operation] | None`). `Operation` is a discriminated union (`rename_column`, `add_card`, `edit_card`, `move_card`, `delete_card`) matching the board CRUD routes one-for-one.
  - Deliberately does **not** use `response_format`/OpenAI Structured Outputs — empirically, `openai/gpt-oss-20b:free` on OpenRouter returns an empty `message.content` (all output stuck in the `reasoning` field) when `response_format={"type": "json_object"}` is combined with the board/schema instructions living in the system message. Putting those instructions in the system message *without* `response_format`, and the plain user message last, was reliable in manual testing; the code just prompts for "raw JSON, no markdown" and parses defensively.
  - `_parse_reply` is the defensive parser: strips a markdown code fence if present, then `ChatReply.model_validate_json`; any `ValidationError` (invalid JSON, wrong types, unknown `operations[].type`) falls back to `ChatReply(reply=<raw text>)` with no operations, so a malformed model response degrades to "the model said something we show verbatim" rather than a 500 or a corrupted board.
- `app/chat.py` — `POST /api/ai/chat`, behind `get_current_user`. Takes `{message, history}`, loads the caller's board, calls `ask_structured`, then applies each returned operation by calling the matching `app/board.py` function; an operation referencing a nonexistent column/card (`HTTPException` from the ownership lookup) is caught and skipped rather than aborting the rest of the batch. Responds `{reply, board_changed}` — `board_changed` is `true` iff at least one operation actually applied, telling the frontend whether to refetch.

## Persistence

SQLite file at `backend/data/app.db` inside the container. **`scripts/start.sh`/`start.ps1` bind-mount a `data/` folder from the project root to `/app/data`** — without that mount, the file would live only in the container's writable layer and be lost every time `scripts/stop` + `scripts/start` recreates the container. Don't run the image without that mount if persistence matters (e.g. the Playwright e2e `docker run` intentionally omits it, so every e2e run starts from a clean seeded board).

## Testing

`backend/tests/`, pytest (run via `uv run pytest`, only inside Docker — no local Python on this machine). `conftest.py` provides `client` (fresh in-memory SQLite via `StaticPool`, seeded, `get_db` overridden) and `auth_client` (same, pre-logged-in) fixtures — tests never touch the real `backend/data/app.db`. `test_main.py`, `test_auth.py`, `test_board.py` cover static serving, auth, and board CRUD (happy paths, 404s, auth rejection, reorder/move correctness) respectively. `test_ai_parsing.py` unit-tests `_parse_reply` directly (valid JSON, markdown-fenced JSON, each operation type, garbage text, an unknown `operations[].type`, `None` content) with no network involved. `test_chat.py` covers `POST /api/ai/chat` with `app.chat.ask_structured` monkeypatched to return a fixed `ChatReply`, checking each operation type is actually applied to the DB, a reply-only response leaves the board untouched, and an operation with an unknown id is skipped without a 500.

`test_ai.py` and `test_chat_real.py` intentionally hit the real OpenRouter API (no mocking) to prove connectivity — run the container with `--env-file .env` so `OPENROUTER_API_KEY` is present, e.g. `docker run --rm --env-file .env pm-app uv run pytest`. These occasionally fail transiently on a cold start of the free model (empty `message.content` on the first call after a period of inactivity) — a retry has resolved every observed instance so far; there is no retry logic in the test itself.
