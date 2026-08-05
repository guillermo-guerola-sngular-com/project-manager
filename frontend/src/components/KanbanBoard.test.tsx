import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KanbanBoard } from "@/components/KanbanBoard";

const BOARD_FIXTURE = {
  columns: [
    { id: 1, title: "Backlog", cards: [] },
    { id: 2, title: "Discovery", cards: [] },
    { id: 3, title: "In Progress", cards: [] },
    { id: 4, title: "Review", cards: [] },
    { id: 5, title: "Done", cards: [] },
  ],
};

const createFetchMock = () =>
  vi.fn((url: string, options?: RequestInit) => {
    const method = options?.method ?? "GET";

    if (url === "/api/board" && method === "GET") {
      return Promise.resolve({ ok: true, json: async () => BOARD_FIXTURE });
    }
    if (url === "/api/cards" && method === "POST") {
      const body = JSON.parse(options!.body as string);
      return Promise.resolve({
        ok: true,
        json: async () => ({ id: 100, title: body.title, details: body.details }),
      });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });

const getFirstColumn = () => screen.getAllByTestId(/column-/i)[0];

describe("KanbanBoard", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("fetch", createFetchMock());
  });

  it("renders five columns", async () => {
    render(<KanbanBoard />);
    expect(await screen.findAllByTestId(/column-/i)).toHaveLength(5);
  });

  it("renames a column", async () => {
    render(<KanbanBoard />);
    await screen.findAllByTestId(/column-/i);
    const column = getFirstColumn();
    const input = within(column).getByLabelText("Column title");
    await userEvent.clear(input);
    await userEvent.type(input, "New Name");
    expect(input).toHaveValue("New Name");
  });

  it("adds a card, edits it, then deletes it after confirming", async () => {
    render(<KanbanBoard />);
    await screen.findAllByTestId(/column-/i);
    const column = getFirstColumn();
    const addButton = within(column).getByRole("button", {
      name: /add a card/i,
    });
    await userEvent.click(addButton);

    const titleInput = within(column).getByPlaceholderText(/card title/i);
    await userEvent.type(titleInput, "New card");
    const detailsInput = within(column).getByPlaceholderText(/details/i);
    await userEvent.type(detailsInput, "Notes");

    await userEvent.click(within(column).getByRole("button", { name: /add card/i }));

    expect(await within(column).findByText("New card")).toBeInTheDocument();

    // edit: click the card body, change the title, save
    // exact: true — dnd-kit gives the whole card role="button" too, with an
    // accessible name that contains this button's, so a fuzzy match would
    // resolve to both.
    await userEvent.click(
      within(column).getByRole("button", { name: "Edit New card", exact: true })
    );
    const editTitleInput = await screen.findByDisplayValue("New card");
    await userEvent.clear(editTitleInput);
    await userEvent.type(editTitleInput, "Renamed card");
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

    expect(await within(column).findByText("Renamed card")).toBeInTheDocument();

    // delete: click the trash icon, then confirm in the modal
    await userEvent.click(
      within(column).getByRole("button", { name: "Delete Renamed card", exact: true })
    );
    await userEvent.click(await screen.findByRole("button", { name: "Delete", exact: true }));

    expect(within(column).queryByText("Renamed card")).not.toBeInTheDocument();
  });
});
