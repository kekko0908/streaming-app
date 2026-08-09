import { expect, test } from "@playwright/test";

test("reindirizza le rotte protette e mostra il login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/auth$/);
  await expect(page.getByRole("heading", { name: "Area Riservata" })).toBeVisible();
  await expect(page.getByPlaceholder("Email")).toHaveAttribute("autocomplete", "email");
  await expect(page.getByPlaceholder("Password")).toHaveAttribute("autocomplete", "current-password");
});

test("il controllo password è accessibile e non crea overflow orizzontale", async ({ page }) => {
  await page.goto("/auth");
  const password = page.getByPlaceholder("Password");
  await expect(password).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Mostra password" }).click();
  await expect(password).toHaveAttribute("type", "text");
  const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width);
});
