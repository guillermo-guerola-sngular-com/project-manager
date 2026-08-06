"use client";

import { useState, type FormEvent } from "react";
import { sendChatMessage, type ChatMessage } from "@/lib/api";

type ChatSidebarProps = {
  onBoardChanged: () => void;
};

export const ChatSidebar = ({ onBoardChanged }: ChatSidebarProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const message = input.trim();
    if (!message || sending) {
      return;
    }

    const history = messages;
    setMessages((prev) => [...prev, { role: "user", content: message }]);
    setInput("");
    setSending(true);
    setError(null);

    try {
      const { reply, boardChanged } = await sendChatMessage(message, history);
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      if (boardChanged) {
        onBoardChanged();
      }
    } catch {
      setError("Couldn't reach the assistant.");
    } finally {
      setSending(false);
    }
  };

  return (
    <aside className="flex h-screen w-[360px] flex-shrink-0 flex-col border-l border-[var(--stroke)] bg-white/80 backdrop-blur">
      <div className="border-b border-[var(--stroke)] px-6 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--gray-text)]">
          Assistant
        </p>
        <h2 className="mt-1 font-display text-xl font-semibold text-[var(--navy-dark)]">
          Ask the board
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {messages.length === 0 && (
          <p className="text-sm leading-6 text-[var(--gray-text)]">
            Ask me about the board, or tell me to rename a column, add a card, or move one.
          </p>
        )}
        <ul className="flex list-none flex-col gap-3 p-0">
          {messages.map((message, index) => (
            <li
              key={index}
              className={
                message.role === "user"
                  ? "self-end rounded-2xl rounded-br-sm bg-[var(--secondary-purple)] px-4 py-2 text-sm text-white"
                  : "self-start rounded-2xl rounded-bl-sm bg-[var(--surface)] px-4 py-2 text-sm text-[var(--navy-dark)]"
              }
            >
              {message.content}
            </li>
          ))}
          {sending && (
            <li className="self-start rounded-2xl rounded-bl-sm bg-[var(--surface)] px-4 py-2 text-sm text-[var(--gray-text)]">
              Thinking…
            </li>
          )}
        </ul>
      </div>

      {error && (
        <p role="alert" className="px-6 pb-2 text-xs font-medium text-red-600">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2 border-t border-[var(--stroke)] p-4">
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Message the assistant…"
          aria-label="Chat message"
          disabled={sending}
          className="flex-1 rounded-full border border-[var(--stroke)] bg-white px-4 py-2 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="rounded-full bg-[var(--secondary-purple)] px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </aside>
  );
};
