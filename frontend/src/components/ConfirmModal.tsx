"use client";

import { Modal } from "@/components/Modal";

type ConfirmModalProps = {
  heading: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export const ConfirmModal = ({
  heading,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: ConfirmModalProps) => (
  <Modal title={heading} onClose={onCancel}>
    <h3 className="font-display text-lg font-semibold text-[var(--navy-dark)]">{heading}</h3>
    <p className="mt-2 text-sm leading-6 text-[var(--gray-text)]">{message}</p>
    <div className="mt-6 flex items-center gap-2">
      <button
        type="button"
        onClick={onConfirm}
        className="rounded-full bg-red-600 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-110"
      >
        {confirmLabel}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-full border border-[var(--stroke)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
      >
        Cancel
      </button>
    </div>
  </Modal>
);
