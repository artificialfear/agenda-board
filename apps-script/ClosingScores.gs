/**
 * ClosingScores.gs  v1.7  (Raven Band, 11/11/2026)
 *
 * Lets the agenda board (the ViewSonic page) put closing rehearsal scores (1-3)
 * into the CLOSING table on each block's Daily Rehearsal slide.
 *   - The board sends: block (1st/3rd/4th/6th/7th), row (Effort/Performance/Attitude),
 *     day (the column header, e.g. WED) and the score (1, 2, 3 or blank to clear).
 *   - The score is written into that table cell, keeping the cell's look.
 *   - Every score is also logged to the "Closing Scores" tab of the Daily Slides content sheet
 *     (one row per date + block + category; a correction replaces the row).
 *   - Every Monday ~4 AM all closing tables are emptied for the new week.
 *   - v1.1: the board also reads its settings from the "Board Settings" tab of the same sheet
 *     (Setting | Value), so links can be changed from a laptop instead of typed on the board.
 *   - v1.2: counts for the board (never any student names):
 *       a=stats         pass-offs per block this week / this quarter / today (Admin "Pass-Off Log")
 *       a=line&block=   how many are waiting in the Dojo pass-off line today + passed today
 *     Same spreadsheet access as before, so no new permissions.
 *   - v1.3: a=rhythm&block=   which rhythm image is on that block's slide right now (the name
 *       Code.gs picked, Script Property rhythm_<set>), for the board's "Show counts" button.
 *       The board has the counts for every image itself; the image's size (bytes) lets it check the
 *       picture in Drive is the one those counts belong to. Drive is already used by Code.gs: no new permissions.
 *   - v1.4: POST {k, a:'rhythmPut', files:[{name, b64}]} puts new rhythm pictures in the Daily Rhythms folder
 *       (used when the picture library is remade; key required, rhythm file names only). A picture it replaces
 *       is moved into the subfolder "Old rhythm pictures", never deleted, so it can be put back.
 *   - v1.5: a=map   the board's World Map content from the Content Pool sheet tabs "Map Songs",
 *       "Map Composers" and "Map Countries" (row 1 = headers; every row as {header: value}).
 *       A missing or empty tab sends [] and the map uses its built-in list. Same sheet as before.
 *   - v1.6 (Mat 11/10): what each class played, for the map's 🌍 button and the class passport.
 *       a=today&block=   reads that block's WORK SESSION box and finds the map songs on it:
 *                        Tradition of Excellence Book 1 numbers ("ToE Book 1 pg. 21 #72") and titles on lines that say
 *                        ToE / Tradition / Book 1 (only for CLOSING.BOOK1_BLOCKS: "Technique Builder #3" never counts),
 *                        plus that class's concert pieces (Map Songs rows with Book # "Concert"; column "Ensemble").
 *                        What it finds is written to the "Map Played" tab (Date | Block | Song | Book # | Country | How),
 *                        one row per date + block + song.
 *       a=passport       every class's played songs (the Map Played tab), for the map's 🛂 Passport.
 *       boardPlayedDaily runs on weekdays ~3 PM and logs all five slides, so days the board is off still count.
 *   - v1.7 (Mat 11/11): Tradition of Excellence Book 2 rows (Map Songs column "Book" = 2). A ToE line counts as the book it
 *       names ("Book 2", "ToE 2", "Book 1"); otherwise the class's usual book (CLOSING.BOOK_DEFAULT: 8th grade = Book 2).
 *       Book 2 songs are keyed and logged as "2-72" so they never mix with Book 1's #72.
 *       setupMapPassport (run once) makes that trigger and adds each class's starting songs (How = "start",
 *       CLOSING.PASSPORT_START). Same spreadsheet + deck as before: no new permissions.
 *
 * Lives in the same Apps Script project as the Daily Slides Code.gs (and NinjaGoals.gs).
 * Nothing in Code.gs needs to change. If saving says doGet is already defined, tell Claude.
 *
 * SET UP (once):
 *   1. Run setupClosingScores (function menu → Run). Approve if asked.
 *      It makes the Monday trigger and the board's secret key.
 *   2. Deploy → New deployment → type "Web app":
 *        Execute as: Me    Who has access: Anyone
 *      Copy the Web app URL.
 *   3. Run showClosingScoresLink and copy the link from the log (Execution log).
 *      Paste it on the board: ☰ → Settings → "Closing scores link". Save.
 *   If you ever change this file: Deploy → Manage deployments → ✏ → Version: New version → Deploy
 *   (keeps the same URL, so nothing changes on the board).
 */

