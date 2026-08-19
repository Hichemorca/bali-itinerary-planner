/* ============================================================
 * Gumroad integration — listens to Gumroad overlay purchase
 * events and unlocks the itinerary experience.
 * Requires: https://gumroad.com/js/gumroad.js loaded after this.
 * Replace GUMROAD_PRODUCT_ID with your real product permalink
 * (e.g., "bali-bespoke-itinerary") and update result.html links.
 * ============================================================ */

const GUMROAD_PRODUCT_ID = "your-product-id"; // <-- replace with your Gumroad permalink
const GUMROAD_PRICE = 19; // launch price (set in Gumroad dashboard: fixed price $19 first 100 customers, then $29)

(function () {
  if (typeof window.Gumroad === "undefined") return;

  // Listen for successful purchases via Gumroad's buyer event
  window.Gumroad.buy = function (product, purchase) {
    // Gumroad overlay fires this on successful purchase in single-product mode
    markPurchased(purchase && purchase.email);
  };

  // Fallback: Gumroad can also redirect to a custom redirect URL after purchase.
  // Set your product's "After purchase → redirect" to: https://yourdomain.com/thank-you.html
  // The thank-you page then points back to result.html.
})();

/**
 * Mark the visitor as purchased so the unlock banner adapts.
 */
function markPurchased(email) {
  localStorage.setItem("baliPurchased", "true");
  if (email) {
    const saved = JSON.parse(localStorage.getItem("baliAnswers") || "{}");
    saved.email = email;
    localStorage.setItem("baliAnswers", JSON.stringify(saved));
  }
  // Refresh result page behavior if already on it
  if (window.applyPurchaseState) window.applyPurchaseState();
}

/**
 * Check purchase state (e.g., after returning from Gumroad)
 */
function isPurchased() {
  return localStorage.getItem("baliPurchased") === "true"
    || window.location.search.indexOf("purchased=1") !== -1;
}

window.BaliGumroad = { markPurchased, isPurchased, GUMROAD_PRODUCT_ID, GUMROAD_PRICE };
