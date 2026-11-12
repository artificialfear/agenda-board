// AgendaFill.gs v1.0 + ClosingScores.gs v1.9: the lesson plan's week → Agenda Plan / Agenda Focus tabs → WORK SESSION and
// FOCUS WALL boxes. Slide text is in the shape of the real deck (11/12): bold Oswald heading, Lato 16 bulleted items,
// bold "Learning: " labels + plain values. Made-up songs only.
const fs = require('fs'), path = require('path'), a = require('assert');
const cache = {}; global.CacheService = { getScriptCache: () => ({ get: k => cache[k] || null, put: (k, v) => { cache[k] = v; }, remove: k => { delete cache[k]; } }) };
global.PropertiesService = { getScriptProperties: () => ({ getProperty: k => (k === 'closingKey' ? 'KEY' : null) }) };
global.ContentService = { MimeType: { JSON: 'j' }, createTextOutput: s => ({ setMimeType: () => JSON.parse(s) }) };
global.Session = { getScriptTimeZone: () => 'America/New_York' };
global.LockService = { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) };
const logs = []; global.Logger = { log(m) { logs.push(m); } };
const pad = n => String(n).padStart(2, '0');
global.Utilities = { formatDate: (d, tz, f) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + (/HH/.test(f) ? ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) : '') };
let trig = []; global.ScriptApp = { getProjectTriggers: () => trig.map(f => ({ getHandlerFunction: () => f })), deleteTrigger(t) { trig = trig.filter(f => f !== t.getHandlerFunction()); },
  newTrigger: f => ({ timeBased: () => ({ everyDays: () => ({ atHour: () => ({ nearMinute: () => ({ create() { trig.push(f); } }) }) }) }) }) };

// ---- a strict SlidesApp text model: one buffer per shape, a style per character
function mkText(runs) {   // runs: [[text, {bold, size, font}]]
  const buf = { t: '', st: [] };
  runs.forEach(([t, s]) => { buf.t += t; for (const _ of t) buf.st.push(Object.assign({}, s)); });
  return buf;
}
function range(buf, s, e) {
  const R = {
    asString: () => buf.t.slice(s, e), getLength: () => e - s,
    getRange(a2, b2) { if (a2 < 0 || b2 > e - s || a2 > b2) throw new Error('range out of bounds ' + a2 + '-' + b2); return range(buf, s + a2, s + b2); },
    setText(t) {   // Apps Script: the new text takes the style of the start of the old text; returns the new range
      if (e <= s) throw new Error('setText on an empty range');
      const style = buf.st[s];
      buf.t = buf.t.slice(0, s) + t + buf.t.slice(e); buf.st.splice(s, e - s, ...Array.from(t, () => Object.assign({}, style)));
      e = s + t.length; return range(buf, s, e);
    },
    insertText(off, t) {
      const at = s + off; if (at < s || at >= e) throw new Error('insertText offset out of range: ' + off);
      const style = buf.st[at];
      buf.t = buf.t.slice(0, at) + t + buf.t.slice(at); buf.st.splice(at, 0, ...Array.from(t, () => Object.assign({}, style)));
      e += t.length; return range(buf, at, at + t.length);
    },
    getTextStyle() {
      const set = k => v => { for (let i = s; i < e; i++) buf.st[i][k] = v; return T; };
      const T = { setBold: set('bold'), setFontSize: set('size'), setFontFamily: set('font') };
      return T;
    }
  };
  return R;
}
const H = { bold: true, size: 14, font: 'Oswald' }, B = { bold: false, size: 16, font: 'Lato' }, L = { bold: true, size: 12, font: 'Lato' }, V = { bold: false, size: 12, font: 'Lato' };
const shapes = {};
function shape(buf, w, h) { return { buf, getPageElementType: () => 'S', asShape: () => ({ getText: () => range(buf, 0, buf.t.length), getWidth: () => w, getHeight: () => h }) }; }
function mkSlide(b, workLines, focusVals) {
  const work = mkText([['WORK SESSION\n', H]].concat(workLines.map(l => [l + '\n', B])));
  const focus = mkText([['FOCUS WALL\n', H], ['Learning: ', L], [focusVals[0] + '\n', V], ['Why: ', L], [focusVals[1] + '\n', V], ['Success: ', L], [focusVals[2] + '\n', V]]);
  shapes[b] = { work, focus };
  return { getPageElements: () => [shape(mkText([[b + ' Block Agenda\n', H]]), 400, 40), shape(focus, 300, 120), shape(work, 330, 150)] };
}
const F0 = ['Demonstrate characteristic tone quality utilizing playing technique', 'How does daily practice build performance skill?', 'I can play a one octave Concert F Major scale with high accuracy.'];
const slides = [mkSlide('1st', ['Foundations Book pg. 4, 10, 31', 'ToE Book 2  pg. 7 #36', 'Pep Tunes '], F0),
  mkSlide('3rd', ['Technique Builder #3', 'Playing Test: #2 from Technique Builder'], F0), mkSlide('4th', ['Technique Builder #3'], F0),
  mkSlide('6th', ['Technique Builder #1', 'Synergy March'], F0), mkSlide('7th', [], F0)];
