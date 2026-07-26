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
    p.powerups.moves === CONFIG.STARTING_POWERUPS.moves,
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
  loadWith({ crystals: 10, lives: 0, day: yesterdayKey(),
    powerups: { bomb: 0, rocket: 0, shuffle: 0, moves: 0 } });

  const p = Player.snapshot();
  check('Neuer Tag stellt die Leben her', p.lives === CONFIG.MAX_LIVES, String(p.lives));
  check('Kristalle ueberleben den Tageswechsel', p.crystals === 10);
  check('Power-Ups ueberleben den Tageswechsel',
    p.powerups.bomb === 0 && p.powerups.shuffle === 0);
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
section('Herz-Nachfuell-Timer');
/* ========================================================================= */

const HALF_HOUR = CONFIG.LIFE_REGEN_MS;

{
  /* Volle Leben: die Uhr laeuft gar nicht erst. */
  fresh();
  const p = Player.snapshot();
  check('Bei vollen Leben laeuft keine Uhr', p.nextRegenAt === 0, String(p.nextRegenAt));
  check('Kein Countdown bei vollen Leben', p.msToNextLife === 0);
}

{
  /* Ein verlorenes Level startet die Uhr. */
  fresh();
  Player.loseLife();

  const p = Player.snapshot();
  check('Fehlendes Herz startet die Uhr', p.nextRegenAt > 0);
  check('Countdown liegt bei rund 30 Minuten',
    p.msToNextLife > HALF_HOUR - 5000 && p.msToNextLife <= HALF_HOUR,
    String(p.msToNextLife));
}

{
  /* Ein faelliges Fenster gibt genau ein Herz. */
  loadWith({
    crystals: 0, lives: 2, day: stored() ? stored().day : undefined,
    nextRegenAt: Date.now() - 1000, powerups: {}
  });

  check('Faelliges Fenster gibt ein Herz', Player.snapshot().lives === 3,
    String(Player.snapshot().lives));
  check('Danach laeuft die Uhr weiter', Player.snapshot().nextRegenAt > 0);
}

{
  /* Mehrere Fenster auf einmal — Tab war lange zu. */
  const today = (() => { fresh(); return stored().day; })();
  loadWith({
    crystals: 0, lives: 0, day: today,
    nextRegenAt: Date.now() - HALF_HOUR * 2.5, powerups: {}
  });

  check('Drei vergangene Fenster geben drei Herzen',
    Player.snapshot().lives === 3, String(Player.snapshot().lives));
}

{
  /* Deckel bei MAX_LIVES, egal wie viel Zeit vergangen ist. */
  const today = (() => { fresh(); return stored().day; })();
  loadWith({
    crystals: 0, lives: 1, day: today,
    nextRegenAt: Date.now() - HALF_HOUR * 50, powerups: {}
  });

  const p = Player.snapshot();
  check('Nachfuellen stoppt beim Maximum', p.lives === CONFIG.MAX_LIVES, String(p.lives));
  check('Bei vollem Stand wird die Uhr abgeschaltet', p.nextRegenAt === 0);
}

{
  /* Gekaufte Extraleben ueber dem Maximum werden nicht angefasst. */
  const today = (() => { fresh(); return stored().day; })();
  const extra = CONFIG.MAX_LIVES + 3;
  loadWith({
    crystals: 0, lives: extra, day: today,
    nextRegenAt: Date.now() - HALF_HOUR * 10, powerups: {}
  });

  check('Extraleben bleiben unangetastet', Player.snapshot().lives === extra,
    String(Player.snapshot().lives));
  check('Und die Uhr laeuft nicht', Player.snapshot().nextRegenAt === 0);
}

{
  /* Noch nicht faellig: nichts passiert. */
  const today = (() => { fresh(); return stored().day; })();
  loadWith({
    crystals: 0, lives: 2, day: today,
    nextRegenAt: Date.now() + HALF_HOUR * 0.5, powerups: {}
  });

  check('Vor Ablauf kommt kein Herz dazu', Player.snapshot().lives === 2);
}

{
  /* Der Tageswechsel gewinnt gegen die Uhr: morgens sind es wieder fuenf,
     auch wenn erst ein Fenster vergangen waere. */
  loadWith({
    crystals: 0, lives: 0, day: yesterdayKey(),
    nextRegenAt: Date.now() + HALF_HOUR, powerups: {}
  });

  const p = Player.snapshot();
  check('Mitternacht fuellt trotz laufender Uhr komplett auf',
    p.lives === CONFIG.MAX_LIVES, String(p.lives));
  check('Und stellt die Uhr ab', p.nextRegenAt === 0);
}

/* ========================================================================= */
section('Kristalle');
/* ========================================================================= */

