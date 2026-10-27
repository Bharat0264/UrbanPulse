import { test, expect } from "@playwright/test";
test("landing, navigation, shared filters, charts, exports and forecast", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Cities Move. Data Reveals Why." }),
  ).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
  await page.screenshot({
    path: "../docs/landing-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("link", { name: "Enter Intelligence Dashboard" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Command Center." }),
  ).toBeVisible();
  await expect(page.getByText("Total trips", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "../docs/command-desktop.png",
    fullPage: true,
  });
  const pending = page.waitForResponse(
    (r) =>
      r.url().includes("/api/dashboard/overview?") &&
      r.url().includes("Manhattan"),
  );
  await page.getByLabel("Borough", { exact: true }).selectOption("Manhattan");
  const response = await pending;
  expect(response.status()).toBe(200);
  await page.getByRole("link", { name: /Mobility Analytics/ }).click();
  await expect(
    page.getByRole("heading", { name: "Mobility Analytics." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Switch to accessible 2D" }).click();
  await expect(page.locator("canvas").first()).toBeVisible();
  await page.getByRole("link", { name: /Predictive Intelligence/ }).click();
  await expect(
    page.getByText("Next-hour prediction", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: /Spark Processing Lab/ }).click();
  await expect(
    page.getByText("Pipeline completed", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: /Geographic Intelligence/ }).click();
  await expect(page.locator(".geo-fallback .geo-zone").first()).toBeVisible();
  expect(await page.locator(".geo-fallback .geo-zone").count()).toBeGreaterThan(50);
  const zoneId = await page
    .locator(".geo-fallback .geo-zone")
    .first()
    .getAttribute("data-zone-id");
  await page.locator(".geo-fallback .geo-zone").first().click();
  await expect(page.getByLabel("Zone", { exact: true })).toHaveValue(zoneId!);
  await page.getByRole("button", { name: "2D view", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Enable 3D", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("mobile layout fits viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app");
  await expect(page.getByText("Total trips", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "../docs/command-mobile.png", fullPage: true });
  await expect(
    page.getByRole("link", { name: /Geographic Intelligence/ }),
  ).toBeVisible();
});
