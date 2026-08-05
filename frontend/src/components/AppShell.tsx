"use client";

import { useEffect, useState } from "react";
import { KanbanBoard } from "@/components/KanbanBoard";
import { LoginForm } from "@/components/LoginForm";
import { fetchSession, logout, type AuthStatus } from "@/lib/auth";

export const AppShell = () => {
  const [status, setStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    fetchSession().then((ok) => setStatus(ok ? "authenticated" : "unauthenticated"));
  }, []);

  const handleLogout = async () => {
    await logout();
    setStatus("unauthenticated");
  };

  if (status === "loading") {
    return null;
  }

  if (status === "unauthenticated") {
    return <LoginForm onSuccess={() => setStatus("authenticated")} />;
  }

  return (
    <div>
      <div className="flex justify-end px-6 pt-4">
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
        >
          Log out
        </button>
      </div>
      <KanbanBoard />
    </div>
  );
};
