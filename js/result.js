/* ============================================================
 * Result page logic — runs the engine, renders the plan,
 * wires PDF generation and email capture.
 * ============================================================ */

const TIER_LABELS = { budget: "Budget", mid: "Mid-Range", luxury: "Luxury" };
const TYPE_LABELS = {
  solo: "Solo Explorer", family: "Family Adventure", honeymoon: "Honeymoon Escape",
  friends: "Friends Getaway", nomad: "Digital Nomad",
};

let plan = null;
let answers = null;
let rainyMode = false;
let allActivities = []; // full dataset, needed for rainy-day backups

async function init() {
  const raw = localStorage.getItem("baliAnswers");
  if (!raw) { window.location.href = "quiz.html"; return; }
  answers = JSON.parse(raw);
  if (window.trackFunnel) window.trackFunnel.viewResult();

  // Load activities
  let data;
  try {
    const res = await fetch("data/activities.json");
    data = await res.json();
  } catch (e) {
    document.getElementById("itinerary-days").innerHTML =
      `<p class="text-red-500">Could not load activity data. Please refresh.</p>`;
    return;
  }

  const filters = {
    tripDuration: answers.tripDuration,
    budgetTier: answers.budgetTier,
    tripType: answers.tripType,
    interests: answers.interests || [],
    rainyBackup: answers.rainyBackup === true,
    preferredRegion: answers.preferredRegion || "none",
  };
  // Rainy-day toggle state (default follows the answer)
  rainyMode = answers.rainyBackup === true;
  window.toggleRainyMode = (on) => {
    rainyMode = on;
    renderDays();
    document.getElementById("rainy-toggle").checked = on;
    document.getElementById("rainy-label").textContent = on ? "Rainy-day backups active" : "Core plan — swaps off";
    // Fire GA event if available
    if (window.gtag) window.gtag("event", "rainy_mode_toggle", { rainy: on });
  };
  // Render toggle if element exists
  const toggle = document.getElementById("rainy-toggle");
  if (toggle && answers.rainyBackup === true) {
    toggle.checked = rainyMode;
    toggle.addEventListener("change", (e) => window.toggleRainyMode(e.target.checked));
    document.getElementById("rainy-label").textContent = rainyMode ? "Rainy-day backups active" : "Core plan — swaps off";
  } else if (toggle) {
    document.getElementById("rainy-label").textContent = rainyMode ? "Rainy-day backups active" : "Rainy backup not requested in quiz";
    toggle.checked = rainyMode;
    toggle.addEventListener("change", (e) => window.toggleRainyMode(e.target.checked));
  }

  // Lookup map so per-activity calendar buttons can resolve the full activity object
  window.activitiesById = {};
  data.activities.forEach(a => { window.activitiesById[a.id] = a; });
  allActivities = data.activities;

  const filtered = window.BaliEngine.filterActivities(data.activities, filters);
  plan = window.BaliEngine.buildDailyItinerary(filtered, answers.tripDuration, answers.budgetTier || "mid", answers.preferredRegion);
  // Inject private driver as the first item of each day when a transport option exists
  if (plan.transport) {
    plan.days.forEach(day => {
      if (day.isFlex) return; // flex days have no fixed schedule
      day.activities.unshift({ act: plan.transport, startTime: "8:00 AM", endTime: "—", travelBefore: null, isDriver: true });
    });
    plan.driverInfo = plan.transport;
  }

  // Phase 13: expose plan days for seasonal swap logic
  window.__baliPlanDays = plan.days;
  renderHeader();
  renderQuickSummary();
  renderDay1Preview();
  renderDays();
  renderBudgetBreakdown();
  // Phase 13: seasonal panel + apply any previously saved swaps
  if (window.BaliSeasonal && window.BaliSeasonal.loadSeasonal) window.BaliSeasonal.renderResultPanel();
  wirePDFButton();
  wireMapAndCalendar();
  applyPurchaseState();
  wireBackToTop();
  wireSharePlan();
  wireEditPlan();
  wireRating();
  window.BaliDarkMode && window.BaliDarkMode.init();

  // Phase 6: scroll-triggered fade-up for day cards
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add("visible"); observer.unobserve(e.target); }
    });
  }, { threshold: 0.08 });
  document.querySelectorAll(".card-fade-up").forEach(el => observer.observe(el));
}

