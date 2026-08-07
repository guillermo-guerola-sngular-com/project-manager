"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { KanbanColumn } from "@/components/KanbanColumn";
import { KanbanCardPreview } from "@/components/KanbanCardPreview";
import { createCollisionDetectionStrategy } from "@/lib/dndCollision";
import { moveCard, type BoardData } from "@/lib/kanban";
import { createCard, deleteCard, fetchBoard, renameColumn, updateCard } from "@/lib/api";

type KanbanBoardProps = {
  // Bumped by AppShell whenever the AI chat reports it changed the board, so
  // this effect re-runs and pulls the latest state instead of the frontend
  // trying to replay the AI's operations itself.
  refreshSignal?: number;
  onLogout?: () => void;
};

export const KanbanBoard = ({ refreshSignal = 0, onLogout }: KanbanBoardProps = {}) => {
  const [board, setBoard] = useState<BoardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeCardId, setActiveCardId] = useState<number | null>(null);
  const [overColumnId, setOverColumnId] = useState<number | null>(null);

  useEffect(() => {
    setError(null);
    fetchBoard()
      .then(setBoard)
      .catch(() => setError("Couldn't load the board."));
  }, [refreshSignal]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const cardsById = useMemo(() => board?.cards ?? {}, [board]);

  // The refinement logic itself (why plain pointerWithin/rectIntersection
  // resolve to a column instead of the specific card under the pointer,
  // and why the dragged card must be excluded from its own column's
  // refinement) is documented in lib/dndCollision.ts, where it's a pure,
  // independently unit-tested function.
  const collisionDetectionStrategy = createCollisionDetectionStrategy(board?.columns ?? []);

  const handleDragStart = (event: DragStartEvent) => {
    const id = event.active.id as number;
    setActiveCardId(id);
    setOverColumnId(board?.columns.find((column) => column.cardIds.includes(id))?.id ?? null);
  };

  // Purely cosmetic: tracks which column to highlight as the drop target.
  // Deliberately does NOT touch `board` — mutating the actual card/column
  // data on every pointer-move event reshuffles the DOM mid-gesture, which
  // shifts the very rects dnd-kit measures collisions against and makes the
  // drag thrash/flip-flop, undoing itself before you even let go. The real
  // move is resolved once, cleanly, in handleDragEnd.
  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    if (!over || !board) {
      setOverColumnId(null);
      return;
    }
    const overId = over.id as number;
    const column = board.columns.find(
      (candidate) => candidate.id === overId || candidate.cardIds.includes(overId)
    );
    setOverColumnId(column?.id ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCardId(null);
    setOverColumnId(null);
    setError(null);
    if (!board || !over || active.id === over.id) {
      return;
    }

    const activeId = active.id as number;
    const nextColumns = moveCard(board.columns, activeId, over.id as number);
    setBoard({ ...board, columns: nextColumns });

    const targetColumn = nextColumns.find((column) => column.cardIds.includes(activeId));
    if (targetColumn) {
      updateCard(activeId, {
        columnId: targetColumn.id,
        position: targetColumn.cardIds.indexOf(activeId),
      }).catch(() => setError("Couldn't save the move."));
    }
  };

  const handleRenameColumn = (columnId: number, title: string) => {
    setError(null);
    setBoard((prev) =>
      prev
        ? {
            ...prev,
            columns: prev.columns.map((column) =>
              column.id === columnId ? { ...column, title } : column
            ),
          }
        : prev
    );
    renameColumn(columnId, title).catch(() => setError("Couldn't save the column name."));
  };

  const handleAddCard = async (columnId: number, title: string, details: string) => {
    setError(null);
    try {
      const created = await createCard(columnId, title, details || "No details yet.");
      setBoard((prev) =>
        prev
          ? {
              ...prev,
              cards: { ...prev.cards, [created.id]: created },
              columns: prev.columns.map((column) =>
                column.id === columnId
                  ? { ...column, cardIds: [...column.cardIds, created.id] }
                  : column
              ),
            }
          : prev
      );
    } catch {
      setError("Couldn't add the card.");
    }
  };

  const handleEditCard = (cardId: number, title: string, details: string) => {
    setError(null);
    setBoard((prev) => {
      if (!prev || !prev.cards[cardId]) {
        return prev;
      }
      return {
        ...prev,
        cards: {
          ...prev.cards,
          [cardId]: { ...prev.cards[cardId], title, details: details || "No details yet." },
        },
      };
    });
    updateCard(cardId, { title, details: details || "No details yet." }).catch(() =>
      setError("Couldn't save the card.")
    );
  };

  const handleDeleteCard = (columnId: number, cardId: number) => {
    setError(null);
    setBoard((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        cards: Object.fromEntries(
          Object.entries(prev.cards).filter(([id]) => Number(id) !== cardId)
        ),
        columns: prev.columns.map((column) =>
          column.id === columnId
            ? { ...column, cardIds: column.cardIds.filter((id) => id !== cardId) }
            : column
        ),
      };
    });
    deleteCard(cardId).catch(() => setError("Couldn't delete the card."));
  };

  const activeCard = activeCardId ? cardsById[activeCardId] : null;

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute left-0 top-0 h-[420px] w-[420px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.25)_0%,_rgba(32,157,215,0.05)_55%,_transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[520px] w-[520px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.18)_0%,_rgba(117,57,145,0.05)_55%,_transparent_75%)]" />

      <main className="relative mx-auto flex min-h-screen max-w-[1500px] flex-col gap-4 px-6 pb-6 pt-6">
        <header className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--stroke)] bg-white/80 px-5 py-3 shadow-[var(--shadow)] backdrop-blur">
          <div className="flex items-baseline gap-3">
            <h1 className="font-display text-xl font-semibold text-[var(--navy-dark)]">
              Kanban Studio
            </h1>
            <p className="hidden text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)] sm:block">
              Single Board Kanban
            </p>
          </div>
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="rounded-full border border-[var(--stroke)] px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
            >
              Log out
            </button>
          )}
        </header>

        {error && board && (
          <p role="alert" className="text-sm font-medium text-red-600">
            {error}
          </p>
        )}

        {!board ? (
          <div className="flex flex-1 items-center justify-center text-sm font-medium text-[var(--gray-text)]">
            {error ?? "Loading board…"}
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={collisionDetectionStrategy}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <section className="grid gap-6 lg:grid-cols-5">
              {board.columns.map((column) => (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  cards={column.cardIds.map((cardId) => board.cards[cardId])}
                  isDropTarget={overColumnId === column.id}
                  onRename={handleRenameColumn}
                  onAddCard={handleAddCard}
                  onEditCard={handleEditCard}
                  onDeleteCard={handleDeleteCard}
                />
              ))}
            </section>
            <DragOverlay>
              {activeCard ? (
                <div className="w-[260px]">
                  <KanbanCardPreview card={activeCard} />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </main>
    </div>
  );
};
