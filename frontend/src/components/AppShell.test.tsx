import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppShell } from "@/components/AppShell";

describe("AppShell", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the login form when unauthenticated, with no chat sidebar", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    render(<AppShell />);

    expect(await screen.findByRole("heading", { name: /sign in/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /ask the board/i })).not.toBeInTheDocument();
  });

  it("shows the kanban board and chat sidebar when authenticated", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ columns: [] }) })
    );
    render(<AppShell />);

    expect(await screen.findByRole("heading", { name: /kanban studio/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /ask the board/i })).toBeInTheDocument();
  });

  it("logs out and returns to the login form", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true }) // /api/auth/me
      .mockResolvedValueOnce({ ok: true }); // /api/auth/logout
    vi.stubGlobal("fetch", fetchMock);
    render(<AppShell />);

    const logoutButton = await screen.findByRole("button", { name: /log out/i });
    await userEvent.click(logoutButton);

    expect(await screen.findByRole("heading", { name: /sign in/i })).toBeInTheDocument();
  });
});
