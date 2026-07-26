/* ==========================================================================
   Rooms — das Schloss einrichten.

   Das zweite Spiel neben dem Match-3: fuer jedes geschaffte Level gibt es
   Muenzen, und mit denen wird Raum fuer Raum eingerichtet. Ein Zimmer besteht
   aus mehreren Aufgaben ("Was soll an die Wand?"), jede Aufgabe hat zwei
   Varianten zur Auswahl. Erst wenn alle Aufgaben eines Zimmers erledigt sind,
   geht das naechste auf.

   Warum ein eigener Waehrungstopf: Kristalle gehen in Booster und Leben, also
   in das Weiterkommen. Wenn Einrichten aus demselben Topf bezahlt wuerde,
   waere jede huebsche Entscheidung ein Rueckschritt im Spiel. Zwei Toepfe
   heisst: beides geht nebeneinander.

   Diese Datei kennt weder DOM noch Canvas — sie beschreibt nur, was es gibt
   und was es kostet. Gezeichnet wird in js/roomart.js, angezeigt in js/ui.js.
   ========================================================================== */

(function (root) {
  'use strict';

  var Rooms = {};

  /* Ein Zimmer: Name, Untertitel und seine Aufgaben. Eine Aufgabe hat einen
     Schluessel, eine Frage und zwei Varianten mit je einem Preis.

     Die Preise steigen von Zimmer zu Zimmer leicht an. Ein Level bringt rund
     60 bis 150 Muenzen, ein Zimmer kostet zusammen 600 bis 900 — das sind
     etwa sechs bis zehn Level je Zimmer. */
  var ROOMS = [
    {
      key: 'hall',
      name: 'Eingangshalle',
      lead: 'Der erste Eindruck. Hier kommt jeder vorbei.',
      tasks: [
        {
          key: 'floor',
          question: 'Was kommt auf den Boden?',
          options: [
            { key: 'marble', name: 'Marmor', price: 120 },
            { key: 'wood', name: 'Parkett', price: 120 }
          ]
        },
        {
          key: 'wall',
          question: 'Wie sollen die Wände aussehen?',
          options: [
            { key: 'stone', name: 'Sandstein', price: 140 },
            { key: 'panel', name: 'Holzvertäfelung', price: 140 }
          ]
        },
        {
          key: 'light',
          question: 'Woher kommt das Licht?',
          options: [
            { key: 'chandelier', name: 'Kronleuchter', price: 180 },
            { key: 'lanterns', name: 'Wandlaternen', price: 180 }
          ]
        },
        {
          key: 'deco',
          question: 'Was fehlt noch?',
          options: [
            { key: 'armor', name: 'Ritterrüstung', price: 200 },
            { key: 'plant', name: 'Palme', price: 200 }
          ]
        }
      ]
    },
    {
      key: 'library',
      name: 'Bibliothek',
      lead: 'Ruhe, Bücher und ein Sessel am Fenster.',
      tasks: [
        {
          key: 'floor',
          question: 'Was kommt auf den Boden?',
          options: [
            { key: 'carpet', name: 'Teppich', price: 150 },
            { key: 'wood', name: 'Dielen', price: 150 }
          ]
        },
        {
          key: 'wall',
          question: 'Womit werden die Wände gefüllt?',
          options: [
            { key: 'shelves', name: 'Bücherregale', price: 190 },
            { key: 'paintings', name: 'Gemälde', price: 190 }
          ]
        },
        {
          key: 'light',
          question: 'Woher kommt das Licht?',
          options: [
            { key: 'window', name: 'Bogenfenster', price: 210 },
            { key: 'lamp', name: 'Stehlampe', price: 210 }
          ]
        },
        {
          key: 'seat',
          question: 'Worauf wird gelesen?',
          options: [
            { key: 'armchair', name: 'Ohrensessel', price: 230 },
            { key: 'desk', name: 'Schreibtisch', price: 230 }
          ]
        }
      ]
    },
    {
      key: 'garden',
      name: 'Rosengarten',
      lead: 'Draußen wird es Zeit für Farbe.',
      tasks: [
        {
          key: 'floor',
          question: 'Was kommt auf den Weg?',
          options: [
            { key: 'gravel', name: 'Kiesweg', price: 180 },
            { key: 'stones', name: 'Steinplatten', price: 180 }
          ]
        },
        {
          key: 'wall',
          question: 'Was steht im Hintergrund?',
          options: [
            { key: 'hedge', name: 'Hecke', price: 220 },
            { key: 'wall', name: 'Mauer mit Efeu', price: 220 }
          ]
        },
        {
          key: 'light',
          question: 'Was kommt in die Mitte?',
          options: [
            { key: 'fountain', name: 'Springbrunnen', price: 260 },
            { key: 'tree', name: 'Blütenbaum', price: 260 }
          ]
        },
        {
          key: 'deco',
          question: 'Und zum Sitzen?',
          options: [
            { key: 'bench', name: 'Gartenbank', price: 280 },
            { key: 'swing', name: 'Hollywoodschaukel', price: 280 }
          ]
        }
      ]
    }
  ];

  Rooms.ALL = ROOMS;
  Rooms.COUNT = ROOMS.length;

  /* --------------------------------------------------------------- Zugriff */

  Rooms.get = function (index) {
    return ROOMS[index] || null;
  };

  Rooms.byKey = function (key) {
    for (var i = 0; i < ROOMS.length; i++) {
      if (ROOMS[i].key === key) return ROOMS[i];
    }
    return null;
  };

  Rooms.taskOf = function (room, taskKey) {
    if (!room) return null;
    for (var i = 0; i < room.tasks.length; i++) {
      if (room.tasks[i].key === taskKey) return room.tasks[i];
    }
    return null;
  };

  /* ------------------------------------------------------------ Spielstand */

  /* Der Stand ist bewusst flach: pro Zimmer ein Objekt aus Aufgaben-Schluessel
     zu gewaehlter Variante. Was nicht drinsteht, ist noch offen. */
  Rooms.emptyState = function () {
    return { chosen: {} };
  };

  /* Faengt fremde und beschaedigte Werte ab. Ein manipulierter Eintrag darf
     hoechstens dazu fuehren, dass eine Auswahl fehlt — nie dazu, dass der
     Zimmer-Screen abstuerzt. */
  Rooms.sanitize = function (raw) {
    var out = Rooms.emptyState();
    if (!raw || typeof raw !== 'object' || !raw.chosen) return out;

    ROOMS.forEach(function (room) {
      var stored = raw.chosen[room.key];
      if (!stored || typeof stored !== 'object') return;

      var clean = {};
      room.tasks.forEach(function (task) {
        var pick = stored[task.key];
        var known = task.options.some(function (o) { return o.key === pick; });
        if (known) clean[task.key] = pick;
      });

      if (Object.keys(clean).length) out.chosen[room.key] = clean;
    });

    return out;
  };

  /* Was ist in diesem Zimmer gewaehlt? Immer ein Objekt, nie undefined. */
  Rooms.chosenIn = function (state, roomKey) {
    return (state && state.chosen && state.chosen[roomKey]) || {};
  };

  Rooms.pick = function (state, roomKey, taskKey, optionKey) {
    if (!state.chosen[roomKey]) state.chosen[roomKey] = {};
    state.chosen[roomKey][taskKey] = optionKey;
    return state;
  };

  /* Wie viele Aufgaben eines Zimmers sind erledigt? */
  Rooms.doneCount = function (state, room) {
    if (!room) return 0;
    var chosen = Rooms.chosenIn(state, room.key);
    var n = 0;
    room.tasks.forEach(function (task) {
      if (chosen[task.key]) n++;
    });
    return n;
  };

  Rooms.isComplete = function (state, room) {
    return !!room && Rooms.doneCount(state, room) === room.tasks.length;
  };

  /* Die naechste offene Aufgabe eines Zimmers — oder null, wenn es fertig
     ist. Der Zimmer-Screen springt beim Oeffnen genau dorthin. */
  Rooms.nextTask = function (state, room) {
    if (!room) return null;
    var chosen = Rooms.chosenIn(state, room.key);
    for (var i = 0; i < room.tasks.length; i++) {
      if (!chosen[room.tasks[i].key]) return room.tasks[i];
    }
    return null;
  };

  /* Das Zimmer, an dem gerade gearbeitet wird: das erste unfertige. Sind alle
     fertig, bleibt es beim letzten — dann gibt es nichts mehr zu tun, aber
     immer noch etwas anzuschauen. */
  Rooms.activeIndex = function (state) {
    for (var i = 0; i < ROOMS.length; i++) {
      if (!Rooms.isComplete(state, ROOMS[i])) return i;
    }
    return ROOMS.length - 1;
  };

  /* Ein Zimmer ist offen, sobald alle davor fertig sind. */
  Rooms.isUnlocked = function (state, index) {
    for (var i = 0; i < index; i++) {
      if (!Rooms.isComplete(state, ROOMS[i])) return false;
    }
    return index >= 0 && index < ROOMS.length;
  };

  /* Gesamtfortschritt ueber alle Zimmer, 0..1 — fuer den Balken im Kopf. */
  Rooms.overall = function (state) {
    var total = 0;
    var done = 0;
    ROOMS.forEach(function (room) {
      total += room.tasks.length;
      done += Rooms.doneCount(state, room);
    });
    return total ? done / total : 0;
  };

  root.M3 = root.M3 || {};
  root.M3.Rooms = Rooms;

  if (typeof module !== 'undefined' && module.exports) module.exports = Rooms;

})(typeof globalThis !== 'undefined' ? globalThis : this);
