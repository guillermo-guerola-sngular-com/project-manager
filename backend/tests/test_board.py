def test_get_board_requires_auth(client):
    response = client.get("/api/board")
    assert response.status_code == 401


def test_get_board_returns_seeded_columns(auth_client):
    response = auth_client.get("/api/board")
    assert response.status_code == 200
    data = response.json()
    assert [c["title"] for c in data["columns"]] == [
        "Backlog",
        "Discovery",
        "In Progress",
        "Review",
        "Done",
    ]
    assert data["columns"][0]["cards"][0]["title"] == "Align roadmap themes"


def test_rename_column(auth_client):
    board = auth_client.get("/api/board").json()
    column_id = board["columns"][0]["id"]

    response = auth_client.patch(f"/api/columns/{column_id}", json={"title": "Todo"})
    assert response.status_code == 200
    assert response.json()["title"] == "Todo"


def test_rename_column_not_found(auth_client):
    response = auth_client.patch("/api/columns/999999", json={"title": "Nope"})
    assert response.status_code == 404


def test_create_card(auth_client):
    board = auth_client.get("/api/board").json()
    column_id = board["columns"][0]["id"]

    response = auth_client.post(
        "/api/cards", json={"column_id": column_id, "title": "New card", "details": "Notes"}
    )
    assert response.status_code == 201
    assert response.json()["title"] == "New card"

    board_after = auth_client.get("/api/board").json()
    titles = [c["title"] for c in board_after["columns"][0]["cards"]]
    assert "New card" in titles


def test_create_card_column_not_found(auth_client):
    response = auth_client.post("/api/cards", json={"column_id": 999999, "title": "x"})
    assert response.status_code == 404


def test_update_card_fields(auth_client):
    board = auth_client.get("/api/board").json()
    card_id = board["columns"][0]["cards"][0]["id"]

    response = auth_client.patch(
        f"/api/cards/{card_id}", json={"title": "Renamed", "details": "Updated"}
    )
    assert response.status_code == 200
    assert response.json() == {"id": card_id, "title": "Renamed", "details": "Updated"}


def test_update_card_not_found(auth_client):
    response = auth_client.patch("/api/cards/999999", json={"title": "x"})
    assert response.status_code == 404


def test_move_card_between_columns_updates_ordering(auth_client):
    board = auth_client.get("/api/board").json()
    backlog = board["columns"][0]
    review = next(c for c in board["columns"] if c["title"] == "Review")
    card_id = backlog["cards"][0]["id"]

    response = auth_client.patch(
        f"/api/cards/{card_id}", json={"column_id": review["id"], "position": 0}
    )
    assert response.status_code == 200

    board_after = auth_client.get("/api/board").json()
    backlog_after = board_after["columns"][0]
    review_after = next(c for c in board_after["columns"] if c["title"] == "Review")

    assert card_id not in [c["id"] for c in backlog_after["cards"]]
    assert review_after["cards"][0]["id"] == card_id
    assert len(backlog_after["cards"]) == len(backlog["cards"]) - 1
    # remaining backlog cards keep contiguous 0-based positions (no gaps left behind)
    assert [c["id"] for c in backlog_after["cards"]] == [c["id"] for c in backlog["cards"][1:]]


def test_reorder_card_within_column(auth_client):
    board = auth_client.get("/api/board").json()
    backlog = board["columns"][0]
    first_card_id = backlog["cards"][0]["id"]
    second_card_id = backlog["cards"][1]["id"]

    response = auth_client.patch(f"/api/cards/{first_card_id}", json={"position": 1})
    assert response.status_code == 200

    board_after = auth_client.get("/api/board").json()
    backlog_after = board_after["columns"][0]
    assert [c["id"] for c in backlog_after["cards"]] == [second_card_id, first_card_id]


def test_delete_card(auth_client):
    board = auth_client.get("/api/board").json()
    card_id = board["columns"][0]["cards"][0]["id"]

    response = auth_client.delete(f"/api/cards/{card_id}")
    assert response.status_code == 204

    board_after = auth_client.get("/api/board").json()
    ids = [c["id"] for c in board_after["columns"][0]["cards"]]
    assert card_id not in ids


def test_delete_card_not_found(auth_client):
    response = auth_client.delete("/api/cards/999999")
    assert response.status_code == 404


def test_mutations_require_auth(client):
    assert client.post("/api/cards", json={"column_id": 1, "title": "x"}).status_code == 401
    assert client.patch("/api/columns/1", json={"title": "x"}).status_code == 401
    assert client.patch("/api/cards/1", json={"title": "x"}).status_code == 401
    assert client.delete("/api/cards/1").status_code == 401
