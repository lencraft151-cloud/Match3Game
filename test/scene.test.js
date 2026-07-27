#!/usr/bin/env node
/* ==========================================================================
   Tests der Kulisse hinter dem Spielfeld.

       node test/scene.test.js

   js/scene.js baut aus den Bausteinen von js/roomart.js pro Brett-Thema
   einen Raum zusammen. Die Verbindung ist eine Tabelle aus Zeichenketten,
   und Zeichenketten koennen sich vertippen. Ein Tippfehler faellt beim
   Zeichnen nicht auf: die Schicht wird stillschweigend uebersprungen und
   die Wand bleibt leer. Man muesste ihn also im Bild suchen — und zwar in
   dem einen von sechs Themen, das nur alle vier Level drankommt.

   Deshalb wird hier gegen die echten Tabellen geprueft, nicht gegen
   abgeschriebene Listen:

     1. Jedes Thema aus js/game.js hat einen Raum.
     2. Jeder Schluessel in diesem Raum existiert wirklich in js/roomart.js.
     3. Es gibt keinen Raum fuer ein Thema, das es nicht gibt.
   ========================================================================== */

'use strict';

/* Die Reihenfolge ist wichtig: erst die Umgebung, dann die Module. Wird M3
   nachtraeglich gesetzt, sind die vorher geladenen Module weg. */
global.M3 = {};

require('../js/config.js');
require('../js/utils.js');
require('../js/goals.js');
require('../js/levels.js');
require('../js/board.js');
require('../js/particles.js');

const RoomArt = require('../js/roomart.js');
const Scene = require('../js/scene.js');
require('../js/game.js');
const Game = global.M3.Game;

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

/* Welche Schicht in welcher Tabelle nachgeschlagen wird — dieselbe
   Zuordnung, die paintBand in js/scene.js benutzt. */
const TABLE_OF = { wall: 'wall', floor: 'floor', light: 'light', thing: 'deco' };

/* ========================================================================= */
section('Jedes Thema hat einen vollstaendigen Raum');
/* ========================================================================= */

check('js/game.js gibt seine Themen heraus', Array.isArray(Game.THEMES) && Game.THEMES.length > 0,
  'Game.THEMES = ' + JSON.stringify(Game.THEMES && Game.THEMES.length));

check('js/roomart.js gibt seine Bausteine heraus',
  !!RoomArt.LAYERS && !!RoomArt.LAYERS.wall && !!RoomArt.LAYERS.deco);

Game.THEMES.forEach((theme) => {
  const room = Scene.roomFor(theme.key);
  check(`Thema "${theme.key}" hat einen Raum`, !!room);
  if (!room) return;

  Object.keys(TABLE_OF).forEach((slot) => {
    const key = room[slot];
    const table = RoomArt.LAYERS[TABLE_OF[slot]];

    check(`  ${theme.key}.${slot} ist gesetzt`, typeof key === 'string' && key.length > 0,
      `steht auf ${JSON.stringify(key)}`);

    check(`  ${theme.key}.${slot} = "${key}" gibt es in roomart.js`,
      !!table && typeof table[key] === 'function',
      `bekannt sind: ${table ? Object.keys(table).join(', ') : '(keine Tabelle)'}`);
  });
});

/* ========================================================================= */
section('Keine Raeume fuer Themen, die es nicht gibt');
/* ========================================================================= */

const themeKeys = Game.THEMES.map((t) => t.key);

Object.keys(Scene.ROOMS).forEach((key) => {
  check(`Der Raum "${key}" gehoert zu einem echten Thema`, themeKeys.indexOf(key) !== -1,
    `js/game.js kennt nur: ${themeKeys.join(', ')}`);
});

check('Es gibt genauso viele Raeume wie Themen',
  Object.keys(Scene.ROOMS).length === themeKeys.length,
  `${Object.keys(Scene.ROOMS).length} Raeume, ${themeKeys.length} Themen`);

/* ========================================================================= */
section('Jedes Level bekommt eine Kulisse');
/* ========================================================================= */

/* Nicht nur die Tabelle pruefen, sondern den Weg, den das Spiel geht:
   Level -> themeFor() -> Raum. Das Uebungslevel ist die 0. */
for (let level = 0; level <= 40; level++) {
  const theme = Game.themeFor(level);
  if (!theme) { check(`Level ${level} hat ein Thema`, false); continue; }
  if (!Scene.roomFor(theme.key)) {
    check(`Level ${level} (Thema ${theme.key}) hat eine Kulisse`, false);
  }
}
check('Alle Level von 0 bis 40 haben eine Kulisse', true);

/* ========================================================================= */
section('Die Raeume wiederholen sich nicht komplett');
/* ========================================================================= */

/* Sechs Themen, die alle denselben Raum zeigen, waeren zwar gueltig, aber
   sinnlos — der Sinn der Sache ist, dass es anders aussieht. */
const fingerprints = new Set(
  Object.keys(Scene.ROOMS).map((k) => {
    const r = Scene.ROOMS[k];
    return [r.wall, r.floor, r.light, r.thing].join('|');
  })
);

check('Jedes Thema sieht anders aus', fingerprints.size === Object.keys(Scene.ROOMS).length,
  `${fingerprints.size} verschiedene Raeume bei ${Object.keys(Scene.ROOMS).length} Themen`);

/* Wenigstens die Waende sollen sich unterscheiden — sie fuellen die
   groesste Flaeche. */
const walls = new Set(Object.keys(Scene.ROOMS).map((k) => Scene.ROOMS[k].wall));
check('Keine Wand kommt zweimal vor', walls.size === Object.keys(Scene.ROOMS).length,
  `${walls.size} verschiedene Waende`);

/* ========================================================================= */
console.log(`\n${passed} bestanden, ${failed} fehlgeschlagen`);
process.exit(failed ? 1 : 0);
