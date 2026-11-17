import { test, expect, type Page } from "@playwright/test";

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1000) < 700;

test("main research journey", async ({ page, context }) => {
  // 1. homepage communicates the research question
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("railroads");
  await expect(page.getByTestId("home-stats")).toContainText("Texas towns");

  // 2. navigate to the Railroad Explorer
  if (isMobile(page)) { await page.getByRole("button", { name: "Menu" }).click(); }
  await page.getByRole("link", { name: "Railroad Explorer" }).first().click();
  await expect(page).toHaveURL(/\/explorer/);
  await expect(page.getByTestId("rail-map")).toHaveAttribute("data-ready", "1", { timeout: 45_000 });

  // 3. select a documented network year
  await page.getByTestId("year-1889").click();
  await expect(page.getByTestId("year-1889")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("recorded as operating by 1889")).toBeVisible();

  // 4. select a real town
  await page.getByTestId("town-search").fill("Denison");
  await page.getByRole("button", { name: /Denison/ }).first().click();
  await expect(page.getByTestId("town-panel")).toContainText("Denison");

  // 5. open its profile
  await page.getByTestId("open-profile").click();
  await expect(page).toHaveURL(/\/towns\/denison-grayson/);
  await expect(page.getByTestId("town-name")).toHaveText("Denison");

  // 6. inspect population history (real verified census counts must be present)
  const obs = page.getByTestId("obs-table");
  await expect(obs).toContainText("1960");
  await expect(obs).toContainText("22,748");
  await expect(page.getByTestId("chart").first()).toBeVisible();

  // 7. compare with another town
  await page.getByTestId("compare-link").click();
  await expect(page).toHaveURL(/\/compare\?a=denison-grayson/);
  await page.getByTestId("pick-b").selectOption("sherman-grayson");
  await expect(page.getByTestId("compare-table")).toContainText("Sherman");
  await expect(page.getByTestId("compare-table")).toContainText("Denison");

  // 8-9. research lab with a genuine model result
  await page.goto("/lab");
  await page.getByTestId("tab-B").click();
  await expect(page.getByTestId("model-b-table")).toContainText("Track ≤ 2 km by 1911");
  await expect(page.getByText(/n = \d{3}/).first()).toBeVisible();

  // 10. archival citation resolves to a census publication page
  await page.goto("/towns/denison-grayson");
  const cite = page.getByTestId("citation-link").first();
  const href = await cite.getAttribute("href");
  expect(href).toMatch(/^https:\/\/www2\.census\.gov\/library\/publications\/decennial\/.+\.pdf#page=\d+$/);

  // 11. download a permissible research artifact
  await page.goto("/data");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("dl-raileffect_towns_analysis.csv").click()]);
  expect(download.suggestedFilename()).toBe("raileffect_towns_analysis.csv");
  const path = await download.path();
  const fs = await import("node:fs");
  const head = fs.readFileSync(path!, "utf8").split("\n")[0];
  expect(head).toContain("first_served");
  void context;
});

test("all primary routes render without errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  for (const r of ["/", "/explorer", "/towns", "/lab", "/findings", "/case-studies", "/methodology", "/data", "/compare?a=cisco-eastland&b=abilene-taylor"]) {
    const res = await page.goto(r);
    expect(res?.status(), r).toBe(200);
    await expect(page.locator("main")).not.toBeEmpty();
  }
  await page.goto("/findings");
  await expect(page.getByTestId("stat-towns")).toContainText(/\d{3}/);
  expect(errors).toEqual([]);
});

test("unknown town returns 404", async ({ page }) => {
  const res = await page.goto("/towns/not-a-real-town");
  expect(res?.status()).toBe(404);
});

test("no horizontal page overflow", async ({ page }) => {
  for (const r of ["/", "/explorer", "/towns", "/towns/denison-grayson", "/lab", "/findings", "/case-studies", "/methodology", "/data"]) {
    await page.goto(r);
    await page.waitForTimeout(400);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(over, r).toBeLessThanOrEqual(1);
    // no section/card may extend past the viewport edge
    const wide = await page.evaluate(() => Array.from(document.querySelectorAll("main section, main figure")).filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1).length);
    expect(wide, r).toBe(0);
  }
});
