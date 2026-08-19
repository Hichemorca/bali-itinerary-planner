# Bali Interactive Itinerary Planner

A static, fully client-side website that generates personalized day-by-day Bali itineraries through a 6-question quiz, with a downloadable PDF, interactive map, calendar export, and Gumroad payment integration.

## New in v3 (Anti-Duplication + Free Activities)

- **Anti-duplication engine**: every activity use is recorded with its day and role; an activity can never reappear within a 3-day window. When the pool is exhausted, repeats are demoted to secondary/evening roles — they never appear as a day's main event twice.
- **16 new free activities** (`isFree: true`): secret beaches, temples, markets, viewpoints — database now has **106 activities** in `data/activities.json`.
- **Free/paid balance by budget tier**: budget = 50% free, mid-range = 30%, luxury = 10%, with per-day targets and smart fallbacks when one pool runs out.
- **FREE badge**: free activities render with a green card, "🆓 FREE ACTIVITY" pill, "Free" price, and a "no booking required" notice — on both the result page and the PDF.
- **Regional rotation**: long trips auto-distribute days across Bali regions (preferred region → second coast → Uluwatu → day trips → return), with a soft preference (+40 score) instead of the previous hard region filter.
- Full details in `reports/phase4-dedup-report.md`.

## New in v1.4 (Long-Trip Engine Upgrade)

- **+15 free activities** (`isFree: true`, ids 107–121): Kuta Beach Walk, Jimbaran Bay Sunset, Sanur Promenade, Uluwatu Cliffs Walk, Tegenungan Top View, Goa Gajah grounds, Taman Ayun garden, Seseh Beach, Munduk Trek, Ulun Danu grounds, Banyumala Twin Falls View, Lovina Sunrise — database now **121 activities** (28 free) in `data/activities.json`.
- **Flex days** for trips longer than 10 days: days 13–14 have no fixed schedule and no driver; instead the plan suggests 7 fresh options with a gold "Flex Day" card (site + PDF).
- **4 slots per day on long trips**: 3 main/daytime activities + an evening bonus, plus auto-inserted **lunch (12:30–13:30) and dinner (19:00–20:00) break rows** with local price guidance.
- **Smarter region rotation**: a logical island-wide sweep (preferred region → Canggu/Seminyak → Uluwatu → Nusa Penida → North Bali → restart) with a **4-day recent-region penalty** that pushes the plan to rotate regions instead of clustering.
- Bug fixes: break rows excluded from the map and ICS export; PDF cover no longer repeats the budget word.
- Full details in `reports/phase5-improvements-report.md`.

## New in v2 (Advanced Improvements)

- **6th quiz question**: rainy-day backup preference, with an on-result toggle that swaps any outdoor activity for a covered indoor alternative
- **Private driver**: auto-included in every plan (~$40–65/day) with a per-plan cost summary and a >4h/day drive warning
- **Local price savings**: every activity shows potential savings when booked locally vs. online platforms, with a plan-level savings summary
- **Activity photos**: 90 real photos (Unsplash/Pexels, webp, lazy-loaded) displayed in result cards and the PDF
- **Interactive Leaflet map**: day-colored markers with popups for all scheduled activities
- **Calendar export**: full-plan `.ics` download + per-activity "Add to Google Calendar" buttons
- **Google Analytics 4**: funnel events (quiz_start → quiz_complete → view_result → buy_click → purchase → download_pdf/download_ics/add_to_google_calendar)
- **Performance**: `loading="lazy"` images, preconnect hints, optional minified build (`build/`)

## Project Structure

```
bali-itinerary-planner/
├── index.html              # Landing page (SEO-optimized)
├── quiz.html               # 6-question interactive quiz with progress bar
├── result.html             # Itinerary result page with PDF, map, calendar + Gumroad unlock
├── thank-you.html          # Post-purchase thank-you page
├── privacy.html            # Privacy & cookie policy
├── contact.html            # Contact/support page
├── robots.txt / sitemap.xml / netlify.toml
├── css/style.css           # Theme: Bali green #2E7D32, gold #F9A825
├── js/
│   ├── quiz.js             # Quiz logic (answers stored in localStorage)
│   ├── itinerary-engine.js # filterActivities(), buildDailyItinerary() (dedup engine, flex days, region sweep), generateInsiderTips()
│   ├── pdf-generator.js    # jsPDF-based printable PDF generator
│   ├── result.js           # Result page rendering, PDF button, rainy toggle, email capture
│   ├── map-calendar.js     # Leaflet map + Google Cal / ICS export
│   ├── analytics.js        # GA4 funnel tracking + lazy-load init
│   └── gumroad-integration.js # Gumroad overlay events + purchase state
├── data/activities.json    # 121 Bali activities (prices, links, tips, images, localPrice, isFree)
├── assets/images/          # hero-bg.jpg + 90 activity photos (act-1..90.webp); newer free activities reuse existing images
└── reports/                # phase4-dedup-report.md (v3) + phase5-improvements-report.md (v1.4)
```

