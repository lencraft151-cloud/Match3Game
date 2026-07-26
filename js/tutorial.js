/* ==========================================================================
   Tutorial — die Erklaerschritte im Uebungslevel.

   Eine Schrittkette mit zwei Aufgaben:

     1. Sie bestimmt, wann das Uebungslevel fertig ist. Nicht die gesammelten
        Rubine beenden es, sondern der letzte Schritt der Kette. Wer die
        Aufgabe frueh erfuellt, spielt trotzdem den Text zu Ende.

     2. Sie bestimmt, was gerade ueberhaupt geht. Jeder Schritt setzt eine
        Fuehrung (`guide`), und game.js weist alles ab, was nicht dazu passt.
        Was der Text verlangt, ist damit auch das Einzige, was klickt.

   Das Uebungslevel hat kein Zuglimit, laesst sich nicht verlieren und die
   Power-Ups sind darin unbegrenzt — hier soll niemand unter Druck geraten.

   Die Kette selbst haengt an keinem DOM: ohne `init()` laeuft sie in Node,
   und `test/tutorial.test.js` prueft genau die beiden Punkte oben.
   ========================================================================== */

(function (root) {
  'use strict';

  var doc = root.document;

  var Tutorial = {};

  /* `wait` beschreibt, wodurch ein Schritt endet:
       'tap'    Antippen des Weiter-Knopfes
       'swap'   der vorgegebene Tausch ist ausgefuehrt
       'power'  das verlangte Power-Up ist eingesetzt
       'goal'   die Aufgabe ist erfuellt

     `guide` beschreibt, was waehrenddessen erlaubt ist:
       'read'   nichts auf dem Brett, nur weiterlesen
       'swap'   nur der eine markierte Tausch
       'power'  kein Tausch, dafuer das genannte Power-Up (`item`)
       null     freies Spiel */
  var STEPS = [
    {
      wait: 'tap',
      guide: 'read',
      text: 'Willkommen! Hier lernst du das Spiel in Ruhe kennen — ' +
            'in diesem Level gibt es kein Zuglimit und du kannst nicht verlieren.'
    },
    {
      wait: 'swap',
      guide: 'swap',
      text: 'Ziehe die beiden <b>markierten</b> Steine zusammen. Dann liegen ' +
            '<b>drei gleiche</b> in einer Reihe — und die lösen sich auf.'
    },
    {
      wait: 'tap',
      guide: 'read',
      text: 'Genau so. Passt ein Zug nicht, federt er zurück — ' +
            'und kostet in echten Leveln <b>keinen Zug</b>.'
    },
    {
      wait: 'tap',
      guide: 'read',
      text: 'Wenn nachrutschende Steine erneut treffen, ist das eine ' +
            '<b>Kaskade</b>. Der Multiplikator steigt mit jeder Stufe — ' +
            'dort stecken die dicken Punkte.'
    },
    {
      wait: 'tap',
      guide: 'read',
      text: 'Oben links stehen deine <b>Züge</b>, daneben die <b>Aufgabe</b> ' +
            'mit der Restzahl. Hier sollst du 🔴 Rubine sammeln.'
    },
    {
      wait: 'tap',
      guide: 'read',
      text: 'Vier gleiche in einer Reihe geben einen <b>Blitz</b>, eine L-Form ' +
            'eine <b>Bombe</b>, fünf in einer Reihe ein <b>Prisma</b>. ' +
            'Die räumen richtig auf.'
    },
    {
      wait: 'power',
      guide: 'power',
      item: 'bomb',
      text: 'Unter dem Brett liegen deine <b>Booster</b>. Tippe die ' +
            '<b>Bombe</b> an und dann einen Stein: das ganze Feld drumherum ' +
            'fliegt mit. Booster kosten keinen Zug — und hier sind sie ' +
            '<b>unbegrenzt</b>.'
    },
    {
      wait: 'goal',
      guide: null,
      text: 'Jetzt du, ganz frei: sammle die restlichen <b>🔴 Rubine</b>, ' +
            'bis die Aufgabe oben abgehakt ist.'
    },
    {
      wait: 'tap',
      guide: 'read',
      text: 'Geschafft — du kannst alles, was du brauchst. Ab auf die Karte!'
    }
  ];

  Tutorial.STEPS = STEPS;

  /* `api` verbindet die Kette mit dem Spiel:
       setGuide(mode, item)  Fuehrung setzen
       goalDone()            ist die Aufgabe schon erfuellt?
       finish()              Kette durch — Level darf enden
       render(step, index)   Text anzeigen (im Node-Test nicht gesetzt) */
  var state = null;
  var els = null;

  Tutorial.init = function () {
    els = {
      bubble: doc.getElementById('tutorial'),
      text: doc.getElementById('tutorial-text'),
      step: doc.getElementById('tutorial-step'),
      next: doc.getElementById('tutorial-next')
    };

    els.next.addEventListener('click', function () {
      if (state && STEPS[state.index] && STEPS[state.index].wait === 'tap') advance();
    });
  };

  Tutorial.isActive = function () {
    return state !== null;
  };

  /* Welcher Schritt laeuft gerade? -1 heisst: die Kette laeuft nicht. */
  Tutorial.index = function () {
    return state ? state.index : -1;
  };

  Tutorial.start = function (api) {
    state = { index: -1, api: api || {}, finished: false };
    advance();
  };

  Tutorial.stop = function () {
    state = null;
    if (els) {
      els.bubble.hidden = true;
      els.bubble.classList.remove('is-nudged');
    }
  };

  /* Darf der Spieler gerade Power-Ups benutzen? main.js fragt das, bevor es
     ueberhaupt den Vorrat anfasst. */
  Tutorial.allows = function (what) {
    if (!state) return true;

    var step = STEPS[state.index];
    if (!step) return true;

    if (what === 'power') return step.guide === 'power' || step.guide === null;
    return step.guide !== 'read';
  };

  /* Etwas wurde abgewiesen — die Blase pulst kurz, damit klar ist, wo die
     Antwort steht. */
  Tutorial.nudge = function () {
    if (!state || !els) return;
    els.bubble.classList.remove('is-nudged');
    /* Reflow erzwingen, sonst startet dieselbe Animation nicht neu. */
    void els.bubble.offsetWidth;
    els.bubble.classList.add('is-nudged');
  };

  /* Wird von main.js gemeldet, wenn im Spiel etwas passiert. */
  Tutorial.notify = function (event) {
    if (!state) return;

    var step = STEPS[state.index];
    if (!step) return;

    if (step.wait === event) advance();
  };

  function advance() {
    if (!state) return;

    state.index++;

    /* Ueber den letzten Schritt hinaus: erst jetzt ist das Uebungslevel
       durch. Das ist der Riegel — vorher gewinnt hier niemand. */
    if (state.index >= STEPS.length) {
      if (els) els.bubble.hidden = true;
      if (!state.finished) {
        state.finished = true;
        if (state.api.finish) state.api.finish();
      }
      return;
    }

    var step = STEPS[state.index];

    if (state.api.setGuide) state.api.setGuide(step.guide || null, step.item || null);

    /* Wer die Aufgabe schon nebenbei erfuellt hat, soll nicht vor einem
       bereits erledigten Auftrag stehen. */
    if (step.wait === 'goal' && state.api.goalDone && state.api.goalDone()) {
      advance();
      return;
    }

    show(step, state.index);
  }

  function show(step, index) {
    if (!els) return;

    els.bubble.hidden = false;
    els.bubble.classList.remove('is-nudged');
    /* Die Texte stehen fest in dieser Datei und enthalten nur <b> — deshalb
       ist innerHTML hier unbedenklich. Nutzereingaben landen hier nie. */
    els.text.innerHTML = step.text;
    els.step.textContent = 'Schritt ' + (index + 1) + ' von ' + STEPS.length;
    els.next.hidden = step.wait !== 'tap';
  }

  root.M3 = root.M3 || {};
  root.M3.Tutorial = Tutorial;

  if (typeof module !== 'undefined' && module.exports) module.exports = Tutorial;

})(typeof globalThis !== 'undefined' ? globalThis : this);