window.applyPurchaseState = applyPurchaseState;

function renderHeader() {
  const regionTxt = answers.preferredRegion && answers.preferredRegion !== "none"
    ? `Based in ${answers.preferredRegion}` : "Island-wide plan";
  document.getElementById("plan-title").textContent =
    `Your ${answers.tripDuration}-Day Bali Itinerary`;
  document.getElementById("plan-subtitle").textContent =
    `${TIER_LABELS[answers.budgetTier]} plan • ${TYPE_LABELS[answers.tripType] || "Custom Trip"} • ${regionTxt}`;
  document.getElementById("plan-duration").textContent = `${answers.tripDuration} days`;
  document.getElementById("plan-cost").textContent =
    `~$${plan.estimatedActivityCostPerDay}/day incl. activities & private driver`;
  document.getElementById("plan-summary").textContent =
    `${plan.days.filter(d => !d.isFlex).reduce((n, d) => n + d.activities.filter(a => !a.isBreak && !a.isDriver).length, 0)} activities • 100% zero-repeat schedule • ${plan.days.filter(d => d.isFlex).length} flexible day${plan.days.filter(d => d.isFlex).length !== 1 ? "s" : ""}`;
  if (plan.driverInfo) {
    const tier = answers.budgetTier || "mid";
    if (tier === "budget") {
      document.getElementById("driver-note").innerHTML =
        `<i class="fa-solid fa-van-shuttle mr-2"></i>Your plan includes a full-day <b>private driver (~$${plan.driverDailyCost}/day)</b>. On a budget, negotiate the local rate (~$35–40) with your hotel or via Klook/Traveloka — or swap individual days for a <b>shared tourist shuttle ($5–10/seat)</b> and rent a <b>scooter (~$6/day)</b> for short routes.`;
    } else {
      document.getElementById("driver-note").innerHTML =
        `<i class="fa-solid fa-van-shuttle mr-2"></i>Your plan includes a full-day <b>private driver (~$${Math.round(plan.driverInfo.priceLow)}–$${Math.round(plan.driverInfo.priceHigh)}/day)</b> — the most cost-effective way to cover long routes. Book locally via your hotel or on Klook.`;
    }
  }
}

