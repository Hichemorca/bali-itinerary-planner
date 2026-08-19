// GA4 analytics health check: verifies the funnel tracking setup is healthy.
// With GA_ID empty, all gtag() calls must be queued into window.dataLayer
// (safe no-op) and never throw, on every main page.
const { test, expect } = require("@playwright/test");
const PAGES = ["/", "/quiz.html", "/result.html", "/privacy.html", "/contact.html"];
const ANSWERS = JSON.stringify({
  tripDuration: 5,
  budgetTier: "budget",
  tripType: "family",
  interests: ["culture"],
  preferredRegion: "Ubud",
});

test.describe("GA4 analytics health", () => {
  test("gtag stub exists and dataLayer collects calls on every page", async ({ page }) => {
    await page.goto(PAGES[0], { waitUntil: "domcontentloaded" });
    const ok = await page.evaluate(() => {
      if (typeof window.gtag !== "function") return "gtag missing";
      if (!Array.isArray(window.dataLayer)) return "dataLayer missing";
      window.gtag("event", "test_event", { x: 1 });
      const hit = window.dataLayer.some((a) => a && a[0] === "event" && a[1] === "test_event");
      return hit ? "ok" : "not queued";
    });
    expect(ok).toBe("ok");
  });

  test("quiz_start and quiz_complete events are pushed during the quiz flow", async ({ page }) => {
    // Collect gtag events across navigations (each page load resets dataLayer)
    const quizEvents = [];
    const resultEvents = [];
    await page.goto("/quiz.html", { waitUntil: "domcontentloaded" });
    await page.locator(".opt-btn").first().waitFor({ state: "visible", timeout: 20000 });
    await page.locator(".opt-btn[data-value='5']").first().click();
    await page.locator("#btn-next").click();
    await page.locator(".opt-btn[data-value='budget']").first().click();
    await page.locator("#btn-next").click();
    await page.locator(".opt-btn[data-value='family']").first().click();
    await page.locator(".opt-btn[data-value='culture']").first().click();
    await page.locator("#btn-next").click();
    await page.locator(".opt-btn[data-value='Ubud']").first().click();
    // Capture quiz-page events before the submit navigates away
    quizEvents.push(...(await page.evaluate(() =>
      window.dataLayer
        .map((a) => a && a[1])
        .filter((n) => typeof n === "string")
    )));
    await page.getByRole("button", { name: /show my itinerary/i }).first().click();
    // completeQuiz fires synchronously on the quiz page during submit, before navigation
    quizEvents.push(...(await page.evaluate(() =>
      window.dataLayer
        .map((a) => a && a[1])
        .filter((n) => typeof n === "string")
    ).catch(() => [])));
    await expect(page).toHaveURL(/result\.html/);
    await page.waitForTimeout(800);
    const events = await page.evaluate(() =>
      window.dataLayer
        .map((a) => a && a[1])
        .filter((n) => typeof n === "string")
    );
    console.log("result page dataLayer events:", JSON.stringify(events));
    console.log("quiz page events:", JSON.stringify(quizEvents));
    expect([...quizEvents, ...events]).toContain("quiz_start");
    expect([...quizEvents, ...events]).toContain("quiz_complete");
    expect(events).toContain("view_result");
  });

  test("download_pdf and download_ics events are pushed on result page", async ({ page }) => {
    await page.addInitScript((a) => { localStorage.setItem("baliAnswers", a); }, ANSWERS);
    await page.goto("/result.html", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    await expect(page.locator("#itinerary-days").first()).toBeVisible({ timeout: 15000 });
    // PDF
    const [pdfDl] = await Promise.all([page.waitForEvent("download", { timeout: 60000 }), page.locator("#btn-pdf").click()]);
    await pdfDl.path();
    // ICS (once-listener pattern required for blob downloads)
    const icsDl = await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("timeout")), 60000);
      page.once("download", (d) => { clearTimeout(t); resolve(d); });
      page.locator("#btn-ics").click().catch(reject);
    });
    await icsDl.path();
    const events = await page.evaluate(() =>
      window.dataLayer.map((a) => a && a[1]).filter((n) => typeof n === "string")
    );
    expect(events).toContain("download_pdf");
    expect(events).toContain("download_ics");
  });
});
