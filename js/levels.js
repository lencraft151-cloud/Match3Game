/* ==========================================================================
   Levels — Ziel, Zeit, Farbanzahl und Felsen pro Stufe.

   Die ersten acht Stufen sind von Hand gesetzt: sie fuehren nacheinander
   Farben und Felsen ein und ziehen das Tempo langsam an. Ab Level 9 laeuft
   es formelbasiert weiter, damit das Spiel nie endet.
   ========================================================================== */

(function (root) {
  'use strict';

  /* Gemessen in der laufenden Engine (60 Zuege je Stufe, immer der erste
     gefundene Zug): mit fuenf Farben bringt ein Zug rund 590 Punkte, mit
     sechs nur noch 377 und mit sieben 287 — jede zusaetzliche Farbe macht
     Treffer also deutlich seltener.

     Damit steigende Ziele trotzdem erreichbar bleiben, ist ein Stein bei mehr
     Farben entsprechend mehr wert. Das gleicht die Ausbeute auf ungefaehr
     500 Punkte pro Zug an und ist auch spielerisch fair: was schwerer zu
     finden ist, zaehlt mehr. */
  var HANDMADE = [
    /* Level 1-2 — Aufwaermen: fuenf Farben, viel Zeit. */
    { target: 10000, time: 85, colors: 5, blockers: 0 },
    { target: 12000, time: 85, colors: 5, blockers: 0 },
    /* Ab hier die sechste Farbe. */
    { target: 11000, time: 85, colors: 6, blockers: 0 },
    /* Erste Felsen. */
    { target: 11500, time: 80, colors: 6, blockers: 3 },
    { target: 12000, time: 80, colors: 6, blockers: 5 },
    /* Siebte Farbe. */
    { target: 12000, time: 75, colors: 7, blockers: 5 },
    { target: 12500, time: 75, colors: 7, blockers: 7 },
    { target: 13000, time: 70, colors: 7, blockers: 9 }
  ];

  /* Punkte pro Stein, abhaengig von der Farbanzahl: 5 -> 60, 6 -> 79, 7 -> 99. */
  function pointsPerGem(colors) {
    return Math.round(60 * Math.pow(colors / 5, 1.5));
  }

  var Levels = {};

  Levels.HANDMADE_COUNT = HANDMADE.length;

  /* Liefert die Definition fuer eine Stufe (1-basiert). */
  Levels.get = function (level) {
    var n = Math.max(1, Math.floor(level) || 1);

    if (n <= HANDMADE.length) {
      var base = HANDMADE[n - 1];
      return {
        level: n,
        target: base.target,
        time: base.time,
        colors: base.colors,
        blockers: base.blockers,
        pointsPerGem: pointsPerGem(base.colors)
      };
    }

    /* Ab Level 9: Ziel waechst um 10 % pro Stufe, die Zeit sinkt langsam bis
       auf 50 Sekunden, Felsen bis maximal 14. Irgendwann holt einen die Kurve
       ein — das ist Absicht: das Spiel ist eine Highscore-Jagd, kein
       Endgegner, und jeder Lauf soll ein Ende finden. */
    var beyond = n - HANDMADE.length;
    var last = HANDMADE[HANDMADE.length - 1];

    var target = Math.round(last.target * Math.pow(1.1, beyond) / 100) * 100;
    var time = Math.max(50, last.time - beyond);
    var blockers = Math.min(14, last.blockers + Math.floor(beyond / 2));

    return {
      level: n,
      target: target,
      time: time,
      colors: 7,
      blockers: blockers,
      pointsPerGem: pointsPerGem(7)
    };
  };

  /* Punkte pro uebriger Sekunde beim Levelabschluss. */
  Levels.TIME_BONUS_PER_SECOND = 30;

  /* Anteil der Restzeit, der in die naechste Stufe mitgenommen wird —
     gedeckelt, damit sich kein Zeitpolster ueber viele Level aufbaut. */
  Levels.CARRY_FACTOR = 0.35;
  Levels.CARRY_MAX = 12;

  Levels.carryOver = function (secondsLeft) {
    return Math.min(Levels.CARRY_MAX, Math.max(0, secondsLeft) * Levels.CARRY_FACTOR);
  };

  root.M3 = root.M3 || {};
  root.M3.Levels = Levels;

  if (typeof module !== 'undefined' && module.exports) module.exports = Levels;

})(typeof globalThis !== 'undefined' ? globalThis : this);