function renderBudgetBreakdown() {
  // Phase 12: transparent daily budget breakdown — driver vs scheduled activities.
  const driver = plan.driverInfo;
  const actCost = plan.activityCostPerDay || 0;
  const driverCost = plan.driverDailyCost || 0;
  if (!driver || (actCost === 0 && driverCost === 0)) return;
  const total = actCost + driverCost;
  const driverPct = total > 0 ? Math.round((driverCost / total) * 100) : 0;
  const actPct = 100 - driverPct;
  const note = document.getElementById("driver-note");
  if (note) {
    note.insertAdjacentHTML("afterend", `
      <div class="mx-auto max-w-5xl px-4 mt-3 print:hidden" id="budget-breakdown">
        <div class="flex items-center gap-2 text-xs text-[#757575] mb-1">
          <span><b>~$${driverCost}/day driver</b></span>
          <span class="ml-auto"><b>~$${actCost}/day activities</b> &nbsp;= <b>~$${total}/day total</b></span>
        </div>
        <div class="w-full h-2.5 rounded-full bg-[#E0E0E0] overflow-hidden flex" role="img" aria-label="Daily budget split">
          <div style="width:${driverPct}%" class="h-full bg-[#2E7D32]" title="Driver"></div>
          <div style="width:${actPct}%" class="h-full bg-[#F9A825]" title="Activities"></div>
        </div>
        <p class="text-[11px] text-[#9E9E9E] mt-1">Your plan's daily estimate: transport + scheduled activities. Meals, hotels and flights are not included.</p>
      </div>`);
  }
}
function renderDays() {
  // Phase 6: interest icon for activity cards (🏄 adventure, 🏛 culture, 🌿 nature, 🧘 relaxation/wellness, 🍽 food, 🛍 shopping, 📸 photography)
  function activityIcon(a) {
    const interestsTxt = Array.isArray(a.interests) ? a.interests.join(" ") : (a.interests || "");
    const cat = ((a.category || "") + " " + interestsTxt).toLowerCase();
    if (/adventure|sport|watersport|atv|quad|surf|raft|snorkel|dive|swing|climb|kayak|safari|waterslid/.test(cat)) return { icon: "fa-person-skiing", cls: "text-[#0288D1]" };
    if (/temple|culture|history|dance|art|museum|village|palace|ritual|ceremony|photography|photo/.test(cat)) return { icon: "fa-person-praying", cls: "text-[#6A1B9A]" };
    if (/nature|beach|waterfall|marine|sun|sunrise|sunset|cliff|island|dolphin|turtle|star/.test(cat)) return { icon: "fa-leaf", cls: "text-[#2E7D32]" };
    if (/relax|wellness|spa|yoga|meditat|massage|rest/.test(cat)) return { icon: "fa-spa", cls: "text-[#F9A825]" };
    if (/food|culinary|market|cooking|cafe|restaurant|coffee|seafood|warung/.test(cat)) return { icon: "fa-utensils", cls: "text-[#E65100]" };
    if (/shopping|market/.test(cat)) return { icon: "fa-bag-shopping", cls: "text-[#C62828]" };
    return { icon: "fa-compass", cls: "text-[#2E7D32]" };
  }
  const container = document.getElementById("itinerary-days");
  container.innerHTML = plan.days.map((day, idx) => {
    // Phase 5: flex day rendering — last 2 days of long trips are optional
    if (day.isFlex) {
      const optsHtml = (day.flexOptions || []).map((a, oi) => {
        const actIcon = activityIcon(a); // fix: actIcon must be defined per flex option
        const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
        const freeAct = a.isFree || a.priceHigh <= 1;
        const price = a.priceHigh > 0 ? `$${Math.round(a.priceLow)}–$${Math.round(a.priceHigh)}` : "Free";
        const badge = freeAct ? `<span class="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-[#1B5E20] bg-[#C8E6C9] border border-[#A5D6A7] px-2 py-0.5 rounded-full"><i class="fa-solid fa-hand-holding-heart"></i>Free</span>` : "";
        const imgHtml = a.imageUrl ? `<img src="${esc(a.imageUrl)}" alt="${esc(a.name)}" loading="lazy" decoding="async" onerror="this.src='assets/images/placeholder-activity.webp'" class="activity-image h-32">` : "";
        return `
          <div class="bg-white rounded-xl border border-gray-100 p-4 flex gap-3 items-start ${freeAct ? "free-activity-card" : ""}">
            <div class="text-center shrink-0 w-10"><div class="text-xs font-bold text-[#2E7D32] uppercase tracking-wide">Pick ${oi + 1}</div></div>
            <div class="flex-1 min-w-0">
              <div class="flex items-start justify-between gap-2">
                <h4 class="font-semibold text-sm"><i class="fa-solid ${actIcon.icon} mr-1 ${actIcon.cls}"></i>${esc(a.name)} ${badge}</h4>
                <span class="shrink-0 text-xs font-bold text-[#2E7D32]">${price}</span>
              </div>
              <p class="text-xs text-[#757575] mt-0.5">${esc(a.category)} • ${esc(a.region)} • ~${esc(a.duration)}h</p>
              ${imgHtml}
              ${a.insiderTip ? `<p class="text-xs text-[#757575] mt-1.5"><i class="fa-solid fa-lightbulb text-[#F9A825] mr-1"></i>${esc(a.insiderTip)}</p>` : ""}
            </div>
          </div>`;
      }).join("");
      return `
        <section class="print:break-before-page">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-11 h-11 rounded-full bg-[#F9A825] text-white font-heading font-bold flex items-center justify-center"><i class="fa-solid fa-wand-magic-sparkles"></i></div>
            <h3 class="font-heading font-bold text-xl">Day ${day.dayNum} — Flex Day</h3>
            <span class="text-xs text-[#757575] ml-auto">Optional • no fixed schedule</span>
          </div>
          <div class="bg-[#F9A825]/10 border border-[#F9A825]/30 rounded-2xl p-5 mb-4">
            <p class="font-bold text-[#7a4f00] text-lg"><i class="fa-solid fa-sun mr-1"></i>${day.flexNote}</p>
            <p class="text-sm text-[#757575] mt-1">You have already covered most of Bali — today is entirely yours. Pick from these fresh options, revisit a favorite, or enjoy a spa day near your ${day.flexBaseRegion} base.</p>
          </div>
          <div class="grid md:grid-cols-2 gap-3">${optsHtml}</div>
        </section>`;
    }

    const activitiesHtml = day.activities.map(item => {
      const a = item.act;
      // In rainy mode, strike the swapped outdoor activity
      if (rainyMode && day.rainySwapIdx !== undefined && item === day.activities[day.rainySwapIdx] && !item.isDriver) {
        return `<div class="bg-gray-50 rounded-2xl border border-gray-200 p-5 opacity-60"><div class="flex gap-4 items-start"><div class="flex-1"><h4 class="font-bold line-through text-gray-500">${a.name}</h4><p class="text-xs text-gray-500 mt-1"><i class="fa-solid fa-cloud-rain mr-1"></i>Replaced by rainy-day backup below</p></div></div></div>`;
      }
      const price = a.priceHigh > 0 ? `$${Math.round(a.priceLow)}–$${Math.round(a.priceHigh)}` : "Free";
      const driverRow = item.isDriver ? `bg-[#2E7D32]/[0.06] border-[#2E7D32]/30` : "";
      // Phase 5: meal-break rows render as compact neutral schedule rows
      if (item.isBreak) {
        return `
          <div class="bg-[#F5F5F5] rounded-xl border border-dashed border-gray-300 px-5 py-3 flex items-center gap-4">
            <div class="text-center shrink-0 w-16">
              <div class="text-xs font-bold text-[#757575] uppercase tracking-wide">${item.startTime}</div>
            </div>
            <div class="flex-1 min-w-0">
              <h4 class="font-semibold text-sm text-[#757575]"><i class="fa-solid fa-utensils mr-1"></i>${a.name}</h4>
              ${a.insiderTip ? `<p class="text-xs text-[#9E9E9E] mt-0.5">${a.insiderTip}</p>` : ""}
            </div>
            <div class="shrink-0 text-xs text-[#9E9E9E] font-semibold">${item.endTime}</div>
          </div>`;
      }
      const freeAct = !item.isDriver && (a.isFree || a.priceHigh <= 1);
      const freeRow = freeAct ? `free-activity-card` : "";
      const freeBadge = freeAct
        ? `<span class="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-[#1B5E20] bg-[#C8E6C9] border border-[#A5D6A7] px-2 py-0.5 rounded-full"><i class="fa-solid fa-hand-holding-heart"></i>Free activity</span>`
        : "";
      const rating = a.rating ? `<span class="text-[#F9A825] text-xs font-semibold">★ ${a.rating.toFixed(1)}</span>` : "";
      const imgHtml = a.imageUrl
        ? `<img src="${a.imageUrl}" alt="${a.name.replace(/"/g, "")}" loading="lazy" decoding="async" onerror="this.src='assets/images/placeholder-activity.webp'" class="activity-image">`
        : "";
      const actIcon = activityIcon(a);
      const localPrice = a.localPrice || 0;
      const saving = localPrice > 0 && a.priceLow > 0 ? Math.round(a.priceLow) - localPrice : 0;
      const savingsHtml = saving >= 5
        ? `<div class="inline-flex items-center gap-1 mt-1.5 text-xs font-semibold text-[#2E7D32] bg-[#2E7D32]/10 px-2 py-1 rounded-full"><i class="fa-solid fa-piggy-bank"></i>Save ~$${saving} booking locally (~$${localPrice})</div>`
        : "";
      return `
        <div class="activity-row bg-white rounded-2xl border border-gray-100 p-5 flex gap-4 items-start ${driverRow} ${freeRow}">
          <div class="text-center shrink-0 w-16">
            <div class="slot-time text-xs font-bold text-[#2E7D32] uppercase tracking-wide">${item.startTime}</div>
            <div class="text-xs text-[#757575]">to ${item.endTime}</div>
            ${item.travelBefore ? `<div class="text-[10px] text-[#757575] mt-1"><i class="fa-solid fa-car mr-1"></i>${item.travelBefore}</div>` : ""}
          </div>
          <div class="flex-1 min-w-0">
          <div class="flex items-start justify-between gap-2">
            <h4 class="activity-name font-bold"><i class="fa-solid ${actIcon.icon} mr-1.5 ${actIcon.cls}"></i>${a.name}${freeBadge ? ` ${freeBadge}` : ""}</h4>
              <div class="shrink-0 text-right">
                <span class="activity-price block text-sm font-bold text-[#2E7D32]">${price}</span>
                ${rating}
              </div>
            </div>
            <p class="text-xs text-[#757575] mt-0.5">${a.category} • ${a.region} • ${a.duration}h</p>
            ${imgHtml}
            ${a.insiderTip ? `<p class="text-xs text-[#757575] mt-2 bg-[#F5F5F5] rounded-lg px-3 py-2"><i class="fa-solid fa-lightbulb text-[#F9A825] mr-1"></i>${a.insiderTip}</p>` : ""}
            ${savingsHtml}
            ${item.isDriver ? `<div class="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold text-[#1B5E20] bg-[#2E7D32]/10 px-3 py-2 rounded-lg"><i class="fa-solid fa-van-shuttle"></i>Book locally — via hotel or Klook (~$${Math.round(a.localPrice || a.priceLow)} locally)</div>` : (bookableLink(a) ? `<a href="${a.bookingLink}" target="_blank" rel="noopener" class="inline-block mt-2 text-xs font-semibold text-white bg-[#2E7D32] hover:bg-[#1B5E20] px-4 py-2 rounded-lg"><i class="fa-solid fa-ticket mr-1"></i>Book on ${a.platform || "Web"}</a>` : "")}${freeAct ? `<div class="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold text-[#1B5E20] bg-[#C8E6C9] px-3 py-2 rounded-lg"><i class="fa-solid fa-door-open"></i>Free activity — no booking required. Just show up!</div>` : ""}
            <button onclick="window.BaliMapCal.openGoogleCalendarAdd(activitiesById[${a.id}], ${day.dayNum}, '${item.startTime}')" class="inline-block mt-2 ml-2 text-xs font-semibold text-[#0288D1] hover:underline"><i class="fa-regular fa-calendar mr-1"></i>Add to calendar</button>
          </div>
        </div>`;
    }).join("");

    // Rainy-day backup: swap one outdoor activity for an indoor alternative (if available)
    let rainyHtml = "";
    if (rainyMode && day.activities.length > 1) {
      const swapIdx = day.activities.findIndex(it => !it.isDriver && isOutdoor(it.act));
      const actToSwap = swapIdx !== -1 ? day.activities[swapIdx].act : null;
      const backup = actToSwap && window.BaliEngine.rainyBackupFor
        ? window.BaliEngine.rainyBackupFor(actToSwap, allActivities)
        : null;
      if (window.__debugRainy) console.log('day', day.dayNum, 'rainyMode', rainyMode, 'swapIdx', swapIdx, 'backup', backup ? backup.name : null);
      if (backup && swapIdx !== -1) {
        day.rainySwapIdx = swapIdx;
        rainyHtml = `
        <div class="bg-sky-50 border border-sky-200 rounded-2xl p-4 text-sm">
          <div class="flex items-center gap-2 font-semibold text-sky-800"><i class="fa-solid fa-cloud-rain"></i>If it rains, swap the ${day.activities[swapIdx].act.name.split(" (")[0]} for:</div>
          <div class="mt-2">${backup.name} — ${backup.insiderTip || backup.bestTime || "Indoor / covered option nearby."} <span class="font-semibold text-sky-800">${backup.priceHigh > 0 ? `($${Math.round(backup.priceLow)}–$${Math.round(backup.priceHigh)})` : "(Free)"}</span>
          </div>
        </div>`;
      }
    }

    const bonusHtml = day.bonus ? `
      <div class="bg-[#F9A825]/10 rounded-2xl border border-[#F9A825]/30 p-4 text-sm">
        <span class="font-semibold text-[#7a4f00]"><i class="fa-solid fa-moon mr-1"></i>Evening bonus:</span>
        ${day.bonus.name} — ${day.bonus.insiderTip || ""}
      </div>` : "";

    const warningHtml = day.warning ? `
      <div class="bg-[#F9A825]/15 border border-[#F9A825]/40 rounded-xl px-4 py-2.5 text-sm font-medium text-[#7a4f00]">
        <i class="fa-solid fa-triangle-exclamation mr-1"></i>${day.warning}
      </div>` : "";

      // Phase 6: weekday cycling accent colors (green/gold/blue/purple/orange) so each day is visually distinct
      const DAY_COLORS = ["bg-[#2E7D32]", "bg-[#F9A825]", "bg-[#0288D1]", "bg-[#6A1B9A]", "bg-[#E65100]"];
      const dayColor = DAY_COLORS[(day.dayNum - 1) % DAY_COLORS.length];
      return `
      <section id="day-${day.dayNum}" class="print:break-before-page card-fade-up">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-11 h-11 rounded-full ${dayColor} text-white font-heading font-bold flex items-center justify-center">${day.dayNum}</div>
          <h3 class="font-heading font-bold text-xl">Day ${day.dayNum}</h3>
          <span class="text-xs text-[#757575] ml-auto">${day.travelHours > 0 ? `${day.travelHours.toFixed(1)}h driving total` : "No big drives today"}</span>
        </div>
        ${warningHtml}
        <div class="space-y-3">${activitiesHtml}</div>
        ${rainyHtml}
        ${bonusHtml}
      </section>`;
  }).join("");
}

