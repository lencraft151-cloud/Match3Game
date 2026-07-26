#!/usr/bin/env node
/* ==========================================================================
   Tests der Erklaerkette im Uebungslevel.

       node test/tutorial.test.js

   Zwei Zusagen stehen hier auf dem Pruefstand:

     1. Das Uebungslevel endet erst, wenn der Text durch ist. Wer die Aufgabe
        frueh erfuellt, darf nicht mittendrin herausgeworfen werden — genau
        das passierte vorher, weil die erfuellte Aufgabe das Level beendete.

     2. Jeder Schritt sperrt, was er nicht verlangt. Ohne diese Zusage koennte
        man den Text ueberspringen, indem man einfach weiterspielt.

   Die Kette braucht dafuer kein DOM: ohne `Tutorial.init()` fasst sie
   `document` nie an, und das Spiel haengt nur als Attrappe daran.
   ========================================================================== */

'use strict';

const Tutorial = require('../js/tutorial.js');

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

/* Attrappe des Spiels: merkt sich, was die Kette verlangt hat. */
function makeApi(options) {
  const opts = options || {};
  const api = {
    guides: [],
    finished: 0,
    goal: !!opts.goalDone,

    setGuide(mode, item) { api.guides.push({ mode: mode || null, item: item || null }); },
    goalDone() { return api.goal; },
    finish() { api.finished++; }
  };
  return api;
}

/* Spielt die Kette bis zum Ende durch und meldet jedes verlangte Ereignis.
   Bricht ab, falls sie sich nicht bewegt — eine haengende Kette waere im
   Spiel eine Sackgasse ohne Ausweg. */
function playThrough(api, limit) {
  const max = limit || 50;

  for (let i = 0; i < max; i++) {
    const index = Tutorial.index();
    if (index < 0 || index >= Tutorial.STEPS.length) return i;

    Tutorial.notify(Tutorial.STEPS[index].wait);

    if (Tutorial.index() === index) return -1;   /* haengt */
  }

  return -2;   /* laeuft nicht rund */
}

/* ========================================================================= */
section('Aufbau der Schrittkette');
/* ========================================================================= */

{
  const steps = Tutorial.STEPS;
  const waits = ['tap', 'swap', 'power', 'goal'];
  const guides = ['read', 'swap', 'power', null];

  check('Es gibt ueberhaupt Schritte', steps.length >= 5, String(steps.length));

  const badWait = steps.findIndex((s) => waits.indexOf(s.wait) < 0);
  check('Jeder Schritt hat ein bekanntes Ende', badWait < 0,
    badWait < 0 ? '' : `Schritt ${badWait + 1}: ${steps[badWait].wait}`);

  const badGuide = steps.findIndex((s) => guides.indexOf(s.guide || null) < 0);
  check('Jeder Schritt hat eine bekannte Fuehrung', badGuide < 0,
    badGuide < 0 ? '' : `Schritt ${badGuide + 1}: ${steps[badGuide].guide}`);

  const noText = steps.findIndex((s) => !s.text || s.text.length < 20);
  check('Jeder Schritt hat einen Text', noText < 0, `Schritt ${noText + 1}`);

  /* Der Riegel: der letzte Schritt muss per Antippen enden. Waere er ein
     Spielschritt, koennte das Level ohne Zutun durchlaufen. */
  check('Der letzte Schritt endet mit einem Antippen',
    steps[steps.length - 1].wait === 'tap', steps[steps.length - 1].wait);

  /* Ein Schritt, der auf eine Aktion wartet, muss sie auch erlauben. */
  const contradiction = steps.findIndex((s) =>
    (s.wait === 'swap' && s.guide !== 'swap') ||
    (s.wait === 'power' && s.guide !== 'power') ||
    (s.wait === 'goal' && s.guide) ||
    (s.wait === 'tap' && s.guide !== 'read'));
  check('Kein Schritt verlangt, was er selbst sperrt', contradiction < 0,
    contradiction < 0 ? '' : `Schritt ${contradiction + 1}`);

  const powerStep = steps.find((s) => s.guide === 'power');
  check('Der Power-Schritt nennt ein bestimmtes Power-Up',
    !!powerStep && !!powerStep.item, powerStep ? String(powerStep.item) : 'fehlt');
}

