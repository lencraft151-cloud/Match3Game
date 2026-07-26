/* ==========================================================================
   Main — Bootstrap, Eingabe, Bildschleife, Ablaufsteuerung.

   Der Weg durch das Spiel:

       Titel -> Karte -> Levelstart-Popup -> Spiel
                  ^                            |
                  +---- Gewonnen / Verloren <--+

   game.js meldet ueber Hooks, was passiert ist; hier faellt die Entscheidung,
   welcher Screen zu sehen ist und was das fuer Leben und Kristalle bedeutet.
   ========================================================================== */

(function (root) {
  'use strict';

  var doc = root.document;

  var Utils = root.M3.Utils;
  var CONFIG = root.M3.CONFIG;
  var Audio = root.M3.Audio;
  var Levels = root.M3.Levels;
  var Leaderboard = root.M3.Leaderboard;
  var Player = root.M3.Player;
  var UI = root.M3.UI;
  var Map = root.M3.Map;
  var Tutorial = root.M3.Tutorial;
  var Game = root.M3.Game;
  var COLORS = root.M3.GEM_COLORS;

  var game = null;
  var backdrop = null;
  var clock = 0;
  var lastFrame = 0;

  /* ------------------------------------------------------------ Spielstand */

  /* Hoechstes freigeschaltetes Level und die Sterne je Level.

     Der Schluessel traegt bewusst die Version v2: der Fortschritt aelterer
     Staende wird damit nicht uebernommen, jeder faengt wieder bei Level 1 an.
     Kristalle, Leben und Power-Ups haengen an einem eigenen Schluessel und
     bleiben erhalten. */
  var progressState = loadProgress();

  function loadProgress() {
    var raw = Utils.storeGet(CONFIG.STORE_PROGRESS, null);

    if (raw && typeof raw === 'object') {
      return {
        unlocked: Math.max(1, Math.floor(raw.unlocked) || 1),
        stars: (raw.stars && typeof raw.stars === 'object') ? raw.stars : {}
      };
    }

    return { unlocked: 1, stars: {} };
  }

  function saveProgress() {
    Utils.storeSet(CONFIG.STORE_PROGRESS, progressState);
  }

  /* Laufende Gesamtpunkte ueber alle Level — das ist der Wert fuer die
     Bestenliste. */
  var lifetimeScore = Math.max(0, parseInt(Utils.storeGet(CONFIG.STORE_LIFETIME, 0), 10) || 0);

  /* Zustand des gerade laufenden Levels. */
  var activeLevel = 1;
  var continuesUsed = 0;
  var lastWin = null;
  var lastFail = null;

  function continuePrice() {
    return CONFIG.CONTINUE_PRICE + continuesUsed * CONFIG.CONTINUE_PRICE_STEP;
  }

  /* ====================================================================== */
  /*  Hintergrund-Steine                                                    */
  /* ====================================================================== */

  function Backdrop(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.gems = [];
    this.w = 0;
    this.h = 0;
    this.slow = Utils.prefersReducedMotion() ? 0.25 : 1;
    this.resize();
  }

  Backdrop.prototype.resize = function () {
    var dpr = Math.min(root.devicePixelRatio || 1, 2);
    this.w = root.innerWidth;
    this.h = root.innerHeight;

    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var wanted = Utils.prefersReducedMotion() ? 6 : Math.round(Utils.clamp(this.w / 90, 8, 18));
    while (this.gems.length < wanted) this.gems.push(this.makeGem(true));
    this.gems.length = wanted;
  };

  Backdrop.prototype.makeGem = function (anywhere) {
    return {
      x: Math.random() * this.w,
      y: anywhere ? Math.random() * this.h : this.h + 60,
      r: 14 + Math.random() * 40,
      type: Math.floor(Math.random() * COLORS.length),
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 0.5,
      vy: -(8 + Math.random() * 22),
      vx: (Math.random() - 0.5) * 14,
      alpha: 0.05 + Math.random() * 0.1
    };
  };

  Backdrop.prototype.update = function (dt) {
    var step = dt * this.slow;

    for (var i = 0; i < this.gems.length; i++) {
      var g = this.gems[i];
      g.y += g.vy * step;
      g.x += g.vx * step;
      g.rot += g.vrot * step;
      if (g.y < -80) this.gems[i] = this.makeGem(false);
    }
  };

  Backdrop.prototype.draw = function () {
    var ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);

    for (var i = 0; i < this.gems.length; i++) {
      var g = this.gems[i];
      ctx.save();
      ctx.globalAlpha = g.alpha;
      ctx.translate(g.x, g.y);
      ctx.rotate(g.rot);
      ctx.fillStyle = COLORS[g.type];
      ctx.shadowBlur = 28;
      ctx.shadowColor = COLORS[g.type];
      root.M3.traceGemShape(ctx, g.type, g.r);
      ctx.fill();
      ctx.restore();
    }
  };

  /* ====================================================================== */
  /*  Layout                                                                */
  /* ====================================================================== */

  function setViewportUnit() {
    doc.documentElement.style.setProperty('--vh', root.innerHeight + 'px');
  }

  /* Das Brett bekommt den Platz zwischen HUD, Power-Leiste und Fusszeile. */
  function layoutBoard() {
    var screen = doc.getElementById('screen-game');
    var hud = doc.querySelector('.hud');
    var bar = doc.getElementById('powerbar');
    var foot = doc.querySelector('.game-foot');
    if (!screen || !game) return;

    var style = root.getComputedStyle(screen);
    var padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    var padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    var gaps = (parseFloat(style.rowGap || style.gap) || 10) * 3;

    var availableW = screen.clientWidth - padX;
    var availableH = screen.clientHeight - padY - gaps -
      (hud ? hud.offsetHeight : 0) -
      (bar ? bar.offsetHeight : 0) -
      (foot ? foot.offsetHeight : 0);

    var size = Math.min(availableW, availableH, 560);

    if (!isFinite(size) || size < 40) {
      size = Math.min(root.innerWidth - 32, root.innerHeight - 300, 560);
    }

    game.resize(Utils.clamp(size, 200, 560));
  }

  function onResize() {
    setViewportUnit();
    if (backdrop) backdrop.resize();
    layoutBoard();
    if (UI.current() === 'screen-map') Map.render(progressState.unlocked, progressState.stars);
  }

  /* ====================================================================== */
  /*  Ablauf                                                                */
  /* ====================================================================== */

  function openMap(scrollSmooth) {
    UI.closeAllOverlays();
    UI.refreshWallet();
    UI.show('screen-map');
    Map.render(progressState.unlocked, progressState.stars);
    Map.scrollToCurrent(progressState.unlocked, !!scrollSmooth);
  }

  /* Knoten auf der Karte angetippt. Geschaffte Level lassen sich wiederholen,
     um fehlende Sterne nachzuholen. */
  function openLevelStart(level) {
    Audio.unlock();
    Audio.mapNode();
    Audio.popupIn();
    activeLevel = level;
    UI.showLevelStart(Levels.get(level), level < progressState.unlocked);
  }

  function beginLevel(level) {
    /* Das Uebungslevel kostet nichts und laesst sich nicht verlieren. */
    if (!Levels.isTutorial(level) && !Player.hasLife()) {
      UI.closeAllOverlays();
      openShop('Keine Leben mehr. Ein Extra-Leben kostet ' + CONFIG.PRICE_LIFE + ' Kristalle.');
      return;
    }

    activeLevel = level;
    continuesUsed = 0;

    UI.closeAllOverlays();
    UI.resetStatCache();
    UI.show('screen-game');

    /* Erst nach dem Screen-Wechsel messen — vorher hat der Wrapper noch
       nicht seine endgueltige Groesse. */
    layoutBoard();
    game.startLevel(level);
    layoutBoard();

    /* Erst die Anzeige auf das Level einstellen, dann die Kette starten —
       sie setzt als Erstes ihre eigene Sperre. */
    UI.setPowerUnlimited(Levels.isTutorial(level));
    UI.setPowerLock(false);

    if (Levels.isTutorial(level)) {
      startTutorial();
    } else {
      Tutorial.stop();
      game.setGuide(null);
    }
  }

  /* Die Erklaerkette bekommt genau die vier Faeden, die sie ins Spiel
     braucht — mehr weiss tutorial.js nicht vom Rest. */
  function startTutorial() {
    Tutorial.start({
      setGuide: function (mode, item) {
        game.setGuide(mode, item);
        UI.setPowerLock(!Tutorial.allows('power'));
      },
      goalDone: function () {
        return root.M3.Goals.allDone(game.def.goals, game.progress);
      },
      finish: function () {
        game.finishGuided();
      }
    });
  }

  var hooks = {
    onStats: function (stats) {
      UI.updateStats(stats);
      if (Tutorial.isActive() && stats.goals &&
          root.M3.Goals.allDone(stats.goals, stats.progress)) {
        Tutorial.notify('goal');
      }
    },

    /* Der Riegel: solange die Erklaerkette laeuft, endet das Uebungslevel
       nicht — auch wenn die Aufgabe laengst erfuellt ist. */
    canComplete: function () {
      return !Tutorial.isActive();
    },

    onSwap: function () {
      Tutorial.notify('swap');
    },

    /* Die Fuehrung hat etwas abgewiesen. */
    onGuideBlocked: function (text) {
      UI.setHint(text, true);
      Tutorial.nudge();
    },

    onHint: function (text, warn) {
      UI.setHint(text, warn);
    },

    onLevelComplete: function (data) {
      Tutorial.stop();
      lastWin = data;

      /* Fortschritt sichern: freischalten und die beste Sternzahl behalten. */
      var best = progressState.stars[data.level] || 0;
      progressState.stars[data.level] = Math.max(best, data.stars);
      progressState.unlocked = Math.max(progressState.unlocked, data.nextLevel);
      saveProgress();

      lifetimeScore += data.levelScore;
      Utils.storeSet(CONFIG.STORE_LIFETIME, lifetimeScore);

      var crystals = Player.crystalsForLevel(data.level, data.stars);
      Player.earn(crystals);

      UI.showWin(data, crystals);

      /* Sterne nacheinander, danach das Kristall-Klimpern. */
      for (var i = 0; i < data.stars; i++) {
        (function (n) {
          root.setTimeout(function () { Audio.star(n); }, 260 + n * 220);
        })(i);
      }
      root.setTimeout(function () { Audio.crystals(); }, 300 + data.stars * 220);
    },

    onLevelFailed: function (data) {
      Audio.popupIn();
      lastFail = data;
      var price = continuePrice();
      UI.showFail(data, price, Player.canAfford(price));
    },

    onArmChange: function (key) {
      UI.setArmed(key);
    },

    onPowerUsed: function (key) {
      /* Im Uebungslevel sind Power-Ups unbegrenzt — dort wird nichts vom
         Vorrat abgezogen, sonst wuerde Ueben Geld kosten. */
      if (!Levels.isTutorial(activeLevel)) {
        Player.consume(key);
        UI.refreshPowerBar();
      }
      Tutorial.notify('power');
    }
  };

  /* Endgueltig aufgeben: jetzt erst kostet es ein Leben. */
  function giveUpLevel() {
    Tutorial.stop();

    /* Aus dem Uebungslevel darf man jederzeit raus, ohne etwas zu zahlen. */
    if (!Levels.isTutorial(activeLevel)) {
      Player.loseLife();
      UI.pulseHearts();
      Audio.lifeLost();
    }

    game.stop();
    openMap();
  }

  /* ====================================================================== */
  /*  Shop und Power-Ups                                                    */
  /* ====================================================================== */

  function openShop(message) {
    UI.renderShop();
    UI.setShopState(message || '', message ? 'warn' : null);
    UI.show('screen-shop');
  }

  function buy(action) {
    var result = action === 'life' ? Player.buyLife() : Player.buyPowerUp(action);

    if (!result.ok) {
      Audio.denied();
      UI.setShopState(result.reason, 'warn');
      return;
    }

    Audio.purchase();

    var label = action === 'life' ? 'Extra-Leben' : Player.ITEMS[action].name;
    UI.setShopState(label + ' gekauft.', 'ok');

    UI.renderShop();
    UI.refreshWallet();
  }

  function usePower(key) {
    if (!game.acceptsInput()) return;

    /* Erneutes Antippen entschaerft den Hammer wieder. */
    if (key === 'hammer' && game.armed === 'hammer') {
      game.disarm();
      return;
    }

    /* Waehrend eines Lese-Schritts im Uebungslevel sind die Power-Ups zu. */
    if (!Tutorial.allows('power')) {
      Audio.denied();
      UI.setHint('Lies erst zu Ende — dann geht es weiter', true);
      Tutorial.nudge();
      return;
    }

    /* Im Uebungslevel gibt es sie unbegrenzt, damit Ausprobieren wirklich
       nichts kostet. */
    var free = Levels.isTutorial(activeLevel);

    /* Leerer Vorrat darf nicht einfach wirkungslos verpuffen — sonst wirkt
       der Knopf kaputt statt leer. */
    if (!free && Player.countOf(key) <= 0) {
      UI.setHint(Player.ITEMS[key].name + ' aufgebraucht — im Shop nachkaufen für ' +
        Player.ITEMS[key].price + ' Kristalle', true);
      return;
    }

    if (key === 'hammer') game.armHammer();
    else if (key === 'shuffle') game.usePowerShuffle();
    else if (key === 'moves') game.usePowerMoves();
  }

  /* ====================================================================== */
  /*  Eingabe                                                               */
  /* ====================================================================== */

  function canvasPoint(canvas, event) {
    var rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.clientWidth / rect.width),
      y: (event.clientY - rect.top) * (canvas.clientHeight / rect.height)
    };
  }

  function bindCanvas(canvas) {
    canvas.addEventListener('pointerdown', function (e) {
      Audio.unlock();
      canvas.focus({ preventScroll: true });
      if (canvas.setPointerCapture) {
        try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* egal */ }
      }
      var p = canvasPoint(canvas, e);
      game.pointerDown(p.x, p.y);
      e.preventDefault();
    });

    canvas.addEventListener('pointermove', function (e) {
      if (e.buttons === 0 && e.pointerType === 'mouse') return;
      var p = canvasPoint(canvas, e);
      game.pointerMove(p.x, p.y);
    });

    canvas.addEventListener('pointerup', function () { game.pointerUp(); });
    canvas.addEventListener('pointercancel', function () { game.pointerUp(); });
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }

  function bindKeys() {
    doc.addEventListener('keydown', function (e) {
      if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;

      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        if (UI.current() === 'screen-game') {
          togglePause();
          e.preventDefault();
        }
        return;
      }

      if (UI.current() !== 'screen-game') return;
      if (game.keyDown(e.key)) e.preventDefault();
    });
  }

  function togglePause() {
    if (!game.running) return;

    if (game.paused) {
      game.resume();
      UI.overlay('screen-pause', false);
    } else {
      game.pause();
      UI.overlay('screen-pause', true);
    }
  }

  /* ====================================================================== */
  /*  Knoepfe                                                               */
  /* ====================================================================== */

  function on(id, handler) {
    var el = doc.getElementById(id);
    if (el) el.addEventListener('click', function (e) {
      Audio.unlock();
      Audio.click();
      handler(e);
    });
  }

  function bindButtons() {
    /* --- Titel --- */
    on('btn-start', function () { openMap(); });
    on('btn-help', function () { UI.show('screen-help'); });
    on('btn-help-back', function () {
      UI.show(progressState.unlocked > 1 ? 'screen-map' : 'screen-title');
      if (UI.current() === 'screen-map') openMap();
    });

    /* --- Karte --- */
    on('btn-shop', function () { openShop(); });
    on('btn-map-help', function () { UI.show('screen-help'); });
    on('btn-scores', function () {
      UI.prepareScoreScreen(lifetimeScore);
      UI.show('screen-scores');
      UI.loadScores();
    });

    /* --- Levelstart --- */
    on('btn-level-play', function () { beginLevel(activeLevel); });
    on('btn-level-back', function () { UI.overlay('screen-levelstart', false); });

    /* --- Spiel --- */
    on('btn-pause', togglePause);
    on('btn-resume', togglePause);

    on('btn-restart', function () {
      UI.overlay('screen-pause', false);
      beginLevel(activeLevel);
    });

    /* Mitten im Level zur Karte: gilt als Aufgeben. */
    on('btn-quit', giveUpLevel);

    on('pw-hammer', function () { usePower('hammer'); });
    on('pw-shuffle', function () { usePower('shuffle'); });
    on('pw-moves', function () { usePower('moves'); });

    /* --- Gewonnen --- */
    on('btn-win-next', function () {
      UI.overlay('screen-win', false);
      openMap(true);
    });

    /* --- Verloren --- */
    on('btn-continue-buy', function () {
      var price = continuePrice();
      if (!Player.canAfford(price)) {
        UI.setContinueState('Dafür fehlen dir ' +
          (price - Player.snapshot().crystals) + ' Kristalle.', 'warn');
        return;
      }

      Player.spend(price);
      continuesUsed++;

      UI.overlay('screen-fail', false);
      UI.refreshWallet();
      game.grantMoves(CONFIG.CONTINUE_MOVES);
    });

    on('btn-fail-retry', function () {
      /* Ein neuer Versuch kostet das Leben fuer den gescheiterten. */
      Player.loseLife();
      UI.pulseHearts();
      Audio.lifeLost();
      UI.overlay('screen-fail', false);
      beginLevel(activeLevel);
    });

    on('btn-fail-map', giveUpLevel);

    /* --- Shop --- */
    on('btn-shop-back', function () {
      UI.refreshWallet();
      openMap();
    });

    doc.getElementById('shop-list').addEventListener('click', function (e) {
      var button = e.target.closest ? e.target.closest('[data-buy]') : null;
      if (!button || button.disabled) return;
      Audio.unlock();
      buy(button.dataset.buy);
    });

    /* --- Bestenliste --- */
    on('tab-online', function () { UI.setScoreTab('online'); UI.loadScores(); });
    on('tab-local', function () { UI.setScoreTab('local'); UI.loadScores(); });
    on('btn-scores-back', function () { openMap(); });

    doc.getElementById('score-form').addEventListener('submit', function (e) {
      e.preventDefault();
      submitScore();
    });

    /* --- Ton --- */
    on('btn-mute', function () {
      var muted = Audio.toggleMute();
      doc.body.classList.toggle('is-muted', muted);
    });
  }

  function submitScore() {
    UI.setSubmitState('Wird gesendet…');

    Leaderboard.submit(UI.nameValue(), lifetimeScore, progressState.unlocked)
      .then(function (result) {
        UI.lockSubmit();
        UI.highlight(result.entry);

        if (result.online) {
          UI.setSubmitState(
            result.rank ? 'Eingetragen — Platz ' + result.rank + ' online' : 'Online eingetragen',
            'ok'
          );
        } else if (result.queued) {
          UI.setSubmitState('Server nicht erreichbar — lokal gespeichert (Platz ' +
            result.localRank + ') und wird später nachgereicht.', 'warn');
        } else {
          UI.setSubmitState('Lokal gespeichert — Platz ' + result.localRank, 'ok');
        }

        UI.loadScores();
      });
  }

  /* ====================================================================== */
  /*  Bildschleife                                                          */
  /* ====================================================================== */

  function frame(now) {
    var dt = lastFrame ? (now - lastFrame) / 1000 : 0;
    lastFrame = now;
    clock += Math.min(dt, 0.05);

    backdrop.update(Math.min(dt, 0.05));
    backdrop.draw();

    game.update(dt);
    game.render(clock);

    root.requestAnimationFrame(frame);
  }

  /* ====================================================================== */
  /*  Start                                                                 */
  /* ====================================================================== */

  function boot() {
    Player.load();
    UI.init();

    backdrop = new Backdrop(doc.getElementById('bg-canvas'));
    game = new Game(doc.getElementById('board-canvas'), hooks);
    root.M3.__game = game;

    Map.init({ onSelect: openLevelStart });
    Tutorial.init();

    /* Ein Board vorbereiten, damit das Canvas nie leer dasteht. */
    game.startLevel(progressState.unlocked);
    game.stop();

    setViewportUnit();
    layoutBoard();

    bindCanvas(game.canvas);
    bindKeys();
    bindButtons();

    doc.body.classList.toggle('is-muted', Audio.isMuted());

    root.addEventListener('resize', onResize);
    root.addEventListener('orientationchange', function () {
      root.setTimeout(onResize, 120);
    });

    doc.addEventListener('visibilitychange', function () {
      if (doc.hidden && game.running && !game.paused && UI.current() === 'screen-game') {
        togglePause();
      }
      /* Beim Zurueckkommen koennen Herzen nachgewachsen sein. */
      if (!doc.hidden) UI.refreshWallet();
    });

    /* Der Herz-Countdown laeuft sekundenweise mit, solange die Karte offen
       ist — haeufiger waere Verschwendung, seltener wirkt es kaputt. */
    root.setInterval(function () {
      if (UI.current() === 'screen-map' || UI.current() === 'screen-shop') UI.refreshWallet();
    }, 1000);

    Leaderboard.flushPending();

    root.requestAnimationFrame(frame);
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})(typeof globalThis !== 'undefined' ? globalThis : this);
