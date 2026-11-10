// Generates the Daily Rhythm image pool for the Daily Slides script.
// Units are sixteenth notes. Simple meters: beat = 4. 6/8: dotted-quarter beat = 6.
// v1 11/4/2026 (first pool). v2 11/9/2026: measures sized by what they hold, lines too busy to print
// cleanly are skipped, and rhythm-counts.json is written with the images (the board's "Show counts").
const fs = require('fs');
const path = require('path');
const { renderLine, fitsLine } = require('./render');
const { countLine } = require('./counts');

const PER_METER = Number(process.env.PER_METER || 60);
const OUT = process.argv[2] || 'Daily Rhythms';

// Seeded RNG so the pool is reproducible
let seed = 20261104;
function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
function pick(items) {
  const total = items.reduce((s, c) => s + c.w, 0);
  let r = rnd() * total;
  for (const c of items) { if ((r -= c.w) < 0) return c; }
  return items[items.length - 1];
}

const N = (d, r) => ({ d, r: !!r });
// can(start, meterLen) decides where a cell may begin in the measure
const anyBeat = () => true;
const halfSpot = (s, L) => L === 16 ? s % 8 === 0 : L === 12 ? true : s === 0;  // 2-beat cells on beats 1/3 in 4/4
const SIMPLE = {
  q:      { notes: [N('q')], len: 4, can: anyBeat, end: true },
  qr:     { notes: [N('q', 1)], len: 4, can: anyBeat, rest: true },
  h:      { notes: [N('h')], len: 8, can: halfSpot, end: true },
  w:      { notes: [N('w')], len: 16, can: (s, L) => L === 16 && s === 0, end: true, whole: true },
  e2:     { notes: [N('8'), N('8')], len: 4, can: anyBeat, lvl: 'I' },
  hd:     { notes: [N('hd')], len: 12, can: (s, L) => s === 0 || (L === 16 && s === 4), end: true, lvl: 'I' },
  qde:    { notes: [N('qd'), N('8')], len: 8, can: halfSpot, lvl: 'A' },
  synco:  { notes: [N('8'), N('q'), N('8')], len: 8, can: halfSpot, lvl: 'A' },
  re:     { notes: [N('8', 1), N('8')], len: 4, can: anyBeat, lvl: 'A' },
  s4:     { notes: [N('16'), N('16'), N('16'), N('16')], len: 4, can: anyBeat, lvl: 'A' },
  es2:    { notes: [N('8'), N('16'), N('16')], len: 4, can: anyBeat, lvl: 'A' },
  s2e:    { notes: [N('16'), N('16'), N('8')], len: 4, can: anyBeat, lvl: 'A' }
};
const COMPOUND = {
  qd:     { notes: [N('qd')], len: 6, can: anyBeat, end: true },
  qe:     { notes: [N('q'), N('8')], len: 6, can: anyBeat },
  e3:     { notes: [N('8'), N('8'), N('8')], len: 6, can: anyBeat },
  qdr:    { notes: [N('qd', 1)], len: 6, can: anyBeat, rest: true },
  hd:     { notes: [N('hd')], len: 12, can: s => s === 0, end: true },
  eq:     { notes: [N('8'), N('q')], len: 6, can: anyBeat, lvl: 'A' },
  re2:    { notes: [N('8', 1), N('8'), N('8')], len: 6, can: anyBeat, lvl: 'A' },
  s2e2:   { notes: [N('16'), N('16'), N('8'), N('8')], len: 6, can: anyBeat, lvl: 'A' }
};

// Weights per tier: newer values get more weight so each tier actually practices them
const TIERS = {
  B: { cells: { q: 6, qr: 2, h: 3, w: 1 }, needLvl: null, minLvl: 0 },
  I: { cells: { q: 4, qr: 1.5, h: 2, w: 0.6, e2: 4, hd: 1.5 }, needLvl: 'I', minLvl: 2 },
  A: { cells: { q: 2.5, qr: 1, h: 1, e2: 2.5, hd: 0.8, qde: 2, synco: 2, re: 1, s4: 1.5, es2: 1.5, s2e: 1.5 }, needLvl: 'A', minLvl: 2 },
  A8: { cells: { q: 2, qr: 1, h: 0.8, e2: 2, hd: 0.6, qde: 2, synco: 2, re: 1.2, s4: 1.8, es2: 1.8, s2e: 1.8 }, needLvl: 'A', minLvl: 3 },
  C8: { cells: { qd: 3, qe: 3, e3: 3, qdr: 1, hd: 1, eq: 1.5, re2: 1.2, s2e2: 1.2 }, needLvl: 'A', minLvl: 1, compound: true }
};

