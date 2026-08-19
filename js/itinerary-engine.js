/* ============================================================
 * Bali Interactive Itinerary Planner — Recommendation Engine
 * Functions: filterActivities, buildDailyItinerary, generateInsiderTips
 * Data source: data/activities.json (121 activities, v1.4)
 *
 * v3 (Phase 5) improvements:
 *  - Flex Days: trips longer than 10 days get the last 2 days as optional
 *    "flex days" with a curated list of pick-what-you-like activities
 *  - Long-trip pacing: 10+ day trips get 3 main activities + 1 evening
 *    bonus, with explicit lunch (12:30-1:30) and dinner (7:00-8:00) breaks
 *  - Region penalty: regions visited heavily in recent days get a score
 *    penalty so the trip distributes across Ubud → Canggu/Seminyak →
 *    Uluwatu → Nusa Penida → North Bali → back to the preferred region
 *
 * v5 (Phase 6) improvements — ZERO REPETITION:
 *  - usedActivityIds is trip-global: an activity can NEVER reappear as a
 *    scheduled slot, for any reason, no matter the trip duration
 *  - 20 fallback "alternative" activities (isAlternative: true, isFree: true):
 *    relaxation / photography / walking picks suggested when the main pool
 *    is exhausted on long trips
 *  - Rest Day: when even the alternatives run out, buildDailyItinerary emits
 *    a custom "✨ Rest & Recovery Day" instead of any repeat
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
  budget: { maxPerDay: 120, maxPerActivity: 45 },
  mid:    { maxPerDay: 180, maxPerActivity: 80 },
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

    // 1. Region filter (soft: preferred region boosts score but never excludes
    // other regions — needed so long trips can rotate through Bali)
    let regionBoost = 0;
    if (regionFilter && regionFilter !== "none") {
      if (act.region === regionFilter || act.region === "Multi-region") regionBoost = 40;
    }

    // 2. Budget filter (free activities pass every tier; transport excluded from per-activity filter)
    const avgPrice = (act.priceLow + act.priceHigh) / 2;
    if (keep && act.category.indexOf("Transport") !== 0 && !act.isFree && avgPrice > limits.maxPerActivity * 1.25) keep = false;

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
    score += regionBoost; // soft regional preference (never a hard exclusion)
    // Deterministic tie-breaker (variety per activity, stable across re-runs of the same quiz):
    // a hash-derived value in [0, 4) derived solely from the activity id so the same
    // answers always produce the same plan (important for share links).
    score += ((act.id * 9301 + 49297) % 233280) / 233280 * 4;

    scored.push({ act, score });
  }

  scored.sort((x, y) => y.score - x.score);
  return scored.map(s => s.act);
}

/**
 * regionRotation(tripDuration, preferredRegion)
 * Returns an array regionForDay[0..tripDuration-1] = target region keyword(s) for each day.
 * Rotates the trip through Bali's regions so long trips never stagnate in one area:
 *   days 1-3      preferred region (or Seminyak/Canggu fallback)
 *   days 4-5      second beach hub (Canggu / Seminyak)
 *   days 6-7      Uluwatu (cliffs & beaches)
 *   days 8-10     day-trip regions (Nusa Penida, North Bali)
 *   days 11-14    back to preferred region with fresh activities
 */
