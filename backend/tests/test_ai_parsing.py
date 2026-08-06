from app.ai import ChatReply, _parse_reply


def test_parse_reply_plain_json():
    reply = _parse_reply('{"reply": "hi", "operations": null}')
    assert reply == ChatReply(reply="hi", operations=None)


def test_parse_reply_strips_markdown_fence():
    reply = _parse_reply('```json\n{"reply": "hi", "operations": null}\n```')
    assert reply == ChatReply(reply="hi", operations=None)


def test_parse_reply_with_operation():
    content = (
        '{"reply": "Renamed", "operations": '
        '[{"type": "rename_column", "column_id": 1, "title": "Todo"}]}'
    )
    reply = _parse_reply(content)
    assert reply.reply == "Renamed"
    assert reply.operations[0].type == "rename_column"
    assert reply.operations[0].column_id == 1


def test_parse_reply_falls_back_on_garbage_text():
    reply = _parse_reply("not json at all")
    assert reply == ChatReply(reply="not json at all", operations=None)


def test_parse_reply_falls_back_on_unknown_operation_type():
    reply = _parse_reply('{"reply": "ok", "operations": [{"type": "nuke_board"}]}')
    assert reply.reply == '{"reply": "ok", "operations": [{"type": "nuke_board"}]}'
    assert reply.operations is None


def test_parse_reply_falls_back_on_none_content():
    reply = _parse_reply(None)
    assert reply.operations is None
    assert reply.reply