// Ensembles (file prefix → tier per meter)
const ENSEMBLES = {
  '8th':  { '4/4': 'A8', '3/4': 'A8', '2/4': 'A8', '6/8': 'C8' },
  '7th':  { '4/4': 'A', '3/4': 'A', '2/4': 'A' },
  '6int': { '4/4': 'I', '3/4': 'I', '2/4': 'I' },
  '6beg': { '4/4': 'B', '3/4': 'B', '2/4': 'B' }
};

function measureLen(meter) { const [n, d] = meter.split('/').map(Number); return n * 16 / d; }

function makeMeasure(tier, meter, isLast) {
  const L = measureLen(meter);
  const lib = tier.compound ? COMPOUND : SIMPLE;
  for (let tries = 0; tries < 200; tries++) {
    const cells = [];
    let s = 0, ok = true;
    while (s < L) {
      const opts = Object.entries(tier.cells)
        .map(([k, w]) => ({ k, w, c: lib[k] }))
        .filter(o => o.c.len <= L - s && o.c.can(s, L));
      if (!opts.length) { ok = false; break; }
      const o = pick(opts);
      cells.push(o.k); s += o.c.len;
    }
    if (!ok) continue;
    const rests = cells.filter(k => lib[k].rest).length;
    if (rests === cells.length || rests > 1) continue;            // never an all-rest measure; max one rest
    if (isLast && !lib[cells[cells.length - 1]].end) continue;   // line ends on a held note
    return cells;
  }
  throw new Error('could not build measure');
}

function makeLine(tierKey, meter) {
  const tier = TIERS[tierKey];
  const lib = tier.compound ? COMPOUND : SIMPLE;
  for (let tries = 0; tries < 500; tries++) {
    const ms = [0, 1, 2, 3].map(i => makeMeasure(tier, meter, i === 3));
    const flat = ms.flat();
    if (flat.filter(k => lib[k].whole).length > 1) continue;
    if (new Set(ms.map(m => m.join())).size < 3) continue;          // at least 3 different measures
    if (tier.needLvl) {
      const n = flat.filter(k => lib[k].lvl === tier.needLvl).length;
      if (n < tier.minLvl) continue;                                // each tier practices its new values
    }
    // v2 (11/9/2026): never a line too busy to print with room between the notes
    if (!fitsLine({ meter, measures: ms.map(m => m.flatMap(k => lib[k].notes)) })) continue;
    return ms;
  }
  throw new Error('could not build line ' + tierKey + ' ' + meter);
}

fs.mkdirSync(OUT, { recursive: true });
const manifest = [];
const counts = {};
for (const [ens, meters] of Object.entries(ENSEMBLES)) {
  for (const [meter, tierKey] of Object.entries(meters)) {
    const lib = TIERS[tierKey].compound ? COMPOUND : SIMPLE;
    const seen = new Set();
    let n = 0, guard = 0;
    while (n < PER_METER && guard++ < 20000) {
      const ms = makeLine(tierKey, meter);
      const key = ms.map(m => m.join(' ')).join(' | ');
      if (seen.has(key)) continue;
      seen.add(key);
      n++;
      const name = `${ens}_${meter.replace('/', '-')}_${String(n).padStart(3, '0')}.png`;
      const measures = ms.map(m => m.flatMap(k => lib[k].notes));
      const info = [];
      const png = renderLine({ meter, measures }, info);
      fs.writeFileSync(path.join(OUT, name), png);
      manifest.push({ name, ens, meter, tier: tierKey, cells: key });
      counts[name] = { m: meter, b: png.length, c: countLine(meter, measures, info) };   // b: bytes, so the board knows the image matches
    }
    if (n < PER_METER) console.warn(`only ${n} unique lines for ${ens} ${meter}`);
  }
}
fs.writeFileSync('manifest.json', JSON.stringify(manifest, null, 1));
// The board's "Show counts" reads this file from the Daily Rhythms folder (ClosingScores.gs a=rhythm)
fs.writeFileSync(path.join(OUT, 'rhythm-counts.json'), JSON.stringify({ v: 2, img: { w: 1400, h: 160 }, lines: counts }));
console.log('rendered', manifest.length);