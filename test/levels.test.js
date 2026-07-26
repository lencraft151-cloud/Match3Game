#!/usr/bin/env node
/* ==========================================================================
   Level- und Aufgaben-Tests.

       node test/levels.test.js

   Wichtigster Zweck: kein Level darf eine Aufgabe stellen, die es gar nicht
   erfuellen kann — etwa eine Farbe sammeln, die im Level nicht vorkommt, oder
   mehr Felsen zerschlagen, als ueberhaupt auf dem Feld liegen. Das waere eine
   Sackgasse, die im Spiel erst nach dem letzten Zug auffaellt.
   ========================================================================== */

'use strict';

const Goals = require('../js/goals.js');
const Levels = require('../js/levels.js');
const { Board } = require('../js/board.js');
const Utils = require('../js/utils.js');

let passed = 0;
let failed = 0;

function check(name, condition, detail) {
  if (condition) { passed++; return; }
  failed++;
  console.error(`  ✗ ${name}`);
  if (detail) console.error(`    ${detail}`);
}

function section(title) {
  console.log(`\n${title}`);
}

const UP_TO = 60;

/* ========================================================================= */
section(`Leveldefinitionen 1 bis ${UP_TO}`);
/* ========================================================================= */

{
  const problems = [];
  let goalCount = 0;

  for (let n = 1; n <= UP_TO; n++) {
    const def = Levels.get(n);

    if (!def.goals || !def.goals.length) {
      problems.push(`Level ${n} hat keine Aufgabe`);
      continue;
    }
    if (def.goals.length > 2) {
      problems.push(`Level ${n} hat ${def.goals.length} Aufgaben (max. 2)`);
    }
    /* Bewusst kleine Zahlen — aber unter 6 Zuegen ist kein Level mehr
       spielbar, und ueber 40 waere die Anzeige unuebersichtlich. */
    if (!(def.moves >= 6 && def.moves <= 40)) {
      problems.push(`Level ${n}: ${def.moves} Zuege liegen ausserhalb 6..40`);
    }
    if (!(def.colors >= 5 && def.colors <= 7)) {
      problems.push(`Level ${n}: ${def.colors} Farben`);
    }
    if (!(def.pointsPerGem > 0)) {
      problems.push(`Level ${n}: pointsPerGem fehlt`);
    }

    def.goals.forEach((goal) => {
      goalCount++;
      const err = Goals.validate(goal, def);
      if (err) problems.push(`Level ${n}, ${goal.type}: ${err}`);
    });
  }

  check(`${UP_TO} Level ohne unloesbare Aufgabe`, problems.length === 0,
    problems.slice(0, 8).join('\n    '));
  check('Es wurden ueberhaupt Aufgaben geprueft', goalCount >= UP_TO);
}

{
  /* Felsaufgaben brauchen Luft: der Bot erwischt in 25 Zuegen nur rund 60 %
     der gesetzten Felsen, ein Ziel in Hoehe der Gesamtzahl waere Gluecksspiel. */
  const tight = [];

  for (let n = 1; n <= UP_TO; n++) {
    const def = Levels.get(n);
    def.goals.forEach((goal) => {
      if (goal.type !== 'blockers') return;
      if (goal.count > def.blockers * 0.75) {
        tight.push(`Level ${n}: ${goal.count} von ${def.blockers} Felsen`);
      }
    });
  }

  check('Felsaufgaben verlangen hoechstens 75 % der gesetzten Felsen',
    tight.length === 0, tight.slice(0, 6).join('\n    '));
}

{
  /* Die Definition darf sich nicht zwischen zwei Abrufen unterscheiden, und
     zwei Abrufe duerfen sich kein Aufgabenobjekt teilen — sonst wuerde ein
     veraenderter Zaehler in ein anderes Level durchschlagen. */
  const a = Levels.get(5);
  const b = Levels.get(5);

  check('Zwei Abrufe liefern dieselben Werte',
    JSON.stringify(a) === JSON.stringify(b));
  check('Zwei Abrufe teilen sich kein Aufgabenobjekt',
    a.goals[0] !== b.goals[0]);

  a.goals[0].count = 999;
  check('Aenderung wirkt sich nicht auf den naechsten Abruf aus',
    Levels.get(5).goals[0].count !== 999);
}

