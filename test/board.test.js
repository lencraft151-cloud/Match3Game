#!/usr/bin/env node
/* ==========================================================================
   Board-Tests — laufen ohne Browser und ohne Test-Framework.

       node test/board.test.js

   Geprueft wird die Spiellogik aus js/board.js: Startfelder, Match-Erkennung,
   Spezialsteine, Kettenreaktionen, Felsen, Schwerkraft und Sackgassen.
   ========================================================================== */

'use strict';

const { Board, SPECIAL } = require('../js/board.js');
const Utils = require('../js/utils.js');

let passed = 0;
let failed = 0;

function check(name, condition, detail) {
  if (condition) {
    passed++;
    return;
  }
  failed++;
  console.error(`  ✗ ${name}`);
  if (detail) console.error(`    ${detail}`);
}

function section(title) {
  console.log(`\n${title}`);
}

/* Baut ein Board aus einem Textlayout.
   Buchstaben A-G = Farben, '#' = Fels, '*' = Prisma, '.' = leer. */
function fromLayout(lines, colors) {
  const rows = lines.length;
  const cols = lines[0].length;
  const board = new Board({ cols, rows, colors: colors || 6, rng: Utils.makeRng(1) });

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ch = lines[r][c];
      if (ch === '.') board.set(c, r, null);
      else if (ch === '#') board.set(c, r, board.makeBlocker());
      else if (ch === '*') board.set(c, r, board.makeRainbow());
      else board.set(c, r, board.makeGem(ch.charCodeAt(0) - 65, SPECIAL.NONE));
    }
  }
  return board;
}

/* ========================================================================= */
section('Startfelder');
/* ========================================================================= */

{
  let boardsWithInitialMatch = 0;
  let boardsWithoutMove = 0;
  let blockerMismatch = 0;

  for (let seed = 1; seed <= 300; seed++) {
    const colors = 5 + (seed % 3);
    const blockers = seed % 10;
    const board = new Board({ cols: 8, rows: 8, colors, rng: Utils.makeRng(seed) });
    board.generate(blockers);

    if (board.findRuns().length) boardsWithInitialMatch++;
    if (!board.hasValidMove()) boardsWithoutMove++;

    const actualBlockers = board.cells.filter((g) => g && g.kind === 'blocker').length;
    /* placeBlockers ueberspringt Plaetze neben vorhandenen Felsen, es duerfen
       also weniger sein — aber nie mehr als angefordert. */
    if (actualBlockers > blockers) blockerMismatch++;

    if (board.cells.some((g) => g === null)) {
      check('Startfeld hat keine Luecken', false, `Seed ${seed}`);
      break;
    }
  }

  check('300 Startfelder ohne geschenktes Match', boardsWithInitialMatch === 0,
    `${boardsWithInitialMatch} Felder hatten sofort eine Kette`);
  check('300 Startfelder mit mindestens einem Zug', boardsWithoutMove === 0,
    `${boardsWithoutMove} Felder waren tot`);
  check('Nie mehr Felsen als angefordert', blockerMismatch === 0);
  check('Startfeld ist vollstaendig gefuellt', true);
}

/* ========================================================================= */
section('Match-Erkennung');
/* ========================================================================= */

{
  const board = fromLayout([
    'AABBBCCD',
    'CDCDCDCD',
    'DCDCDCDC',
    'CDCDCDCD',
    'DCDCDCDC',
    'CDCDCDCD',
    'DCDCDCDC',
    'CDCDCDCD'
  ]);

  const runs = board.findRuns();
  check('Waagerechter Dreier wird gefunden', runs.some((r) => r.dir === 'h' && r.len === 3),
    JSON.stringify(runs.map((r) => `${r.dir}${r.len}`)));
}

{
  /* Senkrechter Vierer in Spalte 0. */
  const board = fromLayout([
    'ABCDEFAB',
    'ABCDEFAB',
    'ABCDEFAB',
    'ABCDEFAB',
    'BCDEFABC',
    'CDEFABCD',
    'DEFABCDE',
    'EFABCDEF'
  ], 7);

  const clusters = board.findClusters();
  const colZero = clusters.find((cl) => cl.cells.includes(board.idx(0, 0)));

  check('Senkrechter Vierer bildet einen Cluster', !!colZero);
  check('Vierer erzeugt einen senkrechten Blitz',
    colZero && colZero.special === SPECIAL.LINE_V,
    colZero ? `special=${colZero.special}` : 'kein Cluster');
}

