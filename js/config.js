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

    /* Zeitgutschrift in Sekunden. Der Kaskadenanteil wird mit der
       Kaskadenstufe multipliziert, lange Ketten lohnen sich also doppelt. */
    TIME_PER_MATCH: 0.35,
    TIME_PER_CASCADE: 0.45,
    TIME_MAX_BONUS_PER_MOVE: 4,

    /* ------------------------------------------------------- Speicherschluessel */
    STORE_SCORES: 'gemcascade.scores.v1',
    STORE_NAME: 'gemcascade.name.v1',
    STORE_MUTED: 'gemcascade.muted.v1',
    STORE_PROGRESS: 'gemcascade.progress.v1',
    STORE_PENDING: 'gemcascade.pending.v1'
  };

  root.M3 = root.M3 || {};
  root.M3.CONFIG = CONFIG;

  if (typeof module !== 'undefined' && module.exports) module.exports = CONFIG;

})(typeof globalThis !== 'undefined' ? globalThis : this);
