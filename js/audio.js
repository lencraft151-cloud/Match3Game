/* ==========================================================================
   Audio — alle Effekte werden zur Laufzeit synthetisiert.

   Kein einziges Sample im Repo: das haelt das Spiel klein und macht es auf
   GitHub Pages sofort lauffaehig. Der AudioContext entsteht erst bei der
   ersten Nutzergeste, sonst blockieren ihn die Autoplay-Regeln der Browser.
   ========================================================================== */

(function (root) {
  'use strict';

  var Utils = root.M3.Utils;
  var CONFIG = root.M3.CONFIG;

  var ctx = null;
  var master = null;
  var noiseBuffer = null;
  var muted = Utils.storeGet(CONFIG.STORE_MUTED, false) === true;

  var Audio = {};

  function ensureContext() {
    if (ctx) return ctx;

    var Ctor = root.AudioContext || root.webkitAudioContext;
    if (!Ctor) return null;

    try {
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.35;
      master.connect(ctx.destination);
    } catch (err) {
      /* Ohne Ton laesst sich immer noch prima spielen. */
      ctx = null;
    }
    return ctx;
  }

  /* Wird von der ersten Nutzergeste aufgerufen. */
  Audio.unlock = function () {
    var c = ensureContext();
    if (c && c.state === 'suspended') c.resume();
  };

  Audio.isMuted = function () {
    return muted;
  };

  Audio.setMuted = function (value) {
    muted = !!value;
    Utils.storeSet(CONFIG.STORE_MUTED, muted);
    if (master) {
      master.gain.setTargetAtTime(muted ? 0 : 0.35, ctx.currentTime, 0.02);
    }
    return muted;
  };

  Audio.toggleMute = function () {
    return Audio.setMuted(!muted);
  };

  /* ------------------------------------------------------------ Bausteine */

  /* Ein Ton mit Huellkurve. */
  function tone(opts) {
    var c = ensureContext();
    if (!c || muted) return;

    var now = c.currentTime + (opts.delay || 0);
    var dur = opts.duration || 0.18;

    var osc = c.createOscillator();
    var gain = c.createGain();

    osc.type = opts.type || 'sine';
    osc.frequency.setValueAtTime(opts.freq, now);
    if (opts.freqTo) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.freqTo), now + dur);
    }

    var peak = opts.gain === undefined ? 0.3 : opts.gain;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  /* Gefiltertes Rauschen — Basis fuer Explosionen. */
  function noise(opts) {
    var c = ensureContext();
    if (!c || muted) return;

    if (!noiseBuffer) {
      var len = Math.floor(c.sampleRate * 0.5);
      noiseBuffer = c.createBuffer(1, len, c.sampleRate);
      var data = noiseBuffer.getChannelData(0);
      for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }

    var now = c.currentTime + (opts.delay || 0);
    var dur = opts.duration || 0.3;

    var src = c.createBufferSource();
    src.buffer = noiseBuffer;

    var filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(opts.cutoff || 1800, now);
    filter.frequency.exponentialRampToValueAtTime(180, now + dur);

    var gain = c.createGain();
    gain.gain.setValueAtTime(opts.gain === undefined ? 0.32 : opts.gain, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(now);
    src.stop(now + dur + 0.02);
  }

  /* ---------------------------------------------------------- Spieleffekte */

  Audio.swap = function () {
    tone({ type: 'triangle', freq: 420, freqTo: 620, duration: 0.1, gain: 0.16 });
  };

  Audio.invalid = function () {
    tone({ type: 'sawtooth', freq: 190, freqTo: 120, duration: 0.16, gain: 0.14 });
  };

  Audio.select = function () {
    tone({ type: 'sine', freq: 660, duration: 0.07, gain: 0.12 });
  };

  /* Steigt mit der Kaskadenstufe — die Tonleiter macht lange Ketten hörbar. */
  Audio.match = function (cascade) {
    var step = Math.min(11, Math.max(0, (cascade || 1) - 1));
    var base = 523.25 * Math.pow(2, step / 12);
    tone({ type: 'triangle', freq: base, freqTo: base * 1.5, duration: 0.2, gain: 0.2 });
    tone({ type: 'sine', freq: base * 2, duration: 0.14, gain: 0.1, delay: 0.03 });
  };

  Audio.specialBorn = function () {
    tone({ type: 'sine', freq: 700, freqTo: 1500, duration: 0.26, gain: 0.2 });
    tone({ type: 'sine', freq: 1050, freqTo: 2100, duration: 0.22, gain: 0.12, delay: 0.05 });
  };

  Audio.explode = function () {
    noise({ duration: 0.36, cutoff: 2400, gain: 0.3 });
    tone({ type: 'sine', freq: 160, freqTo: 45, duration: 0.32, gain: 0.28 });
  };

  Audio.beam = function () {
    noise({ duration: 0.24, cutoff: 4200, gain: 0.18 });
    tone({ type: 'sawtooth', freq: 900, freqTo: 200, duration: 0.24, gain: 0.14 });
  };

  Audio.rainbow = function () {
    [0, 0.05, 0.1, 0.15, 0.2].forEach(function (d, i) {
      tone({ type: 'sine', freq: 520 * Math.pow(2, i / 5), duration: 0.3, gain: 0.14, delay: d });
    });
  };

  Audio.blocker = function () {
    noise({ duration: 0.22, cutoff: 1100, gain: 0.24 });
  };

  Audio.shuffle = function () {
    tone({ type: 'triangle', freq: 300, freqTo: 900, duration: 0.4, gain: 0.16 });
  };

  Audio.tick = function () {
    tone({ type: 'square', freq: 880, duration: 0.06, gain: 0.1 });
  };

  Audio.levelUp = function () {
    [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) {
      tone({ type: 'triangle', freq: f, duration: 0.4, gain: 0.2, delay: i * 0.09 });
    });
  };

  Audio.gameOver = function () {
    [440, 349.23, 293.66, 220].forEach(function (f, i) {
      tone({ type: 'triangle', freq: f, duration: 0.5, gain: 0.2, delay: i * 0.14 });
    });
  };

  /* ---------------------------------------------------- Oberflaeche */

  /* Kurzer, trockener Klick fuer jeden Knopf. */
  Audio.click = function () {
    tone({ type: 'square', freq: 520, freqTo: 720, duration: 0.05, gain: 0.09 });
  };

  /* Popup faehrt auf. */
  Audio.popupIn = function () {
    tone({ type: 'sine', freq: 300, freqTo: 620, duration: 0.18, gain: 0.14 });
  };

  /* Popup verschwindet. */
  Audio.popupOut = function () {
    tone({ type: 'sine', freq: 560, freqTo: 260, duration: 0.14, gain: 0.11 });
  };

  /* Knoten auf der Landkarte. */
  Audio.mapNode = function () {
    tone({ type: 'triangle', freq: 620, freqTo: 880, duration: 0.12, gain: 0.15 });
  };

  /* ----------------------------------------------------- Belohnungen */

  /* Ein Stern fliegt ins Ergebnisfenster. Der Index hebt die Tonhoehe an,
     damit drei Sterne wie ein aufsteigender Dreiklang klingen. */
  Audio.star = function (index) {
    var base = 660 * Math.pow(2, (index || 0) / 6);
    tone({ type: 'triangle', freq: base, freqTo: base * 1.5, duration: 0.32, gain: 0.22 });
    tone({ type: 'sine', freq: base * 2, duration: 0.22, gain: 0.12, delay: 0.04 });
  };

  /* Kristalle werden gutgeschrieben — kleines Klimpern. */
  Audio.crystals = function () {
    [0, 0.06, 0.12].forEach(function (d, i) {
      tone({ type: 'sine', freq: 1200 + i * 260, duration: 0.14, gain: 0.13, delay: d });
    });
  };

  /* Kauf abgeschlossen. */
  Audio.purchase = function () {
    tone({ type: 'triangle', freq: 520, duration: 0.1, gain: 0.16 });
    tone({ type: 'triangle', freq: 780, duration: 0.16, gain: 0.16, delay: 0.08 });
    tone({ type: 'sine', freq: 1560, duration: 0.2, gain: 0.09, delay: 0.12 });
  };

  /* Kauf nicht moeglich. */
  Audio.denied = function () {
    tone({ type: 'square', freq: 240, freqTo: 160, duration: 0.14, gain: 0.11 });
  };

  /* Eine Aufgabe ist erfuellt. */
  Audio.goalDone = function () {
    tone({ type: 'sine', freq: 880, duration: 0.14, gain: 0.18 });
    tone({ type: 'sine', freq: 1320, duration: 0.24, gain: 0.15, delay: 0.09 });
  };

  /* -------------------------------------------------------- Im Spiel */

  /* Hammerschlag — trockener als eine Bombe. */
  Audio.hammer = function () {
    noise({ duration: 0.2, cutoff: 3200, gain: 0.3 });
    tone({ type: 'square', freq: 220, freqTo: 60, duration: 0.18, gain: 0.24 });
  };

  /* Ein Blitz im Zug-Finale. */
  Audio.finaleZap = function (index) {
    var base = 700 + ((index || 0) % 6) * 90;
    tone({ type: 'sawtooth', freq: base, freqTo: base * 0.4, duration: 0.16, gain: 0.15 });
  };

  /* Ein Leben ist weg. */
  Audio.lifeLost = function () {
    tone({ type: 'sine', freq: 420, freqTo: 180, duration: 0.38, gain: 0.2 });
  };

  /* Zuege werden knapp. */
  Audio.lowMoves = function () {
    tone({ type: 'square', freq: 660, duration: 0.08, gain: 0.12 });
    tone({ type: 'square', freq: 520, duration: 0.1, gain: 0.1, delay: 0.1 });
  };

  root.M3.Audio = Audio;

})(typeof globalThis !== 'undefined' ? globalThis : this);
