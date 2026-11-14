// Two-part rhythms (2.17.0, Mat 11/14): for each ensemble + meter, PER_KIND pairs of 4-measure lines that fit together
// (half the class on Part 1, half on Part 2). Same note values per level as the Daily Rhythm pool (gen.js tiers).
//   node gen-duo.js out-duo     → out-duo/duo_<ens>_<meter>_<nnn>_1.png / _2.png + out-duo/rhythm-duos.json
// Copy the PNGs to the site's rhythm-duos/ folder and rhythm-duos.json to the site root. Seeded, so a run is repeatable.
// A pair is used only when:
//   - both parts are good lines on their own (gen.js makeLine: the level's new values, line ends on a held note, fits)
//   - they're never silent together (no spot where both parts rest)
//   - no measure is the same in both parts, and at least 3 measures have a note in one part only
//   - at least 35% of all the attacks belong to one part only (the parts really interlock instead of doubling)
//   - both fit on the page when spaced together (render.js fitsDuo)
const fs = require('fs');
const path = require('path');
const G = require('./gen');
const { renderDuo, fitsDuo } = require('./render');
const { countLine } = require('./counts');

const PER_KIND = Number(process.env.PER_KIND || 24);
const OUT = process.argv[2] || 'out-duo';
G.setSeed(20261114);
const LEN = { w: 16, hd: 12, h: 8, qd: 6, q: 4, '8': 2, '16': 1 };

function events(cells, lib) {           // one measure → [{ s, e, r }] in sixteenths
  const out = []; let s = 0;
  cells.forEach(k => lib[k].notes.forEach(n => { const e = s + LEN[n.d]; out.push({ s, e, r: n.r }); s = e; }));
  return out;
}
// how well two lines fit together: null = not allowed, else the share of attacks that belong to one part only
function pairScore(a, b, meter, lib) {
  const L = G.measureLen(meter);
  let uniqMeasures = 0, all = 0, shared = 0;
  for (let i = 0; i < 4; i++) {
    if (a[i].join() === b[i].join()) return null;
    const ea = events(a[i], lib), eb = events(b[i], lib);
    for (let t = 0; t < L; t++) {
      const ra = ea.find(x => x.s <= t && t < x.e).r, rb = eb.find(x => x.s <= t && t < x.e).r;
      if (ra && rb) return null;                                      // both silent
    }
    const sa = new Set(ea.filter(x => !x.r).map(x => x.s)), sb = new Set(eb.filter(x => !x.r).map(x => x.s));
    const u = new Set([...sa, ...sb]);
    const both = [...sa].filter(x => sb.has(x)).length;
    all += u.size; shared += both;
    if (u.size > both) uniqMeasures++;
  }
  const sc = (all - shared) / all;
  return uniqMeasures >= 3 && sc >= 0.35 ? sc : null;
}
const POOL = Number(process.env.POOL || 220);

fs.mkdirSync(OUT, { recursive: true });
const book = {};
const ONLY = process.env.ONLY || '';          // e.g. ONLY=8th:4/4 to try one kind
for (const [ens, meters] of Object.entries(G.ENSEMBLES)) {
  for (const [meter, tierKey] of Object.entries(meters)) {
    if (ONLY && ONLY !== ens + ':' + meter) continue;
    const lib = G.TIERS[tierKey].compound ? G.COMPOUND : G.SIMPLE;
    // a pool of good single lines, then the pairs that interlock best (some randomness so it isn't always the extremes);
    // a line is used in at most 2 pairs so the set stays varied
    // 4/4 lines of the busier levels: two of them only fit on one page width together when neither is crowded,
    // so those pairs come from the lighter half of a bigger pool
    const busy = meter === '4/4' && /^A/.test(tierKey), want = busy ? POOL * 2 : POOL;
    let pool = [];
    const seenLine = new Set();
    for (let g = 0; pool.length < want && g < want * 20; g++) {
      const ms = G.makeLine(tierKey, meter), k = ms.map(m => m.join(' ')).join('|');
      if (!seenLine.has(k)) { seenLine.add(k); pool.push(ms); }
    }
    if (busy) {
      const notes = ms => ms.reduce((t, m) => t + m.reduce((u, k) => u + lib[k].notes.length, 0), 0);
      pool = pool.map(ms => ({ ms, n: notes(ms) })).sort((x, y) => x.n - y.n).slice(0, POOL).map(o => o.ms);
    }
    const cands = [];
    for (let i = 0; i < pool.length; i++) for (let j = 0; j < pool.length; j++) {
      if (i === j) continue;
      const sc = pairScore(pool[i], pool[j], meter, lib);
      if (sc !== null) cands.push({ i, j, w: sc + G.rnd() * 0.25 });
    }
    cands.sort((x, y) => y.w - x.w);
    const used = new Map(), usedPair = new Set();
    let n = 0;
    for (const c of cands) {
      if (n >= PER_KIND) break;
      if ((used.get(c.i) || 0) >= 2 || (used.get(c.j) || 0) >= 2 || usedPair.has(c.j + ',' + c.i)) continue;
      const parts = [pool[c.i], pool[c.j]].map(ms => ms.map(m => m.flatMap(k => lib[k].notes)));
      if (!fitsDuo({ meter, parts })) continue;
      used.set(c.i, (used.get(c.i) || 0) + 1); used.set(c.j, (used.get(c.j) || 0) + 1); usedPair.add(c.i + ',' + c.j);
      n++;
      const name = `duo_${ens}_${meter.replace('/', '-')}_${String(n).padStart(3, '0')}`;
      const infos = [];
      const pngs = renderDuo({ meter, parts }, infos);
      pngs.forEach((png, k) => fs.writeFileSync(path.join(OUT, `${name}_${k + 1}.png`), png));
      book[name] = { m: meter, b: pngs.map(p => p.length), p: parts.map((ms, k) => countLine(meter, ms, infos[k])) };
    }
    if (n < PER_KIND) console.warn(`only ${n} pairs for ${ens} ${meter}`);
    else console.log(ens, meter, n);
  }
}
// The board / practice page read this from the site root (next to rhythm-counts.json)
fs.writeFileSync(path.join(OUT, 'rhythm-duos.json'), JSON.stringify({ v: 1, img: { w: 1400, h: 160 }, lines: book }));
console.log('pairs', Object.keys(book).length);
