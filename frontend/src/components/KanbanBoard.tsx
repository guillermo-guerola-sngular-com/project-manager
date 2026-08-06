"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { KanbanColumn } from "@/components/KanbanColumn";
import { KanbanCardPreview } from "@/components/KanbanCardPreview";
import { moveCard, type BoardData } from "@/lib/kanban";
import { createCard, deleteCard, fetchBoard, renameColumn, updateCard } from "@/lib/api";

export const KanbanBoard = () => {
  const [board, setBoard] = useState<BoardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeCardId, setActiveCardId] = useState<number | null>(null);
  const [overColumnId, setOverColumnId] = useState<number | null>(null);

  useEffect(() => {
    fetchBoard()
      .then(setBoard)
      .catch(() => setError("Couldn't load the board."));
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const cardsById = useMemo(() => board?.cards ?? {}, [board]);

  // Plain closest-corner/center detection is unreliable once a droppable
  // column contains nested sortable cards: it can resolve the collision to a
  // card in a neighboring column instead of the column itself, so the column
  // never registers as the drop target. Preferring whatever droppable the
  // pointer is actually inside fixes that — but the column's own droppable
  // rect covers its cards too and is registered before them, so a plain
  // pointerWithin() over a non-empty column resolves to the *column*, not
  // the specific card under the pointer. That breaks "insert at this card's
  // position" (moveCard treats an over-a-column result as "append to the
  // end" instead), which is exactly why same-column reordering was
  // unreliable. Refine: if the first collision is a column with cards,
  // narrow to whichever of its cards is actually closest to the pointer.
  const collisionDetectionStrategy: CollisionDetection = (args) => {
    const pointerCollisions = pointerWithin(args);
    const collisions = pointerCollisions.length > 0 ? pointerCollisions : rectIntersection(args);
    const firstCollision = collisions[0];
    const column = board?.columns.find((c) => c.id === firstCollision?.id);

    if (column && column.cardIds.length > 0) {
      const cardCollisions = closestCenter({
        ...args,
        // Exclude the card actually being dragged: its own droppable rect
        // tracks the pointer via transform, so its "distance" to the pointer
        // is ~0 and it would otherwise always win as its own closest match —
        // over ends up equal to active, and handleDragEnd's active-id-equals
        // -over-id guard then treats that as "no move," which is exactly why
        // same-column reordering silently did nothing.
        droppableContainers: args.droppableContainers.filter(
          (container) =>
            container.id !== args.active.id && column.cardIds.includes(container.id as number)
        ),
      });
      if (cardCollisions.length > 0) {
        return cardCollisions;
      }
    }

    return collisions;
  };

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

  if (!board) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm font-medium text-[var(--gray-text)]">
        {error ?? "Loading board…"}
      </div>
    );
  }

  const activeCard = activeCardId ? cardsById[activeCardId] : null;

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute left-0 top-0 h-[420px] w-[420px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.25)_0%,_rgba(32,157,215,0.05)_55%,_transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[520px] w-[520px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.18)_0%,_rgba(117,57,145,0.05)_55%,_transparent_75%)]" />

      <main className="relative mx-auto flex min-h-screen max-w-[1500px] flex-col gap-10 px-6 pb-16 pt-12">
        <header className="flex flex-col gap-6 rounded-[32px] border border-[var(--stroke)] bg-white/80 p-8 shadow-[var(--shadow)] backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
                Single Board Kanban
              </p>
              <h1 className="mt-3 font-display text-4xl font-semibold text-[var(--navy-dark)]">
                Kanban Studio
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--gray-text)]">
                Keep momentum visible. Rename columns, drag cards between stages,
                and capture quick notes without getting buried in settings.
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
                Focus
              </p>
              <p className="mt-2 text-lg font-semibold text-[var(--primary-blue)]">
                One board. Five columns. Zero clutter.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {board.columns.map((column) => (
              <div
                key={column.id}
                className="flex items-center gap-2 rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)]"
              >
                <span className="h-2 w-2 rounded-full bg-[var(--accent-yellow)]" />
                {column.title}
              </div>
            ))}
          </div>
        </header>

        {error && (
          <p role="alert" className="text-sm font-medium text-red-600">
            {error}
          </p>
        )}

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
      </main>
    </div>
  );
};