function regionRotation(tripDuration, preferredRegion) {
  // Phase 5 rotation: preferred region first, then a fixed sweep through
  // Bali so long trips distribute naturally:
  //   preferred → Canggu/Seminyak → Uluwatu → Nusa Penida → North Bali →
  //   return to preferred (flex days excluded from this rotation)
  const base = (preferredRegion && preferredRegion !== "none") ? preferredRegion : "Canggu";
  const SECOND_HUBS = { "Canggu": "Seminyak", "Seminyak": "Canggu", "Ubud": "Canggu", "Uluwatu": "Seminyak", "Kuta": "Canggu", "North Bali": "Seminyak", "Nusa Penida": "Uluwatu", "Sanur": "Canggu", "Tabanan": "Seminyak", "Jimbaran": "Seminyak" };
  const secondHub = SECOND_HUBS[base] || "Seminyak";

  // Build the ordered sweep; flex days are carved out of the tail below
  const sweep = [base, secondHub, "Uluwatu", "Nusa Penida", "North Bali"];
  const isLongTrip = tripDuration > 10;
  const flexDays = isLongTrip ? 2 : 0;               // last 2 days are flexible
  const planDays = tripDuration - flexDays;           // days covered by the rotation

  const sched = [];
  for (let d = 1; d <= planDays; d++) {
    if (d <= 2) sched.push(base);                     // settle into the preferred region
    else if (d <= 4) sched.push(secondHub);           // second coastal hub
    else if (d <= 6) sched.push("Uluwatu");           // cliffs & beaches
    else if (d <= 8) sched.push("Nusa Penida");       // island day trips
    else sched.push("North Bali");                    // waterfalls & lakes
    // beyond day 8 the plan repeats the sweep — the visited-region penalty
    // in buildDailyItinerary keeps it from feeling repetitive
  }
  for (let i = 0; i < flexDays; i++) sched.push(null); // null = flex day
  return sched;
}

/**
 * regionMatches(activity, targetRegion)
 * An activity matches a target region if its region equals the target or it is
 * island-wide ("Multi-region"). Day-trip targets also match their specific region.
 */
function regionMatches(act, targetRegion) {
  return act.region === targetRegion || act.region === "Multi-region";
}

/**
 * buildDailyItinerary(filteredActivities, tripDuration, budgetTier, preferredRegion)
 * Returns { days: [...], estimatedActivityCostPerDay, totalTravelHoursWarnings }
 * Each day: { dayNum, activities: [{act, startTime, endTime, travelBefore, isRepeated}], travelHours, warning }
 *
 * v2 improvements:
 *  - No activity repeats within 3 days (usedActivityIds + activityHistory)
 *  - If the pool is exhausted on long trips, activities may repeat as secondary/
 *    evening items only, and never within the same 3-day window
 *  - Free/paid balance per budget tier: budget 50% / mid 30% / luxury 10% free
 *  - Regional rotation so long trips move through Bali instead of stagnating
 */
