from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_ping():
    response = client.get("/api/ping")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_serves_kanban_board():
    response = client.get("/")
    assert response.status_code == 200
    assert "Kanban Studio" in response.text
