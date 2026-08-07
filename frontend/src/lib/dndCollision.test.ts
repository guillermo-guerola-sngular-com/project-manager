import { describe, expect, it } from "vitest";
import type { Active, ClientRect, DroppableContainer, RectMap } from "@dnd-kit/core";
import { createCollisionDetectionStrategy } from "@/lib/dndCollision";
import type { Column } from "@/lib/kanban";

const rect = (top: number, bottom: number): ClientRect => ({
  top,
  bottom,
  left: 0,
  right: 200,
  width: 200,
  height: bottom - top,
});

const container = (id: number): DroppableContainer =>
  ({
    id,
    key: id,
    data: { current: undefined },
    disabled: false,
    node: { current: null },
    rect: { current: null },
  }) as unknown as DroppableContainer;

const active = (id: number): Active =>
  ({
    id,
    data: { current: undefined },
    rect: { current: { initial: null, translated: null } },
  }) as unknown as Active;

// One column, three cards stacked with gaps between them (as the real
// flex "gap-3" layout leaves gaps no card rect covers), matching the DOM
// shape the strategy is built for.
const COLUMN: Column = { id: 1, title: "Col", cardIds: [10, 20, 30] };

describe("createCollisionDetectionStrategy", () => {
  it("resolves a drop in the gap between cards to the nearest card, not the column", () => {
    const droppableRects: RectMap = new Map([
      [1, rect(0, 300)],
      [10, rect(0, 95)],
      [20, rect(100, 195)],
      [30, rect(210, 300)],
    ]);
    const droppableContainers = [container(1), container(10), container(20), container(30)];

    const strategy = createCollisionDetectionStrategy([COLUMN]);
    const collisions = strategy({
      active: active(99),
      collisionRect: rect(200, 210),
      droppableRects,
      droppableContainers,
      pointerCoordinates: { x: 100, y: 205 },
    });

    expect(collisions[0]?.id).toBe(30);
  });

  it("excludes the actively dragged card from its own column's refinement", () => {
    const droppableRects: RectMap = new Map([
      [1, rect(0, 300)],
      [10, rect(0, 95)],
      [20, rect(100, 195)],
      [30, rect(210, 300)],
    ]);
    const droppableContainers = [container(1), container(10), container(20), container(30)];

    const strategy = createCollisionDetectionStrategy([COLUMN]);
    const collisions = strategy({
      // Card 20 is being dragged. Its collision rect (how far the dragged
      // item currently is) sits exactly on top of its own stored rect's
      // center — the scenario that made same-column reordering silently
      // fail before the active card was excluded from its own refinement.
      active: active(20),
      collisionRect: rect(140, 155),
      droppableRects,
      droppableContainers,
      pointerCoordinates: { x: 100, y: 205 },
    });

    expect(collisions[0]?.id).not.toBe(20);
    expect(collisions[0]?.id).toBe(10);
  });
});
