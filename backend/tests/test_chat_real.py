def test_chat_real_rename_first_column(auth_client):
    board = auth_client.get("/api/board").json()
    first_column_title = board["columns"][0]["title"]

    response = auth_client.post(
        "/api/ai/chat",
        json={"message": f"Rename the first column, currently called '{first_column_title}', to 'Todo'."},
    )
    assert response.status_code == 200

    board_after = auth_client.get("/api/board").json()
    assert board_after["columns"][0]["title"] == "Todo"


def test_chat_real_plain_question_leaves_board_untouched(auth_client):
    board_before = auth_client.get("/api/board").json()

    response = auth_client.post("/api/ai/chat", json={"message": "What's the weather like today?"})
    assert response.status_code == 200
    assert response.json()["board_changed"] is False

    assert auth_client.get("/api/board").json() == board_before
