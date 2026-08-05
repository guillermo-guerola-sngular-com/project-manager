# Database

## Engine

SQLite, per AGENTS.md. Single file, e.g. `backend/data/app.db` (path configurable, created on startup if missing — no separate provisioning step).

## Access approach

SQLAlchemy Core/ORM models mirroring `docs/schema.json` exactly (one model per table, same columns/constraints). No separate migration tool (Alembic, etc.) for the MVP: on startup, the backend calls `Base.metadata.create_all(engine)`, which creates any missing tables and leaves existing ones untouched. If the schema needs to change later, the simplest MVP-consistent path is deleting the local `.db` file and letting it regenerate — acceptable because this is a local single-instance app, not a shared production database.

## Seeding

On startup, after `create_all`:
1. If no row exists in `users` for username `"user"`, insert one (with a hashed password — see note below).
2. If that user has no row in `boards`, create one, then create the 5 default columns (Backlog, Discovery, In Progress, Review, Done) and the 8 sample cards currently hardcoded in the frontend's `initialData` (`frontend/src/lib/kanban.ts`), so a fresh database starts with the same demo content as today's in-memory version.

This seeding only ever runs once per fresh database — it checks for existing rows first, so restarting the app never duplicates data.

## Reconciling with Part 4's hardcoded login

Part 4's `/api/auth/login` checks credentials against literal strings (`"user"` / `"password"`) in `backend/app/auth.py`, not against the `users` table — that stays as-is for the MVP; it's simple and matches AGENTS.md's stated limitation ("hardcoded to 'user' and 'password'"). The `users` table (with `password_hash`) exists so the schema doesn't need to change if real multi-user auth is added post-MVP — but until then, `password_hash` is written (using a real hash of `"password"`, via `passlib` or Python's `hashlib`) at seed time and simply isn't read by the login check yet. Flagging this explicitly since it's a bit of documented-but-currently-unused schema, not an oversight.

## Relationships

`users (1) -> (1) boards` (unique `user_id` enforces one board per user, per the MVP limitation) `-> (many) columns -> (many) cards`. Foreign keys cascade on delete so removing a board cleans up its columns and cards automatically — not exercised by any planned feature yet, but cheap referential-integrity hygiene.

## Ordering

`columns.position` and `cards.position` are explicit 0-based integers rather than relying on row insertion order, since the API needs to persist drag-and-drop order deterministically (Part 6/7). Moving a card between columns updates both `column_id` and `position`; reordering within a column only updates `position`.
