/* ============================================================
 * Bali Itinerary Planner — PDF Generator (jsPDF via CDN)
 * generatePDF(itineraryData, userInfo, tripSummary)
 * ============================================================ */

// Phase 6: async generator — returns a Promise so callers can await the save
async function generatePDF(itineraryData, userInfo, tripSummary) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, M = 15, CW = W - 2 * M;
  const imgPromises = [];

  // ---------- Palette ----------
  const GREEN = [31, 90, 80];
  const GOLD = [230, 155, 30];
  const DARK = [33, 33, 33];
  const GREY = [117, 117, 117];
  const LIGHT = [245, 248, 247];

  doc.setPageColor ? null : null; // keep compatibility

  let y = 0;

  // ---------- COVER PAGE ----------
  doc.setFillColor(...GREEN);
  doc.rect(0, 0, W, 297, "F");
  doc.setFillColor(...GOLD);
  doc.rect(0, 118, W, 3, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(34);
  doc.text("YOUR BALI ITINERARY", W / 2, 95, { align: "center" });
  doc.setFontSize(15);
  doc.setFont("helvetica", "normal");
  doc.text("Personalized Day-by-Day Trip Plan", W / 2, 108, { align: "center" });

  const names = {
    solo: "Solo Explorer", family: "Family Adventure", honeymoon: "Honeymoon Escape",
    friends: "Friends Getaway", nomad: "Digital Nomad", adventure: "Adventure Trail",
  };
  const tiers = { budget: "Budget", mid: "Mid-Range", luxury: "Luxury" };
  doc.setFontSize(13);
  doc.setTextColor(...GOLD);
  doc.text(`${names[userInfo.tripType] || "Custom Trip"}  •  ${tripSummary.tripDuration} Days  •  ${tiers[userInfo.budgetTier]}`, W / 2, 140, { align: "center" });

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  const regionText = userInfo.preferredRegion && userInfo.preferredRegion !== "none"
    ? `Based in: ${userInfo.preferredRegion}` : "Island-wide plan";
  doc.text(regionText, W / 2, 152, { align: "center" });
  doc.text(`Generated on ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, W / 2, 160, { align: "center" });
  doc.setFontSize(9);
  doc.setTextColor(200, 225, 220);
  doc.text("Includes: daily schedule with timings • booking links • insider tips • practical info", W / 2, 172, { align: "center" });

  // ---------- PRACTICAL TIPS PAGE ----------
  doc.addPage();
  doc.setDrawColor(...GREEN);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...GREEN);
  doc.text("Before You Go — Practical Essentials", M, 22);

  const tips = [
    { t: "Money", d: "Currency: Indonesian Rupiah (IDR). ~16,500 IDR = 1 USD. Cards accepted in tourist areas; carry cash for warungs, markets and small entry fees. Avoid street money-changer scams — use official banks." },
    { t: "Getting Around", d: "Private driver: IDR 600K-1M (~$40-65) for a full 10-hour day — often cheaper than guided tours. Grab/Gojek apps work in the south. Scooter rental ~$5-7/day (international license advised)." },
    { t: "Traffic Reality", d: "South Bali roads are congested. A 'short' 15 km hop can take 1 hour. Group activities by region each day — this plan already does that for you." },
    { t: "Temple Dress Code", d: "Temples require a sarong covering knees (men and women). Most temples rent them at the entrance for IDR 10-30K. No sleeveless tops at Pura." },
    { t: "Connectivity", d: "Buy a tourist eSIM or local SIM at the airport (Telkomsel ~IDR 100K for 15GB). WhatsApp is how you'll coordinate with drivers and guides." },
    { t: "Safety", d: "Monkeys at temples grab phones and sunglasses. Carry travel insurance. Never swim at beaches with red flags (strong currents). Drink bottled/filtered water." },
    { t: "Packing", d: "Light clothing + light jacket for highlands (Kintamani, Munduk, Bedugul). Water shoes for waterfalls. Reef-safe sunscreen. Dry bag for snorkeling." },
    { t: "Booking Ahead", d: "In July-August and December, pre-book Mount Batur, Nusa Penida trips and Kecak shows. Use the booking links in this plan for free-cancellation options." },
  ];
  y = 34;
  for (const tip of tips) {
    if (y > 265) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...GOLD);
    doc.text(tip.t, M, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...DARK);
    const lines = doc.splitTextToSize(tip.d, CW - 25);
    doc.text(lines, M + 2, y + 5);
    y += lines.length * 4.6 + 9;
  }

  // ---------- COST SUMMARY ----------
  if (y > 245) { doc.addPage(); y = 20; }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...GREEN);
  doc.text("Estimated Activity Budget", M, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...DARK);
  const costLine = `Approx. USD ${tripSummary.estimatedCostPerDay}/day on activities & transport (your ${tiers[userInfo.budgetTier]} tier). ` +
    `Food adds ~$10-20/day (warungs) to $40+/day (beach clubs). Full trip estimate: ~USD ${tripSummary.estimatedCostPerDay * tripSummary.tripDuration} for activities.`;
  doc.text(doc.splitTextToSize(costLine, CW), M, y);
  y += 14;

  // ---------- DAILY PAGES ----------
  for (const day of itineraryData.days) {
    // Phase 5: flex day gets its own softer page with optional picks
    if (day.isFlex) {
      doc.addPage();
      y = 20;
      doc.setFillColor(...GOLD);
      doc.rect(M - 2, y - 6, CW + 4, 14, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.text(`Day ${day.dayNum} — Flex Day`, M, y + 4);
      y += 18;
      doc.setTextColor(...DARK);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      const noteLines = doc.splitTextToSize(day.flexNote || "Today is your flexible day — pick what you feel like!", CW);
      doc.text(noteLines, M, y);
      y += noteLines.length * 5 + 4;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...GREY);
      const sub = "Optional day — no fixed schedule. Pick any of these fresh activities, revisit a favorite, or enjoy spa time.";
      y += doc.splitTextToSize(sub, CW).length * 4 + 3;
      if (y > 250) { doc.addPage(); y = 20; }
      for (const a of day.flexOptions || []) {
        if (y > 255) { doc.addPage(); y = 20; }
        const freeAct = a.isFree || a.priceHigh <= 1;
        if (freeAct) { doc.setFillColor(200, 230, 201); } else { doc.setFillColor(245, 245, 245); }
        doc.rect(M, y, CW, 16, "FD");
        doc.setTextColor(...DARK);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        const n = doc.splitTextToSize(a.name + (freeAct ? " (FREE)" : ""), CW - 45);
        doc.text(n, M + 3, y + 6);
        doc.setTextColor(...GREY);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        const priceTxt = a.priceHigh > 0 ? `USD ${Math.round(a.priceLow)}–${Math.round(a.priceHigh)}` : "Free";
        doc.text(`${a.region}  •  ~${a.duration}h  •  ${priceTxt}`, M + 3, y + 12);
        y += 19;
      }
      continue;
    }

    doc.addPage();
    y = 20;

    // Day header band
    doc.setFillColor(...GREEN);
    doc.rect(M - 2, y - 6, CW + 4, 14, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text(`Day ${day.dayNum}`, M, y + 4);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const travelTxt = day.travelHours > 0 ? `${day.travelHours.toFixed(1)}h total driving` : "Local day — minimal driving";
    doc.text(travelTxt, W - M, y + 4, { align: "right" });
    y += 18;

    // Warning
    if (day.warning) {
      doc.setFillColor(...GOLD);
      doc.setDrawColor(...GOLD);
      doc.rect(M, y - 4, CW, 9, "FD");
      doc.setDrawColor(...GREEN); // reset — cards must not inherit the gold stroke
      doc.setTextColor(...DARK);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.text("PLAN NOTE: " + day.warning, M + 2, y + 2);
      y += 11;
    }

    for (const item of day.activities) {
      const a = item.act;
      if (y > 250) { doc.addPage(); y = 20; }

      // Phase 5: meal-break rows render as compact neutral rows
      if (item.isBreak) {
        doc.setTextColor(...GREY);
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8.5);
        doc.text(safePDFText(`${item.startTime}–${item.endTime}   ${a.name}${a.insiderTip ? " — " + a.insiderTip : ""}`), M + 4, y + 4);
        y += 8;
        continue;
      }

      // Activity card
      doc.setFillColor(...LIGHT);
      const cardH = 40;
      const urlDisplay = bookableLinkPDF(a) ? shortenUrl(a.bookingLink) : "";
      doc.rect(M, y, CW, cardH, "FD");
      doc.setFillColor(...GREEN);
      doc.rect(M, y, 2, cardH, "F");

      // Time
      doc.setTextColor(...GREEN);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(`${item.startTime} – ${item.endTime}`, M + 5, y + 6);
      if (item.travelBefore) {
        doc.setTextColor(...GREY);
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        doc.text(`(+ ${item.travelBefore} before)`, M + 5, y + 11);
      }

      // Name + category
      doc.setTextColor(...DARK);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      const nameLines = doc.splitTextToSize(a.name, CW - 40);
      doc.text(safePDFText(nameLines), M + 5, y + 16);
      doc.setTextColor(...GREY);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(`${a.category}  •  ${a.region}  •  ${a.duration}h`, M + 5, y + 16 + nameLines.length * 4);

      // Phase 6: small activity photo thumbnail (async-loaded)
      if (a.imageUrl && imgPromises) {
        const pageAtDraw = doc.getCurrentPageInfo().pageNumber;
        const promise = loadPDFFormatImg(a.imageUrl, doc).then((entry) => {
          if (!entry) return;
          // draw on the page where the card actually is (layout may have paged since)
          doc.setPage(pageAtDraw);
          try { doc.addImage(entry.src, entry.fmt, M + CW - 29, y + 3, 26, 20); } catch (e) { /* skip broken image */ }
        });
        imgPromises.push(promise);
      }

      // Price + rating
      doc.setTextColor(...DARK);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      const priceTxt = a.priceHigh > 0
        ? `USD ${Math.round(a.priceLow)}–${Math.round(a.priceHigh)}`
        : "Free";
      doc.text(safePDFText(priceTxt), M + 5, y + cardH - 5);
      if (a.rating) {
        doc.text(`★ ${a.rating.toFixed(1)}`, M + CW - 8, y + cardH - 5, { align: "right" });
      }

      // Booking link (blue text)
      doc.setTextColor(30, 90, 190);
      doc.setFontSize(8);
      doc.text(`Book: ${urlDisplay}`, M + CW - 36, y + cardH - 11, { align: "right" });

      y += cardH + 3;

      // Insider tip
      const safeTip = a.insiderTip ? safePDFText(a.insiderTip).trim() : "";
      if (safeTip && y < 262) {
        doc.setTextColor(...GREY);
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        const tipLines = doc.splitTextToSize("Insider tip: " + safeTip, CW - 34);
        doc.text(tipLines, M + 5, y);
        y += Math.min(tipLines.length, 2) * 4 + 4;
      }
    }

    // Bonus / evening option
    if (day.bonus) {
      if (y > 255) { doc.addPage(); y = 20; }
      doc.setTextColor(...GREEN);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(safePDFText(`Evening bonus option: ${day.bonus.name} — ${generateInsiderTips(day.bonus)}`), M, y);
      y += 10;
    }
  }

  // ---------- WAIT FOR ALL THUMBNAIL IMAGES ----------
  await Promise.allSettled(imgPromises);

  // ---------- FOOTER NOTE ON EVERY PAGE ----------
  const pageCount = doc.internal.getNumberOfPages();
  for (let p = 2; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(7.5);
    doc.setTextColor(...GREY);
    doc.setFont("helvetica", "normal");
    doc.text(`Bali Interactive Itinerary Planner  •  Page ${p - 1} of ${pageCount - 1}  •  Prices approximate, verify before booking`, W / 2, 290, { align: "center" });
  }

  doc.save(`bali-itinerary-${userInfo.tripType}-${tripSummary.tripDuration}d.pdf`);
}

// Phase 6: sanitize text for jsPDF latin-1 standard fonts (Indonesian text uses curly quotes, em-dashes, ellipses)
function safePDFText(s) {
  return String(s)
    .replace(/‘|’|‚/g, "'")
    .replace(/“|”/g, '"')
    .replace(/–|―/g, "-")
    .replace(/…/g, "...")
    .replace(/[\u0100-\uFFFF]/g, (ch) => {
      // transliterate common latin extensions
      const map = { "è": "e", "é": "e", "ñ": "n", "ö": "o", "ü": "u", "á": "a" };
      return map[ch] || "";
    });
}

// Phase 6: async thumbnail cache for activity card images in the PDF
const pdfImgCache = {};
async function loadPDFFormatImg(url, doc) {
  if (pdfImgCache[url]) return pdfImgCache[url];
  try {
    const resp = await fetch(url);
    if (!resp.ok) { pdfImgCache[url] = null; return null; }
    const blob = await resp.blob();
    const img = await new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => rej(new Error("img fail"));
      im.src = URL.createObjectURL(blob);
    });
    let fmt, src;
    if (blob.type === "image/webp") {
      // jsPDF can't decode webp directly — rasterize to PNG via canvas dataURL
      const cv = document.createElement("canvas");
      cv.width = 200; cv.height = 150;
      cv.getContext("2d").drawImage(img, 0, 0, 200, 150);
      fmt = "PNG"; src = cv.toDataURL("image/png");
    } else {
      fmt = blob.type === "image/png" ? "PNG" : "JPEG"; src = img;
    }
    pdfImgCache[url] = { fmt, src };
    return pdfImgCache[url];
  } catch (e) {
    pdfImgCache[url] = null;
    return null;
  }
}

function bookableLinkPDF(a) {
  const u = a.bookingLink || "";
  return u && !u.includes("goo.gl") && !u.endsWith("getyourguide.com/") && u !== "https://www.getyourguide.com/";
}

function shortenUrl(url) {
  try {
    const u = new URL(url);
    let path = u.pathname.split("/").filter(Boolean).slice(-1)[0] || u.hostname;
    if (path.length > 30) path = path.slice(0, 30) + "\u2026";
    return `${u.hostname.replace("www.", "")}/${path}`;
  } catch (e) {
    return url.length > 36 ? url.slice(0, 36) + "\u2026" : url;
  }
}

window.BaliPDF = { generatePDF };
