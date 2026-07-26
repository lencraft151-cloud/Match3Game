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
  var Audio = root.M3.Audio;
  var Icons = root.M3.Icons;
  var Rooms = root.M3.Rooms;
  var RoomArt = root.M3.RoomArt;

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
    els.coins = $('coins');
    els.helpLives = $('help-lives');

    /* Spiel-HUD */
    els.hudMoves = $('hud-moves');
    els.movesBox = $('moves-box');
    els.goalList = $('goal-list');
    els.hint = $('game-hint');

    /* Pause */
    els.pauseCosts = Array.prototype.slice.call(
      doc.querySelectorAll('#screen-pause .btn__cost'));

    /* Levelstart */
    els.startLevel = $('start-level');
    els.startGoals = $('start-goals');
    els.startMoves = $('start-moves');
    els.startReplay = $('start-replay');
    els.startLabel = $('start-label');
    els.startTutorialNote = $('start-tutorial-note');

    /* Gewonnen */
    els.winConfetti = $('win-confetti');
    els.winStars = $('win-stars');
    els.winScore = $('win-score');
    els.winMoves = $('win-moves');
    els.winCrystals = $('win-crystals');
    els.winCoins = $('win-coins');
    els.winCoinRow = $('win-coin-row');

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

    /* Power-Leiste — aus den Item-Daten gebaut. */
    buildPowerBar($('powerbar'));

    /* Zimmer */
    els.roomName = $('room-name');
    els.roomLead = $('room-lead');
    els.roomCanvas = $('room-canvas');
    els.roomCount = $('room-count');
    els.roomFill = $('room-fill');
    els.roomProgress = $('room-progress');
    els.roomTask = $('room-task');
    els.roomQuestion = $('room-question');
    els.roomOptions = $('room-options');
    els.roomDone = $('room-done');
    els.roomState = $('room-state');
    els.btnRoomPrev = $('btn-room-prev');
    els.btnRoomNext = $('btn-room-next');

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
    els.coins.textContent = Utils.formatNumber(p.coins);

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

  /* Baut die Karten aus Player.ITEMS. Name, Wirkung, Preis und Symbol stehen
     damit an genau einer Stelle — frueher standen sie zusaetzlich im HTML und
     liefen bei jeder Aenderung auseinander. */
  function buildPowerBar(bar) {
    els.powerButtons = {};
    els.powerCounts = {};
    bar.textContent = '';

    Player.ITEM_KEYS.forEach(function (key) {
      var item = Player.ITEMS[key];

      var button = doc.createElement('button');
      button.type = 'button';
      button.id = 'pw-' + key;
      button.className = 'power power--' + key;

      var badge = doc.createElement('span');
      badge.className = 'power__badge';
      badge.appendChild(Icons.element(item.art, 30, 'power__art'));

      var name = doc.createElement('span');
      name.className = 'power__name';
      name.textContent = item.short || item.name;

      var effect = doc.createElement('span');
      effect.className = 'power__effect';
      effect.textContent = item.effect;

      var count = doc.createElement('span');
      count.className = 'power__count';
      count.id = 'count-' + key;
      count.textContent = '0';

      button.appendChild(badge);
      button.appendChild(name);
      button.appendChild(effect);
      button.appendChild(count);
      bar.appendChild(button);

      els.powerButtons[key] = button;
      els.powerCounts[key] = count;
    });
  }

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

  /* Das Symbol einer Aufgabe als gezeichneter Stein. Es kommt aus derselben
     Funktion wie das Brett — deshalb kann die Aufgabe nicht mehr eine andere
     Form zeigen als die, die tatsaechlich faellt. */
  function goalSymbol(goal, size, ring) {
    var canvas = doc.createElement('canvas');
    canvas.className = 'goal__gem';
    canvas.setAttribute('aria-hidden', 'true');
    root.M3.drawGemSymbol(canvas, Goals.symbol(goal), size, ring);
    return canvas;
  }

  /* Kleine Marken im HUD: Symbol, Restzahl, Haken wenn erledigt. */
  function renderGoalChips(target, goals, progress) {
    target.textContent = '';
    if (!goals) return;

    goals.forEach(function (goal) {
      var done = Goals.isDone(goal, progress);

      var li = doc.createElement('li');
      li.className = 'goal' + (done ? ' is-done' : '');

      var value = doc.createElement('span');
      value.className = 'goal__value';
      value.textContent = done ? '✓' : Goals.remainingOf(goal, progress);

      /* Der Ring zeigt, wie viel geschafft ist — die Zahl daneben, wie viel
         noch fehlt. Zusammen beantwortet das beide Fragen auf einen Blick. */
      li.appendChild(goalSymbol(goal, 34,
        Goals.currentOf(goal, progress) / goal.count));
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
      icon.appendChild(goalSymbol(goal, 34));

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

  /* Im Uebungslevel kostet weder Neustart noch Aufgeben etwas — dann darf
     dort auch keine Kostenmarke stehen. */
  UI.setPauseCosts = function (show) {
    els.pauseCosts.forEach(function (el) { el.hidden = !show; });
  };

  /* Der Rahmen des Bretts nimmt den Ton des Themas auf. Nur eine Variable —
       gezeichnet wird das Thema selbst in game.js. */
  UI.setBoardTheme = function (theme) {
    var canvas = $('board-canvas');
    if (!canvas || !theme) return;
    canvas.style.setProperty('--board-tint', 'rgba(' + theme.tint + ', 0.3)');
    canvas.dataset.theme = theme.key;
  };

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

  /* Zaehlt eine Zahl in rund `ms` hoch. Eine Zahl, die hochlaeuft, fuehlt
     sich verdient an; dieselbe Zahl, die einfach dasteht, nicht.
     Bei reduzierter Bewegung steht sie sofort. */
  function countUp(el, target, ms, format) {
    /* Ein noch laufender Zaehler auf demselben Feld wird abgeloest — aber nur
       dieser. Wer hier pauschal alle Zaehler stoppt, loescht dem Nachbarn
       mitten im Lauf die Zahl weg. */
    if (el.countTimer) {
      root.clearInterval(el.countTimer);
      el.countTimer = 0;
    }

    var render = format || function (v) { return Utils.formatNumber(v); };

    if (Utils.prefersReducedMotion() || target <= 0) {
      el.textContent = render(target);
      return;
    }

    var started = 0;
    var step = 1000 / 60;

    el.countTimer = root.setInterval(function () {
      started += step;
      var t = Math.min(1, started / ms);
      /* Am Ende langsamer — das liest sich wie ein Zaehlwerk, das ausrollt. */
      el.textContent = render(Math.round(target * Utils.easeOutCubic(t)));
      if (t >= 1) {
        root.clearInterval(el.countTimer);
        el.countTimer = 0;
      }
    }, step);
  }

  UI.showWin = function (data, crystals, coins) {
    els.winScore.textContent = '0';
    els.winMoves.textContent = data.movesLeft;
    els.winCrystals.textContent = '+0 💎';

    /* Die Muenzzeile steht nur da, wenn es welche gab — im Uebungslevel
       gibt es keine, und eine Zeile mit "+0" waere dort nur verwirrend. */
    els.winCoinRow.hidden = !coins;
    els.winCoins.textContent = '+0';

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

    /* Erst die Sterne poppen lassen, dann die Zahlen — sonst konkurrieren
       beide um den Blick. */
    root.setTimeout(function () {
      countUp(els.winScore, data.levelScore, 900);
      countUp(els.winCrystals, crystals, 900, function (v) {
        return '+' + Utils.formatNumber(v) + ' 💎';
      });
      if (coins) {
        countUp(els.winCoins, coins, 900, function (v) {
          return '+' + Utils.formatNumber(v);
        });
      }
    }, 260 + data.stars * 150);

    confetti(els.winConfetti, data.stars);
  };

  /* Konfetti aus den Steinfarben — reine Deko, deshalb aria-hidden und bei
     reduzierter Bewegung gar nicht erst erzeugt. */
  function confetti(target, stars) {
    if (!target) return;
    target.textContent = '';
    if (Utils.prefersReducedMotion()) return;

    var colors = root.M3.GEM_COLORS;
    var count = 14 + stars * 8;

    for (var i = 0; i < count; i++) {
      var bit = doc.createElement('i');
      bit.className = 'confetti__bit';
      bit.style.left = (4 + Math.random() * 92) + '%';
      bit.style.background = colors[i % colors.length];
      bit.style.animationDelay = (Math.random() * 0.5) + 's';
      bit.style.animationDuration = (1.5 + Math.random() * 1.1) + 's';
      bit.style.transform = 'rotate(' + Math.round(Math.random() * 360) + 'deg)';
      target.appendChild(bit);
    }
  }

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

  /* -------------------------------------------------------------- Zimmer */

  /* Welches Zimmer gerade angesehen wird. Nicht dasselbe wie das Zimmer, an
     dem gearbeitet wird — man darf zurueckblaettern und sich Fertiges
     ansehen. */
  var roomView = 0;

  /* main.js reicht den Stand und den Kaufhandler herein; ui.js kennt weder
     den Spielstand noch das Speichern. */
  var roomApi = null;

  UI.initRooms = function (api) {
    roomApi = api;
    els.btnRoomPrev.addEventListener('click', function () { stepRoom(-1); });
    els.btnRoomNext.addEventListener('click', function () { stepRoom(1); });
  };

  function stepRoom(delta) {
    var state = roomApi.state();
    var next = roomView + delta;
    if (next < 0 || next >= Rooms.COUNT) return;
    if (!Rooms.isUnlocked(state, next)) return;

    roomView = next;
    Audio.click();
    UI.renderRooms();
  }

  /* Beim Oeffnen immer beim aktuellen Zimmer landen. */
  UI.openRoomView = function () {
    roomView = Rooms.activeIndex(roomApi.state());
    UI.renderRooms();
  };

  UI.renderRooms = function () {
    var state = roomApi.state();
    var room = Rooms.get(roomView);
    if (!room) return;

    var chosen = Rooms.chosenIn(state, room.key);
    var done = Rooms.doneCount(state, room);
    var total = room.tasks.length;

    els.roomName.textContent = room.name;
    els.roomLead.textContent = room.lead;
    els.roomCount.textContent = (roomView + 1) + ' / ' + Rooms.COUNT;

    els.btnRoomPrev.disabled = roomView === 0;
    els.btnRoomNext.disabled = roomView >= Rooms.COUNT - 1 ||
      !Rooms.isUnlocked(state, roomView + 1);

    els.roomFill.style.width = Math.round((done / total) * 100) + '%';
    els.roomProgress.textContent = done + ' von ' + total;

    drawRoom(room, chosen);

    var task = Rooms.nextTask(state, room);
    els.roomTask.hidden = !task;
    els.roomDone.hidden = !!task;

    if (task) renderRoomTask(room, chosen, task);
    else {
      els.roomDone.textContent = roomView >= Rooms.COUNT - 1
        ? 'Alles eingerichtet. Das ganze Schloss gehört dir!'
        : 'Dieses Zimmer ist fertig — das nächste steht bereit.';
    }

    UI.refreshWallet();
  };

  /* Das Zimmerbild bekommt die Breite, die der Kasten gerade hergibt, und ein
     festes Seitenverhaeltnis. Ohne das waere es auf dem Handy briefmarken-
     gross und auf dem Desktop ein Wandgemaelde. */
  function drawRoom(room, chosen) {
    var box = els.roomCanvas.parentNode;
    var width = Math.max(240, box.clientWidth || 320);
    var height = Math.round(width * 0.62);

    RoomArt.draw(els.roomCanvas, room, chosen, width, height);
  }

  function renderRoomTask(room, chosen, task) {
    var coins = Player.snapshot().coins;

    els.roomQuestion.textContent = task.question;
    els.roomOptions.textContent = '';

    task.options.forEach(function (option) {
      var affordable = coins >= option.price;

      var li = doc.createElement('li');
      var button = doc.createElement('button');
      button.type = 'button';
      button.className = 'room-option' + (affordable ? '' : ' is-poor');
      button.dataset.task = task.key;
      button.dataset.option = option.key;

      var canvas = doc.createElement('canvas');
      canvas.className = 'room-option__art';
      canvas.setAttribute('aria-hidden', 'true');
      RoomArt.drawOption(canvas, room, chosen, task.key, option.key, 132, 82);

      var name = doc.createElement('span');
      name.className = 'room-option__name';
      name.textContent = option.name;

      var price = doc.createElement('span');
      price.className = 'room-option__price';
      price.textContent = Utils.formatNumber(option.price);

      button.appendChild(canvas);
      button.appendChild(name);
      button.appendChild(price);
      button.addEventListener('click', function () {
        roomApi.buy(room.key, task.key, option.key, option.price);
      });

      li.appendChild(button);
      els.roomOptions.appendChild(li);
    });
  }

  UI.setRoomState = function (text, kind) {
    els.roomState.textContent = text || '';
    els.roomState.className = 'room__state' + (kind ? ' is-' + kind : '');
  };

  /* Beim Kauf kurz aufleuchten — die Muenzen sollen sichtbar irgendwo
     hingegangen sein. */
  UI.flashRoom = function () {
    els.roomCanvas.classList.remove('is-fresh');
    void els.roomCanvas.offsetWidth;
    els.roomCanvas.classList.add('is-fresh');
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

    /* Der Reihe nach vom guenstigsten zum teuersten — so liest sich die
       Preisleiter von selbst. */
    Player.ITEM_KEYS.slice()
      .sort(function (a, b) { return Player.ITEMS[a].price - Player.ITEMS[b].price; })
      .forEach(function (key) {
        var item = Player.ITEMS[key];
        els.shopList.appendChild(shopRow({
          art: item.art,
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
    if (spec.art) icon.appendChild(Icons.element(spec.art, 34, 'shop__art'));
    else icon.textContent = spec.icon;

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
