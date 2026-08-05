import { useEffect, useState, type FormEvent } from "react";

const initialFormState = { title: "", details: "" };

type NewCardFormProps = {
  onAdd: (title: string, details: string) => void;
};

export const NewCardForm = ({ onAdd }: NewCardFormProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [formState, setFormState] = useState(initialFormState);

  const close = () => {
    setIsOpen(false);
    setFormState(initialFormState);
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formState.title.trim()) {
      return;
    }
    onAdd(formState.title.trim(), formState.details.trim());
    close();
  };

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="w-full rounded-full border border-dashed border-[var(--stroke)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--primary-blue)] transition hover:border-[var(--primary-blue)]"
      >
        Add a card
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(3,33,71,0.45)] px-6"
          onClick={close}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-card-heading"
            className="w-full max-w-sm rounded-[28px] border border-[var(--stroke)] bg-white p-6 shadow-[var(--shadow)]"
            onClick={(event) => event.stopPropagation()}
          >
            <h3
              id="new-card-heading"
              className="font-display text-lg font-semibold text-[var(--navy-dark)]"
            >
              Add a card
            </h3>
            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <input
                autoFocus
                value={formState.title}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, title: event.target.value }))
                }
                placeholder="Card title"
                className="w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm font-medium text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
                required
              />
              <textarea
                value={formState.details}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, details: event.target.value }))
                }
                placeholder="Details"
                rows={3}
                className="w-full resize-none rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm text-[var(--gray-text)] outline-none transition focus:border-[var(--primary-blue)]"
              />
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="rounded-full bg-[var(--secondary-purple)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-110"
                >
                  Add card
                </button>
                <button type="button" onClick={close} className="rounded-full border border-[var(--stroke)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
