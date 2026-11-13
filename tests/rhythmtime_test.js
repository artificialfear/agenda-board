// 2.7.0 rhythmtime.js: counts → timeline in metronome clicks (moving line + future tap scoring). Made-up count lists + the real file.
const a = require('assert'), fs = require('fs'), path = require('path');
const RT = require('../rhythmtime');
const C = (labs) => labs.map((l, i) => [0.1 + i * 0.03, l.replace('~', ''), l.endsWith('~') ? 'h' : /\(/.test(l) ? 'r' : 'n']);
// 4/4: 1 2~ 3 + 4 e + | 1 2 (3) 4
let tl = RT.rhythmTimeline(C(['1', '2~', '3', '+', '4', 'e', '+', '1', '2', '(3)', '4']), '4/4');
a.deepEqual(tl.points.map(p => p.t), [0, 1, 2, 2.5, 3, 3.25, 3.5, 4, 5, 6, 7]);
a.equal(tl.beats, 4); a.equal(tl.length, 8);
a.deepEqual(tl.onsets, [0, 2, 2.5, 3, 3.25, 3.5, 4, 5, 7]);            // held beats and rests aren't attacks
// x moves forward between counts, null outside the line, ends past the last count
a.equal(RT.xAt(tl, 0), 0.1); a.ok(Math.abs(RT.xAt(tl, 2.25) - (0.16 + 0.015)) < 1e-9);
a.equal(RT.xAt(tl, -0.1), null); a.equal(RT.xAt(tl, 8.01), null);
a.ok(RT.xAt(tl, 7.9) > tl.points[10].x && tl.end <= 0.995);
for (let t = 0, last = 0; t <= 8; t += 0.05) { const x = RT.xAt(tl, t); a.ok(x >= last - 1e-12, 't=' + t); last = x; }
a.equal(RT.countAt(tl, 2.6), 3); a.equal(RT.countAt(tl, 3.25), 5); a.equal(RT.countAt(tl, -1), -1);
// a whole note measure (1 2~ 3~ 4~) then a measure starting with a rest
tl = RT.rhythmTimeline(C(['1', '2~', '3~', '4~', '(1)', '2', '3', '4']), '4/4');
a.deepEqual(tl.points.map(p => p.t), [0, 1, 2, 3, 4, 5, 6, 7]); a.deepEqual(tl.onsets, [0, 5, 6, 7]);
// 6/8: clicks are eighths, + between
tl = RT.rhythmTimeline(C(['1', '+', '2', '3', '(4)', '(5)~', '(6)~', '1', '2~', '3~', '4', '5', '6']), '6/8');
a.equal(tl.beats, 6); a.equal(tl.length, 12);
a.deepEqual(tl.points.map(p => p.t), [0, 0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
// 2/4 repeated "1" and "1" (one note per measure) are new measures
tl = RT.rhythmTimeline(C(['1', '2~', '1', '2~', '1', '(2)']), '2/4');
a.deepEqual(tl.points.map(p => p.t), [0, 1, 2, 3, 4, 5]); a.equal(tl.length, 6);
a.equal(RT.rhythmTimeline([], '4/4'), null);
// every real line: 4 measures (simple meters) / 4 measures 6/8, times in order, x in order
const book = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'rhythm-counts.json')));
let n = 0;
Object.entries(book.lines).forEach(([name, l]) => {
  const t = RT.rhythmTimeline(l.c, l.m);
  a.ok(t && t.onsets.length > 0, name);
  a.equal(t.length % t.beats, 0, name);
  a.ok(t.length / t.beats >= 2 && t.length / t.beats <= 8, name + ' measures ' + t.length / t.beats);
  t.points.forEach((p, i) => { if (i) { a.ok(p.t > t.points[i - 1].t, name + ' t ' + i); a.ok(p.x >= t.points[i - 1].x, name + ' x ' + i); } });
  a.ok(t.end >= t.points[t.points.length - 1].x, name);
  n++;
});
a.equal(n, 780);
console.log('rhythmtime: ok (' + n + ' real lines)');
