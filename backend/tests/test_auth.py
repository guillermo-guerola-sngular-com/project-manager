from fastapi.testclient import TestClient

from app.main import app


def test_login_success():
    client = TestClient(app)
    response = client.post("/api/auth/login", json={"username": "user", "password": "password"})
    assert response.status_code == 200
    assert "session" in response.cookies


def test_login_failure():
    client = TestClient(app)
    response = client.post("/api/auth/login", json={"username": "user", "password": "wrong"})
    assert response.status_code == 401


def test_me_requires_auth():
    client = TestClient(app)
    response = client.get("/api/auth/me")
    assert response.status_code == 401


def test_me_after_login():
    client = TestClient(app)
    client.post("/api/auth/login", json={"username": "user", "password": "password"})
    response = client.get("/api/auth/me")
    assert response.status_code == 200
    assert response.json() == {"username": "user"}


def test_logout_clears_session():
    client = TestClient(app)
    client.post("/api/auth/login", json={"username": "user", "password": "password"})
    client.post("/api/auth/logout")
    response = client.get("/api/auth/me")
    assert response.status_code == 401
