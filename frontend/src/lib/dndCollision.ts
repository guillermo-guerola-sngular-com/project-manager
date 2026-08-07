import {
  closestCenter,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
} from "@dnd-kit/core";
import type { Column } from "@/lib/kanban";

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
export const createCollisionDetectionStrategy = (columns: Column[]): CollisionDetection => (args) => {
  const pointerCollisions = pointerWithin(args);
  const collisions = pointerCollisions.length > 0 ? pointerCollisions : rectIntersection(args);
  const firstCollision = collisions[0];
  const column = columns.find((c) => c.id === firstCollision?.id);

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