global.SlidesApp = { PageElementType: { SHAPE: 'S', TABLE: 'T' }, openById: () => ({ getSlides: () => slides }) };
const workOf = b => shapes[b].work.t, focusOf = b => shapes[b].focus.t;

// ---- sheet tabs (getValues gives Date objects back, like Sheets does for a date column)
function mkTab(vals) {
  return { vals, getLastRow: () => vals.length, getLastColumn: () => (vals[0] || []).length,
    getRange: (r, c, nr, nc) => ({
      getValues: () => vals.slice(r - 1, r - 1 + nr).map(x => Array.from({ length: nc }, (_, i) => x[c - 1 + i] == null ? '' : x[c - 1 + i])),
      getDisplayValues: () => vals.slice(r - 1, r - 1 + nr).map(x => Array.from({ length: nc }, (_, i) => { const v = x[c - 1 + i]; return v == null ? '' : v instanceof Date ? (v.getMonth() + 1) + '/' + v.getDate() + '/' + v.getFullYear() : String(v); })),
      setValues(v) { v.forEach((line, i) => { vals[r - 1 + i] = vals[r - 1 + i] || []; line.forEach((x, j) => { vals[r - 1 + i][c - 1 + j] = x; }); }); return this; },
      clearContent() { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) if (vals[r - 1 + i]) vals[r - 1 + i][c - 1 + j] = ''; return this; },
      setFontWeight() { return this; } }), setFrozenRows() {} };
}
const MH = ['Book #', 'Title', 'Book says', 'Country', 'Place', 'Lat', 'Lon', 'Composer', 'Fun fact', 'YouTube link', 'Show', 'Ensemble', 'Check', 'Book'];
const song = (n, t, c, ens, book) => [n, t, '', c, '', '', '', '', '', '', '', ens || '', '', book || ''];
const tabs = { 'Map Songs': mkTab([MH, song('42', 'Made-up Forty-Two', 'Japan'), song('43', 'Made-up Forty-Three', 'Spain'), song('36', 'Book Two Thirty-Six', 'Germany', '', '2'),
  song('Concert', 'Joy', 'United States of America', '8th Grade Band'), song('Concert', 'Made-up Winter March', 'Canada', '6th Grade Intermediate Band')]) };
global.SpreadsheetApp = { openById: () => ({ getSheetByName: n => tabs[n] || null, insertSheet: n => (tabs[n] = mkTab([])) }) };
eval(fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'ClosingScores.gs'), 'utf8'));
eval(fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'AgendaFill.gs'), 'utf8'));

const post = body => doPost({ postData: { contents: JSON.stringify(body) } });
const WEEK = '2026-11-16', TUE = new Date(2026, 10, 17, 9, 0);
const plan = {
  k: 'KEY', a: 'planPut', weekOf: WEEK,
  days: [
    { date: '2026-11-16', blocks: { '1st': ['Foundations Book pg. 4, 10, 31', 'ToE Book 2 #36 "Book Two Thirty-Six"', 'Joy (mm. 5–20)'], '3rd': ['Technique Builder #4', 'ToE Book 1 #42 "Made-up Forty-Two"'], '4th': ['Technique Builder #4', 'ToE Book 1 #42 "Made-up Forty-Two"'] } },
    { date: '2026-11-17', blocks: { '1st': ['Band Ninja: individual practice/pass-offs'], '6th': ['Technique Builder #2', 'ToE Book 1 #43 "Made-up Forty-Three"', 'Made-up Winter March'] } },
    { date: '2026-11-18', blocks: {} }
  ],
  focus: { '1st': { learning: 'Perform with steady tempo', why: 'Why does tempo matter?', success: 'I can play #36 at 100 bpm.' },
           '3rd': { learning: 'Read new notes', why: '', success: 'I can play Concert Ab.' } }
};

// key + checks
a.equal(post(Object.assign({}, plan, { k: 'nope' })).ok, false, 'wrong key refused');
a.match(post(Object.assign({}, plan, { weekOf: '2026-11-17' })).error, /Monday/, 'weekOf must be a Monday');
a.match(post(Object.assign({}, plan, { days: [{ date: '2026-11-23', blocks: { '1st': ['x'] } }] })).error, /not in the week/);
a.match(post(Object.assign({}, plan, { days: [{ date: '2026-11-16', blocks: { '2nd': ['x'] } }] })).error, /Unknown block/);
a.equal(tabs['Agenda Plan'], undefined, 'nothing saved by a refused post');
a.equal(post({ k: 'KEY', a: 'other' }).ok, false, 'unknown action still refused');

