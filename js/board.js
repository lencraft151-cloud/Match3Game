/* ==========================================================================
   Board — reine Spielfeld-Logik, ohne Rendering und ohne DOM.

   Ein Feld enthaelt entweder `null` oder einen Stein:
     { id, kind, type, special }

     kind    'gem'      normaler Stein, matcht ueber `type`
             'rainbow'  Prisma; matcht nie, wirkt nur beim Tausch
             'blocker'  Fels; nicht tauschbar, zerbricht durch Treffer nebenan
     type    Farbindex 0..colors-1 (nur bei kind 'gem')
     special SPECIAL.* — Blitz oder Bombe, nur bei kind 'gem'

   Rendering-Felder (Position, Skalierung) haengt game.js zusaetzlich an
   dasselbe Objekt; board.js fasst sie nie an.
   ========================================================================== */

(function (root) {
  'use strict';

  var Utils = (typeof module !== 'undefined' && module.exports)
    ? require('./utils.js')
    : root.M3.Utils;

  var SPECIAL = {
    NONE: 0,
    LINE_H: 1,   /* raeumt die Zeile */
    LINE_V: 2,   /* raeumt die Spalte */
    BOMB: 3      /* raeumt 3x3 */
  };

  var nextGemId = 1;

  /* ====================================================================== */

  function Board(options) {
    var opts = options || {};
    this.cols = opts.cols || 8;
    this.rows = opts.rows || 8;
    this.colors = opts.colors || 6;
    this.rng = opts.rng || Utils.makeRng(0);
    this.cells = new Array(this.cols * this.rows).fill(null);
  }

  /* ----------------------------------------------------------- Grundlagen */

  Board.prototype.idx = function (c, r) {
    return r * this.cols + c;
  };

  Board.prototype.colOf = function (i) {
    return i % this.cols;
  };

  Board.prototype.rowOf = function (i) {
    return Math.floor(i / this.cols);
  };

  Board.prototype.inBounds = function (c, r) {
    return c >= 0 && c < this.cols && r >= 0 && r < this.rows;
  };

  Board.prototype.at = function (c, r) {
    if (!this.inBounds(c, r)) return null;
    return this.cells[this.idx(c, r)];
  };

  Board.prototype.set = function (c, r, gem) {
    this.cells[this.idx(c, r)] = gem;
  };

  Board.prototype.neighbors4 = function (i) {
    var c = this.colOf(i);
    var r = this.rowOf(i);
    var out = [];
    if (c > 0) out.push(i - 1);
    if (c < this.cols - 1) out.push(i + 1);
    if (r > 0) out.push(i - this.cols);
    if (r < this.rows - 1) out.push(i + this.cols);
    return out;
  };

  /* -------------------------------------------------------- Steine bauen */

  Board.prototype.makeGem = function (type, special) {
    return {
      id: nextGemId++,
      kind: 'gem',
      type: type,
      special: special || SPECIAL.NONE
    };
  };

  Board.prototype.makeRainbow = function () {
    return { id: nextGemId++, kind: 'rainbow', type: -1, special: SPECIAL.NONE };
  };

  Board.prototype.makeBlocker = function () {
    return { id: nextGemId++, kind: 'blocker', type: -1, special: SPECIAL.NONE };
  };

  Board.prototype.randomType = function () {
    return Utils.randInt(this.rng, this.colors);
  };

  /* Waehlt eine Farbe, die an dieser Stelle keinen Dreier bildet. Wird beim
     Auffuellen benutzt, damit nie geschenkte Matches entstehen. */
  Board.prototype.safeTypeAt = function (c, r) {
    var banned = {};

    var l1 = this.at(c - 1, r);
    var l2 = this.at(c - 2, r);
    if (l1 && l2 && l1.kind === 'gem' && l2.kind === 'gem' && l1.type === l2.type) {
      banned[l1.type] = true;
    }

    var u1 = this.at(c, r - 1);
    var u2 = this.at(c, r - 2);
    if (u1 && u2 && u1.kind === 'gem' && u2.kind === 'gem' && u1.type === u2.type) {
      banned[u1.type] = true;
    }

    var allowed = [];
    for (var t = 0; t < this.colors; t++) {
      if (!banned[t]) allowed.push(t);
    }
    /* Bei sehr wenigen Farben kann theoretisch alles gesperrt sein. */
    if (!allowed.length) return this.randomType();
    return Utils.pick(this.rng, allowed);
  };

  /* ------------------------------------------------------- Board aufbauen */

  /* Baut ein komplettes Startfeld: Blocker verteilen, Rest matchfrei
     auffuellen und sicherstellen, dass mindestens ein Zug existiert. */
  Board.prototype.generate = function (blockerCount) {
    var attempts = 0;

    do {
      this.cells.fill(null);
      this.placeBlockers(blockerCount || 0);

      for (var r = 0; r < this.rows; r++) {
        for (var c = 0; c < this.cols; c++) {
          if (this.at(c, r)) continue;
          this.set(c, r, this.makeGem(this.safeTypeAt(c, r), SPECIAL.NONE));
        }
      }
      attempts++;
    } while (!this.hasValidMove() && attempts < 40);

    /* Extrem unwahrscheinlich, aber lieber ein gemischtes Feld als ein totes. */
    if (!this.hasValidMove()) this.shuffle();
  };

  /* Blocker landen nie in der obersten Zeile — von dort rutschen neue Steine
     nach, und ein Fels direkt am Einwurf wirkt wie ein Fehler. */
  Board.prototype.placeBlockers = function (count) {
    if (count <= 0) return;

    var spots = [];
    for (var r = 1; r < this.rows; r++) {
      for (var c = 0; c < this.cols; c++) spots.push(this.idx(c, r));
    }
    Utils.shuffleArray(this.rng, spots);

    var placed = 0;
    for (var i = 0; i < spots.length && placed < count; i++) {
      var idx = spots[i];
      /* Blocker nicht direkt aneinanderkleben lassen — sonst entstehen
         Wände, die eine Spalte komplett blockieren. */
      var touching = this.neighbors4(idx).some(function (n) {
        return this.cells[n] && this.cells[n].kind === 'blocker';
      }, this);
      if (touching) continue;

      this.cells[idx] = this.makeBlocker();
      placed++;
    }
  };

  /* --------------------------------------------------------- Match-Suche */

  /* Sammelt alle waagerechten und senkrechten Ketten ab Laenge 3. */
  Board.prototype.findRuns = function () {
    var runs = [];
    var c, r, i;

    function flush(cells, dir) {
      if (cells.length >= 3) runs.push({ cells: cells.slice(), dir: dir, len: cells.length });
    }

    for (r = 0; r < this.rows; r++) {
      var hRun = [];
      var hType = -1;
      for (c = 0; c < this.cols; c++) {
        var g = this.at(c, r);
        if (g && g.kind === 'gem' && g.type === hType) {
          hRun.push(this.idx(c, r));
        } else {
          flush(hRun, 'h');
          if (g && g.kind === 'gem') {
            hRun = [this.idx(c, r)];
            hType = g.type;
          } else {
            hRun = [];
            hType = -1;
          }
        }
      }
      flush(hRun, 'h');
    }

    for (c = 0; c < this.cols; c++) {
      var vRun = [];
      var vType = -1;
      for (r = 0; r < this.rows; r++) {
        var g2 = this.at(c, r);
        if (g2 && g2.kind === 'gem' && g2.type === vType) {
          vRun.push(this.idx(c, r));
        } else {
          flush(vRun, 'v');
          if (g2 && g2.kind === 'gem') {
            vRun = [this.idx(c, r)];
            vType = g2.type;
          } else {
            vRun = [];
            vType = -1;
          }
        }
      }
      flush(vRun, 'v');
    }

    return runs;
  };

  /* Fasst ueberlappende Ketten zu Clustern zusammen (Union-Find), damit
     L- und T-Formen als eine Einheit gelten und eine Bombe erzeugen. */
  Board.prototype.findClusters = function () {
    var runs = this.findRuns();
    if (!runs.length) return [];

    var parent = {};

    function find(x) {
      while (parent[x] !== x) {
        parent[x] = parent[parent[x]];
        x = parent[x];
      }
      return x;
    }

    function union(a, b) {
      var ra = find(a);
      var rb = find(b);
      if (ra !== rb) parent[rb] = ra;
    }

    runs.forEach(function (run) {
      run.cells.forEach(function (idx) {
        if (parent[idx] === undefined) parent[idx] = idx;
      });
      for (var k = 1; k < run.cells.length; k++) union(run.cells[0], run.cells[k]);
    });

    var byRoot = {};

    runs.forEach(function (run) {
      var rootId = find(run.cells[0]);
      if (!byRoot[rootId]) {
        byRoot[rootId] = { cells: [], seen: {}, maxH: 0, maxV: 0, type: -1 };
      }
      var cluster = byRoot[rootId];
      if (run.dir === 'h') cluster.maxH = Math.max(cluster.maxH, run.len);
      else cluster.maxV = Math.max(cluster.maxV, run.len);

      run.cells.forEach(function (idx) {
        if (!cluster.seen[idx]) {
          cluster.seen[idx] = true;
          cluster.cells.push(idx);
        }
      });
    }, this);

    var self = this;
    return Object.keys(byRoot).map(function (key) {
      var cluster = byRoot[key];
      var first = self.cells[cluster.cells[0]];
      cluster.type = first ? first.type : -1;
      cluster.special = Board.specialForCluster(cluster);
      delete cluster.seen;
      return cluster;
    });
  };

  /* Welcher Spezialstein entsteht aus einem Cluster?
       5 in einer Reihe        -> Prisma (als eigener kind, siehe game.js)
       L-/T-Form (H und V)     -> Bombe
       genau 4 in einer Reihe  -> Blitz in Richtung der Kette
     Ein waagerechter Vierer erzeugt also einen Blitz, der die Zeile raeumt. */
  Board.specialForCluster = function (cluster) {
    if (cluster.maxH >= 5 || cluster.maxV >= 5) return 'rainbow';
    if (cluster.maxH >= 3 && cluster.maxV >= 3) return SPECIAL.BOMB;
    if (cluster.maxH === 4) return SPECIAL.LINE_H;
    if (cluster.maxV === 4) return SPECIAL.LINE_V;
    return SPECIAL.NONE;
  };

  /* Sitzt an (c,r) ein Stein, der Teil eines Dreiers ist? Schneller Test
     fuer die Zugpruefung — schaut nur um das eine Feld herum. */
  Board.prototype.hasMatchAt = function (c, r) {
    var g = this.at(c, r);
    if (!g || g.kind !== 'gem') return false;

    var self = this;

    function run(dc, dr) {
      var n = 0;
      var cc = c + dc;
      var rr = r + dr;
      while (self.inBounds(cc, rr)) {
        var o = self.at(cc, rr);
        if (!o || o.kind !== 'gem' || o.type !== g.type) break;
        n++;
        cc += dc;
        rr += dr;
      }
      return n;
    }

    if (1 + run(-1, 0) + run(1, 0) >= 3) return true;
    if (1 + run(0, -1) + run(0, 1) >= 3) return true;
    return false;
  };

  /* --------------------------------------------------------------- Zuege */

  /* Darf zwischen diesen beiden Feldern ueberhaupt getauscht werden?
     Prueft nur Nachbarschaft und Steinart, nicht ob ein Match entsteht. */
  Board.prototype.canSwap = function (a, b) {
    var ga = this.cells[a];
    var gb = this.cells[b];
    if (!ga || !gb) return false;
    if (ga.kind === 'blocker' || gb.kind === 'blocker') return false;

    var dc = Math.abs(this.colOf(a) - this.colOf(b));
    var dr = Math.abs(this.rowOf(a) - this.rowOf(b));
    return dc + dr === 1;
  };

  Board.prototype.swap = function (a, b) {
    var tmp = this.cells[a];
    this.cells[a] = this.cells[b];
    this.cells[b] = tmp;
  };

  /* Bringt der Tausch etwas? Ein Prisma ist immer ein gueltiger Zug,
     alles andere muss einen Dreier erzeugen. */
  Board.prototype.swapWouldScore = function (a, b) {
    if (!this.canSwap(a, b)) return false;

    var ga = this.cells[a];
    var gb = this.cells[b];
    if (ga.kind === 'rainbow' || gb.kind === 'rainbow') return true;

    this.swap(a, b);
    var ok = this.hasMatchAt(this.colOf(a), this.rowOf(a)) ||
             this.hasMatchAt(this.colOf(b), this.rowOf(b));
    this.swap(a, b);
    return ok;
  };

  /* Erster gueltige Zug, den das Board hergibt — dient als Tipp und als
     Deadlock-Test. */
  Board.prototype.findHint = function () {
    for (var r = 0; r < this.rows; r++) {
      for (var c = 0; c < this.cols; c++) {
        var i = this.idx(c, r);
        if (c < this.cols - 1 && this.swapWouldScore(i, i + 1)) {
          return { a: i, b: i + 1 };
        }
        if (r < this.rows - 1 && this.swapWouldScore(i, i + this.cols)) {
          return { a: i, b: i + this.cols };
        }
      }
    }
    return null;
  };

  Board.prototype.hasValidMove = function () {
    return this.findHint() !== null;
  };

  /* Mischt die vorhandenen Farben neu durch, ohne Blocker und Spezialsteine
     zu verschieben. Wiederholt, bis das Feld matchfrei und spielbar ist. */
  Board.prototype.shuffle = function () {
    var movable = [];
    var i;

    for (i = 0; i < this.cells.length; i++) {
      var g = this.cells[i];
      if (g && g.kind === 'gem' && g.special === SPECIAL.NONE) movable.push(i);
    }

    if (movable.length < 3) return false;

    for (var attempt = 0; attempt < 60; attempt++) {
      var types = movable.map(function (idx) { return this.cells[idx].type; }, this);
      Utils.shuffleArray(this.rng, types);
      for (i = 0; i < movable.length; i++) this.cells[movable[i]].type = types[i];

      if (!this.findRuns().length && this.hasValidMove()) return true;
    }

    /* Notnagel: neu wuerfeln statt in einem toten Feld haengen zu bleiben. */
    for (i = 0; i < movable.length; i++) {
      this.cells[movable[i]].type = this.randomType();
    }
    return this.hasValidMove();
  };

  /* ------------------------------------------------------------ Explosion */

  /* Alle Felder, die ein aktivierter Stein trifft. */
  Board.prototype.blastTargets = function (idx, gem, rainbowType) {
    var out = [];
    var c = this.colOf(idx);
    var r = this.rowOf(idx);
    var i;

    if (gem.kind === 'rainbow') {
      var target = (rainbowType === undefined || rainbowType < 0)
        ? this.mostCommonType()
        : rainbowType;
      for (i = 0; i < this.cells.length; i++) {
        var g = this.cells[i];
        if (g && g.kind === 'gem' && g.type === target) out.push(i);
      }
      return out;
    }

    if (gem.special === SPECIAL.LINE_H) {
      for (i = 0; i < this.cols; i++) out.push(this.idx(i, r));
    } else if (gem.special === SPECIAL.LINE_V) {
      for (i = 0; i < this.rows; i++) out.push(this.idx(c, i));
    } else if (gem.special === SPECIAL.BOMB) {
      for (var dr = -1; dr <= 1; dr++) {
        for (var dc = -1; dc <= 1; dc++) {
          if (this.inBounds(c + dc, r + dr)) out.push(this.idx(c + dc, r + dr));
        }
      }
    }

    return out;
  };

  Board.prototype.mostCommonType = function () {
    var counts = new Array(this.colors).fill(0);
    for (var i = 0; i < this.cells.length; i++) {
      var g = this.cells[i];
      if (g && g.kind === 'gem') counts[g.type]++;
    }
    var best = 0;
    for (var t = 1; t < this.colors; t++) {
      if (counts[t] > counts[best]) best = t;
    }
    return best;
  };

  /* Loest ausgehend von den getroffenen Feldern die komplette Kettenreaktion
     auf: jeder geraeumte Spezialstein zuendet seinerseits.

     `rainbowTargets` ordnet einem Prisma-Feld die Zielfarbe zu (beim Tausch
     die Farbe des Partnersteins). Ohne Eintrag nimmt es die haeufigste Farbe.

     Liefert die Felder, die verschwinden — Steine und Blocker getrennt —
     sowie die Reihenfolge der Zuendungen fuer die Animation. */
  Board.prototype.resolveBlast = function (seedIndices, rainbowTargets) {
    var cleared = new Set();
    var activations = [];
    var queue = seedIndices.slice();
    var targets = rainbowTargets || {};
    var guard = 0;

    while (queue.length && guard++ < 4000) {
      var idx = queue.shift();
      if (cleared.has(idx)) continue;

      var gem = this.cells[idx];
      if (!gem) continue;
      /* Fels verschwindet nur ueber die Nachbarschaftsregel weiter unten. */
      if (gem.kind === 'blocker') continue;

      cleared.add(idx);

      var isSpecial = gem.kind === 'rainbow' || gem.special !== SPECIAL.NONE;
      if (!isSpecial) continue;

      var hits = this.blastTargets(idx, gem, targets[idx]);
      activations.push({
        idx: idx,
        kind: gem.kind,
        special: gem.special,
        type: gem.type,
        hits: hits
      });

      for (var k = 0; k < hits.length; k++) {
        if (!cleared.has(hits[k])) queue.push(hits[k]);
      }
    }

    /* Fels zerbricht, wenn direkt daneben etwas geraeumt wurde. */
    var blockers = new Set();
    var self = this;
    cleared.forEach(function (idx) {
      self.neighbors4(idx).forEach(function (n) {
        var g = self.cells[n];
        if (g && g.kind === 'blocker') blockers.add(n);
      });
    });

    return {
      cleared: Array.from(cleared),
      blockers: Array.from(blockers),
      activations: activations
    };
  };

  Board.prototype.remove = function (indices) {
    for (var i = 0; i < indices.length; i++) this.cells[indices[i]] = null;
  };

  /* ------------------------------------------------------------ Schwerkraft */

  /* Laesst alles nachrutschen und fuellt von oben auf. Liefert pro bewegtem
     Stein, woher er kommt — negative Startzeilen liegen ueber dem Feld und
     lassen game.js die neuen Steine einfliegen. */
  Board.prototype.applyGravity = function () {
    var moves = [];

    for (var c = 0; c < this.cols; c++) {
      var write = this.rows - 1;

      for (var r = this.rows - 1; r >= 0; r--) {
        var gem = this.at(c, r);
        if (!gem) continue;

        if (r !== write) {
          this.set(c, write, gem);
          this.set(c, r, null);
          moves.push({ gem: gem, col: c, fromRow: r, toRow: write, spawned: false });
        }
        write--;
      }

      var spawnOffset = 1;
      for (var rr = write; rr >= 0; rr--) {
        var fresh = this.makeGem(this.randomType(), SPECIAL.NONE);
        this.set(c, rr, fresh);
        moves.push({ gem: fresh, col: c, fromRow: -spawnOffset, toRow: rr, spawned: true });
        spawnOffset++;
      }
    }

    return moves;
  };

  /* ------------------------------------------------------------ Debug-Hilfe */

  Board.prototype.toString = function () {
    var glyphs = 'ABCDEFGH';
    var out = [];
    for (var r = 0; r < this.rows; r++) {
      var line = '';
      for (var c = 0; c < this.cols; c++) {
        var g = this.at(c, r);
        if (!g) line += '. ';
        else if (g.kind === 'blocker') line += '# ';
        else if (g.kind === 'rainbow') line += '* ';
        else line += glyphs[g.type] + (g.special ? '!' : ' ');
      }
      out.push(line);
    }
    return out.join('\n');
  };

  /* ====================================================================== */

  var api = { Board: Board, SPECIAL: SPECIAL };

  root.M3 = root.M3 || {};
  root.M3.Board = Board;
  root.M3.SPECIAL = SPECIAL;

  if (typeof module !== 'undefined' && module.exports) module.exports = api;

})(typeof globalThis !== 'undefined' ? globalThis : this);
