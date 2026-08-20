/**
 * Seasonal activities data-schema tests (Phase 13)
 * Validates data/seasonal.json structure and the seasonal module's core logic.
 */
const fs = require("fs");
const path = require("path");

const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "seasonal.json"), "utf8"));
const events = DATA.events || [];
const VALID_SLOTS = new Set(["morning", "afternoon", "evening"]);

let passed = 0;
let failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; }
  else { failed++; console.log("FAIL:", name, detail || ""); }
}

console.log("Seasonal schema tests");
console.log("=====================");

// --- Database size & identity ---
check("has 25+ seasonal events", events.length >= 25, events.length);

// --- Required fields ---
const REQUIRED = ["id", "name", "region", "displayDates", "description", "priceLow", "priceHigh", "bestTime", "slot", "interests", "icon", "gradient"];
events.forEach((ev, i) => {
  REQUIRED.forEach(f => {
    check(`event ${ev.id}: has field '${f}'`, ev[f] !== undefined && ev[f] !== null && ev[f] !== "", `idx ${i}`);
  });
});

// --- ID format ---
events.forEach(ev => {
  check(`event ${ev.id}: id starts with S`, /^S\d+$/.test(String(ev.id)));
});

// --- No duplicate IDs ---
const ids = events.map(e => e.id);
check("no duplicate event IDs", new Set(ids).size === ids.length);

// --- Month ranges ---
events.forEach(ev => {
  check(`event ${ev.id}: monthStart in 1..12`, ev.monthStart >= 1 && ev.monthStart <= 12, ev.monthStart);
  check(`event ${ev.id}: monthEnd in 1..12`, ev.monthEnd >= 1 && ev.monthEnd <= 12, ev.monthEnd);
  // Wrap-around ranges (monthStart > monthEnd, e.g. Dec 24 - Jan 1) are valid for annual recurring events
  check(`event ${ev.id}: range span <= 6 months (no multi-span)`,
    ev.monthStart <= ev.monthEnd ? true : ((12 - ev.monthStart + 1) + ev.monthEnd) <= 6,
    `${ev.monthStart}-${ev.monthEnd}`);
});

// --- Prices ---
events.forEach(ev => {
  check(`event ${ev.id}: priceLow >= 0`, typeof ev.priceLow === "number" && ev.priceLow >= 0, ev.priceLow);
  check(`event ${ev.id}: priceHigh >= priceLow`, typeof ev.priceHigh === "number" && ev.priceHigh >= ev.priceLow, ev.priceLow + "/" + ev.priceHigh);
  check(`event ${ev.id}: isFree consistent with zero prices`, ev.isFree ? (ev.priceLow === 0 && ev.priceHigh === 0) : true);
});

// --- Slot ---
events.forEach(ev => {
  check(`event ${ev.id}: slot is morning/afternoon/evening`, VALID_SLOTS.has(ev.slot), ev.slot);
});

// --- interests are arrays ---
events.forEach(ev => {
  check(`event ${ev.id}: interests is an array`, Array.isArray(ev.interests), typeof ev.interests);
});

// --- Icon & gradient ---
events.forEach(ev => {
  check(`event ${ev.id}: icon starts with fa-`, String(ev.icon).startsWith("fa-"), ev.icon);
  check(`event ${ev.id}: gradient looks like CSS`, String(ev.gradient).includes("gradient"), ev.gradient);
});

// --- Region labels consistent ---
events.forEach(ev => {
  check(`event ${ev.id}: has regionLabel`, !!ev.regionLabel, ev.regionLabel);
});

// --- No empty descriptions ---
events.forEach(ev => {
  check(`event ${ev.id}: description > 30 chars`, String(ev.description).length > 30, String(ev.description).length);
});

console.log("==================================================");
console.log(`PASSED: ${passed}  FAILED: ${failed}`);
if (failed > 0) { console.log("Some seasonal schema tests FAILED"); process.exit(1); }
console.log("All seasonal schema tests passed ✓");

// --- Logic tests (pure functions) ---
// Mirror the eventIsOnMonth + monthsAhead + featured logic for verification
function eventIsOnMonth(ev, m) {
  if (ev.monthStart <= ev.monthEnd) return m >= ev.monthStart && m <= ev.monthEnd;
  return m >= ev.monthStart || m <= ev.monthEnd;
}
function monthsAhead(ev, cur) {
  for (let k = 0; k <= 12; k++) {
    const m = ((cur - 1 + k) % 12) + 1;
    if (eventIsOnMonth(ev, m)) return k;
  }
  return null;
}

let lp = 0, lf = 0;
function lcheck(name, cond, detail) {
  if (cond) { lp++; } else { lf++; console.log("FAIL:", name, detail || ""); }
}

console.log("\nSeasonal logic tests");
console.log("====================");

// A free event with known range (find S12 Kite: Jul-Aug)
const kite = events.find(e => e.id === "S12");
if (kite) {
  lcheck("S12 Kite on in July", eventIsOnMonth(kite, 7));
  lcheck("S12 Kite on in August", eventIsOnMonth(kite, 8));
  lcheck("S12 Kite off in June", !eventIsOnMonth(kite, 6));
  lcheck("S12 Kite off in September", !eventIsOnMonth(kite, 9));
}
// Year-wrap event (e.g., Christmas Dec 24 - Jan 1)
const xmas = events.find(e => e.id === "S21" || e.id === "S22");
if (xmas && xmas.monthStart > xmas.monthEnd) {
  lcheck(`${xmas.id} wrap-event on in December`, eventIsOnMonth(xmas, 12));
  lcheck(`${xmas.id} wrap-event on in January`, eventIsOnMonth(xmas, 1));
  lcheck(`${xmas.id} wrap-event off in June`, !eventIsOnMonth(xmas, 6));
}
// monthsAhead for current month (August = 8)
const m = 8;
events.forEach(ev => {
  const k = monthsAhead(ev, m);
  lcheck(`monthsAhead(${ev.id}) 0..12 or null`, k === null || (k >= 0 && k <= 12), k);
});
// Featured count sanity
const feats = [];
const seen = new Set();
for (const ev of [...events].map(e => ({ e, k: monthsAhead(e, m) ?? 99 })).sort((a, b) => a.k - b.k)) {
  if (seen.has(ev.e.id) || ev.e.isNotice) continue;
  seen.add(ev.e.id);
  feats.push(ev.e);
  if (feats.length >= 4) break;
}
lcheck("featured returns up to 4 events", feats.length === 4, feats.length);
lcheck("Nyepi notice excluded from featured", !feats.some(e => e.isNotice));
// Every month must have at least some events scheduled (coverage check)
for (let mm = 1; mm <= 12; mm++) {
  const on = events.filter(e => eventIsOnMonth(e, mm)).length;
  lcheck(`month ${mm}: at least 1 event scheduled`, on >= 1, on);
}

console.log("==================================================");
console.log(`LOGIC PASSED: ${lp}  FAILED: ${lf}`);
if (lf > 0) { process.exit(1); }
console.log("All seasonal logic tests passed ✓");
