#!/usr/bin/env node
/* ==========================================================================
   Player-Tests — Leben, Tageswechsel, Kristalle und Einkaeufe.

       node test/player.test.js

   js/player.js ist fuer den Browser geschrieben und haengt sich an ein
   globales M3-Objekt. Hier wird genau diese Umgebung nachgebaut, inklusive
   eines localStorage-Ersatzes, damit die Logik ohne Browser laeuft.
   ========================================================================== */

'use strict';

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

/* --------------------------------------------------- Browser nachbauen */

function makeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
    _raw: map
  };
}

global.localStorage = makeStorage();
global.M3 = {};

require('../js/config.js');
require('../js/utils.js');
require('../js/player.js');

const CONFIG = global.M3.CONFIG;
const Player = global.M3.Player;
const KEY = CONFIG.STORE_PLAYER;

/* Setzt das Profil zurueck und laedt es frisch. */
function fresh() {
  global.localStorage.clear();
  return Player.load();
}

/* Schreibt direkt in den Speicher und laedt neu — so laesst sich jeder
   Ausgangszustand herstellen, auch ein kaputter. */
function loadWith(raw) {
  global.localStorage.setItem(KEY, JSON.stringify(raw));
  return Player.load();
}

function stored() {
  return JSON.parse(global.localStorage.getItem(KEY));
}

function yesterdayKey() {
  const d = new Date(Date.now() - 24 * 3600 * 1000);
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}

/* ========================================================================= */
section('Startzustand');
/* ========================================================================= */

{
  const p = fresh();
  check('Volle Leben zum Start', p.lives === CONFIG.MAX_LIVES, String(p.lives));
  check('Keine Kristalle zum Start', p.crystals === 0);
  check('Startausstattung an Power-Ups',
    p.powerups.hammer === CONFIG.STARTING_POWERUPS.hammer &&
    p.powerups.shuffle === CONFIG.STARTING_POWERUPS.shuffle &&
    p.powerups.time === CONFIG.STARTING_POWERUPS.time,
    JSON.stringify(p.powerups));
  check('Profil wird sofort gespeichert', stored() !== null);
}

/* ========================================================================= */
section('Leben');
/* ========================================================================= */

{
  fresh();
  check('hasLife() bei vollem Vorrat', Player.hasLife());

  for (let i = 0; i < CONFIG.MAX_LIVES; i++) Player.loseLife();

  check('Nach allen Niederlagen keine Leben mehr', Player.snapshot().lives === 0);
  check('hasLife() ist dann falsch', !Player.hasLife());

  Player.loseLife();
  check('Leben laufen nicht ins Negative', Player.snapshot().lives === 0,
    String(Player.snapshot().lives));
}

/* ========================================================================= */
section('Tageswechsel');
/* ========================================================================= */

{
  /* Gestern aufgebraucht -> heute wieder voll. */
  loadWith({ crystals: 10, lives: 0, day: yesterdayKey(), powerups: { hammer: 0, shuffle: 0, time: 0 } });

  const p = Player.snapshot();
  check('Neuer Tag stellt die Leben her', p.lives === CONFIG.MAX_LIVES, String(p.lives));
  check('Kristalle ueberleben den Tageswechsel', p.crystals === 10);
  check('Power-Ups ueberleben den Tageswechsel',
    p.powerups.hammer === 0 && p.powerups.shuffle === 0);
}

{
  /* Gekaufte Extraleben ueber dem Tagesmaximum bleiben erhalten — sonst
     waere ein Kauf kurz vor Mitternacht weggeworfenes Geld. */
  const extra = CONFIG.MAX_LIVES + 3;
  loadWith({ crystals: 0, lives: extra, day: yesterdayKey(), powerups: {} });

  check('Extraleben werden beim Tageswechsel nicht gekappt',
    Player.snapshot().lives === extra, String(Player.snapshot().lives));
}

{
  /* Am selben Tag darf sich nichts von allein auffuellen. */
  const todayStored = (() => { fresh(); return stored().day; })();
  loadWith({ crystals: 0, lives: 1, day: todayStored, powerups: {} });

  check('Am selben Tag bleiben die Leben, wie sie sind',
    Player.snapshot().lives === 1, String(Player.snapshot().lives));
}

/* ========================================================================= */
section('Kristalle');
/* ========================================================================= */