{
  /* L-Form: drei waagerecht plus drei senkrecht, gemeinsame Ecke oben links. */
  const board = fromLayout([
    'AAABCDEF',
    'ABCDEFAB',
    'ABCDEFAB',
    'BCDEFABC',
    'CDEFABCD',
    'DEFABCDE',
    'EFABCDEF',
    'FABCDEFA'
  ], 7);

  const clusters = board.findClusters();
  const corner = clusters.find((cl) => cl.cells.includes(board.idx(0, 0)));

  check('L-Form ergibt einen einzigen Cluster', !!corner && corner.cells.length === 5,
    corner ? `${corner.cells.length} Felder` : 'kein Cluster');
  check('L-Form erzeugt eine Bombe', corner && corner.special === SPECIAL.BOMB,
    corner ? `special=${corner.special}` : 'kein Cluster');
}

{
  /* Fuenfer waagerecht. */
  const board = fromLayout([
    'AAAAABCD',
    'BCDBCDBC',
    'CDBCDBCD',
    'DBCDBCDB',
    'BCDBCDBC',
    'CDBCDBCD',
    'DBCDBCDB',
    'BCDBCDBC'
  ]);

  const clusters = board.findClusters();
  check('Fuenfer erzeugt ein Prisma', clusters[0] && clusters[0].special === 'rainbow',
    clusters[0] ? `special=${clusters[0].special}` : 'kein Cluster');
}

{
  const board = fromLayout([
    '###AAABC',
    'BCDBCDBC',
    'CDBCDBCD',
    'DBCDBCDB',
    'BCDBCDBC',
    'CDBCDBCD',
    'DBCDBCDB',
    'BCDBCDBC'
  ]);

  const runs = board.findRuns();
  check('Felsen bilden keine Kette',
    runs.every((r) => r.cells.every((idx) => board.cells[idx].kind === 'gem')));
  check('Kette neben Felsen wird trotzdem erkannt', runs.some((r) => r.len === 3));
}

/* ========================================================================= */
section('Zuege und Sackgassen');
/* ========================================================================= */

{
  /* Diagonalstreifen: jeder Tausch schiebt nur die Diagonale weiter, es
     entsteht nie ein Dreier. Ein Schachbrett taugt dafuer uebrigens nicht —
     dort erzeugt ein senkrechter Tausch sofort zwei waagerechte Dreier. */
  const board = fromLayout([
    'ABCDEABC',
    'BCDEABCD',
    'CDEABCDE',
    'DEABCDEA',
    'EABCDEAB',
    'ABCDEABC',
    'BCDEABCD',
    'CDEABCDE'
  ], 5);

  check('Diagonalmuster hat keinen gueltigen Zug', !board.hasValidMove());

  const shuffled = board.shuffle();
  check('shuffle() macht das Feld wieder spielbar', shuffled && board.hasValidMove());
  check('shuffle() hinterlaesst keine fertige Kette', board.findRuns().length === 0);
}

{
  /* countMoves zaehlt dasselbe, was findHint findet — nur eben alles. */
  const board = new Board({ cols: 8, rows: 8, colors: 6, rng: Utils.makeRng(99) });
  board.generate(0);

  const count = board.countMoves();
  check('countMoves() findet mindestens einen Zug', count >= 1, String(count));
  check('countMoves() passt zu hasValidMove()',
    (count > 0) === board.hasValidMove());

  /* Von Hand nachzaehlen und vergleichen. */
  let manual = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const i = board.idx(c, r);
      if (c < 7 && board.swapWouldScore(i, i + 1)) manual++;
      if (r < 7 && board.swapWouldScore(i, i + 8)) manual++;
    }
  }
  check('countMoves() stimmt mit der Handzaehlung ueberein', count === manual,
    `${count} vs ${manual}`);
}

{
  /* Das Mischen-Power-Up verlangt mehrere Zuege, nicht bloss irgendeinen. */
  let short = 0;

  for (let seed = 1; seed <= 40; seed++) {
    const board = new Board({ cols: 8, rows: 8, colors: 6, rng: Utils.makeRng(seed * 77) });
    board.generate(0);
    board.shuffle(4);
    if (board.countMoves() < 4) short++;
  }

  check('shuffle(4) stellt in der Regel vier Zuege her', short <= 2,
    `${short} von 40 Versuchen blieben darunter`);

  /* Auch mit unerfuellbarem Anspruch darf es nie ein totes Feld hinterlassen. */
  const tight = new Board({ cols: 8, rows: 8, colors: 6, rng: Utils.makeRng(4242) });
  tight.generate(0);
  tight.shuffle(999);
  check('Unerfuellbarer Anspruch liefert trotzdem ein spielbares Feld',
    tight.hasValidMove());
}

