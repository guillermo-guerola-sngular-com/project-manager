from __future__ import annotations

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(unique=True)
    password_hash: Mapped[str]

    board: Mapped[Board | None] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )


class Board(Base):
    __tablename__ = "boards"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)

    user: Mapped[User] = relationship(back_populates="board")
    columns: Mapped[list[Column]] = relationship(back_populates="board", cascade="all, delete-orphan")


class Column(Base):
    __tablename__ = "columns"

    id: Mapped[int] = mapped_column(primary_key=True)
    board_id: Mapped[int] = mapped_column(ForeignKey("boards.id", ondelete="CASCADE"))
    title: Mapped[str]
    position: Mapped[int]

    board: Mapped[Board] = relationship(back_populates="columns")
    cards: Mapped[list[Card]] = relationship(back_populates="column", cascade="all, delete-orphan")


class Card(Base):
    __tablename__ = "cards"

    id: Mapped[int] = mapped_column(primary_key=True)
    column_id: Mapped[int] = mapped_column(ForeignKey("columns.id", ondelete="CASCADE"))
    title: Mapped[str]
    details: Mapped[str] = mapped_column(default="")
    position: Mapped[int]

    column: Mapped[Column] = relationship(back_populates="cards")
