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

  /* Preise und Anzeigedaten der Booster an einer Stelle.

     `art` benennt die gezeichnete Form — die Icons sind keine Emojis mehr,
     sondern werden von js/icons.js gemalt. So sehen sie in der Leiste, im
     Shop und in der Anleitung gleich aus und passen zum Rest des Spiels. */
  var ITEMS = {
    rocket: {
      key: 'rocket',
      art: 'rocket',
      name: 'Rakete',
      effect: 'Reihe räumen',
      price: CONFIG.PRICE_ROCKET,
      hint: 'Tippe ein Feld an — die Rakete fegt die ganze Reihe oder Spalte leer.'
    },
    bomb: {
      key: 'bomb',
      art: 'bomb',
      name: 'Bombe',
      effect: '3×3 sprengen',
      price: CONFIG.PRICE_BOMB,
      hint: 'Tippe ein Feld an: es und alle acht Nachbarn fliegen raus, Felsen inklusive.'
    },
    moves: {
      key: 'moves',
      art: 'moves',
      name: 'Extra-Züge',
      /* Auf der schmalen Karte in der Leiste bricht "Extra-Züge" um und macht
         die Karte hoeher als ihre Nachbarn. Dort steht deshalb die
         Kurzform. */
      short: 'Züge',
      effect: '+' + CONFIG.POWERUP_EXTRA_MOVES + ' Züge',
      price: CONFIG.PRICE_MOVES,
      hint: 'Legt ' + CONFIG.POWERUP_EXTRA_MOVES +
        ' Züge drauf. Kostet selbst keinen Zug.'
    },
    shuffle: {
      key: 'shuffle',
      art: 'shuffle',
      name: 'Mischen',
      effect: 'neues Feld',
      price: CONFIG.PRICE_SHUFFLE,
      hint: 'Würfelt das Feld neu und sorgt für mindestens ' +
        CONFIG.POWERUP_SHUFFLE_MIN_MOVES + ' mögliche Züge.'
    }
  };

  Player.ITEMS = ITEMS;
  Player.ITEM_KEYS = ['rocket', 'bomb', 'moves', 'shuffle'];

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
      /* Zeitpunkt, an dem das naechste Herz faellig ist. Nur gesetzt, wenn
         ueberhaupt Herzen fehlen. */
      nextRegenAt: 0,
      /* Muenzen sind die zweite Waehrung: sie kommen nur aus geschafften
         Leveln und gehen nur in die Zimmer. Kristalle bleiben fuer den Shop
         zustaendig — zwei Toepfe, damit Einrichten und Weiterkommen nicht um
         dieselbe Muenze konkurrieren. */
      coins: 0,
      powerups: powerupDefaults()
    };
  }

  function powerupDefaults() {
    var out = {};
    Player.ITEM_KEYS.forEach(function (key) {
      out[key] = CONFIG.STARTING_POWERUPS[key] || 0;
    });
    return out;
  }

  /* Fremde oder beschaedigte Werte werden hier eingefangen — ein kaputter
     Eintrag im localStorage darf das Spiel nicht lahmlegen. */
  function sanitize(raw) {
    var base = defaults();
    if (!raw || typeof raw !== 'object') return base;

    var out = {
      crystals: clampInt(raw.crystals, 0, 9999999, 0),
      coins: clampInt(raw.coins, 0, 9999999, 0),
      lives: clampInt(raw.lives, 0, CONFIG.LIVES_CAP, CONFIG.MAX_LIVES),
      day: typeof raw.day === 'string' ? raw.day : base.day,
      nextRegenAt: clampInt(raw.nextRegenAt, 0, 8640000000000000, 0),
      powerups: {}
    };

    /* Der Hammer ist zur Bombe geworden. Ein alter Vorrat verfaellt deshalb
       nicht, sondern wird uebernommen — verlorene Kaeufe waeren die
       schlechteste Art, eine Umbenennung zu feiern. */
    if (raw.powerups && raw.powerups.hammer > 0 && !(raw.powerups.bomb > 0)) {
      raw.powerups.bomb = raw.powerups.hammer;
    }

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
    state.nextRegenAt = 0;
    return true;
  }

  /* Fuellt auf, was seit dem letzten Blick faellig geworden ist. Gerechnet
     wird ueber die tatsaechlich vergangene Zeit, nicht ueber Timer-Ticks —
     so stimmt es auch, wenn das Tab stundenlang geschlossen war.

     Gekaufte Extraleben ueber MAX_LIVES bleiben unangetastet; nachgefuellt
     wird nur bis zum normalen Maximum. */
  function refreshRegen(now) {
    if (state.lives >= CONFIG.MAX_LIVES) {
      state.nextRegenAt = 0;
      return false;
    }

    /* Erstes fehlendes Herz startet die Uhr. */
    if (!state.nextRegenAt) {
      state.nextRegenAt = now + CONFIG.LIFE_REGEN_MS;
      return true;
    }

    if (now < state.nextRegenAt) return false;

    var elapsed = now - state.nextRegenAt;
    var earned = 1 + Math.floor(elapsed / CONFIG.LIFE_REGEN_MS);
    var missing = CONFIG.MAX_LIVES - state.lives;
    var gained = Math.min(earned, missing);

    state.lives += gained;

    if (state.lives >= CONFIG.MAX_LIVES) {
      state.nextRegenAt = 0;
    } else {
      /* Angebrochenes Fenster nicht verschenken. */
      state.nextRegenAt = now + (CONFIG.LIFE_REGEN_MS - (elapsed % CONFIG.LIFE_REGEN_MS));
    }
    return true;
  }

  /* Beides zusammen, mit genau einem Speichervorgang. */
  function refresh() {
    var changed = refreshDay();
    if (refreshRegen(Date.now())) changed = true;
    if (changed) save();
    return changed;
  }

  Player.load = function () {
    state = sanitize(Utils.storeGet(CONFIG.STORE_PLAYER, null));
    refresh();
    save();
    return Player.snapshot();
  };

  /* Vor jedem Lesezugriff nachrechnen — sonst haengt ein lange offenes Tab
     auf null Leben, obwohl laengst welche nachgewachsen sind. */
  Player.snapshot = function () {
    if (!state) Player.load();
    refresh();

    var powerups = {};
    Player.ITEM_KEYS.forEach(function (key) {
      powerups[key] = state.powerups[key] || 0;
    });

    return {
      crystals: state.crystals,
      coins: state.coins,
      lives: state.lives,
      maxLives: CONFIG.MAX_LIVES,
      nextRegenAt: state.nextRegenAt,
      msToNextLife: state.nextRegenAt ? Math.max(0, state.nextRegenAt - Date.now()) : 0,
      powerups: powerups
    };
  };

  /* ----------------------------------------------------------------- Leben */

  Player.hasLife = function () {
    return Player.snapshot().lives > 0;
  };

  /* Ein verlorenes Level kostet ein Leben. Liefert die verbleibende Zahl. */
  Player.loseLife = function () {
    Player.snapshot();
    state.lives = Math.max(0, state.lives - 1);

    /* Faellt man unter das Maximum, laeuft ab jetzt die Nachfuell-Uhr. */
    if (state.lives < CONFIG.MAX_LIVES && !state.nextRegenAt) {
      state.nextRegenAt = Date.now() + CONFIG.LIFE_REGEN_MS;
    }

    save();
    return state.lives;
  };

  /* ------------------------------------------------------------- Kristalle */

  /* Belohnung fuer ein geschafftes Level: Grundwert plus Levelstufe plus
     Sterne. */
  Player.crystalsForLevel = function (level, stars) {
    return CONFIG.CRYSTALS_BASE +
      CONFIG.CRYSTALS_PER_LEVEL * Math.max(1, level) +
      CONFIG.CRYSTALS_PER_STAR * Utils.clamp(Math.floor(stars) || 0, 0, 3);
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

  /* ---------------------------------------------------------------- Muenzen */

  /* Muenzen fuers Einrichten. Bewusst ein zweiter Topf neben den Kristallen:
     wer sein Zimmer schoen machen will, soll dafuer nicht auf das Extra-Leben
     verzichten muessen, das ihn weiterbringt. */
  Player.coinsForLevel = function (level, stars) {
    return CONFIG.COINS_BASE +
      CONFIG.COINS_PER_LEVEL * Math.max(1, level) +
      CONFIG.COINS_PER_STAR * Utils.clamp(Math.floor(stars) || 0, 0, 3);
  };

  Player.earnCoins = function (amount) {
    Player.snapshot();
    var gain = Math.max(0, Math.round(amount) || 0);
    state.coins = Math.min(9999999, state.coins + gain);
    save();
    return state.coins;
  };

  Player.canAffordCoins = function (price) {
    return Player.snapshot().coins >= price;
  };

  /* Bucht Muenzen ab. Liefert false, wenn es nicht reicht — dann wird auch
     nichts abgebucht. */
  Player.spendCoins = function (price) {
    Player.snapshot();
    var cost = Math.max(0, Math.round(price) || 0);
    if (state.coins < cost) return false;

    state.coins -= cost;
    save();
    return true;
  };

  /* Bucht Kristalle ab, ohne dafuer einen Gegenstand zu liefern — etwa fuer
     die Extra-Zuege im Verloren-Popup. Gibt false zurueck, wenn das Guthaben
     nicht reicht; abgebucht wird dann nichts. */
  Player.spend = function (price) {
    Player.snapshot();
    if (state.crystals < price) return false;

    state.crystals -= price;
    save();
    return true;
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
