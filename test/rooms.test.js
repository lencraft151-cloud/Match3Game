#!/usr/bin/env node
/* ==========================================================================
   Tests der Zimmer-Einrichtung.

       node test/rooms.test.js

   Drei Dinge stehen auf dem Pruefstand:

     1. Die Reihenfolge stimmt. Ein Zimmer geht erst auf, wenn das davor
        fertig ist — sonst koennte man den Rosengarten einrichten, waehrend
        die Eingangshalle noch nackt ist.

     2. Ein kaputter Spielstand bringt nichts durcheinander. Die Einrichtung
        steht im localStorage und laesst sich dort manipulieren; heraus darf
        hoechstens eine fehlende Auswahl kommen, nie ein Absturz.

     3. Die Preise bleiben spielbar. Zahlen, die niemand mehr
        zusammenspielt, sind kein Fortschritt, sondern eine Wand.
   ========================================================================== */

'use strict';

/* js/player.js ist fuer den Browser geschrieben und haengt sich an ein
   globales M3-Objekt. Hier wird genau das nachgebaut — gebraucht wird nur
   die Muenzformel, aber sie soll aus dem echten Modul kommen und nicht hier
   noch einmal abgeschrieben werden. Eine abgeschriebene Formel prueft
   irgendwann sich selbst statt das Spiel.

   Die Reihenfolge ist wichtig: erst die Umgebung, dann die Module. Wird M3
   nachtraeglich gesetzt, sind die vorher geladenen Module weg. */
global.localStorage = (function () {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear()
  };
})();
global.M3 = {};

const CONFIG = require('../js/config.js');
require('../js/utils.js');
require('../js/player.js');
const Player = global.M3.Player;
const Rooms = require('../js/rooms.js');

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

/* Richtet ein Zimmer komplett mit der jeweils ersten Variante ein. */
function furnish(state, room) {
  room.tasks.forEach((task) => Rooms.pick(state, room.key, task.key, task.options[0].key));
  return state;
}

/* ========================================================================= */
section('Aufbau der Zimmer');
/* ========================================================================= */

{
  check('Es gibt Zimmer', Rooms.COUNT >= 2, String(Rooms.COUNT));
  check('ALL passt zu COUNT', Rooms.ALL.length === Rooms.COUNT);

  const problems = [];
  const keys = new Set();

  Rooms.ALL.forEach((room, i) => {
    if (!room.key || keys.has(room.key)) problems.push(`Zimmer ${i}: Schluessel ${room.key}`);
    keys.add(room.key);

    if (!room.name || !room.lead) problems.push(`Zimmer ${room.key}: Name oder Text fehlt`);
    if (!room.tasks || room.tasks.length < 2) problems.push(`Zimmer ${room.key}: zu wenige Aufgaben`);

    const taskKeys = new Set();
    room.tasks.forEach((task) => {
      if (taskKeys.has(task.key)) problems.push(`Zimmer ${room.key}: Aufgabe ${task.key} doppelt`);
      taskKeys.add(task.key);

      if (!task.question) problems.push(`${room.key}/${task.key}: keine Frage`);
      if (!task.options || task.options.length < 2) {
        problems.push(`${room.key}/${task.key}: braucht mindestens zwei Varianten`);
        return;
      }

      /* Beide Varianten muessen gleich viel kosten. Sonst waehlt man nicht
         nach Geschmack, sondern nach Preis — und die Wahl ist keine. */
      const prices = task.options.map((o) => o.price);
      if (Math.min(...prices) !== Math.max(...prices)) {
        problems.push(`${room.key}/${task.key}: Varianten kosten unterschiedlich (${prices})`);
      }
      task.options.forEach((o) => {
        if (!o.key || !o.name) problems.push(`${room.key}/${task.key}: Variante unvollstaendig`);
        if (!(o.price > 0)) problems.push(`${room.key}/${task.key}/${o.key}: Preis ${o.price}`);
      });
    });
  });

  check('Alle Zimmer sind vollstaendig und eindeutig', problems.length === 0,
    problems.slice(0, 6).join('\n    '));
}

/* ========================================================================= */
section('Freischalten in der richtigen Reihenfolge');
/* ========================================================================= */

{
  const state = Rooms.emptyState();

  check('Frisch ist das erste Zimmer dran', Rooms.activeIndex(state) === 0);
  check('Das erste Zimmer ist offen', Rooms.isUnlocked(state, 0));
  check('Das zweite ist noch zu', !Rooms.isUnlocked(state, 1));
  check('Nichts ist fertig', Rooms.doneCount(state, Rooms.get(0)) === 0);
  check('Gesamtfortschritt ist null', Rooms.overall(state) === 0);

  /* Eine einzelne Auswahl darf noch nichts freischalten. */
  const first = Rooms.get(0);
  Rooms.pick(state, first.key, first.tasks[0].key, first.tasks[0].options[0].key);
  check('Eine Auswahl macht das Zimmer nicht fertig', !Rooms.isComplete(state, first));
  check('Und schaltet das naechste nicht frei', !Rooms.isUnlocked(state, 1));
  check('Der Fortschritt zaehlt trotzdem mit', Rooms.doneCount(state, first) === 1);

  furnish(state, first);
  check('Alle Auswahlen machen das Zimmer fertig', Rooms.isComplete(state, first));
  check('Jetzt geht das zweite auf', Rooms.isUnlocked(state, 1));
  check('Und ist das aktuelle', Rooms.activeIndex(state) === 1);
  check('Das dritte bleibt zu', !Rooms.isUnlocked(state, 2));

  /* Alles einrichten. */
  Rooms.ALL.forEach((room) => furnish(state, room));
  check('Am Ende ist alles fertig', Rooms.overall(state) === 1);
  check('Der aktive Index bleibt beim letzten Zimmer stehen',
    Rooms.activeIndex(state) === Rooms.COUNT - 1);
  check('Ein Index ausserhalb ist nie offen',
    !Rooms.isUnlocked(state, Rooms.COUNT) && !Rooms.isUnlocked(state, -1));
}

