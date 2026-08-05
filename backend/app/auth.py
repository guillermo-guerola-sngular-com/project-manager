import secrets
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import APIRouter, Cookie, Depends, HTTPException, Response
from pydantic import BaseModel

SECRET_KEY = secrets.token_hex(32)
ALGORITHM = "HS256"
COOKIE_NAME = "session"
TOKEN_TTL = timedelta(hours=24)

USERNAME = "user"
PASSWORD = "password"

router = APIRouter()


class Credentials(BaseModel):
    username: str
    password: str


def create_token(username: str) -> str:
    expires_at = datetime.now(timezone.utc) + TOKEN_TTL
    return jwt.encode({"sub": username, "exp": expires_at}, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(session: str | None = Cookie(default=None)) -> str:
    if session is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(session, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    return payload["sub"]


@router.post("/login")
def login(credentials: Credentials, response: Response):
    if credentials.username != USERNAME or credentials.password != PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    response.set_cookie(
        key=COOKIE_NAME,
        value=create_token(credentials.username),
        httponly=True,
        samesite="lax",
        max_age=int(TOKEN_TTL.total_seconds()),
    )
    return {"username": credentials.username}


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(COOKIE_NAME)
    return {"status": "ok"}


@router.get("/me")
def me(username: str = Depends(get_current_user)):
    return {"username": username}
