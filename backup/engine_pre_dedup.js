/* ============================================================
 * Bali Interactive Itinerary Planner — Recommendation Engine
 * Functions: filterActivities, buildDailyItinerary, generateInsiderTips
 * Data source: data/activities.json (90 activities, v1.0)
 * ============================================================ */

// ---------- Region travel time (hours) ----------
// Approximate average one-way driving times between Bali regions (includes typical traffic)
const TRAVEL_TIMES = {
  "Ubud-Ubud": 0.4, "Ubud-Seminyak": 1.0, "Ubud-Canggu": 1.1, "Ubud-Uluwatu": 1.6,
  "Ubud-Nusa Penida": 2.2, "Ubud-North Bali": 1.6, "Ubud-Kuta": 1.0, "Ubud-Multi-region": 1.4,
  "Seminyak-Seminyak": 0.3, "Seminyak-Canggu": 0.5, "Seminyak-Uluwatu": 1.3,
  "Seminyak-Nusa Penida": 2.0, "Seminyak-North Bali": 1.9, "Seminyak-Kuta": 0.4,
  "Seminyak-Multi-region": 1.2, "Seminyak-Ubud": 1.0,
  "Canggu-Canggu": 0.4, "Canggu-Uluwatu": 1.5, "Canggu-Nusa Penida": 2.1,
  "Canggu-North Bali": 2.0, "Canggu-Kuta": 0.6, "Canggu-Multi-region": 1.3, "Canggu-Ubud": 1.1,
  "Uluwatu-Uluwatu": 0.5, "Uluwatu-Nusa Penida": 2.0, "Uluwatu-North Bali": 2.3,
  "Uluwatu-Kuta": 0.8, "Uluwatu-Multi-region": 1.6, "Uluwatu-Ubud": 1.6, "Uluwatu-Seminyak": 1.3,
  "Uluwatu-Canggu": 1.5,
  "Nusa Penida-Nusa Penida": 0.4, "Nusa Penida-Anywhere": 2.0,
  "North Bali-North Bali": 0.6, "North Bali-Anywhere": 1.8,
  "Kuta-Kuta": 0.3, "Kuta-Multi-region": 1.2, "Kuta-Anywhere": 1.3,
  "Multi-region-Multi-region": 1.2, "Multi-region-Anywhere": 1.4,
};

// ---------- Budget tier limits ----------
const BUDGET_LIMITS = {
  budget: { maxPerDay: 50,  maxPerActivity: 15 },
  mid:    { maxPerDay: 150, maxPerActivity: 60 },
  luxury: { maxPerDay: 500, maxPerActivity: 250 },
};

// Trip type -> matching bestFor tags
const TRIP_TYPE_TAGS = {
  solo: ["solo"],
  family: ["family"],
  honeymoon: ["honeymoon", "couples"],
  friends: ["friends"],
  nomad: ["nomad", "solo"],
  adventure: ["adventure", "solo", "friends"],
};

// Interest -> category keyword match
const INTEREST_KEYWORDS = {
  adventure: ["adventure", "sport", "watersport"],
  culture:   ["culture", "history", "temple", "dance", "art"],
  nature:    ["nature", "beach", "waterfall", "marine"],
  relaxation:["relaxation", "wellness", "spa", "shopping", "beach"],
  food:      ["food", "culinary", "market"],
};

/**
 * Travel time between two activities' regions (approx hours)
 */
function travelTime(a, b) {
  if (!a || !b) return 0;
  if (a.region === b.region) {
    const key = `${a.region}-${b.region}`;
    return TRAVEL_TIMES[key] || 0.5;
  }
  const key = `${a.region}-${b.region}`;
  if (TRAVEL_TIMES[key]) return TRAVEL_TIMES[key];
  const rev = `${b.region}-${a.region}`;
  if (TRAVEL_TIMES[rev]) return TRAVEL_TIMES[rev];
  return TRAVEL_TIMES[`${a.region}-Anywhere`] || TRAVEL_TIMES[`${b.region}-Anywhere`] || 1.5;
}

/**
 * filterActivities(activities, filters)
 * filters = { tripDuration, budgetTier, tripType, interests[], rainyBackup, preferredRegion }
 * Returns scored array of matching activities (sorted by relevance score).
 */