## How the Engine Works

1. **`filterActivities(activities, filters)`** — filters 141 activities by interest/category keyword match and `bestFor` trip-type tags, applies per-activity budget ceilings (per tier, 1.25× margin), scores results by rating + relevance + soft region boost (`regionBoost = 40` for the day's target region — region preference is a score bonus, not a hard filter).
2. **`buildDailyItinerary(filtered, tripDuration, budgetTier, preferredRegion)`** — generates a day-by-day region rotation for long trips, schedules activities per day (3 main + secondary + evening bonus; 3 main + evening bonus with automatic lunch/dinner break rows on trips over 10 days), balances free vs. paid slots by tier (50/30/10%), zero-repetition scheduler (hard ban on any previously used activity, checked against the latest recorded use across all roles, with the 20-activity alternative pool and automatic Rest Days when no fresh activity fits; the older free/paid round-robin indexes are retained as secondary selectors), on trips longer than 10 days frees days 13–14 as flex days with 7 fresh suggestions instead of a fixed schedule, rotates regions via an island-wide sweep with a 4-day recent-region penalty, adds realistic inter-region driving times (e.g., Ubud→Uluwatu = 1.6h), auto-includes a full-day private driver (except on flex days), flags days with >4h of driving, and generates rainy-day indoor swaps when requested.
3. **`generateInsiderTips(activity)`** — returns the insider tip from the database.

## Running Locally

Serve the folder with any static server (root must be the project folder):

```bash
cd bali-itinerary-planner
python3 -m http.server 8000
# visit http://localhost:8000
```

Note: `result.html` fetches `data/activities.json`, so it only works over HTTP(S), not `file://`.

## Deploy to Netlify

Drag the folder into Netlify Drop, or:

```bash
netlify deploy --prod --dir=.
```

`netlify.toml` already configures clean URLs (`/quiz`, `/result`) and caching.

## Deploy to Vercel

Add a `vercel.json` with `"buildCommand": "echo ok", "outputDirectory": "."` and `rewrites` for `/quiz` and `/result`.

## Gumroad Setup (do this before launch)

1. Create a Gumroad account (no business registration needed).
2. Create product: **"Bali Bespoke Itinerary — Interactive Planner"**, fixed price **$29** (use discount codes for the $19 first-100-customers launch offer).
3. Upload the sample PDF generated by the site as the digital deliverable.
4. Set **After purchase → redirect** to `https://yourdomain.com/thank-you.html`.
5. Copy your product permalink (e.g., `bali-bespoke-itinerary`) and:
   - Replace `your-product-id` in `js/gumroad-integration.js` (`GUMROAD_PRODUCT_ID`)
   - Replace `https://gum.co/your-product-id` in `result.html` (unlock banner link)

Gumroad collects the buyer's email automatically; the site also offers an optional email capture form above the unlock banner.

## QA Test Scenarios (run before launch)

| Scenario | Expected |
|---|---|
| 5 days, budget, solo, adventure | ~4-5 days planned, activities ≤ $15-19 avg |
| 10 days, luxury, honeymoon, relaxation+food | Premium activities, romantic pacing |
| 7 days, mid, family, all interests | Kid-safe picks, drive warnings |
| Preferred region = Ubud | Days clustered around Ubud, travel hours ≤ 2h |
| PDF button | Downloads `bali-itinerary-{type}-{days}d.pdf` (works in Chrome/Firefox/Safari) |
| Rainy toggle | Outdoor activities get struck through and an indoor backup card appears for each day |
| ICS / Google Cal buttons | `.ics` downloads with all events; Google Cal opens per-activity events |
| Map | Markers render for all days; popups show time + name + price |
| Gumroad flow | Overlay opens → checkout → banner turns "Unlocked" |

## Updating the Database

Re-run the conversion script from Phase 1 (`build_json.py` against `bali_activities_database.xlsx`) whenever activities or prices change, and bump `metadata.version` in `activities.json`.

## Tech Stack

Tailwind CSS (CDN), Font Awesome (CDN), jsPDF 2.5.1 (CDN), Leaflet 1.9.4 (CDN), Poppins + Inter (Google Fonts), localStorage for state, Gumroad Overlay for payments. No build step, no backend.

## Performance Build (optional)

Minified copies live in `build/` (`npm install terser -g` then run `bash build.sh`), referenced by cache-busted filenames from `index-prod.html` / `quiz-prod.html` / `result-prod.html` — or simply rely on Netlify/Brotli compression; the plain build already ships well under 1MB.
