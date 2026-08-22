/* ============================================================
 * Quiz logic — 4 questions (Phase 6), progress bar, prev/next, submit
 * Q3 merges trip type + interests into one multi-select card step.
 * Answers saved to localStorage and passed to result.html
 * ============================================================ */

const QUESTIONS = [
  {
    id: "tripDates",
    key: "tripDates",
    question: "When are you planning to visit Bali?",
    subtitle: "We'll check for seasonal events and weather during your stay.",
    type: "date_range",
  },
  {
    id: "budgetTier",
    key: "budgetTier",
    question: "What's your daily budget for activities, food & transport?",
    subtitle: "This shapes which activities we include each day.",
    options: [
      { value: "budget", label: "Budget — $25-50/day",     hint: "Warungs, beaches, temples, local drivers" },
      { value: "mid",    label: "Mid-range — $50-150/day", hint: "Mix of highlights, guided tours, beach clubs" },
      { value: "luxury", label: "Luxury — $150+/day",      hint: "Private tours, yachts, fine dining, spas" },
    ],
    type: "single",
  },
  {
    // Phase 6: trip type + interests merged into one question (multi-select)
    id: "tripType",
    key: "tripType",
    question: "What kind of traveler are you? (pick your top 2-3)",
    subtitle: "Your vibe AND interests in one answer — we match the plan to it.",
    options: [
      { value: "adventure",  label: "🏄 Adventurer",  hint: "Trekking, ATV, surfing, rafting — pure adrenaline" },
      { value: "culture",    label: "🏛 Culture lover", hint: "Temples, dance, art villages, history" },
      { value: "nature",     label: "🌿 Nature seeker", hint: "Waterfalls, beaches, snorkeling, sunrise hikes" },
      { value: "relaxation", label: "🧘 Relaxer",     hint: "Spas, beach clubs, slow mornings, yoga" },
      { value: "food",       label: "🍽 Foodie",      hint: "Cooking classes, markets, cafes, seafood grills" },
      { value: "family",     label: "👨‍👩‍👧 Family trip", hint: "Kid-safe activities, short drives, fun for all" },
      { value: "honeymoon",  label: "💑 Honeymoon / anniversary", hint: "Romantic, photogenic, private & relaxing" },
      { value: "solo",       label: "🎒 Solo traveler", hint: "Freedom, wellness, meeting new people" },
    ],
    type: "multi",
    max: 3,
  },
  {
    id: "preferredRegion",
    key: "preferredRegion",
    question: "Where are you staying (or where do you want to base yourself)?",
    subtitle: "We'll build your days around realistic driving times.",
    options: [
      { value: "Ubud",       label: "Ubud",        hint: "Rice terraces, culture, jungle" },
      { value: "Seminyak",   label: "Seminyak",    hint: "Beach clubs, dining, shopping" },
      { value: "Canggu",     label: "Canggu",      hint: "Surf, cafes, nomad scene" },
      { value: "Uluwatu",    label: "Uluwatu",     hint: "Cliffs, beaches, luxury" },
      { value: "North Bali", label: "North Bali",  hint: "Waterfalls, lakes, dolphins" },
      { value: "none",       label: "No preference", hint: "We'll pick the best base areas for you" },
    ],
    type: "single",
  },
];

// Map trip-type keywords back to the original tripType enum (for the engine)
const TYPE_KEYWORDS = {
  family: ["family"],
  honeymoon: ["honeymoon"],
  solo: ["solo"],
};

let current = 0;
const answers = {};

  // Phase 6: support resuming a previous quiz ("Edit Plan" flow) or a shared plan link
  try {
    const prev = JSON.parse(localStorage.getItem("baliAnswers") || "{}");
    const params = new URLSearchParams(location.search);
    const edit = params.get("edit");
    const share = params.get("share");
    let shared = null;
    if (share) shared = JSON.parse(decodeURIComponent(share));
    if (edit || shared) {
      const s = shared || {};
      if (s.d) answers.tripDuration = String(s.d);
      if (s.b) answers.budgetTier = s.b;
      if (s.t) answers.tripType = s.t.split(",").filter(Boolean);
      if (s.r) answers.preferredRegion = s.r;
      if (s.sd) answers.startDate = s.sd;
    } else if (prev.tripType && Array.isArray(prev.interests)) {
      answers.tripType = [...new Set([...prev.interests, ...prev.tripType.split(/,\s*/).filter(Boolean)])];
    }
    if (!shared) {
      if (prev.tripDuration) answers.tripDuration = String(prev.tripDuration);
      if (prev.budgetTier) answers.budgetTier = prev.budgetTier;
      if (prev.preferredRegion) answers.preferredRegion = prev.preferredRegion;
      if (prev.startDate) answers.startDate = prev.startDate;
    }
  } catch (e) { /* ignore */ }