{
  const board = fromLayout([
    'AABCDEFA',
    'BCDEFABC',
    'ACDEFABC',
    'BCDEFABC',
    'CDEFABCD',
    'DEFABCDE',
    'EFABCDEF',
    'FABCDEFA'
  ], 7);

  const hint = board.findHint();
  check('findHint() findet einen Zug', hint !== null);

  if (hint) {
    board.swap(hint.a, hint.b);
    const scores = board.hasMatchAt(board.colOf(hint.a), board.rowOf(hint.a)) ||
                   board.hasMatchAt(board.colOf(hint.b), board.rowOf(hint.b));
    check('Der vorgeschlagene Zug trifft wirklich', scores);
    board.swap(hint.a, hint.b);
  }
}

{
  const board = fromLayout([
    'A*BCDEFA',
    'BCDEFABC',
    'CDEFABCD',
    'DEFABCDE',
    'EFABCDEF',
    'FABCDEFA',
    'ABCDEFAB',
    'BCDEFABC'
  ], 7);

  check('Prisma laesst sich immer tauschen',
    board.swapWouldScore(board.idx(1, 0), board.idx(0, 0)));

  const blocked = fromLayout([
    'A#BCDEFA',
    'BCDEFABC',
    'CDEFABCD',
    'DEFABCDE',
    'EFABCDEF',
    'FABCDEFA',
    'ABCDEFAB',
    'BCDEFABC'
  ], 7);

  check('Fels laesst sich nicht tauschen',
    !blocked.canSwap(blocked.idx(1, 0), blocked.idx(0, 0)));
}

/* ========================================================================= */
section('Explosionen');
/* ========================================================================= */

{
  const board = fromLayout([
    'ABCDEFAB',
    'BCDEFABC',
    'CDEFABCD',
    'DEFABCDE',
    'EFABCDEF',
    'FABCDEFA',
    'ABCDEFAB',
    'BCDEFABC'
  ], 7);

  const idx = board.idx(3, 3);
  board.cells[idx].special = SPECIAL.LINE_H;

  const blast = board.resolveBlast([idx], {});
  check('Blitz raeumt die ganze Zeile', blast.cleared.length === 8,
    `${blast.cleared.length} Felder`);
  check('Blitz meldet genau eine Zuendung', blast.activations.length === 1);
}

{
  const board = fromLayout([
    'ABCDEFAB',
    'BCDEFABC',
    'CDEFABCD',
    'DEFABCDE',
    'EFABCDEF',
    'FABCDEFA',
    'ABCDEFAB',
    'BCDEFABC'
  ], 7);

  const a = board.idx(3, 3);
  const b = board.idx(6, 3);
  board.cells[a].special = SPECIAL.LINE_H;   /* raeumt Zeile 3 */
  board.cells[b].special = SPECIAL.LINE_V;   /* liegt in Zeile 3, raeumt Spalte 6 */

  const blast = board.resolveBlast([a], {});
  check('Getroffener Spezialstein zuendet mit', blast.activations.length === 2,
    `${blast.activations.length} Zuendungen`);
  check('Kettenreaktion raeumt Zeile und Spalte', blast.cleared.length === 8 + 7,
    `${blast.cleared.length} Felder`);
}

{
  const board = fromLayout([
    'ABCDEFAB',
    'BCDEFABC',
    'CDEFABCD',
    'DEFABCDE',
    'EFABCDEF',
    'FABCDEFA',
    'ABCDEFAB',
    'BCDEFABC'
  ], 7);

  const idx = board.idx(4, 4);
  board.cells[idx].special = SPECIAL.BOMB;

  const blast = board.resolveBlast([idx], {});
  check('Bombe raeumt 3x3', blast.cleared.length === 9, `${blast.cleared.length} Felder`);
}

{
  const board = fromLayout([
    'AB*DEFAB',
    'BADEFABC',
    'ADEFABCD',
    'DEFABCDE',
    'EFABCDEF',
    'FABCDEFA',
    'ABCDEFAB',
    'BCDEFABC'
  ], 7);

  const rainbowIdx = board.idx(2, 0);
  const countA = board.cells.filter((g) => g && g.kind === 'gem' && g.type === 0).length;

  const blast = board.resolveBlast([rainbowIdx], { [rainbowIdx]: 0 });
  /* Alle A-Steine plus das Prisma selbst. */
  check('Prisma raeumt alle Steine der Zielfarbe', blast.cleared.length === countA + 1,
    `${blast.cleared.length} statt ${countA + 1}`);
}

