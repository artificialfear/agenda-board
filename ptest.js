/* ===================== PLAYING TEST DAY (2.5.0, Mat 11/12) =====================
   A full-screen Raven Band page for a class's playing test: what they're playing, Now playing + On deck, and a name wheel
   ("First L.") that picks who goes next. Students play one at a time in random order.
   - On for a block when its agenda slide has a line "Playing Test: …" (ClosingScores v1.8 a=ptest), or by the board menu's
     🎯 Playing Test switch (today only; it can also turn a slide's test off). The menu box holds the test name when the
     slide has none.
   - Spin → the name goes to Now playing (or On deck when someone is already playing). ✓ Done = played, off the wheel,
     On deck moves up. ↺ Later = back on the wheel. Class list = mark absent. Progress is kept per block per day.
   - Remote (📱): Mat's phone/iPad opens remote.html?c=CODE (QR on the board) and enters the Playing Test PIN (Board Settings
     sheet). It spins, moves students along and enters 1–4 scores + notes. Scores show only on the remote; the board saves
     them to the "Playing Tests" tab (a=ptscore) and never draws them.
   Uses window.__board (set in index.html): call(params), settings(), now(), ymd(d), shown(), test. */
(function () {
  "use strict";
  var B = window.__board;
  if (!B) return;

  var DAY_KEY = "agendaBoard.ptOn";          // { date, on: true | false | null, text }
  var CODE_KEY = "agendaBoard.ptCode";       // { date, code }
  var ROSTER_KEY = "agendaBoard.ptRoster";   // { block: { students, test, date } } (fast start / offline)
  var QUEUE_KEY = "agendaBoard.ptQueue";     // scores still to save: [{ date, block, id, s, note, test }]
  var RUBRIC = { 4: "Exceeds", 3: "Meets", 2: "Approaching", 1: "Beginning" };
  var COLORS = [["#c9a227", "#141c30"], ["#2a3858", "#ffffff"], ["#4a6aa5", "#ffffff"], ["#e3c766", "#141c30"], ["#33466e", "#ffffff"], ["#6d8cc7", "#141c30"]];

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function load(k) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function save(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function today() { return B.ymd(B.now()); }
  function spinMs() { return window.__ptSpinMs || 4600; }

  // ---------------------------------------------------------------- page
  var css = [
    "#pt { position: fixed; inset: 0; z-index: 25; display: none; flex-direction: column; background: #1f2a44; color: #fff;",
    "  font-family: 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; user-select: none; -webkit-user-select: none; }",
    "#pt.open { display: flex; }",
    "#pt .pt-body { flex: 1; min-height: 0; display: grid; grid-template-columns: 40fr 60fr; gap: 1.6vw; padding: 2vh 2vw 2vh 2.4vw; }",
    "#pt .pt-head { display: flex; align-items: center; gap: 1vw; }",
    "#pt .pt-head img { height: 7vh; width: auto; filter: drop-shadow(0 3px 8px rgba(0,0,0,.35)); }",
    "#pt .pt-head h1 { margin: 0; font: 600 5.6vh/1 'Oswald', 'Arial Narrow', Arial, sans-serif; letter-spacing: .02em; white-space: nowrap; }",
    "#pt .pt-head h1 span { color: #c9a227; }",
    "#pt .pt-sub { display: flex; align-items: center; gap: 1vw; margin-top: -.6vh; }",
    "#pt .pt-date { font: 600 3vh 'Oswald', 'Arial Narrow', Arial, sans-serif; color: #c9a227; white-space: nowrap; }",
    "#pt .pt-count { margin-left: auto; background: #c9a227; color: #141c30; border-radius: 1.2vh; padding: .6vh 1.1vw; font: 600 2.7vh 'Oswald', 'Arial Narrow', Arial, sans-serif; white-space: nowrap; }",
    "#pt .pt-rule { height: .6vh; background: #c9a227; border-radius: 3px; flex: none; }",
    "#pt .pt-left { display: flex; flex-direction: column; gap: 1.8vh; min-height: 0; }",
    "#pt .pt-card { background: #2a3858; border-radius: 2vh; padding: 1.8vh 1.6vw; }",
    "#pt .pt-h { font: 600 2.6vh 'Oswald', 'Arial Narrow', Arial, sans-serif; letter-spacing: .08em; color: #c9a227; text-transform: uppercase; margin-bottom: .6vh; }",
    "#pt .pt-test { font-size: 3.6vh; line-height: 1.25; font-weight: 600; }",
    "#pt .pt-now { border: .4vh solid #c9a227; box-shadow: 0 0 3vh rgba(201,162,39,.25); }",
    "#pt .pt-now .pt-name { font: 600 9vh/1.05 'Oswald', 'Arial Narrow', Arial, sans-serif; color: #fff; }",
    "#pt .pt-deck .pt-name { font: 600 6vh/1.05 'Oswald', 'Arial Narrow', Arial, sans-serif; color: #fff; }",
    "#pt .pt-name.empty { color: #b7bfd0; font-size: 4vh; font-weight: 600; }",
    "#pt .pt-btns { display: flex; gap: 1vw; }",
    "#pt button { cursor: pointer; font: 600 3vh 'Oswald', 'Arial Narrow', Arial, sans-serif; letter-spacing: .04em; border-radius: 999px; border: .3vh solid #c9a227;",
    "  background: #1f2a44; color: #c9a227; padding: 1.2vh 1.6vw; }",
    "#pt button.gold { background: #c9a227; color: #141c30; }",
    "#pt button[disabled] { opacity: .35; pointer-events: none; }",
    "#pt .pt-btns button { flex: 1; font-size: 3.6vh; padding: 1.6vh 1vw; }",
    "#pt .pt-played { margin-top: auto; min-height: 0; overflow: hidden; }",
    "#pt .pt-chips { display: flex; flex-wrap: wrap; gap: .8vh .6vw; max-height: 12vh; overflow: hidden; }",
    "#pt .pt-chips i { font-style: normal; background: #33466e; color: #dfe4ee; border-radius: 999px; padding: .4vh .9vw; font-size: 2.2vh; }",
    "#pt .pt-right { position: relative; display: flex; align-items: center; justify-content: center; min-height: 0; min-width: 0; }",
    /* 2.5.1 (Mat 11/12): the wheel fills the whole right side, top to bottom; the pointer is part of the drawing, its tip just over the rim */
    "#pt .pt-wheelbox { position: relative; height: 100%; max-width: 100%; aspect-ratio: 1; }",
    "#pt svg.pt-wheel { width: 100%; height: 100%; display: block; overflow: visible; }",
    "#pt .pt-spin { position: absolute; left: 50%; top: 53.24%; transform: translate(-50%, -50%); width: 20%; aspect-ratio: 1; border-radius: 50%;",
    "  background: #1f2a44; border: .7vh solid #c9a227; color: #c9a227; font: 600 4.6vh 'Oswald', 'Arial Narrow', Arial, sans-serif; padding: 0;",
    "  box-shadow: 0 .6vh 2.4vh rgba(0,0,0,.45); }",
    "#pt .pt-spin:active { transform: translate(-50%, -50%) scale(.96); }",
    "#pt #ptRot path.win { stroke: #fff; stroke-width: 2.6; filter: brightness(1.18); }",
    "#pt .pt-corner { position: absolute; display: flex; flex-direction: column; gap: 1vh; z-index: 3; }",
    "#pt .pt-corner.tl { left: 0; top: 0; } #pt .pt-corner.tr { right: 0; top: 0; align-items: flex-end; }",
    "#pt .pt-corner.bl { left: 0; bottom: 0; } #pt .pt-corner.br { right: 0; bottom: 0; align-items: flex-end; }",
    "#pt .pt-corner button { font-size: 2.3vh; padding: .9vh 1vw; white-space: nowrap; background: rgba(31,42,68,.92); }",
    "#pt .pt-left-n { font: 600 3vh/1.15 'Oswald', 'Arial Narrow', Arial, sans-serif; color: #dfe4ee; white-space: nowrap; }",
    "#pt .pt-left-n b { display: block; font-size: 6vh; color: #c9a227; }",
    "#pt .pt-msg { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; text-align: center; padding: 10%;",
    "  font: 600 4.4vh/1.3 'Oswald', 'Arial Narrow', Arial, sans-serif; color: #c9a227; }",
    "#pt .pt-banner { position: absolute; left: 50%; top: 46%; transform: translate(-50%, -50%) scale(.6); opacity: 0; pointer-events: none; z-index: 5;",
    "  background: #c9a227; color: #141c30; border-radius: 3vh; padding: 3vh 4vw; text-align: center; box-shadow: 0 2vh 6vh rgba(0,0,0,.55);",
    "  transition: opacity .25s, transform .35s cubic-bezier(.2,1.5,.4,1); }",
    "#pt .pt-banner.show { opacity: 1; transform: translate(-50%, -50%) scale(1); }",
    "#pt .pt-banner small { display: block; font: 600 3.4vh 'Oswald', 'Arial Narrow', Arial, sans-serif; letter-spacing: .08em; text-transform: uppercase; }",
    "#pt .pt-banner b { display: block; font: 600 12vh/1.05 'Oswald', 'Arial Narrow', Arial, sans-serif; white-space: nowrap; }",
    "#pt .pt-sheet { position: absolute; inset: 0; z-index: 6; display: none; align-items: center; justify-content: center; background: rgba(10,15,28,.7); }",
    "#pt .pt-sheet.open { display: flex; }",
    "#pt .pt-panel { background: #1f2a44; border: .4vh solid #c9a227; border-radius: 2.4vh; padding: 3vh 2.4vw; max-width: 86vw; max-height: 86vh; overflow: auto; }",
    "#pt .pt-panel h2 { margin: 0 0 1.4vh; font: 600 4.4vh 'Oswald', 'Arial Narrow', Arial, sans-serif; color: #c9a227; }",
    "#pt .pt-panel p { margin: .6vh 0 1.4vh; font-size: 2.4vh; color: #dfe4ee; }",
    "#pt .pt-roll { display: grid; grid-template-columns: repeat(auto-fill, minmax(17vw, 1fr)); gap: 1vh .8vw; margin-bottom: 2vh; min-width: 60vw; }",
    "#pt .pt-roll button { font-size: 2.6vh; padding: 1.2vh .8vw; border-color: #4a6aa5; color: #fff; background: #2a3858; text-align: left; border-radius: 1.4vh; }",
    "#pt .pt-roll button.abs { background: #141c30; color: #8b93a6; border-style: dashed; text-decoration: line-through; }",
    "#pt .pt-roll button.done { background: #33466e; color: #b7bfd0; border-color: #33466e; pointer-events: none; }",
    "#pt .pt-roll button.done::after { content: ' ✓'; color: #c9a227; }",
    "#pt .pt-qr { display: flex; gap: 2.4vw; align-items: center; }",
    "#pt .pt-qr .q { background: #fff; padding: 1.2vh; border-radius: 1.6vh; width: 34vh; height: 34vh; }",
    "#pt .pt-qr .q svg { width: 100%; height: 100%; display: block; }",
    "#pt .pt-code { font: 600 9vh/1 'Oswald', 'Arial Narrow', Arial, sans-serif; letter-spacing: .3em; color: #c9a227; }",
    "#pt .pt-url { font-size: 2.2vh; color: #dfe4ee; word-break: break-all; max-width: 40vw; }",
    "#pt .pt-status { margin-top: 1.4vh; font-size: 2.4vh; }",
    "#pt .pt-status.ok { color: #7fe0a0; } #pt .pt-status.err { color: #ff9a8a; }",
    "#pt .pt-remote-on { position: absolute; right: 2.4vw; bottom: 2vh; font-size: 2.2vh; color: #7fe0a0; }",
    "#btnPtest { display: none; background: #c9a227; color: #141c30; border: 2px solid #c9a227; border-radius: 999px; padding: 10px 18px; cursor: pointer;",
    "  font: 600 20px 'Oswald', 'Arial Narrow', Arial, sans-serif; letter-spacing: .04em; box-shadow: 0 4px 14px rgba(0,0,0,.35); }",
    "#btnPtest.show { display: inline-block; }",
    "#ptText { width: 100%; box-sizing: border-box; margin-top: 8px; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--line);",
    "  background: var(--bg); color: var(--ink); font: inherit; font-size: 16px; }"
  ].join("\n");
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  var el = document.createElement("div");
  el.id = "pt"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Playing test");
  el.innerHTML =
    '<div class="pt-body">' +
    '  <div class="pt-left">' +
    '    <div class="pt-head"><img src="assets/raven-logo.png?v=1.1.0" alt=""><h1 id="ptTitle"></h1></div>' +
    '    <div class="pt-sub"><div class="pt-date" id="ptDate"></div><div class="pt-count" id="ptCount"></div></div>' +
    '    <div class="pt-rule"></div>' +
    '    <div class="pt-card"><div class="pt-h">🎯 Today\'s playing test</div><div class="pt-test" id="ptTest"></div></div>' +
    '    <div class="pt-card pt-now"><div class="pt-h">Now playing</div><div class="pt-name" id="ptNow"></div></div>' +
    '    <div class="pt-card pt-deck"><div class="pt-h">On deck · get ready</div><div class="pt-name" id="ptDeck"></div></div>' +
    '    <div class="pt-btns"><button class="gold" id="ptDone">✓ Done</button><button id="ptLater">↺ Later</button></div>' +
    '    <div class="pt-card pt-played"><div class="pt-h" id="ptPlayedH">Played</div><div class="pt-chips" id="ptPlayed"></div></div>' +
    '  </div>' +
    '  <div class="pt-right">' +
    '    <div class="pt-wheelbox" id="ptWheelBox">' +
    '      <svg class="pt-wheel" id="ptWheel" viewBox="-108 -115 216 216" aria-hidden="true"><g id="ptRot"></g>' +
    '        <g class="pt-pointer"><polygon points="0,-95 -10,-114 10,-114" fill="#c9a227" stroke="#141c30" stroke-width="1.6" stroke-linejoin="round"/>' +
    '        <circle cx="0" cy="-111" r="3" fill="#141c30"/></g></svg>' +
    '      <button class="pt-spin" id="ptSpin" aria-label="Spin the wheel">SPIN</button><div class="pt-msg" id="ptMsg"></div></div>' +
    '    <div class="pt-corner tl"><span class="pt-left-n" id="ptLeftN"></span></div>' +
    '    <div class="pt-corner tr"><button id="ptHide">📋 Agenda</button><button id="ptMenu" aria-label="Menu">☰ Menu</button></div>' +
    '    <div class="pt-corner bl"><button id="ptClass">👥 Class list</button><button id="ptRemote">📱 Remote</button></div>' +
    '    <div class="pt-corner br"><button id="ptUndo">⤺ Undo</button></div>' +
    '  </div>' +
    '</div>' +
    '<div class="pt-banner" id="ptBanner"><small id="ptBannerH"></small><b id="ptBannerN"></b></div>' +
    '<div class="pt-sheet" id="ptClassSheet"><div class="pt-panel"><h2>👥 Who\'s here?</h2>' +
    '  <p>Tap a name to mark them absent (off the wheel). Tap again to put them back.</p><div class="pt-roll" id="ptRoll"></div>' +
    '  <button class="gold" id="ptClassClose">Close</button></div></div>' +
    '<div class="pt-sheet" id="ptRemoteSheet"><div class="pt-panel"><h2>📱 Remote control</h2><div class="pt-qr"><div class="q" id="ptQr"></div>' +
    '  <div><p>Scan with your phone or iPad, or open the link and type the code.<br>It asks for the Playing Test PIN the first time.</p>' +
    '  <div class="pt-code" id="ptCode">····</div><div class="pt-url" id="ptUrl"></div><div class="pt-status" id="ptRStatus"></div></div></div>' +
    '  <p style="margin-top:2vh">Scores only show on the remote. They are saved to the "Playing Tests" tab.</p>' +
    '  <button class="gold" id="ptRemoteClose">Close</button></div></div>' +
    '<div class="pt-remote-on" id="ptRemoteOn"></div>';
  document.body.appendChild(el);

  // 🎯 button on the left bar: reopens the test after "📋 Agenda"
  var btn = document.createElement("button");
  btn.id = "btnPtest"; btn.textContent = "🎯 Playing Test"; btn.setAttribute("aria-label", "Show the playing test");
  var bar = $("leftBar"); if (bar) bar.insertBefore(btn, $("overrideBadge") || null);

  // ---------------------------------------------------------------- data
  var R = load(ROSTER_KEY) || {};     // block → { students:[{id,n}], test, date, scores, at }
  var cur = null;                     // block with an active playing test on screen
  var S = null;                       // that block's progress for today
  var hidden = {};                    // block → true after "📋 Agenda" (until the next time the test turns on)
  var spinning = false, rot = 0, wheelKey = "";
  var landed = null, landT = null;     // the name just picked: the wheel holds still on it a moment before it drops off

  function dayOverride() { var o = load(DAY_KEY); return o && o.date === today() ? o : null; }
  function roster(block) { var r = R[block]; return r && r.date === today() ? r : (r && r.students ? { students: r.students, test: "", scores: {}, date: r.date } : null); }
  function active(block) {
    var o = dayOverride();
    if (o && o.on === true) return true;
    if (o && o.on === false) return false;
    var r = R[block];
    return !!(r && r.date === today() && r.test);
  }
  function testText(block) {
    var r = R[block], o = dayOverride();
    return (r && r.date === today() && r.test) || (o && o.text) || "Playing test";
  }
  function stateKey(block) { return "agendaBoard.pt." + today() + "." + block; }
  function blank() { return { now: null, deck: null, played: [], absent: [], later: [], scores: {}, hist: [] }; }
  function loadState(block) { var s = load(stateKey(block)); return s && s.played ? s : blank(); }
  function saveState() { if (cur && S) save(stateKey(cur), S); }
  function names() { var m = {}, r = roster(cur); (r ? r.students : []).forEach(function (s) { m[s.id] = s.n; }); return m; }
  function known(id) { return !!names()[id]; }
  function nameOf(id) { return names()[id] || "?"; }
  function wheelIds() {
    if (!S) return [];
    var r = roster(cur); if (!r) return [];
    var out = {}; [S.now, S.deck].concat(S.played, S.absent).forEach(function (id) { if (id) out[id] = 1; });
    return r.students.map(function (s) { return s.id; }).filter(function (id) { return !out[id]; });
  }

  var fetching = {};
  function fetchBlock(block, force) {
    var set = B.settings();
    if (!set.closingUrl || fetching[block]) return;
    var r = R[block];
    if (!force && r && r.date === today() && Date.now() - (r.at || 0) < 120000) return;
    fetching[block] = true;
    B.call({ a: "ptest", block: block }).then(function (j) {
      fetching[block] = false;
      R[block] = { students: j.students || [], test: j.test || "", scores: j.scores || {}, date: today(), at: Date.now() };
      var keep = {}; Object.keys(R).forEach(function (b) { keep[b] = { students: R[b].students, test: R[b].test, date: R[b].date }; });
      save(ROSTER_KEY, keep);
      if (cur === block && S) mergeScores();
      sync();
    }).catch(function () {
      fetching[block] = false;
      if (R[block]) R[block].at = Date.now() - 90000;       // try again in ~30 s
      sync();
    });
  }
  function mergeScores() {          // scores already in the sheet today (e.g. this board's storage was cleared)
    var r = R[cur]; if (!r || !r.scores) return;
    Object.keys(r.scores).forEach(function (id) {
      if (!S.scores[id]) S.scores[id] = { s: r.scores[id].s, note: r.scores[id].note || "", st: "ok" };
    });
  }

  // ---------------------------------------------------------------- show / hide
  function sync() {
    var sh = B.shown(), blk = sh.key && sh.key !== "welcome" ? sh.key : null;
    if (blk) fetchBlock(blk);
    var on = !!blk && active(blk);
    if (!on) {
      if (cur) { cur = null; S = null; broadcast(); }
      el.classList.remove("open"); btn.classList.remove("show"); document.body.classList.remove("pt-open");
      return;
    }
    if (cur !== blk) {
      cur = blk; S = loadState(blk); mergeScores(); rot = S.rot || 0; wheelKey = "";
      if (!spinning) $("ptRot").style.transition = "none";
    }
    var showIt = !hidden[blk];
    el.classList.toggle("open", showIt);
    document.body.classList.toggle("pt-open", showIt);
    btn.classList.toggle("show", !showIt);
    render();
    startHost();
    flush();
  }
  window.ptestSync = sync;
  setInterval(sync, 30000);

  // ---------------------------------------------------------------- drawing
  function render() {
    if (!cur || !S) return;
    var r = roster(cur), n = names();
    $("ptTitle").innerHTML = esc(cur) + " Block <span>Playing Test</span>";
    $("ptDate").textContent = B.now().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
    var total = r ? r.students.length - S.absent.filter(function (id) { return n[id]; }).length : 0;
    $("ptCount").textContent = (r ? S.played.filter(function (id) { return n[id]; }).length : 0) + " of " + total + " played";
    $("ptTest").textContent = testText(cur);
    nameBox("ptNow", S.now, S.now ? "" : (wheelIds().length ? "Spin the wheel!" : "—"));
    nameBox("ptDeck", S.deck, S.deck ? "" : S.now && wheelIds().length ? "Spin for who's next" : "—");
    $("ptDone").disabled = spinning || !S.now;
    $("ptLater").disabled = spinning || !S.now;
    $("ptUndo").disabled = spinning || !S.hist.length;
    var ids = wheelIds();
    $("ptSpin").disabled = spinning || !ids.length || !!(S.now && S.deck);
    $("ptLeftN").innerHTML = "<b>" + ids.length + "</b>left to play";
    var played = S.played.filter(function (id) { return n[id]; });
    $("ptPlayedH").textContent = "Played (" + played.length + ")" + (S.absent.length ? " · Absent: " + S.absent.length : "");
    $("ptPlayed").innerHTML = played.slice().reverse().map(function (id) { return "<i>" + esc(n[id]) + "</i>"; }).join("");
    var msg = "";
    if (!r) msg = B.settings().closingUrl ? "Loading the class list…" : "The class list needs the closing scores link (☰ → Settings).";
    else if (!r.students.length) msg = "No students found on the " + esc(cur) + " Block tab.";
    else if (!ids.length && !S.now && !S.deck) msg = "Everyone has played! 🎉";
    $("ptMsg").innerHTML = msg;
    $("ptMsg").style.display = msg ? "flex" : "none";
    $("ptSpin").style.display = msg ? "none" : "";
    drawWheel(ids);
    if ($("ptClassSheet").classList.contains("open")) drawRoll();
    remoteBadge();
  }
  function nameBox(id, sid, empty) {
    var b = $(id);
    b.textContent = sid ? nameOf(sid) : empty;
    b.classList.toggle("empty", !sid);
  }
  function pt(r, a) { var t = a * Math.PI / 180; return [r * Math.sin(t), -r * Math.cos(t)]; }   // angle clockwise from the top
  function drawWheel(ids) {
    if (spinning || landed) return;
    var key = ids.join(",");
    if (key === wheelKey) return;
    wheelKey = key;
    var g = $("ptRot"), n = ids.length, h = "";
    if (n === 1) {
      h = '<circle r="100" fill="' + COLORS[0][0] + '" stroke="#141c30" stroke-width="1.2"/>' +
        '<text x="0" y="-62" text-anchor="middle" dominant-baseline="middle" font-size="13" font-weight="700" fill="' + COLORS[0][1] + '">' + esc(nameOf(ids[0])) + "</text>";
    } else if (n > 1) {
      var seg = 360 / n, fs = Math.max(4.2, Math.min(11, 0.5 * 2 * Math.PI * 62 / n));
      ids.forEach(function (id, i) {
        var c = i * seg, a0 = pt(100, c - seg / 2), a1 = pt(100, c + seg / 2);
        var col = COLORS[i % COLORS.length];
        if (i === n - 1 && n % COLORS.length === 1) col = COLORS[2];        // never the same color next to the first slice
        h += '<path d="M0 0 L' + a0[0].toFixed(2) + " " + a0[1].toFixed(2) + " A100 100 0 " + (seg > 180 ? 1 : 0) + " 1 " + a1[0].toFixed(2) + " " + a1[1].toFixed(2) +
          ' Z" fill="' + col[0] + '" stroke="#141c30" stroke-width=".8" data-id="' + esc(id) + '"/>';
        var label = nameOf(id); if (label.length > 14) label = label.slice(0, 13) + "…";
        h += '<text transform="rotate(' + (c - 90).toFixed(3) + ')" x="87" y="0" text-anchor="end" dominant-baseline="middle" font-size="' + fs.toFixed(2) +
          '" font-weight="700" font-family="Oswald, Arial Narrow, Arial, sans-serif" fill="' + col[1] + '" data-id="' + esc(id) + '">' + esc(label) + "</text>";
      });
    }
    h += '<circle r="100" fill="none" stroke="#c9a227" stroke-width="3"/>';
    g.innerHTML = h;
    g.style.transition = "none";
    g.style.transform = "rotate(" + rot + "deg)";
  }
  function drawRoll() {
    var r = roster(cur); if (!r) return;
    $("ptRoll").innerHTML = r.students.map(function (s) {
      var cls = S.played.indexOf(s.id) >= 0 ? "done" : S.absent.indexOf(s.id) >= 0 ? "abs" : "";
      return '<button class="' + cls + '" data-id="' + esc(s.id) + '">' + esc(s.n) + "</button>";
    }).join("");
  }
  var bannerT = null;
  function banner(head, name) {
    $("ptBannerH").textContent = head; $("ptBannerN").textContent = name;
    $("ptBanner").classList.add("show");
    clearTimeout(bannerT); bannerT = setTimeout(function () { $("ptBanner").classList.remove("show"); }, 2600);
  }

  // ---------------------------------------------------------------- sound: a soft tick per slice while spinning
  var actx = null;
  function tick() {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === "suspended") actx.resume();
      var o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime;
      o.type = "triangle"; o.frequency.value = 1500;
      g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + 0.06);
    } catch (e) {}
  }

  // ---------------------------------------------------------------- actions (board buttons and the remote use the same ones)
  function push() {
    S.hist.push(JSON.stringify({ now: S.now, deck: S.deck, played: S.played, absent: S.absent, later: S.later }));
    if (S.hist.length > 20) S.hist.shift();
  }
  function place(id) { if (!S.now) S.now = id; else S.deck = id; }
  function rnd(n) {
    if (window.__ptPick) return window.__ptPick(n);           // tests
    try { var a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; } catch (e) { return Math.floor(Math.random() * n); }
  }
  function spin() {
    if (!cur || !S || spinning) return;
    var ids = wheelIds();
    if (!ids.length || (S.now && S.deck)) return;
    if (landed) { clearTimeout(landT); landed = null; wheelKey = ""; drawWheel(ids); }   // the last pick leaves the wheel first
    var n = ids.length, i = rnd(n), seg = 360 / n;
    var jitter = n > 1 ? (Math.random() - 0.5) * seg * 0.6 : 0;
    var target = -(i * seg + jitter);                            // that slice's middle (± a little) under the pointer
    var base = rot + 360 * 6;
    var fin = base + ((((target - base) % 360) + 360) % 360);
    var g = $("ptRot"), ms = spinMs(), seg2 = seg, last = Math.floor(rot / seg2);
    spinning = true; render(); broadcast();
    g.style.transition = "transform " + ms + "ms cubic-bezier(.12,.72,.14,1)";
    void g.getBoundingClientRect();
    g.style.transform = "rotate(" + fin + "deg)";
    var t0 = performance.now();
    (function watch() {
      if (!spinning) return;
      var m = getComputedStyle(g).transform, ang = rot;
      if (m && m !== "none") { var v = m.match(/matrix\(([^)]+)\)/); if (v) { var p = v[1].split(",").map(Number); ang = Math.atan2(p[1], p[0]) * 180 / Math.PI; } }
      var k = Math.floor(((ang % 360) + 360) % 360 / seg2);
      if (k !== last) { last = k; if (n > 1) tick(); }
      if (performance.now() - t0 < ms) requestAnimationFrame(watch);
    })();
    setTimeout(function () {
      rot = ((fin % 360) + 360) % 360;
      g.style.transition = "none"; g.style.transform = "rotate(" + rot + "deg)";
      spinning = false;
      push();
      var head = S.now ? "On deck" : "Now playing";
      place(ids[i]);
      S.rot = rot;
      saveState();
      landed = ids[i];
      Array.prototype.forEach.call(g.querySelectorAll("path"), function (p) { p.classList.toggle("win", p.getAttribute("data-id") === landed); });
      clearTimeout(landT);
      landT = setTimeout(function () { landed = null; wheelKey = ""; render(); }, window.__ptHoldMs || 2800);
      render(); broadcast();
      banner(head, nameOf(ids[i]));
    }, ms + 60);
  }
  function act(a, x) {
    if (!cur || !S) return;
    x = x || {};
    switch (a) {
      case "spin": spin(); return;
      case "done":
      case "later":
        if (spinning || !S.now) return;
        push();
        if (a === "done") S.played.push(S.now); else S.later.push(S.now);
        S.now = S.deck; S.deck = null;
        break;
      case "absent":
        if (!known(x.id)) return;
        push();
        if (x.on) {
          if (S.absent.indexOf(x.id) < 0) S.absent.push(x.id);
          if (S.deck === x.id) S.deck = null;
          if (S.now === x.id) { S.now = S.deck; S.deck = null; }
          S.played = S.played.filter(function (id) { return id !== x.id; });
        } else S.absent = S.absent.filter(function (id) { return id !== x.id; });
        break;
      case "back":                        // a played student goes back on the wheel
        if (S.played.indexOf(x.id) < 0) return;
        push(); S.played = S.played.filter(function (id) { return id !== x.id; });
        break;
      case "pick":                        // the remote picks a student by hand (e.g. "can I go next?")
        if (spinning || wheelIds().indexOf(x.id) < 0 || (S.now && S.deck)) return;
        push(); place(x.id);
        break;
      case "clear":                       // take Now playing / On deck back to the wheel
        if (spinning) return;
        if (x.slot === "deck" && S.deck) { push(); S.deck = null; }
        else if (x.slot === "now" && S.now) { push(); S.now = S.deck; S.deck = null; }
        else return;
        break;
      case "undo":
        if (spinning || !S.hist.length) return;
        var h = JSON.parse(S.hist.pop());
        S.now = h.now; S.deck = h.deck; S.played = h.played; S.absent = h.absent; S.later = h.later;
        break;
      case "score": score(x.id, x.s, x.note); return;
      default: return;
    }
    saveState(); render(); broadcast();
  }

  // ---------------------------------------------------------------- scores (never drawn on the board)
  var flushing = false, flushT = null;
  function score(id, s, note) {
    if (!known(id)) return;
    s = String(s == null ? "" : s);
    if (s !== "" && !RUBRIC[s]) return;
    if (s === "") delete S.scores[id]; else S.scores[id] = { s: s, note: String(note || "").slice(0, 500), st: "saving" };
    var q = (load(QUEUE_KEY) || []).filter(function (x) { return !(x.date === today() && x.block === cur && x.id === id); });
    q.push({ date: today(), block: cur, id: id, s: s, note: String(note || "").slice(0, 500), test: testText(cur) });
    save(QUEUE_KEY, q);
    saveState(); broadcast(); flush();
  }
  function markScore(item, stt, err) {
    var key = "agendaBoard.pt." + item.date + "." + item.block;
    var s = cur === item.block && item.date === today() ? S : load(key);
    if (!s || !s.scores) return;
    if (item.s === "") delete s.scores[item.id];
    else if (s.scores[item.id] && s.scores[item.id].s === item.s) { s.scores[item.id].st = stt; s.scores[item.id].err = err || ""; }
    save(key, s);
  }
  function flush() {
    if (flushing) return;
    var q = load(QUEUE_KEY) || [];
    if (!q.length) return;
    var it = q[0];
    flushing = true;
    var p = B.test ? new Promise(function (ok) { setTimeout(ok, 120); })       // board test mode: nothing is saved
      : B.call({ a: "ptscore", block: it.block, id: it.id, s: it.s, note: it.note, test: it.test });
    p.then(function () {
      var q2 = (load(QUEUE_KEY) || []).filter(function (x) { return !(x.date === it.date && x.block === it.block && x.id === it.id && x.s === it.s && x.note === it.note); });
      save(QUEUE_KEY, q2);
      markScore(it, "ok");
      flushing = false; broadcast(); flush();
    }).catch(function (e) {
      markScore(it, "err", String(e && e.message || e));
      flushing = false; broadcast();
      clearTimeout(flushT); flushT = setTimeout(flush, 20000);
    });
  }

  // ---------------------------------------------------------------- board buttons
  $("ptSpin").onclick = function () { act("spin"); };
  $("ptWheelBox").addEventListener("click", function (e) { if (e.target.closest("svg")) act("spin"); });
  $("ptDone").onclick = function () { act("done"); };
  $("ptLater").onclick = function () { act("later"); };
  $("ptUndo").onclick = function () { act("undo"); };
  $("ptHide").onclick = function () { if (cur) hidden[cur] = true; sync(); };
  $("ptMenu").onclick = function () { var m = $("btnMenu"); if (m) m.click(); };       // the board's ☰ sits under this screen
  btn.onclick = function () { var sh = B.shown(); if (sh.key) delete hidden[sh.key]; sync(); };
  $("ptClass").onclick = function () { drawRoll(); $("ptClassSheet").classList.add("open"); };
  $("ptClassClose").onclick = function () { $("ptClassSheet").classList.remove("open"); };
  $("ptRoll").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-id]"); if (!b) return;
    var id = b.getAttribute("data-id");
    act("absent", { id: id, on: S.absent.indexOf(id) < 0 });
    drawRoll();
  });
  $("ptRemote").onclick = function () { startHost(); paintRemote(); $("ptRemoteSheet").classList.add("open"); };
  $("ptRemoteClose").onclick = function () { $("ptRemoteSheet").classList.remove("open"); };
  Array.prototype.forEach.call(el.querySelectorAll(".pt-sheet"), function (sh) {
    sh.addEventListener("click", function (e) { if (e.target === sh) sh.classList.remove("open"); });
  });

  // ---------------------------------------------------------------- menu switch (☰): 🎯 Playing Test today
  function menuSetup() {
    var box = document.querySelector("#menu .toggles");
    if (!box || $("ptToggle")) return;
    var t = document.createElement("button");
    t.className = "tgl"; t.id = "ptToggle"; t.setAttribute("role", "switch"); t.setAttribute("aria-checked", "false");
    t.innerHTML = '<span class="tgl-text"><span class="tgl-name">🎯 Playing Test</span><span class="tgl-sub" id="ptSub"></span></span><span class="tgl-sw" aria-hidden="true"></span>';
    box.appendChild(t);
    var inp = document.createElement("input");
    inp.id = "ptText"; inp.placeholder = "What they're playing (if it's not on the slide)"; inp.setAttribute("aria-label", "What they're playing");
    box.appendChild(inp);
    t.onclick = function () {
      var sh = B.shown(), blk = sh.key && sh.key !== "welcome" ? sh.key : null;
      var on = blk ? active(blk) : !!(dayOverride() && dayOverride().on);
      var o = dayOverride() || { date: today(), text: "" };
      o.on = !on; o.date = today();
      save(DAY_KEY, o);
      if (o.on && blk) delete hidden[blk];
      paintMenu(); sync();
    };
    inp.oninput = function () {
      var o = dayOverride() || { date: today(), on: null };
      o.text = inp.value; o.date = today();
      save(DAY_KEY, o); if (cur) render();
    };
  }
  function paintMenu() {
    menuSetup();
    var t = $("ptToggle"); if (!t) return;
    var sh = B.shown(), blk = sh.key && sh.key !== "welcome" ? sh.key : null, o = dayOverride();
    var on = blk ? active(blk) : !!(o && o.on);
    var slide = blk && R[blk] && R[blk].date === today() ? R[blk].test : "";
    t.setAttribute("aria-checked", on ? "true" : "false");
    $("ptSub").textContent = on ? (slide ? "On: from the slide (" + slide + ")" : "On for today") :
      (o && o.on === false && slide ? "Off today (the slide has one)" : "Off: turns on by itself when a slide says \"Playing Test:\"");
    $("ptText").value = (o && o.text) || "";
  }
  var menuBtn = $("btnMenu");
  if (menuBtn) menuBtn.addEventListener("click", function () { setTimeout(paintMenu, 0); });
  menuSetup();

  // ---------------------------------------------------------------- remote host (PeerJS, like Grudgeball)
  var NET = window.PTNET, peer = null, conns = [], hostStatus = "off", hostErr = "", code = null, idRetries = 0, restartT = null;
  function getCode() {
    var c = load(CODE_KEY);
    if (c && c.date === today() && c.code) return c.code;
    var n = NET.newCode(); save(CODE_KEY, { date: today(), code: n }); return n;
  }
  function remoteUrl() {
    var base = location.origin + location.pathname.replace(/[^/]*$/, "") + "remote.html?c=" + code;
    return base + (NET.FAKE ? "&peerfake=1" : "");
  }
  function startHost() {
    if (!NET || peer || !cur) return;
    code = getCode();
    hostStatus = "wait"; paintRemote();
    NET.ready(function (ok) {
      if (!ok) { hostStatus = "err"; hostErr = "The remote-control library didn't load."; paintRemote(); return; }
      if (peer) return;
      var p;
      try { p = peer = NET.makePeer(NET.PREFIX + code); } catch (e) { hostStatus = "err"; hostErr = String(e.message || e); paintRemote(); return; }
      p.on("open", function () { if (p !== peer) return; hostStatus = "ready"; idRetries = 0; paintRemote(); });
      p.on("connection", function (c) {
        c.authed = false; c.bad = 0;
        c.on("open", function () { conns.push(c); paintRemote(); });
        c.on("data", function (d) { try { onData(c, d); } catch (e) { console.error(e); } });
        c.on("close", function () { conns = conns.filter(function (x) { return x !== c; }); paintRemote(); remoteBadge(); });
        c.on("error", function () {});
      });
      p.on("disconnected", function () {
        if (p !== peer) return;
        hostStatus = "wait"; paintRemote();
        setTimeout(function () { try { if (p === peer && !p.destroyed && p.disconnected) p.reconnect(); } catch (e) {} }, 2000);
      });
      p.on("error", function (e) {
        if (p !== peer) return;
        var t = e && e.type;
        if (t === "unavailable-id") {             // usually this board's own last session, still registered after a reload
          idRetries++;
          if (idRetries > 4) { save(CODE_KEY, null); idRetries = 0; }
          restart(3000); return;
        }
        if (["network", "server-error", "socket-error", "socket-closed", "browser-incompatible", "ssl-unavailable"].indexOf(t) >= 0) {
          hostStatus = "err"; hostErr = "Can't reach the connection service (the network may block it). Retrying…";
          paintRemote(); restart(8000);
        }
      });
    });
  }
  function restart(ms) {
    clearTimeout(restartT);
    restartT = setTimeout(function () {
      conns.forEach(function (c) { try { c.close(); } catch (e) {} }); conns = [];
      if (peer) { var p = peer; peer = null; try { p.destroy(); } catch (e) {} }
      startHost();
    }, ms);
  }
  function pinOk(pin) {
    var want = String(B.settings().ptPin || "").trim();
    return !!want && String(pin || "").trim() === want;
  }
  function onData(c, d) {
    if (!d || typeof d !== "object") return;
    if (d.type === "hello") {
      if (!String(B.settings().ptPin || "").trim()) { send(c, { type: "pin", none: true }); return; }
      if (!pinOk(d.pin)) {
        c.bad++;
        send(c, { type: "pin", bad: !!d.pin });
        if (c.bad >= 6) setTimeout(function () { try { c.close(); } catch (e) {} }, 200);
        return;
      }
      c.authed = true; send(c, snapshot()); remoteBadge(); paintRemote();
      return;
    }
    if (!c.authed) return;
    if (d.type === "act") act(d.a, d.x);
  }
  function snapshot() {
    if (!cur || !S) return { type: "state", block: null };
    var r = roster(cur);
    return { type: "state", block: cur, date: today(), test: testText(cur), names: names(), order: r ? r.students.map(function (s) { return s.id; }) : [],
      wheel: wheelIds(), now: S.now, deck: S.deck, played: S.played, absent: S.absent, later: S.later,
      scores: S.scores, spinning: spinning, canUndo: !!S.hist.length, pending: (load(QUEUE_KEY) || []).length };
  }
  function send(c, m) { try { if (c.open) c.send(m); } catch (e) {} }
  var bq = false;
  function broadcast() {
    if (bq) return; bq = true;
    setTimeout(function () { bq = false; var m = snapshot(); conns.forEach(function (c) { if (c.authed) send(c, m); }); }, 0);
  }
  function remoteBadge() {
    var n = conns.filter(function (c) { return c.authed; }).length;
    $("ptRemoteOn").textContent = n ? "📱 Remote connected" : "";
  }
  function paintRemote() {
    if (!code) code = getCode();
    $("ptCode").textContent = code;
    var url = remoteUrl();
    $("ptUrl").textContent = url;
    NET.qrReady(function (ok) { $("ptQr").innerHTML = ok ? NET.qrSvg(url) : ""; });
    var n = conns.filter(function (c) { return c.authed; }).length;
    var s = $("ptRStatus");
    s.className = "pt-status " + (hostStatus === "err" ? "err" : n ? "ok" : "");
    s.textContent = !String(B.settings().ptPin || "").trim() ? "⚠ Set a \"Playing Test PIN\" in the Board Settings sheet first." :
      hostStatus === "err" ? hostErr : hostStatus === "ready" ? (n ? "✓ " + n + " remote" + (n > 1 ? "s" : "") + " connected" : "Ready: waiting for your phone…") : "Starting…";
  }

  // tests
  window.__ptest = { act: act, state: function () { return S && JSON.parse(JSON.stringify(S)); }, cur: function () { return cur; },
    wheel: wheelIds, spinning: function () { return spinning; }, code: function () { return code; }, conns: function () { return conns.length; },
    queue: function () { return load(QUEUE_KEY) || []; }, sync: sync };
  sync();
})();
