/* ==========================================================================
   UI — Screens, HUD, Aufgabenanzeige und Bestenliste.

   Kennt das Spiel nicht: game.js meldet ueber Hooks, was passiert ist, und
   main.js verdrahtet beides. Namen aus der Bestenliste landen ausschliesslich
   ueber textContent im DOM — nie ueber innerHTML.
   ========================================================================== */

(function (root) {
  'use strict';

  var Utils = root.M3.Utils;
  var CONFIG = root.M3.CONFIG;
  var Goals = root.M3.Goals;
  var Leaderboard = root.M3.Leaderboard;
  var Player = root.M3.Player;

  var doc = root.document;

  function $(id) {
    return doc.getElementById(id);
  }

  var UI = {};

  var els = {};
  var currentScreen = 'screen-title';
  var scoreTab = 'online';
  var highlightEntry = null;

  /* Letzter angezeigter Stand — verhindert DOM-Schreibzugriffe in jedem
     Frame. Das HUD aendert sich nur bei echten Ereignissen. */
  var shown = { level: -1, moves: -1, goalKey: '' };

  UI.init = function () {
    els.screens = Array.prototype.slice.call(doc.querySelectorAll('.screen'));

    /* Kartenkopf */
    els.hearts = $('hearts');
    els.livesNote = $('lives-note');
    els.crystals = $('crystals');
    els.helpLives = $('help-lives');

    /* Spiel-HUD */
    els.hudMoves = $('hud-moves');
    els.movesBox = $('moves-box');
    els.goalList = $('goal-list');
    els.hint = $('game-hint');

    /* Levelstart */
    els.startLevel = $('start-level');
    els.startGoals = $('start-goals');
    els.startMoves = $('start-moves');
    els.startReplay = $('start-replay');
    els.startLabel = $('start-label');
    els.startTutorialNote = $('start-tutorial-note');

    /* Gewonnen */
    els.winStars = $('win-stars');
    els.winScore = $('win-score');
    els.winMoves = $('win-moves');
    els.winCrystals = $('win-crystals');

    /* Verloren */
    els.failGoals = $('fail-goals');
    els.continueBox = $('continue-box');
    els.continueMoves = $('continue-moves');
    els.continuePrice = $('continue-price');
    els.continueState = $('continue-state');
    els.btnContinueBuy = $('btn-continue-buy');

    /* Shop */
    els.shopList = $('shop-list');
    els.shopCrystals = $('shop-crystals');
    els.shopState = $('shop-state');

    /* Bestenliste */
    els.scoreList = $('score-list');
    els.offlineBadge = $('offline-badge');
    els.tabs = doc.querySelector('.tabs');
    els.tabOnline = $('tab-online');
    els.tabLocal = $('tab-local');
    els.scoreForm = $('score-form');
    els.nameInput = $('name-input');
    els.btnSubmit = $('btn-submit');
    els.submitState = $('submit-state');
    els.submitScore = $('submit-score');

    /* Power-Leiste */
    els.powerButtons = {
      hammer: $('pw-hammer'),
      shuffle: $('pw-shuffle'),
      moves: $('pw-moves')
    };
    els.powerCounts = {
      hammer: $('count-hammer'),
      shuffle: $('count-shuffle'),
      moves: $('count-moves')
    };

    els.continueMoves.textContent = CONFIG.CONTINUE_MOVES;
    els.helpLives.textContent = CONFIG.MAX_LIVES;

    els.nameInput.value = Leaderboard.rememberedName();
    UI.refreshWallet();
  };

  /* ------------------------------------------------------------- Screens */

  UI.show = function (id) {
    els.screens.forEach(function (screen) {
      if (screen.classList.contains('screen--overlay')) return;
      screen.classList.toggle('is-active', screen.id === id);
    });
    currentScreen = id;
  };

  UI.overlay = function (id, visible) {
    var el = $(id);
    if (el) el.classList.toggle('is-active', !!visible);
  };

  UI.closeAllOverlays = function () {
    els.screens.forEach(function (screen) {
      if (screen.classList.contains('screen--overlay')) screen.classList.remove('is-active');
    });
  };

  UI.current = function () {
    return currentScreen;
  };

  /* ------------------------------------------------- Leben und Kristalle */

  function renderHearts(target, lives, maxLives) {
    target.textContent = '';

    var shownHearts = Math.min(lives, maxLives);
    var i;

    for (i = 0; i < shownHearts; i++) target.appendChild(heartSpan('♥', 'heart--full'));
    for (i = shownHearts; i < maxLives; i++) target.appendChild(heartSpan('♡', 'heart--empty'));

    if (lives > maxLives) {
      var extra = doc.createElement('span');
      extra.className = 'heart--full';
      extra.textContent = ' +' + (lives - maxLives);
      target.appendChild(extra);
    }
  }

  function heartSpan(glyph, cls) {
    var span = doc.createElement('span');
    span.className = cls;
    span.textContent = glyph;
    return span;
  }

  /* Countdown bis zum naechsten Herz, mm:ss. */
  function regenLabel(ms) {
    var total = Math.ceil(ms / 1000);
    var m = Math.floor(total / 60);
    var s = total % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  UI.refreshWallet = function () {
    var p = Player.snapshot();

    renderHearts(els.hearts, p.lives, p.maxLives);
    els.crystals.textContent = Utils.formatNumber(p.crystals);

    if (p.lives >= p.maxLives) {
      els.livesNote.textContent = 'Voll';
    } else if (p.msToNextLife > 0) {
      els.livesNote.textContent = regenLabel(p.msToNextLife);
    } else {
      els.livesNote.textContent = '';
    }

    UI.refreshPowerBar();
  };

  UI.pulseHearts = function () {
    els.hearts.classList.remove('is-lost');
    void els.hearts.offsetWidth;
    els.hearts.classList.add('is-lost');
  };

  /* -------------------------------------------------------- Power-Leiste */

  /* Leere Power-Ups werden ausgegraut, bleiben aber anklickbar: nur so kann
     das Spiel erklaeren, dass der Vorrat alle ist und was Nachschub kostet.
     Ein deaktivierter Knopf sagt gar nichts. */
  /* Im Uebungslevel sind Power-Ups unbegrenzt: dann steht dort kein Zaehler,
     sondern ein Unendlich-Zeichen, und leer kann nichts sein. */
  var powerUnlimited = false;

  UI.refreshPowerBar = function () {
    var p = Player.snapshot();

    Player.ITEM_KEYS.forEach(function (key) {
      var count = p.powerups[key] || 0;
      var button = els.powerButtons[key];

      if (powerUnlimited) {
        els.powerCounts[key].textContent = '∞';
        button.classList.remove('is-empty');
        button.title = Player.ITEMS[key].hint + ' — im Übungslevel unbegrenzt';
        return;
      }

      els.powerCounts[key].textContent = count;
      button.classList.toggle('is-empty', count <= 0);
      button.title = count > 0
        ? Player.ITEMS[key].hint
        : Player.ITEMS[key].name + ' aufgebraucht — im Shop für ' +
          Player.ITEMS[key].price + ' Kristalle nachkaufen';
    });
  };

  UI.setPowerUnlimited = function (value) {
    powerUnlimited = !!value;
    UI.refreshPowerBar();
  };

  /* Gesperrt heisst matt, aber weiterhin anklickbar — der Klick erklaert,
     warum gerade nichts geht. Ein toter Knopf erklaert nichts. */
  UI.setPowerLock = function (locked) {
    Player.ITEM_KEYS.forEach(function (key) {
      els.powerButtons[key].classList.toggle('is-locked', !!locked);
    });
  };

  UI.setArmed = function (key) {
    Player.ITEM_KEYS.forEach(function (item) {
      els.powerButtons[item].classList.toggle('is-armed', item === key);
    });
    doc.body.classList.toggle('is-arming', !!key);
  };

  /* ----------------------------------------------------------------- HUD */

  /* Ein kurzer Schluessel aus allen Aufgabenstaenden — nur wenn der sich
     aendert, wird die Liste neu gezeichnet. */
  function goalKeyOf(goals, progress) {
    if (!goals) return '';
    return goals.map(function (g) {
      return Goals.currentOf(g, progress) + '/' + g.count;
    }).join(',');
  }

  UI.updateStats = function (s) {
    if (s.level !== shown.level) {
      shown.level = s.level;
    }

    if (s.movesLeft !== shown.moves) {
      /* Kurzer Puls, damit der Abzug auffaellt. */
      if (shown.moves >= 0) {
        els.movesBox.classList.remove('is-bumped');
        void els.movesBox.offsetWidth;
        els.movesBox.classList.add('is-bumped');
      }
      shown.moves = s.movesLeft;
      /* Im Uebungslevel gibt es kein Limit — dann steht dort die Unendlich-
         Schleife statt einer Zahl, und es wird nie rot. */
      els.hudMoves.textContent = s.unlimited ? '∞' : s.movesLeft;
      els.movesBox.classList.toggle('is-low', !s.unlimited && s.movesLeft <= 5);
    }

    var key = goalKeyOf(s.goals, s.progress);
    if (key !== shown.goalKey) {
      shown.goalKey = key;
      renderGoalChips(els.goalList, s.goals, s.progress);
    }
  };

  UI.resetStatCache = function () {
    shown = { level: -1, moves: -1, goalKey: '' };
  };

  /* Kleine Marken im HUD: Symbol, Restzahl, Haken wenn erledigt. */
  function renderGoalChips(target, goals, progress) {
    target.textContent = '';
    if (!goals) return;

    goals.forEach(function (goal) {
      var done = Goals.isDone(goal, progress);

      var li = doc.createElement('li');
      li.className = 'goal' + (done ? ' is-done' : '');

      var icon = doc.createElement('span');
      icon.className = 'goal__icon';
      icon.textContent = Goals.icon(goal);

      var value = doc.createElement('span');
      value.className = 'goal__value';
      value.textContent = done ? '✓' : Goals.remainingOf(goal, progress);

      li.appendChild(icon);
      li.appendChild(value);
      li.title = Goals.label(goal);
      target.appendChild(li);
    });
  }

  /* Grosse Karten fuer Levelstart und Verloren-Popup. */
  function renderGoalCards(target, goals, progress) {
    target.textContent = '';
    if (!goals) return;

    goals.forEach(function (goal) {
      var done = progress ? Goals.isDone(goal, progress) : false;
      var current = progress ? Goals.currentOf(goal, progress) : 0;

      var li = doc.createElement('li');
      li.className = 'goal-card' + (done ? ' is-done' : '');

      var icon = doc.createElement('span');
      icon.className = 'goal-card__icon';
      icon.textContent = Goals.icon(goal);

      var text = doc.createElement('span');
      text.className = 'goal-card__text';
      text.textContent = Goals.label(goal);

      var count = doc.createElement('span');
      count.className = 'goal-card__count';
      count.textContent = progress
        ? current + ' / ' + goal.count
        : Utils.formatNumber(goal.count);

      li.appendChild(icon);
      li.appendChild(text);
      li.appendChild(count);
      target.appendChild(li);
    });
  }

  UI.setHint = function (text, warn) {
    els.hint.textContent = text;
    els.hint.classList.toggle('is-warn', !!warn);
  };

  /* ----------------------------------------------------- Levelstart */

  UI.showLevelStart = function (def, isReplay) {
    var tutorial = def.unlimited;

    els.startLevel.textContent = tutorial ? 'Übung' : def.level;
    els.startLabel.hidden = tutorial;
    els.startMoves.textContent = tutorial ? '∞' : def.moves;
    els.startReplay.hidden = !isReplay;
    els.startTutorialNote.hidden = !tutorial;
    renderGoalCards(els.startGoals, def.goals, null);
    UI.overlay('screen-levelstart', true);
  };

  /* -------------------------------------------------------- Gewonnen */

  UI.showWin = function (data, crystals) {
    els.winScore.textContent = Utils.formatNumber(data.levelScore);
    els.winMoves.textContent = data.movesLeft;
    els.winCrystals.textContent = '+' + Utils.formatNumber(crystals) + ' 💎';

    els.winStars.textContent = '';
    for (var i = 1; i <= 3; i++) {
      var star = doc.createElement('span');
      star.className = 'star' + (i <= data.stars ? ' is-on' : '');
      star.style.animationDelay = (i * 0.14) + 's';
      star.textContent = '★';
      els.winStars.appendChild(star);
    }

    UI.refreshWallet();
    UI.overlay('screen-win', true);
  };

  /* -------------------------------------------------------- Verloren */

  UI.showFail = function (data, price, affordable) {
    renderGoalCards(els.failGoals, data.goals, data.progress);

    els.continuePrice.textContent = price;
    els.btnContinueBuy.disabled = !affordable;
    els.continueState.textContent = affordable
      ? ''
      : 'Dafür fehlen dir ' + (price - Player.snapshot().crystals) + ' Kristalle.';
    els.continueState.className = 'continue__state' + (affordable ? '' : ' is-warn');

    UI.overlay('screen-fail', true);
  };

  UI.setContinueState = function (text, kind) {
    els.continueState.textContent = text;
    els.continueState.className = 'continue__state' + (kind ? ' is-' + kind : '');
  };

  /* ---------------------------------------------------------------- Shop */

  UI.renderShop = function () {
    var p = Player.snapshot();

    els.shopCrystals.textContent = Utils.formatNumber(p.crystals);
    els.shopList.textContent = '';

    els.shopList.appendChild(shopRow({
      icon: '❤️',
      name: 'Extra-Leben',
      desc: 'Ein zusätzlicher Versuch. Maximal ' + CONFIG.LIVES_CAP + ' auf einmal.',
      owned: p.lives + ' / ' + CONFIG.LIVES_CAP,
      price: CONFIG.PRICE_LIFE,
      affordable: p.crystals >= CONFIG.PRICE_LIFE && p.lives < CONFIG.LIVES_CAP,
      action: 'life'
    }));

    Player.ITEM_KEYS.forEach(function (key) {
      var item = Player.ITEMS[key];
      els.shopList.appendChild(shopRow({
        icon: item.icon,
        name: item.name,
        desc: item.hint,
        owned: 'Vorrat: ' + p.powerups[key],
        price: item.price,
        affordable: p.crystals >= item.price,
        action: key
      }));
    });
  };

  function shopRow(spec) {
    var row = doc.createElement('li');
    row.className = 'shop__row' + (spec.affordable ? ' shop__row--affordable' : '');

    var icon = doc.createElement('span');
    icon.className = 'shop__icon';
    icon.textContent = spec.icon;

    var name = doc.createElement('span');
    name.className = 'shop__name';
    name.textContent = spec.name;

    var owned = doc.createElement('span');
    owned.className = 'shop__owned';
    owned.textContent = spec.owned;
    name.appendChild(owned);

    var desc = doc.createElement('span');
    desc.className = 'shop__desc';
    desc.textContent = spec.desc;
    name.appendChild(desc);

    var buy = doc.createElement('button');
    buy.className = 'shop__buy';
    buy.type = 'button';
    buy.textContent = spec.price + ' 💎';
    buy.disabled = !spec.affordable;
    buy.dataset.buy = spec.action;

    row.appendChild(icon);
    row.appendChild(name);
    row.appendChild(buy);
    return row;
  }

  UI.setShopState = function (text, kind) {
    els.shopState.textContent = text;
    els.shopState.className = 'shop__state' + (kind ? ' is-' + kind : '');
  };

  /* --------------------------------------------------------- Bestenliste */

  UI.prepareScoreScreen = function (totalScore) {
    var online = Leaderboard.isConfigured();
    els.tabs.hidden = !online;
    UI.setScoreTab(online ? 'online' : 'local');

    els.submitScore.textContent = Utils.formatNumber(totalScore);
    els.scoreForm.hidden = totalScore <= 0;
    els.submitState.hidden = true;
    els.btnSubmit.disabled = false;
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

  UI.nameValue = function () {
    return els.nameInput.value;
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

  UI.loadScores = function () {
    els.scoreList.textContent = '';
    var loading = doc.createElement('li');
    loading.className = 'scores__empty';
    loading.textContent = 'Lade…';
    els.scoreList.appendChild(loading);

    if (scoreTab === 'local') {
      els.offlineBadge.hidden = Leaderboard.isConfigured();
      els.offlineBadge.textContent = 'Offline — zeigt die lokale Bestenliste';
      renderList(Leaderboard.localEntries().slice(0, CONFIG.SCORE_LIMIT));
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
      empty.textContent = 'Noch keine Einträge — spiel das erste Level!';
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
    return highlightEntry &&
      entry.name === highlightEntry.name &&
      entry.score === highlightEntry.score;
  }

  root.M3.UI = UI;

})(typeof globalThis !== 'undefined' ? globalThis : this);
