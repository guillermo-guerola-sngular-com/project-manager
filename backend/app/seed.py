import hashlib

from sqlalchemy.orm import Session

from app.models import Board, Card, Column, User

DEFAULT_USERNAME = "user"
DEFAULT_PASSWORD = "password"

DEFAULT_COLUMNS = [
    {
        "title": "Backlog",
        "cards": [
            {
                "title": "Align roadmap themes",
                "details": "Draft quarterly themes with impact statements and metrics.",
            },
            {
                "title": "Gather customer signals",
                "details": "Review support tags, sales notes, and churn feedback.",
            },
        ],
    },
    {
        "title": "Discovery",
        "cards": [
            {
                "title": "Prototype analytics view",
                "details": "Sketch initial dashboard layout and key drill-downs.",
            },
        ],
    },
    {
        "title": "In Progress",
        "cards": [
            {
                "title": "Refine status language",
                "details": "Standardize column labels and tone across the board.",
            },
            {
                "title": "Design card layout",
                "details": "Add hierarchy and spacing for scanning dense lists.",
            },
        ],
    },
    {
        "title": "Review",
        "cards": [
            {
                "title": "QA micro-interactions",
                "details": "Verify hover, focus, and loading states.",
            },
        ],
    },
    {
        "title": "Done",
        "cards": [
            {
                "title": "Ship marketing page",
                "details": "Final copy approved and asset pack delivered.",
            },
            {
                "title": "Close onboarding sprint",
                "details": "Document release notes and share internally.",
            },
        ],
    },
]


def seed_default_user_and_board(db: Session) -> None:
    user = db.query(User).filter(User.username == DEFAULT_USERNAME).first()
    if user is None:
        user = User(
            username=DEFAULT_USERNAME,
            password_hash=hashlib.sha256(DEFAULT_PASSWORD.encode()).hexdigest(),
        )
        db.add(user)
        db.flush()

    if user.board is not None:
        return

    board = Board(user_id=user.id)
    db.add(board)
    db.flush()

    for column_position, column_data in enumerate(DEFAULT_COLUMNS):
        column = Column(board_id=board.id, title=column_data["title"], position=column_position)
        db.add(column)
        db.flush()
        for card_position, card_data in enumerate(column_data["cards"]):
            db.add(
                Card(
                    column_id=column.id,
                    title=card_data["title"],
                    details=card_data["details"],
                    position=card_position,
                )
            )

    db.commit()
