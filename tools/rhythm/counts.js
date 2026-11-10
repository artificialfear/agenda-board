// Counts for one rhythm line, in Mat's style (11/9/2026):
//   simple meters: 1 e + a      6/8: 1 2 3 4 5 6 (sixteenths in between = +)
//   rests in (parentheses), beats held through by a long note = dim
// Each item: [x, label, kind]  x = fraction of the image width,
// kind 'n' = note, 'r' = rest, 'h' = held beat (dim), 'hr' = rest held over a beat (dim, in parentheses)
const LEN = { w: 16, hd: 12, h: 8, qd: 6, q: 4, '8d': 3, '8': 2, '16': 1 };

function label(p, compound) {
  if (compound) return p % 2 ? '+' : String(p / 2 + 1);
  return [String(Math.floor(p / 4) + 1), 'e', '+', 'a'][p % 4];
}

function countLine(meter, measures, info) {
  const [num, den] = meter.split('/').map(Number);
  const compound = den === 8;
  const beat = compound ? 2 : 4;              // where a "count" falls, in sixteenths
  const L = num * 16 / den;
  const out = [];
  measures.forEach((m, mi) => {
    const pos = info[mi];
    let p = 0;
    const starts = m.map(n => { const s = p; p += LEN[n.d]; return s; });
    if (p !== L) throw new Error('measure ' + mi + ' is ' + p + ' sixteenths, expected ' + L);
    m.forEach((n, i) => {
      const s = starts[i], e = s + LEN[n.d];
      const r4 = (x) => Math.round(x * 10000) / 10000;
      out.push([r4(pos.xs[i]), n.r ? '(' + label(s, compound) + ')' : label(s, compound), n.r ? 'r' : 'n']);
      // held beats: spread evenly between this note and the next one (or the end of the measure)
      const held = [];
      for (let t = Math.floor(s / beat) * beat + beat; t < e; t += beat) held.push(t);
      const x0 = pos.xs[i], x1 = i + 1 < m.length ? pos.xs[i + 1] : pos.end;
      held.forEach((t, j) => {
        const x = x0 + (x1 - x0) * (j + 1) / (held.length + 1);
        out.push([r4(x), n.r ? '(' + label(t, compound) + ')' : label(t, compound), n.r ? 'hr' : 'h']);
      });
    });
  });
  return out;
}
module.exports = { countLine, LEN };
