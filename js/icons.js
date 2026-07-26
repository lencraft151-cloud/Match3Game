/* ==========================================================================
   Icons — die Booster-Symbole, gezeichnet statt getippt.

   Vorher standen hier Emojis. Die sehen auf jedem Geraet anders aus, tragen
   eine fremde Formensprache ins Spiel und lassen sich weder faerben noch
   animieren. Ein 🔨 neben einem selbstgezeichneten Rubin wirkt wie ein
   Aufkleber auf einem Gemaelde.

   Jedes Symbol ist eine Funktion, die in ein Koordinatensystem von -1 bis 1
   zeichnet; `draw` skaliert das auf die gewuenschte Groesse. Damit sehen die
   Icons in der Power-Leiste, im Shop und in der Anleitung gleich aus, egal
   wie gross sie dort sind.
   ========================================================================== */

(function (root) {
  'use strict';

  var Icons = {};

  /* Die Akzentfarbe jedes Boosters — dieselbe wie auf seiner Karte. */
  var TINTS = {
    rocket: '#56b8ff',
    bomb: '#ff8a5c',
    moves: '#7ee787',
    shuffle: '#c99bff'
  };

  Icons.TINTS = TINTS;

  /* -------------------------------------------------------------- Zeichner */

  /* Rakete: Rumpf, Fenster, Finnen, Flamme — schraeg gestellt, damit sie
     fliegt statt zu stehen. */
  function rocket(ctx) {
    ctx.rotate(-Math.PI / 4);

    /* Flamme zuerst, sie liegt hinter dem Rumpf. */
    var flame = ctx.createLinearGradient(0, 0.45, 0, 1.05);
    flame.addColorStop(0, '#ffd76a');
    flame.addColorStop(0.5, '#ff9330');
    flame.addColorStop(1, 'rgba(255, 90, 40, 0)');
    ctx.fillStyle = flame;
    ctx.beginPath();
    ctx.moveTo(-0.26, 0.45);
    ctx.quadraticCurveTo(-0.1, 0.92, 0, 1.05);
    ctx.quadraticCurveTo(0.1, 0.92, 0.26, 0.45);
    ctx.closePath();
    ctx.fill();

    /* Finnen. */
    ctx.fillStyle = '#2f6fd0';
    ctx.beginPath();
    ctx.moveTo(-0.28, 0.16);
    ctx.lineTo(-0.66, 0.6);
    ctx.lineTo(-0.28, 0.52);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0.28, 0.16);
    ctx.lineTo(0.66, 0.6);
    ctx.lineTo(0.28, 0.52);
    ctx.closePath();
    ctx.fill();

    /* Rumpf. */
    var body = ctx.createLinearGradient(-0.35, 0, 0.35, 0);
    body.addColorStop(0, '#ffffff');
    body.addColorStop(0.45, '#dfe9ff');
    body.addColorStop(1, '#8fa8d8');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(0, -1);
    ctx.quadraticCurveTo(0.34, -0.42, 0.3, 0.34);
    ctx.quadraticCurveTo(0.16, 0.56, 0, 0.58);
    ctx.quadraticCurveTo(-0.16, 0.56, -0.3, 0.34);
    ctx.quadraticCurveTo(-0.34, -0.42, 0, -1);
    ctx.closePath();
    ctx.fill();

    /* Nasenspitze. */
    ctx.fillStyle = '#ff5a6e';
    ctx.beginPath();
    ctx.moveTo(0, -1);
    ctx.quadraticCurveTo(0.22, -0.62, 0.19, -0.4);
    ctx.quadraticCurveTo(0, -0.5, -0.19, -0.4);
    ctx.quadraticCurveTo(-0.22, -0.62, 0, -1);
    ctx.closePath();
    ctx.fill();

    /* Fenster. */
    ctx.fillStyle = '#2f6fd0';
    ctx.beginPath();
    ctx.arc(0, -0.08, 0.17, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#9fd8ff';
    ctx.beginPath();
    ctx.arc(-0.04, -0.12, 0.11, 0, Math.PI * 2);
    ctx.fill();
  }

  /* Bombe: Kugel, Glanzlicht, Zuendschnur mit Funken. */
  function bomb(ctx) {
    /* Zuendschnur. */
    ctx.strokeStyle = '#b5813f';
    ctx.lineWidth = 0.11;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0.24, -0.5);
    ctx.quadraticCurveTo(0.62, -0.72, 0.5, -1);
    ctx.stroke();

    /* Funke am Ende. */
    ctx.fillStyle = '#ffd76a';
    star(ctx, 0.5, -1, 0.3, 0.12);
    ctx.fill();
    ctx.fillStyle = '#fff6cf';
    ctx.beginPath();
    ctx.arc(0.5, -1, 0.09, 0, Math.PI * 2);
    ctx.fill();

    /* Kappe. */
    ctx.fillStyle = '#6b6f86';
    roundRect(ctx, -0.16, -0.64, 0.32, 0.2, 0.06);
    ctx.fill();

    /* Kugel. */
    var ball = ctx.createRadialGradient(-0.22, -0.28, 0.05, 0, 0.05, 0.85);
    ball.addColorStop(0, '#6d7590');
    ball.addColorStop(0.45, '#39405c');
    ball.addColorStop(1, '#171b2e');
    ctx.fillStyle = ball;
    ctx.beginPath();
    ctx.arc(0, 0.1, 0.66, 0, Math.PI * 2);
    ctx.fill();

    /* Glanzlicht. */
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.beginPath();
    ctx.ellipse(-0.26, -0.18, 0.19, 0.11, -0.6, 0, Math.PI * 2);
    ctx.fill();
  }

  /* Extra-Zuege: ein Plus mit Pfeilspitzen — Nachschub, keine Rechenaufgabe. */
  function moves(ctx) {
    var grad = ctx.createLinearGradient(0, -0.9, 0, 0.9);
    grad.addColorStop(0, '#b9ffcb');
    grad.addColorStop(0.5, '#56d97b');
    grad.addColorStop(1, '#1f9c4c');

    ctx.fillStyle = grad;
    ctx.strokeStyle = 'rgba(0, 60, 25, 0.55)';
    ctx.lineWidth = 0.1;
    ctx.lineJoin = 'round';

    var a = 0.24;
    var b = 0.82;
    ctx.beginPath();
    ctx.moveTo(-a, -b);
    ctx.lineTo(a, -b);
    ctx.lineTo(a, -a);
    ctx.lineTo(b, -a);
    ctx.lineTo(b, a);
    ctx.lineTo(a, a);
    ctx.lineTo(a, b);
    ctx.lineTo(-a, b);
    ctx.lineTo(-a, a);
    ctx.lineTo(-b, a);
    ctx.lineTo(-b, -a);
    ctx.lineTo(-a, -a);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.beginPath();
    ctx.ellipse(-0.1, -0.52, 0.11, 0.06, -0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  /* Mischen: zwei gekreuzte Pfeile. */
  function shuffle(ctx) {
    ctx.strokeStyle = '#e3c8ff';
    ctx.lineWidth = 0.17;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    /* Von links unten nach rechts oben, mit Bogen in der Mitte. */
    ctx.beginPath();
    ctx.moveTo(-0.82, 0.5);
    ctx.quadraticCurveTo(-0.1, 0.5, 0.1, -0.5);
    ctx.quadraticCurveTo(0.24, -0.86, 0.6, -0.86);
    ctx.stroke();

    /* Und zurueck. */
    ctx.strokeStyle = '#a06bff';
    ctx.beginPath();
    ctx.moveTo(-0.82, -0.5);
    ctx.quadraticCurveTo(-0.1, -0.5, 0.1, 0.5);
    ctx.quadraticCurveTo(0.24, 0.86, 0.6, 0.86);
    ctx.stroke();

    /* Spitzen. */
    ctx.fillStyle = '#e3c8ff';
    arrowHead(ctx, 0.62, -0.86, 1, 0);
    ctx.fillStyle = '#a06bff';
    arrowHead(ctx, 0.62, 0.86, 1, 0);
  }

  var ART = { rocket: rocket, bomb: bomb, moves: moves, shuffle: shuffle };

  /* ------------------------------------------------------------- Hilfsformen */

  function arrowHead(ctx, x, y, dx, dy) {
    var px = -dy;
    var py = dx;
    var s = 0.26;

    ctx.beginPath();
    ctx.moveTo(x + dx * s, y + dy * s);
    ctx.lineTo(x - dx * s * 0.4 + px * s * 0.75, y - dy * s * 0.4 + py * s * 0.75);
    ctx.lineTo(x - dx * s * 0.4 - px * s * 0.75, y - dy * s * 0.4 - py * s * 0.75);
    ctx.closePath();
    ctx.fill();
  }

  function star(ctx, cx, cy, outer, inner) {
    ctx.beginPath();
    for (var i = 0; i < 8; i++) {
      var rad = i % 2 === 0 ? outer : inner;
      var angle = (Math.PI / 4) * i - Math.PI / 2;
      ctx[i ? 'lineTo' : 'moveTo'](cx + Math.cos(angle) * rad, cy + Math.sin(angle) * rad);
    }
    ctx.closePath();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* ---------------------------------------------------------------- Ausgabe */

  /* Zeichnet ein Symbol mittig in ein Canvas der Kantenlaenge `size`. */
  Icons.draw = function (canvas, name, size) {
    var art = ART[name];
    if (!art || !canvas) return false;

    var dpr = Math.min(root.devicePixelRatio || 1, 3);

    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';

    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    ctx.save();
    ctx.translate(size / 2, size / 2);
    /* 0.42 statt 0.5: etwas Luft am Rand, sonst stossen Flamme und
       Zuendschnur an die Kante. */
    ctx.scale(size * 0.42, size * 0.42);
    ctx.lineWidth = 0.1;
    art(ctx);
    ctx.restore();

    return true;
  };

  /* Fertiges Canvas-Element, so wie die Anzeige es braucht. */
  Icons.element = function (name, size, className) {
    var canvas = root.document.createElement('canvas');
    canvas.className = className || 'icon-art';
    canvas.setAttribute('aria-hidden', 'true');
    Icons.draw(canvas, name, size);
    return canvas;
  };

  Icons.NAMES = Object.keys(ART);

  root.M3 = root.M3 || {};
  root.M3.Icons = Icons;

  if (typeof module !== 'undefined' && module.exports) module.exports = Icons;

})(typeof globalThis !== 'undefined' ? globalThis : this);
