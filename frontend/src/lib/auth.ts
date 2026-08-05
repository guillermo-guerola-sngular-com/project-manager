export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export const fetchSession = async (): Promise<boolean> => {
  const response = await fetch("/api/auth/me");
  return response.ok;
};

export const login = async (username: string, password: string): Promise<boolean> => {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  return response.ok;
};

export const logout = async (): Promise<void> => {
  await fetch("/api/auth/logout", { method: "POST" });
};
