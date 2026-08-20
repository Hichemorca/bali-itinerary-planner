# Bali Interactive Itinerary Planner

A static, fully client-side website that generates personalized day-by-day Bali itineraries through a **4-question quiz**, with a downloadable PDF, interactive Leaflet map, calendar export (ICS + Google Calendar), shareable plan links, and dark mode. No backend, no build step — everything runs in the browser and deploys to Netlify as plain static files.

**Live:** [bali-itinerary-planner.netlify.app](https://bali-itinerary-planner.netlify.app)

> **Note:** the Gumroad payment gateway is **temporarily disabled** — the site is free to use. The placeholder `your-product-id` remains in `js/gumroad-integration.js` until a product is created; when ready, follow the "Gumroad Setup" section below.

## Latest: v8 — Seasonal Activities & Day Substitution (Phase 13)

The site now features a curated **seasonal events database** (`data/seasonal.json`) with **25 Bali festivals and seasonal activities** (Nyepi, Galungan, Bali Arts Festival, Ubud Food Festival, Kite Festival, Christmas markets, full-moon ceremonies and more), each with start/end month ranges, price ranges (free events included), region, best time of day and slot (morning/afternoon/evening).

1. **Homepage banner** (`index.html` + `js/seasonal.js`): an attractive card banner showcases up to 4 upcoming/current events closest to today's month, each with icon, region, date range and price. "Book in My Plan" links to the quiz carrying the picked event.
2. **Result-page panel**: a Seasonal Highlights section lists events relevant to the traveler, each with an **Add to a Day** button.
3. **Day substitution**: picking a day opens a modal listing each day's main activity; on confirmation the day's main activity is **replaced by the seasonal event in its matching time slot** (morning/afternoon/evening placement), and the event shows as a golden seasonal row. Swaps persist via `localStorage` and re-apply on reload/print/PDF/ICS export. Nyepi is handled as a no-travel notice.

**Tests:** `tests/seasonal-schema.test.js` (627 data-schema + 46 logic assertions: month ranges incl. year-wrap, prices, free-event consistency, monthly coverage) and `tests/seasonal-ui.test.js` (5 Playwright tests: banner rendering, booking redirect, swap modal flow, reload persistence). Full suite: **25,088 engine assertions + 23 UI/analytics/seasonal tests — all green** on CI and locally.

## Latest archive: v7 — Budget Balance & Transparency (Phase 12)

A 5-day budget-tier trip previously showed only free activities because the full-day private driver ($40–65/day) consumed 37–54% of the $120/day budget cap. Three changes fix this:

1. **Tier-based driver cost** (`js/itinerary-engine.js`): the daily estimate now uses the driver's negotiated local rate (`localPrice`, ~$40/day) for the **budget** tier instead of the standard average price; mid and luxury keep the average rate. `driverDailyCost` and `activityCostPerDay` are returned in the plan object for transparent breakdowns.
2. **Budget-tier driver note** (`js/result.js`): on the result page, budget plans get guidance for cheaper alternatives — negotiate the local rate with your hotel, Klook/Traveloka, or swap days for shared tourist shuttles ($5–10/seat) and scooter rentals (~$6/day).
3. **Daily budget breakdown bar**: a new `#budget-breakdown` strip under the plan header shows **~$X/day driver + ~$Y/day activities = ~$Z/day total** as a green/gold split bar, so travelers immediately see how their daily estimate is composed (meals/hotels/flights excluded).

**Tests:** 12 new engine assertions verify the tier cost logic (`budget < mid`, `budget <= $40`, breakdown fields present across all tiers), and a new Playwright test confirms the breakdown bar renders with both segments. Full suite: **25,088 engine assertions + 18 UI/analytics tests — all green**, on CI and locally.

## Latest archive: v6 — SEO, Social Sharing & CI (Phase 11)

Every page now ships with a complete SEO head block: `meta description`, `keywords`, `author`, canonical URL, full Open Graph set (title/description/type/URL/image/dimensions/alt/site name/locale) and Twitter Card (`summary_large_image` with image + alt). The landing page and quiz page carry **JSON-LD structured data** (`WebSite` + `SoftwareApplication` with rating markup on the index; `WebPage` with `isPartOf` on quiz/result/privacy/contact). A custom **1200×630 social sharing card** (`assets/images/og-social-card.png`) is generated from Python/Pillow in the Bali green/gold theme. `sitemap.xml` lists only the indexable pages (result page stays `noindex` by design).

GA4 tracking (`js/analytics.js`) was hardened: the `dataLayer` is initialized before `gtag`, the stub is a fully safe no-op when `GA_ID` is empty, and the GA config now sends `page_location`/`page_title` with every `page_view`. **Three automated analytics health tests** (`tests/analytics.test.js`, Playwright) verify the stub, the quiz funnel (`quiz_start` → `quiz_complete` → `view_result`, captured across page navigation), and the result-page actions (`download_pdf`, `download_ics`).

**GitHub Actions CI is live and green**: `.github/workflows/ci.yml` runs the full suite (`npm test` = engine + 17 UI tests) on every push/PR to `master` (Node 22, Chromium pre-installed, local `http.server` on port 8000). The Netlify deploy workflow gracefully skips when the `NETLIFY_AUTH_TOKEN` secret is not set (production deploys are managed via the sandbox). A `package-lock.json` was added because `setup-node`'s npm cache requires it.

## Archive: v5 — Automated Test Suite (Phase 10)

- **Engine tests** (`tests/engine.test.js`, Node.js): **25,076 assertions** across **all 648 possible quiz combinations** (4 durations × 3 budgets × 3 trip types × 6 interests × 9 regions), verifying zero-repeat scheduling, free/paid balance, meal breaks, flex days, region rotation, and stats consistency. **All green.**
- **UI tests** (`tests/ui.test.js`, Playwright): **14 browser tests** that actually click through the site — full quiz flow, PDF download, ICS calendar download (validates `BEGIN:VCALENDAR` content), Google Calendar links, share link prefill, edit-plan mode, star rating, email capture, rainy-day toggle, dark mode, back-to-top, and a no-JavaScript-errors-on-load check. **14/14 passing.**
- **Run everything:** `npm test` (or `npm run test:engine` / `npm run test:ui`). GitHub Actions runs the suite on every push.
- **Bugs the tests found and fixed:** 20 alternative activities (IDs 122–141) had `interests` stored as a comma-string instead of an array — they never matched any quiz interest and were effectively invisible; rest-day flag was applied per day instead of capped at 2 per trip; evening bonus activities consumed the activity pool without being scheduled; flex-day options could exhaust on very long trips; a `classList.toggle` multi-class call threw `InvalidCharacterError` on every scroll; blob-URL ICS download needed a pre-registered listener plus a delayed `revokeObjectURL` in headless Chromium.
- Full details in `reports/phase10-test-suite-report.md`.

## Project Structure

```
bali-itinerary-planner/
├── index.html              # Landing page (SEO-optimized)
├── quiz.html               # 4-question interactive quiz with progress bar
├── result.html             # Itinerary result page: plan, PDF, map, calendar, share
├── privacy.html / contact.html
├── robots.txt / sitemap.xml / netlify.toml
├── css/style.css           # Theme: Bali green #2E7D32, gold #F9A825
├── js/
│   ├── quiz.js             # Quiz logic (answers stored in localStorage)
│   ├── itinerary-engine.js # filterActivities(), buildDailyItinerary()
│   ├── pdf-generator.js    # jsPDF-based printable PDF generator
│   ├── result.js           # Result page rendering + share/edit/rating/dark-mode
│   ├── map-calendar.js     # Leaflet map + Google Cal / ICS export
│   ├── analytics.js        # GA4 funnel tracking
│   └── gumroad-integration.js # DISABLED (payment gateway off)
├── data/activities.json    # 141 Bali activities (48 free, 20 alternatives)
├── assets/images/          # activity photos (webp, lazy-loaded)
├── tests/                  # engine.test.js + ui.test.js (Phase 10) + analytics.test.js (Phase 11)
├── .github/workflows/      # ci.yml (npm test on push/PR) + netlify-deploy.yml
├── playwright.config.js    # UI test config
└── reports/                # Arabic phase reports
```

## How the Engine Works

1. **`filterActivities(activities, filters)`** — filters 141 activities by interest/category keyword match and `bestFor` trip-type tags, applies per-activity budget ceilings per tier, scores results by rating + relevance + soft region boost (`regionBoost = 40`; region preference is a score bonus, not a hard filter). A defensive `Array.isArray` guard protects the alternative pool (IDs 122–141).
2. **`buildDailyItinerary(filtered, tripDuration, budgetTier, preferredRegion)`** — generates a day-by-day region rotation, schedules activities per day (3 main + evening bonus on long trips, with auto-inserted lunch 12:30–13:30 and dinner 19:00–20:00 break rows), balances free vs. paid slots by tier (budget 50% / mid 30% / luxury 10%), **zero-repetition scheduler** (hard ban on any previously used activity; 20-activity alternative pool plus automatic Rest Days when no fresh activity fits, capped at 2 rest days per trip; unused evening bonus picks are returned to the pool), flex days with a layered fallback on long trips, island-wide region sweep with recent-region penalty, realistic inter-region driving times, full-day private driver (~$40–65/day) except on rest/flex days, >4h driving warnings, and rainy-day indoor swaps.
3. **`generateInsiderTips(activity)`** — returns the insider tip from the database.

## Features by Page

- **Quiz:** 4 questions (duration, budget, trip type + interests, preferred region) with a 60-second Day 1 preview on completion.
- **Result page:** day-by-day plan cards, price stats, interactive map with day-colored markers and popups, PDF export, full-plan `.ics` download, per-activity Google Calendar buttons, shareable encoded link (prefills the quiz for editing), star rating, optional email capture, rainy-day backup toggle, dark mode, and a back-to-top button.

## Running Locally

```bash
npm install        # dev dependencies only (Playwright for tests)
npm test           # engine + UI test suite
npx playwright install chromium   # one-time, for UI tests
npm run serve      # or: python3 -m http.server 8000
# visit http://localhost:8000
```

Note: `result.html` fetches `data/activities.json`, so it only works over HTTP(S), not `file://`.

## Deploy to Netlify

Drag the folder into Netlify Drop, or:

```bash
netlify deploy --prod --dir=.
```

`netlify.toml` already configures clean URLs, caching, and security headers.

## Gumroad Setup (when ready to monetize)

1. Create a Gumroad account (no business registration needed).
2. Create product: **"Bali Bespoke Itinerary — Interactive Planner"**, fixed price **$29**.
3. Upload the sample PDF generated by the site as the digital deliverable.
4. Set **After purchase → redirect** to `https://yourdomain.com/thank-you.html`.
5. Replace `your-product-id` in `js/gumroad-integration.js` (`GUMROAD_PRODUCT_ID`) and in `result.html`, then re-enable the banner and overlay scripts.

## Updating the Database

Re-run the conversion script from Phase 1 (`build_json.py` against `bali_activities_database.xlsx`) whenever activities or prices change, bump `metadata.version` in `activities.json`, and re-run `npm test` — the suite will verify the new data matches every quiz combination.

## Tech Stack

Tailwind CSS (CDN), Font Awesome (CDN), jsPDF 2.5.1 (CDN), Leaflet 1.9.4 (CDN), Poppins + Inter (Google Fonts), localStorage for state, Playwright 1.62 + Node.js for testing. No build step, no backend.

## Performance Build (optional)

Minified copies live in `build/` (`npm install terser -g` then run `bash build.sh`), referenced by cache-busted filenames from `index-prod.html` / `quiz-prod.html` / `result-prod.html` — or simply rely on Netlify/Brotli compression; the plain build already ships well under 1MB.