// Only show booking buttons for real, bookable links (skip placeholder/on-site-only entries)
function bookableLink(a) {
  const u = a.bookingLink || "";
  return u && !u.includes("goo.gl") && !u.endsWith("getyourguide.com/") && u !== "https://www.getyourguide.com/";
}

// Payment gateway temporarily disabled (Gumroad removed).
// When re-enabling: restore applyPurchaseState to show the unlocked banner
// via window.BaliGumroad.isPurchased() and re-add the unlock-banner markup.
function applyPurchaseState() {
  // Free-access mode: nothing is locked, all features available.
}

// Phase 6: quick summary strip under the header (duration, budget, activity count)
function renderQuickSummary() {
  const schedDays = plan.days.filter(d => !d.isFlex);
  const actCount = schedDays.reduce((n, d) => n + d.activities.filter(a => !a.isBreak && !a.isDriver).length, 0);
  const altCount = schedDays.reduce((n, d) => n + d.activities.filter(a => a.act && a.act.isAlternative && !a.act.isBreak).length, 0);
  const freeCount = schedDays.reduce((n, d) => n + d.activities.filter(a => a.act && (a.act.isFree || a.priceHigh <= 1) && !a.isDriver && !a.isBreak).length, 0);
  document.getElementById("quick-summary").innerHTML = `
    <div class="flex flex-wrap gap-3 items-stretch">
      <div class="flex-1 min-w-[140px] bg-white rounded-2xl border border-gray-100 px-5 py-4"><div class="text-2xl font-heading font-extrabold text-[#2E7D32]">${answers.tripDuration}</div><div class="text-xs text-[#757575] uppercase tracking-wide">Days</div></div>
      <div class="flex-1 min-w-[140px] bg-white rounded-2xl border border-gray-100 px-5 py-4"><div class="text-2xl font-heading font-extrabold text-[#2E7D32]">${actCount}</div><div class="text-xs text-[#757575] uppercase tracking-wide">Activities</div></div>
      <div class="flex-1 min-w-[140px] bg-white rounded-2xl border border-gray-100 px-5 py-4"><div class="text-2xl font-heading font-extrabold text-[#1B5E20]">${freeCount}</div><div class="text-xs text-[#757575] uppercase tracking-wide">Free 🆓</div></div>
      <div class="flex-1 min-w-[140px] bg-white rounded-2xl border border-gray-100 px-5 py-4"><div class="text-2xl font-heading font-extrabold text-[#F9A825]">${altCount}</div><div class="text-xs text-[#757575] uppercase tracking-wide">Relax Days 🔄</div></div>
      <div class="flex-1 min-w-[140px] bg-white rounded-2xl border border-gray-100 px-5 py-4"><div class="text-2xl font-heading font-extrabold text-[#2E7D32]">$${plan.estimatedActivityCostPerDay}</div><div class="text-xs text-[#757575] uppercase tracking-wide">Avg / day</div></div>
    </div>`;
}

