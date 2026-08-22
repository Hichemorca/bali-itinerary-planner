/* ============================================================
 * Google Analytics 4 — custom event tracking for the funnel
 *
 * REPLACE ME: set window.GA_ID to your GA4 Measurement ID
 * (e.g. "G-XXXXXXXXXX") when you create the property in GA.
 * Until then, every call below is a safe no-op and the site
 * works fully without it.
 * ============================================================ */
(function () {
  // dataLayer must exist before gtag() is used anywhere
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };

  window.GA_ID = ""; // TODO: set your GA4 Measurement ID, e.g. "G-XXXXXXXXXX"

  if (window.GA_ID) {
    gtag("js", new Date());
    // Standard GA4 page_view with location/title for accurate reporting
    gtag("config", window.GA_ID, {
      send_page_view: true,
      page_location: window.location.href,
      page_title: document.title,
    });
    const s1 = document.createElement("script");
    s1.async = true;
    s1.src = "https://www.googletagmanager.com/gtag/js?id=" + window.GA_ID;
    document.head.appendChild(s1);
  }
})();

/* ---------- Funnel tracking helpers ----------
 * Funnel: quiz_start -> quiz_complete -> view_result ->
 * buy_click -> purchase -> download_pdf / download_ics /
 * add_to_google_calendar / rainy_mode_toggle / share_plan / plan_rated
 * These map 1:1 to GA4 events usable in funnel explorations.
 */
window.trackFunnel = {
  startQuiz: function () { if (window.gtag) window.gtag("event", "quiz_start", {}); },
  completeQuiz: function () { if (window.gtag) window.gtag("event", "quiz_complete", {}); },
  viewResult: function () { if (window.gtag) window.gtag("event", "view_result", {}); },
  buyClick: function () { if (window.gtag) window.gtag("event", "buy_click", {}); },
  purchased: function () { if (window.gtag) window.gtag("event", "purchase", { value: 29, currency: "USD" }); },
};

/* ---------- Image handling ---------- */
// Standard browser lazy loading is sufficient; no extra JS needed for basic visibility.
// This block is kept empty to avoid conflicts with previous versions.
