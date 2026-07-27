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

  /* Herz: das Leben. Stand vorher als Emoji zwischen lauter gezeichneten
     Symbolen und war das einzige, das nach Aufkleber aussah. */
  function heart(ctx) {
    var grad = ctx.createLinearGradient(0, -0.8, 0, 0.9);
    grad.addColorStop(0, '#ff8fa0');
    grad.addColorStop(0.45, '#ff4f68');
    grad.addColorStop(1, '#b8203c');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, 0.88);
    ctx.bezierCurveTo(-0.95, 0.16, -0.78, -0.82, -0.3, -0.82);
    ctx.bezierCurveTo(-0.1, -0.82, 0, -0.6, 0, -0.44);
    ctx.bezierCurveTo(0, -0.6, 0.1, -0.82, 0.3, -0.82);
    ctx.bezierCurveTo(0.78, -0.82, 0.95, 0.16, 0, 0.88);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(90, 8, 26, 0.5)';
    ctx.lineWidth = 0.09;
    ctx.lineJoin = 'round';
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
    ctx.beginPath();
    ctx.ellipse(-0.34, -0.34, 0.17, 0.1, -0.72, 0, Math.PI * 2);
    ctx.fill();
  }

  /* Kristall: die Waehrung. Ein geschliffener Stein mit sichtbaren Facetten,
     damit er neben den Steinen auf dem Brett nicht abfaellt. */
  function crystal(ctx) {
    var body = ctx.createLinearGradient(-0.7, -0.7, 0.7, 0.9);
    body.addColorStop(0, '#eaf9ff');
    body.addColorStop(0.4, '#7fd8ff');
    body.addColorStop(1, '#1f7fc4');

    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(0, -0.86);
    ctx.lineTo(0.82, -0.22);
    ctx.lineTo(0, 0.9);
    ctx.lineTo(-0.82, -0.22);
    ctx.closePath();
    ctx.fill();

    /* Schliff: helle Tafel links, dunklere rechts. */
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath();
    ctx.moveTo(0, -0.86);
    ctx.lineTo(0, 0.9);
    ctx.lineTo(-0.82, -0.22);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(10, 60, 105, 0.28)';
    ctx.beginPath();
    ctx.moveTo(0, -0.86);
    ctx.lineTo(0.82, -0.22);
    ctx.lineTo(0.3, 0.28);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(8, 44, 82, 0.55)';
    ctx.lineWidth = 0.09;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -0.86);
    ctx.lineTo(0.82, -0.22);
    ctx.lineTo(0, 0.9);
    ctx.lineTo(-0.82, -0.22);
    ctx.closePath();
    ctx.stroke();
  }

  /* Muenze fuer das Schloss. */
  function coin(ctx) {
    var face = ctx.createLinearGradient(-0.6, -0.7, 0.6, 0.8);
    face.addColorStop(0, '#ffeead');
    face.addColorStop(0.5, '#ffc93c');
    face.addColorStop(1, '#b3760a');

    ctx.fillStyle = face;
    ctx.beginPath();
    ctx.arc(0, 0, 0.86, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(120, 76, 4, 0.6)';
    ctx.lineWidth = 0.12;
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 0.08;
    ctx.beginPath();
    ctx.arc(0, 0, 0.6, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.beginPath();
    ctx.ellipse(-0.32, -0.36, 0.2, 0.11, -0.7, 0, Math.PI * 2);
    ctx.fill();
  }

  /* Plus: sitzt in der Anzahl-Blase, wenn ein Booster leer ist. */
  function plus(ctx) {
    ctx.fillStyle = '#ffffff';
    var a = 0.2;
    var b = 0.72;
    ctx.beginPath();
    ctx.moveTo(-a, -b); ctx.lineTo(a, -b); ctx.lineTo(a, -a);
    ctx.lineTo(b, -a); ctx.lineTo(b, a); ctx.lineTo(a, a);
    ctx.lineTo(a, b); ctx.lineTo(-a, b); ctx.lineTo(-a, a);
    ctx.lineTo(-b, a); ctx.lineTo(-b, -a); ctx.lineTo(-a, -a);
    ctx.closePath();
    ctx.fill();
  }

  /* Zahnrad fuer die Pause — das Symbol, das jedes Spiel oben rechts hat.

     Der Umriss laeuft in gleichmaessigen Schritten um den Mittelpunkt und
     springt dabei zwischen zwei Radien hin und her. Jeder Zahn besteht so
     aus vier Punkten und sitzt genau dort, wo er hingehoert; von Hand
     gesetzte Winkel je Zahn ergaben nur einen Klecks. */
  function gear(ctx) {
    var teeth = 8;
    var step = Math.PI / teeth;   /* halber Zahn */
    var outer = 0.95;
    var inner = 0.66;

    ctx.fillStyle = '#e8f0ff';
    ctx.beginPath();
    for (var i = 0; i < teeth * 2; i++) {
      var r = i % 2 === 0 ? outer : inner;
      var a = i * step;
      /* Die Zahnflanken etwas einziehen, damit die Zaehne trapezfoermig
         werden statt dreieckig. */
      var lead = a - step * (i % 2 === 0 ? 0.34 : -0.34);
      var trail = a + step * (i % 2 === 0 ? 0.34 : -0.34);

      ctx[i ? 'lineTo' : 'moveTo'](Math.cos(lead) * r, Math.sin(lead) * r);
      ctx.lineTo(Math.cos(trail) * r, Math.sin(trail) * r);
    }
    ctx.closePath();
    ctx.fill();

    /* Loch in der Mitte — ohne das ist es eine Sonne, kein Zahnrad. */
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(0, 0, 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }

  /* Das Schloss — der Knopf, der zum Einrichten fuehrt. */
  function castle(ctx) {
    ctx.fillStyle = '#8fa8d8';
    /* Zinnen ueber dem Hauptbau. */
    var x = -0.62;
    ctx.beginPath();
    ctx.moveTo(-0.62, 0.8);
    ctx.lineTo(-0.62, -0.3);
    for (var i = 0; i < 5; i++) {
      x = -0.62 + i * 0.248;
      ctx.lineTo(x, -0.3);
      ctx.lineTo(x, i % 2 === 0 ? -0.62 : -0.3);
      ctx.lineTo(x + 0.248, i % 2 === 0 ? -0.62 : -0.3);
      ctx.lineTo(x + 0.248, -0.3);
    }
    ctx.lineTo(0.62, 0.8);
    ctx.closePath();
    ctx.fill();

    /* Tor. */
    ctx.fillStyle = '#2f4680';
    ctx.beginPath();
    ctx.moveTo(-0.19, 0.8);
    ctx.lineTo(-0.19, 0.16);
    ctx.quadraticCurveTo(0, -0.08, 0.19, 0.16);
    ctx.lineTo(0.19, 0.8);
    ctx.closePath();
    ctx.fill();

    /* Fahne auf dem mittleren Turm. */
    ctx.strokeStyle = '#dfe9ff';
    ctx.lineWidth = 0.07;
    ctx.beginPath();
    ctx.moveTo(0, -0.62);
    ctx.lineTo(0, -1);
    ctx.stroke();

    ctx.fillStyle = '#ff5a6e';
    ctx.beginPath();
    ctx.moveTo(0.03, -1);
    ctx.lineTo(0.48, -0.86);
    ctx.lineTo(0.03, -0.72);
    ctx.closePath();
    ctx.fill();
  }

  /* Einkaufswagen fuer den Shop. */
  function cart(ctx) {
    ctx.strokeStyle = '#dfe9ff';
    ctx.lineWidth = 0.15;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(-0.86, -0.66);
    ctx.lineTo(-0.5, -0.66);
    ctx.lineTo(-0.2, 0.34);
    ctx.lineTo(0.62, 0.34);
    ctx.stroke();

    /* Der Korb. */
    ctx.fillStyle = '#ffc93c';
    ctx.beginPath();
    ctx.moveTo(-0.44, -0.36);
    ctx.lineTo(0.86, -0.36);
    ctx.lineTo(0.66, 0.16);
    ctx.lineTo(-0.28, 0.16);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#dfe9ff';
    ctx.beginPath(); ctx.arc(-0.08, 0.7, 0.17, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(0.52, 0.7, 0.17, 0, Math.PI * 2); ctx.fill();
  }

  /* Pokal fuer die Bestenliste. */
  function trophy(ctx) {
    ctx.fillStyle = '#ffc93c';
    ctx.beginPath();
    ctx.moveTo(-0.46, -0.82);
    ctx.lineTo(0.46, -0.82);
    ctx.lineTo(0.4, -0.18);
    ctx.quadraticCurveTo(0.32, 0.16, 0, 0.2);
    ctx.quadraticCurveTo(-0.32, 0.16, -0.4, -0.18);
    ctx.closePath();
    ctx.fill();

    /* Henkel. */
    ctx.strokeStyle = '#e0a416';
    ctx.lineWidth = 0.13;
    ctx.beginPath();
    ctx.arc(-0.56, -0.5, 0.24, Math.PI * 0.4, Math.PI * 1.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0.56, -0.5, 0.24, Math.PI * 1.4, Math.PI * 0.6);
    ctx.stroke();

    /* Fuss. */
    ctx.fillStyle = '#e0a416';
    roundRect(ctx, -0.12, 0.18, 0.24, 0.36, 0.04);
    ctx.fill();
    roundRect(ctx, -0.44, 0.54, 0.88, 0.26, 0.08);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.beginPath();
    ctx.ellipse(-0.18, -0.5, 0.09, 0.2, 0.1, 0, Math.PI * 2);
    ctx.fill();
  }

  /* Fragezeichen fuer die Anleitung. */
  function help(ctx) {
    ctx.strokeStyle = '#e8f0ff';
    ctx.lineWidth = 0.22;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, -0.34, 0.36, Math.PI, Math.PI * 2.1);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0.33, -0.18);
    ctx.quadraticCurveTo(0.2, 0.1, 0, 0.22);
    ctx.stroke();

    ctx.fillStyle = '#e8f0ff';
    ctx.beginPath();
    ctx.arc(0, 0.68, 0.15, 0, Math.PI * 2);
    ctx.fill();
  }

  /* Stern fuer die Landkarte. Gefuellt heisst verdient, leer heisst offen.

     Nicht der `star()`-Helfer von unten: der hat vier Zacken und ist als
     Funke an der Zuendschnur gedacht. Ein verdienter Stern hat fuenf. */
  function starIcon(ctx) {
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var rad = i % 2 === 0 ? 0.95 : 0.42;
      var angle = (Math.PI / 5) * i - Math.PI / 2;
      ctx[i ? 'lineTo' : 'moveTo'](Math.cos(angle) * rad, Math.sin(angle) * rad + 0.06);
    }
    ctx.closePath();

    var grad = ctx.createLinearGradient(0, -0.9, 0, 0.9);
    grad.addColorStop(0, '#fff0b8');
    grad.addColorStop(0.5, '#ffc93c');
    grad.addColorStop(1, '#d18f04');
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.strokeStyle = 'rgba(90, 52, 0, 0.65)';
    ctx.lineWidth = 0.12;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  var ART = {
    rocket: rocket, bomb: bomb, moves: moves, shuffle: shuffle,
    heart: heart, crystal: crystal, coin: coin, plus: plus, gear: gear,
    castle: castle, cart: cart, trophy: trophy, help: help, star: starIcon
  };

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