{
  fresh();

  const base = CONFIG.CRYSTALS_BASE + CONFIG.CRYSTALS_PER_LEVEL;
  check('Level 1 ohne Restzeit', Player.crystalsForLevel(1, 0) === base,
    String(Player.crystalsForLevel(1, 0)));

  check('Restzeit zahlt sich aus',
    Player.crystalsForLevel(1, 20) === base + 10,
    String(Player.crystalsForLevel(1, 20)));

  check('Hoehere Level bringen mehr',
    Player.crystalsForLevel(5, 0) > Player.crystalsForLevel(1, 0));

  check('Negative Restzeit zaehlt als null',
    Player.crystalsForLevel(1, -50) === base);

  Player.earn(100);
  check('Kristalle werden gutgeschrieben', Player.snapshot().crystals === 100);

  Player.earn(-40);
  check('Negative Gutschrift wird ignoriert', Player.snapshot().crystals === 100,
    String(Player.snapshot().crystals));
}

/* ========================================================================= */
section('Einkaeufe');
/* ========================================================================= */

{
  fresh();
  Player.loseLife();

  const poor = Player.buyLife();
  check('Ohne Guthaben kein Leben', !poor.ok);
  check('Der Grund nennt die fehlenden Kristalle',
    /\d+ Kristalle/.test(poor.reason), poor.reason);

  Player.earn(CONFIG.PRICE_LIFE);
  const before = Player.snapshot().lives;
  const ok = Player.buyLife();

  check('Mit Guthaben klappt der Kauf', ok.ok, JSON.stringify(ok));
  check('Ein Leben mehr', Player.snapshot().lives === before + 1);
  check('Kristalle sind abgebucht', Player.snapshot().crystals === 0);
}

{
  fresh();
  Player.earn(100000);

  while (Player.snapshot().lives < CONFIG.LIVES_CAP) {
    const step = Player.buyLife();
    if (!step.ok) break;
  }

  check('Leben lassen sich bis zur Obergrenze kaufen',
    Player.snapshot().lives === CONFIG.LIVES_CAP, String(Player.snapshot().lives));

  const tooMany = Player.buyLife();
  check('Ueber die Obergrenze hinaus nicht', !tooMany.ok);
  check('Der Grund nennt die Obergrenze',
    tooMany.reason.includes(String(CONFIG.LIVES_CAP)), tooMany.reason);
}

{
  fresh();

  const broke = Player.buyPowerUp('hammer');
  check('Ohne Guthaben kein Power-Up', !broke.ok);

  Player.earn(CONFIG.PRICE_HAMMER);
  const start = Player.countOf('hammer');
  const bought = Player.buyPowerUp('hammer');

  check('Power-Up gekauft', bought.ok);
  check('Vorrat gewachsen', Player.countOf('hammer') === start + 1);
  check('Kristalle abgebucht', Player.snapshot().crystals === 0);

  const nonsense = Player.buyPowerUp('laserkanone');
  check('Unbekanntes Power-Up wird abgelehnt', !nonsense.ok, JSON.stringify(nonsense));
}

/* ========================================================================= */
section('Power-Ups verbrauchen');
/* ========================================================================= */

{
  fresh();
  const start = Player.countOf('shuffle');

  check('Verbrauch meldet Erfolg', Player.consume('shuffle') === true);
  check('Vorrat sinkt', Player.countOf('shuffle') === start - 1);

  while (Player.countOf('shuffle') > 0) Player.consume('shuffle');

  check('Leerer Vorrat meldet Fehlschlag', Player.consume('shuffle') === false);
  check('Vorrat bleibt bei null', Player.countOf('shuffle') === 0);
}

/* ========================================================================= */
section('Kaputte Spielstaende');
/* ========================================================================= */

{
  /* Ein manipulierter oder halb geschriebener Eintrag darf das Spiel nicht
     lahmlegen — alles Unsinnige faellt auf sinnvolle Werte zurueck. */
  loadWith({ crystals: 'viele', lives: 999, day: 42, powerups: { hammer: -5, shuffle: 'x' } });

  const p = Player.snapshot();
  check('Unsinnige Kristalle werden zu null', p.crystals === 0, String(p.crystals));
  check('Zu viele Leben werden gekappt', p.lives === CONFIG.LIVES_CAP, String(p.lives));
  check('Negativer Vorrat wird zu null', p.powerups.hammer === 0, String(p.powerups.hammer));
  check('Unsinniger Vorrat faellt auf den Startwert',
    p.powerups.shuffle === CONFIG.STARTING_POWERUPS.shuffle, String(p.powerups.shuffle));
}

{
  global.localStorage.setItem(KEY, '{kein json');
  const p = Player.load();
  check('Kaputtes JSON ergibt ein frisches Profil', p.lives === CONFIG.MAX_LIVES);
}

{
  global.localStorage.setItem(KEY, 'null');
  const p = Player.load();
  check('null im Speicher ergibt ein frisches Profil', p.crystals === 0);
}

/* ========================================================================= */

console.log(`\n${passed} bestanden, ${failed} fehlgeschlagen`);
process.exit(failed > 0 ? 1 : 0);
