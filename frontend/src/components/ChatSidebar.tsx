"use client";

import { useState, type FormEvent } from "react";
import { sendChatMessage, type ChatMessage } from "@/lib/api";

type ChatSidebarProps = {
  onBoardChanged: () => void;
};

const ChatBubbleIcon = () => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-5 w-5"
    aria-hidden="true"
  >
    <path d="M3 5.5A2.5 2.5 0 0 1 5.5 3h9A2.5 2.5 0 0 1 17 5.5v6a2.5 2.5 0 0 1-2.5 2.5H9l-3.5 3v-3H5.5A2.5 2.5 0 0 1 3 11.5v-6Z" />
  </svg>
);

const ChevronIcon = () => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-4 w-4"
    aria-hidden="true"
  >
    <path d="M12.5 5 7.5 10l5 5" />
  </svg>
);

export const ChatSidebar = ({ onBoardChanged }: ChatSidebarProps) => {
  const [collapsed, setCollapsed] = useState(false);
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

  if (collapsed) {
    return (
      <aside className="flex h-screen w-14 flex-shrink-0 flex-col items-center border-l border-[var(--stroke)] bg-white/80 pt-4 backdrop-blur">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          aria-label="Open chat assistant"
          className="rounded-full p-2.5 text-[var(--secondary-purple)] transition hover:bg-[var(--surface)]"
        >
          <ChatBubbleIcon />
        </button>
      </aside>
    );
  }

  return (
    <aside className="flex h-screen w-[360px] flex-shrink-0 flex-col border-l border-[var(--stroke)] bg-white/80 backdrop-blur">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--stroke)] px-6 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--gray-text)]">
            Assistant
          </p>
          <h2 className="mt-1 font-display text-xl font-semibold text-[var(--navy-dark)]">
            Ask the board
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          aria-label="Collapse chat assistant"
          className="shrink-0 rounded-full p-1.5 text-[var(--gray-text)] transition hover:bg-[var(--surface)] hover:text-[var(--navy-dark)]"
        >
          <ChevronIcon />
        </button>
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
