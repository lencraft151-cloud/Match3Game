/* ==========================================================================
   Konfiguration
   ========================================================================== */

(function (root) {
  'use strict';

  var CONFIG = {

    /* ----------------------------------------------------------------------
       Online-Bestenliste
       ----------------------------------------------------------------------
       Leer lassen = das Spiel nutzt ausschliesslich die lokale Bestenliste im
       Browser und zeigt im Bestenlisten-Screen ein "Offline"-Badge.

       Zum Aktivieren hier die Basis-URL des Servers aus `server/` eintragen,
       OHNE abschliessenden Slash und OHNE `/api`, zum Beispiel:

           LEADERBOARD_API: 'https://gem-cascade.onrender.com'

       Laeuft das Spiel direkt auf dem Node-Server (er liefert auch die
       statischen Dateien aus), genuegt ein einzelner Punkt:

           LEADERBOARD_API: '.'

       Die Deploy-Anleitung steht in `server/README.md`.
       ---------------------------------------------------------------------- */
    LEADERBOARD_API: '',

    /* Nach so vielen Millisekunden gilt der Server als nicht erreichbar und
       das Spiel faellt auf die lokale Liste zurueck. */
    API_TIMEOUT_MS: 4000,

    /* Eintraege, die Online- und Lokalliste jeweils anzeigen. */
    SCORE_LIMIT: 20,

    /* --------------------------------------------------------------- Board */
    COLS: 8,
    ROWS: 8,

    /* --------------------------------------------------------------- Punkte */
    /* Grundwert eines Steins bei fuenf Farben. Ab sechs Farben rechnet
       js/levels.js ihn hoch, weil Treffer dann seltener werden. */
    POINTS_PER_GEM: 60,
    POINTS_SPECIAL_CREATE: 150,
    POINTS_BLOCKER: 120,

    /* Wie viele Zuege das Zug-Power-Up bringt. */
    POWERUP_EXTRA_MOVES: 7,

    /* Wie weit die Bombe reicht: 1 heisst das angetippte Feld plus ein Ring
       drumherum, also 3x3. Das ist spuerbar mehr als das Kreuz von frueher
       und macht den teuersten Nahkampf-Booster seinen Preis wert. */
    POWERUP_BOMB_RADIUS: 1,

    /* Mindestens so viele gueltige Zuege muss das Mischen-Power-Up
       herstellen — sonst mischt es weiter. Ein blosses "irgendein Zug geht"
       fuehlt sich an, als haette man das Power-Up verschwendet. */
    POWERUP_SHUFFLE_MIN_MOVES: 4,

    /* Angebot im Verloren-Popup: Zuege nachkaufen, statt ein Herz zu
       verlieren. Der Preis steigt mit jedem Nachkauf im selben Level, damit
       sich ein Level nicht beliebig durchkaufen laesst. */
    CONTINUE_MOVES: 5,
    CONTINUE_PRICE: 60,
    CONTINUE_PRICE_STEP: 60,

    /* ----------------------------------------------------------- Wirtschaft */

    /* Leben. Ein verlorener Lauf kostet eines; ist keines mehr da, ist fuer
       heute Schluss — es sei denn, du kaufst dir eines fuer Kristalle. */
    MAX_LIVES: 5,
    /* Obergrenze inklusive gekaufter Leben, damit sich niemand einen
       Riesenvorrat anlegt und das Tageslimit damit aushebelt. */
    LIVES_CAP: 10,

    /* Kristalle pro geschafftem Level: Grundwert, Zuschlag je Levelstufe und
       Zuschlag je Stern. Der Sternanteil ist der groesste — sparsam gespielte
       Level sollen sich spuerbar mehr lohnen als durchgewuergte.

         Level 1 mit 1 Stern   25 + 2 + 15  =  42
         Level 1 mit 3 Sternen 25 + 2 + 45  =  72
         Level 20 mit 2 Sternen 25 + 40 + 30 =  95 */
    CRYSTALS_BASE: 25,
    CRYSTALS_PER_LEVEL: 2,
    CRYSTALS_PER_STAR: 15,

    /* Muenzen fuers Einrichten — der zweite Topf, getrennt von den Kristallen.
       Ein Level bringt rund 60 bis 130 Muenzen, eine Einrichtung kostet 120
       bis 320. Ein Zimmer ist damit in etwa sechs bis zehn Leveln fertig:
       nah genug, dass man dranbleibt, weit genug, dass es sich lohnt.

         Level 1 mit 1 Stern    50 + 3 + 20   =  73
         Level 1 mit 3 Sternen  50 + 3 + 60   = 113
         Level 20 mit 2 Sternen 50 + 60 + 40  = 150 */
    COINS_BASE: 50,
    COINS_PER_LEVEL: 3,
    COINS_PER_STAR: 20,

    /* Preise im Shop.

       Die Leiter richtet sich danach, wie viel ein Posten wirklich rettet,
       nicht danach, wie stark er aussieht:

         Rakete 45     raeumt eine Reihe — gut, aber planbar ersetzbar
         Bombe 70      raeumt 3x3, der staerkste gezielte Schlag
         Extra-Zuege 90
         Mischen 140   holt aus einer Sackgasse heraus, in der sonst nichts
                       mehr geht — das ist der Posten, der ein Level rettet
         Leben 170     das knappste Gut ueberhaupt

       Ein geschafftes Level bringt rund 40 bis 95 Kristalle. Eine Rakete
       kostet also etwa ein halbes Level, ein Leben rund zwei bis drei. */
    PRICE_ROCKET: 45,
    PRICE_BOMB: 70,
    PRICE_MOVES: 90,
    PRICE_SHUFFLE: 140,
    PRICE_LIFE: 170,

    /* Startausstattung fuer neue Spieler — einmal jedes Power-Up zum
       Ausprobieren, sonst versteht niemand, wofuer die Kristalle gut sind. */
    STARTING_POWERUPS: { bomb: 1, rocket: 1, shuffle: 1, moves: 1 },

    /* --------------------------------------------------------------- Leben */
    /* Alle 30 Minuten kommt ein Herz zurueck. */
    LIFE_REGEN_MS: 30 * 60 * 1000,

    /* ------------------------------------------------------- Speicherschluessel */
    STORE_SCORES: 'gemcascade.scores.v1',
    STORE_PLAYER: 'gemcascade.player.v1',
    STORE_NAME: 'gemcascade.name.v1',
    STORE_MUTED: 'gemcascade.muted.v1',
    /* v2: Der Fortschritt wurde bewusst zurueckgesetzt, damit jeder wieder
       bei Level 1 anfaengt. Kristalle, Leben und Power-Ups haengen an einem
       eigenen Schluessel und bleiben davon unberuehrt. */
    STORE_PROGRESS: 'gemcascade.progress.v2',
    STORE_LIFETIME: 'gemcascade.lifetime.v1',
    /* Die Einrichtung haengt an einem eigenen Schluessel: ein Reset des
       Levelfortschritts soll das Schloss nicht mit abreissen. */
    STORE_ROOMS: 'gemcascade.rooms.v1',
    STORE_PENDING: 'gemcascade.pending.v1'
  };

  root.M3 = root.M3 || {};
  root.M3.CONFIG = CONFIG;

  if (typeof module !== 'undefined' && module.exports) module.exports = CONFIG;

})(typeof globalThis !== 'undefined' ? globalThis : this);
