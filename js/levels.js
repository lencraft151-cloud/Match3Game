/* ==========================================================================
   Levels — Aufgaben, Zuege, Farbanzahl und Felsen pro Stufe.

   Die Zahlen sind an gemessener Ausbeute ausgerichtet, nicht geschaetzt.
   Ein Bot, der immer den erstbesten Zug nimmt, raeumt in 25 Zuegen:

       5 Farben   ~23 Steine je Farbe
       6 Farben   ~17 Steine je Farbe
       7 Farben   ~13 Steine je Farbe

   Bei Felsen entscheidet nicht die Zugzahl, sondern wie viele ueberhaupt auf
   dem Feld liegen. Gemessen: bei 6 gesetzten Felsen schafft der Bot in 26
   Zuegen nur in 48 % der Faelle vier Stueck, bei 8 Felsen in 85 %, bei 10 in
   98 %. Einzelne Felsen werden schlicht nie von einem Treffer erwischt.
   Darum liegen immer deutlich mehr Felsen auf dem Feld, als die Aufgabe
   verlangt — rund 60 bis 65 Prozent davon sind das Ziel.

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

     Die Zahlen stammen aus `node test/balance.js`: ein Bot spielt jedes Level
     80-mal und die Erfolgsquote wird abgelesen. Der Bot plant nichts, ein
     Mensch liegt darueber.

     Bewusst kleine Zahlen: wenige Zuege, kleine Ziele. Dadurch zaehlt jeder
     einzelne Zug sichtbar — kostet aber Berechenbarkeit, weil bei acht
     Zuegen ein einziger Gluecksfall stark durchschlaegt. Die Zugzahlen sind
     deshalb einzeln gemessen und nicht proportional herunterskaliert. */
  /* Uebungslevel ohne Zuglimit. Es steht vor Level 1, ist immer spielbar und
     laesst sich nicht verlieren — hier wird nur erklaert. */
  var TUTORIAL = {
    colors: 5,
    blockers: 0,
    moves: 0,
    unlimited: true,
    goals: [C(0, 5)]
  };

  var HANDMADE = [
    /* 1-3 — Aufwaermen: fuenf Farben, nur Sammelaufgaben. Bewusst kleine
       Zahlen und knappe Zuege: so zaehlt jeder einzelne sichtbar. */
    { colors: 5, blockers: 0, moves: 8, goals: [C(0, 6)] },
    { colors: 5, blockers: 0, moves: 10, goals: [C(3, 8)] },
    { colors: 5, blockers: 0, moves: 12, goals: [C(0, 7), C(2, 7)] },

    /* 4-5 — die sechste Farbe und die ersten Felsen. */
    { colors: 6, blockers: 9, moves: 10, goals: [B(4)] },
    { colors: 6, blockers: 7, moves: 15, goals: [C(1, 8), B(3)] },

    /* 6 — erste reine Punkteaufgabe. */
    { colors: 6, blockers: 0, moves: 12, goals: [S(4500)] },

    { colors: 6, blockers: 11, moves: 16, goals: [B(6)] },
    { colors: 6, blockers: 7, moves: 15, goals: [C(4, 8), B(3)] },

    /* 9 — die siebte Farbe. Treffer werden spuerbar seltener, deshalb
       steigen ab hier die Zugzahlen wieder etwas. */
    { colors: 7, blockers: 0, moves: 20, goals: [C(2, 7), C(5, 7)] },
    { colors: 7, blockers: 13, moves: 17, goals: [B(7)] },

    { colors: 7, blockers: 0, moves: 14, goals: [S(5500)] },
    { colors: 7, blockers: 9, moves: 18, goals: [C(0, 7), B(4)] },
    { colors: 7, blockers: 0, moves: 21, goals: [C(1, 7), C(3, 7)] },
    { colors: 7, blockers: 16, moves: 20, goals: [B(9)] },
    { colors: 7, blockers: 7, moves: 18, goals: [C(6, 8), B(3)] },

    { colors: 7, blockers: 0, moves: 15, goals: [S(6000)] },
    { colors: 7, blockers: 12, moves: 16, goals: [C(2, 7), B(5)] },
    { colors: 7, blockers: 0, moves: 22, goals: [C(0, 8), C(4, 8)] },
    { colors: 7, blockers: 18, moves: 20, goals: [B(10)] },
    { colors: 7, blockers: 12, moves: 17, goals: [C(5, 8), B(5)] }
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
      moves = 17;
      goals = [C(beyond % colors, Math.min(9, 7 + Math.floor(grow / 3)))];

    } else if (pattern === 1) {
      /* Felsen raeumen. Entscheidend ist nicht die Zugzahl, sondern wie viele
         Felsen ueberhaupt auf dem Feld liegen: gemessen erwischt der Bot bei
         9 Felsen im Schnitt 5,5, bei 6 nur 3,5. Das Ziel liegt deshalb bei
         rund 60 % der gesetzten Felsen, die Zuege bleiben knapp. */
      blockers = Math.min(18, 12 + grow);
      moves = 17 + Math.floor(grow / 2);
      goals = [B(Math.round(blockers * 0.55))];

    } else if (pattern === 2) {
      /* Zwei Farben gleichzeitig — die teuerste Aufgabe. */
      blockers = 0;
      moves = 21;
      goals = [
        C(beyond % colors, Math.min(9, 7 + Math.floor(grow / 3))),
        C((beyond + 3) % colors, Math.min(9, 7 + Math.floor(grow / 3)))
      ];

    } else {
      /* Punkte plus Felsen. */
      blockers = Math.min(14, 8 + grow);
      moves = 18;
      goals = [
        S(Math.min(8000, 6500 + step * 300)),
        B(Math.round(Math.min(14, 8 + grow) * 0.55))
      ];
    }

    return { colors: colors, blockers: blockers, moves: moves, goals: goals };
  }

  /* Levelnummer des Uebungslevels. */
  Levels.TUTORIAL = 0;

  Levels.isTutorial = function (level) {
    return Math.floor(level) === Levels.TUTORIAL;
  };

  /* Liefert die Definition fuer eine Stufe. 0 ist das Uebungslevel, ab 1
     geht es regulaer los. Die Aufgaben werden bei jedem Aufruf frisch
     erzeugt, damit ein Level sie nicht versehentlich mit einem anderen
     teilt. */
  Levels.get = function (level) {
    var n = Math.floor(level);
    if (!(n >= 0)) n = 1;

    var base = n === Levels.TUTORIAL ? TUTORIAL
             : n <= HANDMADE.length ? HANDMADE[n - 1]
             : generated(n);

    return {
      level: n,
      moves: base.moves,
      unlimited: !!base.unlimited,
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
