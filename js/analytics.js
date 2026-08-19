/* ============================================================
 * Google Analytics 4 — custom event tracking for the funnel
 * Replace G-XXXXXXXXXX with your GA4 Measurement ID (optional;
 * the site works fully without it — events are no-ops until set).
 * ============================================================ */
(function () {
  // Load GA4 (non-blocking). If GA_ID is empty the script still loads gtag no-op helpers below.
  window.GA_ID = ""; // TODO: set your GA4 Measurement ID, e.g. "G-XXXXXXXXXX"

  window.gtag = window.gtag || function () {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(arguments);
  };

  if (window.GA_ID) {
    const s1 = document.createElement("script");
    s1.async = true;
    s1.src = "https://www.googletagmanager.com/gtag/js?id=" + window.GA_ID;
    document.head.appendChild(s1);
    gtag("js", new Date());
    gtag("config", window.GA_ID, { send_page_view: true });
  }
})();

/* ---------- Funnel tracking helpers ---------- */
window.trackFunnel = {
  startQuiz()   { if (window.gtag) window.gtag("event", "quiz_start", {}); },
  completeQuiz() { if (window.gtag) window.gtag("event", "quiz_complete", {}); },
  viewResult()   { if (window.gtag) window.gtag("event", "view_result", {}); },
  buyClick()     { if (window.gtag) window.gtag("event", "buy_click", {}); },
  purchased()    { if (window.gtag) window.gtag("event", "purchase", { value: 29, currency: "USD" }); },
};

/* ---------- Image fade-in on lazy load ---------- */
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("img[loading='lazy']").forEach(img => {
    img.classList.add("img-lazy");
    if (img.complete) { img.classList.add("img-loaded"); }
    else { img.addEventListener("load", () => img.classList.add("img-loaded")); }
  });
});