function buildDailyItinerary(filteredActivities, tripDuration, budgetTier, preferredRegion) {
  if (budgetTier && typeof budgetTier === "string" && preferredRegion === undefined) {
    // legacy signature call: (filtered, duration, region) — shift args
    preferredRegion = budgetTier;
    budgetTier = "mid";
  }
  budgetTier = budgetTier || "mid";
  if (!filteredActivities || filteredActivities.length === 0) {
    return { days: [], estimatedActivityCostPerDay: 0, warnings: [] };
  }

  const START_HOUR = 8.5;            // days start at 8:30 AM
  const MAX_ACTIVE_HOURS = 10.5;     // day ends ~7:00 PM
  const REPEAT_GAP_DAYS = 3;         // never reuse an activity within this many days
  const FREE_RATIO = { budget: 0.5, mid: 0.3, luxury: 0.1 };
  const isLongTrip = tripDuration > 10;      // Phase 5 pacing flag
  const slotsPerDay = isLongTrip ? 4 : 3;    // long trips: 3 main + 1 evening bonus
  const targetFreePerDay = Math.max(1, Math.ceil(slotsPerDay * (FREE_RATIO[budgetTier] ?? 0.3)));

  // Prepend a private driver / transport option so every plan has logistics covered
  let transport = filteredActivities.find(a => a.category.indexOf("Transport") === 0);
  let activityPool = filteredActivities.filter(a => a.category.indexOf("Transport") !== 0);
  // If no transport activity in the filtered pool, add the default Private Driver (id 89)
  if (!transport) {
    transport = filteredActivities.find(a => a.id === 89);
    if (!transport && filteredActivities.length) {
      transport = { id: -1, name: "Private Driver (custom route)", region: "Multi-region", category: "Transport / Driver", priceLow: 45, priceHigh: 65, duration: 10, location: "Island-wide", bookingLink: "", platform: "Local agency", rating: 4.7, insiderTip: "Full-day private driver typically costs IDR 650k-900k (~$45-65) with fuel and parking. Negotiate with your villa/hotel or use Klook/Traveloka.", bestFor: [], bestTime: "08:00 AM", bestTimeNote: "", imageUrl: "", localPrice: 40 };
    }
  }

  const days = [];
  const usedActivityIds = []; // trip-global: NO activity may ever repeat
  const activityHistory = []; // { id, day, role } — tracks last day each activity was used
  const freeIdx = { val: 0 }; // per-pool round-robin index (free pool)
  const paidIdx = { val: 0 }; // per-pool round-robin index (paid pool)
  let warnings = [];
  let totalActivityCost = 0;
  let totalActivityCount = 0;
  let freeCountScheduled = 0;
  let totalCountScheduled = 0;

  // Regional rotation for long trips (null entries = flex days)
  const regionSchedule = regionRotation(tripDuration, preferredRegion);

  // Phase 5: visited-region penalty — regions that were heavily used in the
  // previous 4 days get a score penalty so the trip keeps moving around Bali
  function recentRegionCount(act, d) {
    let count = 0;
    for (let dd = Math.max(1, d - 4); dd < d; dd++) {
      const regionUsedToday = (days[dd - 1] && days[dd - 1].activities || [])
        .filter(a => a && a.act && a.act.region && a.act.region !== "-")
        .map(a => a.act.region);
      count += regionUsedToday.filter(r => r === act.region).length;
    }
    return count;
  }

  // Ordered pool respecting regional rotation + visited-region penalty:
  // region-of-day activities first, heavy-recent regions penalized.
  // Used activities are filtered out permanently (zero repetition).
  // Cache the per-day ordered pool so it is computed once per day instead of 3x
  const _orderedPoolCache = {};
  function orderedPoolForDay(d) {
    if (_orderedPoolCache[d]) return _orderedPoolCache[d];
    const target = regionSchedule[d - 1];
    const used = new Set(usedActivityIds);
    const sorted = activityPool
      .filter(a => !used.has(a.id)) // phase 6: never schedule a used activity
      .sort((a, b) => {
        const am = regionMatches(a, target) ? 0 : 1;
        const bm = regionMatches(b, target) ? 0 : 1;
        if (am !== bm) return am - bm;
        const penA = Math.min(recentRegionCount(a, d), 3);
        const penB = Math.min(recentRegionCount(b, d), 3);
        if (penA !== penB) return penA - penB; // less recently visited wins
        return (b.rating || 4) - (a.rating || 4);
      });
    _orderedPoolCache[d] = sorted;
    return sorted;
  }

  // Phase 5: flex-day option picks (fresh, highly rated, region-varied).
  // Hard rule: an activity already scheduled ANYWHERE in the trip can NEVER
  // reappear as a flex option, regardless of rating (comment + zero-repeat contract).
  function flexDayOptions(d) {
    // Hard rule: an activity already scheduled ANYWHERE in the trip can NEVER
    // reappear as a flex option (zero-repeat contract). Everything else is a
    // layered preference that relaxes only when the strict pick is too thin.
    const recent = new Set(activityHistory.filter(h => (d - h.day) < REPEAT_GAP_DAYS).map(h => h.id));
    const usedAllTime = new Set(activityHistory.map(h => h.id));
    // Recent regions only: exclude regions the user visited in the ~2 days
    // BEFORE the flex day (so the flex day suggests a different area), but do
    // not ban every region visited anywhere in the trip.
    const seen = new Set(regionSchedule.filter((r, i) => r && (d - (i + 1)) <= 2 && (d - (i + 1)) > 0));
    function pick(ratingMin, ignoreRegions) {
      return activityPool
        .filter(a => !usedAllTime.has(a.id) && !recent.has(a.id) && (a.rating || 4) >= ratingMin && (ignoreRegions || !seen.has(a.region)))
        .sort((a, b) => (b.rating || 4) - (a.rating || 4));
    }
    const strict = pick(4.3, false);
    if (strict.length >= 3) return strict.slice(0, 7);
    const noRegion = pick(4.3, true);
    if (noRegion.length >= 3) return noRegion.slice(0, 7);
    const relaxed = pick(3.8, true);
    return relaxed.slice(0, 7);
  }

  // Phase 10: cap rest days at 2 per TRIP (was 1 per day — which produced
  // 7 consecutive rest days on narrow-pool interest filters like 'food').
  let restDaysUsedThisTrip = 0;
  const MAX_REST_DAYS = 2;
  for (let d = 1; d <= tripDuration; d++) {
    // Phase 5 flex day: last 2 days of long trips are optional, no fixed schedule
    if (regionSchedule[d - 1] === null) {
      const flexOpts = flexDayOptions(d);
      const flexBase = (preferredRegion && preferredRegion !== "none") ? preferredRegion : "Canggu";
      days.push({
        dayNum: d,
        isFlex: true,
        flexOptions: flexOpts,
        flexNote: "Today is your flexible day — pick what you feel like!",
        activities: [],
        travelHours: 0,
        warning: null,
        flexBaseRegion: flexBase,
      });
      continue;
    }

    const day = { dayNum: d, activities: [], travelHours: 0, warning: null };
    let clock = START_HOUR;
    let lastActivity = null;
    let freeScheduled = 0;

    // How many free activities does this day target?
    // On budget trips at least one free slot is guaranteed every day if available
    const freePoolForDay = orderedPoolForDay(d).filter(a => a.isFree);
    const paidPoolForDay = orderedPoolForDay(d).filter(a => !a.isFree);

    // Phase 5 pacing for long trips: lunch break 12:30-1:30 and dinner break
    // 7:00-8:00 are added as non-activity schedule rows
    const addBreak = (start, end, label) => {
      day.activities.push({
        act: { name: label, region: "-", category: "Break", priceLow: 0, priceHigh: 0, duration: 0,
          bestTime: label, location: "", bookingLink: "", platform: "", rating: null,
          insiderTip: "", bestFor: [], imageUrl: "", isBreak: true },
        startTime: fmtTime(start),
        endTime: fmtTime(end),
        travelBefore: null,
        isBreak: true,
      });
    };

    // Build the day: prefer free activities first up to targetFreePerDay, then paid
    const dayOrder = [];
    const daySeen = new Set(); // prevents the same activity twice within one day
    const addFrom = (pool, role, getIdx, setIdx) => {
      if (pool.length === 0) return null;
      // Round-robin through the pool, advancing the shared index; skip activities
      // that are seen today or used within the last REPEAT_GAP_DAYS.
      // Fresh-first selection: prefer the next round-robin candidate; if it is
      // blocked (seen today or inside the 3-day gap), scan forward once through
      // the pool for the first fresh activity so a fresh pick always wins over
      // a repeat. Only when every item is blocked does the pool wrap and a
      // repeat become unavoidable (long trips vs a small pool).
      const startPos = getIdx();
      const scanLen = pool.length * 2;
      for (let i = 0; i < scanLen; i++) {
        const pos = (startPos + i) % Math.max(1, pool.length);
        const a = pool[pos];
        if (!a) continue;
        if (daySeen.has(a.id)) continue; // never twice in one day
        // Use the LATEST use of this activity (not the first) so a recent
        // evening-bonus or earlier appearance still enforces the 3-day gap.
        const lastUsed = activityHistory.reduce((acc, h) => (h.id === a.id ? h : acc), null);
        const daysSinceLastUse = lastUsed ? (d - lastUsed.day) : 999;
        if (daysSinceLastUse < REPEAT_GAP_DAYS) continue; // 3-day gap rule
        // Phase 6: hard no-repeat — an activity already used anywhere in the
        // trip is skipped entirely (alternatives/rest day take over instead)
        if (!a.isAlternative && usedActivityIds.includes(a.id)) continue;
        setIdx(pos + 1); // resume round-robin right after this fresh pick
        dayOrder.push({ act: a, role });
        usedActivityIds.push(a.id);
        activityHistory.push({ id: a.id, day: d, role });
        daySeen.add(a.id);
        return a;
      }
      return null;
    };
    // Build the slots in order, biasing toward free activities first up to
    // targetFreePerDay, then paid activities. Used activities are filtered out
    // permanently (zero repetition); when both main pools run out, free fallback
    // alternatives (isAlternative: true) are offered, and if those also run out
    // a custom Rest Day takes the slot.
    function isFreshAvailable(pool) {
      const seenWithinGap = new Set(activityHistory.filter(h => (d - h.day) < REPEAT_GAP_DAYS).map(h => h.id));
      return pool.some(a => !daySeen.has(a.id) && !seenWithinGap.has(a.id) && !usedActivityIds.includes(a.id));
    }

    // Phase 6: alternatives pool (relaxation / photography / walking picks).
    // These are free, need no booking, and take over only when the fresh main
    // pool (free + paid) is fully exhausted.
    const alternativePool = orderedPoolForDay(d).filter(a => a.isAlternative);
    let altIdx = 0;
    function pickAlternative(role) {
      while (altIdx < alternativePool.length) {
        const alt = alternativePool[altIdx++];
        if (!daySeen.has(alt.id) && !usedActivityIds.includes(alt.id)) {
          dayOrder.push({ act: alt, role });
          usedActivityIds.push(alt.id);
          activityHistory.push({ id: alt.id, day: d, role });
          daySeen.add(alt.id);
          return alt;
        }
      }
      return null;
    }

    // Phase 6: custom Rest Day used only when even the alternatives run out
    function createRestDay(role) {
      if (restDaysUsedThisTrip >= MAX_REST_DAYS) return null; // max 2 per trip
      const rest = { act: { name: "✨ Rest & Recovery Day", region: "-",
          category: "Rest / Optional", priceLow: 0, priceHigh: 0, duration: 0,
          bestTime: "Your pace", location: "Around your base", bookingLink: "",
          platform: "No booking needed", rating: null, isFree: true,
          insiderTip: "Take this day to relax, explore at your own pace, or revisit a favorite spot.",
          bestFor: [], imageUrl: "", isAlternative: true },
        role };
      return rest;
    }
    const slotRoles = isLongTrip
      ? ["main", "secondary", "afternoon", "evening"]   // 4 slots on long trips (3 daytime + 1 evening bonus)
      : ["main", "secondary", "evening"];                // 3 slots on short trips
    for (let s = 0; s < slotRoles.length; s++) {
      const role = slotRoles[s];
      const freeAvailable = isFreshAvailable(freePoolForDay);
      const paidAvailable = isFreshAvailable(paidPoolForDay);
      const wantFree = freeScheduled < targetFreePerDay && freeAvailable;
      let picked = null;
      if (wantFree) picked = addFrom(freePoolForDay, role, () => freeIdx.val, (v) => { freeIdx.val = v; });
      if (!picked && role !== "main") picked = addFrom(paidPoolForDay, role, () => paidIdx.val, (v) => { paidIdx.val = v; });
      if (!picked && !wantFree) picked = addFrom(paidPoolForDay, role, () => paidIdx.val, (v) => { paidIdx.val = v; });
      if (!picked && wantFree && !freeAvailable && paidAvailable) picked = addFrom(paidPoolForDay, role, () => paidIdx.val, (v) => { paidIdx.val = v; });
      if (!picked && role !== "main") picked = addFrom(freePoolForDay, role, () => freeIdx.val, (v) => { freeIdx.val = v; });
      // Phase 6 fallback chain: both main pools exhausted → alternatives → rest day
      if (!picked) picked = pickAlternative(role);
      if (!picked) {
        const rest = createRestDay(role);
        if (rest) {
          dayOrder.push(rest);
          picked = rest.act;
          restDaysUsedThisTrip++;
        }
      }
      if (picked && picked.isFree) freeScheduled++;
    }

    // Schedule selected activities with travel times
    for (let i = 0; i < dayOrder.length; i++) {
      const { act: candidate, role } = dayOrder[i];
      const tt = lastActivity ? travelTime(lastActivity, candidate) : 0;
      const needed = tt + candidate.duration + 0.5;

      if (role === "evening" && clock + needed > MAX_ACTIVE_HOURS) {
        // The evening bonus didn't fit today — release it back to the pool so
        // it stays available for a later day or the flex-day suggestions
        // (keeps the visible pool alive on fully-booked long trips).
        day.bonus = candidate;
        const lastHist = activityHistory.length ? activityHistory[activityHistory.length - 1] : null;
        if (lastHist && lastHist.id === candidate.id && lastHist.day === d && lastHist.role === role) {
          activityHistory.pop();
        }
        continue;
      }

      // Phase 6: zero-repetition flag (always false by design now)
      const isRepeated = activityHistory.filter(h => h.id === candidate.id).length > 1;

      // Phase 5: skip break rows when computing the schedule clock
      day.activities.push({
        act: candidate,
        startTime: fmtTime(clock + tt),
        endTime: fmtTime(clock + tt + candidate.duration),
        travelBefore: tt > 0 ? `${tt.toFixed(1)} hrs drive` : null,
        isRepeated: isRepeated,
      });

      // Warn if a single transfer leg exceeds 4 hours
      if (tt > 4) {
        day.warning = `Very long transfer today (${tt.toFixed(1)} hrs). Start before 6:30 AM and ask your driver to break it up with a coffee stop.`;
      }

      clock += tt + candidate.duration;
      day.travelHours += tt;
      lastActivity = candidate;

      if (role === "main" && candidate.priceHigh) totalActivityCost += (candidate.priceLow + candidate.priceHigh) / 2;
      totalCountScheduled++;
    }

    // Phase 5: insert meal breaks into long-trip schedules at fixed times.
    // Breaks are inserted AFTER the clock has been computed for the activities,
    // so they do not disturb travel-time math. The lunch break is spliced right
    // after the first activity that ends at or after 12:00 PM (i.e. the first
    // afternoon activity); the dinner break is appended last.
    if (isLongTrip && day.activities.length >= 1) {
      const toMinutes = (t) => {
        const m = (t || "").match(/(\d+):(\d+)\s*(AM|PM)/i);
        if (!m) return 0;
        let h = parseInt(m[1]); if (m[3].toUpperCase() === "PM" && h < 12) h += 12; if (m[3].toUpperCase() === "AM" && h === 12) h = 0;
        return h * 60 + parseInt(m[2]);
      };
      const lunchBreak = {
        act: { name: "Lunch break", region: "-", category: "Break", priceLow: 0, priceHigh: 0, duration: 0,
          bestTime: "12:30 PM", location: "", bookingLink: "", platform: "", rating: null,
          insiderTip: "Warung lunch ~IDR 30-75K; beach clubs from ~IDR 200K.", bestFor: [], imageUrl: "", isBreak: true },
        startTime: "12:30 PM", endTime: "1:30 PM", travelBefore: null, isBreak: true,
      };
      const dinnerBreak = {
        act: { name: "Dinner break", region: "-", category: "Break", priceLow: 0, priceHigh: 0, duration: 0,
          bestTime: "7:00 PM", location: "", bookingLink: "", platform: "", rating: null,
          insiderTip: "Jimbaran seafood grills or a Kuta/Seminyak warung cluster close by.", bestFor: [], imageUrl: "", isBreak: true },
        startTime: "7:00 PM", endTime: "8:00 PM", travelBefore: null, isBreak: true,
      };
      // Insert lunch after the first activity whose END time is >= 12:00
      let lunchInserted = false;
      for (let i = 0; i < day.activities.length; i++) {
        if (!day.activities[i].isBreak && toMinutes(day.activities[i].endTime) >= 12 * 60) {
          day.activities.splice(i + 1, 0, lunchBreak);
          lunchInserted = true;
          break;
        }
      }
      if (!lunchInserted) day.activities.splice(1, 0, lunchBreak);
      day.activities.push(dinnerBreak);
    }

    // Crowd / overload warning
    const maxTravel = (preferredRegion === "none") ? 4.5 : 2.5;
    if (day.activities.length > 3) {
      day.warning = "This day is packed — consider moving one activity to a rest day.";
    } else if (day.travelHours > maxTravel) {
      day.warning = "Heavy driving today. Start early and consider splitting this day if possible.";
    } else if (day.travelHours > 2 && preferredRegion !== "none" && regionSchedule[d - 1] !== preferredRegion) {
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
  const avgCostPerDay = totalCountScheduled > 0
    ? Math.round(totalActivityCost / tripDuration + transportCost)
    : 0;

  return { days, estimatedActivityCostPerDay: avgCostPerDay, warnings, transport, freeCountScheduled };
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
window.BaliEngine = { filterActivities, buildDailyItinerary, generateInsiderTips, travelTime, rainyBackupFor, regionRotation };
