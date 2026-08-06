"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import type { Card } from "@/lib/kanban";
import { CardFormModal } from "@/components/CardFormModal";
import { ConfirmModal } from "@/components/ConfirmModal";

type KanbanCardProps = {
  card: Card;
  onEdit: (cardId: number, title: string, details: string) => void;
  onDelete: (cardId: number) => void;
};

const TrashIcon = () => (
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
    <path d="M4 6h12M8 6V4.5A1.5 1.5 0 0 1 9.5 3h1A1.5 1.5 0 0 1 12 4.5V6m-6.5 0 .6 9.4A1.5 1.5 0 0 0 7.6 17h4.8a1.5 1.5 0 0 0 1.5-1.6L14.5 6" />
  </svg>
);

export const KanbanCard = ({ card, onEdit, onDelete }: KanbanCardProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <>
      <article
        ref={setNodeRef}
        style={style}
        className={clsx(
          "rounded-2xl border border-transparent bg-white px-4 py-4 shadow-[0_12px_24px_rgba(3,33,71,0.08)]",
          "transition-all duration-150",
          isDragging && "opacity-60 shadow-[0_18px_32px_rgba(3,33,71,0.16)]"
        )}
        {...attributes}
        {...listeners}
        data-testid={`card-${card.id}`}
      >
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="flex-1 text-left"
            aria-label={`Edit ${card.title}`}
          >
            <h4 className="font-display text-base font-semibold text-[var(--navy-dark)]">
              {card.title}
            </h4>
          </button>
          <button
            type="button"
            onClick={() => setIsConfirmingDelete(true)}
            aria-label={`Delete ${card.title}`}
            className="shrink-0 rounded-full p-1.5 text-[var(--gray-text)] transition hover:bg-red-50 hover:text-red-600"
          >
            <TrashIcon />
          </button>
        </div>
        <p className="mt-2 w-full text-sm leading-6 text-[var(--gray-text)]">{card.details}</p>
      </article>

      {isEditing && (
        <CardFormModal
          heading="Edit card"
          submitLabel="Save changes"
          initialTitle={card.title}
          initialDetails={card.details}
          onSubmit={(title, details) => {
            onEdit(card.id, title, details);
            setIsEditing(false);
          }}
          onClose={() => setIsEditing(false)}
        />
      )}

      {isConfirmingDelete && (
        <ConfirmModal
          heading="Delete card?"
          message={`This will permanently delete "${card.title}".`}
          confirmLabel="Delete"
          onConfirm={() => {
            setIsConfirmingDelete(false);
            onDelete(card.id);
          }}
          onCancel={() => setIsConfirmingDelete(false)}
        />
      )}
    </>
  );
};
