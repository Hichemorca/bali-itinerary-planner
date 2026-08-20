/**
 * Seasonal Activities (Phase 13)
 * - Loads data/seasonal.json (25 curated seasonal events)
 * - Renders the homepage seasonal banner (current month highlights + upcoming)
 * - Renders the result-page seasonal panel
 * - Handles the swap flow: tourist picks a seasonal event → chooses a day →
 *   the day's activity at the matching time slot is replaced by the seasonal event
 * - Persists picks & swaps to localStorage
 */
(function () {
  "use strict";

  const STORAGE_PICKED = "baliSeasonalPicked";
  const STORAGE_SWAPS = "baliSeasonalSwaps";
  const STORAGE_DATA = "baliSeasonalData";
  let SEASONAL_EVENTS = [];

  /** Month helpers (1-12) */
  function monthOf(date) { return date.getMonth() + 1; }

  /** Is event "on" for a given month (annual ranges, wraps Dec→Jan)? */
  function eventIsOnMonth(ev, m) {
    if (ev.monthStart <= ev.monthEnd) return m >= ev.monthStart && m <= ev.monthEnd;
    return m >= ev.monthStart || m <= ev.monthEnd;
  }

  /** Months ahead this event occurs (0 = this month, null = before next year start boundary) */
  function monthsAhead(ev, nowM) {
    const cur = nowM;
    // find smallest k in 0..12 where event is on in (cur + k - 1) mod 12 + 1
    for (let k = 0; k <= 12; k++) {
      const m = ((cur - 1 + k) % 12) + 1;
      if (eventIsOnMonth(ev, m)) return k;
    }
    return null;
  }

  /** Featured events: currently active first, then upcoming (next 3 months), deduped, max n */
  function featuredEvents(n) {
    const m = monthOf(new Date());
    const withKey = SEASONAL_EVENTS.map(ev => ({ ev, k: monthsAhead(ev, m) || 99 }));
    withKey.sort((a, b) => a.k - b.k);
    const seen = new Set();
    const out = [];
    for (const { ev } of withKey) {
      if (seen.has(ev.id) || ev.isNotice) continue;
      seen.add(ev.id);
      out.push(ev);
      if (out.length >= n) break;
    }
    return out;
  }

  /** All events currently on this month */
  function currentEvents() {
    const m = monthOf(new Date());
    return SEASONAL_EVENTS.filter(ev => eventIsOnMonth(ev, m));
  }

  /** Fetch seasonal.json with localStorage cache */
  async function loadSeasonal() {
    if (SEASONAL_EVENTS.length) return SEASONAL_EVENTS;
    const cached = localStorage.getItem(STORAGE_DATA);
    try {
      const res = await fetch("data/seasonal.json?v=ph15", { cache: "no-store" });
      if (!res.ok) throw new Error("seasonal.json HTTP " + res.status);
      const d = await res.json();
      SEASONAL_EVENTS = d.events || [];
      localStorage.setItem(STORAGE_DATA, JSON.stringify(SEASONAL_EVENTS));
    } catch (e) {
      if (cached) {
        try { SEASONAL_EVENTS = JSON.parse(cached) || []; } catch (_) { SEASONAL_EVENTS = []; }
      } else {
        console.warn("seasonal.js: could not load seasonal.json", e);
        SEASONAL_EVENTS = [];
      }
    }
    return SEASONAL_EVENTS;
  }

  /** Plain activity shape from a seasonal event (for engine/result consumption) */
  function toActivity(ev) {
    return {
      id: ev.id,
      name: ev.name,
      region: ev.region,
      regionLabel: ev.regionLabel || ev.region,
      category: "Seasonal / Festival",
      priceLow: ev.priceLow || 0,
      priceHigh: ev.priceHigh || 0,
      priceNote: ev.priceNote || "",
      duration: 2.5,
      bestTime: ev.bestTime || "",
      slot: ev.slot || "morning",
      location: ev.regionLabel || "",
      bookingLink: "",
      platform: "Local venue",
      rating: ev.rating || 4.5,
      insiderTip: ev.description,
      bestFor: ev.bestFor || [],
      interests: ev.isNotice ? [] : (ev.interests || []),
      isFree: !!ev.isFree,
      isSeasonal: true,
      isNotice: !!ev.isNotice,
      displayDates: ev.displayDates || "",
      imageUrl: "",
      gradient: ev.gradient || "linear-gradient(135deg, #2E7D32, #1B5E20)",
      icon: ev.icon || "fa-calendar-day",
    };
  }

  /* ------------------- Homepage banner ------------------- */

  function cardHTML(ev, extra) {
    const price = ev.isFree
      ? '<span class="inline-block px-2 py-0.5 rounded-full bg-green-100 text-green-800 text-xs font-semibold">Free</span>'
      : (ev.priceLow && ev.priceLow > 0 && ev.priceHigh && ev.priceHigh > 0 && ev.priceLow !== ev.priceHigh)
        ? '<span class="inline-block px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-xs font-semibold">$' + ev.priceLow + "–$" + ev.priceHigh + "</span>"
        : (ev.priceHigh || ev.priceLow) ? '<span class="inline-block px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-xs font-semibold">from $' + (ev.priceLow || ev.priceHigh) + "</span>" : "";
    return '<div class="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden flex flex-col transition-transform hover:-translate-y-1">' +
      '<div class="h-32 flex items-center justify-center relative" style="background:' + ev.gradient + ';">' +
      '<i class="fa-solid ' + ev.icon + ' text-white text-4xl drop-shadow"></i>' +
      (ev.isFree ? '<span class="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-green-500/90 text-white text-[10px] font-bold uppercase tracking-wide">Free</span>' : '') +
      '</div>' +
      '<div class="p-5 flex flex-col flex-1">' +
      '<h3 class="font-heading font-bold text-base leading-snug mb-1">' + ev.name + "</h3>" +
      '<p class="text-[#757575] text-xs mb-3"><i class="fa-solid fa-location-dot mr-1 text-[#2E7D32]"></i>' + (ev.regionLabel || ev.region) + "</p>" +
      '<p class="text-[#424242] text-xs leading-relaxed mb-3 flex-1">' + (ev.description || "") + "</p>" +
      '<div class="flex items-center justify-between mt-auto pt-2">' +
      '<span class="flex items-center gap-2">' +
      '<span class="text-xs text-[#757575]"><i class="fa-solid fa-calendar-days mr-1"></i>' + ev.displayDates + "</span>" +
      "</span>" + price +
      "</div>" +
      (extra || "") +
      "</div>" +
      "</div>";
  }

  async function renderHomepageBanner() {
    const host = document.getElementById("seasonal-banner");
    if (!host) return;
    const events = await loadSeasonal();
    const feats = featuredEvents(4);
    if (!feats.length) return;
    const m = monthOf(new Date());
    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    host.innerHTML =
      '<section class="py-14 bg-gradient-to-br from-[#E8F5E9] via-white to-[#FFF8E1] border-b border-gray-100">' +
      '<div class="max-w-6xl mx-auto px-5">' +
      '<div class="text-center mb-8">' +
      '<span class="inline-block px-3 py-1 rounded-full bg-[#2E7D32] text-white text-xs font-semibold mb-3"><i class="fa-solid fa-calendar-star mr-1"></i>' + monthNames[m - 1] + " — Happening Now & Upcoming</span>" +
      '<h2 class="font-heading font-bold text-2xl md:text-3xl text-[#1B5E20] mb-2">Seasonal Highlights in Bali</h2>' +
      '<p class="text-[#757575] text-sm max-w-2xl mx-auto">Love a festival or seasonal experience? Book it into your plan — we\'ll slot it into the right time of day and swap it with one of your scheduled activities.</p>' +
      "</div>" +
      '<div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">' +
      feats.map(ev => cardHTML(ev, '<a href="#quiz-section" class="seasonal-book-btn mt-4 btn-primary text-sm py-2 px-4 text-center" data-seasonal-id="' + ev.id + '"><i class="fa-solid fa-plus mr-1"></i>Book in My Plan</a>')).join("") +
      "</div>" +
      '<p class="text-center text-[#9E9E9E] text-[11px] mt-6">Dates follow the Balinese lunar calendar and shift yearly — confirm exact dates 2–3 weeks before you travel. Prices are indicative; verify before booking.</p>' +
      "</div>" +
      "</section>";
    host.querySelectorAll(".seasonal-book-btn").forEach(btn => {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        localStorage.setItem(STORAGE_PICKED, btn.dataset.seasonalId);
        window.location.href = "quiz.html";
      });
    });
  }

  /* ------------------- Result page ------------------- */

  /** Swap modal */
  function openSwapModal(ev) {
    const act = toActivity(ev);
    let modal = document.getElementById("seasonal-swap-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "seasonal-swap-modal";
      modal.className = "fixed inset-0 z-[100] hidden items-center justify-center bg-black/50 p-4";
      document.body.appendChild(modal);
    }
    const days = window.__baliPlanDays || [];
    const pickable = days.filter(d => !d.isFlex && d.activities && d.activities.filter(a => !a.isBreak && !a.isDriver).length > 0);
    modal.innerHTML =
      '<div class="bg-white rounded-2xl max-w-lg w-full p-7 max-h-[85vh] overflow-y-auto">' +
      '<div class="flex items-start gap-4 mb-5">' +
      '<div class="w-14 h-14 rounded-xl flex items-center justify-center shrink-0" style="background:' + act.gradient + ';"><i class="fa-solid ' + act.icon + ' text-white text-2xl"></i></div>' +
      "<div>" +
      '<h3 class="font-heading font-bold text-lg">' + ev.name + "</h3>" +
      '<p class="text-xs text-[#757575]"><i class="fa-solid fa-calendar-days mr-1"></i>' + ev.displayDates + "</p>" +
      "</div></div>" +
      '<p class="text-sm text-[#424242] mb-4">Choose which day of your plan should feature this event. We\'ll replace that day\'s main activity with it, keeping your schedule balanced.</p>' +
      '<div class="space-y-2 mb-5">' +
      (pickable.length ? pickable.map(d => {
        const mains = d.activities.filter(a => !a.isBreak && !a.isDriver);
        const first = mains[0] && mains[0].act ? mains[0].act.name : "Day " + d.dayNum;
        return '<button class="seasonal-day-pick w-full text-left rounded-xl border border-gray-200 px-4 py-3 hover:border-[#2E7D32] hover:bg-green-50 transition-colors" data-day="' + d.dayNum + '">' +
          '<span class="font-semibold text-sm">Day ' + d.dayNum + "</span> " +
          '<span class="text-xs text-[#757575]">— replaces: ' + first + "</span></button>";
      }).join("") : '<p class="text-sm text-[#757575]">No swappable days found.</p>') +
      "</div>" +
      '<div class="flex gap-3">' +
      '<button id="seasonal-modal-cancel" class="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium hover:bg-gray-50">Cancel</button>' +
      "</div></div>";
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    modal.style.display = "flex";
    document.getElementById("seasonal-modal-cancel").addEventListener("click", () => closeModal());
    modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
    modal.querySelectorAll(".seasonal-day-pick").forEach(btn => {
      btn.addEventListener("click", () => performSwap(parseInt(btn.dataset.day, 10), ev));
    });
  }

  function closeModal() {
    const modal = document.getElementById("seasonal-swap-modal");
    if (modal) {
      modal.classList.add("hidden");
      modal.classList.remove("flex");
      // Inline style ensures the modal is actually hidden even when the
      // Tailwind CDN fails to load (`.hidden` class has no effect then).
      modal.style.display = "none";
    }
  }

  /** Core swap: replace an activity on the chosen day with the seasonal event at its slot */
  function performSwap(dayNum, ev) {
    closeModal();
    const act = toActivity(ev);
    let swaps = [];
    try { swaps = JSON.parse(localStorage.getItem(STORAGE_SWAPS) || "[]"); } catch (_) { swaps = []; }
    // Remove any previous swap for this day (one seasonal per day)
    swaps = swaps.filter(s => s.dayNum !== dayNum);
    swaps.push({ dayNum: dayNum, seasonalId: ev.id });
    localStorage.setItem(STORAGE_SWAPS, JSON.stringify(swaps));
    applySwapsToDOM(dayNum, act);
    const panel = document.getElementById("seasonal-panel");
    if (panel) {
      const btn = panel.querySelector('[data-swap="' + dayNum + "-" + ev.id + '"]');
      if (btn) { btn.innerHTML = '<i class="fa-solid fa-check mr-1"></i>Added to Day ' + dayNum; btn.disabled = true; btn.classList.add("bg-green-600"); }
    }
  }

  /** Apply one swap to the rendered day card (works pre/post full re-apply) */
  function applySwapsToDOM(dayNum, act) {
    const card = document.getElementById("day-" + dayNum);
    if (!card) return;
    const rows = card.querySelectorAll(".activity-row");
    if (!rows.length) return;
    // Choose the row matching the event's slot: morning→first row, afternoon→row after a break/noon-ish, evening→last row
    let target = null;
    const rowsArr = Array.from(rows);
    if (act.slot === "evening") target = rowsArr[rowsArr.length - 1];
    else if (act.slot === "afternoon") {
      const mid = Math.floor(rowsArr.length / 2);
      target = rowsArr[mid] || rowsArr[rowsArr.length - 1];
    } else {
      target = rowsArr[0];
    }
    if (!target) return;
    const time = target.querySelector(".slot-time");
    const nameEl = target.querySelector(".activity-name");
    const priceEl = target.querySelector(".activity-price");
    if (nameEl) nameEl.textContent = act.name;
    if (priceEl) {
      priceEl.textContent = act.isFree ? "Free" : (act.priceHigh ? "$" + act.priceLow + "–$" + act.priceHigh : "");
    }
    target.classList.add("seasonal-row");
    target.dataset.seasonalId = act.id;
  }

  /** Full re-apply of all stored swaps after the plan renders */
  function applySwaps() {
    let swaps = [];
    try { swaps = JSON.parse(localStorage.getItem(STORAGE_SWAPS) || "[]"); } catch (_) { return; }
    if (!swaps.length) return;
    swaps.forEach(s => {
      const ev = SEASONAL_EVENTS.find(e => e.id === s.seasonalId);
      if (ev) applySwapsToDOM(s.dayNum, toActivity(ev));
    });
  }

  async function renderResultPanel() {
    const host = document.getElementById("seasonal-panel");
    if (!host) return;
    const events = await loadSeasonal();
    if (!events.length) return;
    // Current month events + up to 2 upcoming, excluding notices already shown on banner
    const now = currentEvents().filter(e => !e.isNotice);
    const feats = featuredEvents(6).filter(e => !e.isNotice);
    const shown = [];
    const seen = new Set();
    for (const ev of now.concat(feats)) {
      if (seen.has(ev.id)) continue;
      seen.add(ev.id);
      shown.push(ev);
      if (shown.length >= 5) break;
    }
    const days = window.__baliPlanDays || [];
    const picked = localStorage.getItem(STORAGE_PICKED);
    if (picked) {
      const ev = events.find(e => e.id === picked);
      if (ev && days.length) openSwapModal(ev);
      localStorage.removeItem(STORAGE_PICKED);
    }
    let swaps = [];
    try { swaps = JSON.parse(localStorage.getItem(STORAGE_SWAPS) || "[]"); } catch (_) { swaps = []; }
    const swappedIds = new Set(swaps.map(s => s.seasonalId));
    host.innerHTML =
      '<div class="mt-10 bg-gradient-to-br from-[#FFF8E1] to-white border border-amber-200 rounded-3xl p-7 md:p-9">' +
      '<div class="flex items-center gap-3 mb-2">' +
      '<div class="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center"><i class="fa-solid fa-calendar-star text-amber-700 text-lg"></i></div>' +
      '<h3 class="font-heading font-bold text-xl">Seasonal Highlights</h3>' +
      "</div>" +
      '<p class="text-[#757575] text-sm mb-6">Add a seasonal event to a specific day — we\'ll replace that day\'s main activity with it at the right time slot.</p>' +
      '<div class="space-y-3">' +
      shown.map(ev => {
        const price = ev.isFree ? '<span class="text-xs font-semibold text-green-700">Free</span>'
          : '<span class="text-xs font-semibold text-amber-800">$' + (ev.priceLow || ev.priceHigh || 0) + (ev.priceHigh && ev.priceHigh !== ev.priceLow ? "–$" + ev.priceHigh : "") + "</span>";
        const wasSwapped = swappedIds.has(ev.id);
        const pickable = days.filter(d => d.activities && d.activities.filter(a => !a.isBreak).length > 0);
        return '<div class="flex items-center gap-4 bg-white rounded-xl border border-gray-100 p-4" data-seasonal-id="' + ev.id + '">' +
          '<div class="w-12 h-12 rounded-lg flex items-center justify-center shrink-0" style="background:' + ev.gradient + ';"><i class="fa-solid ' + ev.icon + ' text-white text-lg"></i></div>' +
          '<div class="flex-1 min-w-0">' +
          '<h4 class="font-semibold text-sm leading-snug">' + ev.name + "</h4>" +
          '<p class="text-[11px] text-[#9E9E9E]"><i class="fa-solid fa-location-dot mr-1"></i>' + (ev.regionLabel || ev.region) + " · " + ev.displayDates + " · " + ev.bestTime + "</p>" +
          "</div>" + price +
          '<div class="shrink-0">' +
          (wasSwapped
            ? '<button class="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold" disabled><i class="fa-solid fa-check mr-1"></i>Added</button>'
            : (pickable.length
              ? '<button class="seasonal-swap-trigger px-3 py-1.5 rounded-lg bg-[#F9A825] text-white text-xs font-semibold hover:bg-amber-600 transition-colors" data-seasonal-id="' + ev.id + '"><i class="fa-solid fa-arrows-rotate mr-1"></i>Add to a Day</button>'
              : '<span class="text-[11px] text-[#9E9E9E]">No days yet</span>')) +
          "</div></div>";
      }).join("") +
      "</div>" +
      '<p class="text-[11px] text-[#9E9E9E] mt-4">Festivals follow the Balinese lunar calendar — dates shift yearly. Verify 2–3 weeks ahead.</p>' +
      "</div>";
    host.querySelectorAll(".seasonal-swap-trigger").forEach(btn => {
      btn.addEventListener("click", () => {
        const ev = events.find(e => e.id === btn.dataset.seasonalId);
        if (ev) openSwapModal(ev);
      });
    });
    applySwaps();
  }

  /* ------------------- Boot ------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("seasonal-banner")) renderHomepageBanner();
    if (document.getElementById("seasonal-panel")) renderResultPanel();
  });

  // Public API for tests + result page
  window.BaliSeasonal = {
    loadSeasonal,
    featuredEvents,
    currentEvents,
    toActivity,
    performSwap,
    applySwaps,
    applySwapsToDOM,
    openSwapModal,
    eventIsOnMonth,
    renderResultPanel,
  };
})();
