/* Rhythm of the day: turns a line's counts (rhythm-counts.json: [x, label, kind]) into a timeline in metronome clicks.
   2.7.0 (Mat 11/13). Simple meters: 1 e + a (a click = a quarter); 6/8: 1–6 with + between (a click = an eighth).
   rhythmTimeline(counts, meter) → { beats: clicks per measure, length: clicks in the whole line,
     points: [{ x, t, kind, label }] (t = clicks after the first downbeat; every count, in order),
     onsets: [t, …] (note attacks only: kind 'n'), end: x where the line's last measure ends }
   xAt(tl, t) → x for any t (straight line between counts; null before 0 or after the end).
   Used by index.html (the moving line after the count-off) and later by student tapping. Works in Node too (tests). */
(function (root) {
  "use strict";
  var SUB = { e: 0.25, "+": 0.5, a: 0.75 };
  function beatsOf(meter) {
    var m = String(meter || "4/4").split("/"), n = +m[0] || 4;
    return n;                                   // 6/8 → 6 clicks (eighths), 3/4 → 3, …
  }
  function rhythmTimeline(counts, meter) {
    var N = beatsOf(meter), pts = [], measure = -1, beat = 0, lastPos = Infinity;
    (counts || []).forEach(function (c) {
      var lab = String(c[1]).replace(/[()]/g, ""), pos;
      if (/^\d$/.test(lab)) { beat = +lab - 1; pos = beat; }
      else if (SUB[lab] != null) pos = beat + SUB[lab];
      else return;
      if (pos <= lastPos) measure++;            // back to (or below) where we were = a new measure
      lastPos = pos;
      pts.push({ x: +c[0], t: measure * N + pos, kind: c[2], label: c[1] });
    });
    if (!pts.length) return null;
    var length = (measure + 1) * N, first = pts[0], last = pts[pts.length - 1];
    var perClick = last.t > first.t ? (last.x - first.x) / (last.t - first.t) : 0.05;
    var end = Math.min(0.995, last.x + (length - last.t) * perClick * 0.9);
    return {
      beats: N, length: length, points: pts, end: end,
      onsets: pts.filter(function (p) { return p.kind === "n"; }).map(function (p) { return p.t; })
    };
  }
  function xAt(tl, t) {
    if (!tl || t < 0 || t > tl.length) return null;
    var p = tl.points, i = 0;
    if (t <= p[0].t) return p[0].x;
    while (i + 1 < p.length && p[i + 1].t <= t) i++;
    var a = p[i], b = i + 1 < p.length ? p[i + 1] : { x: tl.end, t: tl.length };
    return b.t > a.t ? a.x + (b.x - a.x) * (t - a.t) / (b.t - a.t) : a.x;
  }
  // which count is "now" (index of the last count at or before t)
  function countAt(tl, t) {
    if (!tl || t < 0 || t > tl.length) return -1;
    var i = -1; while (i + 1 < tl.points.length && tl.points[i + 1].t <= t + 1e-9) i++;
    return i;
  }
  // 2.17.0: two-part rhythms are drawn so the same moment has the same x in both pictures. One timeline from both parts' counts
  // (same t → x averaged) gives one line position for both, even between notes where each part alone would guess differently.
  function mergeTimelines(a, b) {
    if (!a || !b) return a || b || null;
    var all = a.points.concat(b.points).slice().sort(function (p, q) { return p.t - q.t; }), pts = [];
    all.forEach(function (p) {
      var last = pts[pts.length - 1];
      if (last && Math.abs(last.t - p.t) < 1e-9) { last.x = (last.x * last.k + p.x) / (last.k + 1); last.k++; }
      else pts.push({ x: p.x, t: p.t, kind: p.kind, label: p.label, k: 1 });
    });
    for (var i = 1; i < pts.length; i++) if (pts[i].x < pts[i - 1].x) pts[i].x = pts[i - 1].x;     // never backwards
    return { beats: a.beats, length: Math.max(a.length, b.length), points: pts, end: Math.max(a.end, b.end), onsets: [] };
  }
  var api = { rhythmTimeline: rhythmTimeline, xAt: xAt, countAt: countAt, beatsOf: beatsOf, mergeTimelines: mergeTimelines };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RhythmTime = api;
})(this);
