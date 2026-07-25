/* ==========================================================================
   Game — Zustandsautomat, Animationen und Canvas-Rendering.

   Ablauf eines Zuges:

       IDLE --(Tausch)--> SWAP --> CLEAR --> FALL --> (Kaskade?) --> CLEAR ...
                            |                                          |
                            +--(ungueltig)--> IDLE <-------------------+

   Die Steinobjekte gehoeren board.js; game.js haengt ihnen nur
   Darstellungsfelder an (gx, gy, scale, birth, glow). Board-Logik und
   Animation bleiben so getrennt, ohne fuer jeden Stein ein zweites Objekt
   zu fuehren.
   ========================================================================== */

(function (root) {
  'use strict';

  var Utils = root.M3.Utils;
  var CONFIG = root.M3.CONFIG;
  var Audio = root.M3.Audio;
  var Levels = root.M3.Levels;
  var Goals = root.M3.Goals;
  var Board = root.M3.Board;
  var SPECIAL = root.M3.SPECIAL;
  var Fx = root.M3.Fx;

  /* --------------------------------------------------------- Erscheinung */

  var COLORS = [
    '#ff4f7b',  /* 0 Rubin      — Kreis */
    '#ffcc4d',  /* 1 Bernstein  — Raute */
    '#7ee787',  /* 2 Smaragd    — Dreieck */
    '#38f2d8',  /* 3 Türkis     — Sechseck */
    '#b36bff',  /* 4 Amethyst   — Stern */
    '#ff8a3d',  /* 5 Feuer      — abgerundetes Quadrat */
    '#5b8cff'   /* 6 Saphir     — Kreuz */
  ];

  /* Jede Farbe hat zusaetzlich eine eigene Form — das Spiel bleibt damit
     auch bei Farbfehlsichtigkeit lesbar. */
  var SHAPES = ['circle', 'diamond', 'triangle', 'hexagon', 'star', 'square', 'cross'];

  /* ------------------------------------------------------------ Zeitwerte */

  var PHASE = {
    IDLE: 'idle',
    SWAP: 'swap',
    CLEAR: 'clear',
    FALL: 'fall',
    SHUFFLE: 'shuffle',
    DONE: 'done'
  };

  var T_SWAP = 0.17;
  var T_SWAP_BACK = 0.3;
  var T_CLEAR = 0.3;
  var T_FALL_BASE = 0.18;
  var T_FALL_PER_ROW = 0.045;
  var T_SHUFFLE = 0.55;

  var HINT_DELAY = 5;

  /* So viele Schritte darf das Zug-Finale hoechstens dauern. */
  var FINALE_STEPS = 8;

  /* Wie stark Aufloesen und Nachrutschen im Finale beschleunigt werden. */
  var FINALE_SPEED = 0.35;

  /* ====================================================================== */

  function Game(canvas, hooks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.hooks = hooks || {};

    this.cols = CONFIG.COLS;
    this.rows = CONFIG.ROWS;

    this.fx = new Fx();
    this.reducedMotion = Utils.prefersReducedMotion();

    this.board = null;
    this.level = 1;
    this.def = Levels.get(1);

    this.totalScore = 0;
    this.levelScore = 0;
    this.movesLeft = 0;
    this.progress = Goals.newProgress(7);
    this.cascade = 0;
    this.finale = null;    /* laufendes Zug-Finale nach dem Sieg */
    /* Tempofaktor fuer Aufloesen und Nachrutschen. Im Zug-Finale laeuft alles
       schneller ab, sonst zieht sich der Abschluss ewig. */
    this.speed = 1;

    this.phase = PHASE.DONE;
    this.phaseT = 0;
    this.running = false;
    this.paused = false;

    this.selected = null;      /* Index des angetippten Steins */
    this.cursor = null;        /* Tastatur-Cursor */
    this.dragOrigin = null;    /* Startpunkt einer Ziehgeste */
    this.armed = null;         /* scharfes Power-Up, aktuell nur 'hammer' */
    this.hint = null;
    this.idleTime = 0;

    this.popping = [];         /* Steine in der Auflös-Animation */
    this.falling = [];
    this.swapAnim = null;
    this.births = [];
    this.pendingSwapSeeds = null;

    this.shake = 0;
    this.flash = 0;

    /* Layout — wird von resize() gesetzt. */
    this.cssSize = 400;
    this.pad = 8;
    this.cell = 48;
  }

  Game.COLORS = COLORS;

  /* ====================================================================== */
  /*  Layout                                                                */
  /* ====================================================================== */

  Game.prototype.resize = function (cssSize) {
    var dpr = Math.min(root.devicePixelRatio || 1, 2.5);

    this.cssSize = Math.max(160, Math.floor(cssSize));
    this.pad = Math.round(this.cssSize * 0.022);
    this.cell = (this.cssSize - this.pad * 2) / this.cols;

    this.canvas.style.width = this.cssSize + 'px';
    this.canvas.style.height = this.cssSize + 'px';
    this.canvas.width = Math.round(this.cssSize * dpr);
    this.canvas.height = Math.round(this.cssSize * dpr);

    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  Game.prototype.cellCenter = function (c, r) {
    return {
      x: this.pad + (c + 0.5) * this.cell,
      y: this.pad + (r + 0.5) * this.cell
    };
  };

  /* Pixelkoordinate -> Feldindex, oder null ausserhalb. */
  Game.prototype.cellAtPixel = function (px, py) {
    var c = Math.floor((px - this.pad) / this.cell);
    var r = Math.floor((py - this.pad) / this.cell);
    if (!this.board || !this.board.inBounds(c, r)) return null;
    return this.board.idx(c, r);
  };

  /* ====================================================================== */
  /*  Levelsteuerung                                                        */
  /* ====================================================================== */

  Game.prototype.startLevel = function (level) {
    this.level = level;
    this.def = Levels.get(level);

    this.board = new Board({
      cols: this.cols,
      rows: this.rows,
      colors: this.def.colors,
      rng: Utils.makeRng((Date.now() ^ (level * 7919)) >>> 0)
    });
    this.board.generate(this.def.blockers);

    this.levelScore = 0;
    this.movesLeft = this.def.moves;
    this.progress = Goals.newProgress(this.def.colors);
    this.cascade = 0;
    this.finale = null;
    this.speed = 1;

    this.selected = null;
    this.cursor = null;
    this.dragOrigin = null;
    this.armed = null;
    this.hint = null;
    this.idleTime = 0;
    this.popping.length = 0;
    this.falling.length = 0;
    this.swapAnim = null;
    this.births.length = 0;
    this.pendingSwapSeeds = null;
    this.shake = 0;
    this.flash = 0;

    this.fx.clear();
    this.syncViews(true);

    this.running = true;
    this.paused = false;
    this.setPhase(PHASE.IDLE);

    this.emitStats();
    this.say('Ziehe oder tippe zwei benachbarte Steine');
  };

  Game.prototype.setPhase = function (phase) {
    this.phase = phase;
    this.phaseT = 0;
  };

  Game.prototype.pause = function () {
    if (!this.running) return;
    this.paused = true;
  };

  Game.prototype.resume = function () {
    this.paused = false;
  };

  Game.prototype.stop = function () {
    this.running = false;
    this.setPhase(PHASE.DONE);
  };

  /* Alle Steine bekommen Startkoordinaten. `instant` setzt sie hart, sonst
     laesst es neue Steine von oben einfliegen. */
  Game.prototype.syncViews = function (instant) {
    for (var i = 0; i < this.board.cells.length; i++) {
      var gem = this.board.cells[i];
      if (!gem) continue;

      var c = this.board.colOf(i);
      var r = this.board.rowOf(i);

      if (gem.gx === undefined || instant) {
        gem.gx = c;
        gem.gy = instant ? r : -1;
        gem.scale = 1;
        gem.birth = 1;
        gem.spin = 0;
        gem.glow = 0;
      }
    }
  };

  /* ====================================================================== */
  /*  Eingabe                                                               */
  /* ====================================================================== */

  Game.prototype.acceptsInput = function () {
    return this.running && !this.paused && this.phase === PHASE.IDLE;
  };

  Game.prototype.pointerDown = function (px, py) {
    if (!this.acceptsInput()) return;

    var idx = this.cellAtPixel(px, py);
    if (idx === null) return;

    /* Scharfer Hammer: der Tipp schlaegt zu, statt zu tauschen. */
    if (this.armed === 'hammer') {
      this.disarm();
      this.useHammer(idx);
      return;
    }

    var gem = this.board.cells[idx];
    if (!gem || gem.kind === 'blocker') {
      this.selected = null;
      return;
    }

    this.idleTime = 0;
    this.hint = null;

    if (this.selected === null) {
      this.selected = idx;
      this.dragOrigin = { idx: idx, px: px, py: py };
      Audio.select();
      return;
    }

    if (this.selected === idx) {
      this.selected = null;
      return;
    }

    if (this.board.canSwap(this.selected, idx)) {
      var from = this.selected;
      this.selected = null;
      this.dragOrigin = null;
      this.tryMove(from, idx);
      return;
    }

    /* Zu weit weg — als neue Auswahl behandeln. */
    this.selected = idx;
    this.dragOrigin = { idx: idx, px: px, py: py };
    Audio.select();
  };

  /* Ziehen: sobald der Finger ein Viertel Feld weit weg ist, gilt die
     Richtung als gewaehlt und der Tausch startet sofort. */
  Game.prototype.pointerMove = function (px, py) {
    if (!this.acceptsInput() || !this.dragOrigin) return;

    var dx = px - this.dragOrigin.px;
    var dy = py - this.dragOrigin.py;
    var threshold = this.cell * 0.35;

    if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return;

    var origin = this.dragOrigin.idx;
    var c = this.board.colOf(origin);
    var r = this.board.rowOf(origin);

    if (Math.abs(dx) > Math.abs(dy)) {
      c += dx > 0 ? 1 : -1;
    } else {
      r += dy > 0 ? 1 : -1;
    }

    this.dragOrigin = null;
    this.selected = null;

    if (!this.board.inBounds(c, r)) return;
    this.tryMove(origin, this.board.idx(c, r));
  };

  Game.prototype.pointerUp = function () {
    this.dragOrigin = null;
  };

  Game.prototype.keyDown = function (key) {
    if (!this.acceptsInput()) return false;

    if (this.cursor === null) this.cursor = this.board.idx(0, this.rows - 1);

    var c = this.board.colOf(this.cursor);
    var r = this.board.rowOf(this.cursor);
    var moved = true;

    switch (key) {
      case 'ArrowLeft':  c--; break;
      case 'ArrowRight': c++; break;
      case 'ArrowUp':    r--; break;
      case 'ArrowDown':  r++; break;
      default: moved = false;
    }

    if (moved) {
      if (!this.board.inBounds(c, r)) return true;
      var target = this.board.idx(c, r);

      /* Mit gesetzter Auswahl bedeutet eine Pfeiltaste: dorthin tauschen. */
      if (this.selected !== null && this.board.canSwap(this.selected, target)) {
        var from = this.selected;
        this.selected = null;
        this.cursor = target;
        this.tryMove(from, target);
        return true;
      }

      this.cursor = target;
      this.idleTime = 0;
      return true;
    }

    if (key === ' ' || key === 'Enter') {
      if (this.selected === this.cursor) {
        this.selected = null;
      } else {
        var gem = this.board.cells[this.cursor];
        if (gem && gem.kind !== 'blocker') {
          this.selected = this.cursor;
          Audio.select();
        }
      }
      this.idleTime = 0;
      return true;
    }

    return false;
  };

  /* ====================================================================== */
  /*  Power-Ups                                                             */
  /* ====================================================================== */

  /* Der Hammer braucht ein Ziel, also wird er erst "scharf gemacht" und
     schlaegt beim naechsten Tipp aufs Brett zu. Die anderen beiden wirken
     sofort. */
  Game.prototype.armHammer = function () {
    if (!this.acceptsInput()) return false;

    this.armed = 'hammer';
    this.selected = null;
    this.hint = null;
    this.say('Hammer bereit — tippe ein Feld an, das Kreuz drumherum fliegt mit');
    if (this.hooks.onArmChange) this.hooks.onArmChange('hammer');
    return true;
  };

  Game.prototype.disarm = function () {
    if (!this.armed) return;
    this.armed = null;
    this.say('Ziehe oder tippe zwei benachbarte Steine');
    if (this.hooks.onArmChange) this.hooks.onArmChange(null);
  };

  /* Der Hammer raeumt ein Kreuz: das angetippte Feld und seine vier direkten
     Nachbarn. Felsen im Kreuz zerbrechen automatisch — resolveBlast raeumt
     jeden Fels, der an ein geraeumtes Feld grenzt. */
  Game.prototype.useHammer = function (idx) {
    if (!this.board.cells[idx]) return false;

    this.selected = null;
    this.hint = null;
    this.idleTime = 0;

    var self = this;
    var cross = [idx].concat(this.board.neighbors4(idx));

    var pos = this.cellCenter(this.board.colOf(idx), this.board.rowOf(idx));
    this.fx.ring(pos.x, pos.y, this.cell * 2.4, '#ffcc4d', 6);
    this.fx.burst(pos.x, pos.y, '#ffcc4d', 18, 1.2);
    this.addShake(9);
    Audio.explode();

    /* Steine im Kreuz gehen ueber die normale Aufloesung, damit getroffene
       Spezialsteine mitzuenden. */
    var gems = cross.filter(function (i) {
      var g = self.board.cells[i];
      return g && g.kind !== 'blocker';
    });

    if (gems.length) {
      this.cascade = 0;
      this.pendingSwapSeeds = { a: idx, b: idx, rainbow: gems, targets: {} };
      this.resolve();
    } else {
      /* Nur Felsen getroffen — die raeumt resolveBlast nicht von allein. */
      this.cascade = 1;
      this.startClear({ cleared: [], blockers: cross, activations: [] }, [], null);
    }

    this.spent('hammer');
    return true;
  };

  Game.prototype.usePowerShuffle = function () {
    if (!this.acceptsInput()) return false;
    this.disarm();
    this.startShuffle('Feld neu gemischt — jetzt gibt es wieder Zuege',
      CONFIG.POWERUP_SHUFFLE_MIN_MOVES);
    this.spent('shuffle');
    return true;
  };

  Game.prototype.usePowerMoves = function () {
    if (!this.running) return false;
    this.addMoves(CONFIG.POWERUP_EXTRA_MOVES);
    this.spent('moves');
    return true;
  };

  /* Meldet den Verbrauch nach oben — den Vorrat fuehrt player.js, nicht
     die Engine. */
  Game.prototype.spent = function (key) {
    if (this.hooks.onPowerUsed) this.hooks.onPowerUsed(key);
  };

  Game.prototype.addMoves = function (extra) {
    this.movesLeft += extra;

    var mid = this.cellCenter(this.cols / 2 - 0.5, this.rows / 2 - 0.5);
    this.fx.text(mid.x, mid.y, '+' + extra + ' Züge', '#7ee787', Math.round(this.cell * 0.55));
    this.fx.ring(mid.x, mid.y, this.cell * 3.2, '#7ee787', 4);
    Audio.specialBorn();

    this.say(extra + ' Züge dazu — jetzt sind es ' + this.movesLeft);
    this.emitStats();
    return true;
  };

  /* ====================================================================== */
  /*  Zug ausfuehren                                                        */
  /* ====================================================================== */

  Game.prototype.tryMove = function (a, b) {
    if (!this.board.canSwap(a, b)) return;

    var ga = this.board.cells[a];
    var gb = this.board.cells[b];

    var rainbowSeeds = null;
    var rainbowTargets = {};

    if (ga.kind === 'rainbow' && gb.kind === 'rainbow') {
      /* Zwei Prismen: das ganze Feld geht hoch. */
      rainbowSeeds = [];
      for (var i = 0; i < this.board.cells.length; i++) rainbowSeeds.push(i);
    } else if (ga.kind === 'rainbow' || gb.kind === 'rainbow') {
      /* Nach dem Tausch liegt das Prisma auf dem Feld des Partners. */
      var rainbowAt = ga.kind === 'rainbow' ? b : a;
      var partner = ga.kind === 'rainbow' ? gb : ga;
      rainbowSeeds = [rainbowAt];
      rainbowTargets[rainbowAt] = partner.kind === 'gem' ? partner.type : -1;
    }

    this.board.swap(a, b);

    var valid = rainbowSeeds !== null || this.board.findClusters().length > 0;
    if (!valid) this.board.swap(a, b);

    this.cascade = 0;
    this.pendingSwapSeeds = valid ? { a: a, b: b, rainbow: rainbowSeeds, targets: rainbowTargets } : null;

    /* Nur ein Zug, der wirklich etwas bewirkt, kostet auch einen. Ein
       Fehlversuch ist frei — sonst bestraft das Spiel Ausprobieren. */
    if (valid) {
      this.movesLeft = Math.max(0, this.movesLeft - 1);
      this.emitStats();
    }

    /* Bei gueltigem Tausch sind die Steine bereits vertauscht, bei
       ungueltigem stehen sie wieder auf ihren alten Plaetzen. In beiden
       Faellen ist gemA der Stein, der die Bewegung a -> b zeigt. */
    this.swapAnim = {
      a: a,
      b: b,
      gemA: this.board.cells[valid ? b : a],
      gemB: this.board.cells[valid ? a : b],
      valid: valid,
      duration: valid ? T_SWAP : T_SWAP_BACK
    };

    if (valid) {
      Audio.swap();
    } else {
      Audio.invalid();
      this.say('Das bringt keinen Treffer', true);
    }

    this.setPhase(PHASE.SWAP);
  };

  /* ====================================================================== */
  /*  Aufloesen                                                             */
  /* ====================================================================== */

  Game.prototype.resolve = function () {
    var clusters = this.board.findClusters();
    var swapInfo = this.pendingSwapSeeds;
    this.pendingSwapSeeds = null;

    var rainbowSeeds = swapInfo && swapInfo.rainbow ? swapInfo.rainbow : null;

    if (!clusters.length && !rainbowSeeds) {
      this.finishChain();
      return;
    }

    this.cascade++;

    /* --- Spezialsteine bestimmen ------------------------------------- */
    var births = [];

    clusters.forEach(function (cluster) {
      if (cluster.special === SPECIAL.NONE) return;

      /* Der neue Stein entsteht dort, wo der Spieler getauscht hat —
         sonst in der Mitte der Kette. */
      var birthIdx = cluster.cells[Math.floor(cluster.cells.length / 2)];
      if (swapInfo) {
        if (cluster.cells.indexOf(swapInfo.a) >= 0) birthIdx = swapInfo.a;
        else if (cluster.cells.indexOf(swapInfo.b) >= 0) birthIdx = swapInfo.b;
      }

      births.push({
        idx: birthIdx,
        rainbow: cluster.special === 'rainbow',
        special: cluster.special === 'rainbow' ? SPECIAL.NONE : cluster.special,
        type: cluster.type
      });
    });

    /* --- Treffer einsammeln ------------------------------------------ */
    var seeds = [];
    clusters.forEach(function (cluster) {
      cluster.cells.forEach(function (idx) { seeds.push(idx); });
    });
    if (rainbowSeeds) rainbowSeeds.forEach(function (idx) { seeds.push(idx); });

    var targets = (swapInfo && swapInfo.targets) || {};
    var blast = this.board.resolveBlast(seeds, targets);

    /* Felder, auf denen ein Spezialstein entsteht, bleiben nach dem Raeumen
       nicht leer — dort wird gleich der neue Stein gesetzt. */
    this.startClear(blast, births, clusters);
  };

  Game.prototype.startClear = function (blast, births, clusters) {
    var self = this;
    var cascadeMult = this.cascade;

    /* --- Punkte ------------------------------------------------------- */
    /* Der Steinwert haengt an der Farbanzahl der Stufe: mehr Farben heisst
       seltenere Treffer, also mehr Punkte pro Stein (siehe js/levels.js). */
    var perGem = this.def.pointsPerGem || CONFIG.POINTS_PER_GEM;
    var gemPoints = blast.cleared.length * perGem * cascadeMult;
    var blockerPoints = blast.blockers.length * CONFIG.POINTS_BLOCKER;
    var specialPoints = births.length * CONFIG.POINTS_SPECIAL_CREATE;
    var gained = gemPoints + blockerPoints + specialPoints;

    this.addScore(gained);

    /* --- Aufgabenfortschritt ------------------------------------------ */
    /* Muss vor dem Raeumen passieren — danach sind die Steine weg und ihre
       Farbe nicht mehr feststellbar. */
    this.countProgress(blast);

    /* --- Effekte fuer die Zuendungen ---------------------------------- */
    blast.activations.forEach(function (act) {
      self.spawnActivationFx(act);
    });

    /* --- Steine ausblenden -------------------------------------------- */
    var all = blast.cleared.concat(blast.blockers);

    all.forEach(function (idx) {
      var gem = self.board.cells[idx];
      if (!gem) return;

      var c = self.board.colOf(idx);
      var r = self.board.rowOf(idx);
      var pos = self.cellCenter(c, r);

      gem.popT = 0;
      self.popping.push(gem);

      var color = gem.kind === 'blocker' ? '#8e8ab0'
                : gem.kind === 'rainbow' ? '#ffffff'
                : COLORS[gem.type % COLORS.length];

      self.fx.burst(pos.x, pos.y, color, gem.kind === 'blocker' ? 10 : 13, 0.9);
    });

    this.board.remove(all);

    if (blast.blockers.length) Audio.blocker();
    Audio.match(cascadeMult);

    /* --- Punkteanzeige und Kaskadenbanner ------------------------------ */
    if (clusters && clusters.length) {
      var center = this.clusterCenter(clusters[0]);
      this.fx.text(center.x, center.y, '+' + Utils.formatNumber(gained), '#ffffff', Math.round(this.cell * 0.42));
    }

    if (cascadeMult >= 2) {
      var mid = this.cellCenter(this.cols / 2 - 0.5, this.rows / 2 - 0.5);
      this.fx.text(mid.x, mid.y, comboLabel(cascadeMult), '#38f2d8', Math.round(this.cell * 0.6));
      this.fx.ring(mid.x, mid.y, this.cell * 3.4, '#38f2d8', 3);
    }

    this.addShake(Math.min(14, 3 + cascadeMult * 2.5 + blast.cleared.length * 0.25));
    this.flash = Math.min(0.5, 0.1 + cascadeMult * 0.06);

    this.births = births;
    this.setPhase(PHASE.CLEAR);
  };

  /* Zaehlt geraeumte Steine nach Farbe und zerbrochene Felsen mit. Die
     Punkte stehen schon in levelScore, werden hier nur uebernommen, damit
     goals.js nur ein Objekt braucht. */
  Game.prototype.countProgress = function (blast) {
    for (var i = 0; i < blast.cleared.length; i++) {
      var gem = this.board.cells[blast.cleared[i]];
      if (gem && gem.kind === 'gem' && this.progress.colors[gem.type] !== undefined) {
        this.progress.colors[gem.type]++;
      }
    }

    this.progress.blockers += blast.blockers.length;
    this.progress.score = this.levelScore;
  };

  function comboLabel(n) {
    if (n >= 6) return 'UNGLAUBLICH ×' + n;
    if (n >= 4) return 'GEWALTIG ×' + n;
    if (n >= 3) return 'COMBO ×' + n;
    return 'COMBO ×2';
  }

  Game.prototype.clusterCenter = function (cluster) {
    var sx = 0;
    var sy = 0;
    for (var i = 0; i < cluster.cells.length; i++) {
      sx += this.board.colOf(cluster.cells[i]);
      sy += this.board.rowOf(cluster.cells[i]);
    }
    return this.cellCenter(sx / cluster.cells.length, sy / cluster.cells.length);
  };

  /* Lichtstrahl, Schockwelle oder Farbblitz — je nach Spezialstein. */
  Game.prototype.spawnActivationFx = function (act) {
    var c = this.board.colOf(act.idx);
    var r = this.board.rowOf(act.idx);
    var pos = this.cellCenter(c, r);
    var span = this.cell * this.cols;

    if (act.kind === 'rainbow') {
      this.fx.ring(pos.x, pos.y, span * 0.7, '#ffffff', 5);
      var self = this;
      act.hits.forEach(function (idx) {
        var hp = self.cellCenter(self.board.colOf(idx), self.board.rowOf(idx));
        self.fx.burst(hp.x, hp.y, COLORS[act.type >= 0 ? act.type % COLORS.length : 4], 6, 0.7);
      });
      Audio.rainbow();
      this.addShake(10);
      return;
    }

    if (act.special === SPECIAL.LINE_H) {
      this.fx.beam(this.pad, pos.y, span, this.cell * 0.5, true, COLORS[act.type % COLORS.length]);
      Audio.beam();
    } else if (act.special === SPECIAL.LINE_V) {
      this.fx.beam(pos.x, this.pad, span, this.cell * 0.5, false, COLORS[act.type % COLORS.length]);
      Audio.beam();
    } else if (act.special === SPECIAL.BOMB) {
      this.fx.ring(pos.x, pos.y, this.cell * 2.4, '#ffb44d', 6);
      this.fx.burst(pos.x, pos.y, '#ffb44d', 22, 1.4);
      Audio.explode();
      this.addShake(9);
    }
  };

  /* Nach der Auflös-Animation: Spezialsteine setzen, dann nachrutschen. */
  Game.prototype.spawnBirthsAndFall = function () {
    var self = this;

    this.births.forEach(function (birth) {
      var gem = birth.rainbow
        ? self.board.makeRainbow()
        : self.board.makeGem(birth.type, birth.special);

      var c = self.board.colOf(birth.idx);
      var r = self.board.rowOf(birth.idx);

      gem.gx = c;
      gem.gy = r;
      gem.scale = 1;
      gem.birth = 0;
      gem.spin = 0;
      gem.glow = 1;

      self.board.cells[birth.idx] = gem;

      var pos = self.cellCenter(c, r);
      self.fx.ring(pos.x, pos.y, self.cell * 1.9, '#ffffff', 4);
      self.fx.burst(pos.x, pos.y, birth.rainbow ? '#ffffff' : COLORS[birth.type % COLORS.length], 16, 1.1);
    });

    if (this.births.length) Audio.specialBorn();
    this.births = [];

    var moves = this.board.applyGravity();
    this.startFall(moves);
  };

  Game.prototype.startFall = function (moves) {
    var self = this;
    this.falling.length = 0;

    /* Pro Spalte gestaffelt starten — das wirkt wie echtes Nachrutschen
       statt wie ein Block, der am Stueck springt. */
    var perColumn = {};

    moves.forEach(function (move) {
      var gem = move.gem;
      gem.gx = move.col;
      gem.gy = move.fromRow;
      if (gem.scale === undefined) gem.scale = 1;
      if (gem.birth === undefined) gem.birth = 1;
      if (gem.spin === undefined) gem.spin = 0;
      if (gem.glow === undefined) gem.glow = 0;

      var order = perColumn[move.col] || 0;
      perColumn[move.col] = order + 1;

      var distance = move.toRow - move.fromRow;

      self.falling.push({
        gem: gem,
        from: move.fromRow,
        to: move.toRow,
        delay: order * 0.018 * self.speed,
        duration: (T_FALL_BASE + distance * T_FALL_PER_ROW) * self.speed
      });
    });

    if (!this.falling.length) {
      this.resolve();
      return;
    }

    this.setPhase(PHASE.FALL);
  };

  /* Ende einer Kaskadenkette: Aufgaben, Zuege, Sackgasse, dann Eingabe. */
  Game.prototype.finishChain = function () {
    this.cascade = 0;
    this.popping.length = 0;
    this.emitStats();

    /* Laeuft gerade das Zug-Finale, geht es dort weiter. */
    if (this.finale) {
      this.stepFinale();
      return;
    }

    if (Goals.allDone(this.def.goals, this.progress)) {
      this.startFinale();
      return;
    }

    if (this.movesLeft <= 0) {
      this.levelFailed();
      return;
    }

    if (!this.board.hasValidMove()) {
      this.startShuffle();
      return;
    }

    this.idleTime = 0;
    this.hint = null;
    this.setPhase(PHASE.IDLE);
  };

  /* ------------------------------------------------------------ Zug-Finale */

  /* Sind die Aufgaben erfuellt, werden uebrige Zuege nicht verschenkt: jeder
     wird in einen Blitz auf einen zufaelligen Stein verwandelt. Das ist im
     Genre der befriedigendste Moment und macht Sparsamkeit sichtbar
     wertvoll. */
  Game.prototype.startFinale = function () {
    this.selected = null;
    this.hint = null;
    this.disarm();

    this.finaleMovesAtWin = this.movesLeft;

    if (this.movesLeft <= 0) {
      this.completeLevel();
      return;
    }

    /* Jeder Restzug wird ein Blitz. Bei viel Restluft werden mehrere pro
       Schritt gezuendet — sonst dauert das Finale bei 25 uebrigen Zuegen
       ueber eine Viertelminute und wird zur Geduldsprobe. So sind es nie
       mehr als FINALE_STEPS Schritte. */
    this.speed = FINALE_SPEED;
    this.finale = {
      left: this.movesLeft,
      perStep: Math.max(1, Math.ceil(this.movesLeft / FINALE_STEPS))
    };

    this.say('Alle Aufgaben erfüllt!');
    this.stepFinale();
  };

  Game.prototype.stepFinale = function () {
    if (!this.finale) return;

    if (this.finale.left <= 0) {
      this.finale = null;
      this.completeLevel();
      return;
    }

    /* Zufaellige normale Steine in Blitze verwandeln und gemeinsam zuenden. */
    var candidates = [];
    for (var i = 0; i < this.board.cells.length; i++) {
      var gem = this.board.cells[i];
      if (gem && gem.kind === 'gem' && gem.special === SPECIAL.NONE) candidates.push(i);
    }

    if (!candidates.length) {
      this.finale = null;
      this.completeLevel();
      return;
    }

    var batch = Math.min(this.finale.left, this.finale.perStep, candidates.length);
    this.finale.left -= batch;
    this.movesLeft = this.finale.left;
    this.emitStats();

    Utils.shuffleArray(Math.random, candidates);
    var picks = candidates.slice(0, batch);

    picks.forEach(function (idx) {
      this.board.cells[idx].special = Math.random() < 0.5 ? SPECIAL.LINE_H : SPECIAL.LINE_V;
    }, this);

    this.cascade = 0;
    this.pendingSwapSeeds = { a: picks[0], b: picks[0], rainbow: picks, targets: {} };
    this.resolve();
  };

  Game.prototype.startShuffle = function (message, minMoves) {
    this.say(message || 'Kein Zug mehr möglich — Feld wird gemischt', !message);
    Audio.shuffle();
    this.board.shuffle(minMoves);

    /* Steine fliegen kurz auseinander und sortieren sich neu ein. */
    for (var i = 0; i < this.board.cells.length; i++) {
      var gem = this.board.cells[i];
      if (!gem) continue;
      gem.birth = 0;
      gem.spin = (Math.random() - 0.5) * 4;
    }

    var mid = this.cellCenter(this.cols / 2 - 0.5, this.rows / 2 - 0.5);
    this.fx.ring(mid.x, mid.y, this.cell * this.cols * 0.6, '#b36bff', 5);

    this.setPhase(PHASE.SHUFFLE);
  };

  /* ====================================================================== */
  /*  Punkte, Zeit, Levelende                                               */
  /* ====================================================================== */

  Game.prototype.addScore = function (points) {
    this.totalScore += points;
    this.levelScore += points;
    this.emitStats();
  };

  Game.prototype.emitStats = function () {
    if (this.hooks.onStats) {
      this.hooks.onStats({
        level: this.level,
        score: this.totalScore,
        levelScore: this.levelScore,
        movesLeft: this.movesLeft,
        movesTotal: this.def.moves,
        goals: this.def.goals,
        progress: this.progress
      });
    }
  };

  Game.prototype.say = function (text, warn) {
    if (this.hooks.onHint) this.hooks.onHint(text, !!warn);
  };

  Game.prototype.completeLevel = function () {
    this.speed = 1;
    this.running = false;
    this.setPhase(PHASE.DONE);
    this.emitStats();

    /* Bewertet wird der Stand bei Erfuellung der Aufgaben, nicht nach dem
       Finale — sonst gaebe es immer nur einen Stern. */
    var stars = Levels.starsFor(this.finaleMovesAtWin || 0, this.def.moves);

    Audio.levelUp();

    var mid = this.cellCenter(this.cols / 2 - 0.5, this.rows / 2 - 0.5);
    for (var i = 0; i < 5; i++) {
      this.fx.ring(mid.x, mid.y, this.cell * (2 + i * 1.6), COLORS[i % COLORS.length], 4);
    }

    if (this.hooks.onLevelComplete) {
      this.hooks.onLevelComplete({
        level: this.level,
        nextLevel: this.level + 1,
        levelScore: this.levelScore,
        movesLeft: this.finaleMovesAtWin || 0,
        movesTotal: this.def.moves,
        stars: stars,
        total: this.totalScore
      });
    }
  };

  /* Zuege alle, Aufgaben offen. Das Level ist noch nicht endgueltig verloren —
     main.js bietet erst Extra-Zuege an, bevor ein Herz faellig wird. */
  Game.prototype.levelFailed = function () {
    this.running = false;
    this.setPhase(PHASE.DONE);
    this.emitStats();

    Audio.gameOver();

    if (this.hooks.onLevelFailed) {
      this.hooks.onLevelFailed({
        level: this.level,
        levelScore: this.levelScore,
        score: this.totalScore,
        goals: this.def.goals,
        progress: this.progress
      });
    }
  };

  /* Weiterspielen, nachdem das Verloren-Popup Extra-Zuege verkauft hat. */
  Game.prototype.grantMoves = function (extra) {
    this.running = true;
    this.paused = false;

    this.addMoves(extra);
    this.say('Weiter geht’s!');

    /* Kuemmert sich auch darum, falls inzwischen kein Zug mehr existiert. */
    this.finishChain();
  };

  Game.prototype.addShake = function (amount) {
    if (this.reducedMotion) amount *= 0.25;
    this.shake = Math.min(22, this.shake + amount);
  };

  /* ====================================================================== */
  /*  Update                                                                */
  /* ====================================================================== */

  Game.prototype.update = function (dt) {
    /* Bei Tab-Wechseln liefert requestAnimationFrame riesige Zeitspruenge —
       gedeckelt, damit Tweens nicht ueberspringen. */
    dt = Math.min(dt, 0.05);

    this.fx.update(dt);
    this.shake *= Math.pow(0.001, dt);
    this.flash *= Math.pow(0.0015, dt);

    if (this.running && !this.paused) {
      this.phaseT += dt;
      this.updatePhase(dt);
    }

    this.updateGemViews(dt);
  };

  Game.prototype.updatePhase = function (dt) {
    switch (this.phase) {

      case PHASE.IDLE:
        this.idleTime += dt;
        if (this.idleTime > HINT_DELAY && !this.hint) {
          this.hint = this.board.findHint();
          if (this.hint) this.say('Tipp: dieser Zug geht');
        }
        break;

      case PHASE.SWAP:
        if (this.phaseT >= this.swapAnim.duration) {
          var wasValid = this.swapAnim.valid;
          this.swapAnim = null;
          if (wasValid) {
            this.resolve();
          } else {
            this.setPhase(PHASE.IDLE);
          }
        }
        break;

      case PHASE.CLEAR:
        if (this.phaseT >= T_CLEAR * this.speed) {
          this.popping.length = 0;
          this.spawnBirthsAndFall();
        }
        break;

      case PHASE.FALL:
        var done = true;
        for (var i = 0; i < this.falling.length; i++) {
          var f = this.falling[i];
          if (this.phaseT < f.delay + f.duration) { done = false; break; }
        }
        if (done) {
          this.falling.length = 0;
          this.resolve();
        }
        break;

      case PHASE.SHUFFLE:
        if (this.phaseT >= T_SHUFFLE) {
          this.say('Ziehe oder tippe zwei benachbarte Steine');
          this.finishChain();
        }
        break;
    }
  };

  /* Positionen und Skalierungen aller sichtbaren Steine nachziehen. */
  Game.prototype.updateGemViews = function (dt) {
    if (!this.board) return;

    var i, gem;

    /* Grundzustand: jeder Stein sitzt auf seinem Feld. */
    for (i = 0; i < this.board.cells.length; i++) {
      gem = this.board.cells[i];
      if (!gem) continue;

      if (gem.gx === undefined) {
        gem.gx = this.board.colOf(i);
        gem.gy = this.board.rowOf(i);
        gem.scale = 1;
        gem.birth = 1;
        gem.spin = 0;
        gem.glow = 0;
      }

      if (this.phase !== PHASE.FALL && this.phase !== PHASE.SWAP) {
        gem.gx = this.board.colOf(i);
        gem.gy = this.board.rowOf(i);
      }

      /* Geburt: aus dem Nichts aufpoppen. */
      if (gem.birth < 1) {
        gem.birth = Math.min(1, gem.birth + dt / 0.34);
        gem.spin *= 0.9;
      }

      /* Spezialsteine pulsieren dauerhaft leicht. */
      var isSpecial = gem.kind === 'rainbow' || gem.special !== SPECIAL.NONE;
      gem.glow = isSpecial ? 1 : Math.max(0, gem.glow - dt * 2);
    }

    if (this.phase === PHASE.SWAP && this.swapAnim) this.updateSwapViews();
    if (this.phase === PHASE.FALL) this.updateFallViews();

    /* Auflös-Animation. */
    var popT = Utils.clamp(this.phaseT / (T_CLEAR * this.speed), 0, 1);
    for (i = 0; i < this.popping.length; i++) {
      this.popping[i].popT = popT;
    }
  };

  Game.prototype.updateSwapViews = function () {
    var anim = this.swapAnim;
    var t = Utils.progress(this.phaseT, anim.duration);

    var ca = this.board.colOf(anim.a);
    var ra = this.board.rowOf(anim.a);
    var cb = this.board.colOf(anim.b);
    var rb = this.board.rowOf(anim.b);

    /* Gueltig: einmal hinueber. Ungueltig: hin und wieder zurueck. */
    var e = anim.valid ? Utils.easeOutBack(t) : Utils.pingPong(t) * 0.62;

    if (anim.gemA) {
      anim.gemA.gx = Utils.lerp(ca, cb, e);
      anim.gemA.gy = Utils.lerp(ra, rb, e);
    }
    if (anim.gemB) {
      anim.gemB.gx = Utils.lerp(cb, ca, e);
      anim.gemB.gy = Utils.lerp(rb, ra, e);
    }
  };

  Game.prototype.updateFallViews = function () {
    for (var i = 0; i < this.falling.length; i++) {
      var f = this.falling[i];
      var local = this.phaseT - f.delay;

      if (local <= 0) {
        f.gem.gy = f.from;
        continue;
      }

      var t = Utils.progress(local, f.duration);
      f.gem.gy = Utils.lerp(f.from, f.to, Utils.easeOutBounce(t));
    }
  };

  /* ====================================================================== */
  /*  Rendering                                                             */
  /* ====================================================================== */

  Game.prototype.render = function (time) {
    var ctx = this.ctx;
    var size = this.cssSize;

    ctx.clearRect(0, 0, size, size);
    if (!this.board) return;

    ctx.save();

    /* Screen-Shake. */
    if (this.shake > 0.4) {
      ctx.translate(
        (Math.random() - 0.5) * this.shake,
        (Math.random() - 0.5) * this.shake
      );
    }

    this.drawGrid(ctx, time);
    this.drawGems(ctx, time);
    this.drawPopping(ctx);
    this.fx.draw(ctx);
    this.drawSelection(ctx, time);

    ctx.restore();

    /* Kurzer Weißblitz bei dicken Kaskaden. */
    if (this.flash > 0.01) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,255,255,' + (this.flash * 0.35) + ')';
      ctx.fillRect(0, 0, size, size);
      ctx.restore();
    }
  };

  Game.prototype.drawGrid = function (ctx) {
    var cell = this.cell;

    for (var r = 0; r < this.rows; r++) {
      for (var c = 0; c < this.cols; c++) {
        var x = this.pad + c * cell;
        var y = this.pad + r * cell;

        ctx.fillStyle = (c + r) % 2 === 0 ? 'rgba(255,255,255,0.035)' : 'rgba(255,255,255,0.015)';
        roundRect(ctx, x + 2, y + 2, cell - 4, cell - 4, cell * 0.16);
        ctx.fill();
      }
    }
  };

  Game.prototype.drawGems = function (ctx, time) {
    for (var i = 0; i < this.board.cells.length; i++) {
      var gem = this.board.cells[i];
      if (!gem) continue;
      this.drawGem(ctx, gem, 1, time);
    }
  };

  Game.prototype.drawPopping = function (ctx) {
    for (var i = 0; i < this.popping.length; i++) {
      var gem = this.popping[i];
      var t = gem.popT || 0;

      /* Erst kurz aufblaehen, dann in sich zusammenfallen. */
      var scale = t < 0.3
        ? Utils.lerp(1, 1.28, Utils.easeOutCubic(t / 0.3))
        : Utils.lerp(1.28, 0, Utils.easeInCubic((t - 0.3) / 0.7));

      gem.spin = t * 3.2;
      this.drawGem(ctx, gem, Math.max(0, 1 - t * 0.85), 0, scale);
    }
  };

  Game.prototype.drawGem = function (ctx, gem, alpha, time, forcedScale) {
    var cell = this.cell;
    var cx = this.pad + (gem.gx + 0.5) * cell;
    var cy = this.pad + (gem.gy + 0.5) * cell;

    var birth = gem.birth === undefined ? 1 : gem.birth;
    var scale = forcedScale !== undefined ? forcedScale : Utils.easeOutBack(birth);
    if (scale <= 0.001) return;

    var radius = cell * 0.36 * scale;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy);
    if (gem.spin) ctx.rotate(gem.spin);

    if (gem.kind === 'blocker') {
      drawBlocker(ctx, radius);
      ctx.restore();
      return;
    }

    if (gem.kind === 'rainbow') {
      drawRainbow(ctx, radius, time || 0);
      ctx.restore();
      return;
    }

    var color = COLORS[gem.type % COLORS.length];
    var shape = SHAPES[gem.type % SHAPES.length];

    /* Spezialsteine bekommen einen pulsierenden Schein. */
    if (gem.special !== SPECIAL.NONE) {
      var pulse = 0.6 + 0.4 * Math.sin((time || 0) * 6);
      ctx.shadowBlur = 22 * pulse;
      ctx.shadowColor = color;
    } else {
      ctx.shadowBlur = 9;
      ctx.shadowColor = Utils.withAlpha(color, 0.55);
    }

    var grad = ctx.createLinearGradient(-radius, -radius, radius, radius);
    grad.addColorStop(0, lighten(color, 0.45));
    grad.addColorStop(0.55, color);
    grad.addColorStop(1, darken(color, 0.35));
    ctx.fillStyle = grad;

    tracePath(ctx, shape, radius);
    ctx.fill();

    ctx.shadowBlur = 0;

    /* Glanzlicht oben links — gibt den Steinen Volumen. */
    ctx.globalAlpha = alpha * 0.5;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.ellipse(-radius * 0.3, -radius * 0.38, radius * 0.3, radius * 0.19, -0.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = alpha;

    if (gem.special === SPECIAL.LINE_H || gem.special === SPECIAL.LINE_V) {
      drawLineMarks(ctx, radius, gem.special === SPECIAL.LINE_H);
    } else if (gem.special === SPECIAL.BOMB) {
      drawBombMarks(ctx, radius, time || 0);
    }

    ctx.restore();
  };

  Game.prototype.drawSelection = function (ctx, time) {
    var cell = this.cell;
    var pulse = 0.5 + 0.5 * Math.sin(time * 5);

    if (this.selected !== null && this.board.cells[this.selected]) {
      this.strokeCell(ctx, this.selected, '#ffffff', 3, 0.55 + pulse * 0.45);
    }

    if (this.cursor !== null) {
      this.strokeCell(ctx, this.cursor, '#38f2d8', 2, 0.8);
    }

    if (this.hint && this.phase === PHASE.IDLE) {
      var glow = 0.25 + pulse * 0.5;
      this.strokeCell(ctx, this.hint.a, '#ffcc4d', 3, glow);
      this.strokeCell(ctx, this.hint.b, '#ffcc4d', 3, glow);
    }
  };

  Game.prototype.strokeCell = function (ctx, idx, color, width, alpha) {
    var c = this.board.colOf(idx);
    var r = this.board.rowOf(idx);
    var cell = this.cell;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.shadowBlur = 14;
    ctx.shadowColor = color;
    roundRect(ctx, this.pad + c * cell + 3, this.pad + r * cell + 3, cell - 6, cell - 6, cell * 0.18);
    ctx.stroke();
    ctx.restore();
  };

  /* ====================================================================== */
  /*  Zeichenhilfen                                                         */
  /* ====================================================================== */

  function roundRect(ctx, x, y, w, h, r) {
    var rad = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
  }

  function tracePath(ctx, shape, r) {
    var i, angle;
    ctx.beginPath();

    switch (shape) {
      case 'circle':
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        break;

      case 'diamond':
        ctx.moveTo(0, -r);
        ctx.lineTo(r * 0.86, 0);
        ctx.lineTo(0, r);
        ctx.lineTo(-r * 0.86, 0);
        ctx.closePath();
        break;

      case 'triangle':
        ctx.moveTo(0, -r);
        ctx.lineTo(r * 0.92, r * 0.72);
        ctx.lineTo(-r * 0.92, r * 0.72);
        ctx.closePath();
        break;

      case 'hexagon':
        for (i = 0; i < 6; i++) {
          angle = (Math.PI / 3) * i - Math.PI / 2;
          ctx[i ? 'lineTo' : 'moveTo'](Math.cos(angle) * r, Math.sin(angle) * r);
        }
        ctx.closePath();
        break;

      case 'star':
        for (i = 0; i < 10; i++) {
          var rad = i % 2 === 0 ? r : r * 0.46;
          angle = (Math.PI / 5) * i - Math.PI / 2;
          ctx[i ? 'lineTo' : 'moveTo'](Math.cos(angle) * rad, Math.sin(angle) * rad);
        }
        ctx.closePath();
        break;

      case 'cross':
        var a = r * 0.36;
        var b = r * 0.95;
        ctx.moveTo(-a, -b);
        ctx.lineTo(a, -b);
        ctx.lineTo(a, -a);
        ctx.lineTo(b, -a);
        ctx.lineTo(b, a);
        ctx.lineTo(a, a);
        ctx.lineTo(a, b);
        ctx.lineTo(-a, b);
        ctx.lineTo(-a, a);
        ctx.lineTo(-b, a);
        ctx.lineTo(-b, -a);
        ctx.lineTo(-a, -a);
        ctx.closePath();
        break;

      default: /* square */
        roundRect(ctx, -r * 0.86, -r * 0.86, r * 1.72, r * 1.72, r * 0.3);
    }
  }

  function drawLineMarks(ctx, r, horizontal) {
    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ffffff';

    for (var i = -1; i <= 1; i++) {
      if (horizontal) ctx.fillRect(-r * 0.75, i * r * 0.3 - r * 0.055, r * 1.5, r * 0.11);
      else ctx.fillRect(i * r * 0.3 - r * 0.055, -r * 0.75, r * 0.11, r * 1.5);
    }
    ctx.restore();
  }

  function drawBombMarks(ctx, r, time) {
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1.5, r * 0.12);
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#fff3c4';

    var pulse = 0.72 + 0.16 * Math.sin(time * 7);
    ctx.beginPath();
    ctx.arc(0, 0, r * pulse, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, r * 0.24, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();
  }

  function drawRainbow(ctx, r, time) {
    var slices = 12;

    ctx.save();
    ctx.rotate(time * 0.9);
    ctx.shadowBlur = 22;
    ctx.shadowColor = '#ffffff';

    for (var i = 0; i < slices; i++) {
      var a0 = (Math.PI * 2 / slices) * i;
      var a1 = a0 + (Math.PI * 2 / slices);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, a0, a1);
      ctx.closePath();
      ctx.fillStyle = COLORS[i % COLORS.length];
      ctx.fill();
    }

    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.42, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fill();
    ctx.restore();
  }

  function drawBlocker(ctx, r) {
    ctx.save();
    var grad = ctx.createLinearGradient(-r, -r, r, r);
    grad.addColorStop(0, '#8b87a8');
    grad.addColorStop(0.5, '#5a5675');
    grad.addColorStop(1, '#33304a');
    ctx.fillStyle = grad;
    roundRect(ctx, -r * 0.94, -r * 0.94, r * 1.88, r * 1.88, r * 0.22);
    ctx.fill();

    /* Ein paar Risse, damit der Fels nicht wie ein Stein-Emoji wirkt. */
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = Math.max(1, r * 0.09);
    ctx.beginPath();
    ctx.moveTo(-r * 0.5, -r * 0.6);
    ctx.lineTo(-r * 0.1, 0);
    ctx.lineTo(-r * 0.45, r * 0.6);
    ctx.moveTo(r * 0.15, -r * 0.7);
    ctx.lineTo(r * 0.5, r * 0.1);
    ctx.stroke();
    ctx.restore();
  }

  /* Farbe aufhellen / abdunkeln, ohne eine Farbbibliothek zu schleppen. */
  function shift(hex, amount) {
    var h = hex.replace('#', '');
    var out = '#';
    for (var i = 0; i < 3; i++) {
      var v = parseInt(h.substr(i * 2, 2), 16);
      v = amount > 0
        ? Math.round(v + (255 - v) * amount)
        : Math.round(v * (1 + amount));
      out += ('0' + Utils.clamp(v, 0, 255).toString(16)).slice(-2);
    }
    return out;
  }

  function lighten(hex, amount) { return shift(hex, amount); }
  function darken(hex, amount) { return shift(hex, -amount); }

  /* ====================================================================== */

  root.M3.Game = Game;
  root.M3.GEM_COLORS = COLORS;

  /* Der Startbildschirm zeichnet dieselben Formen im Hintergrund. */
  root.M3.traceGemShape = function (ctx, typeIndex, radius) {
    tracePath(ctx, SHAPES[typeIndex % SHAPES.length], radius);
  };

})(typeof globalThis !== 'undefined' ? globalThis : this);
