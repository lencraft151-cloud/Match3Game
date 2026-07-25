/* ==========================================================================
   Levels — Aufgaben, Zuege, Farbanzahl und Felsen pro Stufe.

   Die Zahlen sind an gemessener Ausbeute ausgerichtet, nicht geschaetzt.
   Ein Bot, der immer den erstbesten Zug nimmt, raeumt in 25 Zuegen:

       5 Farben   ~23 Steine je Farbe
       6 Farben   ~17 Steine je Farbe
       7 Farben   ~13 Steine je Farbe

   Felsen sind der Engpass: sie zerbrechen nur durch Treffer nebenan, in
   25 Zuegen erwischt der Bot rund 60 % der gesetzten Felsen. Deshalb liegen
   auf dem Feld immer deutlich mehr Felsen, als die Aufgabe verlangt.

   Die ersten 20 Stufen sind von Hand gesetzt, danach laeuft es formelbasiert
   weiter. `test/levels.test.js` prueft jede Stufe auf Loesbarkeit.
   ========================================================================== */

(function (root) {
  'use strict';

  var Goals = (typeof module !== 'undefined' && module.exports)
    ? require('./goals.js')
    : root.M3.Goals;

  var C = Goals.collect;
  var B = Goals.blockers;
  var S = Goals.score;

  /* colors, blockers, moves, goals

     Die Zugzahlen stammen aus `node test/balance.js`: ein Bot spielt jedes
     Level 40-mal und die Erfolgsquote wird abgelesen. Zielkorridor ist 60 bis
     85 Prozent — der Bot plant nichts, ein Mensch liegt darueber. */
  var HANDMADE = [
    /* 1-3 — Aufwaermen: fuenf Farben, nur Sammelaufgaben. */
    { colors: 5, blockers: 0, moves: 20, goals: [C(0, 12)] },
    { colors: 5, blockers: 0, moves: 20, goals: [C(3, 15)] },
    { colors: 5, blockers: 0, moves: 22, goals: [C(0, 13), C(2, 13)] },

    /* 4-5 — die sechste Farbe und die ersten Felsen. */
    { colors: 6, blockers: 6, moves: 22, goals: [B(4)] },
    { colors: 6, blockers: 5, moves: 26, goals: [C(1, 14), B(3)] },

    /* 6 — erste reine Punkteaufgabe. */
    { colors: 6, blockers: 0, moves: 22, goals: [S(8500)] },

    { colors: 6, blockers: 8, moves: 24, goals: [B(5)] },
    { colors: 6, blockers: 5, moves: 28, goals: [C(4, 14), B(3)] },

    /* 9 — die siebte Farbe. Treffer werden spuerbar seltener, deshalb
       steigen ab hier die Zugzahlen deutlich. */
    { colors: 7, blockers: 0, moves: 30, goals: [C(2, 13), C(5, 13)] },
    { colors: 7, blockers: 10, moves: 26, goals: [B(6)] },

    { colors: 7, blockers: 0, moves: 26, goals: [S(10000)] },
    { colors: 7, blockers: 7, moves: 28, goals: [C(0, 12), B(4)] },
    { colors: 7, blockers: 0, moves: 30, goals: [C(1, 12), C(3, 12)] },
    { colors: 7, blockers: 12, moves: 28, goals: [B(8)] },
    { colors: 7, blockers: 5, moves: 28, goals: [C(6, 13), B(3)] },

    { colors: 7, blockers: 0, moves: 27, goals: [S(10500)] },
    { colors: 7, blockers: 9, moves: 28, goals: [C(2, 13), B(5)] },
    { colors: 7, blockers: 0, moves: 30, goals: [C(0, 12), C(4, 12)] },
    { colors: 7, blockers: 13, moves: 30, goals: [B(9)] },
    { colors: 7, blockers: 9, moves: 30, goals: [C(5, 13), B(5)] }
  ];

  var Levels = {};

  Levels.HANDMADE_COUNT = HANDMADE.length;

  /* Punkte pro Stein, abhaengig von der Farbanzahl: 5 -> 60, 6 -> 79, 7 -> 99.
     Mehr Farben heisst seltenere Treffer, also mehr Punkte pro Stein — sonst
     waeren Punkteaufgaben in spaeten Leveln unerreichbar. */
  function pointsPerGem(colors) {
    return Math.round(60 * Math.pow(colors / 5, 1.5));
  }

  Levels.pointsPerGem = pointsPerGem;

  /* Ab Stufe 21 wiederholen sich vier Aufgaben-Muster, die Zahlen wachsen
     langsam mit. Alles bleibt innerhalb der Grenzen, die Goals.validate
     prueft: Sammelfarben existieren immer, Felsaufgaben liegen immer unter
     der Zahl der gesetzten Felsen. */
  function generated(n) {
    var beyond = n - HANDMADE.length;
    var step = Math.floor(beyond / 4);
    var pattern = beyond % 4;

    /* Waechst langsam und wird bei einem Wert gedeckelt, den ein guter
       Spieler noch schafft — das Spiel soll fordernd bleiben, nicht
       unmoeglich werden. */
    var grow = Math.min(step, 12);

    var colors = 7;
    var blockers;
    var moves;
    var goals;

    if (pattern === 0) {
      /* Eine Farbe sammeln. */
      blockers = 0;
      moves = 32;
      goals = [C(beyond % colors, Math.min(15, 12 + grow))];

    } else if (pattern === 1) {
      /* Felsen raeumen — geht schneller als Sammeln, deshalb weniger Zuege.
         Mit steigendem Ziel waechst die Zugzahl leicht mit, sonst kippen die
         spaeten Felslevel unter 60 % Erfolgsquote. */
      blockers = Math.min(16, 10 + grow);
      moves = 28 + Math.floor(grow / 3);
      goals = [B(Math.min(11, 7 + Math.floor(grow / 2)))];

    } else if (pattern === 2) {
      /* Zwei Farben gleichzeitig — die teuerste Aufgabe. */
      blockers = 0;
      moves = 34;
      goals = [
        C(beyond % colors, Math.min(15, 11 + grow)),
        C((beyond + 3) % colors, Math.min(15, 11 + grow))
      ];

    } else {
      /* Punkte plus Felsen. */
      blockers = Math.min(14, 8 + grow);
      moves = 34;
      goals = [
        S(Math.min(15000, 11000 + step * 900)),
        B(Math.min(9, 5 + Math.floor(grow / 2)))
      ];
    }

    return { colors: colors, blockers: blockers, moves: moves, goals: goals };
  }

  /* Liefert die Definition fuer eine Stufe (1-basiert). Die Aufgaben werden
     bei jedem Aufruf frisch erzeugt, damit ein Level sie nicht versehentlich
     mit einem anderen teilt. */
  Levels.get = function (level) {
    var n = Math.max(1, Math.floor(level) || 1);
    var base = n <= HANDMADE.length ? HANDMADE[n - 1] : generated(n);

    return {
      level: n,
      moves: base.moves,
      colors: base.colors,
      blockers: base.blockers,
      goals: base.goals.map(function (g) {
        return { type: g.type, color: g.color, count: g.count };
      }),
      pointsPerGem: pointsPerGem(base.colors)
    };
  };

  /* ------------------------------------------------------------- Sterne */

  /* Drei Sterne fuer viel Restluft, zwei fuer etwas, sonst einer. Ein
     geschafftes Level gibt nie null Sterne. */
  Levels.STAR_3_RATIO = 0.4;
  Levels.STAR_2_RATIO = 0.15;

  Levels.starsFor = function (movesLeft, totalMoves) {
    if (!(totalMoves > 0)) return 1;
    var ratio = Math.max(0, movesLeft) / totalMoves;
    if (ratio >= Levels.STAR_3_RATIO) return 3;
    if (ratio >= Levels.STAR_2_RATIO) return 2;
    return 1;
  };

  root.M3 = root.M3 || {};
  root.M3.Levels = Levels;

  if (typeof module !== 'undefined' && module.exports) module.exports = Levels;

})(typeof globalThis !== 'undefined' ? globalThis : this);
