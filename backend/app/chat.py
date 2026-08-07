from typing import Callable

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import board_service
from app.ai import Operation, ask_structured
from app.auth import get_current_user
from app.db import get_db
from app.models import Board

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


# Keyed by Operation's discriminator (app/ai.py), so adding an operation type
# only means adding an entry here rather than extending an if/elif chain.
_OPERATION_HANDLERS: dict[str, Callable[[Session, Board, Operation], None]] = {
    "rename_column": lambda db, board, op: board_service.rename_column(db, board, op.column_id, op.title),
    "add_card": lambda db, board, op: board_service.create_card(db, board, op.column_id, op.title, op.details),
    "edit_card": lambda db, board, op: board_service.update_card(
        db, board, op.card_id, title=op.title, details=op.details
    ),
    "move_card": lambda db, board, op: board_service.update_card(
        db, board, op.card_id, column_id=op.column_id, position=op.position
    ),
    "delete_card": lambda db, board, op: board_service.delete_card(db, board, op.card_id),
}


def _apply_operation(op: Operation, db: Session, board: Board) -> bool:
    try:
        _OPERATION_HANDLERS[op.type](db, board, op)
        return True
    except HTTPException:
        return False


@router.post("/ai/chat", response_model=ChatResponse)
def chat(body: ChatRequest, db: Session = Depends(get_db), username: str = Depends(get_current_user)):
    board = board_service.get_user_board(db, username)
    result = ask_structured(
        board=board_service.board_to_out(db, board).model_dump(),
        history=[m.model_dump() for m in body.history],
        message=body.message,
    )

    board_changed = False
    for op in result.operations or []:
        if _apply_operation(op, db, board):
            board_changed = True

    return ChatResponse(reply=result.reply, board_changed=board_changed)
