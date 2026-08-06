from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.auth import router as auth_router
from app.board import router as board_router
from app.chat import router as chat_router
from app.db import Base, SessionLocal, engine
from app.seed import seed_default_user_and_board


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(engine)
    db = SessionLocal()
    try:
        seed_default_user_and_board(db)
    finally:
        db.close()
    yield


app = FastAPI(lifespan=lifespan)

app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(board_router, prefix="/api", tags=["board"])
app.include_router(chat_router, prefix="/api", tags=["chat"])


@app.get("/api/ping")
def ping():
    return {"status": "ok"}


static_dir = Path(__file__).resolve().parent.parent / "static"
app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")
