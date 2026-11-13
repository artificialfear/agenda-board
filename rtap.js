/* ===================== RHYTHM TAP-ALONG (2.8.0, Mat 11/13) =====================
   Students tap the Rhythm of the Day on school Chromebooks / iPads and get a score.
   - In the Rhythm of the Day view: 📱 Tap along → a card with a QR code + code. Students open tap.html?c=CODE, pick their
     name from the class list (First L., same roster as the Playing Test wheel: a=ptest), and wait.
   - ▶ Count off on the board starts a round on every device: tap with the count-off clicks (that measures each device's own
     delay), then tap the rhythm. Devices stay silent; everyone listens to the board.
   - Each device scores itself (rtapScore below, also used by tap.html) and sends the result. The board shows the Top 5 and the
     class average. Just for fun: nothing is saved (Mat's choice 11/13).
   Connection: PeerJS through ptnet.js (same as the Playing Test remote), peer id "ravenband-rtap-v1-" + CODE.
   Clock: devices ping the board (performance.now() both ends) and keep the fastest answer to line their clocks up.
   Uses window.__board (index.html): call(params), settings(), now(), ymd(d), shown(). index.html calls window.rtapStart(round)
   from metroStart and window.rtapStop() from metroStop. */
(function () {
  "use strict";

  // ---------------------------------------------------------------- scoring (shared with tap.html; pure)
  // onsetsMs: when each note should be tapped; tapsMs: when the student tapped (both on one clock, delay already removed).
  // Each tap goes to the nearest unclaimed note inside that note's window. Windows shrink for close notes (sixteenths).
  function rtapScore(onsetsMs, tapsMs, opts) {
    opts = opts || {};
    var PERF = opts.perfect || 70, GOOD = opts.good || 140;
    var n = onsetsMs.length, win = onsetsMs.map(function (o, i) {
      var g = Math.min(i > 0 ? o - onsetsMs[i - 1] : Infinity, i + 1 < n ? onsetsMs[i + 1] - o : Infinity);
      var good = Math.min(GOOD, g * 0.5), perfect = Math.min(PERF, good * 0.5);
      return { good: good, perfect: perfect };
    });
    var lo = onsetsMs[0] - GOOD, hi = onsetsMs[n - 1] + GOOD;
    var taken = [], res = { perfect: 0, good: 0, miss: 0, extra: 0, n: n, offs: [], notes: onsetsMs.map(function () { return 0; }) };
    tapsMs.slice().sort(function (a, b) { return a - b; }).forEach(function (t) {
      if (t < lo || t > hi) return;                                  // count-off taps / after the end: not scored
      var best = -1, bd = Infinity;
      for (var i = 0; i < n; i++) {
        if (taken[i]) continue;
        var d = Math.abs(t - onsetsMs[i]);
        if (d <= win[i].good && d < bd) { bd = d; best = i; }
      }
      if (best < 0) { res.extra++; return; }
      taken[best] = true; res.offs.push(Math.round(t - onsetsMs[best]));
      res.notes[best] = bd <= win[best].perfect ? 2 : 1;               // 2.11.0: per note, for the class problem-spot map
      if (bd <= win[best].perfect) res.perfect++; else res.good++;
    });
    res.miss = n - res.perfect - res.good;
    var pts = 100 * res.perfect + 60 * res.good - 25 * res.extra;
    res.pct = n ? Math.max(0, Math.min(100, Math.round(pts / n))) : 0;
    return res;
  }
  // The device's own delay: median of (tap − nearest click) for count-off taps. null when there aren't 2 good taps.
  function rtapCalibrate(clicksMs, tapsMs, spb) {
    var ds = [];
    tapsMs.forEach(function (t) {
      var best = null;
      clicksMs.forEach(function (c) { if (best === null || Math.abs(t - c) < Math.abs(best)) best = t - c; });
      if (best !== null && Math.abs(best) <= Math.min(300, spb * 0.45)) ds.push(best);
    });
    if (ds.length < 2) return null;
    ds.sort(function (a, b) { return a - b; });
    var m = ds.length >> 1;
    return Math.round(ds.length % 2 ? ds[m] : (ds[m - 1] + ds[m]) / 2);
  }
  // 2.9.1 (Mat 11/13: a perfect performance scored 47%): a device's delay isn't always measured right by the count-off (or the
  // count-off wasn't tapped), and a steady 80–150 ms lag turns every Perfect into Good and every sixteenth into a Miss + extra tap.
  // So the score also tries every steady shift around `center` (the count-off measurement, or 0) up to ± range ms and keeps the best:
  // a steady lag (device, Bluetooth, network clock) is forgiven, uneven taps are not. range stays under half a beat so the taps can't
  // be slid onto the wrong notes.
  function rtapScoreAligned(onsetsMs, tapsMs, center, range) {
    center = center || 0;
    var best = null;
    for (var s = -range; s <= range; s += 5) {
      var sh = center + s, r = rtapScore(onsetsMs, tapsMs.map(function (t) { return t - sh; }));
      r.err = r.offs.reduce(function (t, o) { return t + Math.abs(o); }, 0);       // ties: the shift that centers the taps best
      if (!best || r.pct > best.pct || (r.pct === best.pct && (r.perfect > best.perfect ||
          (r.perfect === best.perfect && r.err < best.err)))) { best = r; best.shift = sh; }
    }
    return best;
  }
  window.RTAP = { score: rtapScore, scoreAligned: rtapScoreAligned, calibrate: rtapCalibrate, PREFIX: "ravenband-rtap-v1-" };

  var B = window.__board, NET = window.PTNET;
  if (!B || !NET || !document.getElementById("rhythm")) return;     // tap.html loads this file for the scoring only

  var CODE_KEY = "agendaBoard.rtapCode";       // { date, code }
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function load(k) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function save(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function today() { return B.ymd(B.now()); }

  // ---------------------------------------------------------------- card in the rhythm view
  var css = [
    /* top-right, beside the title and above the rhythm (which starts ~31vh down), so nothing on the view is covered */
    "#rtCard { position: absolute; right: 1.6vw; top: 1.6vh; width: 22vw; z-index: 4; display: none; background: #2a3858; transform-origin: top right;",
    "  border: 2px solid #c9a227; border-radius: 2vh; padding: 1.4vh 1.2vw; box-sizing: border-box; cursor: default; color: #fff; font-family: 'Segoe UI', Roboto, Arial, sans-serif;",
    "  box-shadow: 0 1vh 4vh rgba(0,0,0,.45); }",
    "#rtCard.open { display: block; }",
    "#rtCard h3 { margin: 0 0 .8vh; font: 600 2.7vh 'Oswald', 'Arial Narrow', Arial, sans-serif; color: #c9a227; letter-spacing: .05em; display: flex; align-items: center; gap: .5vw; white-space: nowrap; }",
    "#rtCard h3 span { margin-right: auto; }",
    "#rtCard button { cursor: pointer; border: 1px solid #c9a227; background: #141c30; color: #c9a227; border-radius: 999px; padding: .6vh 1vw;",
    "  font: 600 1.9vh 'Oswald', 'Arial Narrow', Arial, sans-serif; letter-spacing: .04em; }",
    "#rtCard .rt-join { display: flex; gap: 1vw; align-items: center; }",
    "#rtCard .rt-qr { width: 13vh; height: 13vh; background: #fff; border-radius: 1vh; flex: none; }",
    "#rtCard .rt-qr svg { width: 100%; height: 100%; display: block; }",
    "#rtCard .rt-code { font: 600 5.6vh/1 'Oswald', 'Arial Narrow', Arial, sans-serif; color: #fff; letter-spacing: .12em; }",
    "#rtCard .rt-url { font-size: 1.7vh; color: #c9d0de; word-break: break-all; margin-top: .6vh; }",
    "#rtCard .rt-n { margin-top: .9vh; font: 600 2.3vh 'Oswald', 'Arial Narrow', Arial, sans-serif; color: #dfe4ee; }",
    "#rtCard .rt-n.err { color: #ff9a8a; font-family: 'Segoe UI', Arial, sans-serif; font-size: 1.8vh; font-weight: 400; }",
    "#rtCard ol { margin: .4vh 0 0; padding: 0; list-style: none; }",
    "#rtCard li { display: flex; align-items: baseline; gap: .8vw; font: 600 2.6vh/1.3 'Oswald', 'Arial Narrow', Arial, sans-serif; }",
    "#rtCard li i { font-style: normal; color: #c9a227; width: 2.2vh; }",
    "#rtCard li b { margin-left: auto; color: #c9a227; font-weight: 600; }",
    "#rtCard .rt-avg { margin-top: .6vh; padding-top: .6vh; border-top: 1px solid #34405e; font: 600 2.4vh 'Oswald', 'Arial Narrow', Arial, sans-serif; color: #dfe4ee; }",
    "#rtCard .rt-avg b { color: #c9a227; font-weight: 600; }",
    "#rtCard .rt-wait { font-size: 2vh; color: #c9d0de; }",
    "#rtCard.mini { width: auto; padding: .8vh 1.2vw; }",
    "#rtCard .rt-mini { font: 600 2.4vh 'Oswald', 'Arial Narrow', Arial, sans-serif; color: #dfe4ee; white-space: nowrap; }",
    "#rtCard .rt-mini b { color: #c9a227; letter-spacing: .08em; }",
    /* 2.12.0: the big leaderboard for the whole room, 5 s after each round */
    "#rtBig { position: fixed; inset: 0; z-index: 36; display: none; align-items: center; justify-content: center; background: rgba(12,17,30,.82);",
    "  cursor: pointer; opacity: 0; transition: opacity .35s; }",
    "#rtBig.open { display: flex; } #rtBig.show { opacity: 1; }",
    "#rtBig .b-card { width: 64vw; background: #2a3858; border: .5vh solid #c9a227; border-radius: 4vh; padding: 4vh 4vw; box-sizing: border-box;",
    "  box-shadow: 0 2vh 8vh rgba(0,0,0,.5); color: #fff; transform: scale(.94); transition: transform .35s; }",
    "#rtBig.show .b-card { transform: scale(1); }",
    "#rtBig h2 { margin: 0 0 2vh; text-align: center; font: 600 9vh/1 'Oswald', 'Arial Narrow', Arial, sans-serif; color: #c9a227; letter-spacing: .04em; }",
    "#rtBig ol { list-style: none; margin: 0; padding: 0; }",
    "#rtBig li { display: flex; align-items: baseline; gap: 2.4vw; font: 600 7.4vh/1.35 'Oswald', 'Arial Narrow', Arial, sans-serif; }",
    "#rtBig li i { font-style: normal; color: #c9a227; width: 5vh; text-align: right; }",
    "#rtBig li b { margin-left: auto; color: #c9a227; font-weight: 600; font-variant-numeric: tabular-nums; }",
    "#rtBig li small.ms, #rtCard li small.ms { font-size: .45em; color: #c9d0de; font-weight: 400; font-family: 'Segoe UI', Arial, sans-serif; }",
    "#rtBig li:first-child { color: #ffe08a; }",
    "#rtBig .b-avg { margin-top: 2.4vh; padding-top: 2vh; border-top: 2px solid #34405e; text-align: center; font: 600 4.6vh 'Oswald', 'Arial Narrow', Arial, sans-serif; color: #dfe4ee; }",
    "#rtBig .b-avg b { color: #c9a227; font-weight: 600; }",
    "#rtBig .b-wait { text-align: center; font: 4vh 'Segoe UI', Arial, sans-serif; color: #c9d0de; }",
    "#rhythm .m-tap { display: none; border: 1px solid #c9a227; border-radius: 999px; padding: 1.4vh 2vw; background: #141c30; color: #c9a227; cursor: pointer;",
    "  font: 600 2.8vh 'Oswald', 'Arial Narrow', Arial, sans-serif; letter-spacing: .04em; }",
    "#rhythm.has-counts .m-tap { display: block; }",
    "#rhythm .m-tap.on { background: #c9a227; color: #141c30; }"
  ].join("\n");
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  var card = document.createElement("div");
  card.id = "rtCard"; card.setAttribute("aria-live", "polite");
  $("rhythm").appendChild(card);
  card.addEventListener("click", function (e) { e.stopPropagation(); });
  var btn = document.createElement("button");
  btn.className = "m-tap"; btn.id = "mTap"; btn.textContent = "📱 Tap along";
  var row = document.querySelector("#metro .m-row");
  if (row) row.appendChild(btn);

  // ---------------------------------------------------------------- host
  var on = false, peer = null, conns = [], code = null, status = "off", err = "", retries = 0, restartT = null;
  var block = null, roster = [];               // [{id, n}] for the block in the rhythm view
  var round = null, results = {}, lastRound = null, showResultsT = null, view = "join";

  function getCode() {
    var c = load(CODE_KEY);
    if (c && c.date === today() && c.code) return c.code;
    var n = NET.newCode(); save(CODE_KEY, { date: today(), code: n }); return n;
  }
  function tapUrl() {
    return location.origin + location.pathname.replace(/[^/]*$/, "") + "tap.html?c=" + code + (NET.FAKE ? "&peerfake=1" : "");
  }
  function shownBlock() { var s = B.shown(); return s.key && s.key !== "welcome" ? s.key : null; }
  function loadRoster() {
    var b = shownBlock(); if (!b) return;
    if (b !== block) {                         // another class: everyone picks their name again from the new list
      block = b; roster = []; results = {}; lastRound = null; view = "join";
      conns.forEach(function (c) { c.sid = null; });
    }
    var cached = load("agendaBoard.ptRoster") || {};
    if (cached[b] && cached[b].students && !roster.length) roster = cached[b].students;
    if (!B.settings().closingUrl) return;
    B.call({ a: "ptest", block: b }).then(function (j) {
      if (block !== b) return;
      roster = (j.students || []).map(function (s) { return { id: s.id, n: s.n }; });
      conns.forEach(function (c) { if (c.hi) send(c, rosterMsg()); });
      paint();
    }).catch(function () {});
  }
  function rosterMsg() { return { type: "roster", block: block, students: roster }; }

  function start() {
    if (peer) return;
    code = getCode(); status = "wait"; paint();
    NET.ready(function (ok) {
      if (!ok) { status = "err"; err = "The connection library didn't load."; paint(); return; }
      if (peer || !on) return;
      var p;
      try { p = peer = NET.makePeer(window.RTAP.PREFIX + code); } catch (e) { status = "err"; err = String(e.message || e); paint(); return; }
      p.on("open", function () { if (p !== peer) return; status = "ready"; retries = 0; paint(); });
      p.on("connection", function (c) {
        c.on("open", function () { conns.push(c); paint(); });
        c.on("data", function (d) { try { onData(c, d); } catch (e) { console.error(e); } });
        c.on("close", function () { conns = conns.filter(function (x) { return x !== c; }); paint(); });
        c.on("error", function () {});
      });
      p.on("disconnected", function () {
        if (p !== peer) return;
        status = "wait"; paint();
        setTimeout(function () { try { if (p === peer && !p.destroyed && p.disconnected) p.reconnect(); } catch (e) {} }, 2000);
      });
      p.on("error", function (e) {
        if (p !== peer) return;
        var t = e && e.type;
        if (t === "unavailable-id") { retries++; if (retries > 4) { save(CODE_KEY, null); retries = 0; } restart(3000); return; }
        if (["network", "server-error", "socket-error", "socket-closed", "browser-incompatible", "ssl-unavailable"].indexOf(t) >= 0) {
          status = "err"; err = "Can't reach the connection service (the school network may block it). Retrying…"; paint(); restart(8000);
        }
      });
    });
    NET.qrReady(function () { paint(); });
  }
  function restart(ms) {
    clearTimeout(restartT);
    restartT = setTimeout(function () {
      conns.forEach(function (c) { try { c.close(); } catch (e) {} }); conns = [];
      if (peer) { var p = peer; peer = null; try { p.destroy(); } catch (e) {} }
      if (on) start();
    }, ms);
  }
  function stopHost() {
    clearTimeout(restartT);
    conns.forEach(function (c) { try { c.close(); } catch (e) {} }); conns = [];
    if (peer) { var p = peer; peer = null; try { p.destroy(); } catch (e) {} }
    status = "off";
  }
  function send(c, m) { try { if (c.open) c.send(m); } catch (e) {} }
  function players() { return conns.filter(function (c) { return c.sid; }); }

  function onData(c, d) {
    if (!d || typeof d !== "object") return;
    if (d.type === "ping") { send(c, { type: "pong", c: d.c, b: performance.now() }); return; }
    if (d.type === "hello") { c.hi = true; send(c, rosterMsg()); if (round && performance.now() < round.endsAt) send(c, roundMsg()); return; }
    if (d.type === "join") {
      var s = roster.filter(function (x) { return x.id === d.id; })[0];
      if (!s) { send(c, { type: "nojoin" }); return; }
      c.sid = s.id; c.sn = s.n;
      send(c, { type: "joined", id: s.id, n: s.n }); paint(); return;
    }
    if (d.type === "leave") { c.sid = null; paint(); return; }
    if (d.type === "result" && c.sid && round && d.round === round.id) {
      results[c.sid] = { n: c.sn, pct: Math.max(0, Math.min(100, Math.round(+d.pct || 0))), p: +d.p || 0, g: +d.g || 0, m: +d.m || 0, x: +d.x || 0,
        h: Array.isArray(d.h) && d.h.length === round.onsets.length ? d.h.map(function (v) { return +v > 0 ? 1 : 0; }) : null,
        a: d.a != null && isFinite(+d.a) ? Math.max(0, Math.round(+d.a)) : null };      // 2.12.2: average ms off the beat (tie-break)
      heatSend(); paint();
    }
  }

  // ---------------------------------------------------------------- rounds (index.html metroStart / metroStop)
  // r = { t0: performance.now() ms of the first count-off click, spb: ms per click, off: count-off clicks, tl: rhythmtime timeline }
  function roundMsg() {
    return { type: "round", id: round.id, t0: round.t0, spb: round.spb, off: round.off, onsets: round.onsets, length: round.length };
  }
  window.rtapStart = function (r) {
    if (!on || !r || !r.tl) return;
    round = { id: Date.now().toString(36), t0: r.t0, spb: r.spb, off: r.off, onsets: r.tl.onsets, length: r.tl.length, name: r.name || "" };
    if (window.rhythmHeat) window.rhythmHeat(null);
    bigHide();
    round.endsAt = r.t0 + (r.off + r.tl.length) * r.spb;
    results = {}; lastRound = round.id; view = "round";
    conns.forEach(function (c) { if (c.hi) send(c, roundMsg()); });
    clearTimeout(showResultsT);
    showResultsT = setTimeout(function () { if (round && lastRound === round.id) { view = "results"; paint(); bigShow(round.id); } },
      Math.max(0, round.endsAt - performance.now()) + 1500);
    paint();
  };
  // 2.11.0 (Mat 11/13): problem spots. For each note, the share of students who hit it (Perfect or Good) → index.html colors
  // that note's count under the rhythm (green / yellow / red). Only results that carry per-note hits count.
  function heatSend() {
    if (!window.rhythmHeat || !round) return;
    var rs = Object.keys(results).map(function (k) { return results[k].h; }).filter(Boolean);
    if (!rs.length) { window.rhythmHeat(null); return; }
    window.rhythmHeat({ name: round.name, n: rs.length, hit: round.onsets.map(function (_, i) {
      return rs.reduce(function (s, h) { return s + h[i]; }, 0) / rs.length; }) });
  }
  window.rtapStop = function () {
    if (!round) return;
    if (performance.now() < round.endsAt) {               // stopped before the end: the round doesn't count
      conns.forEach(function (c) { if (c.hi) send(c, { type: "stop", id: round.id }); });
      clearTimeout(showResultsT); round = null; view = "join"; paint();
    }
  };

  // ---------------------------------------------------------------- drawing
  // ---------- 2.12.0 (Mat 11/13): big leaderboard ----------
  // When a round's scores come in, the Top 5 + class average fill the middle of the screen for BIG_MS (tap to close sooner),
  // then the small card is back in its corner. Waits up to 3 s for the first score. Skipped while the next speed-ladder pass
  // is already playing (it would cover the rhythm): that pass gets its own.
  var BIG_MS = 5000, big = document.createElement("div"), bigT = null, bigFor = null;
  big.id = "rtBig"; big.setAttribute("role", "dialog"); big.setAttribute("aria-label", "Tap along leaderboard");
  document.body.appendChild(big);
  // 2.12.2 (Mat 11/13): ranking. Percent, then Perfect count, then closest to the beat (average ms off, smaller wins; a device
  // that didn't send it goes after). Exactly equal on all three = the same place, and the next place skips (1, 1, 3).
  function rankCmp(a, b) {
    return b.pct - a.pct || b.p - a.p || (a.a == null ? 1e9 : a.a) - (b.a == null ? 1e9 : b.a);
  }
  function ranked() {
    var list = Object.keys(results).map(function (k) { return results[k]; }).sort(rankCmp);
    list.forEach(function (r, i) { r.rank = i && rankCmp(list[i - 1], r) === 0 ? list[i - 1].rank : i + 1; });
    return list;
  }
  // "±12 ms" next to a percent only where it decided something: someone else has the same percent
  function msTag(r) {
    var tie = r.a != null && Object.keys(results).some(function (k) { var o = results[k]; return o !== r && o.pct === r.pct; });
    return tie ? ' <small class="ms">±' + r.a + " ms</small>" : "";
  }
  function bigList() {
    return ranked();
  }
  function bigPaint() {
    var list = bigList(), avg = list.length ? Math.round(list.reduce(function (s, r) { return s + r.pct; }, 0) / list.length) : 0;
    big.innerHTML = '<div class="b-card"><h2>🏆 Top 5</h2>' + (list.length ? "<ol>" + list.slice(0, 5).map(function (r, i) {
      return "<li><i>" + r.rank + "</i>" + esc(r.n) + "<b>" + r.pct + "%" + msTag(r) + "</b></li>"; }).join("") + "</ol>" +
      '<div class="b-avg">Class average <b>' + avg + "%</b> · " + list.length + " scored</div>" : '<div class="b-wait">Waiting for scores…</div>') + "</div>";
  }
  function bigShow(id, tries) {
    tries = tries || 0;
    if (!on || lastRound !== id || !$("rhythm").classList.contains("open")) return;
    if (window.rhythmBusy && window.rhythmBusy()) return;
    if (!Object.keys(results).length && tries < 10) { setTimeout(function () { bigShow(id, tries + 1); }, 300); return; }
    bigFor = id; bigPaint(); big.classList.add("open");
    requestAnimationFrame(function () { big.classList.add("show"); });
    clearTimeout(bigT); bigT = setTimeout(bigHide, BIG_MS);
  }
  function bigHide() {
    clearTimeout(bigT); bigFor = null;
    big.classList.remove("show");
    setTimeout(function () { if (!big.classList.contains("show")) big.classList.remove("open"); }, 360);
  }
  big.addEventListener("click", function (e) { e.stopPropagation(); bigHide(); });
  function paint() {
    if (bigFor && bigFor === lastRound && big.classList.contains("open")) bigPaint();     // late scores join the big board too
    if (!on && bigFor) bigHide();
    btn.classList.toggle("on", on);
    btn.textContent = on ? "📱 Tap along: on" : "📱 Tap along";
    card.classList.toggle("open", on);
    if (!on) return;
    var n = players().length;
    var res = view === "results" || (view === "round" && Object.keys(results).length);
    // 2.9.2 (Mat 11/13): while the rhythm plays the card shrinks to one line so it never covers the last measure
    card.classList.toggle("mini", view === "round" && !res);
    if (view === "round" && !res) {
      card.innerHTML = '<div class="rt-mini">📱 ' + n + " tapping · code <b>" + esc(code || "") + "</b></div>";
      fit(); return;
    }
    var head = '<h3><span>' + (res ? "🏆 Top 5" : "📱 Tap along") + "</span>" + (res ? '<button id="rtShowQr">QR</button>' : "") +
      '<button id="rtOff">Turn off</button></h3>';
    if (res) {
      var list = ranked();
      var avg = list.length ? Math.round(list.reduce(function (s, r) { return s + r.pct; }, 0) / list.length) : 0;
      card.innerHTML = head + "<ol>" +
        list.slice(0, 5).map(function (r) { return "<li><i>" + r.rank + "</i>" + esc(r.n) + "<b>" + r.pct + "%" + msTag(r) + "</b></li>"; }).join("") +
        (list.length ? "" : '<li class="rt-wait">Waiting for scores…</li>') + "</ol>" +
        '<div class="rt-avg">Class average <b>' + (list.length ? avg + "%" : "–") + "</b> · " + list.length + " of " + n + " scored</div>" +
        (list.some(function (r) { return r.h; }) ? '<div class="rt-wait" style="margin-top:.5vh">Problem spots: colored counts under the rhythm</div>' : "");
    } else {
      var qr = window.qrcode && code ? NET.qrSvg(tapUrl()) : "";
      card.innerHTML = head + '<div class="rt-join"><div class="rt-qr">' + qr + '</div><div><div class="rt-wait">Scan, or open the tap page and type</div>' +
        '<div class="rt-code">' + esc(code || "…") + '</div><div class="rt-url">' + esc(tapUrl().replace(/^https?:\/\//, "").replace(/\?.*$/, "")) + "</div></div></div>" +
        (status === "err" ? '<div class="rt-n err">' + esc(err) + "</div>" :
          '<div class="rt-n">' + (status === "ready" ? n + (n === 1 ? " student" : " students") + " ready" +
            (view === "round" ? " · tapping now!" : " · press ▶ Count off") : "Connecting…") + "</div>");
    }
    fit();
    var off = $("rtOff"); if (off) off.onclick = function () { on = false; stopHost(); if (window.rhythmHeat) window.rhythmHeat(null); bigHide(); paint(); };
    var q = $("rtShowQr"); if (q) q.onclick = function () { view = "join"; paint(); };
  }
  // never over the rhythm: if the card is taller than the space above it (a taller screen puts the rhythm higher), shrink it
  function fit() {
    card.style.transform = "";
    var v = $("rView"); if (!v || !card.classList.contains("open")) return;
    var avail = v.getBoundingClientRect().top - card.getBoundingClientRect().top - 8, h = card.offsetHeight;
    if (avail > 0 && h > avail) card.style.transform = "scale(" + Math.max(0.45, avail / h).toFixed(3) + ")";
  }
  window.addEventListener("resize", function () { if (on) fit(); });
  btn.onclick = function (e) {
    e.stopPropagation();
    on = !on;
    if (on) { view = lastRound && Object.keys(results).length ? "results" : "join"; loadRoster(); start(); }
    else stopHost();
    paint();
  };
  // the rhythm view opening for another block brings that class's names
  var rv = $("rhythm");
  if (window.MutationObserver) new MutationObserver(function () { if (on && rv.classList.contains("open") && shownBlock() !== block) loadRoster(); })
    .observe(rv, { attributes: true, attributeFilter: ["class"] });
  setInterval(function () { if (on && view === "join") paint(); }, 5000);

  window.__rtap = { rank: function (rs) { var keep = results; results = rs; var l = ranked().map(function (r) { return [r.n, r.rank, msTag(r)]; }); results = keep; return l; },
    state: function () {
    return { on: on, status: status, code: code, block: block, roster: roster.length, players: players().map(function (c) { return c.sn; }),
      view: view, round: round ? round.id : null, results: results, big: big.classList.contains("show") };
  } };
})();
