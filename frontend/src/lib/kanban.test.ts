import { moveCard, type Column } from "@/lib/kanban";

describe("moveCard", () => {
  const baseColumns: Column[] = [
    { id: 1, title: "A", cardIds: [10, 20] },
    { id: 2, title: "B", cardIds: [30] },
  ];

  it("reorders cards in the same column", () => {
    const result = moveCard(baseColumns, 20, 10);
    expect(result[0].cardIds).toEqual([20, 10]);
  });

  it("moves cards to another column", () => {
    const result = moveCard(baseColumns, 20, 30);
    expect(result[0].cardIds).toEqual([10]);
    expect(result[1].cardIds).toEqual([20, 30]);
  });

  it("drops cards to the end of a column", () => {
    const result = moveCard(baseColumns, 10, 2);
    expect(result[0].cardIds).toEqual([20]);
    expect(result[1].cardIds).toEqual([30, 10]);
  });
});
