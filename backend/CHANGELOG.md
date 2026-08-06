# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0]

### Added

- `app/ai.py`: OpenRouter connectivity via the `openai` SDK (`ask(prompt)`), model `openai/gpt-oss-20b:free`, `OPENROUTER_API_KEY` read from the environment. No route yet — used directly by `test_ai.py`, which makes a real network call to confirm a "2+2" prompt gets back a reply containing "4".

## [1.0.0]

### Added

- FastAPI application serving the built frontend static export at `/` and the JSON API under `/api`.
- JWT-based auth: `POST /api/auth/login` (hardcoded `user`/`password` credentials), `POST /api/auth/logout`, `GET /api/auth/me`, backed by an httpOnly session cookie. `get_current_user` is a reusable dependency guarding every board route.
- SQLite persistence via SQLAlchemy: `User` → `Board` → `Column` → `Card` models matching `docs/schema.json`. Tables are created on startup if missing, and a default user/board/columns/cards are seeded once on a fresh database.
- Board CRUD API: `GET /api/board`, `PATCH /api/columns/{id}`, `POST /api/cards`, `PATCH /api/cards/{id}` (edit and/or move between columns, with correct position reordering), `DELETE /api/cards/{id}` — all scoped to the authenticated user's own board.
- `GET /api/ping` health-check endpoint.
- Test suite (pytest, run via `uv run pytest` inside Docker): auth flow, board CRUD happy paths, 404s for unowned/missing resources, auth rejection, and move/reorder correctness, all against an isolated in-memory SQLite database.
