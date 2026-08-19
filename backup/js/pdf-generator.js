/* ============================================================
 * Bali Itinerary Planner — PDF Generator (jsPDF via CDN)
 * generatePDF(itineraryData, userInfo, tripSummary)
 * ============================================================ */

function generatePDF(itineraryData, userInfo, tripSummary) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, M = 15, CW = W - 2 * M;

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
  doc.text(`${names[userInfo.tripType] || "Custom Trip"}  •  ${tripSummary.tripDuration} Days  •  ${tiers[userInfo.budgetTier]} Budget`, W / 2, 140, { align: "center" });

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
      doc.setTextColor(...DARK);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.text("PLAN NOTE: " + day.warning, M + 2, y + 2);
      y += 11;
    }

    for (const item of day.activities) {
      const a = item.act;
      if (y > 250) { doc.addPage(); y = 20; }

      // Activity card
      doc.setFillColor(...LIGHT);
      const cardH = 34;
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
      doc.text(nameLines, M + 5, y + 16);
      doc.setTextColor(...GREY);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(`${a.category}  •  ${a.region}  •  ${a.duration}h`, M + 5, y + 16 + nameLines.length * 4);

      // Price + rating
      doc.setTextColor(...DARK);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      const priceTxt = a.priceHigh > 0
        ? `USD ${Math.round(a.priceLow)}–${Math.round(a.priceHigh)}`
        : "Free";
      doc.text(priceTxt, M + 5, y + cardH - 5);
      if (a.rating) {
        doc.text(`★ ${a.rating.toFixed(1)}`, M + CW - 8, y + cardH - 5, { align: "right" });
      }

      // Booking link (blue text)
      doc.setTextColor(30, 90, 190);
      doc.setFontSize(8);
      doc.text(`Book: ${urlDisplay}`, M + CW - 8, y + cardH - 11, { align: "right" });

      y += cardH + 3;

      // Insider tip
      if (a.insiderTip && y < 265) {
        doc.setTextColor(...GREY);
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        doc.text("Insider tip: " + a.insiderTip, M + 5, y);
        y += 6;
      }
    }

    // Bonus / evening option
    if (day.bonus) {
      if (y > 255) { doc.addPage(); y = 20; }
      doc.setTextColor(...GREEN);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(`Evening bonus option: ${day.bonus.name} — ${generateInsiderTips(day.bonus)}`, M, y);
      y += 10;
    }
  }

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