// Phase 6: Day 1 preview — always visible before payment to build trust
function renderDay1Preview() {
  const container = document.getElementById("day1-preview");
  if (!container) return;
  const day1 = plan.days[0];
  const rows = (day1.activities || []).map(item => {
    const a = item.act;
    if (item.isBreak) return `<div class="flex items-center gap-3 text-xs text-[#757575] py-1"><span class="w-16 text-center font-semibold">${item.startTime}</span><i class="fa-solid fa-utensils text-[#757575]"></i><span>${a.name}</span></div>`;
    if (item.isDriver) return `<div class="flex items-center gap-3 text-xs text-[#2E7D32] py-1 font-semibold"><span class="w-16 text-center">${item.startTime}</span><i class="fa-solid fa-van-shuttle"></i><span>Private driver included (~$${Math.round(a.priceLow)}-$${Math.round(a.priceHigh)}/day)</span></div>`;
    const price = a.priceHigh > 0 ? `$${Math.round(a.priceLow)}-$${Math.round(a.priceHigh)}` : "Free";
    return `<div class="flex items-center gap-3 text-sm py-1.5"><span class="w-16 text-center font-semibold text-[#2E7D32]">${item.startTime}</span><i class="fa-solid fa-location-dot text-[#2E7D32]"></i><span class="flex-1">${a.name}${item.travelBefore ? ` <span class="text-xs text-[#757575]">${item.travelBefore}</span>` : ""}</span><span class="font-bold text-[#2E7D32]">${price}</span></div>`;
  }).join("");
  container.innerHTML = `
    <div class="bg-white rounded-2xl border-2 border-[#F9A825]/50 p-6">
      <div class="flex items-center gap-2 mb-3">
        <span class="px-3 py-1 rounded-full bg-[#F9A825]/15 text-[#7a4f00] text-xs font-extrabold uppercase tracking-wide"><i class="fa-solid fa-eye mr-1"></i>Free preview</span>
        <h3 class="font-heading font-bold text-lg">Day 1 — ${TIER_LABELS[answers.budgetTier]} plan</h3>
      </div>
      ${rows}
      <p class="text-sm text-[#757575] mt-4 pt-3 border-t border-gray-100">Explore your full ${answers.tripDuration}-day plan below — printable PDF, every booking link, interactive map & calendar export are all ready to use.</p>
    </div>`;
}

