/* ==========================================================================
   Utils — Mathe, Easing, Zufall, Formatierung, Speicher
   ========================================================================== */

(function (root) {
  'use strict';

  var Utils = {};

  /* ------------------------------------------------------------------ Mathe */

  Utils.clamp = function (v, lo, hi) {
    return v < lo ? lo : (v > hi ? hi : v);
  };

  Utils.lerp = function (a, b, t) {
    return a + (b - a) * t;
  };

  /* Fortschritt 0..1 zwischen zwei Zeitpunkten. */
  Utils.progress = function (elapsed, duration) {
    if (duration <= 0) return 1;
    return Utils.clamp(elapsed / duration, 0, 1);
  };

  /* ----------------------------------------------------------------- Easing */

  Utils.easeOutCubic = function (t) {
    var f = 1 - t;
    return 1 - f * f * f;
  };

  Utils.easeInCubic = function (t) {
    return t * t * t;
  };

  Utils.easeInOutCubic = function (t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };

  /* Schiesst leicht ueber das Ziel hinaus — gibt dem Tausch Gewicht. */
  Utils.easeOutBack = function (t) {
    var c1 = 1.70158;
    var c3 = c1 + 1;
    var f = t - 1;
    return 1 + c3 * f * f * f + c1 * f * f;
  };

  /* Federt am Ende nach — fuer nachrutschende Steine. */
  Utils.easeOutBounce = function (t) {
    var n1 = 7.5625;
    var d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) { t -= 1.5 / d1; return n1 * t * t + 0.75; }
    if (t < 2.5 / d1) { t -= 2.25 / d1; return n1 * t * t + 0.9375; }
    t -= 2.625 / d1;
    return n1 * t * t + 0.984375;
  };

  /* Hin und zurueck: 0 -> 1 -> 0. Fuer den ungueltigen Tausch. */
  Utils.pingPong = function (t) {
    return t < 0.5 ? Utils.easeOutCubic(t * 2) : Utils.easeOutCubic((1 - t) * 2);
  };

  /* ----------------------------------------------------------------- Zufall */

  /* Mulberry32 — kleiner, schneller PRNG mit Seed, damit Board-Tests
     reproduzierbar laufen koennen. */
  Utils.makeRng = function (seed) {
    var a = (seed >>> 0) || (Date.now() >>> 0);
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  Utils.randInt = function (rng, maxExclusive) {
    return Math.floor(rng() * maxExclusive);
  };

  Utils.pick = function (rng, arr) {
    return arr[Utils.randInt(rng, arr.length)];
  };

  /* Fisher-Yates, in-place. */
  Utils.shuffleArray = function (rng, arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Utils.randInt(rng, i + 1);
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  };

  /* ----------------------------------------------------------- Formatierung */

  Utils.formatTime = function (seconds) {
    var s = Math.max(0, Math.ceil(seconds));
    var m = Math.floor(s / 60);
    var r = s % 60;
    return m + ':' + (r < 10 ? '0' : '') + r;
  };

  Utils.formatNumber = function (n) {
    return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  /* Namen aus Formularen sind Freitext und landen sowohl im DOM als auch
     serverseitig in einer JSON-Datei — hier fliegt alles raus, was kein
     druckbares Zeichen ist. */
  Utils.sanitizeName = function (raw) {
    var name = String(raw == null ? '' : raw)
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 16);
    return name || 'Spieler';
  };

  Utils.relativeTime = function (timestamp) {
    var diff = Date.now() - timestamp;
    if (!isFinite(diff) || diff < 0) return 'gerade eben';
    var min = Math.floor(diff / 60000);
    if (min < 1) return 'gerade eben';
    if (min < 60) return 'vor ' + min + ' Min.';
    var h = Math.floor(min / 60);
    if (h < 24) return 'vor ' + h + ' Std.';
    var d = Math.floor(h / 24);
    if (d < 30) return 'vor ' + d + (d === 1 ? ' Tag' : ' Tagen');
    return new Date(timestamp).toLocaleDateString('de-DE');
  };

  /* --------------------------------------------------------------- Speicher */

  /* localStorage wirft im Privatmodus mancher Browser und bei vollem
     Kontingent. Fuer ein Spiel ist das kein Grund abzustuerzen — im
     Zweifel laeuft es einfach ohne Persistenz weiter. */
  Utils.storeGet = function (key, fallback) {
    try {
      var raw = root.localStorage.getItem(key);
      if (raw == null) return fallback;
      return JSON.parse(raw);
    } catch (err) {
      return fallback;
    }
  };

  Utils.storeSet = function (key, value) {
    try {
      root.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      return false;
    }
  };

  /* -------------------------------------------------------------- Sonstiges */

  Utils.prefersReducedMotion = function () {
    try {
      return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (err) {
      return false;
    }
  };

  /* Farbe mit Alpha aus einem #rrggbb-String. */
  Utils.withAlpha = function (hex, alpha) {
    var h = hex.replace('#', '');
    var r = parseInt(h.slice(0, 2), 16);
    var g = parseInt(h.slice(2, 4), 16);
    var b = parseInt(h.slice(4, 6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  };

  root.M3 = root.M3 || {};
  root.M3.Utils = Utils;

  if (typeof module !== 'undefined' && module.exports) module.exports = Utils;

})(typeof globalThis !== 'undefined' ? globalThis : this);