// saved, not filled (no "today")
let r = post(plan); a.ok(r.ok, r.error); a.equal(r.rows, 5); a.equal(r.focus, 2); a.deepEqual(r.filled, []);
const P = tabs['Agenda Plan'].vals, Fo = tabs['Agenda Focus'].vals;
a.deepEqual(P[0], ['Date', 'Block', 'Work Session', 'Sent']);
a.equal(P.length, 6); a.ok(P[1][0] instanceof Date, 'real date in the sheet'); a.equal(boardYmd_(P[1][0]), '2026-11-16'); a.equal(P[1][1], '1st');
a.equal(P[1][2], 'Foundations Book pg. 4, 10, 31\nToE Book 2 #36 "Book Two Thirty-Six"\nJoy (mm. 5–20)');
a.deepEqual(P.slice(1).map(x => x[1]), ['1st', '3rd', '4th', '1st', '6th'], 'sorted by date then block');
a.equal(Fo.length, 3); a.deepEqual(Fo[2].slice(1, 5), ['3rd', 'Read new notes', '', 'I can play Concert Ab.']);
a.equal(workOf('1st').startsWith('WORK SESSION\nFoundations Book pg. 4, 10, 31\nToE Book 2  pg. 7'), true, 'slides untouched until the morning');

// re-sending the week replaces its rows; other weeks' rows stay
P.push([new Date('2026-11-09T12:00:00'), '1st', 'Old week', 'x']);
const plan2 = JSON.parse(JSON.stringify(plan)); plan2.days[0].blocks['1st'] = ['Changed'];
r = post(plan2); a.ok(r.ok, r.error);
a.equal(P.filter(x => x[1] === '1st' && boardYmd_(x[0]) === '2026-11-16').length, 1, 'no duplicate rows');
a.equal(P.find(x => x[1] === '1st' && boardYmd_(x[0]) === '2026-11-16')[2], 'Changed');
a.ok(P.some(x => x[2] === 'Old week'), 'last week kept'); a.equal(boardYmd_(P[1][0]), '2026-11-09', 'older week sorts first');
post(plan);

// morning fill for Tuesday 11/17
let done = agendaFill_('2026-11-17');
a.deepEqual(done, ['1st', '1st focus', '3rd focus', '6th'], done.join());
a.equal(workOf('1st'), 'WORK SESSION\nBand Ninja: individual practice/pass-offs\n');
a.equal(workOf('6th'), 'WORK SESSION\nTechnique Builder #2\nToE Book 1 #43 "Made-up Forty-Three"\nMade-up Winter March\n');
a.equal(workOf('3rd'), 'WORK SESSION\nTechnique Builder #3\nPlaying Test: #2 from Technique Builder\n', 'no row for 3rd on Tuesday: left alone');
const sw = shapes['6th'].work;
a.ok(sw.st.slice(0, 12).every(s => s.bold && s.font === 'Oswald' && s.size === 14), 'heading keeps its look');
a.ok(sw.st.slice(13, sw.t.length - 1).every(s => !s.bold && s.font === 'Lato' && s.size === 16), 'items keep the item font, 16 pt');
// focus wall: labels stay bold, values replaced, blank value left alone (3rd's Why)
a.equal(focusOf('1st'), 'FOCUS WALL\nLearning: Perform with steady tempo\nWhy: Why does tempo matter?\nSuccess: I can play #36 at 100 bpm.\n');
const sf = shapes['1st'].focus, at = (t, from) => sf.t.indexOf(t, from);
a.ok(sf.st.slice(at('Learning: '), at('Learning: ') + 10).every(s => s.bold), 'label stays bold');
a.ok(sf.st.slice(at('Perform'), at('Perform') + 7).every(s => !s.bold && s.size === 12), 'value plain 12 pt');
a.equal(focusOf('6th'), 'FOCUS WALL\nLearning: ' + F0[0] + '\nWhy: ' + F0[1] + '\nSuccess: ' + F0[2] + '\n', 'no focus row for 6th: unchanged');
a.deepEqual(agendaFill_('2026-11-17'), [], 'second run: nothing to change');

// Monday 11/16 incl. 3rd's focus with a blank Why
agendaFill_('2026-11-16');
a.equal(focusOf('3rd'), 'FOCUS WALL\nLearning: Read new notes\nWhy: ' + F0[1] + '\nSuccess: I can play Concert Ab.\n');
a.equal(focusOf('4th').indexOf('Read new notes'), -1, '4th has no focus row of its own in this test');

