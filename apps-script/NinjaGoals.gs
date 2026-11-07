/**
 * NinjaGoals.gs  v1.0  (Raven Band, 11/6/2026)
 *
 * Fills the "QUARTER PROGRESS GOAL" box on each Band Ninja Day slide
 * from the Progress Charts "Pass-Off Targets" tab:
 *   line 2 = "<goal> pass-offs"   (this quarter's target for that slide's grade)
 *   line 3 = "Due <Month d, yyyy>" (quarter end minus DUE_DAYS_BEFORE_END,
 *                                    moved back to Friday if it lands on a weekend)
 *
 * The box is found by its alt-text title "ninja:goal".
 * The grade is read from the slide's title ("8th Grade Band Ninja Day").
 * The look of each line (font, size, color) is kept.
 *
 * Lives in the same Apps Script project as the Daily Slides Code.gs.
 * Nothing in Code.gs needs to change.
 *
 * SET UP (once):  pick setupNinjaGoalsTrigger in the function menu and press Run.
 *                 That runs it once now and every morning around 5 AM from then on.
 * RUN BY HAND:    pick updateNinjaGoals and press Run.
 */

var NINJA = {
  DECK_ID: '1HLmyd7srbW3C_vkgyAofsAeZ3T4afLs5PmqXTEIKIYU',          // Band_Ninja_Day slides
  TRACKER_ID: '1SMjkABPZx4e1wHdsZ3aRcmyw17SfEYueodGK_UQICIw',       // Progress Charts (Band Ninja tracker)
  TARGETS_TAB: 'Pass-Off Targets',
  DUE_DAYS_BEFORE_END: 5,                                           // Dec 16 end -> due Dec 11
  GOAL_TAG: 'ninja:goal',
  TRIGGER_HOUR: 5
};

/** Main job: update the goal box on every Band Ninja slide. */
function updateNinjaGoals() {
  var q = ninjaCurrentQuarter_(new Date());
  if (!q) throw new Error('No quarter rows found on "' + NINJA.TARGETS_TAB + '".');
  var due = ninjaDueDate_(q.end);
  var dueText = 'Due ' + Utilities.formatDate(due, Session.getScriptTimeZone(), 'MMMM d, yyyy');

  var deck = SlidesApp.openById(NINJA.DECK_ID);
  var report = [];
  deck.getSlides().forEach(function (slide, i) {
    var goalShape = null, grade = null;
    slide.getShapes().forEach(function (sh) {
      if (sh.getTitle() === NINJA.GOAL_TAG) goalShape = sh;
      if (!grade) {
        var m = sh.getText().asString().match(/\b(6|7|8)th\s+Grade\b/i);
        if (m) grade = m[1];
      }
    });
    if (!goalShape) return;                       // not a Band Ninja goal slide
    if (!grade) { report.push('Slide ' + (i + 1) + ': no "6th/7th/8th Grade" title found, skipped'); return; }
    var goal = q.targets[grade];
    if (goal === undefined || goal === '') { report.push('Slide ' + (i + 1) + ': no ' + grade + 'th grade target for ' + q.name); return; }

    var changed = ninjaSetLine_(goalShape, 1, goal + ' pass-offs');
    changed = ninjaSetLine_(goalShape, 2, dueText) || changed;
    report.push(grade + 'th grade: ' + goal + ' pass-offs, ' + dueText + (changed ? ' (updated)' : ' (already right)'));
  });
  Logger.log(q.name + ' ends ' + q.end.toDateString() + '\n' + report.join('\n'));
  return report;
}

/** One-time setup: daily 5 AM trigger (no duplicates), then a first run. */
function setupNinjaGoalsTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'updateNinjaGoals') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('updateNinjaGoals').timeBased().everyDays(1).atHour(NINJA.TRIGGER_HOUR).create();
  updateNinjaGoals();
}

/**
 * Reads Pass-Off Targets. Header row has "Quarter", "Ends" and "6th/7th/8th Grade".
 * Returns the first quarter whose end date is today or later (else the last one).
 */
function ninjaCurrentQuarter_(today) {
  var sh = SpreadsheetApp.openById(NINJA.TRACKER_ID).getSheetByName(NINJA.TARGETS_TAB);
  if (!sh) throw new Error('Tab "' + NINJA.TARGETS_TAB + '" not found in Progress Charts.');
  var v = sh.getDataRange().getValues();
  var hr = -1, cEnd = -1, cQ = 0, cGrade = {};
  for (var r = 0; r < v.length && hr < 0; r++) {
    for (var c = 0; c < v[r].length; c++) {
      var h = String(v[r][c]).trim();
      if (/^ends?\b/i.test(h)) { hr = r; cEnd = c; }
      var g = h.match(/^(6|7|8)th\s+grade/i);
      if (g) cGrade[g[1]] = c;
      if (/^quarter/i.test(h)) cQ = c;
    }
  }
  if (hr < 0) throw new Error('No "Ends" header found on "' + NINJA.TARGETS_TAB + '".');

  var day = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  var quarters = [];
  for (var r2 = hr + 1; r2 < v.length; r2++) {
    var name = String(v[r2][cQ]).trim();
    var end = v[r2][cEnd];
    if (!/^Q\s*\d/i.test(name) || !(end instanceof Date)) continue;
    var t = {};
    Object.keys(cGrade).forEach(function (k) { t[k] = v[r2][cGrade[k]]; });
    quarters.push({ name: name, end: new Date(end.getFullYear(), end.getMonth(), end.getDate()), targets: t });
  }
  for (var i = 0; i < quarters.length; i++) if (quarters[i].end >= day) return quarters[i];
  return quarters.length ? quarters[quarters.length - 1] : null;
}

/** Quarter end minus the offset; a Saturday or Sunday moves back to Friday. */
function ninjaDueDate_(end) {
  var d = new Date(end.getFullYear(), end.getMonth(), end.getDate() - NINJA.DUE_DAYS_BEFORE_END);
  if (d.getDay() === 6) d.setDate(d.getDate() - 1);
  if (d.getDay() === 0) d.setDate(d.getDate() - 2);
  return d;
}

/**
 * Replaces paragraph n (0-based) of a shape's text, keeping that line's look.
 * Returns true if the text changed.
 */
function ninjaSetLine_(shape, n, text) {
  var tf = shape.getText();
  var paras = tf.getParagraphs();
  if (paras.length <= n) throw new Error('Goal box has fewer than ' + (n + 1) + ' lines.');
  var pr = paras[n].getRange();
  var s = pr.getStartIndex(), e = pr.getEndIndex();
  if (tf.asString().charAt(e - 1) === '\n') e--;
  var old = tf.getRange(s, e);
  if (old.asString() === text) return false;

  var st = old.getTextStyle();
  var look = {
    font: st.getFontFamily(), size: st.getFontSize(), bold: st.isBold(),
    color: st.getForegroundColor() ? st.getForegroundColor().asRgbColor().asHexString() : null
  };
  var fresh = old.setText(text);
  var ns = fresh.getTextStyle();
  if (look.font) ns.setFontFamily(look.font);
  if (look.size) ns.setFontSize(look.size);
  if (look.bold !== null) ns.setBold(look.bold);
  if (look.color) ns.setForegroundColor(look.color);
  return true;
}