function wirePDFButton() {
  document.getElementById("btn-pdf").addEventListener("click", () => {
    window.BaliPDF.generatePDF(
      plan,
      { tripType: answers.tripType, budgetTier: answers.budgetTier, preferredRegion: answers.preferredRegion },
      { tripDuration: answers.tripDuration, estimatedCostPerDay: plan.estimatedActivityCostPerDay }
    );
    if (window.gtag) window.gtag("event", "download_pdf", {});
  });
}

function wireMapAndCalendar() {
  // Interactive Leaflet map (retry guard in case the Leaflet CDN loads slowly)
  function tryInitMap(attempt) {
    const mapEl = document.getElementById("bali-map");
    if (mapEl && typeof L !== "undefined") {
      if (mapEl._leaflet_id) return; // already initialized
      try {
        window.BaliMapCal.initBaliMap(mapEl, plan.days);
      } catch (e) {
        console.error("[map] init failed on attempt " + attempt, e);
        if (attempt < 10) setTimeout(() => tryInitMap(attempt + 1), 300);
        return;
      }
      return;
    }
    if (attempt < 10) setTimeout(() => tryInitMap(attempt + 1), 300);
  }
  tryInitMap(0);
  // ICS download
  const icsBtn = document.getElementById("btn-ics");
  if (icsBtn) icsBtn.addEventListener("click", () => window.BaliMapCal.downloadICS(plan, answers.tripType));
  // Google Calendar (Day 1 first activity)
  const gcalBtn = document.getElementById("btn-gcal");
  if (gcalBtn) gcalBtn.addEventListener("click", () => {
    const first = plan.days[0]?.activities?.find(it => !it.isDriver);
    if (first) window.BaliMapCal.openGoogleCalendarAdd(first.act, 1, first.startTime);
  });
}

