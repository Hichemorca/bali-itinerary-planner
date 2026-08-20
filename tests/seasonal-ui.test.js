/**
 * Seasonal banner & swap flow UI tests (Phase 13)
 */
const { test, expect } = require("@playwright/test");

const BASE = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:8000";
const QUIZ_ANSWERS = {
  tripDuration: 5,
  budgetTier: "mid",
  tripType: "solo",
  interests: ["adventure", "culture"],
  preferredRegion: "Ubud",
};

test.describe("Homepage seasonal banner", () => {
  test("banner shows seasonal event cards with dates and prices", async ({ page }) => {
    await page.goto(BASE + "/index.html", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#seasonal-banner section")).toBeVisible({ timeout: 20000 });
    // At least one card card
    const cards = page.locator("#seasonal-banner [data-seasonal-id]");
    await expect(cards.first()).toBeVisible({ timeout: 10000 });
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(1);
    // Each card shows date and price area
    const card = page.locator("#seasonal-banner .fa-calendar-days");
    await expect(card.first()).toBeVisible();
  });

  test("Book in My Plan stores the picked seasonal id and redirects to quiz", async ({ page }) => {
    await page.goto(BASE + "/index.html", { waitUntil: "domcontentloaded" });
    const firstId = await page.locator("#seasonal-banner [data-seasonal-id]").first().getAttribute("data-seasonal-id");
    expect(firstId).toMatch(/^S\d+$/);
    // Listen for navigation then click
    const navPromise = page.waitForURL("**/quiz.html");
    await page.locator("#seasonal-banner [data-seasonal-id]").first().click();
    await navPromise;
    const stored = await page.evaluate(() => localStorage.getItem("baliSeasonalPicked"));
    expect(stored).toBe(firstId);
  });
});

test.describe("Result page seasonal panel and swap", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((answers) => localStorage.setItem("baliAnswers", JSON.stringify(answers)), QUIZ_ANSWERS);
  });

  test("seasonal panel renders with Add-to-Day buttons", async ({ page }) => {
    await page.goto(BASE + "/result.html", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#itinerary-days").or(page.locator(".day-card")).first()).toBeVisible({ timeout: 15000 });
    // The seasonal panel may render a touch later (fetch + retry under slow links),
    // so poll for at least one trigger until the plan has rendered.
    const triggerCount = await page.locator("#seasonal-panel button.seasonal-swap-trigger").first().waitFor({ state: "visible", timeout: 20000 }).then(() =>
      page.locator("#seasonal-panel button.seasonal-swap-trigger").count()
    ).catch(async () => {
      await page.waitForTimeout(1500);
      return page.locator("#seasonal-panel button.seasonal-swap-trigger").count();
    });
    expect(triggerCount).toBeGreaterThanOrEqual(1);
    await expect(page.locator("#seasonal-panel .fa-location-dot").first()).toBeVisible();
  });

  test("adding a seasonal event replaces the day activity at the right slot", async ({ page }) => {
    await page.goto(BASE + "/result.html", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#itinerary-days").or(page.locator(".day-card")).first()).toBeVisible({ timeout: 15000 });
    // Open the swap modal via the panel
    const trigger = page.locator("#seasonal-panel button.seasonal-swap-trigger").first();
    await trigger.waitFor({ state: "visible", timeout: 20000 }).catch(async () => {
      await page.waitForTimeout(1500);
    });
    await expect(trigger).toBeVisible({ timeout: 10000 });
    await trigger.click();
    const modal = page.locator("#seasonal-swap-modal");
    await expect(modal).toBeVisible({ timeout: 10000 });
    // Modal shows day choices
    const dayBtn = modal.locator("button.seasonal-day-pick").first();
    await expect(dayBtn).toBeVisible();
    const dayNum = await dayBtn.getAttribute("data-day");
    // Capture day-1 main activity name before swap
    const beforeRows = page.locator(`#day-${dayNum} .activity-row`);
    const firstBefore = await beforeRows.first().locator(".activity-name").textContent();
    await dayBtn.click();
    // Modal closes and the row is marked seasonal
    await expect(modal).toBeHidden({ timeout: 10000 });
    const swappedRow = page.locator(`#day-${dayNum} .activity-row.seasonal-row`).first();
    await expect(swappedRow).toBeVisible({ timeout: 10000 });
    const afterName = await swappedRow.locator(".activity-name").textContent();
    expect(afterName).not.toBe(firstBefore);
    expect(afterName.length).toBeGreaterThan(3);
    // Persistence
    const swaps = await page.evaluate(() => JSON.parse(localStorage.getItem("baliSeasonalSwaps") || "[]"));
    expect(swaps.length).toBe(1);
    expect(String(swaps[0].dayNum)).toBe(dayNum);
    expect(swaps[0].seasonalId).toMatch(/^S\d+$/);
  });

  test("saved swaps re-apply on page reload", async ({ page }) => {
    await page.goto(BASE + "/result.html", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#itinerary-days").or(page.locator(".day-card")).first()).toBeVisible({ timeout: 15000 });
    const trigger = page.locator("#seasonal-panel button.seasonal-swap-trigger").first();
    await trigger.waitFor({ state: "visible", timeout: 20000 }).catch(async () => {
      await page.waitForTimeout(1500);
    });
    await expect(trigger).toBeVisible({ timeout: 10000 });
    await trigger.click();
    await page.locator("#seasonal-swap-modal button.seasonal-day-pick").first().click();
    await expect(page.locator(".activity-row.seasonal-row").first()).toBeVisible({ timeout: 10000 });
    const seasonalId = await page.locator(".activity-row.seasonal-row").first().getAttribute("data-seasonal-id");
    expect(seasonalId).toMatch(/^S\d+$/);
    // Reload (fresh page, same localStorage) — swapped event now shows an "Added" button, not a swap trigger
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("#itinerary-days").or(page.locator(".day-card")).first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator(".activity-row.seasonal-row").first()).toBeVisible({ timeout: 15000 });
    const reId = await page.locator(".activity-row.seasonal-row").first().getAttribute("data-seasonal-id");
    expect(reId).toBe(seasonalId);
    // The seasonal panel should still reference the event (Added state for swapped event)
    await expect(page.locator("#seasonal-panel").locator("[data-seasonal-id=" + seasonalId + "]").first()).toBeVisible({ timeout: 15000 });
  });
});
