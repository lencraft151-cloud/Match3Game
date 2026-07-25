/* ==========================================================================
   Goals — Level-Aufgaben: Definition, Beschriftung und Fortschritt.

   Eine Aufgabe ist ein schlichtes Objekt:

       { type: 'collect',  color: 2, count: 12 }   12 gruene Steine sammeln
       { type: 'blockers', count: 8 }              8 Felsen zerschlagen
       { type: 'score',    count: 8000 }           8000 Punkte im Level

   Den Fortschritt fuehrt game.js beim Raeumen mit und reicht ihn als
   Zaehlerobjekt herein:

       { colors: [0, 0, 5, ...], blockers: 3, score: 4200 }

   Kein DOM, kein Canvas — laeuft damit auch in Node und ist testbar.
   ========================================================================== */

(function (root) {
  'use strict';

  var Goals = {};

  /* Farbnamen und Symbole passend zu den Steinformen aus js/game.js.
     Reihenfolge und Bedeutung muessen zu COLORS/SHAPES dort passen. */
  var COLOR_NAMES = [
    'Rubin', 'Bernstein', 'Smaragd', 'Türkis', 'Amethyst', 'Feuer', 'Saphir'
  ];

  var COLOR_ICONS = ['🔴', '🔶', '🟢', '🔷', '⭐', '🟧', '🔵'];

  Goals.COLOR_NAMES = COLOR_NAMES;
  Goals.COLOR_ICONS = COLOR_ICONS;

  /* ------------------------------------------------------------ Erzeugen */

  Goals.collect = function (color, count) {
    return { type: 'collect', color: color, count: count };
  };

  Goals.blockers = function (count) {
    return { type: 'blockers', count: count };
  };

  Goals.score = function (count) {
    return { type: 'score', count: count };
  };

  /* ------------------------------------------------------------ Anzeige */

  Goals.icon = function (goal) {
    if (goal.type === 'collect') return COLOR_ICONS[goal.color % COLOR_ICONS.length];
    if (goal.type === 'blockers') return '🪨';
    return '⭐';
  };

  Goals.label = function (goal) {
    if (goal.type === 'collect') {
      return COLOR_NAMES[goal.color % COLOR_NAMES.length] + ' sammeln';
    }
    if (goal.type === 'blockers') return 'Felsen zerschlagen';
    return 'Punkte sammeln';
  };

  /* ----------------------------------------------------------- Fortschritt */

  /* Frischer Zaehler fuer ein Level. */
  Goals.newProgress = function (colorCount) {
    var colors = [];
    for (var i = 0; i < (colorCount || 7); i++) colors.push(0);
    return { colors: colors, blockers: 0, score: 0 };
  };

  /* Wie weit ist diese eine Aufgabe? Immer gedeckelt, damit die Anzeige nie
     "14 / 12" zeigt. */
  Goals.currentOf = function (goal, progress) {
    var raw = 0;

    if (goal.type === 'collect') {
      raw = (progress.colors && progress.colors[goal.color]) || 0;
    } else if (goal.type === 'blockers') {
      raw = progress.blockers || 0;
    } else if (goal.type === 'score') {
      raw = progress.score || 0;
    }

    return Math.min(raw, goal.count);
  };

  Goals.remainingOf = function (goal, progress) {
    return Math.max(0, goal.count - Goals.currentOf(goal, progress));
  };

  Goals.isDone = function (goal, progress) {
    return Goals.currentOf(goal, progress) >= goal.count;
  };

  /* Alle Aufgaben erfuellt? Ein Level ohne Aufgaben gilt nie als geschafft —
     das waere ein Fehler in der Leveldefinition und soll auffallen. */
  Goals.allDone = function (goals, progress) {
    if (!goals || !goals.length) return false;
    for (var i = 0; i < goals.length; i++) {
      if (!Goals.isDone(goals[i], progress)) return false;
    }
    return true;
  };

  /* Anteil 0..1 ueber alle Aufgaben — fuer einen Gesamtbalken. */
  Goals.overall = function (goals, progress) {
    if (!goals || !goals.length) return 0;

    var sum = 0;
    for (var i = 0; i < goals.length; i++) {
      sum += Goals.currentOf(goals[i], progress) / goals[i].count;
    }
    return sum / goals.length;
  };

  /* --------------------------------------------------------- Pruefungen */

  /* Meldet, warum eine Aufgabe in diesem Level unmoeglich waere. Wird von
     test/levels.test.js benutzt: eine collect-Aufgabe auf eine Farbe, die es
     im Level gar nicht gibt, waere ein unloesbares Level. */
  Goals.validate = function (goal, levelDef) {
    if (!goal || typeof goal !== 'object') return 'Aufgabe ist kein Objekt';
    if (!(goal.count > 0)) return 'count muss groesser als 0 sein';

    if (goal.type === 'collect') {
      if (!(goal.color >= 0)) return 'collect braucht eine Farbe';
      if (goal.color >= levelDef.colors) {
        return 'Farbe ' + goal.color + ' kommt im Level nicht vor (nur ' +
          levelDef.colors + ' Farben)';
      }
      return null;
    }

    if (goal.type === 'blockers') {
      if (goal.count > levelDef.blockers) {
        return 'verlangt ' + goal.count + ' Felsen, das Level hat nur ' +
          levelDef.blockers;
      }
      return null;
    }

    if (goal.type === 'score') return null;

    return 'unbekannter Aufgabentyp: ' + goal.type;
  };

  root.M3 = root.M3 || {};
  root.M3.Goals = Goals;

  if (typeof module !== 'undefined' && module.exports) module.exports = Goals;

})(typeof globalThis !== 'undefined' ? globalThis : this);
