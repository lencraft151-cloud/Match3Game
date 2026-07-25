/* ==========================================================================
   Tutorial — die Erklaerschritte im Uebungslevel.

   Eine schlichte Schrittkette. Jeder Schritt zeigt einen Text in der
   Sprechblase unter dem Brett und wartet entweder auf ein Antippen
   ("weiter") oder darauf, dass der Spieler etwas Bestimmtes tut.

   Das Uebungslevel hat kein Zuglimit und laesst sich nicht verlieren — hier
   soll niemand unter Druck geraten.
   ========================================================================== */

(function (root) {
  'use strict';

  var doc = root.document;

  var Tutorial = {};

  /* `wait` beschreibt, wodurch ein Schritt endet:
       'tap'    Antippen des Weiter-Knopfes
       'swap'   der erste erfolgreiche Tausch
       'goal'   die Aufgabe ist erfuellt */
  var STEPS = [
    {
      wait: 'tap',
      text: 'Willkommen! Hier lernst du das Spiel in Ruhe kennen — ' +
            'in diesem Level gibt es kein Zuglimit und du kannst nicht verlieren.'
    },
    {
      wait: 'swap',
      text: 'Ziehe einen Stein auf ein Nachbarfeld, sodass <b>drei gleiche</b> ' +
            'in einer Reihe liegen. Tippen und dann den Nachbarn antippen geht auch.'
    },
    {
      wait: 'tap',
      text: 'Genau so. Passt ein Zug nicht, federt er zurück — ' +
            'und kostet in echten Leveln <b>keinen Zug</b>.'
    },
    {
      wait: 'tap',
      text: 'Wenn nachrutschende Steine erneut treffen, ist das eine ' +
            '<b>Kaskade</b>. Der Multiplikator steigt mit jeder Stufe — ' +
            'dort stecken die dicken Punkte.'
    },
    {
      wait: 'tap',
      text: 'Oben links stehen deine <b>Züge</b>, daneben die <b>Aufgabe</b> ' +
            'mit der Restzahl. Hier sollst du 🔴 Rubine sammeln.'
    },
    {
      wait: 'tap',
      text: 'Vier gleiche in einer Reihe geben einen <b>Blitz</b>, eine L-Form ' +
            'eine <b>Bombe</b>, fünf in einer Reihe ein <b>Prisma</b>. ' +
            'Die räumen richtig auf.'
    },
    {
      wait: 'tap',
      text: 'Unter dem Brett liegen deine <b>Power-Ups</b>. Sie kosten selbst ' +
            'keinen Zug. Probier sie ruhig aus — hier ist alles gratis.'
    },
    {
      wait: 'goal',
      text: 'Jetzt du: sammle die restlichen Rubine, dann geht es auf die Karte.'
    }
  ];

  var state = null;
  var els = null;

  Tutorial.init = function () {
    els = {
      bubble: doc.getElementById('tutorial'),
      text: doc.getElementById('tutorial-text'),
      next: doc.getElementById('tutorial-next')
    };

    els.next.addEventListener('click', function () {
      if (state && STEPS[state.index] && STEPS[state.index].wait === 'tap') advance();
    });
  };

  Tutorial.isActive = function () {
    return state !== null;
  };

  Tutorial.start = function () {
    state = { index: -1 };
    advance();
  };

  Tutorial.stop = function () {
    state = null;
    if (els) els.bubble.hidden = true;
  };

  function advance() {
    if (!state) return;

    state.index++;

    if (state.index >= STEPS.length) {
      /* Der letzte Schritt wartet auf die Aufgabe — danach uebernimmt das
         normale Gewonnen-Popup. */
      els.bubble.hidden = true;
      return;
    }

    var step = STEPS[state.index];
    show(step);
  }

  function show(step) {
    els.bubble.hidden = false;
    /* Die Texte stehen fest in dieser Datei und enthalten nur <b> — deshalb
       ist innerHTML hier unbedenklich. Nutzereingaben landen hier nie. */
    els.text.innerHTML = step.text;
    els.next.hidden = step.wait !== 'tap';
  }

  /* Wird von main.js gemeldet, wenn im Spiel etwas passiert. */
  Tutorial.notify = function (event) {
    if (!state) return;

    var step = STEPS[state.index];
    if (!step) return;

    if (step.wait === event) advance();
  };

  root.M3 = root.M3 || {};
  root.M3.Tutorial = Tutorial;

})(typeof globalThis !== 'undefined' ? globalThis : this);
