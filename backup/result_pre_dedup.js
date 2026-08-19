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
  plan = window.BaliEngine.buildDailyItinerary(filtered, answers.tripDuration, answers.preferredRegion);
  // Inject private driver as the first item of each day when a transport option exists
  if (plan.transport) {
    plan.days.forEach(day => {
      day.activities.unshift({ act: plan.transport, startTime: "8:00 AM", endTime: "—", travelBefore: null, isDriver: true });
    });
    plan.driverInfo = plan.transport;
  }

  renderHeader();
  renderDays();
  wirePDFButton();
  wireMapAndCalendar();
  applyPurchaseState();
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
  if (plan.driverInfo) {
    document.getElementById("driver-note").innerHTML =
      `<i class="fa-solid fa-van-shuttle mr-2"></i>Your plan includes a full-day <b>private driver (~$${Math.round(plan.driverInfo.priceLow)}–$${Math.round(plan.driverInfo.priceHigh)}/day)</b> — the most cost-effective way to cover long routes. Book locally via your hotel or on Klook.`;
  }
}

function renderDays() {
  const container = document.getElementById("itinerary-days");
  container.innerHTML = plan.days.map((day, idx) => {
    const activitiesHtml = day.activities.map(item => {
      const a = item.act;
      // In rainy mode, strike the swapped outdoor activity
      if (rainyMode && day.rainySwapIdx !== undefined && item === day.activities[day.rainySwapIdx] && !item.isDriver) {
        return `<div class="bg-gray-50 rounded-2xl border border-gray-200 p-5 opacity-60"><div class="flex gap-4 items-start"><div class="flex-1"><h4 class="font-bold line-through text-gray-500">${a.name}</h4><p class="text-xs text-gray-500 mt-1"><i class="fa-solid fa-cloud-rain mr-1"></i>Replaced by rainy-day backup below</p></div></div></div>`;
      }
      const price = a.priceHigh > 0 ? `$${Math.round(a.priceLow)}–$${Math.round(a.priceHigh)}` : "Free";
      const driverRow = item.isDriver ? `bg-[#2E7D32]/[0.06] border-[#2E7D32]/30` : "";
      const rating = a.rating ? `<span class="text-[#F9A825] text-xs font-semibold">★ ${a.rating.toFixed(1)}</span>` : "";
      const imgHtml = a.imageUrl
        ? `<img src="${a.imageUrl}" alt="${a.name.replace(/"/g, "")}" loading="lazy" decoding="async" class="w-full h-32 object-cover rounded-xl">`
        : "";
      const localPrice = a.localPrice || 0;
      const saving = localPrice > 0 && a.priceLow > 0 ? Math.round(a.priceLow) - localPrice : 0;
      const savingsHtml = saving >= 5
        ? `<div class="inline-flex items-center gap-1 mt-1.5 text-xs font-semibold text-[#2E7D32] bg-[#2E7D32]/10 px-2 py-1 rounded-full"><i class="fa-solid fa-piggy-bank"></i>Save ~$${saving} booking locally (~$${localPrice})</div>`
        : "";
      return `
        <div class="bg-white rounded-2xl border border-gray-100 p-5 flex gap-4 items-start ${driverRow}">
          <div class="text-center shrink-0 w-16">
            <div class="text-xs font-bold text-[#2E7D32] uppercase tracking-wide">${item.startTime}</div>
            <div class="text-xs text-[#757575]">to ${item.endTime}</div>
            ${item.travelBefore ? `<div class="text-[10px] text-[#757575] mt-1"><i class="fa-solid fa-car mr-1"></i>${item.travelBefore}</div>` : ""}
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-start justify-between gap-2">
              <h4 class="font-bold">${a.name}</h4>
              <div class="shrink-0 text-right">
                <span class="block text-sm font-bold text-[#2E7D32]">${price}</span>
                ${rating}
              </div>
            </div>
            <p class="text-xs text-[#757575] mt-0.5">${a.category} • ${a.region} • ${a.duration}h</p>
            ${imgHtml}
            ${a.insiderTip ? `<p class="text-xs text-[#757575] mt-2 bg-[#F5F5F5] rounded-lg px-3 py-2"><i class="fa-solid fa-lightbulb text-[#F9A825] mr-1"></i>${a.insiderTip}</p>` : ""}
            ${savingsHtml}
            ${item.isDriver ? `<div class="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold text-[#1B5E20] bg-[#2E7D32]/10 px-3 py-2 rounded-lg"><i class="fa-solid fa-van-shuttle"></i>Book locally — via hotel or Klook (~$${Math.round(a.localPrice || a.priceLow)} locally)</div>` : (bookableLink(a) ? `<a href="${a.bookingLink}" target="_blank" rel="noopener" class="inline-block mt-2 text-xs font-semibold text-white bg-[#2E7D32] hover:bg-[#1B5E20] px-4 py-2 rounded-lg"><i class="fa-solid fa-ticket mr-1"></i>Book on ${a.platform || "Web"}</a>` : "")}
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

    return `
      <section class="print:break-before-page">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-11 h-11 rounded-full bg-[#2E7D32] text-white font-heading font-bold flex items-center justify-center">${day.dayNum}</div>
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

function applyPurchaseState() {
  const banner = document.getElementById("unlock-banner");
  const emailForm = document.getElementById("email-capture");
  if (banner && emailForm && typeof window.BaliGumroad !== "undefined" && window.BaliGumroad.isPurchased()) {
    banner.innerHTML = `
      <i class="fa-solid fa-circle-check text-3xl text-[#2E7D32]"></i>
      <div class="flex-1 text-center md:text-left">
        <p class="font-bold text-[#1B5E20] text-lg">Unlocked! Your full plan is ready.</p>
        <p class="text-[#757575] text-sm">Download the PDF below and book every activity with one click.</p>
      </div>`;
    banner.classList.remove("bg-[#F9A825]");
    banner.classList.add("bg-[#2E7D32]/10", "border", "border-[#2E7D32]/30");
  }
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
  // Interactive Leaflet map
  const mapEl = document.getElementById("bali-map");
  if (mapEl && typeof L !== "undefined") {
    window.BaliMapCal.initBaliMap(mapEl, plan.days);
  }
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

// Email capture
document.getElementById("email-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const email = document.getElementById("user-email").value.trim();
  if (email) {
    const saved = JSON.parse(localStorage.getItem("baliAnswers") || "{}");
    saved.email = email;
    localStorage.setItem("baliAnswers", JSON.stringify(saved));
    e.target.innerHTML = `<p class="text-sm text-[#2E7D32] font-semibold"><i class="fa-solid fa-circle-check mr-1"></i>Saved! We'll send your plan to ${email}.</p>`;
  }
});

init();
