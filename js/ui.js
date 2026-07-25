/* ==========================================================================
   UI — Screens, HUD und Bestenlisten-Darstellung.

   Kennt das Spiel nicht: game.js meldet ueber Hooks, was passiert ist, und
   main.js verdrahtet beides. Namen aus der Bestenliste landen ausschliesslich
   ueber textContent im DOM — nie ueber innerHTML.
   ========================================================================== */

(function (root) {
  'use strict';

  var Utils = root.M3.Utils;
  var Leaderboard = root.M3.Leaderboard;

  var doc = root.document;

  function $(id) {
    return doc.getElementById(id);
  }

  var UI = {};

  var els = {};
  var currentScreen = 'screen-start';
  var scoreTab = 'online';
  var highlightEntry = null;   /* zuletzt eingetragener Score */

  /* Letzter angezeigter Stand — verhindert DOM-Schreibzugriffe in jedem
     einzelnen Frame, das HUD aendert sich schliesslich nur selten. */
  var shown = { level: -1, score: -1, goal: -1, target: -1, seconds: -1 };

  UI.init = function () {
    els.screens = Array.prototype.slice.call(doc.querySelectorAll('.screen'));

    els.hudLevel = $('hud-level');
    els.hudScore = $('hud-score');
    els.goalFill = $('goal-fill');
    els.goalText = $('goal-text');
    els.timeMeter = $('time-meter');
    els.timeFill = $('time-fill');
    els.timeText = $('time-text');
    els.hint = $('game-hint');

    els.startBest = $('start-best');
    els.btnContinue = $('btn-continue');
    els.continueLevel = $('continue-level');

    els.lvlScore = $('lvl-score');
    els.lvlBonus = $('lvl-bonus');
    els.lvlCarry = $('lvl-carry');
    els.lvlTotal = $('lvl-total');
    els.lvlNextNum = $('lvl-next-num');

    els.overScore = $('over-score');
    els.overLevel = $('over-level');
    els.overNote = $('over-note');
    els.scoreForm = $('score-form');
    els.nameInput = $('name-input');
    els.btnSubmit = $('btn-submit');
    els.submitState = $('submit-state');

    els.scoreList = $('score-list');
    els.offlineBadge = $('offline-badge');
    els.tabs = doc.querySelector('.tabs');
    els.tabOnline = $('tab-online');
    els.tabLocal = $('tab-local');

    els.nameInput.value = Leaderboard.rememberedName();
    UI.refreshBest();
  };

  /* ------------------------------------------------------------- Screens */

  UI.show = function (id) {
    els.screens.forEach(function (screen) {
      screen.classList.toggle('is-active', screen.id === id);
    });
    currentScreen = id;
  };

  /* Overlays legen sich ueber das Spielfeld, statt es zu ersetzen. */
  UI.overlay = function (id, visible) {
    var el = $(id);
    if (el) el.classList.toggle('is-active', !!visible);
  };

  UI.current = function () {
    return currentScreen;
  };

  /* ----------------------------------------------------------------- HUD */

  UI.updateStats = function (s) {
    if (s.level !== shown.level) {
      shown.level = s.level;
      els.hudLevel.textContent = s.level;
    }

    if (s.score !== shown.score) {
      /* Kurzer Puls, sobald sich die Punktzahl aendert. */
      if (s.score > shown.score && shown.score >= 0) {
        els.hudScore.classList.remove('is-bumped');
        void els.hudScore.offsetWidth;
        els.hudScore.classList.add('is-bumped');
      }
      shown.score = s.score;
      els.hudScore.textContent = Utils.formatNumber(s.score);
    }

    /* Die Balkenbreite haengt an der gerundeten Prozentzahl, der Text am
       Punktestand selbst — sonst bleibt "1.250 / 12.000" stehen, wenn ein
       Treffer den Balken um weniger als ein Prozent bewegt. */
    if (s.levelScore !== shown.goal || s.target !== shown.target) {
      shown.goal = s.levelScore;
      shown.target = s.target;
      var goalRatio = s.target > 0 ? Utils.clamp(s.levelScore / s.target, 0, 1) : 0;
      els.goalFill.style.width = Math.round(goalRatio * 100) + '%';
      els.goalText.textContent = Utils.formatNumber(s.levelScore) + ' / ' + Utils.formatNumber(s.target);
    }

    var seconds = Math.ceil(Math.max(0, s.timeLeft));
    var timeRatio = s.timeTotal > 0 ? Utils.clamp(s.timeLeft / s.timeTotal, 0, 1) : 0;

    /* Der Balken laeuft fluessig mit, der Text nur sekundenweise. */
    els.timeFill.style.width = (timeRatio * 100) + '%';

    if (seconds !== shown.seconds) {
      shown.seconds = seconds;
      els.timeText.textContent = Utils.formatTime(s.timeLeft);
      els.timeMeter.classList.toggle('is-low', s.timeLeft <= 20 && s.timeLeft > 10);
      els.timeMeter.classList.toggle('is-critical', s.timeLeft <= 10);
    }
  };

  UI.resetStatCache = function () {
    shown = { level: -1, score: -1, goal: -1, target: -1, seconds: -1 };
  };

  UI.setHint = function (text, warn) {
    els.hint.textContent = text;
    els.hint.classList.toggle('is-warn', !!warn);
  };

  UI.refreshBest = function () {
    els.startBest.textContent = Utils.formatNumber(Leaderboard.localBest());
  };

  UI.setContinue = function (level) {
    var show = level > 1;
    els.btnContinue.hidden = !show;
    if (show) els.continueLevel.textContent = level;
  };

  /* -------------------------------------------------------- Level fertig */

  UI.showLevelComplete = function (data) {
    els.lvlScore.textContent = Utils.formatNumber(data.levelScore);
    els.lvlBonus.textContent = '+' + Utils.formatNumber(data.bonus);
    els.lvlCarry.textContent = '+' + data.carry.toFixed(1) + 's';
    els.lvlTotal.textContent = Utils.formatNumber(data.total);
    els.lvlNextNum.textContent = data.nextLevel;
    UI.overlay('screen-level', true);
  };

  /* ----------------------------------------------------------- Game Over */

  UI.showGameOver = function (data, isRecord) {
    els.overScore.textContent = Utils.formatNumber(data.score);
    els.overLevel.textContent = data.level;
    els.overNote.textContent = isRecord ? 'Neuer persönlicher Rekord!' : 'Bestleistung: ' +
      Utils.formatNumber(Leaderboard.localBest());

    els.scoreForm.hidden = false;
    els.submitState.hidden = true;
    els.submitState.textContent = '';
    els.submitState.className = 'submit-state';
    els.btnSubmit.disabled = false;

    if (!els.nameInput.value) els.nameInput.value = Leaderboard.rememberedName();

    UI.overlay('screen-over', true);
  };

  UI.setSubmitState = function (text, kind) {
    els.submitState.hidden = false;
    els.submitState.textContent = text;
    els.submitState.className = 'submit-state' + (kind ? ' is-' + kind : '');
  };

  UI.lockSubmit = function () {
    els.btnSubmit.disabled = true;
    els.scoreForm.hidden = true;
  };

  UI.nameValue = function () {
    return els.nameInput.value;
  };

  /* --------------------------------------------------------- Bestenliste */

  /* Ohne konfigurierten Server gibt es nichts zu wechseln: zwei Tabs mit
     identischem Inhalt wuerden nur verwirren. Dann bleibt die lokale Liste,
     und das Badge erklaert, warum. */
  UI.prepareScoreScreen = function () {
    var online = Leaderboard.isConfigured();
    els.tabs.hidden = !online;
    UI.setScoreTab(online ? 'online' : 'local');
  };

  UI.setScoreTab = function (tab) {
    scoreTab = tab;
    els.tabOnline.classList.toggle('is-active', tab === 'online');
    els.tabLocal.classList.toggle('is-active', tab === 'local');
    els.tabOnline.setAttribute('aria-selected', String(tab === 'online'));
    els.tabLocal.setAttribute('aria-selected', String(tab === 'local'));
  };

  UI.highlight = function (entry) {
    highlightEntry = entry;
  };

  UI.loadScores = function () {
    els.scoreList.textContent = '';
    var loading = doc.createElement('li');
    loading.className = 'scores__empty';
    loading.textContent = 'Lade…';
    els.scoreList.appendChild(loading);

    if (scoreTab === 'local') {
      /* Ohne Server ist "lokal" die einzige Liste — dann erklaert das Badge,
         warum. Mit Server ist der Lokal-Tab eine bewusste Wahl und braucht
         keinen Hinweis. */
      els.offlineBadge.hidden = Leaderboard.isConfigured();
      els.offlineBadge.textContent = 'Offline — zeigt die lokale Bestenliste';
      renderList(Leaderboard.localEntries().slice(0, root.M3.CONFIG.SCORE_LIMIT));
      return Promise.resolve();
    }

    return Leaderboard.fetchTop().then(function (result) {
      els.offlineBadge.hidden = result.online;
      els.offlineBadge.textContent = 'Server nicht erreichbar — zeigt die lokale Bestenliste';
      renderList(result.entries);
    });
  };

  function renderList(entries) {
    els.scoreList.textContent = '';

    if (!entries.length) {
      var empty = doc.createElement('li');
      empty.className = 'scores__empty';
      empty.textContent = 'Noch keine Einträge — spiel die erste Runde!';
      els.scoreList.appendChild(empty);
      return;
    }

    entries.forEach(function (entry, i) {
      var row = doc.createElement('li');
      row.className = 'scores__row' + (i < 3 ? ' scores__row--' + (i + 1) : '');

      if (isHighlighted(entry)) row.className += ' scores__row--me';
      row.style.animationDelay = Math.min(i * 0.035, 0.5) + 's';

      var rank = doc.createElement('span');
      rank.className = 'scores__rank';
      rank.textContent = '#' + (i + 1);

      var name = doc.createElement('span');
      name.className = 'scores__name';
      name.textContent = entry.name;

      var meta = doc.createElement('span');
      meta.className = 'scores__meta';
      meta.textContent = 'Level ' + entry.level +
        (entry.ts ? ' · ' + Utils.relativeTime(entry.ts) : '');
      name.appendChild(meta);

      var pts = doc.createElement('span');
      pts.className = 'scores__pts';
      pts.textContent = Utils.formatNumber(entry.score);

      row.appendChild(rank);
      row.appendChild(name);
      row.appendChild(pts);
      els.scoreList.appendChild(row);
    });
  }

  function isHighlighted(entry) {
    return highlightEntry
      && entry.name === highlightEntry.name
      && entry.score === highlightEntry.score;
  }

  root.M3.UI = UI;

})(typeof globalThis !== 'undefined' ? globalThis : this);
