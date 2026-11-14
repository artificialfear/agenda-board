// Renders one 4-measure rhythm line (single-line staff, stems up, no counts) to PNG.
const { JSDOM } = require('jsdom');
const { Resvg } = require('@resvg/resvg-js');
const VF = require('vexflow');
const { Renderer, Stave, StaveNote, Voice, Formatter, Beam, Dot, Fraction, Barline } = VF.Flow || VF;

const W = 1400, H = 160, SCALE = 2;

// line = { meter: "4/4", measures: [[{d:"q", r:false}, ...] x4] }
// Measure widths (v2, 11/9/2026): each measure gets the room its notes need (VexFlow's minimum width
// times AIR), then any leftover is shared equally. A line that can't give every measure AIR_MIN doesn't fit:
// gen.js never uses one (busy sixteenth lines used to spill over the barlines).
const AIR = 1.25, AIR_MIN = 1.12, PER16 = 6, JUSTIFY_SLACK = 17;   // PER16: every measure also gets at least this much per sixteenth of time
// (so a measure of long notes isn't squeezed: their held beats need room too)
function layoutLine(line, w) {
  const [num, den] = line.meter.split('/').map(Number);
  const compound = den === 8;
  const build = m => {
    const notes = m.map(n => {
      const dots = n.d.endsWith('d') ? 1 : 0;
      const base = n.d.replace('d', '');
      const sn = new StaveNote({ keys: ['b/4'], duration: base + (n.r ? 'r' : ''), clef: 'percussion',
        stem_direction: 1, auto_stem: false, dots });
      if (dots) Dot.buildAndAttach([sn], { all: true });
      return sn;
    });
    const voice = new Voice({ num_beats: num, beat_value: den }).setStrict(true);
    voice.addTickables(notes);
    const groups = compound ? [new Fraction(3, 8)] : [new Fraction(1, 4)];
    const beams = Beam.generateBeams(notes, { groups, stem_direction: 1, beam_rests: false });
    return { notes, voice, beams };
  };
  // minimum widths come from a throwaway copy: measuring leaves the formatter's spacing stale,
  // so the copy that's drawn is formatted fresh (otherwise the spare room piles up at the end of the measure)
  const built = line.measures.map(m => {
    const probe = build(m);
    const minW = new Formatter().joinVoices([probe.voice]).preCalculateMinTotalWidth([probe.voice]);
    return Object.assign(build(m), { minW });
  });
  const mkStave = (meter, x, width, i) => {
    const st = new Stave(x, 14, width, { space_above_staff_ln: 1, space_below_staff_ln: 0, fill_style: '#000000' });
    st.setConfigForLines([0, 1, 2, 3, 4].map(k => ({ visible: k === 2 })));
    if (i === 0) st.addClef('percussion').addTimeSignature(meter);
    if (i === 3) st.setEndBarType(Barline.type.END);
    return st;
  };
  // space a stave keeps for itself (clef, time signature, padding, barlines)
  const over = [0, 1, 2, 3].map(i => { const st = mkStave(line.meter, 0, 300, i); return 300 - (st.getNoteEndX() - st.getNoteStartX()); });
  const content = w - 12 - over.reduce((a, b) => a + b, 0) - 4 * JUSTIFY_SLACK;
  const sum = a => a.reduce((x, y) => x + y, 0);
  const floor = num * 16 / den * PER16;
  const lo = built.map(m => Math.max(m.minW * AIR_MIN, floor * 0.9)), hi = built.map(m => Math.max(m.minW * AIR, floor));
  let inner;
  if (content >= sum(hi)) inner = hi.map(n => n + (content - sum(hi)) / 4);          // room to spare: share it equally
  else {                                                                             // tight: everyone above the minimum
    const extra = content - sum(lo), d = sum(hi) - sum(lo);
    inner = lo.map((n, i) => n + (d ? Math.max(0, extra) * (hi[i] - lo[i]) / d : 0));
  }
  return { built, over, inner, mkStave, fits: content >= sum(lo) };
}
// true when the line can be drawn without crowding (gen.js checks this before using a line)
function fitsLine(line) {
  if (!global.document) global.document = new JSDOM('<!DOCTYPE html><div></div>').window.document;
  return layoutLine(line, W / SCALE).fits;
}

