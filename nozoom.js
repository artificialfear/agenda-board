/* nozoom.js (2.17.1, Mat 11/16): stops iPads (and touch Chromebooks) from zooming the student pages when a student taps fast.
   iPad Safari ignores "user-scalable=no" and treats two quick taps as "double-tap to zoom", so tapping a rhythm zoomed the page
   and the rhythm slid off the screen. Loaded by tap.html and practice.html.
   NoZoom.pad(el): the TAP pad. Every touch on it is a tap for scoring and never a zoom, scroll or click.
   The rest of the page: two quick taps on anything that isn't a button / input / link don't zoom; pinch-zoom is blocked;
   if the page is already zoomed in it snaps back the next time it's touched. */
(function () {
  "use strict";
  var lastEnd = 0;
  var CTRL = /^(BUTTON|INPUT|SELECT|TEXTAREA|A|LABEL)$/;
  function isCtrl(t) {
    for (var n = t; n && n !== document; n = n.parentNode) if (CTRL.test(n.tagName || "")) return true;
    return false;
  }
  function zoomed() { return !!(window.visualViewport && window.visualViewport.scale > 1.01); }
  // Re-applying the viewport tag is the one thing that makes iPad Safari drop back to 100%.
  function unzoom() {
    var m = document.querySelector('meta[name="viewport"]');
    if (!m) return;
    var c = "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover, user-scalable=no";
    m.setAttribute("content", c + ", ");
    setTimeout(function () { m.setAttribute("content", c); }, 30);
  }
  // Double-tap anywhere that isn't a control: cancel the second tap's zoom.
  document.addEventListener("touchend", function (e) {
    var now = Date.now(), quick = now - lastEnd < 400;
    lastEnd = now;
    if (quick && !isCtrl(e.target) && e.cancelable) e.preventDefault();
    if (zoomed()) unzoom();
  }, { passive: false });
  // Pinch (Safari's own gesture events) and double-click zoom.
  ["gesturestart", "gesturechange", "gestureend"].forEach(function (t) {
    document.addEventListener(t, function (e) { e.preventDefault(); }, { passive: false });
  });
  document.addEventListener("dblclick", function (e) { e.preventDefault(); }, { passive: false });
  document.addEventListener("touchmove", function (e) {
    if (e.touches && e.touches.length > 1 && e.cancelable) e.preventDefault();   // two fingers = pinch
  }, { passive: false });

  window.NoZoom = {
    pad: function (el) {
      if (!el || el.__noZoom) return;
      el.__noZoom = true;
      // pointerdown (the scoring) fires before these, so cancelling them only stops the zoom / scroll / click.
      var stop = function (e) { if (e.cancelable) e.preventDefault(); };
      el.addEventListener("touchstart", stop, { passive: false });
      el.addEventListener("touchend", stop, { passive: false });
      el.addEventListener("touchmove", stop, { passive: false });
      el.addEventListener("dblclick", stop, { passive: false });
    },
    unzoom: unzoom
  };
})();