function filterActivities(activities, filters) {
  const { budgetTier = "mid", tripType = "solo", interests = [], rainyBackup = false, preferredRegion = "none" } = filters;
  const limits = BUDGET_LIMITS[budgetTier] || BUDGET_LIMITS.mid;
  const allowedTripTags = TRIP_TYPE_TAGS[tripType] || ["solo"];
  const regionFilter = preferredRegion && preferredRegion !== "none" ? preferredRegion : null;

  const scored = [];
  for (const act of activities) {
    let keep = true;

    // 1. Region filter
    if (regionFilter && act.region !== regionFilter && act.region !== "Multi-region") keep = false;

    // 2. Budget filter (activity avg price within tier; transport excluded from per-activity filter)
    const avgPrice = (act.priceLow + act.priceHigh) / 2;
    if (keep && act.category.indexOf("Transport") !== 0 && avgPrice > limits.maxPerActivity * 1.25) keep = false;

    // 3. Interest/category match
    let interestScore = 0;
    if (interests.length > 0) {
      for (const inter of interests) {
        const keywords = INTEREST_KEYWORDS[inter] || [];
        const catLower = (act.category || "").toLowerCase();
        for (const kw of keywords) {
          if (catLower.indexOf(kw) !== -1) {
            interestScore += 2;
            break;
          }
        }
        if (act.interests && act.interests.includes(inter)) interestScore += 2;
      }
      if (keep && interestScore === 0) keep = false;
    }

    // 4. Trip type (bestFor) match
    let tripScore = 0;
    if (act.bestFor && act.bestFor.length) {
      for (const t of act.bestFor) {
        if (allowedTripTags.indexOf(t.toLowerCase()) !== -1) { tripScore += 2; break; }
      }
      if (tripScore === 0 && act.bestFor.length === 1) {
        // Only strict single-tag activities that don't match are deprioritized, not killed
        tripScore -= 1;
      }
    }

    if (!keep) continue;

    // Relevance score: rating + trip match + interest match + regional preference bonus
    let score = 40 + (act.rating || 4) * 8;
    score += interestScore * 3;
    score += tripScore * 3;
    if (regionFilter && act.region === regionFilter) score += 10;
    // Small randomness for variety on re-runs
    score += Math.random() * 4;

    scored.push({ act, score });
  }

  scored.sort((x, y) => y.score - x.score);
  return scored.map(s => s.act);
}

/**
 * buildDailyItinerary(filteredActivities, tripDuration, preferredRegion)
 * Returns { days: [...], estimatedActivityCostPerDay, totalTravelHoursWarnings }
 * Each day: { dayNum, activities: [{act, startTime, endTime, travelBefore}], travelHours, warning }
 */
function buildDailyItinerary(filteredActivities, tripDuration, preferredRegion) {
  if (!filteredActivities || filteredActivities.length === 0) {
    return { days: [], estimatedActivityCostPerDay: 0, warnings: [] };
  }

  const START_HOUR = 8.5;            // days start at 8:30 AM
  const MAX_ACTIVE_HOURS = 10.5;     // day ends ~7:00 PM
  const MIN_PER_ACTIVITY = 3;        // never schedule more than ~4 items in a day

  // Prepend a private driver / transport option so every plan has logistics covered
  let transport = filteredActivities.find(a => a.category.indexOf("Transport") === 0);
  const activityPool = filteredActivities.filter(a => a.category.indexOf("Transport") !== 0);
  // If no transport activity in the filtered pool, add the default Private Driver (id 89)
  if (!transport) {
    transport = filteredActivities.find(a => a.id === 89);
    if (!transport && filteredActivities.length) {
      transport = { id: -1, name: "Private Driver (custom route)", region: "Multi-region", category: "Transport / Driver", priceLow: 45, priceHigh: 65, duration: 10, location: "Island-wide", bookingLink: "", platform: "Local agency", rating: 4.7, insiderTip: "Full-day private driver typically costs IDR 650k-900k (~$45-65) with fuel and parking. Negotiate with your villa/hotel or use Klook/Traveloka.", bestFor: [], bestTime: "08:00 AM", bestTimeNote: "", imageUrl: "", localPrice: 40 };
    }
  }

  const days = [];
  let poolIndex = 0;
  let warnings = [];
  let totalActivityCost = 0;
  let totalActivityCount = 0;

  for (let d = 0; d < tripDuration; d++) {
    const day = { dayNum: d + 1, activities: [], travelHours: 0, warning: null };
    let clock = START_HOUR;
    let lastActivity = null;

    // One main activity (3-5h) + one secondary (2-3h) + optional evening option
    const slots = [null, null, null]; // main, secondary, evening

    for (let s = 0; s < 3; s++) {
      // Pick next unused activity from pool (round-robin, skipping repeats)
      let attempts = 0;
      let candidate = null;
      while (attempts < activityPool.length && !candidate) {
        if (poolIndex >= activityPool.length) poolIndex = 0;
        const a = activityPool[poolIndex++];
        // Avoid repeating the same activity within 2 days
        const recentlyUsed = days.slice(-2).flatMap(dd => dd.activities.map(x => x.act.id));
        if (recentlyUsed.indexOf(a.id) === -1) candidate = a;
        attempts++;
      }
      if (!candidate) {
        // Pool exhausted: pick best-rated activity overall not in this plan
        const usedIds = new Set(days.flatMap(dd => dd.activities.map(x => x.act.id)));
        const best = filteredActivities
          .filter(a => !usedIds.has(a.id) && a.category.indexOf("Transport") !== 0)
          .sort((x, y) => (y.rating || 0) - (x.rating || 0))[0];
        candidate = best || null;
      }
      if (!candidate) break;

      const tt = lastActivity ? travelTime(lastActivity, candidate) : 0;
      const needed = tt + candidate.duration + (s === 2 ? 0.5 : 0.5);

      if (s === 2 && clock + needed > MAX_ACTIVE_HOURS) {
        // Not enough room for the evening option; keep it as a "bonus" note instead
        day.bonus = candidate;
        continue;
      }

      day.activities.push({
        act: candidate,
        startTime: fmtTime(clock + tt),
        endTime: fmtTime(clock + tt + candidate.duration),
        travelBefore: tt > 0 ? `${tt.toFixed(1)} hrs drive` : null,
      });

      // Warn if a single transfer leg exceeds 4 hours
      if (tt > 4) {
        day.warning = `Very long transfer today (${tt.toFixed(1)} hrs). Start before 6:30 AM and ask your driver to break it up with a coffee stop.`;
      }

      clock += tt + candidate.duration;
      day.travelHours += tt;
      lastActivity = candidate;

      if (s === 0 && candidate.priceHigh) totalActivityCost += (candidate.priceLow + candidate.priceHigh) / 2;
      totalActivityCount++;
    }

    // Crowd / overload warning
    const maxTravel = (preferredRegion === "none") ? 4.5 : 2.5;
    if (day.activities.length > 3) {
      day.warning = "This day is packed — consider moving one activity to a rest day.";
    } else if (day.travelHours > maxTravel) {
      day.warning = "Heavy driving today. Start early and consider splitting this day if possible.";
    } else if (day.travelHours > 2 && preferredRegion !== "none") {
      day.warning = "You're visiting another region today — leave by mid-morning.";
    }
    if (day.activities.length === 0) {
      day.activities.push({
        act: { name: "Free & flexible day", region: "-", category: "Rest / Optional",
          priceLow: 0, priceHigh: 0, duration: 0, bestTime: "Your pace", location: "Around your base",
          bookingLink: "", platform: "", rating: null,
          insiderTip: "Use this day for villa time, a spa, or spontaneous exploring.", bestFor: [] },
        startTime: "—", endTime: "—", travelBefore: null,
      });
    }

    days.push(day);
  }

  // Budget summary: approximate daily activity spend (activities + average driver cost)
  const transportCost = transport ? (transport.priceLow + transport.priceHigh) / 2 : 30;
  const avgCostPerDay = totalActivityCount > 0
    ? Math.round(totalActivityCost / tripDuration + transportCost)
    : 0;

  return { days, estimatedActivityCostPerDay: avgCostPerDay, warnings, transport };
}

