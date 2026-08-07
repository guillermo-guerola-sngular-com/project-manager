from fastapi import HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.models import Board, Card, Column, User


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


def get_user_board(db: Session, username: str) -> Board:
    user = db.query(User).filter(User.username == username).first()
    if user is None or user.board is None:
        raise HTTPException(status_code=404, detail="Board not found")
    return user.board


def get_owned_column(db: Session, board: Board, column_id: int) -> Column:
    column = (
        db.query(Column)
        .filter(Column.id == column_id, Column.board_id == board.id)
        .first()
    )
    if column is None:
        raise HTTPException(status_code=404, detail="Column not found")
    return column


def get_owned_card(db: Session, board: Board, card_id: int) -> Card:
    card = (
        db.query(Card)
        .join(Column)
        .filter(Card.id == card_id, Column.board_id == board.id)
        .first()
    )
    if card is None:
        raise HTTPException(status_code=404, detail="Card not found")
    return card


def list_columns(db: Session, board: Board) -> list[Column]:
    return db.query(Column).filter(Column.board_id == board.id).order_by(Column.position).all()


def list_cards(db: Session, column: Column) -> list[Card]:
    return db.query(Card).filter(Card.column_id == column.id).order_by(Card.position).all()


def card_to_out(card: Card) -> CardOut:
    return CardOut(id=card.id, title=card.title, details=card.details)


def column_to_out(db: Session, column: Column) -> ColumnOut:
    cards = list_cards(db, column)
    return ColumnOut(id=column.id, title=column.title, cards=[card_to_out(c) for c in cards])


def board_to_out(db: Session, board: Board) -> BoardOut:
    columns = list_columns(db, board)
    return BoardOut(columns=[column_to_out(db, column) for column in columns])


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


def rename_column(db: Session, board: Board, column_id: int, title: str) -> Column:
    column = get_owned_column(db, board, column_id)
    column.title = title
    db.commit()
    return column


def create_card(db: Session, board: Board, column_id: int, title: str, details: str = "") -> Card:
    column = get_owned_column(db, board, column_id)
    position = db.query(Card).filter(Card.column_id == column.id).count()
    card = Card(column_id=column.id, title=title, details=details, position=position)
    db.add(card)
    db.commit()
    db.refresh(card)
    return card


def update_card(
    db: Session,
    board: Board,
    card_id: int,
    title: str | None = None,
    details: str | None = None,
    column_id: int | None = None,
    position: int | None = None,
) -> Card:
    card = get_owned_card(db, board, card_id)

    if title is not None:
        card.title = title
    if details is not None:
        card.details = details

    moving_columns = column_id is not None and column_id != card.column_id

    if moving_columns:
        old_column_id = card.column_id
        new_column = get_owned_column(db, board, column_id)
        _compact_positions(db, old_column_id, exclude_card_id=card.id)
        card.column_id = new_column.id
        _insert_at_position(db, new_column.id, card, position)
    elif position is not None:
        _insert_at_position(db, card.column_id, card, position)

    db.commit()
    db.refresh(card)
    return card


def delete_card(db: Session, board: Board, card_id: int) -> None:
    card = get_owned_card(db, board, card_id)
    db.delete(card)
    db.commit()
