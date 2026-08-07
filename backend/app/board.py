from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import board_service
from app.auth import get_current_user
from app.board_service import BoardOut, CardOut, ColumnOut
from app.db import get_db

router = APIRouter()


class RenameColumnRequest(BaseModel):
    title: str


class CreateCardRequest(BaseModel):
    column_id: int
    title: str
    details: str = ""


class UpdateCardRequest(BaseModel):
    title: str | None = None
    details: str | None = None
    column_id: int | None = None
    position: int | None = None


@router.get("/board", response_model=BoardOut)
def get_board(db: Session = Depends(get_db), username: str = Depends(get_current_user)):
    board = board_service.get_user_board(db, username)
    return board_service.board_to_out(db, board)


@router.patch("/columns/{column_id}", response_model=ColumnOut)
def rename_column(
    column_id: int,
    body: RenameColumnRequest,
    db: Session = Depends(get_db),
    username: str = Depends(get_current_user),
):
    board = board_service.get_user_board(db, username)
    column = board_service.rename_column(db, board, column_id, body.title)
    return board_service.column_to_out(db, column)


@router.post("/cards", response_model=CardOut, status_code=201)
def create_card(
    body: CreateCardRequest,
    db: Session = Depends(get_db),
    username: str = Depends(get_current_user),
):
    board = board_service.get_user_board(db, username)
    card = board_service.create_card(db, board, body.column_id, body.title, body.details)
    return board_service.card_to_out(card)


@router.patch("/cards/{card_id}", response_model=CardOut)
def update_card(
    card_id: int,
    body: UpdateCardRequest,
    db: Session = Depends(get_db),
    username: str = Depends(get_current_user),
):
    board = board_service.get_user_board(db, username)
    card = board_service.update_card(
        db,
        board,
        card_id,
        title=body.title,
        details=body.details,
        column_id=body.column_id,
        position=body.position,
    )
    return board_service.card_to_out(card)


@router.delete("/cards/{card_id}", status_code=204)
def delete_card(
    card_id: int,
    db: Session = Depends(get_db),
    username: str = Depends(get_current_user),
):
    board = board_service.get_user_board(db, username)
    board_service.delete_card(db, board, card_id)
