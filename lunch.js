/* ===================== LUNCH & LEARN (2.6.0, Mat 11/12) =====================
   Some days Mat hosts Lunch & Learn in the band room during 8th grade lunch (11:15–11:40) and 7th grade lunch (12:15–12:35):
   approved students eat, then practice. This is a full-screen Raven Band page for those times.
   - Turned on per grade, for TODAY only, by the ☰ menu switches (🥪 Lunch & Learn · 8th / 7th). Tomorrow they're off again.
   - From the start time: a big countdown to pack-up + the three Lunch & Learn rules.
   - 5 minutes before the end (PACK_MIN): chime, the screen flashes, and the four pack-up steps show with a countdown to Brain Break.
   - At the end: chime + "Time for Brain Break!" for 2 minutes, then the board goes back to normal.
   - Never covers a class: if a block is still in session (IF days: 4th ends 11:17) it waits until the block is over.
   - Times can be changed from the Board Settings tab of the Content Pool sheet ("Lunch & Learn 8th" = 11:15-11:40, …).
   - ✕ Hide tucks it away (a 🥪 button on the left bar brings it back); it opens again by itself at pack-up time.
   Uses window.__board (index.html): now(), ymd(d), settings(), state(), chime(kind). */
(function () {
  "use strict";
  var B = window.__board;
  if (!B) return;

  var DAY_KEY = "agendaBoard.lunchOn";        // { date, "8th": true|false, "7th": true|false }
  var PACK_MIN = 5;                            // pack-up starts this many minutes before the end
  var GONE_MS = 2 * 60000;                     // "Time for Brain Break!" stays this long after the end
  var GRADES = [
    { g: "8th", key: "ll8", def: "11:15-11:40" },
    { g: "7th", key: "ll7", def: "12:15-12:35" }
  ];
  var RULES = [
    "Eat your lunch first and then practice your instrument. Please <b>rinse out your mouth</b> before playing a wind instrument!",
    "You must be <b>actively practicing</b> or getting help from Mr. Graham during this time.",
    "All food must be cleaned up and thrown away in the <b>large trashcan outside of the gym</b>."
  ];
  var STEPS = [
    "Stop playing and pack up your instrument <b>immediately</b>.",
    "If you moved a music stand, please put it back in its original position.",
    "Straighten your chairs in rows.",
    "Get ready to go to Brain Break."
  ];

  function $(id) { return document.getElementById(id); }
  function load(k) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function save(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function today() { return B.ymd(B.now()); }

  // "11:15-11:40" / "11:15 AM – 11:40 AM" / "12:15-12:35" → [startMin, endMin] (hours 1–6 without AM/PM = afternoon)
  function parseRange(s) {
    var m = String(s || "").match(/(\d{1,2}):(\d{2})\s*([ap]\.?m\.?)?\s*[-–—to]+\s*(\d{1,2}):(\d{2})\s*([ap]\.?m\.?)?/i);
    if (!m) return null;
    function toMin(h, mm, ap) {
      h = +h; mm = +mm;
      if (ap) { var pm = /p/i.test(ap); if (h === 12) h = pm ? 12 : 0; else if (pm) h += 12; }
      else if (h >= 1 && h <= 6) h += 12;
      return h * 60 + mm;
    }
    var a = toMin(m[1], m[2], m[3] || m[6]), b = toMin(m[4], m[5], m[6] || m[3]);
    return b - a >= PACK_MIN + 1 && b - a <= 180 ? [a, b] : null;
  }
  function times(gr) {
    var s = B.settings(), r = parseRange(s[gr.key]) || parseRange(gr.def);
    return { start: r[0], end: r[1], pack: r[1] - PACK_MIN };
  }
  function clock(m) {
    var h = Math.floor(m / 60), mm = m % 60;
    return (h % 12 || 12) + ":" + String(mm).padStart(2, "0");
  }
  function mmss(ms) {
    var s = Math.max(0, Math.ceil(ms / 1000));
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  }

  function dayOn() { var o = load(DAY_KEY); return o && o.date === today() ? o : { date: today() }; }
  function isOn(g) { return !!dayOn()[g]; }

  // What should be on screen right now: { gr, phase: 'learn' | 'pack' | 'gone', t, msLeft } or null.
  function current() {
    var d = B.now(), st = B.state();
    if (!st || st.type === "weekend") return null;
    var nowMs = d.getTime(), mid = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    for (var i = 0; i < GRADES.length; i++) {
      var gr = GRADES[i];
      if (!isOn(gr.g)) continue;
      var t = times(gr), startMs = mid + t.start * 60000, packMs = mid + t.pack * 60000, endMs = mid + t.end * 60000;
      if (nowMs < startMs || nowMs >= endMs + GONE_MS) continue;
      if (st.inClass) return null;                     // a class is still on: wait for it to end
      if (nowMs < packMs) return { gr: gr, t: t, phase: "learn", msLeft: packMs - nowMs, total: packMs - startMs };
      if (nowMs < endMs) return { gr: gr, t: t, phase: "pack", msLeft: endMs - nowMs, total: endMs - packMs };
      return { gr: gr, t: t, phase: "gone", msLeft: 0, total: 1 };
    }
    return null;
  }

  // ---------------------------------------------------------------- page
  var css = [
    "#ll { position: fixed; inset: 0; z-index: 25; display: none; flex-direction: column; background: #1f2a44; color: #fff;",
    "  font-family: 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; user-select: none; -webkit-user-select: none; padding: 3vh 3vw; box-sizing: border-box; }",
    "#ll.open { display: flex; }",
    "#ll .ll-head { display: flex; align-items: center; gap: 1.4vw; flex: none; }",
    "#ll .ll-head img { height: 9vh; width: auto; filter: drop-shadow(0 3px 8px rgba(0,0,0,.35)); }",
    "#ll .ll-head h1 { margin: 0; font: 600 7vh/1 'Oswald', 'Arial Narrow', Arial, sans-serif; letter-spacing: .02em; white-space: nowrap; }",
    "#ll .ll-head h1 span { color: #c9a227; }",
    "#ll .ll-grade { background: #c9a227; color: #141c30; border-radius: 1.4vh; padding: .7vh 1.3vw; font: 600 3.6vh 'Oswald', 'Arial Narrow', Arial, sans-serif; white-space: nowrap; }",
    "#ll .ll-hide { margin-left: auto; cursor: pointer; font: 600 2.4vh 'Oswald', 'Arial Narrow', Arial, sans-serif; letter-spacing: .04em; border-radius: 999px;",
    "  border: .3vh solid #c9a227; background: #1f2a44; color: #c9a227; padding: 1vh 1.4vw; }",
    "#ll .ll-rule { height: .6vh; background: #c9a227; border-radius: 3px; margin: 2vh 0 2.6vh; flex: none; }",
    "#ll .ll-body { flex: 1; min-height: 0; display: grid; grid-template-columns: 42fr 58fr; gap: 2.4vw; }",
    "#ll .ll-timer { background: #2a3858; border: .5vh solid #c9a227; border-radius: 3vh; box-shadow: 0 0 4vh rgba(201,162,39,.22);",
    "  display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 3vh 2vw; min-height: 0; }",
    "#ll .ll-label { font: 600 4.4vh 'Oswald', 'Arial Narrow', Arial, sans-serif; letter-spacing: .1em; text-transform: uppercase; color: #c9a227; }",
    "#ll .ll-big { font: 600 27vh/1 'Oswald', 'Arial Narrow', Arial, sans-serif; font-variant-numeric: tabular-nums; margin: 1vh 0 2vh; }",
    "#ll .ll-bar { width: 88%; height: 2.4vh; background: #1f2a44; border-radius: 999px; overflow: hidden; }",
    "#ll .ll-bar i { display: block; height: 100%; width: 0; background: #c9a227; border-radius: 999px; transition: width 1s linear; }",
    "#ll .ll-when { margin-top: 2.4vh; font: 600 3.4vh/1.35 'Oswald', 'Arial Narrow', Arial, sans-serif; color: #dfe4ee; }",
    "#ll .ll-when b { color: #c9a227; font-weight: 600; }",
    "#ll .ll-list { display: flex; flex-direction: column; gap: 2vh; min-height: 0; }",
    "#ll .ll-h { font: 600 4.6vh 'Oswald', 'Arial Narrow', Arial, sans-serif; letter-spacing: .06em; text-transform: uppercase; color: #c9a227; }",
    "#ll ol { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 1.8vh; flex: 1; min-height: 0; }",
    "#ll li { flex: 1; display: flex; align-items: center; gap: 1.6vw; background: #2a3858; border-radius: 2.2vh; padding: 1.6vh 1.6vw;",
    "  font-size: 4.1vh; line-height: 1.25; font-weight: 600; }",
    "#ll li > span:first-child { flex: none; width: 8vh; height: 8vh; border-radius: 50%; background: #c9a227; color: #141c30; display: flex;",
    "  align-items: center; justify-content: center; font: 600 5vh 'Oswald', 'Arial Narrow', Arial, sans-serif; }",
    "#ll li b { color: #e3c766; font-weight: 700; }",
    /* pack-up: the timer turns gold, flashes for the first seconds */
    "#ll.pack .ll-timer { background: #c9a227; color: #141c30; border-color: #fff; }",
    "#ll.pack .ll-timer .ll-label, #ll.pack .ll-when, #ll.pack .ll-when b { color: #141c30; }",
    "#ll.pack .ll-bar { background: rgba(20,28,48,.25); } #ll.pack .ll-bar i { background: #141c30; }",
    "#ll.pack li { font-size: 4.6vh; }",
    "#ll.flash { animation: llFlash 1s linear infinite; }",
    "@keyframes llFlash { 0%, 49.9% { background: #c9a227; } 50%, 100% { background: #1f2a44; } }",
    /* the end: one big message */
    "#ll .ll-gone { display: none; flex: 1; flex-direction: column; align-items: center; justify-content: center; text-align: center; }",
    "#ll.gone .ll-body { display: none; } #ll.gone .ll-gone { display: flex; }",
    "#ll .ll-gone b { font: 600 14vh/1.05 'Oswald', 'Arial Narrow', Arial, sans-serif; color: #c9a227; }",
    "#ll .ll-gone small { margin-top: 3vh; font: 600 4.4vh 'Oswald', 'Arial Narrow', Arial, sans-serif; color: #dfe4ee; }",
    "#btnLunch { display: none; background: #c9a227; color: #141c30; border: 2px solid #c9a227; border-radius: 999px; padding: 10px 18px; cursor: pointer;",
    "  font: 600 20px 'Oswald', 'Arial Narrow', Arial, sans-serif; letter-spacing: .04em; box-shadow: 0 4px 14px rgba(0,0,0,.35); }",
    "#btnLunch.show { display: inline-block; }"
  ].join("\n");
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  function items(list) {
    return list.map(function (t, i) { return "<li><span>" + (i + 1) + "</span><span>" + t + "</span></li>"; }).join("");
  }
  var el = document.createElement("div");
  el.id = "ll"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Lunch and Learn");
  el.innerHTML =
    '<div class="ll-head"><img src="assets/raven-logo.png?v=1.1.0" alt=""><h1>Lunch <span>&amp;</span> Learn</h1>' +
    '  <div class="ll-grade" id="llGrade"></div><button class="ll-hide" id="llHide">✕ Hide</button></div>' +
    '<div class="ll-rule"></div>' +
    '<div class="ll-body">' +
    '  <div class="ll-timer"><div class="ll-label" id="llLabel"></div><div class="ll-big" id="llBig"></div>' +
    '    <div class="ll-bar"><i id="llBar"></i></div><div class="ll-when" id="llWhen"></div></div>' +
    '  <div class="ll-list"><div class="ll-h" id="llListH"></div><ol id="llRules">' + items(RULES) + '</ol>' +
    '    <ol id="llSteps" style="display:none">' + items(STEPS) + '</ol></div>' +
    '</div>' +
    '<div class="ll-gone"><b>Time for Brain Break!</b><small>Thanks for practicing. See you next time! 🎶</small></div>';
  document.body.appendChild(el);

  var btn = document.createElement("button");
  btn.id = "btnLunch"; btn.textContent = "🥪 Lunch & Learn"; btn.setAttribute("aria-label", "Show Lunch and Learn");
  var bar = $("leftBar"); if (bar) bar.insertBefore(btn, $("overrideBadge") || null);

  // ---------------------------------------------------------------- show / tick
  var shownKey = "";        // "<date> <grade> <phase>": chimes once per change
  var hidden = "";          // "<date> <grade> <phase>" hidden with ✕ (comes back at the next phase)
  var flashUntil = 0;

  function tick() {
    var c = current();
    if (!c) {
      el.classList.remove("open", "pack", "gone", "flash"); btn.classList.remove("show"); document.body.classList.remove("ll-open");
      shownKey = ""; return;
    }
    var key = today() + " " + c.gr.g + " " + c.phase;
    if (key !== shownKey) {
      // A phase that starts while the board is running gets a chime; opening the board halfway through doesn't.
      var fresh = shownKey !== "" || (c.phase !== "learn" && c.total - c.msLeft < 20000);
      if (shownKey !== "" && c.phase === "pack") flashUntil = Date.now() + 10000;
      if (fresh && c.phase !== "learn" && B.chime) B.chime(c.phase === "pack" ? "pack" : "end");
      shownKey = key;
    }
    var hide = hidden === key;
    el.classList.toggle("open", !hide);
    document.body.classList.toggle("ll-open", !hide);
    btn.classList.toggle("show", hide);
    el.classList.toggle("pack", c.phase === "pack");
    el.classList.toggle("gone", c.phase === "gone");
    el.classList.toggle("flash", c.phase === "pack" && Date.now() < flashUntil);
    $("llGrade").textContent = c.gr.g + " Grade";
    if (c.phase === "gone") return;
    var learn = c.phase === "learn";
    $("llLabel").textContent = learn ? "Pack up in" : "🔔 Brain Break in";
    $("llBig").textContent = mmss(c.msLeft);
    $("llBar").style.width = Math.max(0, Math.min(100, (1 - c.msLeft / c.total) * 100)).toFixed(1) + "%";
    $("llWhen").innerHTML = learn
      ? "Pack up at <b>" + clock(c.t.pack) + "</b> · Brain Break at <b>" + clock(c.t.end) + "</b>"
      : "Everything packed and put away by <b>" + clock(c.t.end) + "</b>";
    $("llListH").textContent = learn ? "Lunch & Learn rules" : "Pack up time!";
    $("llRules").style.display = learn ? "" : "none";
    $("llSteps").style.display = learn ? "none" : "";
  }
  $("llHide").onclick = function () { hidden = shownKey; tick(); };
  btn.onclick = function () { hidden = ""; tick(); };
  el.addEventListener("click", function () { if (el.classList.contains("flash")) { flashUntil = 0; tick(); } });
  setInterval(tick, 1000);
  window.lunchSync = tick;

  // ---------------------------------------------------------------- menu switches (☰): 🥪 Lunch & Learn · 8th / 7th, today only
  function menuSetup() {
    var box = document.querySelector("#menu .toggles");
    if (!box || $("llToggle8th")) return;
    GRADES.forEach(function (gr) {
      var t = document.createElement("button");
      t.className = "tgl"; t.id = "llToggle" + gr.g; t.setAttribute("role", "switch"); t.setAttribute("aria-checked", "false");
      t.innerHTML = '<span class="tgl-text"><span class="tgl-name">🥪 Lunch &amp; Learn · ' + gr.g + ' grade</span>' +
        '<span class="tgl-sub" id="llSub' + gr.g + '"></span></span><span class="tgl-sw" aria-hidden="true"></span>';
      box.appendChild(t);
      t.onclick = function () {
        var o = dayOn(); o.date = today(); o[gr.g] = !o[gr.g];
        save(DAY_KEY, o); hidden = ""; paintMenu(); tick();
      };
    });
  }
  function paintMenu() {
    menuSetup();
    GRADES.forEach(function (gr) {
      var t = $("llToggle" + gr.g); if (!t) return;
      var on = isOn(gr.g), tm = times(gr);
      t.setAttribute("aria-checked", on ? "true" : "false");
      $("llSub" + gr.g).textContent = (on ? "On today: " : "Off: ") + clock(tm.start) + "–" + clock(tm.end) +
        " (pack up at " + clock(tm.pack) + ")";
    });
  }
  var menuBtn = $("btnMenu");
  if (menuBtn) menuBtn.addEventListener("click", function () { setTimeout(paintMenu, 0); });
  menuSetup();
  tick();

  window.__lunch = { current: current, parseRange: parseRange, times: times };
})();
