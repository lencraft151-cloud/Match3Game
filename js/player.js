/* ==========================================================================
   Player — Leben, Kristalle und Power-Up-Vorrat.

   Alles liegt in localStorage. Die Leben fuellen sich bei jedem Datumswechsel
   wieder auf: pro Tag hat man also eine feste Anzahl Versuche, und wer mehr
   will, kauft sie mit Kristallen aus gewonnenen Leveln.

   Das ist bewusst ein reiner Client-Zustand — wer will, kann ihn im Browser
   manipulieren. Fuer ein Spiel ohne Konten ist das in Ordnung; eine
   faelschungssichere Variante braeuchte serverseitige Spielstaende.
   ========================================================================== */

(function (root) {
  'use strict';

  var Utils = root.M3.Utils;
  var CONFIG = root.M3.CONFIG;

  var Player = {};

  /* Preise und Anzeigedaten der Power-Ups an einer Stelle. */
  var ITEMS = {
    hammer: {
      key: 'hammer',
      name: 'Hammer',
      icon: '🔨',
      price: CONFIG.PRICE_HAMMER,
      hint: 'Zerschlägt einen beliebigen Stein — auch einen Fels.'
    },
    shuffle: {
      key: 'shuffle',
      name: 'Mischen',
      icon: '🔀',
      price: CONFIG.PRICE_SHUFFLE,
      hint: 'Würfelt das ganze Feld neu durch.'
    },
    time: {
      key: 'time',
      name: 'Zeit',
      icon: '⏱️',
      price: CONFIG.PRICE_TIME,
      hint: '+' + CONFIG.POWERUP_TIME_BONUS + ' Sekunden auf die Uhr.'
    }
  };

  Player.ITEMS = ITEMS;
  Player.ITEM_KEYS = ['hammer', 'shuffle', 'time'];

  /* --------------------------------------------------------------- Zustand */

  var state = null;

  /* Lokales Datum, nicht UTC — sonst springt der Tageswechsel je nach
     Zeitzone mitten in den Abend. */
  function todayKey() {
    var d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  function defaults() {
    return {
      crystals: 0,
      lives: CONFIG.MAX_LIVES,
      day: todayKey(),
      powerups: {
        hammer: CONFIG.STARTING_POWERUPS.hammer,
        shuffle: CONFIG.STARTING_POWERUPS.shuffle,
        time: CONFIG.STARTING_POWERUPS.time
      }
    };
  }

  /* Fremde oder beschaedigte Werte werden hier eingefangen — ein kaputter
     Eintrag im localStorage darf das Spiel nicht lahmlegen. */
  function sanitize(raw) {
    var base = defaults();
    if (!raw || typeof raw !== 'object') return base;

    var out = {
      crystals: clampInt(raw.crystals, 0, 9999999, 0),
      lives: clampInt(raw.lives, 0, CONFIG.LIVES_CAP, CONFIG.MAX_LIVES),
      day: typeof raw.day === 'string' ? raw.day : base.day,
      powerups: {}
    };

    Player.ITEM_KEYS.forEach(function (key) {
      var stored = raw.powerups ? raw.powerups[key] : undefined;
      out.powerups[key] = clampInt(stored, 0, 99, base.powerups[key]);
    });

    return out;
  }

  function clampInt(value, lo, hi, fallback) {
    var n = Math.floor(Number(value));
    if (!isFinite(n)) return fallback;
    return Utils.clamp(n, lo, hi);
  }

  function save() {
    Utils.storeSet(CONFIG.STORE_PLAYER, state);
  }

  /* Neuer Tag heisst: Leben wieder voll. Gekaufte Extraleben ueber dem
     Tagesmaximum bleiben erhalten, sonst waere der Kauf am Abend verschenkt. */
  function refreshDay() {
    var key = todayKey();
    if (state.day === key) return false;

    state.day = key;
    state.lives = Math.max(state.lives, CONFIG.MAX_LIVES);
    save();
    return true;
  }

  Player.load = function () {
    state = sanitize(Utils.storeGet(CONFIG.STORE_PLAYER, null));
    refreshDay();
    save();
    return Player.snapshot();
  };

  /* Vor jedem Lesezugriff pruefen, ob inzwischen ein neuer Tag angebrochen
     ist — sonst haengt ein ueber Mitternacht offenes Tab auf null Leben. */
  Player.snapshot = function () {
    if (!state) Player.load();
    refreshDay();

    return {
      crystals: state.crystals,
      lives: state.lives,
      maxLives: CONFIG.MAX_LIVES,
      powerups: {
        hammer: state.powerups.hammer,
        shuffle: state.powerups.shuffle,
        time: state.powerups.time
      }
    };
  };

  /* ----------------------------------------------------------------- Leben */

  Player.hasLife = function () {
    return Player.snapshot().lives > 0;
  };

  /* Ein verlorener Lauf kostet ein Leben. Liefert die verbleibende Zahl. */
  Player.loseLife = function () {
    Player.snapshot();
    state.lives = Math.max(0, state.lives - 1);
    save();
    return state.lives;
  };

  /* ------------------------------------------------------------- Kristalle */

  /* Belohnung fuer ein geschafftes Level. */
  Player.crystalsForLevel = function (level, secondsLeft) {
    return CONFIG.CRYSTALS_BASE +
      CONFIG.CRYSTALS_PER_LEVEL * Math.max(1, level) +
      Math.floor(Math.max(0, secondsLeft) / 2) * CONFIG.CRYSTALS_PER_2_SECONDS;
  };

  Player.earn = function (amount) {
    Player.snapshot();
    var gain = Math.max(0, Math.round(amount) || 0);
    state.crystals = Math.min(9999999, state.crystals + gain);
    save();
    return state.crystals;
  };

  Player.canAfford = function (price) {
    return Player.snapshot().crystals >= price;
  };

  /* ------------------------------------------------------------- Einkaeufe */

  /* Liefert { ok, reason } — die UI zeigt den Grund direkt an, statt einen
     stillen Fehlschlag zu produzieren. */
  Player.buyLife = function () {
    Player.snapshot();

    if (state.lives >= CONFIG.LIVES_CAP) {
      return { ok: false, reason: 'Mehr als ' + CONFIG.LIVES_CAP + ' Leben gehen nicht.' };
    }
    if (state.crystals < CONFIG.PRICE_LIFE) {
      return { ok: false, reason: 'Dafür fehlen dir ' + (CONFIG.PRICE_LIFE - state.crystals) + ' Kristalle.' };
    }

    state.crystals -= CONFIG.PRICE_LIFE;
    state.lives += 1;
    save();
    return { ok: true, lives: state.lives, crystals: state.crystals };
  };

  Player.buyPowerUp = function (key) {
    Player.snapshot();

    var item = ITEMS[key];
    if (!item) return { ok: false, reason: 'Unbekanntes Power-Up.' };

    if (state.powerups[key] >= 99) {
      return { ok: false, reason: 'Davon hast du schon genug.' };
    }
    if (state.crystals < item.price) {
      return { ok: false, reason: 'Dafür fehlen dir ' + (item.price - state.crystals) + ' Kristalle.' };
    }

    state.crystals -= item.price;
    state.powerups[key] += 1;
    save();
    return { ok: true, count: state.powerups[key], crystals: state.crystals };
  };

  /* ---------------------------------------------------------- Power-Ups */

  Player.countOf = function (key) {
    return Player.snapshot().powerups[key] || 0;
  };

  /* Verbraucht ein Power-Up. Liefert false, wenn keines mehr da ist. */
  Player.consume = function (key) {
    Player.snapshot();
    if (!state.powerups[key]) return false;

    state.powerups[key] -= 1;
    save();
    return true;
  };

  /* ------------------------------------------------------------ Zuruecksetzen */

  /* Nur fuer Tests und die Konsole. */
  Player.reset = function () {
    state = defaults();
    save();
    return Player.snapshot();
  };

  root.M3.Player = Player;

})(typeof globalThis !== 'undefined' ? globalThis : this);
