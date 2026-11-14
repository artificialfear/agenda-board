// 2.17.0: the two-part rhythm pool (rhythm-duos.json + rhythm-duos/). Run: node tests/rhythm_duos_test.js
const a = require('assert'), fs = require('fs'), path = require('path');
const RT = require('../rhythmtime.js');
const ROOT = path.join(__dirname, '..');
const book = JSON.parse(fs.readFileSync(path.join(ROOT, 'rhythm-duos.json')));
const kinds = {};
let maxDx = 0;
Object.entries(book.lines).forEach(([name, l]) => {
  const m = name.match(/^duo_(6beg|6int|7th|8th)_(\d)-(\d)_\d{3}$/);
  a.ok(m, name);
  a.equal(l.m, m[2] + '/' + m[3], name + ' meter');
  kinds[m[1] + ' ' + l.m] = (kinds[m[1] + ' ' + l.m] || 0) + 1;
  a.equal(l.p.length, 2, name);
  [1, 2].forEach(k => {                                         // both pictures are there and are the ones these counts were made with
    const f = path.join(ROOT, 'rhythm-duos', name + '_' + k + '.png');
    a.ok(fs.existsSync(f), f);
    a.equal(fs.statSync(f).size, l.b[k - 1], name + ' bytes ' + k);
  });
  const t1 = RT.rhythmTimeline(l.p[0], l.m), t2 = RT.rhythmTimeline(l.p[1], l.m);
  a.ok(t1 && t2, name);
  a.equal(t1.length, t2.length, name + ' same length');
  a.equal(t1.length / t1.beats, 4, name + ' 4 measures');
  a.notDeepEqual(t1.onsets, t2.onsets, name + ' parts differ');
  // the same moment sits at the same x in both pictures (laid out together)
  // (only notes and rests: held beats are spread out by guess under a long note)
  const real = p => p.kind === 'n' || p.kind === 'r';
  const at2 = new Map(t2.points.filter(real).map(p => [p.t, p.x]));
  t1.points.filter(real).forEach(p => { if (at2.has(p.t)) { const dx = Math.abs(at2.get(p.t) - p.x); maxDx = Math.max(maxDx, dx); a.ok(dx < 0.012, name + ' t=' + p.t + ' dx=' + dx); } });
  // never silent together: at every sixteenth, at least one part is on a note (or holding one), not a rest
  const restAt = (tl, t) => { const i = RT.countAt(tl, t); return i >= 0 && /^h?r$/.test(tl.points[i].kind); };
  for (let t = 0; t < t1.length; t += t1.beats === 6 ? 0.5 : 0.25) a.ok(!(restAt(t1, t) && restAt(t2, t)), name + ' both rest at ' + t);
  // one merged timeline covers the whole line, in order (the moving line for both parts)
  const both = RT.mergeTimelines(t1, t2);
  both.points.forEach((p, i) => { if (i) a.ok(p.x >= both.points[i - 1].x && p.t > both.points[i - 1].t, name + ' merged ' + i); });
  for (let t = 0; t < t1.length; t += 0.25) a.ok(RT.xAt(both, t) !== null, name);
});
a.deepEqual(Object.keys(kinds).sort(), ['6beg 2/4', '6beg 3/4', '6beg 4/4', '6int 2/4', '6int 3/4', '6int 4/4', '7th 2/4', '7th 3/4', '7th 4/4',
  '8th 2/4', '8th 3/4', '8th 4/4', '8th 6/8']);
Object.entries(kinds).forEach(([k, n]) => a.equal(n, 24, k));
// mergeTimelines on its own
const C = labs => labs.map((l, i) => [0.1 + i * 0.1, l, 'n']);
const A = RT.rhythmTimeline(C(['1', '3', '1', '3']), '4/4'), B = RT.rhythmTimeline(C(['1', '2', '3', '4', '1', '2', '3', '4']), '4/4');
const M = RT.mergeTimelines(A, B);
a.deepEqual(M.points.map(p => p.t), [0, 1, 2, 3, 4, 5, 6, 7]);
a.equal(RT.mergeTimelines(A, null), A);
console.log('rhythm duos: ok (' + Object.keys(book.lines).length + ' pairs, largest x gap ' + maxDx.toFixed(4) + ')');