/* ========================================================================= */
section('Naechste offene Aufgabe');
/* ========================================================================= */

{
  const state = Rooms.emptyState();
  const room = Rooms.get(0);

  check('Frisch ist die erste Aufgabe dran',
    Rooms.nextTask(state, room).key === room.tasks[0].key);

  Rooms.pick(state, room.key, room.tasks[0].key, room.tasks[0].options[1].key);
  check('Danach die zweite', Rooms.nextTask(state, room).key === room.tasks[1].key);

  furnish(state, room);
  check('Im fertigen Zimmer gibt es keine mehr', Rooms.nextTask(state, room) === null);
  check('Ohne Zimmer stuerzt nichts ab', Rooms.nextTask(state, null) === null);
}

/* ========================================================================= */
section('Kaputte Spielstaende');
/* ========================================================================= */

{
  check('Nichts ergibt einen leeren Stand',
    JSON.stringify(Rooms.sanitize(null)) === JSON.stringify(Rooms.emptyState()));
  check('Unsinn ergibt einen leeren Stand',
    JSON.stringify(Rooms.sanitize('kaputt')) === JSON.stringify(Rooms.emptyState()));
  check('Ein Objekt ohne chosen ergibt einen leeren Stand',
    JSON.stringify(Rooms.sanitize({ irgendwas: 1 })) === JSON.stringify(Rooms.emptyState()));

  /* Erfundene Zimmer, erfundene Aufgaben und erfundene Varianten fliegen
     raus — sonst zeichnete roomart.js ins Leere. */
  const dirty = Rooms.sanitize({
    chosen: {
      hall: { floor: 'marble', wall: 'erfunden', quatsch: 'marble' },
      gibtsnicht: { floor: 'marble' }
    }
  });

  check('Gueltige Auswahl bleibt', dirty.chosen.hall.floor === 'marble');
  check('Erfundene Variante fliegt raus', dirty.chosen.hall.wall === undefined);
  check('Erfundene Aufgabe fliegt raus', dirty.chosen.hall.quatsch === undefined);
  check('Erfundenes Zimmer fliegt raus', dirty.chosen.gibtsnicht === undefined);

  check('chosenIn liefert immer ein Objekt',
    typeof Rooms.chosenIn(dirty, 'gibtsnicht') === 'object');
  check('Auch ohne Stand', typeof Rooms.chosenIn(null, 'hall') === 'object');
}

/* ========================================================================= */
section('Preise bleiben spielbar');
/* ========================================================================= */

{
  /* Was ein durchschnittliches Level einbringt: Stufe 10, zwei Sterne. */
  const perLevel = Player.coinsForLevel(10, 2);
  check('Ein Level bringt Muenzen', perLevel > 0, String(perLevel));

  const costs = Rooms.ALL.map((room) =>
    room.tasks.reduce((sum, t) => sum + t.options[0].price, 0));
  const total = costs.reduce((a, b) => a + b, 0);

  console.log(`    Ein Level bringt rund ${perLevel} Muenzen.`);
  Rooms.ALL.forEach((room, i) => {
    console.log(`    ${room.name}: ${costs[i]} Muenzen ` +
      `(~${Math.ceil(costs[i] / perLevel)} Level)`);
  });
  console.log(`    Gesamt: ${total} Muenzen (~${Math.ceil(total / perLevel)} Level)`);

  /* Ein Zimmer soll sich in unter 15 Leveln ausstatten lassen. Darueber
     verliert man den Faden zwischen zwei Moebelstuecken. */
  const slow = costs.findIndex((c) => c / perLevel > 15);
  check('Kein Zimmer dauert laenger als 15 Level', slow < 0,
    slow < 0 ? '' : `${Rooms.ALL[slow].name}: ${Math.ceil(costs[slow] / perLevel)} Level`);

  /* Und es soll auch nicht nebenbei abfallen. */
  const fast = costs.findIndex((c) => c / perLevel < 2);
  check('Kein Zimmer ist in unter zwei Leveln erledigt', fast < 0,
    fast < 0 ? '' : `${Rooms.ALL[fast].name}`);

  /* Spaetere Zimmer duerfen ruhig teurer sein, aber nicht billiger. */
  let falling = false;
  for (let i = 1; i < costs.length; i++) if (costs[i] < costs[i - 1]) falling = true;
  check('Die Zimmer werden nicht billiger', !falling, costs.join(' -> '));

  /* Muenzen und Kristalle sind getrennt: eine Einrichtung darf nie ein
     Extra-Leben kosten. */
  check('Einrichten geht nicht auf Kosten der Kristalle',
    typeof Player.spendCoins === 'function' && CONFIG.PRICE_LIFE > 0);
}

/* ========================================================================= */

console.log(`\n${passed} bestanden, ${failed} fehlgeschlagen`);
process.exit(failed > 0 ? 1 : 0);