function renderQuestion() {
  const q = QUESTIONS[current];
  const container = document.getElementById("question-container");
  const saved = answers[q.key];

  if (q.type === "date_range") {
    const start = answers.startDate || "";
    const duration = answers.tripDuration || "";
    container.innerHTML = `
      <div class="fade-in">
        <span class="inline-block px-3 py-1 rounded-full bg-[#2E7D32]/10 text-[#2E7D32] text-xs font-semibold mb-4">Question ${current + 1}</span>
        <h2 class="font-heading font-bold text-2xl md:text-3xl mb-2">${q.question}</h2>
        <p class="text-[#757575] mb-7">${q.subtitle}</p>
        <div class="space-y-6 max-w-sm">
          <div>
            <label class="block text-sm font-bold text-[#212121] mb-2">Arrival Date</label>
            <input type="date" id="start-date" value="${start}" 
              class="w-full px-5 py-4 rounded-2xl border-2 border-gray-200 focus:border-[#2E7D32] outline-none transition-all">
          </div>
          <div>
            <label class="block text-sm font-bold text-[#212121] mb-2">Duration (Nights)</label>
            <select id="trip-duration" class="w-full px-5 py-4 rounded-2xl border-2 border-gray-200 focus:border-[#2E7D32] outline-none transition-all bg-white">
              <option value="" disabled ${!duration ? 'selected' : ''}>Select duration...</option>
              <option value="3" ${duration == 3 ? 'selected' : ''}>3 nights (Quick escape)</option>
              <option value="5" ${duration == 5 ? 'selected' : ''}>5 nights (Highlights)</option>
              <option value="7" ${duration == 7 ? 'selected' : ''}>7 nights (Standard)</option>
              <option value="10" ${duration == 10 ? 'selected' : ''}>10 nights (Island-wide)</option>
              <option value="14" ${duration == 14 ? 'selected' : ''}>14 nights (Deep dive)</option>
            </select>
          </div>
        </div>
      </div>`;
    
    const inputDate = document.getElementById("start-date");
    const inputDur = document.getElementById("trip-duration");
    
    const update = () => {
      answers.startDate = inputDate.value;
      answers.tripDuration = inputDur.value;
      updateButtons();
    };
    
    inputDate.addEventListener("input", update);
    inputDate.addEventListener("change", update);
    inputDur.addEventListener("change", update);
    updateButtons();
    return;
  }

  let optHtml = q.options.map((o, i) => {
    const selected = Array.isArray(saved) ? saved.includes(o.value) : saved === o.value;
    const cls = selected
      ? "border-[#2E7D32] bg-[#2E7D32]/5 ring-2 ring-[#2E7D32]/30"
      : "border-gray-200 hover:border-[#2E7D32]/50 hover:bg-[#F5F5F5]";
    const icon = selected ? '<i class="fa-solid fa-circle-check text-[#2E7D32]"></i>' : "";
    const multiBadge = q.type === "multi" ? `<span class="text-xs text-[#757575] ml-auto"><i class="fa-regular fa-square mr-1"></i>Pick up to ${q.max}</span>` : "";
    return `
      <button class="opt-btn w-full text-left rounded-2xl border-2 p-5 transition-all ${cls}" data-value="${o.value}">
        <div class="flex items-start gap-3">
          <div class="flex-1">
            <div class="font-semibold text-[#212121]">${o.label} ${icon}</div>
            <div class="text-sm text-[#757575] mt-1">${o.hint}</div>
          </div>
          ${multiBadge}
        </div>
      </button>`;
  }).join("");

  container.innerHTML = `
    <div class="fade-in">
      <span class="inline-block px-3 py-1 rounded-full bg-[#2E7D32]/10 text-[#2E7D32] text-xs font-semibold mb-4">Question ${current + 1}</span>
      <h2 class="font-heading font-bold text-2xl md:text-3xl mb-2">${q.question}</h2>
      <p class="text-[#757575] mb-7">${q.subtitle}</p>
      <div class="grid md:grid-cols-2 gap-3">${optHtml}</div>
    </div>`;

  container.querySelectorAll(".opt-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const val = btn.dataset.value;
      if (q.type === "multi") {
        let sel = Array.isArray(answers[q.key]) ? [...answers[q.key]] : [];
        if (sel.includes(val)) {
          sel = sel.filter(v => v !== val);
        } else {
          if (sel.length >= q.max) {
            sel.shift();
          }
          sel.push(val);
        }
        answers[q.key] = sel;
      } else {
        answers[q.key] = val;
      }
      renderQuestion();
      updateButtons();
    });
  });

  updateButtons();
  const pct = Math.round(((current + 1) / QUESTIONS.length) * 100);
  document.getElementById("progress-label").textContent = `Question ${current + 1} of ${QUESTIONS.length}`;
  document.getElementById("progress-pct").textContent = `${pct}%`;
  document.getElementById("progress-bar").style.width = `${pct}%`;
}

