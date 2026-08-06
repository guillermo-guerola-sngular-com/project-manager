from app.ai import ask


def test_ask_answers_arithmetic():
    reply = ask("What is 2+2? Answer with only the number.")
    assert "4" in reply
