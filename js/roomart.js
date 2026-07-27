/* ==========================================================================
   RoomArt — die Zimmer zeichnen.

   Alles auf ein Canvas, in einem Koordinatensystem von 0 bis 1. Damit sieht
   das Zimmer in der kleinen Vorschau genauso aus wie gross, und es braucht
   keine einzige Bilddatei — das Spiel bleibt eine Handvoll Textdateien.

   Gezeichnet wird in Schichten von hinten nach vorn: Wand, Boden, Licht,
   Moebel. Was noch nicht gekauft ist, bekommt einen gestrichelten Platzhalter
   — man soll sehen, dass da etwas fehlt, nicht raten muessen.

   Alle Muster kommen aus `rnd()`, nie aus Math.random(): der Raum wird bei
   jeder Aenderung komplett neu gezeichnet, und ein Zufall pro Aufruf wuerde
   die Maserung bei jedem Klick neu wuerfeln. Das saehe aus wie ein Flimmern
   und nicht wie Holz.
   ========================================================================== */

(function (root) {
  'use strict';

  var RoomArt = {};

  /* Horizont: darueber Wand, darunter Boden. */
  var HORIZON = 0.62;

  /* ------------------------------------------------------- Zufall mit Gedaechtnis */

  /* Derselbe Index ergibt immer denselben Wert zwischen 0 und 1. */
  function rnd(i) {
    var x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  }

  /* Wert zwischen lo und hi, gesteuert vom Index. */
  function rndBetween(i, lo, hi) {
    return lo + rnd(i) * (hi - lo);
  }

  /* ------------------------------------------------------------- Grundformen */

  function rect(ctx, x, y, w, h) {
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.fill();
  }

  function roundRect(ctx, x, y, w, h, r) {
    var rad = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
    ctx.fill();
  }

  function circle(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function shade(ctx, x0, y0, x1, y1, from, to) {
    var g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, from);
    g.addColorStop(1, to);
    return g;
  }

  /* ------------------------------------------------------------- Texturen */

  /* Feines Korn ueber eine Flaeche — macht aus einer Farbfleche ein Material.
     `seed` haelt das Muster pro Aufrufstelle stabil und verschieden. */
  function speckle(ctx, x, y, w, h, count, color, alpha, size, seed) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    for (var i = 0; i < count; i++) {
      var s = seed + i * 3;
      circle(ctx, x + rnd(s) * w, y + rnd(s + 1) * h, size * (0.5 + rnd(s + 2)));
    }
    ctx.restore();
  }

  /* Maserung: leicht geschwungene Linien laengs der Faser. */
  function grain(ctx, x, y, w, h, count, color, alpha, seed, vertical) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.0035;
    ctx.lineCap = 'round';

    for (var i = 0; i < count; i++) {
      var s = seed + i * 5;
      ctx.beginPath();
      if (vertical) {
        var gx = x + rnd(s) * w;
        ctx.moveTo(gx, y);
        ctx.quadraticCurveTo(gx + rndBetween(s + 1, -0.02, 0.02), y + h / 2, gx, y + h);
      } else {
        var gy = y + rnd(s) * h;
        ctx.moveTo(x, gy);
        ctx.quadraticCurveTo(x + w / 2, gy + rndBetween(s + 1, -0.012, 0.012), x + w, gy);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  /* Marmoraderung. Bewusst geschwungen und blass: gerade, kraeftige Linien
     liest das Auge als Risse im Boden, nicht als Maserung im Stein. */
  function veins(ctx, x, y, w, h, count, color, seed) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (var i = 0; i < count; i++) {
      var s = seed + i * 7;
      var px = x + rnd(s) * w;
      var py = y + rnd(s + 1) * h;

      ctx.globalAlpha = 0.06 + rnd(s + 2) * 0.09;
      ctx.lineWidth = 0.0018 + rnd(s + 3) * 0.0022;
      ctx.beginPath();
      ctx.moveTo(px, py);

      /* Drei Bogenstuecke statt drei Geraden — eine Ader knickt nicht. */
      for (var k = 0; k < 3; k++) {
        var cx = px + rndBetween(s + k * 4 + 4, -0.07, 0.08);
        var cy = py + rndBetween(s + k * 4 + 5, -0.025, 0.025);
        px += rndBetween(s + k * 4 + 6, -0.11, 0.13);
        py += rndBetween(s + k * 4 + 7, -0.035, 0.035);
        ctx.quadraticCurveTo(cx, cy, px, py);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  /* Weicher Schatten unter einem Moebelstueck — ohne ihn schwebt alles. */
  function groundShadow(ctx, cx, baseY, w, h) {
    ctx.save();
    var g = ctx.createRadialGradient(cx, baseY, 0, cx, baseY, w / 2);
    g.addColorStop(0, 'rgba(0, 0, 0, 0.45)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, baseY, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /* Ein gestrichelter Platzhalter, wo noch nichts steht.

     Der Rest der Datei zeichnet in 0..1, und das Koordinatensystem streckt
     x und y unterschiedlich weit — fuer Flaechen und Verlaeufe ist das
     genau richtig, fuer Striche und Schrift nicht: eine Linie waere in
     einer Richtung dicker als in der anderen, und der Text bekaeme die
     Glyphenhoehe der einen Achse mit den Buchstabenabstaenden der anderen.
     Buchstaben liegen dann uebereinander.

     Deshalb rechnet der Platzhalter als einziger in Pixeln. `px` bringt
     mit, was dafuer fehlt: Geraetefaktor und Canvasgroesse. */
  function placeholder(ctx, x, y, w, h, label, px) {
    var s = Math.min(px.w, px.h);

    ctx.save();
    ctx.setTransform(px.dpr, 0, 0, px.dpr, 0, 0);

    ctx.setLineDash([s * 0.028, s * 0.024]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.42)';
    ctx.lineWidth = Math.max(1, s * 0.008);
    ctx.strokeRect(x * px.w, y * px.h, w * px.w, h * px.h);
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.62)';
    ctx.font = '700 ' + Math.round(s * 0.055) + 'px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label || '?', (x + w / 2) * px.w, (y + h / 2) * px.h);

    ctx.restore();
  }

  /* Ein einzelner Mauerstein mit eigenem Ton, Lichtkante und Fugenschatten.
     Erst damit sieht eine Wand nach Mauerwerk aus und nicht nach Gitter. */
  function brick(ctx, x, y, w, h, base, tint, seed) {
    var lift = rndBetween(seed, -0.05, 0.06);

    ctx.fillStyle = mix(base, tint, 0.5 + lift);
    rect(ctx, x, y, w, h);

    /* Lichtkante oben, Schatten unten — das gibt der Fuge Tiefe. */
    ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
    rect(ctx, x, y, w, 0.004);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    rect(ctx, x, y + h - 0.004, w, 0.004);
    rect(ctx, x + w - 0.003, y, 0.003, h);
  }

  /* Zwei Farben mischen, ohne Farbbibliothek. */
  function mix(a, b, t) {
    var f = Math.max(0, Math.min(1, t));
    return 'rgb(' +
      Math.round(a[0] + (b[0] - a[0]) * f) + ',' +
      Math.round(a[1] + (b[1] - a[1]) * f) + ',' +
      Math.round(a[2] + (b[2] - a[2]) * f) + ')';
  }

  /* ------------------------------------------------------------------ Waende */

  var WALLS = {
    /* Eingangshalle: Sandsteinmauer im Verband. */
    stone: function (ctx) {
      ctx.fillStyle = shade(ctx, 0, 0, 0, HORIZON, '#e8d5ae', '#bda478');
      rect(ctx, 0, 0, 1, HORIZON);

      var rows = 7;
      var bh = HORIZON / rows;
      var dark = [150, 118, 70];
      var light = [235, 216, 178];

      for (var r = 0; r < rows; r++) {
        var y = r * bh;
        var offset = (r % 2) * 0.1;
        for (var c = -1; c < 6; c++) {
          brick(ctx, c * 0.2 + offset, y, 0.2 - 0.006, bh - 0.006,
            dark, light, r * 11 + c * 3 + 1);
        }
      }

      /* Von oben faellt Licht ein, unten wird es kuehler. */
      ctx.fillStyle = shade(ctx, 0, 0, 0, HORIZON,
        'rgba(255, 240, 200, 0.18)', 'rgba(20, 30, 70, 0.3)');
      rect(ctx, 0, 0, 1, HORIZON);

      speckle(ctx, 0, 0, 1, HORIZON, 220, '#7a5f30', 0.07, 0.0035, 300);
    },

    /* Holzvertaefelung mit Maserung und Sockelleiste. */
    panel: function (ctx) {
      ctx.fillStyle = shade(ctx, 0, 0, 0, HORIZON, '#7a4f2e', '#402612');
      rect(ctx, 0, 0, 1, HORIZON);
      grain(ctx, 0, 0, 1, HORIZON, 40, '#2a1608', 0.3, 40, true);

      for (var i = 0; i < 6; i++) {
        var x = 0.028 + i * 0.161;
        /* Fuellung */
        ctx.fillStyle = 'rgba(255, 226, 180, 0.1)';
        roundRect(ctx, x, 0.08, 0.126, HORIZON - 0.2, 0.012);
        /* Fase: hell oben links, dunkel unten rechts */
        ctx.fillStyle = 'rgba(255, 240, 210, 0.22)';
        rect(ctx, x, 0.08, 0.126, 0.006);
        rect(ctx, x, 0.08, 0.006, HORIZON - 0.2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
        rect(ctx, x, HORIZON - 0.126, 0.126, 0.006);
        rect(ctx, x + 0.12, 0.08, 0.006, HORIZON - 0.2);
      }

      /* Sockelleiste. */
      ctx.fillStyle = '#33200f';
      rect(ctx, 0, HORIZON - 0.055, 1, 0.055);
      ctx.fillStyle = 'rgba(255, 220, 170, 0.2)';
      rect(ctx, 0, HORIZON - 0.055, 1, 0.005);
    },

    /* Bibliothek: volle Regale mit unterschiedlichen Buchruecken. */
    shelves: function (ctx) {
      ctx.fillStyle = shade(ctx, 0, 0, 0, HORIZON, '#5b3a20', '#2e1c0c');
      rect(ctx, 0, 0, 1, HORIZON);
      grain(ctx, 0, 0, 1, HORIZON, 26, '#1c1005', 0.35, 90, true);

      var palette = [
        [201, 69, 94], [63, 127, 214], [87, 168, 107],
        [214, 155, 63], [143, 95, 208], [208, 98, 90], [222, 205, 170]
      ];

      for (var row = 0; row < 4; row++) {
        var top = 0.045 + row * 0.137;
        var shelfY = top + 0.108;

        /* Rueckwand des Fachs liegt im Schatten. */
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        rect(ctx, 0.035, top, 0.93, 0.108);

        var x = 0.045;
        var b = 0;
        while (x < 0.955) {
          var s = row * 31 + b * 7 + 5;
          var bw = 0.022 + rnd(s) * 0.019;
          var bh = 0.062 + rnd(s + 1) * 0.042;
          if (x + bw > 0.955) break;

          var col = palette[Math.floor(rnd(s + 2) * palette.length)];
          ctx.fillStyle = mix([30, 20, 12], col, 0.55 + rnd(s + 3) * 0.45);
          rect(ctx, x, shelfY - bh, bw, bh);

          /* Lichtkante links, Schatten rechts — daraus wird ein Ruecken. */
          ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
          rect(ctx, x, shelfY - bh, 0.003, bh);
          ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
          rect(ctx, x + bw - 0.003, shelfY - bh, 0.003, bh);
          /* Titelpraegung */
          if (rnd(s + 4) > 0.45) {
            ctx.fillStyle = 'rgba(255, 220, 140, 0.55)';
            rect(ctx, x + 0.005, shelfY - bh * 0.68, bw - 0.01, 0.005);
          }

          x += bw + 0.002;
          b++;
        }

        /* Regalbrett mit Vorderkante. */
        ctx.fillStyle = '#3d2712';
        rect(ctx, 0.03, shelfY, 0.94, 0.016);
        ctx.fillStyle = 'rgba(255, 220, 170, 0.28)';
        rect(ctx, 0.03, shelfY, 0.94, 0.004);
      }
    },

    /* Gemaeldewand mit gerahmten Bildern. */
    paintings: function (ctx) {
      ctx.fillStyle = shade(ctx, 0, 0, 0, HORIZON, '#41569a', '#1d2b55');
      rect(ctx, 0, 0, 1, HORIZON);
      /* Tapetenstreifen. */
      ctx.fillStyle = 'rgba(255, 255, 255, 0.045)';
      for (var i = 0; i < 20; i++) rect(ctx, i * 0.05, 0, 0.025, HORIZON);
      speckle(ctx, 0, 0, 1, HORIZON, 160, '#0d1533', 0.12, 0.004, 610);

      var frames = [[0.09, 0.11, 0.23, 0.21], [0.395, 0.06, 0.21, 0.28], [0.68, 0.13, 0.23, 0.19]];
      var scenes = [
        ['#8fbf7a', '#4d7a3f'], ['#c98a9b', '#7d4a5c'], ['#7aa7cf', '#3d5f8a']
      ];

      frames.forEach(function (f, i) {
        /* Schatten hinter dem Rahmen. */
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        roundRect(ctx, f[0] + 0.006, f[1] + 0.008, f[2], f[3], 0.008);

        /* Goldrahmen mit Profil. */
        ctx.fillStyle = '#d9ae4e';
        roundRect(ctx, f[0], f[1], f[2], f[3], 0.008);
        ctx.fillStyle = 'rgba(255, 240, 190, 0.7)';
        rect(ctx, f[0], f[1], f[2], 0.005);
        ctx.fillStyle = 'rgba(90, 60, 10, 0.5)';
        rect(ctx, f[0], f[1] + f[3] - 0.005, f[2], 0.005);

        /* Leinwand: Himmel oben, Land unten. */
        var ix = f[0] + 0.015;
        var iy = f[1] + 0.015;
        var iw = f[2] - 0.03;
        var ih = f[3] - 0.03;
        ctx.fillStyle = shade(ctx, 0, iy, 0, iy + ih, scenes[i][0], scenes[i][1]);
        rect(ctx, ix, iy, iw, ih);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
        ctx.beginPath();
        ctx.moveTo(ix, iy + ih);
        ctx.lineTo(ix + iw * 0.4, iy + ih * 0.55);
        ctx.lineTo(ix + iw, iy + ih);
        ctx.closePath();
        ctx.fill();
      });
    },

    /* Garten: Himmel mit geschichteter Hecke. */
    hedge: function (ctx) {
      ctx.fillStyle = shade(ctx, 0, 0, 0, HORIZON, '#7cc9ff', '#dcf0ff');
      rect(ctx, 0, 0, 1, HORIZON);

      /* Ein paar Wolken. */
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      [[0.18, 0.1, 0.05], [0.24, 0.11, 0.038], [0.7, 0.07, 0.042], [0.76, 0.085, 0.032]]
        .forEach(function (c) { circle(ctx, c[0], c[1], c[2]); });

      /* Hecke in drei Tiefen — hinten dunkler, vorne heller. */
      var bands = [
        { y: HORIZON - 0.3, r: 0.062, col: '#1f5c2f', n: 15, seed: 10 },
        { y: HORIZON - 0.22, r: 0.055, col: '#2f7a3f', n: 18, seed: 60 },
        { y: HORIZON - 0.13, r: 0.048, col: '#3f9a52', n: 21, seed: 120 }
      ];

      bands.forEach(function (b) {
        ctx.fillStyle = b.col;
        rect(ctx, 0, b.y, 1, HORIZON - b.y);
        for (var i = 0; i <= b.n; i++) {
          circle(ctx, i / b.n, b.y + rndBetween(b.seed + i, -0.012, 0.012),
            b.r * (0.8 + rnd(b.seed + i + 200) * 0.4));
        }
      });

      /* Blattwerk. */
      speckle(ctx, 0, HORIZON - 0.32, 1, 0.32, 260, '#8fe07a', 0.22, 0.006, 700);
      speckle(ctx, 0, HORIZON - 0.32, 1, 0.32, 180, '#12401f', 0.22, 0.005, 900);
    },

    /* Gartenmauer mit Efeu. */
    wall: function (ctx) {
      ctx.fillStyle = shade(ctx, 0, 0, 0, HORIZON, '#8fcfff', '#e2f2ff');
      rect(ctx, 0, 0, 1, HORIZON);

      var top = HORIZON - 0.32;
      var rows = 5;
      var bh = 0.32 / rows;
      var dark = [140, 118, 88];
      var light = [214, 198, 168];

      for (var r = 0; r < rows; r++) {
        var y = top + r * bh;
        var offset = (r % 2) * 0.09;
        for (var c = -1; c < 7; c++) {
          brick(ctx, c * 0.18 + offset, y, 0.18 - 0.005, bh - 0.005,
            dark, light, r * 13 + c * 5 + 40);
        }
      }

      /* Mauerkrone. */
      ctx.fillStyle = '#9d8a6c';
      rect(ctx, 0, top - 0.018, 1, 0.018);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      rect(ctx, 0, top - 0.018, 1, 0.005);

      /* Efeu: Ranken mit Blattbueschel. */
      ctx.strokeStyle = '#2c6b36';
      ctx.lineWidth = 0.005;
      for (var v = 0; v < 5; v++) {
        var vx = 0.1 + v * 0.2;
        ctx.beginPath();
        ctx.moveTo(vx, top);
        ctx.quadraticCurveTo(vx + rndBetween(v + 3, -0.05, 0.05), top + 0.16, vx, HORIZON);
        ctx.stroke();
      }
      for (var i = 0; i < 60; i++) {
        var s = 800 + i * 3;
        var lx = rnd(s);
        var ly = top + rnd(s + 1) * 0.34;
        ctx.fillStyle = i % 3 === 0 ? '#5cc46e' : '#2f7a3f';
        ctx.beginPath();
        ctx.ellipse(lx, ly, 0.017, 0.012, rnd(s + 2) * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };

  /* ------------------------------------------------------------------ Boeden */

  /* Fluchtlinien: der Boden wird nach vorn breiter. Gibt die Perspektive. */
  function floorRows(count) {
    var out = [];
    for (var i = 0; i <= count; i++) {
      var t = i / count;
      out.push(HORIZON + (1 - HORIZON) * t * t);
    }
    return out;
  }

  var FLOORS = {
    marble: function (ctx) {
      ctx.fillStyle = shade(ctx, 0, HORIZON, 0, 1, '#c8d2e8', '#8f9cba');
      rect(ctx, 0, HORIZON, 1, 1 - HORIZON);

      /* Fliesen in Fluchtlinien, jede mit eigenem Ton. */
      var ys = floorRows(4);
      for (var r = 0; r < 4; r++) {
        var y0 = ys[r];
        var y1 = ys[r + 1];
        var spread = 0.16 + r * 0.14;
        for (var c = -3; c <= 3; c++) {
          var s = r * 9 + c + 20;
          ctx.fillStyle = mix([140, 152, 180], [232, 238, 250], 0.4 + rnd(s) * 0.5);
          ctx.beginPath();
          ctx.moveTo(0.5 + (c - 0.5) * spread, y0);
          ctx.lineTo(0.5 + (c + 0.5) * spread, y0);
          ctx.lineTo(0.5 + (c + 0.5) * (spread + 0.14), y1);
          ctx.lineTo(0.5 + (c - 0.5) * (spread + 0.14), y1);
          ctx.closePath();
          ctx.fill();

          ctx.strokeStyle = 'rgba(70, 84, 116, 0.45)';
          ctx.lineWidth = 0.003;
          ctx.stroke();
        }
      }

      veins(ctx, 0, HORIZON, 1, 1 - HORIZON, 9, '#5a6784', 500);

      /* Politur: ein heller Streifen, der das Licht spiegelt. */
      var gloss = ctx.createLinearGradient(0, HORIZON, 0, 1);
      gloss.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
      gloss.addColorStop(0.5, 'rgba(255, 255, 255, 0.04)');
      gloss.addColorStop(1, 'rgba(255, 255, 255, 0.12)');
      ctx.fillStyle = gloss;
      rect(ctx, 0, HORIZON, 1, 1 - HORIZON);
    },

    wood: function (ctx) {
      ctx.fillStyle = shade(ctx, 0, HORIZON, 0, 1, '#9c6b36', '#6d4720');
      rect(ctx, 0, HORIZON, 1, 1 - HORIZON);

      var ys = floorRows(5);
      for (var r = 0; r < 5; r++) {
        var y0 = ys[r];
        var y1 = ys[r + 1];
        ctx.fillStyle = mix([90, 58, 26], [176, 124, 66], 0.35 + rnd(r * 4 + 3) * 0.4);
        rect(ctx, 0, y0, 1, y1 - y0);

        /* Plankenfuge: dunkel mit heller Oberkante. */
        ctx.fillStyle = 'rgba(40, 24, 8, 0.55)';
        rect(ctx, 0, y1 - 0.005, 1, 0.005);
        ctx.fillStyle = 'rgba(255, 220, 170, 0.18)';
        rect(ctx, 0, y0, 1, 0.003);

        /* Stossfugen zwischen den Dielen. */
        var joints = 3 + r;
        for (var j = 1; j < joints; j++) {
          var jx = (j / joints) + rndBetween(r * 7 + j, -0.05, 0.05);
          ctx.fillStyle = 'rgba(40, 24, 8, 0.4)';
          rect(ctx, jx, y0, 0.004, y1 - y0);
        }
      }

      grain(ctx, 0, HORIZON, 1, 1 - HORIZON, 34, '#3d2410', 0.3, 200, false);
    },

    carpet: function (ctx) {
      ctx.fillStyle = shade(ctx, 0, HORIZON, 0, 1, '#7e3a4b', '#4d1f2b');
      rect(ctx, 0, HORIZON, 1, 1 - HORIZON);
      /* Flor: feines Rauschen in zwei Toenen. */
      speckle(ctx, 0, HORIZON, 1, 1 - HORIZON, 420, '#b05a6e', 0.18, 0.004, 1100);
      speckle(ctx, 0, HORIZON, 1, 1 - HORIZON, 300, '#38131d', 0.2, 0.004, 1400);

      /* Laeufer in der Mitte, perspektivisch. */
      function band(inset, color, alpha) {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0.5 - (0.18 + inset), 1);
        ctx.lineTo(0.5 - (0.09 + inset * 0.55), HORIZON + 0.02);
        ctx.lineTo(0.5 + (0.09 + inset * 0.55), HORIZON + 0.02);
        ctx.lineTo(0.5 + (0.18 + inset), 1);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      band(0.16, '#e0b45f', 0.55);
      band(0.1, '#8a2f42', 0.75);
      band(0.04, '#e0b45f', 0.35);

      /* Gewebter Rand. */
      ctx.strokeStyle = 'rgba(255, 226, 150, 0.5)';
      ctx.lineWidth = 0.004;
      ctx.setLineDash([0.012, 0.01]);
      ctx.beginPath();
      ctx.moveTo(0.5 - 0.34, 1);
      ctx.lineTo(0.5 - 0.178, HORIZON + 0.02);
      ctx.moveTo(0.5 + 0.34, 1);
      ctx.lineTo(0.5 + 0.178, HORIZON + 0.02);
      ctx.stroke();
      ctx.setLineDash([]);
    },

    gravel: function (ctx) {
      ctx.fillStyle = shade(ctx, 0, HORIZON, 0, 1, '#5f8a46', '#3d5f2c');
      rect(ctx, 0, HORIZON, 1, 1 - HORIZON);
      speckle(ctx, 0, HORIZON, 1, 1 - HORIZON, 260, '#7fb85e', 0.3, 0.006, 1700);

      /* Weg, der nach vorn breiter wird. */
      ctx.fillStyle = '#c4b190';
      ctx.beginPath();
      ctx.moveTo(0.34, HORIZON);
      ctx.lineTo(0.66, HORIZON);
      ctx.lineTo(1.05, 1);
      ctx.lineTo(-0.05, 1);
      ctx.closePath();
      ctx.fill();

      /* Steinchen in drei Groessen. */
      ctx.save();
      ctx.clip();
      speckle(ctx, 0, HORIZON, 1, 1 - HORIZON, 220, '#8d7b58', 0.5, 0.006, 1900);
      speckle(ctx, 0, HORIZON, 1, 1 - HORIZON, 140, '#e6dcc4', 0.5, 0.005, 2100);
      speckle(ctx, 0, HORIZON, 1, 1 - HORIZON, 70, '#6b5c3e', 0.45, 0.009, 2300);
      ctx.restore();

      /* Wegkante als Schattenfuge. */
      ctx.strokeStyle = 'rgba(50, 40, 20, 0.35)';
      ctx.lineWidth = 0.006;
      ctx.beginPath();
      ctx.moveTo(0.34, HORIZON); ctx.lineTo(-0.05, 1);
      ctx.moveTo(0.66, HORIZON); ctx.lineTo(1.05, 1);
      ctx.stroke();
    },

    stones: function (ctx) {
      ctx.fillStyle = shade(ctx, 0, HORIZON, 0, 1, '#5f8a46', '#3d5f2c');
      rect(ctx, 0, HORIZON, 1, 1 - HORIZON);
      speckle(ctx, 0, HORIZON, 1, 1 - HORIZON, 240, '#7fb85e', 0.3, 0.006, 2500);

      var ys = floorRows(4);
      for (var r = 0; r < 4; r++) {
        var y0 = ys[r];
        var h = (ys[r + 1] - y0) * 0.86;
        var spread = 0.16 + r * 0.12;
        for (var c = -3; c <= 3; c++) {
          var s = r * 17 + c + 90;
          var w = spread * 0.9;
          var x = 0.5 + c * spread - w / 2;

          /* Fugenschatten unter der Platte. */
          ctx.fillStyle = 'rgba(20, 30, 12, 0.4)';
          roundRect(ctx, x, y0 + 0.004, w, h, 0.012);

          ctx.fillStyle = mix([120, 126, 136], [206, 212, 222], 0.35 + rnd(s) * 0.5);
          roundRect(ctx, x, y0, w, h, 0.012);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
          rect(ctx, x + 0.008, y0 + 0.004, w - 0.016, 0.004);
        }
      }
      speckle(ctx, 0, HORIZON, 1, 1 - HORIZON, 200, '#5c6470', 0.16, 0.004, 2700);
    }
  };

  /* ------------------------------------------------------------------- Licht */

  var LIGHTS = {
    chandelier: function (ctx) {
      ctx.strokeStyle = '#a98b4a';
      ctx.lineWidth = 0.008;
      ctx.beginPath(); ctx.moveTo(0.5, 0); ctx.lineTo(0.5, 0.12); ctx.stroke();

      ctx.fillStyle = shade(ctx, 0.34, 0, 0.66, 0, '#f0d47c', '#b18a30');
      roundRect(ctx, 0.34, 0.12, 0.32, 0.03, 0.014);

      for (var i = 0; i < 5; i++) {
        var x = 0.37 + i * 0.065;
        ctx.fillStyle = '#e0bd63';
        rect(ctx, x - 0.008, 0.15, 0.016, 0.04);
        /* Flamme mit Hof. */
        ctx.fillStyle = 'rgba(255, 235, 160, 0.35)';
        circle(ctx, x, 0.2, 0.038);
        ctx.fillStyle = '#fff3c4';
        circle(ctx, x, 0.2, 0.019);
        ctx.fillStyle = '#ffffff';
        circle(ctx, x, 0.197, 0.009);
      }

      /* Kristallbehang. */
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      for (var k = 0; k < 9; k++) {
        var kx = 0.355 + k * 0.036;
        ctx.beginPath();
        ctx.moveTo(kx, 0.15);
        ctx.lineTo(kx + 0.008, 0.168);
        ctx.lineTo(kx, 0.19);
        ctx.lineTo(kx - 0.008, 0.168);
        ctx.closePath();
        ctx.fill();
      }

      var cone = ctx.createLinearGradient(0, 0.2, 0, HORIZON);
      cone.addColorStop(0, 'rgba(255, 235, 160, 0.3)');
      cone.addColorStop(1, 'rgba(255, 235, 160, 0)');
      ctx.fillStyle = cone;
      ctx.beginPath();
      ctx.moveTo(0.5, 0.2); ctx.lineTo(0.1, HORIZON); ctx.lineTo(0.9, HORIZON);
      ctx.closePath(); ctx.fill();
    },

    lanterns: function (ctx) {
      [0.16, 0.84].forEach(function (x) {
        ctx.fillStyle = '#3b3f52';
        rect(ctx, x - 0.012, 0.14, 0.024, 0.06);
        ctx.fillStyle = '#2f3346';
        roundRect(ctx, x - 0.05, 0.2, 0.1, 0.12, 0.014);
        /* Scheibe mit Sprossenkreuz. */
        ctx.fillStyle = shade(ctx, 0, 0.212, 0, 0.308, '#fff0b8', '#f0b23c');
        roundRect(ctx, x - 0.036, 0.212, 0.072, 0.096, 0.01);
        ctx.fillStyle = 'rgba(50, 40, 20, 0.5)';
        rect(ctx, x - 0.002, 0.212, 0.004, 0.096);
        rect(ctx, x - 0.036, 0.258, 0.072, 0.004);
        /* Dach. */
        ctx.fillStyle = '#242737';
        ctx.beginPath();
        ctx.moveTo(x - 0.06, 0.2); ctx.lineTo(x + 0.06, 0.2);
        ctx.lineTo(x + 0.03, 0.176); ctx.lineTo(x - 0.03, 0.176);
        ctx.closePath(); ctx.fill();

        var cone = ctx.createLinearGradient(0, 0.26, 0, HORIZON);
        cone.addColorStop(0, 'rgba(255, 220, 130, 0.26)');
        cone.addColorStop(1, 'rgba(255, 220, 130, 0)');
        ctx.fillStyle = cone;
        ctx.beginPath();
        ctx.moveTo(x, 0.26); ctx.lineTo(x - 0.2, HORIZON); ctx.lineTo(x + 0.2, HORIZON);
        ctx.closePath(); ctx.fill();
      });
    },

    window: function (ctx) {
      /* Laibung. */
      ctx.fillStyle = '#22305c';
      ctx.beginPath();
      ctx.moveTo(0.355, 0.42);
      ctx.lineTo(0.355, 0.16);
      ctx.arc(0.5, 0.16, 0.145, Math.PI, 0);
      ctx.lineTo(0.645, 0.42);
      ctx.closePath(); ctx.fill();

      /* Himmel mit Verlauf. */
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0.39, 0.4);
      ctx.lineTo(0.39, 0.17);
      ctx.arc(0.5, 0.17, 0.11, Math.PI, 0);
      ctx.lineTo(0.61, 0.4);
      ctx.closePath();
      ctx.clip();
      ctx.fillStyle = shade(ctx, 0, 0.06, 0, 0.4, '#bfe8ff', '#5f9fd8');
      rect(ctx, 0.38, 0.05, 0.25, 0.36);
      /* Hügel draussen. */
      ctx.fillStyle = '#4f8a5c';
      ctx.beginPath();
      ctx.ellipse(0.46, 0.42, 0.1, 0.05, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3f7a4c';
      ctx.beginPath();
      ctx.ellipse(0.58, 0.43, 0.09, 0.045, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      /* Sprossen. */
      ctx.strokeStyle = '#22305c';
      ctx.lineWidth = 0.011;
      ctx.beginPath(); ctx.moveTo(0.5, 0.06); ctx.lineTo(0.5, 0.4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0.39, 0.28); ctx.lineTo(0.61, 0.28); ctx.stroke();

      /* Fensterbank. */
      ctx.fillStyle = '#cdd2dc';
      rect(ctx, 0.34, 0.4, 0.32, 0.016);

      var beam = ctx.createLinearGradient(0, 0.4, 0, HORIZON);
      beam.addColorStop(0, 'rgba(200, 235, 255, 0.28)');
      beam.addColorStop(1, 'rgba(200, 235, 255, 0)');
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(0.4, 0.42); ctx.lineTo(0.14, HORIZON); ctx.lineTo(0.82, HORIZON);
      ctx.closePath(); ctx.fill();
    },

    lamp: function (ctx) {
      groundShadow(ctx, 0.822, HORIZON + 0.01, 0.2, 0.045);

      ctx.fillStyle = '#3b3f52';
      rect(ctx, 0.815, 0.3, 0.014, HORIZON - 0.3);
      roundRect(ctx, 0.757, HORIZON - 0.022, 0.13, 0.024, 0.011);

      /* Schirm mit Stofffalten. */
      ctx.fillStyle = shade(ctx, 0.75, 0, 0.89, 0, '#f3d79c', '#c99a4e');
      ctx.beginPath();
      ctx.moveTo(0.75, 0.3); ctx.lineTo(0.89, 0.3);
      ctx.lineTo(0.865, 0.19); ctx.lineTo(0.775, 0.19);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(120, 80, 20, 0.3)';
      ctx.lineWidth = 0.003;
      for (var i = 1; i < 5; i++) {
        var t = i / 5;
        ctx.beginPath();
        ctx.moveTo(0.775 + t * 0.09, 0.19);
        ctx.lineTo(0.75 + t * 0.14, 0.3);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255, 240, 190, 0.55)';
      rect(ctx, 0.75, 0.295, 0.14, 0.006);

      var cone = ctx.createLinearGradient(0, 0.3, 0, HORIZON);
      cone.addColorStop(0, 'rgba(255, 225, 150, 0.26)');
      cone.addColorStop(1, 'rgba(255, 225, 150, 0)');
      ctx.fillStyle = cone;
      ctx.beginPath();
      ctx.moveTo(0.75, 0.3); ctx.lineTo(0.58, HORIZON);
      ctx.lineTo(1.02, HORIZON); ctx.lineTo(0.89, 0.3);
      ctx.closePath(); ctx.fill();
    },

    fountain: function (ctx) {
      groundShadow(ctx, 0.5, HORIZON + 0.15, 0.5, 0.1);

      /* Becken. */
      ctx.fillStyle = '#a8aeba';
      ctx.beginPath();
      ctx.ellipse(0.5, HORIZON + 0.1, 0.22, 0.07, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#cdd2dc';
      ctx.beginPath();
      ctx.ellipse(0.5, HORIZON + 0.092, 0.22, 0.066, 0, 0, Math.PI * 2);
      ctx.fill();

      /* Wasser mit Spiegelung. */
      ctx.fillStyle = shade(ctx, 0, HORIZON + 0.04, 0, HORIZON + 0.15, '#8fd8f5', '#2f8fc4');
      ctx.beginPath();
      ctx.ellipse(0.5, HORIZON + 0.095, 0.185, 0.053, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      for (var w = 0; w < 4; w++) {
        ctx.beginPath();
        ctx.ellipse(0.42 + w * 0.05, HORIZON + 0.078 + (w % 2) * 0.02,
          0.03, 0.005, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      /* Saeule und Schale. */
      ctx.fillStyle = shade(ctx, 0.48, 0, 0.52, 0, '#e2e6ee', '#9aa1b0');
      rect(ctx, 0.478, HORIZON - 0.12, 0.044, 0.16);
      ctx.fillStyle = '#cdd2dc';
      ctx.beginPath();
      ctx.ellipse(0.5, HORIZON - 0.12, 0.09, 0.028, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#7fc9e8';
      ctx.beginPath();
      ctx.ellipse(0.5, HORIZON - 0.124, 0.072, 0.02, 0, 0, Math.PI * 2);
      ctx.fill();

      /* Fontaene. */
      ctx.strokeStyle = 'rgba(180, 232, 255, 0.9)';
      ctx.lineWidth = 0.009;
      ctx.lineCap = 'round';
      for (var s = -1; s <= 1; s += 2) {
        ctx.beginPath();
        ctx.moveTo(0.5, HORIZON - 0.17);
        ctx.quadraticCurveTo(0.5 + s * 0.1, HORIZON - 0.21, 0.5 + s * 0.13, HORIZON - 0.1);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(0.5, HORIZON - 0.125);
      ctx.lineTo(0.5, HORIZON - 0.19);
      ctx.stroke();
      speckle(ctx, 0.44, HORIZON - 0.2, 0.12, 0.1, 22, '#ffffff', 0.6, 0.005, 3100);
    },

    tree: function (ctx) {
      groundShadow(ctx, 0.5, HORIZON + 0.07, 0.42, 0.09);

      /* Stamm mit Rinde. */
      ctx.fillStyle = shade(ctx, 0.47, 0, 0.53, 0, '#8a6238', '#4d3319');
      rect(ctx, 0.472, HORIZON - 0.18, 0.056, 0.25);
      grain(ctx, 0.472, HORIZON - 0.18, 0.056, 0.25, 7, '#33210d', 0.5, 3300, true);

      /* Aeste. */
      ctx.strokeStyle = '#6b4a2a';
      ctx.lineWidth = 0.013;
      ctx.beginPath();
      ctx.moveTo(0.5, HORIZON - 0.14); ctx.lineTo(0.41, HORIZON - 0.2);
      ctx.moveTo(0.5, HORIZON - 0.16); ctx.lineTo(0.59, HORIZON - 0.22);
      ctx.stroke();

      /* Krone in drei Lagen. */
      ctx.fillStyle = '#d98bb0';
      circle(ctx, 0.38, HORIZON - 0.2, 0.1);
      circle(ctx, 0.62, HORIZON - 0.2, 0.1);
      circle(ctx, 0.5, HORIZON - 0.26, 0.15);
      ctx.fillStyle = '#f2a6c4';
      circle(ctx, 0.44, HORIZON - 0.28, 0.09);
      circle(ctx, 0.58, HORIZON - 0.26, 0.085);
      ctx.fillStyle = 'rgba(255, 235, 245, 0.5)';
      circle(ctx, 0.45, HORIZON - 0.32, 0.045);

      /* Bluetenblaetter. */
      speckle(ctx, 0.3, HORIZON - 0.4, 0.42, 0.3, 90, '#ffd9ea', 0.5, 0.006, 3500);
      /* Ein paar fallen. */
      speckle(ctx, 0.28, HORIZON - 0.1, 0.46, 0.24, 26, '#f2a6c4', 0.45, 0.005, 3700);
    }
  };

  /* ------------------------------------------------------------------ Moebel */

  var THINGS = {
    armor: function (ctx) {
      var base = HORIZON + 0.16;
      groundShadow(ctx, 0.2, base + 0.005, 0.22, 0.05);

      var steel = shade(ctx, 0.14, 0, 0.27, 0, '#c3cad8', '#6a7285');

      /* Sockel. */
      ctx.fillStyle = '#4a4f5e';
      roundRect(ctx, 0.155, base - 0.018, 0.09, 0.02, 0.006);

      /* Beine. */
      ctx.fillStyle = steel;
      roundRect(ctx, 0.172, base - 0.075, 0.024, 0.06, 0.008);
      roundRect(ctx, 0.204, base - 0.075, 0.024, 0.06, 0.008);

      /* Brustpanzer. */
      ctx.beginPath();
      ctx.moveTo(0.162, base - 0.165);
      ctx.lineTo(0.238, base - 0.165);
      ctx.quadraticCurveTo(0.244, base - 0.11, 0.2, base - 0.07);
      ctx.quadraticCurveTo(0.156, base - 0.11, 0.162, base - 0.165);
      ctx.closePath();
      ctx.fill();

      /* Schulterstuecke. */
      ctx.beginPath();
      ctx.ellipse(0.158, base - 0.158, 0.024, 0.017, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0.242, base - 0.158, 0.024, 0.017, 0.3, 0, Math.PI * 2);
      ctx.fill();

      /* Arme. */
      roundRect(ctx, 0.142, base - 0.15, 0.02, 0.078, 0.008);
      roundRect(ctx, 0.238, base - 0.15, 0.02, 0.078, 0.008);

      /* Helm mit Visier und Federbusch. */
      ctx.beginPath();
      ctx.arc(0.2, base - 0.196, 0.031, Math.PI, Math.PI * 2);
      ctx.rect(0.169, base - 0.196, 0.062, 0.026);
      ctx.fill();
      ctx.fillStyle = '#20242f';
      rect(ctx, 0.178, base - 0.188, 0.044, 0.009);
      ctx.fillStyle = '#c9455e';
      ctx.beginPath();
      ctx.ellipse(0.2, base - 0.232, 0.012, 0.022, 0, 0, Math.PI * 2);
      ctx.fill();

      /* Glanzkante. */
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      rect(ctx, 0.172, base - 0.158, 0.008, 0.075);

      /* Hellebarde. */
      ctx.fillStyle = '#6b4a2a';
      rect(ctx, 0.262, base - 0.24, 0.007, 0.24);
      ctx.fillStyle = '#d9ae4e';
      ctx.beginPath();
      ctx.moveTo(0.2655, base - 0.28);
      ctx.lineTo(0.284, base - 0.235);
      ctx.lineTo(0.2655, base - 0.222);
      ctx.closePath();
      ctx.fill();
    },

    plant: function (ctx) {
      var base = HORIZON + 0.16;
      groundShadow(ctx, 0.2, base + 0.005, 0.2, 0.045);

      /* Topf mit Rand und Glanz. */
      ctx.fillStyle = shade(ctx, 0.15, 0, 0.25, 0, '#c47a4c', '#83452a');
      ctx.beginPath();
      ctx.moveTo(0.152, base);
      ctx.lineTo(0.248, base);
      ctx.lineTo(0.234, base - 0.082);
      ctx.lineTo(0.166, base - 0.082);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#a8623b';
      roundRect(ctx, 0.16, base - 0.095, 0.08, 0.018, 0.005);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      rect(ctx, 0.174, base - 0.075, 0.009, 0.06);

      /* Erde. */
      ctx.fillStyle = '#3d2a17';
      roundRect(ctx, 0.168, base - 0.09, 0.064, 0.008, 0.004);

      /* Wedel in zwei Tiefen. Die Spreizung ist bewusst knapp: die Moebel
         werden beim Zeichnen noch um ein Drittel vergroessert, und ein
         weiter ausladender Wedel haengt dann links aus dem Bild. */
      ctx.lineCap = 'round';
      for (var layer = 0; layer < 2; layer++) {
        ctx.strokeStyle = layer ? '#3f9a52' : '#2c6b36';
        ctx.lineWidth = layer ? 0.013 : 0.015;
        for (var i = -2; i <= 2; i++) {
          var spread = 0.058 + layer * 0.014;
          ctx.beginPath();
          ctx.moveTo(0.2, base - 0.09);
          ctx.quadraticCurveTo(0.2 + i * 0.035, base - 0.2,
            0.2 + i * spread, base - 0.235 - layer * 0.015);
          ctx.stroke();
        }
      }
      /* Junge Triebe. */
      ctx.fillStyle = '#8fe07a';
      circle(ctx, 0.2, base - 0.25, 0.012);
    },

    armchair: function (ctx) {
      var base = HORIZON + 0.2;
      groundShadow(ctx, 0.28, base + 0.005, 0.34, 0.06);

      /* Beine. */
      ctx.fillStyle = '#4a2a18';
      roundRect(ctx, 0.19, base - 0.035, 0.022, 0.035, 0.006);
      roundRect(ctx, 0.35, base - 0.035, 0.022, 0.035, 0.006);

      /* Rueckenlehne. */
      ctx.fillStyle = shade(ctx, 0.16, 0, 0.4, 0, '#9c5069', '#63303f');
      roundRect(ctx, 0.16, base - 0.235, 0.24, 0.17, 0.035);
      /* Knopfheftung. */
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      for (var r = 0; r < 2; r++) {
        for (var c = 0; c < 3; c++) {
          circle(ctx, 0.205 + c * 0.075, base - 0.2 + r * 0.05, 0.006);
        }
      }

      /* Sitzkissen. */
      ctx.fillStyle = shade(ctx, 0, base - 0.1, 0, base - 0.03, '#b05c78', '#7b3f52');
      roundRect(ctx, 0.168, base - 0.105, 0.224, 0.075, 0.022);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
      roundRect(ctx, 0.178, base - 0.1, 0.204, 0.012, 0.006);

      /* Armlehnen. */
      ctx.fillStyle = '#7b3f52';
      roundRect(ctx, 0.148, base - 0.13, 0.044, 0.1, 0.018);
      roundRect(ctx, 0.368, base - 0.13, 0.044, 0.1, 0.018);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      roundRect(ctx, 0.152, base - 0.128, 0.036, 0.012, 0.006);
      roundRect(ctx, 0.372, base - 0.128, 0.036, 0.012, 0.006);
    },

    desk: function (ctx) {
      var base = HORIZON + 0.2;
      groundShadow(ctx, 0.29, base + 0.005, 0.34, 0.055);

      /* Beine. */
      ctx.fillStyle = '#5f3d1c';
      rect(ctx, 0.158, base - 0.1, 0.024, 0.1);
      rect(ctx, 0.398, base - 0.1, 0.024, 0.1);

      /* Korpus mit Schublade. */
      ctx.fillStyle = shade(ctx, 0, base - 0.1, 0, base - 0.04, '#8a5f2e', '#5f3d1c');
      roundRect(ctx, 0.2, base - 0.1, 0.17, 0.058, 0.008);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      rect(ctx, 0.21, base - 0.074, 0.15, 0.003);
      ctx.fillStyle = '#d9ae4e';
      circle(ctx, 0.285, base - 0.086, 0.008);
      circle(ctx, 0.285, base - 0.058, 0.008);

      /* Platte mit Maserung und Kante. */
      ctx.fillStyle = shade(ctx, 0.14, 0, 0.44, 0, '#a4703a', '#734a20');
      roundRect(ctx, 0.14, base - 0.124, 0.3, 0.026, 0.008);
      grain(ctx, 0.14, base - 0.124, 0.3, 0.026, 8, '#4a2f12', 0.35, 4100, false);
      ctx.fillStyle = 'rgba(255, 226, 180, 0.35)';
      rect(ctx, 0.14, base - 0.124, 0.3, 0.005);

      /* Buch, Feder und Tintenfass. */
      ctx.fillStyle = '#c9455e';
      roundRect(ctx, 0.34, base - 0.154, 0.058, 0.03, 0.004);
      ctx.fillStyle = '#e8e2d0';
      rect(ctx, 0.344, base - 0.15, 0.05, 0.022);
      ctx.fillStyle = '#2f3346';
      circle(ctx, 0.19, base - 0.136, 0.014);
      ctx.strokeStyle = '#e8e2d0';
      ctx.lineWidth = 0.005;
      ctx.beginPath();
      ctx.moveTo(0.19, base - 0.145);
      ctx.quadraticCurveTo(0.215, base - 0.19, 0.235, base - 0.2);
      ctx.stroke();
    },

    bench: function (ctx) {
      var base = HORIZON + 0.2;
      groundShadow(ctx, 0.29, base + 0.005, 0.34, 0.055);

      /* Gusseiserne Wangen. */
      ctx.fillStyle = '#3b3f52';
      roundRect(ctx, 0.152, base - 0.095, 0.024, 0.095, 0.007);
      roundRect(ctx, 0.404, base - 0.095, 0.024, 0.095, 0.007);
      ctx.beginPath();
      ctx.arc(0.164, base - 0.11, 0.022, Math.PI, 0);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0.416, base - 0.11, 0.022, Math.PI, 0);
      ctx.fill();

      /* Latten mit Fase. */
      for (var i = 0; i < 3; i++) {
        var y = base - 0.198 + i * 0.03;
        ctx.fillStyle = shade(ctx, 0.14, 0, 0.44, 0, '#a4703a', '#714a24');
        roundRect(ctx, 0.14, y, 0.3, 0.02, 0.007);
        ctx.fillStyle = 'rgba(255, 226, 180, 0.3)';
        rect(ctx, 0.14, y, 0.3, 0.004);
      }
      for (var k = 0; k < 2; k++) {
        var sy = base - 0.105 + k * 0.028;
        ctx.fillStyle = shade(ctx, 0.14, 0, 0.44, 0, '#b07b40', '#7d5228');
        roundRect(ctx, 0.14, sy, 0.3, 0.022, 0.007);
        ctx.fillStyle = 'rgba(255, 226, 180, 0.3)';
        rect(ctx, 0.14, sy, 0.3, 0.004);
      }
    },

    swing: function (ctx) {
      var base = HORIZON + 0.2;
      groundShadow(ctx, 0.3, base + 0.005, 0.38, 0.055);

      /* Gestell. */
      ctx.strokeStyle = '#4a4f5e';
      ctx.lineWidth = 0.014;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0.13, base); ctx.lineTo(0.2, base - 0.29);
      ctx.lineTo(0.42, base - 0.29); ctx.lineTo(0.49, base);
      ctx.stroke();

      /* Ketten. */
      ctx.strokeStyle = '#6a7285';
      ctx.lineWidth = 0.007;
      ctx.beginPath();
      ctx.moveTo(0.235, base - 0.288); ctx.lineTo(0.235, base - 0.135);
      ctx.moveTo(0.385, base - 0.288); ctx.lineTo(0.385, base - 0.135);
      ctx.stroke();

      /* Baldachin. */
      ctx.fillStyle = '#3f7fd0';
      ctx.beginPath();
      ctx.moveTo(0.185, base - 0.29);
      ctx.lineTo(0.435, base - 0.29);
      ctx.lineTo(0.415, base - 0.315);
      ctx.lineTo(0.205, base - 0.315);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      for (var i = 0; i < 5; i++) rect(ctx, 0.205 + i * 0.046, base - 0.315, 0.022, 0.025);

      /* Sitz und Kissen. */
      ctx.fillStyle = shade(ctx, 0.2, 0, 0.42, 0, '#7bc0ef', '#3f7fd0');
      roundRect(ctx, 0.2, base - 0.145, 0.22, 0.038, 0.012);
      ctx.fillStyle = shade(ctx, 0.2, 0, 0.42, 0, '#a8dcff', '#5aa5e0');
      roundRect(ctx, 0.2, base - 0.2, 0.22, 0.058, 0.014);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      roundRect(ctx, 0.208, base - 0.196, 0.204, 0.01, 0.005);
      /* Kissen. */
      ctx.fillStyle = '#f2d08a';
      roundRect(ctx, 0.35, base - 0.192, 0.055, 0.042, 0.012);
    }
  };

  /* Welche Schicht zeichnet welche Aufgabe? */
  var LAYERS = { wall: WALLS, floor: FLOORS, light: LIGHTS, deco: THINGS, seat: THINGS };

  /* Wo der Platzhalter sitzt, wenn eine Aufgabe noch offen ist.

     Die Kaesten duerfen sich nicht ueberschneiden — im leeren Zimmer stehen
     alle vier gleichzeitig da, und uebereinanderliegende Beschriftungen sind
     unlesbar. Deshalb: Licht ganz oben, Wand als breites Band darunter,
     Deko links unten und der Boden rechts daneben. */
  var SPOTS = {
    light: [0.40, 0.04, 0.20, 0.14, 'Licht'],
    wall: [0.08, 0.22, 0.84, 0.26, 'Wand'],
    deco: [0.06, HORIZON - 0.06, 0.24, 0.28, 'Deko'],
    seat: [0.06, HORIZON - 0.06, 0.24, 0.28, 'Möbel'],
    floor: [0.36, HORIZON + 0.08, 0.58, 0.22, 'Boden']
  };

  /* ---------------------------------------------------------------- Ausgabe */

  /* Zeichnet ein Zimmer in ein Canvas. `chosen` bildet Aufgaben-Schluessel auf
     gewaehlte Varianten ab; fehlende Eintraege werden zu Platzhaltern. */
  RoomArt.draw = function (canvas, room, chosen, width, height) {
    if (!canvas || !room) return false;

    var dpr = Math.min(root.devicePixelRatio || 1, 2);
    var picks = chosen || {};

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr * width, 0, 0, dpr * height, 0, 0);
    ctx.clearRect(0, 0, 1, 1);

    /* Grundton, falls Wand oder Boden noch offen sind. */
    ctx.fillStyle = '#1a2a5c';
    rect(ctx, 0, 0, 1, HORIZON);
    ctx.fillStyle = '#132048';
    rect(ctx, 0, HORIZON, 1, 1 - HORIZON);

    /* Reihenfolge ist wichtig: Wand ganz hinten, Moebel ganz vorn. */
    ['wall', 'floor', 'light', 'seat', 'deco'].forEach(function (layer) {
      var task = null;
      for (var i = 0; i < room.tasks.length; i++) {
        if (room.tasks[i].key === layer) task = room.tasks[i];
      }
      if (!task) return;

      var pick = picks[task.key];
      var art = pick && LAYERS[layer] ? LAYERS[layer][pick] : null;
      if (!art) return;

      ctx.save();
      /* Moebel werden an ihrem Standpunkt vergroessert. Direkt groesser
         gezeichnet muessten sonst alle Koordinaten von Hand nachziehen —
         und der Boden liegt fest, das Moebel muss darauf stehen bleiben. */
      if (layer === 'seat' || layer === 'deco') {
        var anchorY = HORIZON + 0.2;
        ctx.translate(0.27, anchorY);
        ctx.scale(1.34, 1.34);
        ctx.translate(-0.27, -anchorY);
      }
      art(ctx);
      ctx.restore();

      /* Schattenfuge zwischen Wand und Boden, sobald beide stehen — ohne sie
         schweben die Waende ueber dem Boden. */
      if (layer === 'floor' && picks.wall) {
        var seam = ctx.createLinearGradient(0, HORIZON - 0.03, 0, HORIZON + 0.05);
        seam.addColorStop(0, 'rgba(0, 0, 0, 0)');
        seam.addColorStop(0.45, 'rgba(0, 0, 0, 0.45)');
        seam.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = seam;
        rect(ctx, 0, HORIZON - 0.03, 1, 0.08);
      }
    });

    /* Platzhalter zuletzt, damit sie ueber allem liegen und auffallen. */
    room.tasks.forEach(function (task) {
      if (picks[task.key]) return;
      var spot = SPOTS[task.key];
      if (!spot) return;
      placeholder(ctx, spot[0], spot[1], spot[2], spot[3], spot[4],
        { dpr: dpr, w: width, h: height });
    });

    /* Ein Hauch Vignette bindet die Schichten zusammen. */
    var vig = ctx.createRadialGradient(0.5, 0.5, 0.25, 0.5, 0.5, 0.78);
    vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vig.addColorStop(1, 'rgba(0, 0, 0, 0.35)');
    ctx.fillStyle = vig;
    rect(ctx, 0, 0, 1, 1);

    return true;
  };

  /* Kleine Vorschau einer einzelnen Variante — fuer die Auswahlkarten. Es
     wird dasselbe Zimmer gezeichnet, aber nur mit dieser einen Wahl, damit
     man sieht, was man kauft. */
  RoomArt.drawOption = function (canvas, room, chosen, taskKey, optionKey, width, height) {
    var preview = {};
    Object.keys(chosen || {}).forEach(function (k) { preview[k] = chosen[k]; });
    preview[taskKey] = optionKey;

    /* Im kleinen Bild stoeren Platzhalter mehr, als sie helfen: hier zaehlt
       nur, wie die eine Variante aussieht. */
    var slim = {
      key: room.key,
      name: room.name,
      tasks: room.tasks.filter(function (t) { return preview[t.key]; })
    };

    return RoomArt.draw(canvas, slim, preview, width, height);
  };

  RoomArt.HORIZON = HORIZON;

  /* Die Bausteine liegen offen, damit die Kulisse hinter dem Spielfeld
     (js/scene.js) dieselben Waende, Boeden, Lichter und Moebel benutzen
     kann. Sie zeichnen alle in 0..1 mit HORIZON als Trennlinie, also passen
     sie ohne Umrechnung. */
  RoomArt.LAYERS = LAYERS;

  root.M3 = root.M3 || {};
  root.M3.RoomArt = RoomArt;

  if (typeof module !== 'undefined' && module.exports) module.exports = RoomArt;

})(typeof globalThis !== 'undefined' ? globalThis : this);