function fmtTime(h) {
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  const suffix = hrs >= 12 ? "PM" : "AM";
  const h12 = hrs > 12 ? hrs - 12 : hrs === 0 ? 12 : hrs;
  return `${h12}:${mins === 0 ? "00" : String(mins).padStart(2, "0")} ${suffix}`;
}

/**
 * generateInsiderTips(activity)
 * Returns the insider tip string from the database (with a fallback).
 */
function generateInsiderTips(activity) {
  if (activity && activity.insiderTip) return activity.insiderTip;
  return "Book early in high season (July-Aug, Dec-Jan) and always carry cash for entry fees.";
}

// ---------- Rainy-day indoor alternatives ----------
// Indoor/covered activities suitable as rainy-day swaps (from the 90-activity pool)
const INDOOR_CATEGORIES = ["Wellness", "Food", "Culture (Indoor)", "Wellness / Spa", "Shopping", "Indoor Play", "Culture"];
const INDOOR_KEYWORDS = ["spa", "massage", "cooking", "yoga", "dance", "class", "museum", "indoor", "shopping", "mall", "workshop", "painting", "jewelry", "candle", "playground"];

function isOutdoor(act) {
  if (!act) return true;
  const haystack = ((act.category || "") + " " + (act.name || "")).toLowerCase();
  for (const kw of INDOOR_KEYWORDS) {
    if (haystack.includes(kw)) return false;
  }
  if (IN_DOOR_TAGS.includes(act.category)) return false;
  return true;
}
// Activities definitively indoor by category name
const IN_DOOR_TAGS = ["Wellness", "Food", "Shopping", "Culture (Indoor)"];

// Outdoor categories that need swaps when raining
const OUTDOOR_KEYWORDS = ["beach", "waterfall", "rafting", "trek", "snorkel", "dolphin", "swim", "surf", "nature", "mount", "river", "cliff", "diving", "watersport", "swing", "atv", "quadr", "park (day)", "safari"];

/**
 * rainyBackupFor(outdoorAct, allActivities)
 * Returns the best indoor alternative near the same region (or multi-region).
 */
function rainyBackupFor(act, allActivities) {
  const score = (a) => {
    let s = (a.rating || 4) * 10;
    if (a.region === act.region) s += 20;
    if (a.region === "Multi-region") s += 10;
    if (a.priceLow >= 0 && a.priceHigh <= 100) s += 5;
    return s;
  };
  const candidates = allActivities.filter(a => !isOutdoor(a) && a.id !== act.id);
  candidates.sort((x, y) => score(y) - score(x));
  return candidates[0] || null;
}

// Expose engine globally for page scripts
window.BaliEngine = { filterActivities, buildDailyItinerary, generateInsiderTips, travelTime, rainyBackupFor };