{
  const board = fromLayout([
    'AAABCDEF',
    'B#CDEFAB',
    'CDEFABCD',
    'DEFABCDE',
    'EFABCDEF',
    'FABCDEFA',
    'ABCDEFAB',
    'BCDEFABC'
  ], 7);

  const seeds = [board.idx(0, 0), board.idx(1, 0), board.idx(2, 0)];
  const blast = board.resolveBlast(seeds, {});

  check('Fels neben einem Treffer zerbricht',
    blast.blockers.includes(board.idx(1, 1)),
    `blockers=${JSON.stringify(blast.blockers)}`);
  check('Fels zaehlt nicht als geraeumter Stein',
    !blast.cleared.includes(board.idx(1, 1)));
}

/* ========================================================================= */
section('Schwerkraft');
/* ========================================================================= */

{
  const board = new Board({ cols: 8, rows: 8, colors: 6, rng: Utils.makeRng(42) });
  board.generate(0);

  /* Eine ganze Spalte leeren. */
  const removed = [];
  for (let r = 0; r < 8; r++) removed.push(board.idx(3, r));
  board.remove(removed);

  const moves = board.applyGravity();

  check('Nach der Schwerkraft ist das Feld wieder voll',
    board.cells.every((g) => g !== null));
  check('Geleerte Spalte wird komplett nachgefuellt',
    moves.filter((m) => m.col === 3 && m.spawned).length === 8,
    `${moves.filter((m) => m.col === 3 && m.spawned).length} neue Steine`);
  check('Neue Steine starten oberhalb des Feldes',
    moves.filter((m) => m.spawned).every((m) => m.fromRow < 0));
}

{
  const board = new Board({ cols: 8, rows: 8, colors: 6, rng: Utils.makeRng(7) });
  board.generate(0);

  /* Loch in der Mitte einer Spalte: alles darueber muss genau eins fallen. */
  const hole = board.idx(2, 5);
  const above = board.cells[board.idx(2, 4)];
  board.remove([hole]);

  board.applyGravity();
  check('Stein ueber dem Loch rutscht genau ein Feld nach unten',
    board.cells[hole] === above);
}

/* ========================================================================= */
section('Dauerlauf');
/* ========================================================================= */

{
  /* Spielt viele Zuege am Stueck und prueft nach jedem Schritt, dass das
     Feld konsistent bleibt und nie ohne Zug dasteht. */
  const board = new Board({ cols: 8, rows: 8, colors: 6, rng: Utils.makeRng(2024) });
  board.generate(4);

  let moves = 0;
  let cascades = 0;
  let shuffles = 0;
  let broken = null;

  for (let step = 0; step < 600 && !broken; step++) {
    const hint = board.findHint();

    if (!hint) {
      if (!board.shuffle()) { broken = 'shuffle() konnte das Feld nicht retten'; break; }
      shuffles++;
      continue;
    }

    board.swap(hint.a, hint.b);
    moves++;

    /* Kaskaden ausspielen, bis nichts mehr trifft. */
    for (let chain = 0; chain < 30; chain++) {
      const clusters = board.findClusters();
      if (!clusters.length) break;
      cascades++;

      const seeds = [];
      clusters.forEach((cl) => cl.cells.forEach((idx) => seeds.push(idx)));

      const blast = board.resolveBlast(seeds, {});
      board.remove(blast.cleared.concat(blast.blockers));
      board.applyGravity();

      if (board.cells.some((g) => g === null)) {
        broken = `Luecke nach der Schwerkraft in Schritt ${step}`;
        break;
      }
    }

    if (board.cells.length !== 64) broken = 'Feldgroesse hat sich veraendert';
  }

  check('600 Schritte ohne Inkonsistenz', broken === null, broken || '');
  check('Es wurden tatsaechlich Zuege gespielt', moves > 100, `${moves} Zuege`);
  console.log(`  (${moves} Zuege, ${cascades} Ketten, ${shuffles} Mischungen)`);
}

/* ========================================================================= */
section('Namen bereinigen');
/* ========================================================================= */

{
  check('Leerer Name wird ersetzt', Utils.sanitizeName('') === 'Spieler');
  check('Name wird auf 16 Zeichen gekuerzt',
    Utils.sanitizeName('abcdefghijklmnopqrstuvwxyz').length === 16);
  check('Steuerzeichen fliegen raus',
    Utils.sanitizeName('Ha\u0000ll\u0000o') === 'Hallo',
    JSON.stringify(Utils.sanitizeName('Ha\u0000ll\u0000o')));
  check('Umlaute bleiben erhalten', Utils.sanitizeName('Jürgen') === 'Jürgen');
  check('Nur-Leerzeichen wird ersetzt', Utils.sanitizeName('    ') === 'Spieler');
}

/* ========================================================================= */

console.log(`\n${passed} bestanden, ${failed} fehlgeschlagen`);
process.exit(failed > 0 ? 1 : 0);