function renderLine(line, info) {
  const dom = new JSDOM('<!DOCTYPE html><div id="o"></div>');
  global.document = dom.window.document;
  const div = dom.window.document.getElementById('o');
  const r = new Renderer(div, Renderer.Backends.SVG);
  r.resize(W, H);
  const ctx = r.getContext();
  ctx.scale(SCALE, SCALE);
  const w = W / SCALE, h = H / SCALE;
  ctx.setFillStyle('#000'); ctx.setStrokeStyle('#000');

  const { built, over, inner, mkStave } = layoutLine(line, w);
  let x = 6;
  built.forEach((m, i) => {
    const st = mkStave(line.meter, x, inner[i] + over[i] + JUSTIFY_SLACK, i);
    st.setContext(ctx).draw();
    // like v1: justify a little short of the barline (VexFlow adds its own space after the last note)
    new Formatter().joinVoices([m.voice]).format([m.voice], st.getNoteEndX() - st.getNoteStartX() - JUSTIFY_SLACK);
    m.voice.draw(ctx, st);
    m.beams.forEach(b => b.setContext(ctx).draw());
    if (info) info.push({
      start: st.getNoteStartX() / w, end: st.getNoteEndX() / w, 
      xs: m.notes.map(sn => { const b = sn.getNoteHeadBeginX(), e = sn.getNoteHeadEndX(); return ((b + e) / 2) / w; })
    });
    x += inner[i] + over[i] + JUSTIFY_SLACK;
  });

  let svg = div.innerHTML;
  if (!/xmlns=/.test(svg)) svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  svg = svg.replace('<svg', `<svg style="background:#fff"`);
  const png = new Resvg(svg, { background: '#ffffff', fitTo: { mode: 'width', value: W } }).render().asPng();
  return png;
}
// ---------------------------------------------------------------- 2.17.0 (Mat 11/14): two-part rhythms
// Two lines that are played together. Each part is its own 1400x160 picture (same look as the pool), but both are laid out
// together: every measure is as wide as the busier part needs, and the notes are spaced by time across BOTH parts, so the
// same moment sits at the same x in both pictures (one moving line works for both; counts line up).
// duo = { meter, parts: [measures, measures] }
function layoutDuo(duo, w) {
  const one = { meter: duo.meter, measures: duo.parts[0] };
  const base = layoutLine(one, w);                 // staves / overhead from the single-part layout
  const [num, den] = duo.meter.split('/').map(Number);
  const compound = den === 8;
  const build = m => {
    const notes = m.map(n => {
      const dots = n.d.endsWith('d') ? 1 : 0;
      const sn = new StaveNote({ keys: ['b/4'], duration: n.d.replace('d', '') + (n.r ? 'r' : ''), clef: 'percussion', stem_direction: 1, auto_stem: false, dots });
      if (dots) Dot.buildAndAttach([sn], { all: true });
      return sn;
    });
    const voice = new Voice({ num_beats: num, beat_value: den }).setStrict(true);
    voice.addTickables(notes);
    const beams = Beam.generateBeams(notes, { groups: compound ? [new Fraction(3, 8)] : [new Fraction(1, 4)], stem_direction: 1, beam_rests: false });
    return { notes, voice, beams };
  };
  const pair = i => [build(duo.parts[0][i]), build(duo.parts[1][i])];
  const minW = [0, 1, 2, 3].map(i => { const p = pair(i); return new Formatter().joinVoices([p[0].voice]).joinVoices([p[1].voice])
    .preCalculateMinTotalWidth([p[0].voice, p[1].voice]); });
  const over = base.over;
  const content = w - 12 - over.reduce((a, b) => a + b, 0) - 4 * JUSTIFY_SLACK;
  const sum = a => a.reduce((x, y) => x + y, 0);
  const floor = num * 16 / den * PER16;
  const lo = minW.map(m => Math.max(m * AIR_MIN, floor * 0.9)), hi = minW.map(m => Math.max(m * AIR, floor));
  let inner;
  if (content >= sum(hi)) inner = hi.map(n => n + (content - sum(hi)) / 4);
  else { const extra = content - sum(lo), d = sum(hi) - sum(lo); inner = lo.map((n, i) => n + (d ? Math.max(0, extra) * (hi[i] - lo[i]) / d : 0)); }
  return { pair, over, inner, mkStave: base.mkStave, fits: content >= sum(lo) };
}
// Busy pairs (7th/8th 4/4) don't fit at the pool's size, so they're drawn smaller (same 1400x160 picture, centered)
const DUO_SCALES = [SCALE, 1.75, 1.55];
function duoScale(duo) {
  if (!global.document) global.document = new JSDOM('<!DOCTYPE html><div></div>').window.document;
  for (const sc of DUO_SCALES) if (layoutDuo(duo, W / sc).fits) return sc;
  return null;
}
function fitsDuo(duo) { return duoScale(duo) !== null; }
// one picture per part: [png1, png2]; infos[k] gets the same note positions renderLine gives (for the counts)
function renderDuo(duo, infos) {
  const sc = duoScale(duo);
  if (!sc) throw new Error('duo does not fit');
  return [0, 1].map(k => {
    const dom = new JSDOM('<!DOCTYPE html><div id="o"></div>');
    global.document = dom.window.document;
    const div = dom.window.document.getElementById('o');
    const r = new Renderer(div, Renderer.Backends.SVG);
    r.resize(W, H);
    const ctx = r.getContext();
    ctx.scale(sc, sc);
    const w = W / sc;
    ctx.setFillStyle('#000'); ctx.setStrokeStyle('#000');
    const { pair, over, inner, mkStave } = layoutDuo(duo, w);
    let x = 6;
    const info = infos ? (infos[k] = []) : null;
    [0, 1, 2, 3].forEach(i => {
      const st = mkStave(duo.meter, x, inner[i] + over[i] + JUSTIFY_SLACK, i);
      st.setContext(ctx).draw();
      const p = pair(i);
      p[0].voice.setStave(st); p[1].voice.setStave(st);
      new Formatter().joinVoices([p[0].voice]).joinVoices([p[1].voice])
        .format([p[0].voice, p[1].voice], st.getNoteEndX() - st.getNoteStartX() - JUSTIFY_SLACK);
      p[k].voice.draw(ctx, st);
      p[k].beams.forEach(b => b.setContext(ctx).draw());
      if (info) info.push({ start: st.getNoteStartX() / w, end: st.getNoteEndX() / w,
        xs: p[k].notes.map(sn => ((sn.getNoteHeadBeginX() + sn.getNoteHeadEndX()) / 2) / w) });
      x += inner[i] + over[i] + JUSTIFY_SLACK;
    });
    let svg = div.innerHTML;
    if (!/xmlns=/.test(svg)) svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    svg = svg.replace('<svg', `<svg style="background:#fff"`);
    if (sc !== SCALE) {                                   // smaller drawing: move it down so it sits in the middle
      const dy = Math.round((H - H * sc / SCALE) / 2);
      svg = svg.replace(/(<svg[^>]*>)/, `$1<g transform="translate(0 ${dy})">`).replace(/<\/svg>\s*$/, '</g></svg>');
    }
    return new Resvg(svg, { background: '#ffffff', fitTo: { mode: 'width', value: W } }).render().asPng();
  });
}
module.exports = { renderLine, fitsLine, renderDuo, fitsDuo };

if (require.main === module) {
  const fs = require('fs');
  const t = renderLine({ meter: '4/4', measures: [
    [{d:'q'},{d:'8'},{d:'8'},{d:'h'}],
    [{d:'qd'},{d:'8'},{d:'16'},{d:'16'},{d:'16'},{d:'16'},{d:'q',r:true}],
    [{d:'8'},{d:'q'},{d:'8'},{d:'8'},{d:'16'},{d:'16'},{d:'q'}],
    [{d:'hd'},{d:'q',r:true}]]});
  fs.writeFileSync('test44.png', t);
  const t2 = renderLine({ meter: '6/8', measures: [
    [{d:'qd'},{d:'8'},{d:'8'},{d:'8'}],
    [{d:'q'},{d:'8'},{d:'qd',r:true}],
    [{d:'8',r:true},{d:'8'},{d:'8'},{d:'q'},{d:'8'}],
    [{d:'hd'}]]});
  fs.writeFileSync('test68.png', t2);
}