#!/usr/bin/env node
/* ==========================================================================
   Balance-Messung — wie oft schafft ein Bot die Level?

       node test/balance.js            Level 1 bis 30, je 40 Versuche
       node test/balance.js 1 20 100   Level 1 bis 20, je 100 Versuche

   Der Bot spielt stur den erstbesten gueltigen Zug, plant also gar nichts.
   Ein Mensch spielt deutlich besser. Zielkorridor fuer diese Messung ist
   daher rund 60 bis 85 Prozent: darunter ist ein Level frustrierend, darueber
   laeuft es von allein durch.

   Wichtig: Die Schleife hier bildet die Regeln aus js/game.js nach
   (Zugabzug, Kaskadenmultiplikator, Spezialsteine, Fortschritt). Sie ist
   kein Ersatz fuer den Playwright-Durchlauf, sondern die einzige Moeglichkeit,
   Tausende Versuche in vertretbarer Zeit zu spielen.
   ========================================================================== */

'use strict';

const { Board, SPECIAL } = require('../js/board.js');
const Utils = require('../js/utils.js');
const CONFIG = require('../js/config.js');
const Goals = require('../js/goals.js');
const Levels = require('../js/levels.js');

const FROM = parseInt(process.argv[2], 10) || 1;
const TO = parseInt(process.argv[3], 10) || 30;
const TRIES = parseInt(process.argv[4], 10) || 40;

/* Spielt ein Level einmal komplett durch. */
function playLevel(def, seed) {
  const board = new Board({
    cols: CONFIG.COLS, rows: CONFIG.ROWS,
    colors: def.colors, rng: Utils.makeRng(seed)
  });
  board.generate(def.blockers);

  const progress = Goals.newProgress(def.colors);
  let moves = def.moves;
  let score = 0;
  let shuffles = 0;

  while (moves > 0 && !Goals.allDone(def.goals, progress)) {
    const hint = board.findHint();
    if (!hint) {
      if (++shuffles > 40) break;
      board.shuffle();
      continue;
    }

    board.swap(hint.a, hint.b);
    moves--;

    /* Nur der erste Durchlauf kennt die Tauschposition — dort entsteht der
       Spezialstein, danach in der Mitte der Kette. */
    let swapA = hint.a;
    let swapB = hint.b;
    let cascade = 0;

    for (let guard = 0; guard < 40; guard++) {
      const clusters = board.findClusters();
      if (!clusters.length) break;
      cascade++;

      const births = [];
      clusters.forEach((cluster) => {
        if (cluster.special === SPECIAL.NONE) return;

        let idx = cluster.cells[Math.floor(cluster.cells.length / 2)];
        if (cluster.cells.indexOf(swapA) >= 0) idx = swapA;
        else if (cluster.cells.indexOf(swapB) >= 0) idx = swapB;

        births.push({
          idx,
          rainbow: cluster.special === 'rainbow',
          special: cluster.special === 'rainbow' ? SPECIAL.NONE : cluster.special,
          type: cluster.type
        });
      });

      const seeds = [];
      clusters.forEach((cluster) => cluster.cells.forEach((i) => seeds.push(i)));

      const blast = board.resolveBlast(seeds, {});

      score += blast.cleared.length * def.pointsPerGem * cascade +
        blast.blockers.length * CONFIG.POINTS_BLOCKER +
        births.length * CONFIG.POINTS_SPECIAL_CREATE;

      /* Fortschritt vor dem Raeumen zaehlen — danach sind die Farben weg. */
      blast.cleared.forEach((i) => {
        const gem = board.cells[i];
        if (gem && gem.kind === 'gem' && progress.colors[gem.type] !== undefined) {
          progress.colors[gem.type]++;
        }
      });
      progress.blockers += blast.blockers.length;
      progress.score = score;

      board.remove(blast.cleared.concat(blast.blockers));

      births.forEach((b) => {
        board.cells[b.idx] = b.rainbow
          ? board.makeRainbow()
          : board.makeGem(b.type, b.special);
      });

      board.applyGravity();

      swapA = -1;
      swapB = -1;
    }
  }

  return {
    won: Goals.allDone(def.goals, progress),
    movesLeft: moves,
    score,
    progress
  };
}

/* ========================================================================= */

console.log(`Level ${FROM}–${TO}, je ${TRIES} Versuche\n`);
console.log('Lvl  Ziel                                Zg  Quote  ØRest  Ø% je Aufgabe');
console.log('-'.repeat(84));

const tooHard = [];
const tooEasy = [];

for (let n = FROM; n <= TO; n++) {
  const def = Levels.get(n);

  let wins = 0;
  let restSum = 0;
  const goalRatios = def.goals.map(() => 0);

  for (let t = 0; t < TRIES; t++) {
    const result = playLevel(def, n * 100000 + t * 7919);
    if (result.won) {
      wins++;
      restSum += result.movesLeft;
    }
    def.goals.forEach((goal, gi) => {
      goalRatios[gi] += Goals.currentOf(goal, result.progress) / goal.count;
    });
  }

  const rate = wins / TRIES;
  const avgRest = wins ? (restSum / wins) : 0;

  /* Im Terminal gibt es keine gezeichneten Steine — hier steht der Name der
     Aufgabe, den Goals.label ohnehin liefert. */
  const desc = def.goals
    .map((g) => Goals.label(g).split(' ')[0] + ' ' + g.count)
    .join(' + ');

  const ratios = goalRatios
    .map((r) => Math.round((r / TRIES) * 100) + '%')
    .join(' ');

  let flag = '  ';
  if (rate < 0.55) { flag = '!!'; tooHard.push(n); }
  else if (rate > 0.9) { flag = '..'; tooEasy.push(n); }

  console.log(
    String(n).padStart(3) + '  ' +
    desc.padEnd(34).slice(0, 34) + '  ' +
    String(def.moves).padStart(2) + '  ' +
    (Math.round(rate * 100) + '%').padStart(5) + flag + ' ' +
    avgRest.toFixed(1).padStart(5) + '  ' + ratios
  );
}

console.log('-'.repeat(84));
console.log('!! zu schwer (<55 %): ' + (tooHard.join(', ') || 'keine'));
console.log('.. zu leicht (>90 %): ' + (tooEasy.join(', ') || 'keine'));
