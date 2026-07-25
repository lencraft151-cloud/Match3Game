/* ==========================================================================
   Map — die Level-Landkarte.

   Senkrecht scrollende Bahn aus nummerierten Knoten. Level 1 liegt unten,
   der Fortschritt waechst nach oben — so laeuft das Scrollen in dieselbe
   Richtung wie der Fortschritt.

   Bewusst aus DOM-Knoten statt Canvas: Scrollen, Antippen, Tastaturbedienung
   und Screenreader funktionieren damit von selbst. Nur die Verbindungslinie
   ist ein SVG-Pfad dahinter.
   ========================================================================== */

(function (root) {
  'use strict';

  var doc = root.document;

  var Map = {};

  /* Abstand zweier Knoten in Pixeln und wie weit die Bahn seitlich
     ausschlaegt (Anteil der Breite). */
  var SPACING = 108;
  var SWING = 0.26;
  var PAD_TOP = 90;
  var PAD_BOTTOM = 60;

  /* So viele noch gesperrte Level werden ueber dem Fortschritt gezeigt —
     genug, dass die Bahn weitergeht, ohne tausend Knoten zu bauen. */
  var LOOKAHEAD = 12;

  var els = null;
  var onSelect = null;

  Map.init = function (options) {
    els = {
      scroll: doc.getElementById('map-scroll'),
      inner: doc.getElementById('map-inner'),
      path: doc.getElementById('map-path'),
      nodes: doc.getElementById('map-nodes')
    };
    onSelect = options.onSelect;

    /* Ein Listener fuer alle Knoten — die Liste wird bei jedem Fortschritt
       neu gebaut, einzelne Listener waeren sofort veraltet. */
    els.nodes.addEventListener('click', function (e) {
      var button = e.target.closest ? e.target.closest('[data-level]') : null;
      if (!button || button.disabled) return;
      if (onSelect) onSelect(parseInt(button.dataset.level, 10));
    });
  };

  /* x-Position eines Knotens: eine Welle mit Periode vier — Mitte, rechts,
     Mitte, links. Bei anderen Perioden landen zwei aufeinanderfolgende Knoten
     auf derselben Seite und stehen wie gestapelt uebereinander. */
  function xFor(index, width) {
    return width / 2 + Math.sin(index * (Math.PI / 2)) * width * SWING;
  }

  function yFor(index, height) {
    return height - PAD_BOTTOM - index * SPACING;
  }

  /* Baut die Bahn neu auf.

     `unlocked` ist das hoechste spielbare Level, `stars` ordnet einer
     Levelnummer die erreichten Sterne zu. */
  Map.render = function (unlocked, stars) {
    if (!els) return;

    var count = unlocked + LOOKAHEAD;
    var width = els.scroll.clientWidth || 360;
    var height = PAD_TOP + PAD_BOTTOM + count * SPACING;

    els.inner.style.height = height + 'px';

    /* --- Verbindungslinie ---------------------------------------------- */
    var points = [];
    for (var i = 0; i < count; i++) {
      points.push(xFor(i, width).toFixed(1) + ',' + yFor(i, height).toFixed(1));
    }

    els.path.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    els.path.setAttribute('width', width);
    els.path.setAttribute('height', height);
    els.path.innerHTML =
      '<polyline points="' + points.join(' ') + '" ' +
      'fill="none" stroke="rgba(255,255,255,0.16)" stroke-width="14" ' +
      'stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="2 26" />';

    /* --- Knoten --------------------------------------------------------- */
    var frag = doc.createDocumentFragment();

    for (var n = 0; n < count; n++) {
      var level = n + 1;
      frag.appendChild(makeNode(level, xFor(n, width), yFor(n, height), unlocked, stars));
    }

    els.nodes.textContent = '';
    els.nodes.appendChild(frag);
  };

  function makeNode(level, x, y, unlocked, stars) {
    var done = level < unlocked;
    var current = level === unlocked;
    var earned = (stars && stars[level]) || 0;

    var wrap = doc.createElement('div');
    wrap.className = 'node-wrap';
    wrap.style.left = x + 'px';
    wrap.style.top = y + 'px';

    var button = doc.createElement('button');
    button.type = 'button';
    button.dataset.level = level;
    button.className = 'node' +
      (done ? ' node--done' : '') +
      (current ? ' node--current' : '') +
      (!done && !current ? ' node--locked' : '');

    button.disabled = !done && !current;
    button.textContent = level;

    button.setAttribute('aria-label',
      'Level ' + level + (button.disabled ? ' (gesperrt)'
        : done ? ' (geschafft, ' + earned + ' von 3 Sternen — nochmal spielen)'
               : ' (jetzt spielen)'));

    wrap.appendChild(button);

    if (done) wrap.appendChild(starRow(earned));
    if (current) {
      var crown = doc.createElement('span');
      crown.className = 'node__crown';
      crown.textContent = '👑';
      crown.setAttribute('aria-hidden', 'true');
      wrap.appendChild(crown);
    }

    return wrap;
  }

  function starRow(earned) {
    var row = doc.createElement('span');
    row.className = 'node__stars';
    row.setAttribute('aria-hidden', 'true');

    for (var i = 1; i <= 3; i++) {
      var star = doc.createElement('span');
      star.className = 'node__star' + (i <= earned ? ' is-on' : '');
      star.textContent = '★';
      row.appendChild(star);
    }
    return row;
  }

  /* Scrollt so, dass das aktuelle Level in der Mitte sitzt. */
  Map.scrollToCurrent = function (unlocked, smooth) {
    if (!els) return;

    var node = els.nodes.querySelector('.node--current');
    if (!node) return;

    var wrap = node.parentNode;
    var target = wrap.offsetTop - els.scroll.clientHeight / 2;

    try {
      els.scroll.scrollTo({
        top: Math.max(0, target),
        behavior: smooth ? 'smooth' : 'auto'
      });
    } catch (err) {
      /* Aeltere Browser kennen das Optionsobjekt nicht. */
      els.scroll.scrollTop = Math.max(0, target);
    }
  };

  root.M3 = root.M3 || {};
  root.M3.Map = Map;

})(typeof globalThis !== 'undefined' ? globalThis : this);
