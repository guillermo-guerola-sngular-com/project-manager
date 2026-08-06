"use client";

import { useEffect, useState } from "react";
import { ChatSidebar } from "@/components/ChatSidebar";
import { KanbanBoard } from "@/components/KanbanBoard";
import { LoginForm } from "@/components/LoginForm";
import { fetchSession, logout, type AuthStatus } from "@/lib/auth";

export const AppShell = () => {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [refreshSignal, setRefreshSignal] = useState(0);

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
    <div className="flex">
      <div className="min-w-0 flex-1">
        <KanbanBoard refreshSignal={refreshSignal} onLogout={handleLogout} />
      </div>
      <ChatSidebar onBoardChanged={() => setRefreshSignal((n) => n + 1)} />
    </div>
  );
};
