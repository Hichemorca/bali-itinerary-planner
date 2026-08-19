/* ============================================================
 * Interactive Map (Leaflet) + Calendar Export (Google Cal / ICS)
 * Coordinates: approximate region centers + per-activity lat/lng
 * ============================================================ */

// Approximate coordinates for Bali activity regions / key spots
const COORDS = {
  "Ubud":        { lat: -8.5069, lng: 115.2625 },
  "Seminyak":    { lat: -8.6913, lng: 115.1734 },
  "Canggu":      { lat: -8.6478, lng: 115.1385 },
  "Uluwatu":     { lat: -8.8291, lng: 115.0846 },
  "Nusa Penida": { lat: -8.7270, lng: 115.5440 },
  "North Bali":  { lat: -8.2378, lng: 115.1159 },
  "Kuta":        { lat: -8.7183, lng: 115.1686 },
  "Multi-region":{ lat: -8.6500, lng: 115.2167 },
};

// Fine-tuned coordinates for the most-booked activities
const FINE_COORDS = {
  5:  { lat: -8.2424, lng: 115.3753 },   // Mount Batur
  21: { lat: -8.3720, lng: 115.6097 },   // Lempuyang
  4:  { lat: -8.4152, lng: 115.3155 },   // Tirta Empul
  46: { lat: -8.8292, lng: 115.0851 },   // Uluwatu Temple
  40: { lat: -8.6216, lng: 115.0874 },   // Tanah Lot
  65: { lat: -8.7188, lng: 115.4627 },   // Kelingking
  66: { lat: -8.1667, lng: 115.0167 },   // Lovina
  71: { lat: -8.2735, lng: 115.1690 },   // Ulun Danu
  73: { lat: -8.2466, lng: 115.1803 },   // Handara
  78: { lat: -8.7184, lng: 115.1687 },   // Kuta
  24: { lat: -8.6895, lng: 115.1539 },   // Potato Head
  35: { lat: -8.6483, lng: 115.1292 },   // Finns
  36: { lat: -8.6473, lng: 115.1350 },   // Atlas
  88: { lat: -8.6536, lng: 115.2220 },   // Devdan (Bali Nusa Dua Theatre)
  58: { lat: -8.8012, lng: 115.1662 },   // GWK
  82: { lat: -8.7776, lng: 115.1755 },   // Jimbaran
};

/**
 * initBaliMap(mapEl, days, data)
 * Renders day-colored markers for all scheduled activities.
 */
function initBaliMap(mapEl, days) {
  if (typeof L === "undefined") return; // Leaflet not loaded
  const map = L.map(mapEl, { scrollWheelZoom: false }).setView([-8.4095, 115.1889], 9);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors",
    maxZoom: 19,
  }).addTo(map);

  const DAY_COLORS = ["#2E7D32", "#F9A825", "#0288D1", "#C2185B", "#6A1B9A", "#EF6C00", "#00838F", "#4E342E", "#558B2F", "#AD1457"];
  let bounds = [];

  days.forEach((day) => {
    const color = DAY_COLORS[(day.dayNum - 1) % DAY_COLORS.length];
    day.activities.forEach((item) => {
      const a = item.act;
      if (item.isDriver || item.isBreak) return;
      const c = FINE_COORDS[a.id] || COORDS[a.region] || COORDS["Multi-region"];
      const marker = L.circleMarker([c.lat, c.lng], {
        radius: 9, color: "#fff", weight: 2, fillColor: color, fillOpacity: 0.9,
      }).addTo(map);
      const price = a.priceHigh > 0 ? `$${Math.round(a.priceLow)}–$${Math.round(a.priceHigh)}` : "Free";
      marker.bindPopup(`
        <div style="max-width:220px;font-family:inherit;">
          <b>Day ${day.dayNum} • ${item.startTime}</b><br/>
          <span style="font-size:13px;">${a.name}</span><br/>
          <span style="font-size:12px;color:#555;">${price} • ${a.region}</span>
        </div>`);
      bounds.push([c.lat, c.lng]);
    });
  });

  if (bounds.length) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
  map.invalidateSize();
  return map;
}

/**
 * Build ICS file content and download it.
 */
