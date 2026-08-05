# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0]

### Added

- Cards can now be edited: clicking a card's title/details opens the same popup used for creating a card, pre-filled with its current title and details, and saves changes back through the API.
- A confirmation popup ("Delete card?") is now required before a card is actually deleted, showing the card's title so it's clear what's about to be removed.

### Changed

- The "Remove" text button on each card — which took up enough width to squeeze the title/details column narrow, especially at smaller sizes — is now a small trash icon sized to fit its icon only.
- Extracted the popup markup shared by card creation, card editing, and the delete confirmation into reusable `Modal`, `CardFormModal`, and `ConfirmModal` components.

## [1.1.0]

### Changed

- Adding a card now opens a centered modal (with a backdrop and Escape-to-close) instead of expanding an inline form within the column.

### Fixed

- E2E tests were intermittently failing under parallel execution: all specs share one real backend and database (there's no per-test server-side isolation), so tests that mutate the board could race each other. `playwright.config.ts` now runs the suite serially (`workers: 1`).

## [1.0.0]

### Added

- Single-board Kanban UI: five columns, drag-and-drop cards between and within columns, inline column renaming, and adding/removing cards (`@dnd-kit`).
- Login screen backed by the FastAPI JWT auth endpoints, with a client-side auth gate that shows the board only when signed in, plus a logout control.
- The board, its columns, and its cards are fetched from and persisted to the backend REST API (`GET /api/board`, `PATCH /api/columns/{id}`, `POST /api/cards`, `PATCH /api/cards/{id}`, `DELETE /api/cards/{id}`) instead of in-memory demo data — every change survives a page reload.
- Static export (`output: "export"`) built at Docker image build time and served by the FastAPI backend.
- Unit tests (Vitest + Testing Library) for the board, login form, and auth gate.
- End-to-end tests (Playwright) covering login (including rejecting bad credentials) and the full Kanban workflow — add, move, and reload-persistence — run against the real Docker container.