{
  fresh();

  const base = CONFIG.CRYSTALS_BASE + CONFIG.CRYSTALS_PER_LEVEL;
  check('Level 1 ohne Sterne', Player.crystalsForLevel(1, 0) === base,
    String(Player.crystalsForLevel(1, 0)));

  check('Jeder Stern zahlt sich aus',
    Player.crystalsForLevel(1, 3) === base + 3 * CONFIG.CRYSTALS_PER_STAR,
    String(Player.crystalsForLevel(1, 3)));

  check('Hoehere Level bringen mehr',
    Player.crystalsForLevel(5, 0) > Player.crystalsForLevel(1, 0));

  check('Mehr als drei Sterne zaehlen nicht',
    Player.crystalsForLevel(1, 99) === Player.crystalsForLevel(1, 3));

  check('Unsinnige Sternzahl faellt auf null',
    Player.crystalsForLevel(1, -5) === base);

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

  const broke = Player.buyPowerUp('bomb');
  check('Ohne Guthaben kein Power-Up', !broke.ok);

  Player.earn(CONFIG.PRICE_BOMB);
  const start = Player.countOf('bomb');
  const bought = Player.buyPowerUp('bomb');

  check('Power-Up gekauft', bought.ok);
  check('Vorrat gewachsen', Player.countOf('bomb') === start + 1);
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
  loadWith({ crystals: 'viele', lives: 999, day: 42, powerups: { bomb: -5, shuffle: 'x' } });

  const p = Player.snapshot();
  check('Unsinnige Kristalle werden zu null', p.crystals === 0, String(p.crystals));
  check('Zu viele Leben werden gekappt', p.lives === CONFIG.LIVES_CAP, String(p.lives));
  check('Negativer Vorrat wird zu null', p.powerups.bomb === 0, String(p.powerups.bomb));
  check('Unsinniger Vorrat faellt auf den Startwert',
    p.powerups.shuffle === CONFIG.STARTING_POWERUPS.shuffle, String(p.powerups.shuffle));
}

{
  global.localStorage.setItem(KEY, '{kein json');
  const p = Player.load();
  check('Kaputtes JSON ergibt ein frisches Profil', p.lives === CONFIG.MAX_LIVES);
}

/* ========================================================================= */
section('Vom Hammer zur Bombe');
/* ========================================================================= */

{
  /* Der Hammer heisst jetzt Bombe. Ein alter Vorrat darf dabei nicht
     verschwinden — gekaufte Gegenstaende einfach einzuziehen waere die
     schlechteste Art, eine Umbenennung zu feiern. */
  loadWith({ crystals: 0, lives: 3, powerups: { hammer: 4, shuffle: 2, moves: 1 } });

  const p = Player.snapshot();
  check('Alter Hammer-Vorrat wird zur Bombe', p.powerups.bomb === 4,
    String(p.powerups.bomb));
  check('Die uebrigen Vorraete bleiben', p.powerups.shuffle === 2 && p.powerups.moves === 1);
  check('Die neue Rakete bekommt ihren Startwert',
    p.powerups.rocket === CONFIG.STARTING_POWERUPS.rocket, String(p.powerups.rocket));
}

{
  /* Wer schon Bomben hat, soll durch einen alten Hammer-Eintrag nichts
     verlieren — die Bombe gewinnt. */
  loadWith({ crystals: 0, lives: 3, powerups: { hammer: 4, bomb: 9 } });
  check('Vorhandene Bomben werden nicht ueberschrieben',
    Player.snapshot().powerups.bomb === 9, String(Player.snapshot().powerups.bomb));
}

/* ========================================================================= */
section('Muenzen');
/* ========================================================================= */

{
  loadWith({ crystals: 500, coins: 0, lives: 3 });

  check('Frischer Stand hat keine Muenzen', Player.snapshot().coins === 0);

  Player.earnCoins(120);
  check('Muenzen kommen dazu', Player.snapshot().coins === 120,
    String(Player.snapshot().coins));

  check('Muenzen und Kristalle sind getrennte Toepfe',
    Player.snapshot().crystals === 500, String(Player.snapshot().crystals));

  check('Zu teuer wird abgelehnt', Player.spendCoins(300) === false);
  check('Und dabei nichts abgebucht', Player.snapshot().coins === 120);

  check('Bezahlbares geht durch', Player.spendCoins(100) === true);
  check('Und wird abgebucht', Player.snapshot().coins === 20,
    String(Player.snapshot().coins));

  check('Kristalle bleiben davon unberuehrt', Player.snapshot().crystals === 500);

  Player.earnCoins(-50);
  check('Negativer Gewinn zieht nichts ab', Player.snapshot().coins === 20);

  const reward = Player.coinsForLevel(1, 3);
  check('Ein Level bringt Muenzen', reward > 0, String(reward));
  check('Mehr Sterne bringen mehr Muenzen',
    Player.coinsForLevel(1, 3) > Player.coinsForLevel(1, 1));
  check('Spaetere Level bringen mehr Muenzen',
    Player.coinsForLevel(20, 2) > Player.coinsForLevel(1, 2));
}

{
  /* Ein kaputter Muenzstand darf nicht ins Minus rutschen. */
  loadWith({ crystals: 0, lives: 3, coins: -900 });
  check('Negativer Muenzstand wird zu null', Player.snapshot().coins === 0,
    String(Player.snapshot().coins));
}

{
  global.localStorage.setItem(KEY, 'null');
  const p = Player.load();
  check('null im Speicher ergibt ein frisches Profil', p.crystals === 0);
}

/* ========================================================================= */

console.log(`\n${passed} bestanden, ${failed} fehlgeschlagen`);
process.exit(failed > 0 ? 1 : 0);
