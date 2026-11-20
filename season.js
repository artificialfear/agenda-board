/* ===================== WELCOME SCREEN + SLIDE HEADER: SEASONAL DRIFTING EFFECTS (2.29.0 / 2.30.0, Mat 11/18–11/19) =====================
   Welcome screen (2.29.0)
   - A few faint music notes drift up behind the welcome screen (CSS transforms only: light enough for the ViewBoard's Chrome 87).
   - Seasonal themes change the welcome screen's colors and add a second drifting layer. Only the welcome screen's colors change:
     slides, closing scores and every other overlay keep the usual Raven Band colors.
       Fall       Oct 1 – Nov 30     warm palette + falling leaves
       Halloween  Oct 24 – Oct 31    purple/orange + bats and leaves
       Holidays   Dec 1 – Dec 31     snow + red/green/gold twinkles
       Winter     Jan 1 – Feb 29     icy blue + snow
       Concert    dates in "Concert dates"   gold sparkles + a "TODAY: …" banner (beats the season that day)
       (Mar – Sep: no seasonal theme, just the notes)
   Agenda slides (2.30.0, Mat 11/19)
   - The same season's effects drift in the slide's HEADER BAND only (above the gold line: block name, date, countdown), never over
     the cards. Only BEFORE CLASS: from when the block's slide comes up (lead-in / passing time) until its starting bell, then they
     fade out. Regular and Band Ninja slides (each has its own gold-line height). The slide itself is never changed.
     No season (Mar–Sep, or "Seasonal theme" = Off) = nothing on the slides.
   - Board Settings (Content Pool sheet) rows; a blank or missing row = the default:
       "Seasonal theme"     Auto (default: follows the calendar) · Off · Fall · Halloween · Winter · Holidays · Concert
       "Concert dates"      e.g. "12/9 Winter Concert 6:30 PM; 3/12 Spring Concert" (M/D or M/D/YYYY, then the banner text;
                            separate concerts with ";" or new lines)
       "Welcome animation"  On (default) · Off (no motion on the welcome screen; the season's colors stay)
       "Slide animation"    On (default) · Off (nothing on the agenda slides)
   - Turns itself off when the device asks for reduced motion.
   Uses window.__board (index.html): now(), settings(), shown(), state(). The calendar logic also loads in Node for tests/season_test.js. */
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
  function isOff(v) { return /^(off|no|none|false)$/i.test(String(v || "").trim()); }

  // settings → what the welcome screen (and slide header) should look like on date d
  function pick(d, s) {
    s = s || {};
    var want = String(s.season || "").toLowerCase().trim();
    var today = concertOn(parseConcerts(s.concerts), d);
    var theme, label = "";
    if (want === "off" || want === "none" || want === "no") theme = "none";
    else if (THEMES.indexOf(want) > 0) theme = want;
    else theme = today ? "concert" : seasonFor(d);              // "Auto", blank, or anything unknown
    if (theme === "concert") label = today || "Concert Day";
    return { theme: theme, label: label, fx: !isOff(s.welcomeFx), slideFx: !isOff(s.slideFx) };
  }

  // 2.30.0: is the slide on screen for a block whose bell hasn't rung yet? sched = [[name, "HH:MM", "HH:MM"], …]
  function beforeBell(d, shownKey, sched) {
    if (!shownKey || shownKey === "welcome") return false;
    var t = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
    for (var i = 0; i < (sched || []).length; i++) {
      if (sched[i][0] !== shownKey) continue;
      var p = String(sched[i][1]).split(":");
      return t < (+p[0]) * 60 + (+p[1]);
    }
    return false;
  }

  var API = { THEMES: THEMES, seasonFor: seasonFor, parseConcerts: parseConcerts, concertOn: concertOn, pick: pick, beforeBell: beforeBell };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  if (typeof window === "undefined") return;

  // ---- drifting layers ----
  // kind: rise (bottom → top), fall (top → bottom, swaying), flit (left → right, bobbing), twinkle (stays put, fades in/out)
  // Welcome sizes are vh; slide-header sizes are fractions of the header band's height (em).
  var NOTE_GLYPHS = ["♪", "♫", "♩", "♬"], LEAF = ["🍂", "🍁"], SNOW = ["❄︎"];
  var NOTES = { glyphs: NOTE_GLYPHS, kind: "rise", n: 9, size: [3, 5.4], op: [0.16, 0.3], dur: [26, 40], cls: "note" };
  var LAYERS = {
    none: [NOTES],
    fall: [NOTES, { glyphs: LEAF, kind: "fall", n: 9, size: [2.4, 4], op: [0.45, 0.7], dur: [18, 30], cls: "leaf" }],
    halloween: [NOTES, { glyphs: LEAF, kind: "fall", n: 6, size: [2.4, 3.6], op: [0.4, 0.6], dur: [20, 30], cls: "leaf" },
                { glyphs: ["🦇"], kind: "flit", n: 4, size: [2.6, 4], op: [0.45, 0.65], dur: [22, 34], cls: "bat" }],
    winter: [NOTES, { glyphs: SNOW, kind: "fall", n: 16, size: [1.9, 3.8], op: [0.35, 0.75], dur: [16, 30], cls: "snow" }],
    holidays: [NOTES, { glyphs: SNOW, kind: "fall", n: 12, size: [1.9, 3.6], op: [0.35, 0.7], dur: [16, 30], cls: "snow" },
               { glyphs: ["✦"], kind: "twinkle", n: 10, size: [2, 3.2], op: [0.6, 0.95], dur: [4, 8], cls: "twinkle" }],
    concert: [{ glyphs: NOTE_GLYPHS, kind: "rise", n: 14, size: [3, 5.4], op: [0.18, 0.32], dur: [20, 32], cls: "note" },
              { glyphs: ["✦", "✧"], kind: "rise", n: 10, size: [1.4, 2.6], op: [0.35, 0.7], dur: [14, 24], cls: "sparkle" }]
  };
  // 2.30.0: the slide header band is short (≈14% of the slide): fewer, smaller particles. No season = nothing (no plain notes).
  var BAND_NOTES = { glyphs: NOTE_GLYPHS, kind: "rise", n: 4, size: [0.26, 0.38], op: [0.28, 0.45], dur: [9, 14], cls: "note" };
  var BAND = {
    fall: [BAND_NOTES, { glyphs: LEAF, kind: "fall", n: 6, size: [0.24, 0.34], op: [0.55, 0.8], dur: [8, 13], cls: "leaf" }],
    halloween: [{ glyphs: LEAF, kind: "fall", n: 4, size: [0.24, 0.32], op: [0.5, 0.75], dur: [8, 13], cls: "leaf" },
                { glyphs: ["🦇"], kind: "flit", n: 3, size: [0.26, 0.36], op: [0.55, 0.8], dur: [16, 26], cls: "bat" }],
    winter: [{ glyphs: SNOW, kind: "fall", n: 10, size: [0.14, 0.26], op: [0.45, 0.85], dur: [7, 12], cls: "snow" }],
    holidays: [{ glyphs: SNOW, kind: "fall", n: 8, size: [0.14, 0.26], op: [0.45, 0.85], dur: [7, 12], cls: "snow" },
               { glyphs: ["✦"], kind: "twinkle", n: 6, size: [0.16, 0.24], op: [0.7, 1], dur: [3, 6], cls: "twinkle" }],
    concert: [BAND_NOTES, { glyphs: ["✦", "✧"], kind: "rise", n: 6, size: [0.16, 0.26], op: [0.5, 0.85], dur: [7, 11], cls: "sparkle" }]
  };
  // header band = top of the slide down to its gold line (slide EMU), per deck
  var BAND_GEO = {
    reg: { h: 5143500, y2: 731520 },           // rv*_rule top (Daily Rehearsal deck)
    ninja: { h: 6858000, y2: 932688 }          // nj*_rule top (Band Ninja Day deck)
  };
  var TWINKLE_COLORS = ["#e2504a", "#3fae6a", "#e0b23a"];

  var B = window.__board;
  var welcome = document.getElementById("welcome"), fxEl = document.getElementById("wxFx"), banner = document.getElementById("wxBanner");
  var bandEl = document.getElementById("slideFx");
  if (!B || !welcome || !fxEl) return;

  function rnd(r) { return r[0] + Math.random() * (r[1] - r[0]); }
  function particle(L, i, unit) {
    var dur = rnd(L.dur), outer = document.createElement("span"), inner = document.createElement("span");
    var band = unit === "em";
    outer.className = "wx " + L.cls + " wx-" + L.kind;
    inner.className = "wx-in";
    inner.textContent = L.glyphs[i % L.glyphs.length];
    outer.style.fontSize = rnd(L.size).toFixed(3) + unit;
    outer.style.opacity = rnd(L.op).toFixed(2);
    if (L.kind === "flit") outer.style.top = rnd(band ? [8, 50] : [6, 62]).toFixed(1) + "%";
    else if (L.kind === "twinkle") { outer.style.top = rnd([4, band ? 62 : 92]).toFixed(1) + "%"; outer.style.left = rnd([2, 96]).toFixed(1) + "%"; }
    else outer.style.left = ((i + Math.random()) / L.n * 98).toFixed(1) + "%";   // spread across the width
    if (L.cls === "twinkle") inner.style.color = TWINKLE_COLORS[i % TWINKLE_COLORS.length];
    // a negative delay starts each one partway through, so the area is already full when it appears
    outer.style.animationDuration = dur.toFixed(1) + "s";
    outer.style.animationDelay = (-Math.random() * dur).toFixed(1) + "s";
    inner.style.animationDuration = (L.kind === "twinkle" ? dur : rnd([4, 7])).toFixed(1) + "s";
    inner.style.animationDelay = (-Math.random() * 6).toFixed(1) + "s";
    outer.appendChild(inner);
    return outer;
  }
  function fill(el, layers, unit) {
    el.innerHTML = "";
    var frag = document.createDocumentFragment(), count = 0;
    (layers || []).forEach(function (L) { for (var i = 0; i < L.n; i++) { frag.appendChild(particle(L, i, unit)); count++; } });
    el.appendChild(frag);
    return count;
  }
  function reducedMotion() {
    try { return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; }
  }

  // ---- welcome screen ----
  var cur = "", state = { theme: "none", label: "", fx: false, count: 0 };
  function sync() {
    var p = pick(B.now(), B.settings());
    var moving = p.fx && !reducedMotion();
    var key = p.theme + "|" + p.label + "|" + moving;
    if (key !== cur) {
      cur = key;
      THEMES.forEach(function (t) { welcome.classList.remove("s-" + t); });
      if (p.theme !== "none") welcome.classList.add("s-" + p.theme);
      if (banner) {
        banner.textContent = p.theme === "concert" ? "🎺 TODAY: " + p.label + " 🎺" : "";
        banner.style.display = p.theme === "concert" ? "" : "none";
      }
      var count = fill(fxEl, moving ? (LAYERS[p.theme] || LAYERS.none) : [], "vh");
      state = { theme: p.theme, label: p.label, fx: moving, count: count };
    }
    bandSync(p);
  }

  // ---- 2.30.0: slide header band, before the bell ----
  var bandKey = "", bandState = { on: false, theme: "none", ninja: false }, bandOffT = null;
  function bandPlace(ninja) {
    var g = ninja ? BAND_GEO.ninja : BAND_GEO.reg;
    var W = window.innerWidth, H = window.innerHeight, sh = Math.min(H, W * 9 / 16), sw = sh * 16 / 9, sx = (W - sw) / 2, sy = (H - sh) / 2;
    var bh = Math.round(g.y2 / g.h * sh);
    bandEl.style.left = Math.round(sx) + "px"; bandEl.style.top = Math.round(sy) + "px";
    bandEl.style.width = Math.round(sw) + "px"; bandEl.style.height = bh + "px";
    bandEl.style.fontSize = bh + "px";                     // particle sizes are fractions of the band height (em)
  }
  function bandSync(p) {
    if (!bandEl) return;
    p = p || pick(B.now(), B.settings());
    var sh = B.shown(), d = B.now(), st = B.state();
    var sched = (B.settings().schedules || {})[st.type] || [];
    var on = p.slideFx && !reducedMotion() && !!BAND[p.theme] && document.body.classList.contains("on-agenda") &&
             beforeBell(d, sh.key, sched);
    var key = on ? p.theme + "|" + sh.key + "|" + sh.ninja : "";
    if (on) bandPlace(sh.ninja);
    if (key === bandKey) return;
    bandKey = key;
    clearTimeout(bandOffT);
    if (on) {
      fill(bandEl, BAND[p.theme], "em");
      bandEl.classList.add("on");
      bandState = { on: true, theme: p.theme, ninja: !!sh.ninja };
    } else {
      bandEl.classList.remove("on");                       // fades out (CSS), then the particles go so nothing keeps running
      bandOffT = setTimeout(function () { if (!bandKey) bandEl.innerHTML = ""; }, 2500);
      bandState = { on: false, theme: p.theme, ninja: false };
    }
  }

  window.seasonSync = function () { cur = ""; bandKey = "x"; sync(); };   // Board Settings changed: rebuild
  window.seasonBandSync = function () { bandSync(); };
  window.__season = {
    state: function () { return state; },
    slide: function () {
      var r = bandEl ? bandEl.getBoundingClientRect() : null;
      return { on: bandState.on, theme: bandState.theme, ninja: bandState.ninja,
               count: bandEl ? bandEl.querySelectorAll(".wx").length : 0, visible: !!bandEl && bandEl.classList.contains("on"),
               band: r ? { top: r.top, left: r.left, width: r.width, height: r.height } : null };
    },
    pick: pick, parseConcerts: parseConcerts
  };
  sync();
  setInterval(sync, 5000);                                    // the bell (and overnight, the season) changes what shows
  window.addEventListener("resize", function () { bandKey = "x"; bandSync(); });
})();
