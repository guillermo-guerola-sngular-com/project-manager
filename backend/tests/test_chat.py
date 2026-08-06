import app.chat as chat_module
from app.ai import AddCardOp, ChatReply, DeleteCardOp, EditCardOp, MoveCardOp, RenameColumnOp


def test_chat_requires_auth(client):
    assert client.post("/api/ai/chat", json={"message": "hi"}).status_code == 401


def test_chat_reply_only_leaves_board_untouched(auth_client, monkeypatch):
    monkeypatch.setattr(chat_module, "ask_structured", lambda **kwargs: ChatReply(reply="Hi there"))

    board_before = auth_client.get("/api/board").json()
    response = auth_client.post("/api/ai/chat", json={"message": "hello"})

    assert response.status_code == 200
    assert response.json() == {"reply": "Hi there", "board_changed": False}
    assert auth_client.get("/api/board").json() == board_before


def test_chat_rename_column_operation(auth_client, monkeypatch):
    board = auth_client.get("/api/board").json()
    column_id = board["columns"][0]["id"]
    op = RenameColumnOp(type="rename_column", column_id=column_id, title="Todo")
    monkeypatch.setattr(chat_module, "ask_structured", lambda **kwargs: ChatReply(reply="Renamed", operations=[op]))

    response = auth_client.post("/api/ai/chat", json={"message": "rename first column to Todo"})

    assert response.json() == {"reply": "Renamed", "board_changed": True}
    board_after = auth_client.get("/api/board").json()
    assert board_after["columns"][0]["title"] == "Todo"


def test_chat_add_card_operation(auth_client, monkeypatch):
    board = auth_client.get("/api/board").json()
    column_id = board["columns"][0]["id"]
    op = AddCardOp(type="add_card", column_id=column_id, title="New card", details="from AI")
    monkeypatch.setattr(chat_module, "ask_structured", lambda **kwargs: ChatReply(reply="Added", operations=[op]))

    response = auth_client.post("/api/ai/chat", json={"message": "add a card"})

    assert response.json()["board_changed"] is True
    board_after = auth_client.get("/api/board").json()
    assert "New card" in [c["title"] for c in board_after["columns"][0]["cards"]]


def test_chat_edit_card_operation(auth_client, monkeypatch):
    board = auth_client.get("/api/board").json()
    card_id = board["columns"][0]["cards"][0]["id"]
    op = EditCardOp(type="edit_card", card_id=card_id, title="Edited")
    monkeypatch.setattr(chat_module, "ask_structured", lambda **kwargs: ChatReply(reply="Edited", operations=[op]))

    response = auth_client.post("/api/ai/chat", json={"message": "edit the first card"})

    assert response.json()["board_changed"] is True
    board_after = auth_client.get("/api/board").json()
    assert board_after["columns"][0]["cards"][0]["title"] == "Edited"


def test_chat_move_card_operation(auth_client, monkeypatch):
    board = auth_client.get("/api/board").json()
    card_id = board["columns"][0]["cards"][0]["id"]
    target_column_id = board["columns"][1]["id"]
    op = MoveCardOp(type="move_card", card_id=card_id, column_id=target_column_id, position=0)
    monkeypatch.setattr(chat_module, "ask_structured", lambda **kwargs: ChatReply(reply="Moved", operations=[op]))

    response = auth_client.post("/api/ai/chat", json={"message": "move the first card to the next column"})

    assert response.json()["board_changed"] is True
    board_after = auth_client.get("/api/board").json()
    assert card_id in [c["id"] for c in board_after["columns"][1]["cards"]]


def test_chat_delete_card_operation(auth_client, monkeypatch):
    board = auth_client.get("/api/board").json()
    card_id = board["columns"][0]["cards"][0]["id"]
    op = DeleteCardOp(type="delete_card", card_id=card_id)
    monkeypatch.setattr(chat_module, "ask_structured", lambda **kwargs: ChatReply(reply="Deleted", operations=[op]))

    response = auth_client.post("/api/ai/chat", json={"message": "delete the first card"})

    assert response.json()["board_changed"] is True
    board_after = auth_client.get("/api/board").json()
    assert card_id not in [c["id"] for c in board_after["columns"][0]["cards"]]


def test_chat_operation_with_unknown_id_is_skipped_without_crashing(auth_client, monkeypatch):
    op = RenameColumnOp(type="rename_column", column_id=999999, title="Nope")
    monkeypatch.setattr(chat_module, "ask_structured", lambda **kwargs: ChatReply(reply="ok", operations=[op]))

    board_before = auth_client.get("/api/board").json()
    response = auth_client.post("/api/ai/chat", json={"message": "rename a column that doesn't exist"})

    assert response.status_code == 200
    assert response.json()["board_changed"] is False
    assert auth_client.get("/api/board").json() == board_before
