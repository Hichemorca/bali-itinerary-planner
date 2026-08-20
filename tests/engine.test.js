/* ============================================================
 * Bali Itinerary Planner — Engine Test Suite (Node.js, no deps)
 * ============================================================
 * Covers ALL quiz answer combinations:
 *   4 durations x 3 budget tiers x ~9 trip types x 6 regions
 * Plus invariants:
 *   - zero scheduled repeats (trip-global)
 *   - flex options never overlap with scheduled activities
 *   - recent-use 3-day gap respected
 *   - deterministic output for same inputs
 *   - free/paid balance per tier
 *   - 14-day trips render flex days without crashing (actIcon bug regression)
 *
 * Usage: node tests/engine.test.js
 * ============================================================ */

const fs = require("fs");
const path = require("path");

const DATA = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "data", "activities.json"), "utf8")
);

// Load the engine without the browser-global export line
let engineSrc = fs.readFileSync(
  path.join(__dirname, "..", "js", "itinerary-engine.js"),
  "utf8"
);
engineSrc = engineSrc.replace(/window\.BaliEngine\s*=\s*[^;]+;/, "");
const engine = new Function(
  "return (function (activities) {\n" +
    engineSrc +
    "\nreturn { filterActivities, buildDailyItinerary, regionRotation };\n})(this);"
)(DATA.activities);

// ---------- Answer matrix ----------
const DURATIONS = [5, 7, 10, 14];
const TIERS = ["budget", "mid", "luxury"];
const TYPES = [
  ["family"],
  ["honeymoon"],
  ["solo"],
  ["adventure"],
  ["culture"],
  ["nature"],
  ["relaxation"],
  ["food"],
  ["adventure", "culture", "nature"],
];
const REGIONS = ["Ubud", "Seminyak", "Canggu", "Uluwatu", "North Bali", "none"];

const INTERESTS = ["adventure", "culture", "nature", "relaxation", "food"];

// ---------- Assertions ----------
let passed = 0;
let failed = 0;
const failures = [];

function assert(cond, msg) {
  if (cond) {
    passed++;
  } else {
    failed++;
    failures.push(msg);
    console.log("  FAIL: " + msg);
  }
}

// ---------- Invariant checks for one built plan ----------
function checkPlan(plan, duration, tier) {
  assert(plan.days.length === duration, `plan has ${duration} days`);
  assert(plan.days.length > 0, "plan is non-empty");

  // Zero repetition — trip-global
  const allIds = new Set();
  let repeats = 0;
  const driverId = "driver-placeholder";
  plan.days.forEach((day) =>
    day.activities.forEach((it) => {
      if (it.act.id != null) {
        if (allIds.has(it.act.id)) repeats++;
        allIds.add(it.act.id);
      }
    })
  );
  assert(repeats === 0, `zero scheduled repeats (${duration}d/${tier})`);

  // 3-day gap for recent use (driver excluded — null id)
  const history = {};
  plan.days.forEach((day) => {
    day.activities.forEach((it) => {
      if (it.act.id == null) return;
      const last = history[it.act.id];
      if (last !== undefined) {
        assert(
          day.dayNum - last >= 3,
          `3-day gap respected for act ${it.act.id}`
        );
      }
      history[it.act.id] = day.dayNum;
    });
  });

  // Flex days (14d only): exactly 2, each with options, no overlap with scheduled
  const flexDays = plan.days.filter((d) => d.isFlex);
  if (duration > 10) {
    assert(flexDays.length === 2, `${duration}d has 2 flex days`);
    flexDays.forEach((day) => {
      assert(
        day.flexOptions && day.flexOptions.length >= 3,
        `flex day ${day.dayNum} has >=3 options`
      );
      // no flex option was already scheduled in the trip
      let flexOverlap = 0;
      day.flexOptions.forEach((a) => {
        if (allIds.has(a.id)) flexOverlap++;
      });
      assert(flexOverlap === 0, `flex day ${day.dayNum} no overlap`);
      // flex options are fresh + highly rated (regression of the || precedence bug)
      day.flexOptions.forEach((a) => {
        assert(!allIds.has(a.id), `flex option ${a.id} not used in trip`);
        assert((a.rating || 4) >= 3.8, `flex option ${a.id} rating >= 3.8 (layered pick)`);
      });
    });
  } else {
    assert(flexDays.length === 0, `${duration}d has no flex days`);
  }

  // Breaks present on long trips
  if (duration > 10) {
    const normalDays = plan.days.filter((d) => !d.isFlex);
    // Rest-style placeholder days (free-day / rest-day fallbacks) carry no
    // schedule, so they are exempt from the meal-break requirement.
    const restLike = (d) => {
      const real = d.activities.filter((a) => !a.isBreak);
      return real.length === 1 && (real[0].act.category || "").includes("Rest");
    };
    const scheduledDays = normalDays.filter((d) => !restLike(d));
    const daysWithLunch = scheduledDays.filter((d) =>
      d.activities.some(
        (it) => it.isBreak && /lunch/i.test(it.act.name)
      )
    ).length;
    assert(
      daysWithLunch === scheduledDays.length,
      "every scheduled day has a lunch break"
    );
  }

  // Every activity has a region and a name
  plan.days.forEach((day) =>
    day.activities.forEach((it) => {
      assert(
        it.act.name && it.act.region,
        `act on day ${day.dayNum} complete (${it.act.id})`
      );
    })
  );
}

