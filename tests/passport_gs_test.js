// ClosingScores.gs v1.6: a=today (songs on a block's WORK SESSION box), the Map Played log, a=passport, setupMapPassport.
// Made-up songs / slide text in the shape of the real ones (11/10: "ToE Book pg. 13 Dreidel Song", "Technique Builder #3").
const fs = require('fs'), path = require('path'), a = require('assert');
const cache = {}; global.CacheService = { getScriptCache: () => ({ get: k => cache[k] || null, put: (k, v) => { cache[k] = v; }, remove: k => { delete cache[k]; } }) };
global.PropertiesService = { getScriptProperties: () => ({ getProperty: k => (k === 'closingKey' ? 'KEY' : null) }) };
global.ContentService = { MimeType: { JSON: 'j' }, createTextOutput: s => ({ setMimeType: () => JSON.parse(s) }) };
global.Session = { getScriptTimeZone: () => 'America/New_York' };
global.LockService = { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) };
global.Logger = { log() {} };
global.Utilities = { formatDate: d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') };
let trig = []; global.ScriptApp = { getProjectTriggers: () => trig.map(f => ({ getHandlerFunction: () => f })), deleteTrigger(t) { trig = trig.filter(f => f !== t.getHandlerFunction()); },
  newTrigger: f => ({ timeBased: () => ({ everyDays: () => ({ atHour: () => ({ create() { trig.push(f); } }) }) }) }) };

// ---- slides: one per block, title shape + WORK SESSION shape
const work = { '1st': 'Foundations Book pg. 4, 10, 31\nA Cartoon Christmas\nJoy', '3rd': 'Technique Builder #3\nAbundant Joy\nToE Book 1 pg. 21 #72, 73',
  '4th': 'ToE pg 20 #70-71\nTechnique Builder #3', '6th': 'Technique Builder #1\nSnowstorm\nSynergy March', '7th': 'Warm Up Set 1\nToE Book pg. 13 Dreidel Song' };
const shape = t => ({ getPageElementType: () => 'S', asShape: () => ({ getText: () => ({ asString: () => t + '\n' }) }) });
global.SlidesApp = { PageElementType: { SHAPE: 'S', TABLE: 'T' }, openById: () => ({ getSlides: () => Object.keys(work).map(b => ({
  getPageElements: () => [shape('DID YOU KNOW?\nSomething #12 tradition'), shape(b + ' Block Agenda'), shape('WORK SESSION\n' + work[b])] })) }) };

// ---- sheet tabs
function mkTab(vals) {
  return { vals, getLastRow: () => vals.length, getLastColumn: () => vals[0].length,
    getRange: (r, c, nr, nc) => ({ getDisplayValues: () => vals.slice(r - 1, r - 1 + nr).map(x => x.slice(c - 1, c - 1 + nc).map(v => v == null ? '' : String(v))),
      setValues(v) { v.forEach((line, i) => { vals[r - 1 + i] = line.slice(); }); return this; }, setFontWeight() { return this; } }), setFrozenRows() {} };
}
const H = ['Book #', 'Title', 'Book says', 'Country', 'Place', 'Lat', 'Lon', 'Composer', 'Fun fact', 'YouTube link', 'Show', 'Ensemble'];
const song = (n, t, c, ens) => [n, t, '', c, '', '', '', '', '', '', '', ens || ''];
const tabs = { 'Map Songs': mkTab([H, song('12', 'Cuckoo Tune', 'Austria'), song('40', 'San Serení', 'Puerto Rico'), song('Ens.', 'The Dreidel Song', 'United States of America'),
  song('44', 'Michael Finnegan', 'Ireland'), song('70', 'Streets of Laredo', 'United States of America'), song('71', 'Donkey Riding', 'Canada'),
  song('72', 'Theme from “The Nutcracker”', 'Russia'), song('73', 'Made-up Seventy-Three', 'Japan'), song('80', 'Made-up Eighty', 'Spain'),
  song('Band', 'Made-up Band Piece', 'Mexico'), song('82', 'Made-up Eighty-Two', 'France'),
  song('Concert', 'Joy', 'United States of America', '8th Grade Band'), song('Concert', 'A Cartoon Christmas', 'United States of America', '8th Grade Band'),
  song('Concert', 'Abundant Joy', 'United States of America', '7th Grade Band'), song('Concert', 'Snowstorm', 'United States of America', '6th Grade Intermediate Band'),
  song('Concert', 'Synergy March', 'United States of America', '6th Grade Intermediate Band')]) };
global.SpreadsheetApp = { openById: () => ({ getSheetByName: n => tabs[n] || null, insertSheet: n => (tabs[n] = mkTab([[]])) }) };
eval(fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'ClosingScores.gs'), 'utf8'));