function updateButtons() {
  const q = QUESTIONS[current];
  const saved = answers[q.key];
  let answered = false;
  if (q.type === "date_range") {
    answered = !!(answers.startDate && answers.tripDuration);
  } else if (q.type === "multi") {
    answered = (saved && saved.length > 0);
  } else {
    answered = saved !== undefined && saved !== "";
  }
  const isLast = current === QUESTIONS.length - 1;

  const btnPrev = document.getElementById("btn-prev");
  const btnNext = document.getElementById("btn-next");
  const btnSubmit = document.getElementById("btn-submit");

  if (btnPrev) {
    btnPrev.disabled = current === 0;
    btnPrev.style.display = current === 0 ? "none" : "inline-flex";
    btnPrev.classList.toggle("hidden", current === 0);
  }
  
  if (btnNext) {
    if (!isLast && answered) {
      btnNext.style.display = "inline-flex";
      btnNext.classList.remove("hidden");
    } else {
      btnNext.style.display = "none";
      btnNext.classList.add("hidden");
    }
  }
  
  if (btnSubmit) {
    if (isLast && answered) {
      btnSubmit.style.display = "inline-flex";
      btnSubmit.classList.remove("hidden");
    } else {
      btnSubmit.style.display = "none";
      btnSubmit.classList.add("hidden");
    }
  }
}

document.getElementById("btn-prev").addEventListener("click", () => {
  if (current > 0) { current--; renderQuestion(); }
});

document.getElementById("btn-next").addEventListener("click", () => {
  if (current < QUESTIONS.length - 1) { current++; renderQuestion(); }
});

// Track quiz start on page load
if (window.trackFunnel) window.trackFunnel.startQuiz();

document.getElementById("btn-submit").addEventListener("click", () => {
  // Phase 6: derive tripType (enum) + interests[] from the merged Q3 selection
  const q3 = Array.isArray(answers.tripType) ? answers.tripType : [];
  const tripType = q3.find(v => TYPE_KEYWORDS[v] && TYPE_KEYWORDS[v][0] === v) ||
                   (q3.includes("family") ? "family" : q3.includes("honeymoon") ? "honeymoon" : "solo");
  const interests = q3.filter(v => ["adventure", "culture", "nature", "relaxation", "food"].includes(v));

  // Fill sensible defaults if anything missing
  const full = {
    tripDuration: Number(answers.tripDuration) || 7,
    startDate: answers.startDate || new Date().toISOString().split('T')[0],
    budgetTier: answers.budgetTier || "mid",
    tripType: tripType,
    interests: interests.length ? interests : ["nature", "relaxation"],
    rainyBackup: false, // Phase 6: removed rainy question (toggle still available on result page)
    preferredRegion: answers.preferredRegion || "none",
  };
  localStorage.setItem("baliAnswers", JSON.stringify(full));

  // Simulated build steps for delight
  const overlay = document.getElementById("loading-overlay");
  const step = document.getElementById("loading-step");
  overlay.classList.remove("hidden");
  if (window.trackFunnel) window.trackFunnel.completeQuiz();
  const steps = [
    "Filtering 141 activities by your budget…",
    "Matching activities to your travel style…",
    "Grouping days by region with real travel times…",
    "Adding private driver logistics…",
    "Adding insider tips and booking links…",
    "Finalizing your zero-repeat day-by-day plan…",
  ];
  let i = 0;
  const iv = setInterval(() => {
    if (i < steps.length) { step.textContent = steps[i++]; }
  }, 550);
  setTimeout(() => {
    clearInterval(iv);
    window.location.href = "result.html";
  }, 3000);
});

renderQuestion();
