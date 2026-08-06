from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.ai import Operation, ask_structured
from app.auth import get_current_user
from app.board import (
    BoardOut,
    CreateCardRequest,
    RenameColumnRequest,
    UpdateCardRequest,
    _column_out,
    _get_user_board,
    create_card,
    delete_card,
    rename_column,
    update_card,
)
from app.db import get_db
from app.models import Column

router = APIRouter()


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []


class ChatResponse(BaseModel):
    reply: str
    board_changed: bool


def _board_json(db: Session, board) -> dict:
    columns = db.query(Column).filter(Column.board_id == board.id).order_by(Column.position).all()
    return BoardOut(columns=[_column_out(db, column) for column in columns]).model_dump()


def _apply_operation(op: Operation, db: Session, username: str) -> bool:
    try:
        if op.type == "rename_column":
            rename_column(op.column_id, RenameColumnRequest(title=op.title), db=db, username=username)
        elif op.type == "add_card":
            create_card(
                CreateCardRequest(column_id=op.column_id, title=op.title, details=op.details),
                db=db,
                username=username,
            )
        elif op.type == "edit_card":
            update_card(op.card_id, UpdateCardRequest(title=op.title, details=op.details), db=db, username=username)
        elif op.type == "move_card":
            update_card(
                op.card_id,
                UpdateCardRequest(column_id=op.column_id, position=op.position),
                db=db,
                username=username,
            )
        elif op.type == "delete_card":
            delete_card(op.card_id, db=db, username=username)
        return True
    except HTTPException:
        return False


@router.post("/ai/chat", response_model=ChatResponse)
def chat(body: ChatRequest, db: Session = Depends(get_db), username: str = Depends(get_current_user)):
    board = _get_user_board(db, username)
    result = ask_structured(
        board=_board_json(db, board),
        history=[m.model_dump() for m in body.history],
        message=body.message,
    )

    board_changed = False
    for op in result.operations or []:
        if _apply_operation(op, db, username):
            board_changed = True

    return ChatResponse(reply=result.reply, board_changed=board_changed)