const TUE = new Date(2026, 10, 10, 10, 0), SAT = new Date(2026, 10, 14, 10, 0);
const titles = r => r.songs.map(s => s.title);
let r = boardToday_('7th', TUE);
a.deepEqual(titles(r), ['The Dreidel Song'], 'title on a ToE line');
a.deepEqual(titles(boardToday_('3rd', TUE)), ['Abundant Joy', 'Theme from “The Nutcracker”', 'Made-up Seventy-Three'], 'concert piece + #72, 73 (Technique Builder #3 ignored)');
a.deepEqual(titles(boardToday_('4th', TUE)), ['Streets of Laredo', 'Donkey Riding'], '#70-71 range');
a.deepEqual(titles(boardToday_('1st', TUE)), ['A Cartoon Christmas', 'Joy'], '8th grade: their concert pieces; "Joy" only as a whole line');
a.deepEqual(titles(boardToday_('6th', TUE)), ['Snowstorm', 'Synergy March'], '6th Int: own concert pieces');
a.equal(boardToday_('3rd', TUE).songs.some(s => s.title === 'Joy'), false, '"Abundant Joy" line never counts as 8th grade "Joy"');
a.throws(() => boardToday_('2nd', TUE));
work['3rd'] += '\nSnowstorm'; a.equal(titles(boardToday_('3rd', TUE)).includes('Snowstorm'), false, "another band's concert piece doesn't count"); work['3rd'] = work['3rd'].replace('\nSnowstorm', '');
// not a Book 1 class: a ToE number on 1st Block's slide doesn't count
work['1st'] += '\nToE #12'; a.equal(titles(boardToday_('1st', TUE)).includes('Cuckoo Tune'), false); work['1st'] = work['1st'].replace('\nToE #12', '');

// logged once per date + block + song (Map Played made on first use)
const played = tabs['Map Played'];
a.ok(played, 'Map Played tab made');
a.deepEqual(played.vals[0], ['Date', 'Block', 'Song', 'Book #', 'Country', 'How']);
const n1 = played.vals.length; boardToday_('3rd', TUE); boardToday_('7th', TUE); a.equal(played.vals.length, n1, 'no repeats the same day');
a.deepEqual(played.vals.find(x => x[1] === '3rd' && x[2].startsWith('Theme')), ['2026-11-10', '3rd', 'Theme from “The Nutcracker”', '72', 'Russia', '#']);
boardToday_('7th', SAT); a.equal(played.vals.length, n1, 'weekends are not logged');
played.vals.push(['11/11/2026', '7th', 'The Dreidel Song', 'Ens.', 'United States of America', 'title']);   // the sheet's own date format
a.equal(boardLogPlayed_('2026-11-11', '7th', [{ title: 'The Dreidel Song', n: 'Ens.', country: 'United States of America', how: 'title' }]), 0, 'M/d/yyyy dates match too');

// web app: a=today needs the key and a block; a=passport groups the log by block
a.equal(doGet({ parameter: { a: 'today', k: 'nope', block: '7th' } }).ok, false);
r = doGet({ parameter: { a: 'today', k: 'KEY', block: '7th' } }); a.ok(r.ok, r.error); a.equal(r.songs[0].title, 'The Dreidel Song');
r = doGet({ parameter: { a: 'passport', k: 'KEY' } }); a.ok(r.ok, r.error);
a.deepEqual(Object.keys(r.blocks), ['1st', '3rd', '4th', '6th', '7th']);
a.ok(r.blocks['3rd'].some(x => x.title === 'Abundant Joy' && x.date === '2026-11-10'));

// starting songs: 'all' = every Book 1 row, '#80' = through the last row numbered ≤ 80, a title = through that song
const songs = boardMap_().songs;
a.equal(boardStartSongs_('all', songs).length, 11);
a.deepEqual(boardStartSongs_('#80', songs).map(s => s['Book #']), ['12', '40', 'Ens.', '44', '70', '71', '72', '73', '80']);
a.deepEqual(boardStartSongs_('The Dreidel Song', songs).map(s => s['Book #']), ['12', '40', 'Ens.']);
a.deepEqual(boardStartSongs_('dreidel song', songs).length, 3);
delete cache.boardPassport;
const before = played.vals.length;
a.equal(setupMapPassport(), 11 + 9 + 9 + 3 + 3);
a.deepEqual(trig, ['boardPlayedDaily']);
a.equal(setupMapPassport(), 0, 'running setup again adds nothing'); a.deepEqual(trig, ['boardPlayedDaily'], 'one trigger');
a.equal(played.vals.length, before + 35);
a.deepEqual(played.vals[before], ['', '1st', 'Cuckoo Tune', '12', 'Austria', 'start']);
r = boardPassport_(); a.equal(r.blocks['6th'].filter(x => x.how === 'start').length, 3);
console.log('passport checks ok');
