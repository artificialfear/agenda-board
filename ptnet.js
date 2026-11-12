/* Playing Test remote: the connection between the board and a phone/iPad (Mat 11/12, like Grudgeball's remote).
   PeerJS (lib/peerjs.min.js, loaded only when needed) links the two over the free PeerJS service: straight over the Wi-Fi
   when it can, through a relay when it can't. Nothing is stored anywhere but the two devices.
   Tests open both pages with ?peerfake=1: a stand-in Peer that talks over BroadcastChannel (same browser), no internet. */
window.PTNET = (function () {
  "use strict";
  var PREFIX = "ravenband-ptest-v1-";
  var ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ";            // no I or O
  var FAKE = /[?&]peerfake=1\b/.test(location.search);

  function loadScript(src, ok, bad) {
    var s = document.createElement("script");
    s.src = src; s.onload = ok; s.onerror = bad || function () {};
    document.head.appendChild(s);
  }
  function ready(cb) {
    if (FAKE || window.Peer) { cb(true); return; }
    loadScript("lib/peerjs.min.js", function () { cb(!!window.Peer); }, function () { cb(false); });
  }
  function qrReady(cb) {
    if (window.qrcode) { cb(true); return; }
    loadScript("lib/qrcode.js", function () { cb(!!window.qrcode); }, function () { cb(false); });
  }
  function qrSvg(text) {
    try { var q = window.qrcode(0, "M"); q.addData(text); q.make(); return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); }
    catch (e) { return ""; }
  }
  function newCode() {
    var c = "";
    for (var i = 0; i < 4; i++) c += ALPHA[Math.floor(Math.random() * ALPHA.length)];
    return c;
  }

  // ---- stand-in Peer for tests ----
  function Emitter() { this._h = {}; }
  Emitter.prototype.on = function (ev, fn) { (this._h[ev] = this._h[ev] || []).push(fn); return this; };
  Emitter.prototype.emit = function (ev, a) { (this._h[ev] || []).slice().forEach(function (fn) { try { fn(a); } catch (e) { console.error(e); } }); };
  function FakeConn(peer, to) { Emitter.call(this); this.p = peer; this.peer = to; this.open = false; }
  FakeConn.prototype = Object.create(Emitter.prototype);
  FakeConn.prototype.send = function (d) {
    if (!this.open) return;
    this.p.bc.postMessage({ t: "data", to: this.peer, from: this.p.id, d: JSON.parse(JSON.stringify(d)) });
  };
  FakeConn.prototype.close = function () {
    if (!this.open) return;
    this.open = false;
    try { this.p.bc.postMessage({ t: "close", to: this.peer, from: this.p.id }); } catch (e) {}
    this.emit("close");
  };
  function FakePeer(id) {
    Emitter.call(this);
    var self = this;
    this.id = id || "fake-" + Math.random().toString(36).slice(2);
    this.conns = {}; this.destroyed = false; this.disconnected = false;
    this.bc = new BroadcastChannel("ptfake");
    this.bc.onmessage = function (e) {
      var m = e.data, c;
      if (!m || m.to !== self.id || self.destroyed) return;
      if (m.t === "conn") {
        c = new FakeConn(self, m.from); self.conns[m.from] = c;
        self.emit("connection", c);
        c.open = true; c.emit("open");                  // open on this side before the other side can send
        self.bc.postMessage({ t: "ack", to: m.from, from: self.id });
      } else if (m.t === "ack") {
        c = self.conns[m.from]; if (c && !c.open) { c.open = true; c.emit("open"); }
      } else if (m.t === "data") {
        c = self.conns[m.from]; if (c && c.open) c.emit("data", m.d);
      } else if (m.t === "close") {
        c = self.conns[m.from]; if (c && c.open) { c.open = false; c.emit("close"); }
      }
    };
    setTimeout(function () { if (!self.destroyed) self.emit("open", self.id); }, 5);
  }
  FakePeer.prototype = Object.create(Emitter.prototype);
  FakePeer.prototype.connect = function (to) {
    var self = this, c = new FakeConn(this, to);
    this.conns[to] = c;
    this.bc.postMessage({ t: "conn", to: to, from: this.id });
    setTimeout(function () { if (!c.open && !self.destroyed) self.emit("error", { type: "peer-unavailable" }); }, 2500);
    return c;
  };
  FakePeer.prototype.reconnect = function () {};
  FakePeer.prototype.destroy = function () {
    if (this.destroyed) return;
    var self = this;
    Object.keys(this.conns).forEach(function (k) { try { self.conns[k].close(); } catch (e) {} });
    this.destroyed = true;
    try { this.bc.close(); } catch (e) {}
  };

  function makePeer(id) {
    if (FAKE) return new FakePeer(id);
    return id ? new window.Peer(id, { debug: 0 }) : new window.Peer({ debug: 0 });
  }

  return { PREFIX: PREFIX, FAKE: FAKE, ready: ready, qrReady: qrReady, qrSvg: qrSvg, newCode: newCode, makePeer: makePeer };
})();