/* ========================================================================= */
section('Uebungslevel');
/* ========================================================================= */

{
  const tut = Levels.get(Levels.TUTORIAL);

  check('Uebungslevel hat die Nummer 0', tut.level === 0, String(tut.level));
  check('Uebungslevel ist als unbegrenzt markiert', tut.unlimited === true);
  check('Uebungslevel hat eine Aufgabe', tut.goals.length === 1);
  check('Aufgabe ist klein genug zum Ueben', tut.goals[0].count <= 8,
    String(tut.goals[0].count));
  check('Aufgabe ist loesbar', Goals.validate(tut.goals[0], tut) === null,
    String(Goals.validate(tut.goals[0], tut)));
  check('Keine Felsen im Uebungslevel', tut.blockers === 0);
  check('Wenige Farben im Uebungslevel', tut.colors === 5);

  check('isTutorial erkennt die 0', Levels.isTutorial(0));
  check('isTutorial erkennt Level 1 nicht', !Levels.isTutorial(1));

  /* Kein regulaeres Level darf versehentlich unbegrenzt sein — sonst waere
     es nicht verlierbar. */
  let unlimitedRegular = 0;
  for (let n = 1; n <= UP_TO; n++) {
    if (Levels.get(n).unlimited) unlimitedRegular++;
  }
  check('Kein regulaeres Level ist unbegrenzt', unlimitedRegular === 0,
    String(unlimitedRegular));
}

/* ========================================================================= */
section('Felsen landen wirklich auf dem Feld');
/* ========================================================================= */

{
  /* Wenn placeBlockers weniger Felsen setzt als angefordert, waere jede
     Felsaufgabe potenziell unloesbar. Hier wird das gegengeprueft. */
  const short = [];

  for (let n = 1; n <= UP_TO; n++) {
    const def = Levels.get(n);
    if (!def.blockers) continue;

    let worst = Infinity;
    for (let s = 1; s <= 12; s++) {
      const board = new Board({
        cols: 8, rows: 8, colors: def.colors, rng: Utils.makeRng(n * 1000 + s)
      });
      board.generate(def.blockers);
      worst = Math.min(worst, board.cells.filter((g) => g && g.kind === 'blocker').length);
    }

    const needed = Math.max(...def.goals
      .filter((g) => g.type === 'blockers')
      .map((g) => g.count), 0);

    if (worst < needed) {
      short.push(`Level ${n}: nur ${worst} Felsen gesetzt, ${needed} verlangt`);
    }
  }

  check('Immer genug Felsen fuer die Aufgabe', short.length === 0,
    short.slice(0, 6).join('\n    '));
}

/* ========================================================================= */
section('Sterne');
/* ========================================================================= */

{
  check('Viel Restluft gibt drei Sterne', Levels.starsFor(12, 25) === 3);
  check('Etwas Restluft gibt zwei Sterne', Levels.starsFor(5, 25) === 2);
  check('Knapp geschafft gibt einen Stern', Levels.starsFor(0, 25) === 1);
  check('Nie null Sterne fuer ein geschafftes Level',
    Levels.starsFor(0, 25) >= 1 && Levels.starsFor(-3, 25) >= 1);
  check('Ohne Zugzahl trotzdem ein Stern', Levels.starsFor(3, 0) === 1);
}

/* ========================================================================= */
section('Aufgaben-Fortschritt');
/* ========================================================================= */

{
  const progress = Goals.newProgress(7);
  const goal = Goals.collect(2, 10);

  check('Frischer Fortschritt ist null', Goals.currentOf(goal, progress) === 0);
  check('Frische Aufgabe ist offen', !Goals.isDone(goal, progress));

  progress.colors[2] = 4;
  check('Fortschritt wird gezaehlt', Goals.currentOf(goal, progress) === 4);
  check('Rest stimmt', Goals.remainingOf(goal, progress) === 6);

  progress.colors[2] = 25;
  check('Anzeige wird gedeckelt', Goals.currentOf(goal, progress) === 10,
    String(Goals.currentOf(goal, progress)));
  check('Uebererfuellt gilt als erledigt', Goals.isDone(goal, progress));
  check('Rest faellt nicht ins Negative', Goals.remainingOf(goal, progress) === 0);
}

