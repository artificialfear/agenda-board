/* ===================== WELCOME SCREEN: DRIFTING NOTES + SEASONAL THEMES (2.29.0, Mat 11/18) =====================
   - A few faint music notes drift up behind the welcome screen (CSS transforms only: light enough for the ViewBoard's Chrome 87).
   - Seasonal themes change the welcome screen's colors and add a second drifting layer. Only the welcome screen changes:
     slides, closing scores and every other overlay keep the usual Raven Band colors.
       Fall       Oct 1 – Nov 30     warm palette + falling leaves
       Halloween  Oct 24 – Oct 31    purple/orange + bats and leaves
       Holidays   Dec 1 – Dec 31     snow + red/green/gold twinkles
       Winter     Jan 1 – Feb 29     icy blue + snow
       Concert    dates in "Concert dates"   gold sparkles + a "TODAY: …" banner (beats the season that day)
       (Mar – Sep: no seasonal theme, just the notes)
   - Board Settings (Content Pool sheet) rows; a blank or missing row = the default:
       "Seasonal theme"     Auto (default: follows the calendar) · Off · Fall · Halloween · Winter · Holidays · Concert
       "Concert dates"      e.g. "12/9 Winter Concert 6:30 PM; 3/12 Spring Concert" (M/D or M/D/YYYY, then the banner text;
                            separate concerts with ";" or new lines)
       "Welcome animation"  On (default) · Off (no motion at all; the season's colors stay)
   - Turns itself off when the device asks for reduced motion.
   Uses window.__board (index.html): now(), settings(). The calendar logic also loads in Node for tests/season_test.js. */
