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
    POWERUP_EXTRA_MOVES: 5,

    /* Angebot im Verloren-Popup: Zuege nachkaufen, statt ein Herz zu
       verlieren. Der Preis steigt mit jedem Nachkauf im selben Level, damit
       sich ein Level nicht beliebig durchkaufen laesst. */
    CONTINUE_MOVES: 5,
    CONTINUE_PRICE: 40,
    CONTINUE_PRICE_STEP: 30,

    /* ----------------------------------------------------------- Wirtschaft */

    /* Leben. Ein verlorener Lauf kostet eines; ist keines mehr da, ist fuer
       heute Schluss — es sei denn, du kaufst dir eines fuer Kristalle. */
    MAX_LIVES: 5,
    /* Obergrenze inklusive gekaufter Leben, damit sich niemand einen
       Riesenvorrat anlegt und das Tageslimit damit aushebelt. */
    LIVES_CAP: 10,

    /* Kristalle pro geschafftem Level: Grundwert, Zuschlag je Levelstufe und
       Zuschlag je Stern. Sparsam gespielte Level lohnen sich damit doppelt. */
    CRYSTALS_BASE: 20,
    CRYSTALS_PER_LEVEL: 3,
    CRYSTALS_PER_STAR: 12,

    /* Preise im Shop. */
    PRICE_LIFE: 60,
    PRICE_HAMMER: 40,
    PRICE_SHUFFLE: 30,
    PRICE_MOVES: 50,

    /* Startausstattung fuer neue Spieler — einmal jedes Power-Up zum
       Ausprobieren, sonst versteht niemand, wofuer die Kristalle gut sind. */
    STARTING_POWERUPS: { hammer: 1, shuffle: 1, moves: 1 },

    /* --------------------------------------------------------------- Leben */
    /* Alle 30 Minuten kommt ein Herz zurueck. */
    LIFE_REGEN_MS: 30 * 60 * 1000,

    /* ------------------------------------------------------- Speicherschluessel */
    STORE_SCORES: 'gemcascade.scores.v1',
    STORE_PLAYER: 'gemcascade.player.v1',
    STORE_NAME: 'gemcascade.name.v1',
    STORE_MUTED: 'gemcascade.muted.v1',
    STORE_PROGRESS: 'gemcascade.progress.v1',
    STORE_LIFETIME: 'gemcascade.lifetime.v1',
    STORE_PENDING: 'gemcascade.pending.v1'
  };

  root.M3 = root.M3 || {};
  root.M3.CONFIG = CONFIG;

  if (typeof module !== 'undefined' && module.exports) module.exports = CONFIG;

})(typeof globalThis !== 'undefined' ? globalThis : this);
