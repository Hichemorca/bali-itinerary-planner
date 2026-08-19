/* ============================================================
 * Phase 6: Dark mode — persists choice in localStorage, applies
 * a .dark class to <html>. Works on all pages that include it.
 * ============================================================ */
window.BaliDarkMode = {
  init() {
    const saved = localStorage.getItem("baliDarkMode");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const on = saved !== null ? saved === "1" : prefersDark;
    this.apply(on);
    // Attach toggle buttons (may exist in nav or floating)
    document.querySelectorAll("[data-dark-toggle]").forEach(btn => {
      btn.addEventListener("click", () => this.toggle());
      this.syncIcon(btn);
    });
  },
  toggle() {
    const on = !document.documentElement.classList.contains("dark");
    localStorage.setItem("baliDarkMode", on ? "1" : "0");
    this.apply(on);
    document.querySelectorAll("[data-dark-toggle]").forEach(btn => this.syncIcon(btn));
    if (window.gtag) window.gtag("event", "dark_mode_toggle", { on });
  },
  apply(on) {
    document.documentElement.classList.toggle("dark", on);
  },
  syncIcon(btn) {
    const on = document.documentElement.classList.contains("dark");
    const icon = btn.querySelector("i");
    if (icon) icon.className = on ? "fa-solid fa-sun" : "fa-solid fa-moon";
  },
};
