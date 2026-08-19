/* ============================================================
 * Quiz logic — 5 questions, progress bar, prev/next, submit
 * Answers saved to localStorage and passed to result.html
 * ============================================================ */

const QUESTIONS = [
  {
    id: "tripDuration",
    key: "tripDuration",
    question: "How long is your Bali trip?",
    subtitle: "Longer trips get a wider mix of regions.",
    options: [
      { value: 5,  label: "5 days",        hint: "South Bali highlights" },
      { value: 7,  label: "7 days",        hint: "Highlights + one day trip" },
      { value: 10, label: "10 days",       hint: "Island-wide exploration" },
      { value: 14, label: "14 days",       hint: "Deep dive incl. North Bali" },
    ],
    type: "single",
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
    id: "tripType",
    key: "tripType",
    question: "Who are you traveling with?",
    subtitle: "We match activities to your travel style.",
    options: [
      { value: "solo",      label: "Solo / Couple",              hint: "Freedom, wellness, romance" },
      { value: "family",    label: "Family (with kids)",         hint: "Kid-safe, short drives" },
      { value: "honeymoon", label: "Honeymoon / Anniversary",    hint: "Romantic, photogenic, relaxing" },
      { value: "friends",   label: "Friends' getaway",           hint: "Fun, social, nightlife-friendly" },
      { value: "nomad",     label: "Digital nomad",              hint: "Onboarding + weekend adventures" },
    ],
    type: "single",
  },
  {
    id: "interests",
    key: "interests",
    question: "What excites you most in Bali? (pick up to 3)",
    subtitle: "The more you pick, the more varied your plan.",
    options: [
      { value: "adventure",  label: "Adventure",  hint: "Trekking, ATV, surfing, rafting" },
      { value: "culture",    label: "Culture",    hint: "Temples, dance, art villages" },
      { value: "nature",     label: "Nature",     hint: "Waterfalls, beaches, snorkeling" },
      { value: "relaxation", label: "Relaxation", hint: "Spas, beach clubs, slow mornings" },
      { value: "food",       label: "Food",       hint: "Cooking classes, markets, cafes" },
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

let current = 0;
const answers = {};

function renderQuestion() {
  const q = QUESTIONS[current];
  const container = document.getElementById("question-container");
  const saved = answers[q.key];

  let optHtml = q.options.map((o, i) => {
    const selected = Array.isArray(saved) ? saved.includes(o.value) : saved === o.value;
    const cls = selected
      ? "border-[#2E7D32] bg-[#2E7D32]/5 ring-2 ring-[#2E7D32]/30"
      : "border-gray-200 hover:border-[#2E7D32]/50 hover:bg-[#F5F5F5]";
    const icon = selected ? '<i class="fa-solid fa-circle-check text-[#2E7D32]"></i>' : "";
    const multiBadge = q.type === "multi" ? '<span class="text-xs text-[#757575] ml-auto"><i class="fa-regular fa-square mr-1"></i>Pick up to 3</span>' : "";
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
  document.getElementById("progress-label").textContent = `Question ${current + 1} of 5`;
  document.getElementById("progress-pct").textContent = `${(current + 1) * 20}%`;
  document.getElementById("progress-bar").style.width = `${(current + 1) * 20}%`;
}

function updateButtons() {
  const q = QUESTIONS[current];
  const saved = answers[q.key];
  const answered = q.type === "multi" ? (saved && saved.length > 0) : saved !== undefined && saved !== "";
  const isLast = current === QUESTIONS.length - 1;

  document.getElementById("btn-prev").disabled = current === 0;
  document.getElementById("btn-next").classList.toggle("hidden", isLast || !answered);
  document.getElementById("btn-submit").classList.toggle("hidden", !isLast || !answered);
}

document.getElementById("btn-prev").addEventListener("click", () => {
  if (current > 0) { current--; renderQuestion(); }
});

document.getElementById("btn-next").addEventListener("click", () => {
  if (current < QUESTIONS.length - 1) { current++; renderQuestion(); }
});

document.getElementById("btn-submit").addEventListener("click", () => {
  // Fill sensible defaults if anything missing
  const full = {
    tripDuration: Number(answers.tripDuration) || 7,
    budgetTier: answers.budgetTier || "mid",
    tripType: answers.tripType || "solo",
    interests: (answers.interests && answers.interests.length) ? answers.interests : ["culture", "nature", "relaxation"],
    preferredRegion: answers.preferredRegion || "none",
  };
  localStorage.setItem("baliAnswers", JSON.stringify(full));

  // Simulated build steps for delight
  const overlay = document.getElementById("loading-overlay");
  const step = document.getElementById("loading-step");
  overlay.classList.remove("hidden");
  const steps = [
    "Filtering 90 activities by your budget…",
    "Matching activities to your travel style…",
    "Grouping days by region with real travel times…",
    "Adding insider tips and booking links…",
    "Finalizing your day-by-day plan…",
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
