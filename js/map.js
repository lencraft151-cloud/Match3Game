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
  var Icons = root.M3.Icons;

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

    /* Ein Knoten mehr: das Uebungslevel sitzt vor Level 1. */
    var count = unlocked + LOOKAHEAD + 1;
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

    /* Ein gepflasterter Weg statt einer gepunkteten Linie: eine breite dunkle
       Bahn, darauf eine hellere Fahrbahn und darueber die Pflastersteine als
       Strichmuster. Der Teil bis zum Fortschritt liegt in Gold — man sieht
       auf einen Blick, wie weit man gekommen ist. */
    var line = points.join(' ');
    var doneLength = Math.max(0, Math.min(unlocked, count - 1));
    var donePoints = points.slice(0, doneLength + 1).join(' ');

    els.path.innerHTML =
      '<polyline points="' + line + '" fill="none" stroke="rgba(0,0,0,0.3)" ' +
        'stroke-width="26" stroke-linecap="round" stroke-linejoin="round" />' +
      '<polyline points="' + line + '" fill="none" stroke="rgba(255,255,255,0.11)" ' +
        'stroke-width="20" stroke-linecap="round" stroke-linejoin="round" />' +
      '<polyline points="' + line + '" fill="none" stroke="rgba(255,255,255,0.16)" ' +
        'stroke-width="20" stroke-linecap="butt" stroke-dasharray="9 11" />' +
      (doneLength > 0
        ? '<polyline points="' + donePoints + '" fill="none" ' +
          'stroke="rgba(255,201,60,0.5)" stroke-width="20" stroke-linecap="round" ' +
          'stroke-linejoin="round" />' +
          '<polyline points="' + donePoints + '" fill="none" ' +
          'stroke="rgba(255,232,160,0.55)" stroke-width="20" stroke-linecap="butt" ' +
          'stroke-dasharray="9 11" />'
        : '');

    /* --- Knoten --------------------------------------------------------- */
    var frag = doc.createDocumentFragment();

    for (var n = 0; n < count; n++) {
      /* Index 0 ist das Uebungslevel (Levelnummer 0). */
      frag.appendChild(makeNode(n, xFor(n, width), yFor(n, height), unlocked, stars));
    }

    els.nodes.textContent = '';
    els.nodes.appendChild(frag);
  };

  function makeNode(level, x, y, unlocked, stars) {
    var tutorial = level === 0;
    var done = !tutorial && level < unlocked;
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
      (tutorial ? ' node--tutorial' : '') +
      (done ? ' node--done' : '') +
      (current ? ' node--current' : '') +
      (!tutorial && !done && !current ? ' node--locked' : '');

    /* Das Uebungslevel ist immer offen. */
    button.disabled = !tutorial && !done && !current;
    button.textContent = tutorial ? '?' : level;

    button.setAttribute('aria-label',
      tutorial ? 'Übungslevel — hier wird alles erklärt'
      : 'Level ' + level + (button.disabled ? ' (gesperrt)'
        : done ? ' (geschafft, ' + earned + ' von 3 Sternen — nochmal spielen)'
               : ' (jetzt spielen)'));

    wrap.appendChild(button);

    if (done) wrap.appendChild(starRow(earned));
    if (current) {
      /* Ein huepfender Zeiger auf dem naechsten Level. Frueher stand hier
         eine Krone als Emoji — die sah auf jedem Geraet anders aus und
         bedeutete ausserdem nichts: "hier gehts weiter" ist keine Krone. */
      var pointer = doc.createElement('span');
      pointer.className = 'node__pointer';
      pointer.setAttribute('aria-hidden', 'true');
      wrap.appendChild(pointer);
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
      star.appendChild(Icons.element('star', 15, 'node__star-art'));
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
