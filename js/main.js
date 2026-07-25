/* ==========================================================================
   Main — Bootstrap, Eingabe, Bildschleife.

   Haelt Spiel und Oberflaeche zusammen: game.js meldet ueber Hooks, was
   passiert ist, main.js entscheidet, welcher Screen zu sehen ist.
   ========================================================================== */

(function (root) {
  'use strict';

  var doc = root.document;

  var Utils = root.M3.Utils;
  var CONFIG = root.M3.CONFIG;
  var Audio = root.M3.Audio;
  var Leaderboard = root.M3.Leaderboard;
  var Player = root.M3.Player;
  var UI = root.M3.UI;
  var Game = root.M3.Game;
  var COLORS = root.M3.GEM_COLORS;

  var game = null;
  var backdrop = null;
  var clock = 0;
  var lastFrame = 0;

  /* Hoechstes freigespieltes Level — erlaubt den Wiedereinstieg. */
  var unlocked = Math.max(1, parseInt(Utils.storeGet(CONFIG.STORE_PROGRESS, 1), 10) || 1);

  /* ====================================================================== */
  /*  Hintergrund-Steine                                                    */
  /* ====================================================================== */

  function Backdrop(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.gems = [];
    this.w = 0;
    this.h = 0;
    /* Bei "reduzierte Bewegung" treiben weniger Steine, und langsamer. */
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
      alpha: 0.05 + Math.random() * 0.12
    };
  };

  Backdrop.prototype.update = function (dt) {
    var step = dt * this.slow;

    for (var i = 0; i < this.gems.length; i++) {
      var g = this.gems[i];
      g.y += g.vy * step;
      g.x += g.vx * step;
      g.rot += g.vrot * step;

      if (g.y < -80) {
        this.gems[i] = this.makeGem(false);
      }
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

  /* Auf Mobilgeraeten ist 100vh groesser als der sichtbare Bereich, weil die
     Browserleiste mitgerechnet wird — daher eine eigene Variable. */
  function setViewportUnit() {
    doc.documentElement.style.setProperty('--vh', root.innerHeight + 'px');
  }

  /* Das Brett bekommt genau den Platz, der zwischen HUD und Fusszeile uebrig
     bleibt. Die Groesse aus dem Wrapper abzuleiten funktioniert nicht: der
     Wrapper richtet sich nach dem Canvas, das waere ein Zirkelschluss. */
  function layoutBoard() {
    var screen = doc.getElementById('screen-game');
    var hud = doc.querySelector('.hud');
    var foot = doc.querySelector('.game-foot');
    if (!screen || !game) return;

    var style = root.getComputedStyle(screen);
    var padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    var padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    var gaps = parseFloat(style.rowGap || style.gap) * 2 || 20;

    var availableW = screen.clientWidth - padX;
    var availableH = screen.clientHeight - padY - gaps -
      (hud ? hud.offsetHeight : 0) - (foot ? foot.offsetHeight : 0);

    var size = Math.min(availableW, availableH, 560);

    /* Waehrend eines Screen-Wechsels koennen die Hoehen kurz 0 sein. */
    if (!isFinite(size) || size < 40) {
      size = Math.min(root.innerWidth - 32, root.innerHeight - 220, 560);
    }

    game.resize(Utils.clamp(size, 200, 560));
  }

  function onResize() {
    setViewportUnit();
    if (backdrop) backdrop.resize();
    layoutBoard();
  }

  /* ====================================================================== */
  /*  Spielsteuerung                                                        */
  /* ====================================================================== */

  /* Ohne Leben geht nichts los — dann direkt in den Shop, statt den Knopf
     wirkungslos verpuffen zu lassen. */
  function startRun(level) {
    if (!Player.hasLife()) {
      openShop('Keine Versuche mehr heute. Ein Extra-Leben kostet ' +
        CONFIG.PRICE_LIFE + ' Kristalle.');
      return;
    }

    UI.resetStatCache();
    UI.overlay('screen-pause', false);
    UI.overlay('screen-level', false);
    UI.overlay('screen-over', false);
    UI.show('screen-game');

    /* Erst nach dem Screen-Wechsel messen — vorher hat der Wrapper noch
       nicht seine endgueltige Groesse. */
    layoutBoard();
    game.startRun(level);
    layoutBoard();
  }

  function nextLevel(data) {
    UI.overlay('screen-level', false);
    unlocked = Math.max(unlocked, data.nextLevel);
    Utils.storeSet(CONFIG.STORE_PROGRESS, unlocked);
    UI.setContinue(unlocked);
    UI.resetStatCache();
    game.startLevel(data.nextLevel, data.carry);
    layoutBoard();
  }

  var lastGameOver = null;
  /* Das Level-Panel braucht die Daten noch beim Klick auf "Weiter". */
  var lastLevelData = null;

  var hooks = {
    onStats: function (stats) {
      UI.updateStats(stats);
    },

    onHint: function (text, warn) {
      UI.setHint(text, warn);
    },

    onLevelComplete: function (data) {
      lastLevelData = data;
      var crystals = Player.crystalsForLevel(data.level, data.secondsLeft);
      Player.earn(crystals);
      UI.showLevelComplete(data, crystals);
    },

    onGameOver: function (data) {
      lastGameOver = data;

      /* Ein verlorener Lauf kostet einen der Tagesversuche. */
      Player.loseLife();
      UI.pulseHearts();

      var isRecord = data.score > 0 && data.score > Leaderboard.localBest();
      UI.showGameOver(data, isRecord);
    },

    onArmChange: function (key) {
      UI.setArmed(key);
    },

    onPowerUsed: function (key) {
      Player.consume(key);
      UI.refreshPowerBar();
    }
  };

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
      UI.setShopState(result.reason, 'warn');
      return;
    }

    var label = action === 'life' ? 'Extra-Leben' : Player.ITEMS[action].name;
    UI.setShopState(label + ' gekauft.', 'ok');

    UI.renderShop();
    UI.refreshWallet();
  }

  function usePower(key) {
    if (!game.acceptsInput()) return;

    /* Der scharfe Hammer laesst sich durch erneutes Antippen entschaerfen. */
    if (key === 'hammer' && game.armed === 'hammer') {
      game.disarm();
      return;
    }

    if (Player.countOf(key) <= 0) return;

    if (key === 'hammer') game.armHammer();
    else if (key === 'shuffle') game.usePowerShuffle();
    else if (key === 'time') game.usePowerTime();
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
      /* Nur waehrend eines gedrueckten Zeigers relevant. */
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
  /*  Buttons                                                               */
  /* ====================================================================== */

  function on(id, handler) {
    var el = doc.getElementById(id);
    if (el) el.addEventListener('click', function (e) {
      Audio.unlock();
      handler(e);
    });
  }

  function bindButtons() {
    on('btn-play', function () { startRun(1); });
    on('btn-continue', function () { startRun(unlocked); });

    on('btn-scores', function () {
      UI.prepareScoreScreen();
      UI.show('screen-scores');
      UI.loadScores();
    });

    on('btn-help', function () { UI.show('screen-help'); });
    on('btn-help-back', function () { UI.show('screen-start'); });
    on('btn-scores-back', function () { UI.show('screen-start'); });

    on('btn-shop', function () { openShop(); });
    on('btn-shop-back', function () {
      UI.refreshWallet();
      UI.show('screen-start');
    });

    /* Ein Listener fuer alle Kaufknoepfe — die Zeilen werden bei jedem
       Kauf neu aufgebaut, einzelne Listener waeren sofort veraltet. */
    doc.getElementById('shop-list').addEventListener('click', function (e) {
      var button = e.target.closest ? e.target.closest('[data-buy]') : null;
      if (!button || button.disabled) return;
      Audio.unlock();
      buy(button.dataset.buy);
    });

    on('pw-hammer', function () { usePower('hammer'); });
    on('pw-shuffle', function () { usePower('shuffle'); });
    on('pw-time', function () { usePower('time'); });

    on('btn-buy-life', function () {
      var result = Player.buyLife();
      if (!result.ok) {
        UI.setReviveState(result.reason, 'warn');
        return;
      }
      UI.setReviveState('Leben gekauft — auf geht’s!', 'ok');
      UI.refreshLivesOnGameOver();
    });

    on('tab-online', function () { UI.setScoreTab('online'); UI.loadScores(); });
    on('tab-local', function () { UI.setScoreTab('local'); UI.loadScores(); });

    on('btn-pause', togglePause);
    on('btn-resume', togglePause);

    on('btn-restart', function () {
      UI.overlay('screen-pause', false);
      UI.resetStatCache();
      game.startLevel(game.level, 0);
      layoutBoard();
    });

    on('btn-quit', function () {
      /* Aufgeben kostet bewusst kein Leben — verloren ist nur, wem die Zeit
         ausgeht. Der Levelfortschritt ist ohnehin weg. */
      game.stop();
      UI.overlay('screen-pause', false);
      UI.refreshBest();
      UI.refreshWallet();
      UI.show('screen-start');
    });

    on('btn-next', function () {
      if (lastLevelData) nextLevel(lastLevelData);
    });

    on('btn-again', function () {
      UI.overlay('screen-over', false);
      startRun(1);
    });

    on('btn-over-menu', function () {
      UI.overlay('screen-over', false);
      UI.refreshBest();
      UI.refreshWallet();
      UI.show('screen-start');
    });

    on('btn-mute', function () {
      var muted = Audio.toggleMute();
      doc.body.classList.toggle('is-muted', muted);
    });

    doc.getElementById('score-form').addEventListener('submit', function (e) {
      e.preventDefault();
      submitScore();
    });
  }

  function submitScore() {
    if (!lastGameOver) return;

    UI.setSubmitState('Wird gesendet…');

    Leaderboard.submit(UI.nameValue(), lastGameOver.score, lastGameOver.level)
      .then(function (result) {
        UI.lockSubmit();
        UI.highlight(result.entry);
        UI.refreshBest();

        if (result.online) {
          UI.setSubmitState(
            result.rank ? 'Eingetragen — Platz ' + result.rank + ' online' : 'Online eingetragen',
            'ok'
          );
        } else if (result.queued) {
          UI.setSubmitState(
            'Server nicht erreichbar — lokal gespeichert (Platz ' + result.localRank +
            ') und wird später nachgereicht.',
            'warn'
          );
        } else {
          UI.setSubmitState('Lokal gespeichert — Platz ' + result.localRank, 'ok');
        }
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

    /* Einstiegspunkt fuer die Konsole und den Smoke-Test in test/. */
    root.M3.__game = game;

    /* Ein Board vorbereiten, damit das Canvas nie leer dasteht. */
    game.startLevel(1, 0);
    game.stop();

    setViewportUnit();
    layoutBoard();

    bindCanvas(game.canvas);
    bindKeys();
    bindButtons();

    doc.body.classList.toggle('is-muted', Audio.isMuted());
    UI.setContinue(unlocked);

    root.addEventListener('resize', onResize);
    root.addEventListener('orientationchange', function () {
      root.setTimeout(onResize, 120);
    });

    /* Beim Wegklicken automatisch pausieren, damit die Uhr nicht weiterlaeuft. */
    doc.addEventListener('visibilitychange', function () {
      if (doc.hidden && game.running && !game.paused && UI.current() === 'screen-game') {
        togglePause();
      }
    });

    /* Wartende Scores aus frueheren Offline-Runden nachreichen. */
    Leaderboard.flushPending();

    root.requestAnimationFrame(frame);
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})(typeof globalThis !== 'undefined' ? globalThis : this);