// RFC 5545 basic date-time format: YYYYMMDDTHHMMSSZ (iCalendar standard)
function basicFormat(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return d.getUTCFullYear().toString() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate())
    + "T" + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + "Z";
}

function downloadICS(plan, tripType) {
  const fmtDT = (dayNum, timeStr, durHours) => {
    // timeStr like "8:30 AM"; approx start date = next Monday (relative)
    if (!timeStr || typeof timeStr !== "string") return null;
    const m = timeStr.match(/(\d+):(\d+) (AM|PM)/);
    if (!m) return null;
    let [_, hh, mm, ampm] = m;
    hh = parseInt(hh, 10); mm = parseInt(mm, 10);
    if (ampm === "PM" && hh < 12) hh += 12;
    if (ampm === "AM" && hh === 12) hh = 0;
    const d = new Date();
    d.setDate(d.getDate() + (1 - d.getDay() + 7) % 7 + (dayNum - 1)); // next Monday + offset
    d.setHours(hh, mm, 0);
    return basicFormat(d); // RFC 5545 basic format YYYYMMDDTHHMMSSZ (compatible with Outlook, Apple Cal, Google)
  };

  let ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Bali Itinerary Planner//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  const startBase = new Date();
  startBase.setDate(startBase.getDate() + (1 - startBase.getDay() + 7) % 7);

  plan.days.forEach((day) => {
    day.activities.forEach((item) => {
      if (item.isDriver || item.isBreak) return;
      const dtStart = fmtDT(day.dayNum, item.startTime, item.act.duration);
      if (!dtStart) return;
      const end = new Date(new Date(dtStart).getTime() + item.act.duration * 3600000);
      const dtEnd = basicFormat(end);
      ics.push("BEGIN:VEVENT");
      ics.push(`UID:bali-${day.dayNum}-${item.act.id}@baliplanner`);
      ics.push(`DTSTAMP:${basicFormat(new Date())}`);
      ics.push(`DTSTART:${dtStart}`);
      ics.push(`DTEND:${dtEnd}`);
      ics.push(`SUMMARY:Day ${day.dayNum}: ${item.act.name}`);
      ics.push(`LOCATION:${item.act.location || item.act.region}, Bali, Indonesia`);
      ics.push(`DESCRIPTION:Day ${day.dayNum} of your Bali itinerary. ${item.act.insiderTip || ""} Price: ${item.act.priceHigh > 0 ? "$" + Math.round(item.act.priceLow) + "-" + "$" + Math.round(item.act.priceHigh) : "Free"}.`);
      ics.push("END:VEVENT");
    });
  });
  ics.push("END:VCALENDAR");

  const blob = new Blob([ics.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "bali-itinerary.ics";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  if (window.gtag) window.gtag("event", "download_ics", {});
}

/**
 * Open Google Calendar with the first day's events pre-filled.
 * Google Calendar URL import supports a single event; we link to full ICS download instead
 * for multi-day plans, but provide per-day add buttons for individual activities.
 */
function openGoogleCalendarAdd(act, dayNum, startTime) {
  const m = startTime.match(/(\d+):(\d+) (AM|PM)/);
  let hh = parseInt(m[1], 10), mm = parseInt(m[2], 10);
  if (m[3] === "PM" && hh < 12) hh += 12;
  if (m[3] === "AM" && hh === 12) hh = 0;
  const d = new Date();
  d.setDate(d.getDate() + (1 - d.getDay() + 7) % 7 + (dayNum - 1));
  d.setHours(hh, mm, 0);
  const end = new Date(d.getTime() + act.duration * 3600000);
  const fmt = (dt) => basicFormat(dt);
  const url = "https://calendar.google.com/calendar/render?action=TEMPLATE"
    + `&text=${encodeURIComponent(`Day ${dayNum}: ${act.name}`)}`
    + `&dates=${fmt(d)}/${fmt(end)}`
    + `&details=${encodeURIComponent(act.insiderTip || "")}`
    + `&location=${encodeURIComponent((act.location || act.region) + ", Bali, Indonesia")}`;
  window.open(url, "_blank");
  if (window.gtag) window.gtag("event", "add_to_google_calendar", { activity: act.name });
}

window.BaliMapCal = { initBaliMap, downloadICS, openGoogleCalendarAdd };