// the map finds the generator's lines (Book 2 number, "Joy (mm. 5–20)" as a whole-line concert match)
const keys = b => boardToday_(b, new Date(2026, 10, 16, 10, 0)).songs.map(s => s.key);
a.deepEqual(keys('1st'), ['2-36', 'Joy'], keys('1st').join());
a.deepEqual(keys('3rd'), ['42']);
const work6 = boardToday_('6th', TUE).songs.map(s => s.title); a.deepEqual(work6, ['Made-up Forty-Three', 'Made-up Winter March']);
a.equal(boardMatchSongs_('Abundant Joy (mm. 1-8)', '1st', boardMap_().songs).length, 0, '"Joy" still never matches inside "Abundant Joy"');
a.equal(boardMatchSongs_('Repertoire: Joy', '1st', boardMap_().songs).length, 1, 'label in front is fine');

// heading-only box (7th) gets items; new text is Lato, not the heading's Oswald
P.push([new Date('2026-11-16T12:00:00'), '7th', 'Warm Up Set 2\nToE Book 1 #43 "Made-up Forty-Three"', 'x']);
agendaFill_('2026-11-16');
a.equal(workOf('7th'), 'WORK SESSION\nWarm Up Set 2\nToE Book 1 #43 "Made-up Forty-Three"\n');
const s7 = shapes['7th'].work; a.ok(s7.st.slice(0, 12).every(s => s.bold && s.font === 'Oswald'));
a.ok(s7.st.slice(13, s7.t.length - 1).every(s => !s.bold && s.font === 'Lato' && s.size === 16), '7th items: Lato 16');

// too many items for the box → smaller, never below 12
const many = ['Technique Builder #1, #2 and #3 slowly with the metronome', 'ToE Book 1 #42 "Made-up Forty-Two"', 'ToE Book 1 #43 "Made-up Forty-Three"',
  'Made-up Winter March (mm. 1–40)', 'Music Theory: key signatures with flats and the order of flats', 'Music Technology: Noteflight composition project'];
const sizeFor = lines => agendaFitSize_({ getWidth: () => 330, getHeight: () => 150 }, lines);
a.equal(sizeFor(['Technique Builder #2', 'Joy']), 16, 'short list stays 16');
a.ok(sizeFor(many) < 16 && sizeFor(many) >= 12, 'long list shrinks: ' + sizeFor(many));
a.equal(sizeFor(many.concat(many)), 12, 'never below 12');
a.equal(agendaFitSize_({ getWidth: () => 0, getHeight: () => 0 }, many), 16, 'no size info: 16');
P.push([new Date('2026-11-18T12:00:00'), '6th', many.join('\n'), 'x']);
agendaFill_('2026-11-18'); a.ok(sw.st.slice(13, sw.t.length - 1).every(s => s.size === sizeFor(many)), 'shrunk size applied');
P.push([new Date('2026-11-19T12:00:00'), '6th', 'Technique Builder #2\nJoy', 'x']);
agendaFill_('2026-11-19'); a.ok(sw.st.slice(13, sw.t.length - 1).every(s => s.size === 16), 'back to 16 the next short day');

// "Send to agenda" (today: true) fills today right away; a date Mat typed as text in the sheet works too
const realNow = Date; let fakeNow = TUE;
global.Date = class extends realNow { constructor(...x) { if (x.length) super(...x); else super(fakeNow.getTime()); } static now() { return fakeNow.getTime(); } };
const plan3 = JSON.parse(JSON.stringify(plan)); plan3.today = true; plan3.days[1].blocks['1st'] = ['Band Ninja: individual practice/pass-offs', 'Lunch & Learn sign-up'];
r = post(plan3); a.ok(r.ok, r.error); a.deepEqual(r.filled, ['1st', '6th'], 'today (Tue) filled: ' + r.filled);   // 6th was left on Thursday's text above
a.equal(workOf('1st'), 'WORK SESSION\nBand Ninja: individual practice/pass-offs\nLunch & Learn sign-up\n');
P.push(['11/20/2026', '3rd', 'Typed by hand', 'x']); agendaFill_('2026-11-20'); a.equal(workOf('3rd'), 'WORK SESSION\nTyped by hand\n');

// trigger: weekends do nothing; setup makes exactly one trigger
fakeNow = new realNow(2026, 10, 21, 5, 40); const before = workOf('1st'); agendaFillDaily(); a.equal(workOf('1st'), before, 'Saturday: nothing');
setupAgendaFill(); setupAgendaFill(); a.deepEqual(trig, ['agendaFillDaily']);
global.Date = realNow;

// line cleanup: blanks dropped, newlines inside an item flattened, at most 12 items
a.deepEqual(agendaCleanLines_([' a ', '', null, 'b\nc']), ['a', 'b c']);
a.equal(agendaCleanLines_(Array.from({ length: 20 }, (_, i) => 'x' + i)).length, 12);
console.log('agenda_fill_test: all passed');