// Phase 6: back-to-top button
function wireBackToTop() {
  const btn = document.getElementById("btn-back-to-top");
  if (!btn) return;
  window.addEventListener("scroll", () => {
    const hidden = window.scrollY < 400;
    btn.classList.toggle("opacity-0", hidden);
    btn.classList.toggle("pointer-events-none", hidden);
  }, { passive: true });
  btn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
}

// Phase 6: share plan — encode answers into a unique link
function wireSharePlan() {
  const btn = document.getElementById("btn-share");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const params = new URLSearchParams();
    params.set("d", answers.tripDuration);
    params.set("b", answers.budgetTier);
    params.set("t", answers.tripType);
    params.set("i", (answers.interests || []).join(","));
    params.set("r", answers.preferredRegion);
    const url = `${location.origin}${location.pathname.replace("result.html", "quiz.html")}?share=${encodeURIComponent(JSON.stringify(Object.fromEntries(params)))}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        btn.innerHTML = '<i class="fa-solid fa-link mr-1"></i>Link copied!';
        btn.classList.add("bg-[#2E7D32]/10");
        setTimeout(() => { btn.innerHTML = '<i class="fa-solid fa-link mr-1"></i>Share plan'; btn.classList.remove("bg-[#2E7D32]/10"); }, 2200);
      });
    }
    if (window.gtag) window.gtag("event", "share_plan", {});
  });
}

// Phase 6: edit plan — return to quiz with answers preserved
function wireEditPlan() {
  const btn = document.getElementById("btn-edit-plan");
  if (!btn) return;
  btn.addEventListener("click", () => { window.location.href = "quiz.html?edit=1"; });
}

// Phase 6: star rating — saved locally
function wireRating() {
  const container = document.getElementById("rating-widget");
  if (!container) return;
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem("baliPlanRating") || "null"); } catch (e) {}
  container.innerHTML = `
    <div class="bg-white rounded-2xl border border-gray-100 p-6 text-center">
      <p class="font-heading font-bold text-lg mb-2">How did we do? ✨</p>
      <p class="text-xs text-[#757575] mb-3">Rate your ${answers.tripDuration}-day plan — takes 3 seconds.</p>
      <div class="flex justify-center gap-1 text-3xl" id="rating-stars">${[1,2,3,4,5].map(n =>
        `<button data-star="${n}" class="hover:scale-110 transition-transform ${(saved && n <= saved.stars) ? "text-[#F9A825]" : "text-gray-300"}"><i class="fa-solid fa-star"></i></button>`).join("")}
      </div>
      <div id="rating-msg" class="text-xs text-[#2E7D32] font-semibold mt-2 h-4">${saved ? `Thanks! You rated ${saved.stars} ★${saved.comment ? " — noted!" : ""}` : ""}</div>
    </div>`;
  container.querySelectorAll("#rating-stars button").forEach(b => {
    b.addEventListener("click", () => {
      const stars = parseInt(b.dataset.star);
      const record = { stars, date: new Date().toISOString() };
      localStorage.setItem("baliPlanRating", JSON.stringify(record));
      container.querySelectorAll("#rating-stars button").forEach((bb, i) => {
        bb.className = (i < stars ? "text-[#F9A825]" : "text-gray-300") + " hover:scale-110 transition-transform";
      });
      document.getElementById("rating-msg").textContent = `Thanks! You rated ${stars} ★`;
      if (window.gtag) window.gtag("event", "plan_rated", { stars });
    });
  });
}

// Email capture
document.getElementById("email-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const email = document.getElementById("user-email").value.trim();
  if (email) {
    const saved = JSON.parse(localStorage.getItem("baliAnswers") || "{}");
    saved.email = email;
    localStorage.setItem("baliAnswers", JSON.stringify(saved));
    e.target.innerHTML = `<p class="text-sm text-[#2E7D32] font-semibold"><i class="fa-solid fa-circle-check mr-1"></i>Saved! Your email is attached to your plan for future updates.</p>`;
  }
});

init();