/* ========================================================================= */
section('Das Level endet erst mit dem Text');
/* ========================================================================= */

{
  const api = makeApi();
  Tutorial.start(api);

  check('Die Kette laeuft', Tutorial.isActive());
  check('Sie beginnt beim ersten Schritt', Tutorial.index() === 0,
    String(Tutorial.index()));
  check('Noch nichts abgeschlossen', api.finished === 0);

  /* Der Kernfall: die Aufgabe ist schon erfuellt, waehrend der Text noch
     laeuft. Frueher hat genau das das Level beendet. */
  api.goal = true;
  for (let i = 0; i < 10; i++) Tutorial.notify('goal');

  check('Eine frueh erfuellte Aufgabe beendet nichts', api.finished === 0,
    `finish() lief ${api.finished}x`);
  check('Die Kette steht immer noch am Anfang', Tutorial.index() === 0,
    String(Tutorial.index()));

  Tutorial.stop();
}

{
  const api = makeApi();
  Tutorial.start(api);

  /* Bis kurz vor Schluss durchspielen. */
  const last = Tutorial.STEPS.length - 1;
  let steps = 0;
  while (Tutorial.index() < last && steps < 50) {
    Tutorial.notify(Tutorial.STEPS[Tutorial.index()].wait);
    steps++;
  }

  check('Der letzte Schritt wird erreicht', Tutorial.index() === last,
    String(Tutorial.index()));
  check('Bis dahin ist nichts abgeschlossen', api.finished === 0,
    `finish() lief ${api.finished}x`);

  Tutorial.notify('tap');
  check('Erst der letzte Schritt schliesst ab', api.finished === 1,
    `finish() lief ${api.finished}x`);

  /* Nach dem Abschluss darf kein weiteres Ereignis noch einmal ausloesen. */
  Tutorial.notify('tap');
  Tutorial.notify('goal');
  check('Abgeschlossen wird nur einmal', api.finished === 1,
    `finish() lief ${api.finished}x`);

  Tutorial.stop();
}

{
  /* Ist die Aufgabe beim Betreten des Aufgaben-Schritts schon erfuellt, muss
     er uebersprungen werden — sonst wartet die Kette auf etwas, das nie
     wieder passiert, und das Level liesse sich nicht mehr beenden. */
  const api = makeApi({ goalDone: true });
  Tutorial.start(api);

  const rounds = playThrough(api);

  check('Die Kette laeuft trotz erfuellter Aufgabe durch', rounds > 0,
    rounds === -1 ? 'sie haengt an einem Schritt' : `Ergebnis ${rounds}`);
  check('Und schliesst dabei genau einmal ab', api.finished === 1,
    `finish() lief ${api.finished}x`);

  Tutorial.stop();
}

{
  /* Dasselbe ohne erfuellte Aufgabe: hier muss der Aufgaben-Schritt kommen. */
  const api = makeApi();
  Tutorial.start(api);

  const seen = [];
  let guard = 0;
  while (Tutorial.isActive() && Tutorial.index() < Tutorial.STEPS.length && guard++ < 50) {
    const step = Tutorial.STEPS[Tutorial.index()];
    seen.push(step.wait);
    Tutorial.notify(step.wait);
  }

  check('Der Aufgaben-Schritt wird gespielt', seen.indexOf('goal') >= 0,
    seen.join(', '));
  check('Der Tausch-Schritt wird gespielt', seen.indexOf('swap') >= 0,
    seen.join(', '));
  check('Der Power-Schritt wird gespielt', seen.indexOf('power') >= 0,
    seen.join(', '));
  check('Jeder Schritt wird genau einmal gespielt',
    seen.length === Tutorial.STEPS.length,
    `${seen.length} statt ${Tutorial.STEPS.length}`);

  Tutorial.stop();
}

