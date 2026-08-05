# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0]

### Added

- Single-board Kanban UI: five columns, drag-and-drop cards between and within columns, inline column renaming, and adding/removing cards (`@dnd-kit`).
- Login screen backed by the FastAPI JWT auth endpoints, with a client-side auth gate that shows the board only when signed in, plus a logout control.
- The board, its columns, and its cards are fetched from and persisted to the backend REST API (`GET /api/board`, `PATCH /api/columns/{id}`, `POST /api/cards`, `PATCH /api/cards/{id}`, `DELETE /api/cards/{id}`) instead of in-memory demo data — every change survives a page reload.
- Static export (`output: "export"`) built at Docker image build time and served by the FastAPI backend.
- Unit tests (Vitest + Testing Library) for the board, login form, and auth gate.
- End-to-end tests (Playwright) covering login (including rejecting bad credentials) and the full Kanban workflow — add, move, and reload-persistence — run against the real Docker container.