var CLOSING = {
  SLIDES_ID: '1GVCu1ReJy-BPLXHb7omH8ijtz_c-XRWcftUtRguLMjY',      // Daily Rehearsal (All Band Classes)
  LOG_SHEET_ID: '1GeHtIMEPq2RIuceFiaXBoGpsz9tYpx442Q7AbzYp79E',   // Daily Slides content sheet
  LOG_TAB: 'Closing Scores',
  BOARD_TAB: 'Board Settings',
  MAP_TABS: { songs: 'Map Songs', composers: 'Map Composers', countries: 'Map Countries' },
  PLAYED_TAB: 'Map Played',
  BOOK_DEFAULT: { '1st': '2', '3rd': '1', '4th': '1', '6th': '1', '7th': '1' },   // which ToE book a class's plain "ToE #n" means
  BLOCK_BANDS: { '1st': '8th Grade Band', '3rd': '7th Grade Band', '4th': '7th Grade Band',
                 '6th': '6th Grade Intermediate Band', '7th': '6th Grade Beginning Band' },
  // Passport start (Mat 11/10): 8th grade finished Book 1; 7th grade through #80; both 6th grade classes through The Dreidel Song
  PASSPORT_START: { '1st': 'all', '3rd': '#80', '4th': '#80', '6th': 'The Dreidel Song', '7th': 'The Dreidel Song' },
  PLAYED_HOUR: 15,
  ADMIN_ID: '1FZRxwbaoUscTIzidpVT1f7xzz1j1XaJgG6fn67y-yyI',     // Admin - Band Ninja (Pass-Off Log)
  TRACKER_ID: '1SMjkABPZx4e1wHdsZ3aRcmyw17SfEYueodGK_UQICIw',   // Band Ninja Tracker (Pass-Off Line, Pass-Off Targets)
  BLOCKS: ['1st', '3rd', '4th', '6th', '7th'],
  SCORES: ['1', '2', '3'],
  CLEAR_HOUR: 4
};

// ---------------------------------------------------------------- web app

