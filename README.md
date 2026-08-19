# Bali Interactive Itinerary Planner

![Version](https://img.shields.io/badge/version-1.5-green)
![Stack](https://img.shields.io/badge/stack-HTML%2FCSS%2FJS--no--backend-orange)

A fully client-side, interactive travel-planning web app that generates a **personalized day-by-day Bali itinerary** from a 4-question quiz. All logic runs in the browser — no backend, no database, no build step. Live at [https://bali-itinerary-planner.netlify.app](https://bali-itinerary-planner.netlify.app).

---

## ✨ Features

### Core Experience

| Feature | Description |
|---|---|
| **4-Question Quiz** | Trip duration, budget tier, trip type + interests, preferred region — answers persist in `localStorage` and support resume/edit via `?edit=1` |
| **Smart Itinerary Engine** | Builds a daily schedule from 141 curated activities (48 free) with realistic inter-region driving times and auto-inserted meal breaks |
| **Zero-Repeat Guarantee** | An activity never reappears within a 3-day window; a 20-activity alternatives pool eliminates duplicates entirely — rest days are created only if the pool is exhausted |
| **Regional Rotation** | Long trips (10+ days) rotate through Ubud, Seminyak, Canggu, Uluwatu, Nusa Penida, and North Bali with a recent-region penalty |
| **Flex Days** | Trips of 10+ days include flexible "relax" days with 7 fresh swap-in suggestions |
| **Dark Mode** | Toggle with preference saved to `localStorage` |
| **Day 1 Preview** | Free preview of the first day to build trust before any paywall |

### Traveler Deliverables

| Feature | Implementation |
|---|---|
| **Interactive Map** | Leaflet 1.9.4 — day-colored markers, click-for-details popups, auto-fit bounds |
| **PDF Export** | jsPDF 2.5.1 — printable multi-page plan with activity thumbnails and sanitized Indonesian text |
| **Calendar Export** | Full-plan `.ics` download + one-click "Add Day 1 to Google Calendar" |
| **Booking Links** | One-click links to GetYourGuide, Klook, and official activity sites |
| **Rainy-Day Backups** | Toggle swaps any outdoor activity for a covered indoor alternative |
| **Share / Edit / Rate** | Shareable plan link, answer re-edit, star rating widget |

---

## 🏗 Project Structure

```
.
├── index.html                 # Landing page with pitch + quiz entry
├── quiz.html                  # 4-question quiz (js/quiz.js)
├── result.html                # Generated itinerary + PDF/map/calendar actions
├── contact.html / privacy.html
├── robots.txt / sitemap.xml / netlify.toml
├── css/style.css              # Theme: Bali green #2E7D32, gold #F9A825 (dark mode included)
├── js/
│   ├── quiz.js                # Quiz logic + answer persistence
│   ├── itinerary-engine.js    # Recommendation engine (filtering, rotation, zero-repeat, flex days)
│   ├── result.js              # Result rendering, PDF/map/calendar wiring
│   ├── map-calendar.js        # Leaflet map init, ICS, Google Calendar
│   ├── pdf-generator.js       # jsPDF plan generation
│   ├── gumroad-integration.js # Payment overlay (temporarily disabled)
│   ├── dark-mode.js           # Dark mode toggle
│   └── analytics.js           # GA4 event tracking (G-ID placeholder)
├── data/activities.json       # 141 activities (48 free, 20 alternatives)
├── assets/images/             # Activity photos (webp in production)
└── reports/                   # Phase-by-phase improvement reports
```

---

## ⚙️ How the Engine Works

1. **`filterActivities(activities, filters)`** — keyword-matches interests and `bestFor` trip-type tags, applies per-tier budget ceilings with margin, scores results by rating + relevance + a soft region boost (score bonus, never a hard filter).
2. **`buildDailyItinerary(filtered, tripDuration, budgetTier, preferredRegion)`** — generates a region rotation for long trips, schedules 3 main activities + an evening bonus per day (with automatic lunch/dinner break rows on trips over 10 days), balances free-vs-paid slots by budget tier, enforces zero repetition with a 3-day gap rule, falls back to the 20-activity alternatives pool and automatic Rest Days when exhausted, frees days 13–14 as flex days, adds realistic driving times (e.g., Ubud → Uluwatu ≈ 1.6 h), auto-includes a full-day private driver (~$40–65/day, excluded from flex days), and flags days with >4 h of driving.
3. **`generateInsiderTips(activity)`** — returns the insider tip from the database.

---

## 🚀 Deployment

**Live site:** [https://bali-itinerary-planner.netlify.app](https://bali-itinerary-planner.netlify.app)

The repository is connected to the Netlify site, so **every push to `master` automatically rebuilds and deploys** — no manual steps needed.

Local development (no toolchain required):

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Note: `result.html` fetches `data/activities.json`, so it works over HTTP(S) only, not `file://`.

---

## 💳 Payment Gateway — Temporarily Disabled

The Gumroad payment overlay ($19 launch / $29 regular) has been **removed** so all features are freely accessible. The integration is preserved for easy re-enablement.

**To re-enable payments:**
1. Create the product on [Gumroad](https://gumroad.com) and copy its product ID.
2. Restore the `<div id="unlock-banner">` block and the two Gumroad `<script>` tags in `result.html`.
3. Replace `your-product-id` in `result.html` and `js/gumroad-integration.js`.
4. The locked-feature logic (`applyPurchaseState` in `js/result.js`) is already in place.

---

## 📊 Analytics

`js/analytics.js` tracks `start_quiz`, `complete_quiz`, `download_pdf`, and `gumroad_click` events. Add your GA4 **G-ID** measurement ID to activate tracking.

---

## ✅ QA Test Scenarios

| Scenario | Expected |
|---|---|
| 5 days, budget, solo | 5 days planned, activities ≤ ~$15–19 avg, zero repeats |
| 14 days, budget, family | Region rotation across the island, flex days, 0 close-repeats |
| Preferred region = Ubud | Days clustered around Ubud, drive hours ≤ 2 h |
| PDF button | Downloads `bali-itinerary-{type}-{days}d.pdf` with thumbnails |
| Rainy toggle | Outdoor activities struck through, indoor backup per day |
| ICS / Google Cal | `.ics` downloads all events; GCal opens Day 1 event |
| Map | 10+ tiles + all activity markers render on fresh page load |

---

## 📝 Version History

| Version | Highlights |
|---|---|
| v1.5 (current) | 4-question quiz, 141 activities (48 free), zero-repeat engine with 20-activity alternatives, dark mode, Day 1 preview, share/edit/rate, map auto-init fix |
| v1.4 | Flex days for 10+ day trips, 4 slots/day, meal-break rows, smarter region sweep, 136 activities |
| v1.3 | Anti-duplication engine, 16 free activities, free/paid balance by tier, green free-activity cards, soft region boost |
| v1.2 | Rainy-day backups, private driver, local price savings, 90 activity photos, Leaflet map, ICS/GCal export, GA4 |
| v1.1 | Map + calendar + analytics integration |
| v1.0 | Initial 6-question quiz MVP with PDF export |

---

*Private repository — all rights reserved.*
