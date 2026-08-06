import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatSidebar } from "@/components/ChatSidebar";

const createFetchMock = (boardChanged: boolean) =>
  vi.fn((url: string, options?: RequestInit) => {
    if (url === "/api/ai/chat") {
      const body = JSON.parse(options!.body as string);
      return Promise.resolve({
        ok: true,
        json: async () => ({ reply: `You said: ${body.message}`, board_changed: boardChanged }),
      });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });

describe("ChatSidebar", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("sends a message and renders the reply", async () => {
    vi.stubGlobal("fetch", createFetchMock(false));
    const onBoardChanged = vi.fn();
    render(<ChatSidebar onBoardChanged={onBoardChanged} />);

    await userEvent.type(screen.getByLabelText("Chat message"), "hello");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    expect(await screen.findByText("You said: hello")).toBeInTheDocument();
    expect(onBoardChanged).not.toHaveBeenCalled();
  });

  it("triggers a board refresh only when the reply changed the board", async () => {
    vi.stubGlobal("fetch", createFetchMock(true));
    const onBoardChanged = vi.fn();
    render(<ChatSidebar onBoardChanged={onBoardChanged} />);

    await userEvent.type(screen.getByLabelText("Chat message"), "add a card");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    await screen.findByText("You said: add a card");
    expect(onBoardChanged).toHaveBeenCalledTimes(1);
  });

  it("keeps prior turns in the history sent on the next message", async () => {
    const fetchMock = createFetchMock(false);
    vi.stubGlobal("fetch", fetchMock);
    render(<ChatSidebar onBoardChanged={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("Chat message"), "first");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));
    await screen.findByText("You said: first");

    await userEvent.type(screen.getByLabelText("Chat message"), "second");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));
    await screen.findByText("You said: second");

    const secondCallBody = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(secondCallBody.history).toEqual([
      { role: "user", content: "first" },
      { role: "assistant", content: "You said: first" },
    ]);
  });

  it("shows an error if the request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    render(<ChatSidebar onBoardChanged={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("Chat message"), "hello");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("collapses and can be reopened", async () => {
    vi.stubGlobal("fetch", createFetchMock(false));
    render(<ChatSidebar onBoardChanged={vi.fn()} />);

    expect(screen.getByRole("heading", { name: /ask the board/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /collapse chat assistant/i }));
    expect(screen.queryByRole("heading", { name: /ask the board/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Chat message")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /open chat assistant/i }));
    expect(screen.getByRole("heading", { name: /ask the board/i })).toBeInTheDocument();
  });
});
