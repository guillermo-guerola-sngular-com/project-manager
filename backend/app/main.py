from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.auth import router as auth_router

app = FastAPI()

app.include_router(auth_router, prefix="/api/auth", tags=["auth"])


@app.get("/api/ping")
def ping():
    return {"status": "ok"}


static_dir = Path(__file__).resolve().parent.parent / "static"
app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")
