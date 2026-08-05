from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.db import get_db
from app.models import Board, Card, Column, User

router = APIRouter()


class CardOut(BaseModel):
    id: int
    title: str
    details: str


class ColumnOut(BaseModel):
    id: int
    title: str
    cards: list[CardOut]


class BoardOut(BaseModel):
    columns: list[ColumnOut]


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


def _get_user_board(db: Session, username: str) -> Board:
    user = db.query(User).filter(User.username == username).first()
    if user is None or user.board is None:
        raise HTTPException(status_code=404, detail="Board not found")
    return user.board


def _get_owned_column(db: Session, board: Board, column_id: int) -> Column:
    column = (
        db.query(Column)
        .filter(Column.id == column_id, Column.board_id == board.id)
        .first()
    )
    if column is None:
        raise HTTPException(status_code=404, detail="Column not found")
    return column


def _get_owned_card(db: Session, board: Board, card_id: int) -> Card:
    card = (
        db.query(Card)
        .join(Column)
        .filter(Card.id == card_id, Column.board_id == board.id)
        .first()
    )
    if card is None:
        raise HTTPException(status_code=404, detail="Card not found")
    return card


def _card_out(card: Card) -> CardOut:
    return CardOut(id=card.id, title=card.title, details=card.details)


def _column_out(db: Session, column: Column) -> ColumnOut:
    cards = db.query(Card).filter(Card.column_id == column.id).order_by(Card.position).all()
    return ColumnOut(id=column.id, title=column.title, cards=[_card_out(c) for c in cards])


def _insert_at_position(db: Session, column_id: int, moving_card: Card, position: int | None) -> None:
    siblings = (
        db.query(Card)
        .filter(Card.column_id == column_id, Card.id != moving_card.id)
        .order_by(Card.position)
        .all()
    )
    index = len(siblings) if position is None else max(0, min(position, len(siblings)))
    siblings.insert(index, moving_card)
    for i, sibling in enumerate(siblings):
        sibling.position = i


def _compact_positions(db: Session, column_id: int, exclude_card_id: int) -> None:
    siblings = (
        db.query(Card)
        .filter(Card.column_id == column_id, Card.id != exclude_card_id)
        .order_by(Card.position)
        .all()
    )
    for index, sibling in enumerate(siblings):
        sibling.position = index


@router.get("/board", response_model=BoardOut)
def get_board(db: Session = Depends(get_db), username: str = Depends(get_current_user)):
    board = _get_user_board(db, username)
    columns = db.query(Column).filter(Column.board_id == board.id).order_by(Column.position).all()
    return BoardOut(columns=[_column_out(db, column) for column in columns])


@router.patch("/columns/{column_id}", response_model=ColumnOut)
def rename_column(
    column_id: int,
    body: RenameColumnRequest,
    db: Session = Depends(get_db),
    username: str = Depends(get_current_user),
):
    board = _get_user_board(db, username)
    column = _get_owned_column(db, board, column_id)
    column.title = body.title
    db.commit()
    return _column_out(db, column)


@router.post("/cards", response_model=CardOut, status_code=201)
def create_card(
    body: CreateCardRequest,
    db: Session = Depends(get_db),
    username: str = Depends(get_current_user),
):
    board = _get_user_board(db, username)
    column = _get_owned_column(db, board, body.column_id)
    position = db.query(Card).filter(Card.column_id == column.id).count()
    card = Card(column_id=column.id, title=body.title, details=body.details, position=position)
    db.add(card)
    db.commit()
    db.refresh(card)
    return _card_out(card)


@router.patch("/cards/{card_id}", response_model=CardOut)
def update_card(
    card_id: int,
    body: UpdateCardRequest,
    db: Session = Depends(get_db),
    username: str = Depends(get_current_user),
):
    board = _get_user_board(db, username)
    card = _get_owned_card(db, board, card_id)

    if body.title is not None:
        card.title = body.title
    if body.details is not None:
        card.details = body.details

    moving_columns = body.column_id is not None and body.column_id != card.column_id

    if moving_columns:
        old_column_id = card.column_id
        new_column = _get_owned_column(db, board, body.column_id)
        _compact_positions(db, old_column_id, exclude_card_id=card.id)
        card.column_id = new_column.id
        _insert_at_position(db, new_column.id, card, body.position)
    elif body.position is not None:
        _insert_at_position(db, card.column_id, card, body.position)

    db.commit()
    db.refresh(card)
    return _card_out(card)


@router.delete("/cards/{card_id}", status_code=204)
def delete_card(
    card_id: int,
    db: Session = Depends(get_db),
    username: str = Depends(get_current_user),
):
    board = _get_user_board(db, username)
    card = _get_owned_card(db, board, card_id)
    db.delete(card)
    db.commit()