(function () {
  "use strict";

  var THEMES = ["none", "fall", "halloween", "winter", "holidays", "concert"];

  // ---- calendar ----
  function seasonFor(d) {
    var m = d.getMonth(), day = d.getDate();
    if (m === 9 && day >= 24) return "halloween";
    if (m === 9 || m === 10) return "fall";
    if (m === 11) return "holidays";
    if (m === 0 || m === 1) return "winter";
    return "none";
  }

  // "12/9 Winter Concert 6:30 PM; 3/12/2027 Spring Concert" → [{ m: 12, d: 9, y: null, label: "Winter Concert 6:30 PM" }, …]
  function parseConcerts(text) {
    var out = [];
    String(text || "").split(/[;\n]+/).forEach(function (part) {
      var mm = part.match(/^\s*(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b\s*[-–:,]?\s*(.*?)\s*$/);
      if (!mm) return;
      var mo = +mm[1], dd = +mm[2];
      if (mo < 1 || mo > 12 || dd < 1 || dd > 31) return;
      var y = mm[3] ? +mm[3] : null;
      if (y !== null && y < 100) y += 2000;
      out.push({ m: mo, d: dd, y: y, label: mm[4] || "" });
    });
    return out;
  }
  function concertOn(list, d) {
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (c.m === d.getMonth() + 1 && c.d === d.getDate() && (c.y === null || c.y === d.getFullYear())) return c.label || "Concert";
    }
    return null;
  }

  // settings → what the welcome screen should look like on date d
  function pick(d, s) {
    s = s || {};
    var want = String(s.season || "").toLowerCase().trim();
    var today = concertOn(parseConcerts(s.concerts), d);
    var theme, label = "";
    if (want === "off" || want === "none" || want === "no") theme = "none";
    else if (THEMES.indexOf(want) > 0) theme = want;
    else theme = today ? "concert" : seasonFor(d);              // "Auto", blank, or anything unknown
    if (theme === "concert") label = today || "Concert Day";
    var fx = !/^(off|no|none|false)$/i.test(String(s.welcomeFx || "").trim());
    return { theme: theme, label: label, fx: fx };
  }

  var API = { THEMES: THEMES, seasonFor: seasonFor, parseConcerts: parseConcerts, concertOn: concertOn, pick: pick };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  if (typeof window === "undefined") return;

  // ---- drifting layers ----
  // kind: rise (bottom → top), fall (top → bottom, swaying), flit (left → right, bobbing), twinkle (stays put, fades in/out)
  var NOTES = { glyphs: ["♪", "♫", "♩", "♬"], kind: "rise", n: 9, size: [3, 5.4], op: [0.16, 0.3], dur: [26, 40], cls: "note" };
  var LAYERS = {
    none: [NOTES],
    fall: [NOTES, { glyphs: ["🍂", "🍁"], kind: "fall", n: 9, size: [2.4, 4], op: [0.45, 0.7], dur: [18, 30], cls: "leaf" }],
    halloween: [NOTES, { glyphs: ["🍂", "🍁"], kind: "fall", n: 6, size: [2.4, 3.6], op: [0.4, 0.6], dur: [20, 30], cls: "leaf" },
                { glyphs: ["🦇"], kind: "flit", n: 4, size: [2.6, 4], op: [0.45, 0.65], dur: [22, 34], cls: "bat" }],
    winter: [NOTES, { glyphs: ["❄︎"], kind: "fall", n: 16, size: [1.9, 3.8], op: [0.35, 0.75], dur: [16, 30], cls: "snow" }],
    holidays: [NOTES, { glyphs: ["❄︎"], kind: "fall", n: 12, size: [1.9, 3.6], op: [0.35, 0.7], dur: [16, 30], cls: "snow" },
               { glyphs: ["✦"], kind: "twinkle", n: 10, size: [2, 3.2], op: [0.6, 0.95], dur: [4, 8], cls: "twinkle" }],
    concert: [{ glyphs: NOTES.glyphs, kind: "rise", n: 14, size: [3, 5.4], op: [0.18, 0.32], dur: [20, 32], cls: "note" },
              { glyphs: ["✦", "✧"], kind: "rise", n: 10, size: [1.4, 2.6], op: [0.35, 0.7], dur: [14, 24], cls: "sparkle" }]
  };
  var TWINKLE_COLORS = ["#e2504a", "#3fae6a", "#e0b23a"];

  var B = window.__board;
  var welcome = document.getElementById("welcome"), fxEl = document.getElementById("wxFx"), banner = document.getElementById("wxBanner");
  if (!B || !welcome || !fxEl) return;

  function rnd(r) { return r[0] + Math.random() * (r[1] - r[0]); }
  function particle(L, i) {
    var dur = rnd(L.dur), outer = document.createElement("span"), inner = document.createElement("span");
    outer.className = "wx " + L.cls + " wx-" + L.kind;
    inner.className = "wx-in";
    inner.textContent = L.glyphs[i % L.glyphs.length];
    outer.style.fontSize = rnd(L.size).toFixed(2) + "vh";
    outer.style.opacity = rnd(L.op).toFixed(2);
    if (L.kind === "flit") outer.style.top = rnd([6, 62]).toFixed(1) + "%";
    else if (L.kind === "twinkle") { outer.style.top = rnd([4, 92]).toFixed(1) + "%"; outer.style.left = rnd([2, 96]).toFixed(1) + "%"; }
    else outer.style.left = ((i + Math.random()) / L.n * 98).toFixed(1) + "%";   // spread across the width
    if (L.cls === "twinkle") inner.style.color = TWINKLE_COLORS[i % TWINKLE_COLORS.length];
    // a negative delay starts each one partway through, so the screen is already full when it appears
    outer.style.animationDuration = dur.toFixed(1) + "s";
    outer.style.animationDelay = (-Math.random() * dur).toFixed(1) + "s";
    inner.style.animationDuration = (L.kind === "twinkle" ? dur : rnd([4, 7])).toFixed(1) + "s";
    inner.style.animationDelay = (-Math.random() * 6).toFixed(1) + "s";
    outer.appendChild(inner);
    return outer;
  }

  var cur = "", state = { theme: "none", label: "", fx: false, count: 0 };
  function reducedMotion() {
    try { return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; }
  }
  function sync() {
    var p = pick(B.now(), B.settings());
    var moving = p.fx && !reducedMotion();
    var key = p.theme + "|" + p.label + "|" + moving;
    if (key === cur) return;
    cur = key;
    THEMES.forEach(function (t) { welcome.classList.remove("s-" + t); });
    if (p.theme !== "none") welcome.classList.add("s-" + p.theme);
    if (banner) {
      banner.textContent = p.theme === "concert" ? "🎺 TODAY: " + p.label + " 🎺" : "";
      banner.style.display = p.theme === "concert" ? "" : "none";
    }
    fxEl.innerHTML = "";
    var frag = document.createDocumentFragment(), count = 0;
    if (moving) (LAYERS[p.theme] || LAYERS.none).forEach(function (L) {
      for (var i = 0; i < L.n; i++) { frag.appendChild(particle(L, i)); count++; }
    });
    fxEl.appendChild(frag);
    state = { theme: p.theme, label: p.label, fx: moving, count: count };
  }
  window.seasonSync = function () { cur = ""; sync(); };       // Board Settings changed: rebuild
  window.__season = { state: function () { return state; }, pick: pick, parseConcerts: parseConcerts };
  sync();
  setInterval(sync, 60000);                                    // the date (and so the season) can change overnight
})();