{
  const progress = Goals.newProgress(7);
  const goals = [Goals.collect(0, 10), Goals.blockers(4)];

  check('Nicht fertig, solange eine Aufgabe offen ist',
    !Goals.allDone(goals, progress));

  progress.colors[0] = 10;
  check('Eine von zwei reicht nicht', !Goals.allDone(goals, progress));
  check('Gesamtfortschritt liegt bei der Haelfte',
    Math.abs(Goals.overall(goals, progress) - 0.5) < 0.001,
    String(Goals.overall(goals, progress)));

  progress.blockers = 4;
  check('Beide erfuellt heisst fertig', Goals.allDone(goals, progress));
  check('Gesamtfortschritt ist voll', Goals.overall(goals, progress) === 1);

  check('Ein Level ohne Aufgaben gilt nie als geschafft',
    !Goals.allDone([], progress));
}

{
  const progress = Goals.newProgress(7);
  progress.score = 5000;

  check('Punkteaufgabe zaehlt Punkte',
    Goals.currentOf(Goals.score(9000), progress) === 5000);
  check('Punkteaufgabe erfuellt sich bei Erreichen',
    Goals.isDone(Goals.score(5000), progress));
}

/* ========================================================================= */
section('Beschriftung');
/* ========================================================================= */

{
  /* Das Symbol ist kein Emoji mehr, sondern ein Bezeichner, aus dem die
     Anzeige denselben Stein zeichnet, der auch faellt. Wichtig ist deshalb,
     dass jede Sammelaufgabe auf eine Farbe zeigt, die es wirklich gibt —
     sonst zeichnete die Marke einen Stein, der im Level nicht vorkommt. */
  const KINDS = ['gem', 'blocker', 'score'];
  const wrong = [];

  for (let n = 1; n <= UP_TO; n++) {
    const def = Levels.get(n);
    def.goals.forEach((g) => {
      const sym = Goals.symbol(g);
      if (!sym || KINDS.indexOf(sym.kind) < 0 || !Goals.label(g)) {
        wrong.push(`Level ${n}: ${JSON.stringify(sym)}`);
        return;
      }
      if (sym.kind === 'gem' && !(sym.type >= 0 && sym.type < def.colors)) {
        wrong.push(`Level ${n}: Symbolfarbe ${sym.type} bei ${def.colors} Farben`);
      }
    });
  }

  check('Jede Aufgabe hat ein zeichenbares Symbol und einen Text',
    wrong.length === 0, wrong.slice(0, 6).join('\n    '));

  check('Sammelaufgabe zeigt die Farbe der Aufgabe',
    Goals.symbol(Goals.collect(2, 5)).kind === 'gem' &&
    Goals.symbol(Goals.collect(2, 5)).type === 2);
  check('Felsaufgabe zeigt einen Felsen',
    Goals.symbol(Goals.blockers(4)).kind === 'blocker');
  check('Punkteaufgabe zeigt den Punktestern',
    Goals.symbol(Goals.score(5000)).kind === 'score');

  check('Sammelaufgabe nennt die Farbe',
    Goals.label(Goals.collect(2, 5)).includes('Smaragd'),
    Goals.label(Goals.collect(2, 5)));
  check('Unbekannter Typ wird abgelehnt',
    Goals.validate({ type: 'quatsch', count: 3 }, Levels.get(1)) !== null);
  check('Aufgabe ohne Anzahl wird abgelehnt',
    Goals.validate({ type: 'collect', color: 0, count: 0 }, Levels.get(1)) !== null);
}

/* ========================================================================= */

console.log(`\n${passed} bestanden, ${failed} fehlgeschlagen`);
process.exit(failed > 0 ? 1 : 0);
