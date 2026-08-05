import type { BoardData, Card } from "@/lib/kanban";

type ApiCard = { id: number; title: string; details: string };
type ApiColumn = { id: number; title: string; cards: ApiCard[] };
type ApiBoard = { columns: ApiColumn[] };

export const fetchBoard = async (): Promise<BoardData> => {
  const response = await fetch("/api/board");
  if (!response.ok) {
    throw new Error("Failed to load the board.");
  }
  const data: ApiBoard = await response.json();

  const cards: BoardData["cards"] = {};
  const columns = data.columns.map((column) => {
    for (const card of column.cards) {
      cards[card.id] = card;
    }
    return { id: column.id, title: column.title, cardIds: column.cards.map((card) => card.id) };
  });

  return { columns, cards };
};

export const renameColumn = async (columnId: number, title: string): Promise<void> => {
  const response = await fetch(`/api/columns/${columnId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!response.ok) {
    throw new Error("Failed to rename the column.");
  }
};

export const createCard = async (
  columnId: number,
  title: string,
  details: string
): Promise<Card> => {
  const response = await fetch("/api/cards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ column_id: columnId, title, details }),
  });
  if (!response.ok) {
    throw new Error("Failed to create the card.");
  }
  return response.json();
};

export const updateCard = async (
  cardId: number,
  updates: { title?: string; details?: string; columnId?: number; position?: number }
): Promise<void> => {
  const response = await fetch(`/api/cards/${cardId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: updates.title,
      details: updates.details,
      column_id: updates.columnId,
      position: updates.position,
    }),
  });
  if (!response.ok) {
    throw new Error("Failed to update the card.");
  }
};

export const deleteCard = async (cardId: number): Promise<void> => {
  const response = await fetch(`/api/cards/${cardId}`, { method: "DELETE" });
  if (!response.ok) {
    throw new Error("Failed to delete the card.");
  }
};
