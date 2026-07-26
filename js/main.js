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
  var Rooms = root.M3.Rooms;
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
     bleiben erhalten.

     Ein frischer Stand beginnt bei 0 — das ist das Uebungslevel. Level 1 geht
     erst auf, wenn es durchgespielt ist. Wer schon Fortschritt hat, steht bei
     1 oder hoeher und merkt davon nichts. */
  var progressState = loadProgress();

  function loadProgress() {
    var raw = Utils.storeGet(CONFIG.STORE_PROGRESS, null);

    if (raw && typeof raw === 'object') {
      /* Nicht `|| 1` schreiben: die 0 ist ein gueltiger Stand und wuerde
         dabei stillschweigend zur 1 werden. */
      var level = Math.floor(raw.unlocked);
      return {
        unlocked: isFinite(level) && level >= 0 ? level : 1,
        stars: (raw.stars && typeof raw.stars === 'object') ? raw.stars : {}
      };
    }

    return { unlocked: 0, stars: {} };
  }

  function saveProgress() {
    Utils.storeSet(CONFIG.STORE_PROGRESS, progressState);
  }

  /* Was im Schloss schon eingerichtet ist. Eigener Schluessel, damit ein
     Reset des Levelfortschritts die Einrichtung nicht mitnimmt. */
  var roomState = Rooms.sanitize(Utils.storeGet(CONFIG.STORE_ROOMS, null));

  function saveRooms() {
    Utils.storeSet(CONFIG.STORE_ROOMS, roomState);
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

  /* Von welchem Screen aus wurde die Anleitung geoeffnet? */
  var helpCameFrom = 'screen-title';

  function openHelp() {
    helpCameFrom = UI.current() === 'screen-map' ? 'screen-map' : 'screen-title';
    UI.show('screen-help');
  }

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
    UI.setPauseCosts(!Levels.isTutorial(level));

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

    /* Das Brett wechselt je nach Level sein Gewand — der Rahmen drumherum
       zieht mit, sonst sieht das Thema wie ein Fehler aus. */
    onTheme: function (theme) {
      UI.setBoardTheme(theme);
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

      /* Muenzen fuers Schloss. Das Uebungslevel bringt keine — sonst waere
         der beste Weg zum eingerichteten Zimmer, die Uebung immer wieder zu
         spielen. */
      var coins = Levels.isTutorial(data.level)
        ? 0
        : Player.coinsForLevel(data.level, data.stars);
      if (coins) Player.earnCoins(coins);

      UI.showWin(data, crystals, coins);

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

  /* Ein abgebrochener Versuch kostet ein Leben — egal ob man zur Karte
     zurueckgeht oder neu startet. Frueher war Neu-starten gratis, damit war
     Aufgeben immer die duemmere Wahl und die Leben bedeuteten wenig.
     Im Uebungslevel kostet weiterhin nichts etwas. */
  function abandonLevel() {
    Tutorial.stop();

    if (!Levels.isTutorial(activeLevel)) {
      Player.loseLife();
      UI.pulseHearts();
      Audio.lifeLost();
    }
  }

  function giveUpLevel() {
    abandonLevel();
    game.stop();
    openMap();
  }

  /* Neu starten aus der Pause. */
  function restartLevel() {
    var tutorial = Levels.isTutorial(activeLevel);

    /* Das letzte Leben darf nicht in einem Neustart verpuffen, aus dem man
       dann nicht mehr herauskommt — dann lieber der Shop. */
    if (!tutorial && Player.snapshot().lives <= 1) {
      abandonLevel();
      game.stop();
      UI.overlay('screen-pause', false);
      openShop('Das war dein letztes Leben. Ein Extra-Leben kostet ' +
        CONFIG.PRICE_LIFE + ' Kristalle.');
      return;
    }

    abandonLevel();
    UI.overlay('screen-pause', false);
    beginLevel(activeLevel);
  }

  /* ====================================================================== */
  /*  Shop und Power-Ups                                                    */
  /* ====================================================================== */

  /* ====================================================================== */
  /*  Zimmer                                                                */
  /* ====================================================================== */

  function openRooms() {
    UI.setRoomState('');
    UI.show('screen-rooms');
    UI.openRoomView();
  }

  /* Eine Einrichtung kaufen. Der Preis wird hier gegen die Leveldaten
     geprueft, nicht gegen das, was der Knopf behauptet — sonst liesse sich
     ueber die Konsole billig einrichten. */
  function buyFurnishing(roomKey, taskKey, optionKey) {
    var room = Rooms.byKey(roomKey);
    var task = Rooms.taskOf(room, taskKey);
    if (!task) return;

    var option = null;
    task.options.forEach(function (o) { if (o.key === optionKey) option = o; });
    if (!option) return;

    /* Schon gekauft? Dann nicht noch einmal abbuchen. */
    if (Rooms.chosenIn(roomState, roomKey)[taskKey]) return;

    if (!Player.spendCoins(option.price)) {
      var missing = option.price - Player.snapshot().coins;
      Audio.denied();
      UI.setRoomState('Dafür fehlen dir noch ' + missing + ' Münzen. Spiel ein Level!', 'warn');
      return;
    }

    Rooms.pick(roomState, roomKey, taskKey, optionKey);
    saveRooms();

    Audio.purchase();
    UI.flashRoom();
    UI.setRoomState(option.name + ' eingebaut.', 'ok');
    UI.renderRooms();

    /* Zimmer fertig? Das ist der Moment, den das Ganze verdient. */
    if (Rooms.isComplete(roomState, room)) {
      Audio.levelUp();
      UI.setRoomState(room.name + ' ist fertig!', 'ok');
    }
  }

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

    /* Erneutes Antippen entschaerft einen scharfen Booster wieder. */
    if (game.armed === key) {
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

    if (key === 'bomb' || key === 'rocket') game.arm(key);
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
    on('btn-help', function () { openHelp(); });

    /* Zurueck fuehrt dorthin, wo die Anleitung geoeffnet wurde. Frueher wurde
       das am Fortschritt geraten — und ein frischer Spieler landete von der
       Karte aus auf dem Titelbildschirm. */
    on('btn-help-back', function () {
      if (helpCameFrom === 'screen-map') openMap();
      else UI.show('screen-title');
    });

    /* --- Karte --- */
    on('btn-rooms', openRooms);
    on('btn-rooms-back', function () { openMap(); });
    on('btn-shop', function () { openShop(); });
    on('btn-map-help', function () { openHelp(); });
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

    on('btn-restart', restartLevel);

    /* Mitten im Level zur Karte: gilt als Aufgeben. */
    on('btn-quit', giveUpLevel);

    Player.ITEM_KEYS.forEach(function (key) {
      on('pw-' + key, function () { usePower(key); });
    });

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

    /* In der Bestenliste steht das erreichte Level. Wer noch im Uebungslevel
       steht, hat freigeschaltet 0 — dort waere "Level 0" nur verwirrend. */
    Leaderboard.submit(UI.nameValue(), lifetimeScore,
      Math.max(1, progressState.unlocked))
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
    root.M3.__bootAt = Date.now();
    Player.load();
    UI.init();

    backdrop = new Backdrop(doc.getElementById('bg-canvas'));
    game = new Game(doc.getElementById('board-canvas'), hooks);
    root.M3.__game = game;

    Map.init({ onSelect: openLevelStart });
    Tutorial.init();

    UI.initRooms({
      state: function () { return roomState; },
      buy: buyFurnishing
    });

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
    registerWorker();

    root.requestAnimationFrame(frame);
    hideSplash();
  }

  /* Macht das Spiel offline spielbar und erlaubt "Zum Startbildschirm
     hinzufuegen". Ueber `file://` gibt es keine Service Worker — dort wird
     still nichts getan, statt eine Fehlermeldung zu werfen. */
  function registerWorker() {
    if (!root.navigator || !root.navigator.serviceWorker) return;
    if (root.location.protocol !== 'https:' && root.location.hostname !== 'localhost' &&
        root.location.hostname !== '127.0.0.1') return;

    root.navigator.serviceWorker.register('sw.js').catch(function () {
      /* Offline-Betrieb ist ein Bonus, kein Muss — ohne ihn laeuft alles
         weiter, nur eben nur online. */
    });
  }

  /* Das Ladebild verschwindet erst nach einem gezeichneten Bild — sonst
     blitzt beim Ausblenden ein leerer Hintergrund durch. Die kurze
     Mindestzeit verhindert, dass es auf schnellen Geraeten nur zuckt. */
  function hideSplash() {
    var splash = doc.getElementById('splash');
    if (!splash) return;

    var started = root.M3.__bootAt || Date.now();
    var wait = Math.max(0, 550 - (Date.now() - started));

    root.requestAnimationFrame(function () {
      root.setTimeout(function () {
        splash.classList.add('is-gone');
        /* Nach dem Ausblenden ganz raus: ein unsichtbares Element ueber dem
           Spiel faengt sonst Klicks ab, wenn irgendwann eine Regel kippt. */
        root.setTimeout(function () {
          if (splash.parentNode) splash.parentNode.removeChild(splash);
        }, 600);
      }, wait);
    });
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})(typeof globalThis !== 'undefined' ? globalThis : this);
