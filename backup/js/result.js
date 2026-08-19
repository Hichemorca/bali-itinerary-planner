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

async function init() {
  const raw = localStorage.getItem("baliAnswers");
  if (!raw) { window.location.href = "quiz.html"; return; }
  answers = JSON.parse(raw);

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
    preferredRegion: answers.preferredRegion || "none",
  };

  const filtered = window.BaliEngine.filterActivities(data.activities, filters);
  plan = window.BaliEngine.buildDailyItinerary(filtered, answers.tripDuration, answers.preferredRegion);

  renderHeader();
  renderDays();
  wirePDFButton();
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
    `~$${plan.estimatedActivityCostPerDay}/day on activities & transport`;
}

function renderDays() {
  const container = document.getElementById("itinerary-days");
  container.innerHTML = plan.days.map((day, idx) => {
    const activitiesHtml = day.activities.map(item => {
      const a = item.act;
      const price = a.priceHigh > 0 ? `$${Math.round(a.priceLow)}–$${Math.round(a.priceHigh)}` : "Free";
      const rating = a.rating ? `<span class="text-[#F9A825] text-xs font-semibold">★ ${a.rating.toFixed(1)}</span>` : "";
      return `
        <div class="bg-white rounded-2xl border border-gray-100 p-5 flex gap-4 items-start">
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
            ${a.insiderTip ? `<p class="text-xs text-[#757575] mt-2 bg-[#F5F5F5] rounded-lg px-3 py-2"><i class="fa-solid fa-lightbulb text-[#F9A825] mr-1"></i>${a.insiderTip}</p>` : ""}
            ${bookableLink(a) ? `<a href="${a.bookingLink}" target="_blank" rel="noopener" class="inline-block mt-2 text-xs font-semibold text-white bg-[#2E7D32] hover:bg-[#1B5E20] px-4 py-2 rounded-lg"><i class="fa-solid fa-ticket mr-1"></i>Book on ${a.platform || "Web"}</a>` : ""}
          </div>
        </div>`;
    }).join("");

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