function doGet(e) {
  var p = (e && e.parameter) || {};
  var out;
  try {
    var key = PropertiesService.getScriptProperties().getProperty('closingKey');
    if (!key || p.k !== key) throw new Error('Wrong or missing key. Paste the link from showClosingScoresLink again.');
    if (p.a === 'config' || p.a === 'stats' || p.a === 'line' || p.a === 'rhythm' || p.a === 'map' || p.a === 'today' || p.a === 'passport') {
      out = p.a === 'config' ? { config: boardSettings_() } :
            p.a === 'map' ? boardCached_('boardMap', 60, boardMap_) :
            p.a === 'today' ? boardToday_(String(p.block || ''), new Date()) :
            p.a === 'passport' ? boardCached_('boardPassport', 60, boardPassport_) :
            p.a === 'stats' ? boardStats_(new Date()) :
            p.a === 'rhythm' ? boardRhythm_(String(p.block || '')) : boardLine_(String(p.block || ''), new Date());
      out.ok = true;
      return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
    }
    var block = String(p.block || '');
    if (CLOSING.BLOCKS.indexOf(block) < 0) throw new Error('Unknown block: ' + block);
    if (p.a === 'set') {
      var v = String(p.v == null ? '' : p.v).trim();
      if (v !== '' && CLOSING.SCORES.indexOf(v) < 0) throw new Error('Score must be 1, 2 or 3.');
      var lock = LockService.getScriptLock();
      lock.waitLock(20000);
      try {
        closingSet_(block, String(p.row || ''), String(p.day || ''), v);
      } finally { lock.releaseLock(); }
    }
    out = closingRead_(block);
    out.ok = true;
  } catch (err) {
    out = { ok: false, error: String(err && err.message || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

/** v1.4: uploads of remade rhythm pictures (see the header). */
function doPost(e) {
  var out;
  try {
    var p = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var key = PropertiesService.getScriptProperties().getProperty('closingKey');
    if (!key || p.k !== key) throw new Error('Wrong or missing key.');
    if (p.a !== 'rhythmPut') throw new Error('Unknown action: ' + p.a);
    var lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try { out = { results: rhythmPut_(p.files || []) }; } finally { lock.releaseLock(); }
    out.ok = true;
  } catch (err) {
    out = { ok: false, error: String(err && err.message || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

/** Run once from the editor: asks Google for the Drive permission the picture upload needs (nothing else happens). */
function authorizeRhythmUpload() {
  ScriptApp.requireScopes(ScriptApp.AuthMode.FULL, ['https://www.googleapis.com/auth/drive']);
  Logger.log('Drive permission is in place: rhythm pictures can be uploaded.');
}

var RHYTHM_NAME_ = /^(8th|7th|6int|6beg)_\d-\d_\d{3}\.png$/;
var RHYTHM_OLD_FOLDER_ = 'Old rhythm pictures';

/** Puts each picture in the Daily Rhythms folder. Same size already there = left alone; else the old one moves to the subfolder. */
function rhythmPut_(files) {
  var rc = (typeof CONFIG !== 'undefined' && CONFIG.RHYTHM) || null;
  if (!rc || !rc.FOLDER_ID) throw new Error('Daily Rhythm is off (Code.gs CONFIG.RHYTHM.FOLDER_ID is blank).');
  if (files.length > 40) throw new Error('At most 40 pictures per upload.');
  var folder = DriveApp.getFolderById(rc.FOLDER_ID), old = null, cache = CacheService.getScriptCache();
  return files.map(function (f) {
    var name = String(f.name || '');
    if (!RHYTHM_NAME_.test(name)) return { name: name, error: 'not a rhythm picture name' };
    var bytes = Utilities.base64Decode(String(f.b64 || ''));
    if (bytes.length < 100 || bytes.length > 300000 || bytes[0] !== -119 || bytes[1] !== 80 || bytes[2] !== 78 || bytes[3] !== 71)
      return { name: name, error: 'not a PNG picture' };
    var have = [], it = folder.getFilesByName(name);
    while (it.hasNext()) { var x = it.next(); if (!x.isTrashed()) have.push(x); }
    if (have.length === 1 && have[0].getSize() === bytes.length) return { name: name, done: 'same', bytes: bytes.length };
    if (have.length) {
      if (!old) { var fi = folder.getFoldersByName(RHYTHM_OLD_FOLDER_); old = fi.hasNext() ? fi.next() : folder.createFolder(RHYTHM_OLD_FOLDER_); }
      have.forEach(function (x) { x.moveTo(old); });
    }
    folder.createFile(Utilities.newBlob(bytes, 'image/png', name));
    try { cache.remove('boardRhythmBytes:' + name); } catch (e) {}
    return { name: name, done: have.length ? 'replaced' : 'added', bytes: bytes.length };
  });
}

// ---------------------------------------------------------------- board settings

/** "Board Settings" tab: column A = setting name, column B = value (row 1 = headers). Blank values are left out. */
function boardSettings_() {
  var sh = SpreadsheetApp.openById(CLOSING.LOG_SHEET_ID).getSheetByName(CLOSING.BOARD_TAB);
  var out = {};
  if (!sh || sh.getLastRow() < 2) return out;
  sh.getRange(2, 1, sh.getLastRow() - 1, 2).getDisplayValues().forEach(function (r) {
    var k = String(r[0]).trim(), v = String(r[1]).trim();
    if (k && v) out[k] = v;
  });
  return out;
}

/** World Map tabs: { songs: [...], composers: [...], countries: [...] }, each row {header: shown value}; blank rows skipped. */
function boardMap_() {
  var ss = SpreadsheetApp.openById(CLOSING.LOG_SHEET_ID), out = {};
  Object.keys(CLOSING.MAP_TABS).forEach(function (k) {
    var sh = ss.getSheetByName(CLOSING.MAP_TABS[k]), rows = [];
    if (sh && sh.getLastRow() >= 2 && sh.getLastColumn() >= 1) {
      var v = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getDisplayValues();
      var head = v[0].map(function (h) { return String(h).trim(); });
      for (var r = 1; r < v.length; r++) {
        if (!v[r].some(function (x) { return String(x).trim() !== ''; })) continue;
        var o = {};
        head.forEach(function (h, c) { if (h) o[h] = String(v[r][c]).trim(); });
        rows.push(o);
      }
    }
    out[k] = rows;
  });
  return out;
}

// ---------------------------------------------------------------- v1.6: songs played (🌍 button + passport)

function boardNorm_(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[“”"'’.,!?()&:;#\-–]/g, ' ').replace(/\s+/g, ' ').trim();
}
function boardIsConcert_(s) { return /^concert$/i.test(String(s['Book #'] || '').trim()); }
function boardBookOf_(s) { return String(s['Book'] || '').trim() === '2' ? '2' : '1'; }
function boardSongKey_(s) {
  var n = String(s['Book #'] || '').trim(), b2 = boardBookOf_(s) === '2';
  return /^\d+$/.test(n) ? (b2 ? '2-' + n : n) : String(s['Title'] || '').trim();
}

/** The text of the WORK SESSION box on a block's agenda slide (without the heading). '' if there isn't one. */
function boardWorkText_(block) {
  var re = new RegExp('^\\s*' + block + '\\s+Block\\s+Agenda', 'i');
  var slides = SlidesApp.openById(CLOSING.SLIDES_ID).getSlides();
  for (var i = 0; i < slides.length; i++) {
    var els = slides[i].getPageElements(), isBlock = false, work = null;
    for (var j = 0; j < els.length; j++) {
      if (els[j].getPageElementType() !== SlidesApp.PageElementType.SHAPE) continue;
      var t = els[j].asShape().getText().asString();
      if (re.test(t)) isBlock = true;
      if (/^\s*WORK\s*SESSION/i.test(t)) work = t.replace(/^\s*WORK\s*SESSION[^\n]*\n?/i, '');
    }
    if (isBlock) return work || '';
  }
  return '';
}

/** Map songs named in an agenda's text. Book songs only on lines that say ToE / Tradition / Book 1 / Book 2; the book is the one
 *  the line names, else the class's usual book (CLOSING.BOOK_DEFAULT). */
function boardMatchSongs_(text, block, songs) {
  var band = boardNorm_(CLOSING.BLOCK_BANDS[block] || ''), defBook = (CLOSING.BOOK_DEFAULT || {})[block] || '1';
  var bookRows = songs.filter(function (s) { return !boardIsConcert_(s) && s['Title']; });
  var conc = songs.filter(function (s) { return boardIsConcert_(s) && s['Title']; });
  var out = [], seen = {};
  function add(s, how) {
    var k = boardSongKey_(s); if (seen[k]) return; seen[k] = 1;
    var n = String(s['Book #'] || '').trim();
    out.push({ key: k, n: /^\d+$/.test(n) && boardBookOf_(s) === '2' ? '2-' + n : n, title: String(s['Title']), country: String(s['Country'] || ''), how: how });
  }
  String(text || '').split(/\n+/).forEach(function (line) {
    var l = line.trim(); if (!l) return;
    var nl = ' ' + boardNorm_(l) + ' ';
    if (/\b(toe|t\.o\.e|tradition|book\s*[12])\b/i.test(l)) {
      var bk = /\b(book|toe|tradition)\s*(?:of\s+excellence\s*)?(?:book\s*)?2\b|\bbook\s*2\b/i.test(l) ? '2' : /\bbook\s*1\b/i.test(l) ? '1' : defBook;
      var rows = bookRows.filter(function (s) { return boardBookOf_(s) === bk; });
      var nums = [], m, re = /(?:#|\bnos?\.?\s)\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?((?:\s*(?:,|&|and)\s*#?\s*\d{1,3})*)/gi;
      while ((m = re.exec(l))) {
        var a = +m[1], b = m[2] ? +m[2] : a;
        if (b >= a && b - a <= 15) for (var i = a; i <= b; i++) nums.push(i);
        String(m[3] || '').replace(/\d{1,3}/g, function (x) { nums.push(+x); return x; });
      }
      nums.forEach(function (n) { rows.forEach(function (s) { if (String(s['Book #']).trim() === String(n)) add(s, '#'); }); });
      rows.forEach(function (s) {
        var t = boardNorm_(s['Title']).replace(/^the /, '');
        if (t.length >= 4 && nl.indexOf(' ' + t + ' ') >= 0) add(s, 'title');
      });
    }
    conc.forEach(function (s) {
      if (band && s['Ensemble'] && boardNorm_(s['Ensemble']).indexOf(band) < 0) return;
      var t = boardNorm_(s['Title']);
      if (nl === ' ' + t + ' ' || (t.length >= 8 && nl.indexOf(' ' + t + ' ') >= 0)) add(s, 'concert');
    });
  });
  return out;
}

function boardPlayedSheet_() {
  var ss = SpreadsheetApp.openById(CLOSING.LOG_SHEET_ID), sh = ss.getSheetByName(CLOSING.PLAYED_TAB);
  if (!sh) {
    sh = ss.insertSheet(CLOSING.PLAYED_TAB);
    sh.getRange(1, 1, 1, 6).setValues([['Date', 'Block', 'Song', 'Book #', 'Country', 'How']]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}
function boardPlayedRows_(sh) {
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 6).getDisplayValues();
}
/** Adds date + block + song rows that aren't there yet. Returns how many were added. */
function boardLogPlayed_(date, block, found) {
  if (!found.length) return 0;
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var sh = boardPlayedSheet_(), have = {};
    boardPlayedRows_(sh).forEach(function (r) { have[boardYmd_(r[0]) + '|' + r[1] + '|' + boardNorm_(r[2])] = 1; });
    var add = found.filter(function (f) { return !have[date + '|' + block + '|' + boardNorm_(f.title)]; })
      .map(function (f) { return [date, block, f.title, f.n, f.country, f.how]; });
    if (add.length) sh.getRange(sh.getLastRow() + 1, 1, add.length, 6).setValues(add);
    if (add.length) try { CacheService.getScriptCache().remove('boardPassport'); } catch (e) {}
    return add.length;
  } finally { lock.releaseLock(); }
}

/** a=today&block= : the map songs on that block's agenda right now (and logs them). */
function boardToday_(block, now) {
  if (CLOSING.BLOCKS.indexOf(block) < 0) throw new Error('Unknown block: ' + block);
  var date = boardYmd_(now);
  var songs = boardCached_('boardMap', 60, boardMap_).songs || [];
  var found = boardMatchSongs_(boardWorkText_(block), block, songs);
  var d = now.getDay();
  if (d > 0 && d < 6) boardLogPlayed_(date, block, found);
  return { block: block, date: date, songs: found.map(function (f) { return { key: f.key, n: f.n, title: f.title, country: f.country }; }) };
}

/** a=passport : {blocks: {'1st': [{title, n, country, date, how}], ...}} from the Map Played tab. */
function boardPassport_() {
  var out = {}; CLOSING.BLOCKS.forEach(function (b) { out[b] = []; });
  var sh = SpreadsheetApp.openById(CLOSING.LOG_SHEET_ID).getSheetByName(CLOSING.PLAYED_TAB);
  boardPlayedRows_(sh).forEach(function (r) {
    var b = String(r[1]).trim(); if (!out[b] || !String(r[2]).trim()) return;
    out[b].push({ title: String(r[2]).trim(), n: String(r[3]).trim(), country: String(r[4]).trim(), date: boardYmd_(r[0]), how: String(r[5]).trim() });
  });
  return { blocks: out };
}

/** Weekdays ~3 PM: log every block's slide (so days the board is off still count). */
function boardPlayedDaily() {
  var now = new Date(), d = now.getDay(); if (d === 0 || d === 6) return;
  var songs = boardMap_().songs || [], date = boardYmd_(now);
  CLOSING.BLOCKS.forEach(function (b) {
    try { boardLogPlayed_(date, b, boardMatchSongs_(boardWorkText_(b), b, songs)); } catch (e) { Logger.log(b + ': ' + e); }
  });
}

/** Book 1 songs (Map Songs order) up to a rule: 'all', '#80' (through the last row numbered 80 or lower) or a title. */
function boardStartSongs_(rule, songs) {
  var rows = songs.filter(function (s) { return !boardIsConcert_(s) && s['Title'] && boardBookOf_(s) === '1'; });
  rule = String(rule || '').trim(); if (!rule) return [];
  if (/^all$/i.test(rule)) return rows;
  var end = -1, m = rule.match(/^#\s*(\d+)$/);
  rows.forEach(function (s, i) {
    if (m) { var n = parseInt(s['Book #'], 10); if (/^\d+$/.test(String(s['Book #']).trim()) && n <= +m[1]) end = i; }
    else if (boardNorm_(s['Title']).replace(/^the /, '') === boardNorm_(rule).replace(/^the /, '')) end = i;
  });
  return rows.slice(0, end + 1);
}

/** Run once: the weekday ~3 PM trigger + every class's starting songs (only if the class has no "start" rows yet). */
function setupMapPassport() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'boardPlayedDaily') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('boardPlayedDaily').timeBased().everyDays(1).atHour(CLOSING.PLAYED_HOUR).create();
  var songs = boardMap_().songs || [], sh = boardPlayedSheet_(), started = {};
  boardPlayedRows_(sh).forEach(function (r) { if (String(r[5]).trim() === 'start') started[String(r[1]).trim()] = 1; });
  var add = [];
  CLOSING.BLOCKS.forEach(function (b) {
    if (started[b]) return;
    boardStartSongs_(CLOSING.PASSPORT_START[b], songs).forEach(function (s) {
      add.push(['', b, String(s['Title']), String(s['Book #'] || ''), String(s['Country'] || ''), 'start']);
    });
  });
  if (add.length) sh.getRange(sh.getLastRow() + 1, 1, add.length, 6).setValues(add);
  Logger.log('Map passport ready: trigger set, ' + add.length + ' starting rows added.');
  return add.length;
}

// ---------------------------------------------------------------- pass-off counts for the board (no names)

function boardYmd_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var m = String(v || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return m[3] + '-' + ('0' + m[1]).slice(-2) + '-' + ('0' + m[2]).slice(-2);
  m = String(v || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[0] : '';
}
function boardCached_(key, secs, fn) {
  var c = CacheService.getScriptCache(), hit = c.get(key);
  if (hit) return JSON.parse(hit);
  var v = fn();
  try { c.put(key, JSON.stringify(v), secs); } catch (e) {}
  return v;
}

/** Current quarter from Pass-Off Targets: {name, start, end} as yyyy-MM-dd. */
function boardQuarter_(today) {
  var v = SpreadsheetApp.openById(CLOSING.TRACKER_ID).getSheetByName('Pass-Off Targets').getDataRange().getValues();
  var prevEnd = '', start = '', qs = [];
  v.forEach(function (r) {
    var name = String(r[0]).trim(), d = boardYmd_(r[1] instanceof Date ? r[1] : new Date(r[1]));
    if (/school year starts/i.test(name)) start = d;
    if (/^Q\s*\d/i.test(name) && d) { qs.push({ name: name, start: prevEnd ? boardNextDay_(prevEnd) : start, end: d }); prevEnd = d; }
  });
  for (var i = 0; i < qs.length; i++) if (qs[i].end >= today) return qs[i];
  return qs[qs.length - 1] || { name: '', start: '', end: '' };
}
function boardNextDay_(ymd) {
  var p = ymd.split('-'), d = new Date(+p[0], +p[1] - 1, +p[2] + 1);
  return boardYmd_(d);
}

/** Pass-offs per block: today, this week (since Monday), this quarter. Cached 1 minute. */
function boardStats_(now) {
  var today = boardYmd_(now);
  return boardCached_('boardStats:' + today, 60, function () {
    var q = boardQuarter_(today);
    var mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
    var week = boardYmd_(mon);
    var sh = SpreadsheetApp.openById(CLOSING.ADMIN_ID).getSheetByName('Pass-Off Log');
    var counts = {};
    CLOSING.BLOCKS.forEach(function (b) { counts[b] = { block: b, today: 0, week: 0, quarter: 0 }; });
    if (sh && sh.getLastRow() > 1) {
      sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues().forEach(function (r) {
        var d = boardYmd_(r[0]); if (!d) return;                               // undated history isn't counted
        var b = String(r[2]).replace(/\s*block\s*$/i, '').trim(); if (!counts[b]) return;
        if (q.start && d >= q.start && d <= q.end) counts[b].quarter++;
        if (d >= week && d <= today) counts[b].week++;
        if (d === today) counts[b].today++;
      });
    }
    return { quarter: q.name, quarterEnd: q.end, weekStart: week,
             blocks: CLOSING.BLOCKS.map(function (b) { return counts[b]; }) };
  });
}

/** Dojo pass-off line for one block today: how many waiting, plus passed today (Pass-Off Log). Cached 20 s. */
function boardLine_(block, now) {
  if (CLOSING.BLOCKS.indexOf(block) < 0) throw new Error('Unknown block: ' + block);
  var today = boardYmd_(now);
  return boardCached_('boardLine:' + block + ':' + today, 20, function () {
    var sh = SpreadsheetApp.openById(CLOSING.TRACKER_ID).getSheetByName('Pass-Off Line'), waiting = 0;
    if (sh && sh.getLastRow() > 1) {
      var n = Math.min(400, sh.getLastRow() - 1), first = sh.getLastRow() - n + 1;
      sh.getRange(first, 2, n, 5).getValues().forEach(function (r) {       // Joined | Student | Block | # | Status
        if (boardYmd_(r[0]) !== today) return;
        if (String(r[2]).replace(/\s*block\s*$/i, '').trim() !== block) return;
        if (String(r[4]).trim() === '') waiting++;
      });
    }
    var st = boardStats_(now), row = st.blocks.filter(function (x) { return x.block === block; })[0] || {};
    return { block: block, waiting: waiting, passedToday: row.today || 0 };
  });
}

// ---------------------------------------------------------------- rhythm counts for the board

/** The rhythm now on a block's slide: { block, set, name, meter, date, bytes } (from Code.gs's daily pick). */
function boardRhythm_(block) {
  if (CLOSING.BLOCKS.indexOf(block) < 0) throw new Error('Unknown block: ' + block);
  var rc = (typeof CONFIG !== 'undefined' && CONFIG.RHYTHM) || null;
  if (!rc || !rc.FOLDER_ID) throw new Error('Daily Rhythm is off (Code.gs CONFIG.RHYTHM.FOLDER_ID is blank).');
  var set = rc.BLOCKS[parseInt(block, 10)];
  if (!set) throw new Error('No rhythm set for ' + block + ' Block in Code.gs CONFIG.RHYTHM.BLOCKS.');
  var saved = {};
  try { saved = JSON.parse(PropertiesService.getScriptProperties().getProperty('rhythm_' + set) || '{}'); } catch (e) {}
  if (!saved.name) throw new Error('No rhythm has been picked for ' + set + ' yet.');
  var bytes = boardCached_('boardRhythmBytes:' + saved.name, 600, function () {
    var it = DriveApp.getFolderById(rc.FOLDER_ID).getFilesByName(saved.name);
    return { b: it.hasNext() ? it.next().getSize() : 0 };
  }).b;
  return { block: block, set: set, name: saved.name, meter: saved.meter || '', date: saved.date || '', bytes: bytes };
}

// ---------------------------------------------------------------- table on the slide

/** Finds the block's agenda slide ("1st Block Agenda") and its CLOSING table. */
function closingTable_(block) {
  var deck = SlidesApp.openById(CLOSING.SLIDES_ID);
  var re = new RegExp('^\\s*' + block + '\\s+Block\\s+Agenda', 'i');
  var slides = deck.getSlides();
  for (var i = 0; i < slides.length; i++) {
    var els = slides[i].getPageElements(), isBlock = false, table = null;
    for (var j = 0; j < els.length; j++) {
      var el = els[j], t = el.getPageElementType();
      if (t === SlidesApp.PageElementType.SHAPE && re.test(el.asShape().getText().asString())) isBlock = true;
      if (t === SlidesApp.PageElementType.TABLE) {
        var tb = el.asTable();
        if (/^\s*closing\b/i.test(tb.getCell(0, 0).getText().asString())) table = tb;
      }
    }
    if (isBlock && table) return table;
  }
  throw new Error('No CLOSING table found on the ' + block + ' Block Agenda slide.');
}

function closingCellText_(table, r, c) {
  return table.getCell(r, c).getText().asString().replace(/\n$/, '').trim();
}

/** Day headers (row 0), category labels (column 0) and the current scores. */
function closingRead_(block) {
  var tb = closingTable_(block);
  var days = [], rows = [], values = [];
  for (var c = 1; c < tb.getNumColumns(); c++) days.push(closingCellText_(tb, 0, c));
  for (var r = 1; r < tb.getNumRows(); r++) {
    rows.push(closingCellText_(tb, r, 0));
    var line = [];
    for (var c2 = 1; c2 < tb.getNumColumns(); c2++) line.push(closingCellText_(tb, r, c2));
    values.push(line);
  }
  return { block: block, days: days, rows: rows, values: values };
}

function closingSet_(block, rowLabel, dayLabel, v) {
  var tb = closingTable_(block);
  var r = -1, c = -1;
  for (var i = 1; i < tb.getNumRows(); i++) if (closingCellText_(tb, i, 0).toLowerCase() === rowLabel.toLowerCase()) r = i;
  for (var j = 1; j < tb.getNumColumns(); j++) if (closingCellText_(tb, 0, j).toLowerCase() === dayLabel.toLowerCase()) c = j;
  if (r < 0) throw new Error('No "' + rowLabel + '" row in the ' + block + ' Block closing table.');
  if (c < 0) throw new Error('No "' + dayLabel + '" column in the ' + block + ' Block closing table.');
  closingWriteCell_(tb.getCell(r, c), v);
  closingLog_(block, tb, r, c, v);
}

/** Replaces a cell's text but keeps its font, size, color, bold and alignment. */
function closingWriteCell_(cell, v) {
  var tr = cell.getText();
  var st = tr.getTextStyle();
  var look = { font: st.getFontFamily(), size: st.getFontSize(), bold: st.isBold(), color: null, align: null };
  try { look.color = st.getForegroundColor().asRgbColor().asHexString(); } catch (e) {}
  try { look.align = tr.getParagraphStyle().getParagraphAlignment(); } catch (e) {}
  tr.setText(v === '' ? ' ' : v);              // a space keeps the empty cell's style
  var ns = tr.getTextStyle();
  if (look.font) ns.setFontFamily(look.font);
  if (look.size) ns.setFontSize(look.size);
  if (look.bold !== null && look.bold !== undefined) ns.setBold(look.bold);
  if (look.color) ns.setForegroundColor(look.color);
  if (look.align) { try { tr.getParagraphStyle().setParagraphAlignment(look.align); } catch (e) {} }
}

// ---------------------------------------------------------------- log sheet

function closingLogSheet_() {
  var ss = SpreadsheetApp.openById(CLOSING.LOG_SHEET_ID);
  var sh = ss.getSheetByName(CLOSING.LOG_TAB);
  if (!sh) {
    sh = ss.insertSheet(CLOSING.LOG_TAB);
    sh.getRange(1, 1, 1, 6).setValues([['Date', 'Block', 'Day', 'Category', 'Score', 'Entered']]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function closingLog_(block, tb, r, c, v) {
  var tz = Session.getScriptTimeZone();
  var now = new Date();
  var date = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  var day = closingCellText_(tb, 0, c), cat = closingCellText_(tb, r, 0);
  var sh = closingLogSheet_();
  var last = sh.getLastRow();
  var data = last > 1 ? sh.getRange(2, 1, last - 1, 4).getDisplayValues() : [];
  var rowIdx = -1;
  for (var i = data.length - 1; i >= 0; i--) {
    if (data[i][0] === date && data[i][1] === block && data[i][3] === cat) { rowIdx = i + 2; break; }
  }
  if (v === '') { if (rowIdx > 0) sh.deleteRow(rowIdx); return; }    // cleared box = no score that day
  var line = [[date, block, day, cat, Number(v), now]];
  if (rowIdx > 0) sh.getRange(rowIdx, 1, 1, 6).setValues(line);
  else sh.getRange(last + 1, 1, 1, 6).setValues(line);
}

// ---------------------------------------------------------------- weekly clear + setup

/** Empties every block's closing scores (labels stay). Runs Mondays before school. */
function clearClosingScores() {
  CLOSING.BLOCKS.forEach(function (block) {
    try {
      var tb = closingTable_(block);
      for (var r = 1; r < tb.getNumRows(); r++)
        for (var c = 1; c < tb.getNumColumns(); c++)
          if (closingCellText_(tb, r, c) !== '') closingWriteCell_(tb.getCell(r, c), '');
    } catch (err) { Logger.log(block + ': ' + err.message); }
  });
}

function setupClosingScores() {
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('closingKey')) props.setProperty('closingKey', Utilities.getUuid().replace(/-/g, '').slice(0, 20));
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'clearClosingScores') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('clearClosingScores').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(CLOSING.CLEAR_HOUR).create();
  closingLogSheet_();
  CLOSING.BLOCKS.forEach(function (b) { closingTable_(b); });   // checks every slide has its table
  Logger.log('Set up. Now deploy as a Web app (Execute as Me, Anyone), then run showClosingScoresLink.');
}

/** Prints the link to paste into the board's Settings. */
function showClosingScoresLink() {
  var key = PropertiesService.getScriptProperties().getProperty('closingKey');
  if (!key) throw new Error('Run setupClosingScores first.');
  var url = ScriptApp.getService().getUrl() || '';
  if (/\/exec$/.test(url)) {
    Logger.log('Paste this into the board (☰ → Settings → Closing scores link):\n' + url + '?k=' + key);
  } else {
    Logger.log('Copy the Web app URL from Deploy → Manage deployments (it ends in /exec), then add this to the end:\n?k=' + key +
               '\nand paste the whole thing into the board (☰ → Settings → Closing scores link).');
  }
}
