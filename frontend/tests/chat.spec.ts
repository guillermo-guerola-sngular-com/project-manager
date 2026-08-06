import { expect, test } from "@playwright/test";
import { login } from "./utils";

test.beforeEach(async ({ page }) => {
  await login(page);
});

test("sends a chat instruction that adds a card, which appears without a manual reload", async ({
  page,
}) => {
  const firstColumn = page.locator('[data-testid^="column-"]').first();

  await page.getByLabel("Chat message").fill('Add a card called "Playwright AI card" to the Backlog column.');
  await page.getByRole("button", { name: "Send", exact: true }).click();

  // One assertion covering the full chain (AI round trip, then the board
  // refetch it triggers) rather than splitting into two waits — a card that
  // only shows up in the sidebar's own reply text (which echoes the card
  // name) must not satisfy this, so the locator is scoped to the column.
  await expect(firstColumn.getByText("Playwright AI card")).toBeVisible({ timeout: 30_000 });
});

test("answers a plain question in the sidebar without changing the board", async ({ page }) => {
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  const cardCountBefore = await firstColumn.locator('[data-testid^="card-"]').count();

  await page.getByLabel("Chat message").fill("What's the weather like today?");
  await page.getByRole("button", { name: "Send", exact: true }).click();

  await expect(page.locator("aside li").last()).toBeVisible({ timeout: 30_000 });
  await expect(firstColumn.locator('[data-testid^="card-"]')).toHaveCount(cardCountBefore);
});