/* ========================================================================= */
section('Nur das Verlangte geht');
/* ========================================================================= */

{
  const api = makeApi();
  Tutorial.start(api);

  /* Jeder Schritt muss dem Spiel sagen, was gilt — ein Schritt ohne Fuehrung
     wuerde die Sperre des vorigen unbemerkt weiterlaufen lassen. */
  const expected = Tutorial.STEPS.map((s) => s.guide || null);
  playThrough(api);

  check('Jeder Schritt setzt seine Fuehrung',
    api.guides.length === Tutorial.STEPS.length,
    `${api.guides.length} statt ${Tutorial.STEPS.length}`);
  check('Und zwar die richtige',
    JSON.stringify(api.guides.map((g) => g.mode)) === JSON.stringify(expected),
    JSON.stringify(api.guides.map((g) => g.mode)));

  const powerGuide = api.guides.find((g) => g.mode === 'power');
  check('Der Power-Schritt reicht sein Power-Up durch',
    !!powerGuide && powerGuide.item === 'hammer',
    powerGuide ? String(powerGuide.item) : 'fehlt');

  Tutorial.stop();
}

{
  const api = makeApi();
  Tutorial.start(api);

  /* Schritt 1 ist ein Lese-Schritt: Power-Ups sind dort zu. */
  check('Im Lese-Schritt sind Power-Ups gesperrt', !Tutorial.allows('power'));
  check('Im Lese-Schritt ist auch das Brett gesperrt', !Tutorial.allows('board'));

  /* Bis zum Power-Schritt vorspielen. */
  let guard = 0;
  while (Tutorial.isActive() && guard++ < 50) {
    const step = Tutorial.STEPS[Tutorial.index()];
    if (step.guide === 'power') break;
    Tutorial.notify(step.wait);
  }

  check('Im Power-Schritt sind Power-Ups frei', Tutorial.allows('power'));

  /* Weiter bis zum freien Aufgaben-Schritt. */
  guard = 0;
  while (Tutorial.isActive() && guard++ < 50) {
    const step = Tutorial.STEPS[Tutorial.index()];
    if (step.guide === null) break;
    Tutorial.notify(step.wait);
  }

  check('Im freien Schritt ist alles offen',
    Tutorial.allows('power') && Tutorial.allows('board'));

  Tutorial.stop();
}

{
  /* Ausserhalb des Uebungslevels darf die Kette nichts sperren. */
  Tutorial.stop();

  check('Ohne laufende Kette ist nichts aktiv', !Tutorial.isActive());
  check('Ohne laufende Kette sind Power-Ups frei', Tutorial.allows('power'));
  check('Ohne laufende Kette ist das Brett frei', Tutorial.allows('board'));
  check('Ohne laufende Kette gibt es keinen Schritt', Tutorial.index() === -1,
    String(Tutorial.index()));

  /* Ereignisse ins Leere duerfen nicht abstuerzen. */
  let threw = false;
  try {
    Tutorial.notify('goal');
    Tutorial.notify('swap');
    Tutorial.nudge();
  } catch (err) {
    threw = true;
  }
  check('Meldungen ohne laufende Kette laufen ins Leere', !threw);
}

{
  /* Eine Kette ohne api darf nicht abstuerzen — das Spiel soll auch dann
     spielbar bleiben, wenn die Verdrahtung fehlt. */
  let threw = false;
  try {
    Tutorial.start();
    Tutorial.notify('tap');
    Tutorial.stop();
  } catch (err) {
    threw = true;
  }
  check('Kette ohne Anbindung stuerzt nicht ab', !threw);
}

/* ========================================================================= */

console.log(`\n${passed} bestanden, ${failed} fehlgeschlagen`);
process.exit(failed > 0 ? 1 : 0);
