import { expect, test, type Page } from "@playwright/test";
import { login } from "./utils";

test.beforeEach(async ({ page }) => {
  await login(page);
});

const findColumnByTitle = async (page: Page, title: string) => {
  const columns = page.locator('[data-testid^="column-"]');
  const count = await columns.count();
  for (let i = 0; i < count; i++) {
    const column = columns.nth(i);
    const value = await column.locator("input").first().inputValue();
    if (value === title) {
      return column;
    }
  }
  throw new Error(`No column found with title "${title}"`);
};

test("loads the kanban board", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
});

test("adds a card to a column and it survives a reload", async ({ page }) => {
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill("Playwright card");
  await firstColumn.getByPlaceholder("Details").fill("Added via e2e.");
  await firstColumn.getByRole("button", { name: /add card/i }).click();
  await expect(firstColumn.getByText("Playwright card")).toBeVisible();

  await page.reload();
  const firstColumnAfterReload = page.locator('[data-testid^="column-"]').first();
  await expect(firstColumnAfterReload.getByText("Playwright card")).toBeVisible();
});

test("edits a card via the popup, and deletes it only after confirming", async ({ page }) => {
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill("Editable card");
  await firstColumn.getByRole("button", { name: /add card/i }).click();
  await expect(firstColumn.getByText("Editable card")).toBeVisible();

  // exact: true, since dnd-kit gives the whole card role="button" too, with an
  // accessible name that contains this button's — an unanchored/fuzzy match
  // would resolve to both.
  await firstColumn.getByRole("button", { name: "Edit Editable card", exact: true }).click();
  await page.getByPlaceholder("Card title").fill("Edited card");
  await page.getByRole("button", { name: /save changes/i }).click();
  await expect(firstColumn.getByText("Edited card")).toBeVisible();

  await page.reload();
  const firstColumnAfterReload = page.locator('[data-testid^="column-"]').first();
  await expect(firstColumnAfterReload.getByText("Edited card")).toBeVisible();

  // canceling the confirmation must not delete the card
  await firstColumnAfterReload.getByRole("button", { name: "Delete Edited card", exact: true }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(firstColumnAfterReload.getByText("Edited card")).toBeVisible();

  await firstColumnAfterReload.getByRole("button", { name: "Delete Edited card", exact: true }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(firstColumnAfterReload.getByText("Edited card")).not.toBeVisible();
});

test("moves a card between columns and it survives a reload", async ({ page }) => {
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  const targetColumn = await findColumnByTitle(page, "Review");
  const card = firstColumn.locator('[data-testid^="card-"]').first();
  const cardTestId = await card.getAttribute("data-testid");

  const cardBox = await card.boundingBox();
  const columnBox = await targetColumn.boundingBox();
  if (!cardBox || !columnBox || !cardTestId) {
    throw new Error("Unable to resolve drag coordinates.");
  }

  await page.mouse.move(
    cardBox.x + cardBox.width / 2,
    cardBox.y + cardBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    columnBox.x + columnBox.width / 2,
    columnBox.y + 120,
    { steps: 12 }
  );
  await page.mouse.up();
  await expect(targetColumn.getByTestId(cardTestId)).toBeVisible();

  await page.reload();
  const targetColumnAfterReload = await findColumnByTitle(page, "Review");
  await expect(targetColumnAfterReload.getByTestId(cardTestId)).toBeVisible();
});