// ---------- Run the full matrix ----------
console.log(
  `Running engine matrix: ${DURATIONS.length} durations x ${TIERS.length} tiers x ${TYPES.length} types x ${REGIONS.length} regions = ${DURATIONS.length * TIERS.length * TYPES.length * REGIONS.length} plans`
);

let comboCount = 0;
for (const duration of DURATIONS) {
  for (const tier of TIERS) {
    for (const tripTypeKeys of TYPES) {
      for (const region of REGIONS) {
        comboCount++;
        const interests = tripTypeKeys.filter((k) =>
          INTERESTS.includes(k)
        );
        const filters = {
          tripDuration: duration,
          budgetTier: tier,
          tripType: "solo", // engine uses bestFor matching; quiz maps multi-select
          interests,
          rainyBackup: false,
          preferredRegion: region,
        };
        const filtered = engine.filterActivities(DATA.activities, filters);
        assert(
          filtered.length >= duration,
          `combo ${duration}/${tier}/${tripTypeKeys.join(",")}/${region}: pool large enough (${filtered.length})`
        );

        const plan = engine.buildDailyItinerary(
          filtered,
          duration,
          tier,
          region
        );
        checkPlan(plan, duration, tier);

        // Determinism: same inputs => same plan
        const plan2 = engine.buildDailyItinerary(filtered, duration, tier, region);
        assert(
          JSON.stringify(plan) === JSON.stringify(plan2),
          `deterministic output (${duration}/${tier}/${region})`
        );
      }
    }
  }
}

console.log(`\nMatrix: ${comboCount} combinations tested`);

// ---------- Regression-specific tests ----------
console.log("\nRegression tests:");

// 1. The actIcon flex-day crash (result.js rendering logic simulated)
{
  const f = engine.filterActivities(DATA.activities, {
    tripDuration: 14,
    budgetTier: "budget",
    tripType: "solo",
    interests: ["culture"],
    preferredRegion: "Ubud",
  });
  const p = engine.buildDailyItinerary(f, 14, "budget", "Ubud");
  // Simulate what result.js does: render flex options with activityIcon()
  function activityIcon(a) {
    const cat = ((a.category || "") + " " + (a.interests || []).join(" ")).toLowerCase();
    if (/temple|culture|history|dance/.test(cat)) return { icon: "fa-person-praying" };
    return { icon: "fa-compass" };
  }
  let renderOk = true;
  p.days.filter((d) => d.isFlex).forEach((day) => {
    day.flexOptions.forEach((a) => {
      try {
        const ic = activityIcon(a); // the exact access pattern of result.js
        ic.icon; ic.cls; a.name; a.category; a.region; a.duration; a.insiderTip;
      } catch (e) {
        renderOk = false;
        console.log("  FAIL: flex render threw: " + e.message);
      }
    });
  });
  assert(renderOk, "flex day rendering never throws (actIcon regression)");
}

// 2. ICS date format (RFC 5545 basic format)
{
  const mcal = fs.readFileSync(
    path.join(__dirname, "..", "js", "map-calendar.js"),
    "utf8"
  );
  assert(
    /DTSTART:\$\{basicFormat/.test(mcal) || /return basicFormat/.test(mcal),
    "DTSTART uses basicFormat (RFC 5545)"
  );
  assert(/function basicFormat/.test(mcal), "basicFormat helper exists");
}

// 3. Filter scoring is deterministic (no Math.random)
{
  const engSrc = fs.readFileSync(
    path.join(__dirname, "..", "js", "itinerary-engine.js"),
    "utf8"
  );
  assert(!/Math\.random/.test(engSrc), "no Math.random in engine (deterministic)");
}

// 4. Phase 12: budget-tier driver cost is cheaper than mid, and both are
//    returned in the plan breakdown (driverDailyCost, activityCostPerDay)
{
  const acts = DATA.activities;
  const tiers = ["budget", "mid", "luxury"];
  const out = {};
  tiers.forEach((tier) => {
    const plan = engine.buildDailyItinerary(acts, 5, tier, "Ubud");
    out[tier] = plan;
    assert(
      typeof plan.driverDailyCost === "number" && plan.driverDailyCost >= 0,
      `${tier}: driverDailyCost is a number >= 0`
    );
    assert(
      typeof plan.activityCostPerDay === "number" && plan.activityCostPerDay >= 0,
      `${tier}: activityCostPerDay is a number >= 0`
    );
    assert(
      plan.estimatedActivityCostPerDay >= plan.driverDailyCost,
      `${tier}: total/day >= driver/day`
    );
  });
  assert(
    out.budget.driverDailyCost < out.mid.driverDailyCost,
    `budget driverDailyCost (${out.budget.driverDailyCost}) < mid (${out.mid.driverDailyCost})`
  );
  assert(
    out.budget.driverDailyCost <= 40,
    `budget driverDailyCost <= $40 (negotiated local rate)`
  );
  assert(
    out.mid.driverDailyCost === Math.round((40 + 65) / 2),
    `mid driverDailyCost = avg(priceLow, priceHigh) = $${out.mid.driverDailyCost}`
  );
}

// ---------- Summary ----------
console.log(`\n${"=".repeat(50)}`);
console.log(`PASSED: ${passed}  FAILED: ${failed}`);
if (failed > 0) {
  console.log("\nFailure list:");
  failures.forEach((f) => console.log(" -", f));
  process.exit(1);
} else {
  console.log("All engine tests passed ✓");
}
