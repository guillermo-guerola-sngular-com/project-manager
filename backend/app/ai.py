import json
import os
import re
from typing import Annotated, Literal, Union

from openai import OpenAI
from pydantic import BaseModel, Field, ValidationError

MODEL = "openai/gpt-oss-20b:free"

FALLBACK_REPLY = "Sorry, I couldn't process that."

SYSTEM_PROMPT_TEMPLATE = """You are the assistant for a Kanban board app. Answer the user's message in `reply`.
If the user's message implies a change to the board, also include `operations` (a list); otherwise use null.
Respond with ONLY raw JSON, no markdown or code fences, matching this shape:
{{"reply": string, "operations": [OPERATION, ...] | null}}

Each OPERATION is one of:
{{"type": "rename_column", "column_id": int, "title": string}}
{{"type": "add_card", "column_id": int, "title": string, "details": string}}
{{"type": "edit_card", "card_id": int, "title": string or null, "details": string or null}}
{{"type": "move_card", "card_id": int, "column_id": int or null, "position": int or null}}
{{"type": "delete_card", "card_id": int}}

Current board: {board_json}"""

_FENCE_RE = re.compile(r"^```(?:json)?\s*(.*?)\s*```$", re.DOTALL)


class RenameColumnOp(BaseModel):
    type: Literal["rename_column"]
    column_id: int
    title: str


class AddCardOp(BaseModel):
    type: Literal["add_card"]
    column_id: int
    title: str
    details: str = ""


class EditCardOp(BaseModel):
    type: Literal["edit_card"]
    card_id: int
    title: str | None = None
    details: str | None = None


class MoveCardOp(BaseModel):
    type: Literal["move_card"]
    card_id: int
    column_id: int | None = None
    position: int | None = None


class DeleteCardOp(BaseModel):
    type: Literal["delete_card"]
    card_id: int


Operation = Annotated[
    Union[RenameColumnOp, AddCardOp, EditCardOp, MoveCardOp, DeleteCardOp],
    Field(discriminator="type"),
]


class ChatReply(BaseModel):
    reply: str
    operations: list[Operation] | None = None


def _client() -> OpenAI:
    return OpenAI(base_url="https://openrouter.ai/api/v1", api_key=os.environ["OPENROUTER_API_KEY"])


def ask(prompt: str) -> str:
    response = _client().chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.choices[0].message.content


def _parse_reply(content: str | None) -> ChatReply:
    if not content:
        return ChatReply(reply=FALLBACK_REPLY)
    text = content.strip()
    fence_match = _FENCE_RE.match(text)
    if fence_match:
        text = fence_match.group(1)
    try:
        return ChatReply.model_validate_json(text)
    except ValidationError:
        return ChatReply(reply=text)


def ask_structured(board: dict, history: list[dict], message: str) -> ChatReply:
    system_prompt = SYSTEM_PROMPT_TEMPLATE.format(board_json=json.dumps(board))
    messages = [{"role": "system", "content": system_prompt}]
    messages.extend({"role": item["role"], "content": item["content"]} for item in history)
    messages.append({"role": "user", "content": message})

    completion = _client().chat.completions.create(model=MODEL, messages=messages)
    return _parse_reply(completion.choices[0].message.content)
