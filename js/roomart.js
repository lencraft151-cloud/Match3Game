/* ==========================================================================
   RoomArt — die Zimmer zeichnen.

   Alles auf ein Canvas, in einem Koordinatensystem von 0 bis 1. Damit sieht
   das Zimmer in der kleinen Vorschau genauso aus wie gross, und es braucht
   keine einzige Bilddatei — das Spiel bleibt eine Handvoll Textdateien.

   Gezeichnet wird in Schichten von hinten nach vorn: Wand, Boden, Licht,
   Moebel. Was noch nicht gekauft ist, bekommt einen gestrichelten Platzhalter
   — man soll sehen, dass da etwas fehlt, nicht raten muessen.
   ========================================================================== */

(function (root) {
  'use strict';

  var RoomArt = {};

  /* Horizont: darueber Wand, darunter Boden. */
  var HORIZON = 0.62;

  /* ------------------------------------------------------------- Hilfsformen */

  function rect(ctx, x, y, w, h) {
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.fill();
  }

  function roundRect(ctx, x, y, w, h, r) {
    var rad = Math.min(r, w / 2, h / 2);
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

  /* Ein gestrichelter Platzhalter, wo noch nichts steht. */
  function placeholder(ctx, x, y, w, h, label) {
    ctx.save();
    ctx.setLineDash([0.022, 0.02]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.42)';
    ctx.lineWidth = 0.008;
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '600 ' + (0.036) + 'px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label || '?', x + w / 2, y + h / 2);
    ctx.restore();
  }

  /* ------------------------------------------------------------------ Waende */

  var WALLS = {
    /* Eingangshalle */
    stone: function (ctx) {
      ctx.fillStyle = shade(ctx, 0, 0, 0, HORIZON, '#e8d5ae', '#c2a97f');
      rect(ctx, 0, 0, 1, HORIZON);

      ctx.strokeStyle = 'rgba(120, 92, 50, 0.35)';
      ctx.lineWidth = 0.005;
      for (var r = 1; r < 6; r++) {
        var y = (HORIZON / 6) * r;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1, y); ctx.stroke();
        for (var c = 0; c < 5; c++) {
          var x = c * 0.2 + (r % 2 ? 0.1 : 0);
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - HORIZON / 6); ctx.stroke();
        }
      }
    },
    panel: function (ctx) {
      ctx.fillStyle = shade(ctx, 0, 0, 0, HORIZON, '#7a4f2e', '#4e3018');
      rect(ctx, 0, 0, 1, HORIZON);

      ctx.fillStyle = 'rgba(255, 226, 180, 0.13)';
      for (var i = 0; i < 6; i++) roundRect(ctx, 0.03 + i * 0.161, 0.1, 0.12, HORIZON - 0.18, 0.012);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      rect(ctx, 0, HORIZON - 0.05, 1, 0.05);
    },

    /* Bibliothek */
    shelves: function (ctx) {
      ctx.fillStyle = shade(ctx, 0, 0, 0, HORIZON, '#5b3a20', '#38230f');
      rect(ctx, 0, 0, 1, HORIZON);

      var colors = ['#c9455e', '#3f7fd6', '#57a86b', '#d69b3f', '#8f5fd0', '#d0625a'];
      for (var row = 0; row < 4; row++) {
        var top = 0.05 + row * 0.135;
        ctx.fillStyle = '#2a1a0c';
        rect(ctx, 0.04, top + 0.105, 0.92, 0.014);

        for (var b = 0; b < 22; b++) {
          var h = 0.06 + ((b * 37) % 5) * 0.008;
          ctx.fillStyle = colors[(row * 7 + b) % colors.length];
          rect(ctx, 0.05 + b * 0.0415, top + 0.105 - h, 0.032, h);
        }
      }
    },
    paintings: function (ctx) {
      ctx.fillStyle = shade(ctx, 0, 0, 0, HORIZON, '#3b4f8f', '#22305c');
      rect(ctx, 0, 0, 1, HORIZON);

      var frames = [[0.1, 0.1, 0.22, 0.2], [0.4, 0.06, 0.2, 0.26], [0.68, 0.12, 0.22, 0.18]];
      frames.forEach(function (f, i) {
        ctx.fillStyle = '#d9ae4e';
        roundRect(ctx, f[0], f[1], f[2], f[3], 0.008);
        ctx.fillStyle = ['#8fbf7a', '#c98a9b', '#7aa7cf'][i];
        rect(ctx, f[0] + 0.014, f[1] + 0.014, f[2] - 0.028, f[3] - 0.028);
      });
    },

    /* Garten */
    hedge: function (ctx) {
      ctx.fillStyle = shade(ctx, 0, 0, 0, HORIZON, '#8fd2ff', '#d6efff');
      rect(ctx, 0, 0, 1, HORIZON);

      ctx.fillStyle = '#2f7a3f';
      rect(ctx, 0, HORIZON - 0.26, 1, 0.26);
      ctx.fillStyle = '#3f9a52';
      for (var i = 0; i < 16; i++) circle(ctx, i * 0.066 + 0.03, HORIZON - 0.26, 0.05);
    },
    wall: function (ctx) {
      ctx.fillStyle = shade(ctx, 0, 0, 0, HORIZON, '#9fd8ff', '#e2f2ff');
      rect(ctx, 0, 0, 1, HORIZON);

      ctx.fillStyle = '#b9a68a';
      rect(ctx, 0, HORIZON - 0.3, 1, 0.3);
      ctx.strokeStyle = 'rgba(90, 70, 45, 0.4)';
      ctx.lineWidth = 0.005;
      for (var r = 0; r < 4; r++) {
        var y = HORIZON - 0.3 + r * 0.075;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1, y); ctx.stroke();
      }
      /* Efeu. */
      ctx.fillStyle = '#3f9a52';
      for (var i = 0; i < 26; i++) {
        var x = (i * 0.113) % 1;
        circle(ctx, x, HORIZON - 0.3 + ((i * 53) % 7) * 0.035, 0.022);
      }
    }
  };

  /* ------------------------------------------------------------------ Boeden */

  var FLOORS = {
    marble: function (ctx) {
      ctx.fillStyle = shade(ctx, 0, HORIZON, 0, 1, '#dfe6f5', '#aab6d0');
      rect(ctx, 0, HORIZON, 1, 1 - HORIZON);

      ctx.strokeStyle = 'rgba(70, 90, 130, 0.3)';
      ctx.lineWidth = 0.005;
      for (var i = -4; i < 10; i++) {
        ctx.beginPath();
        ctx.moveTo(0.5 + i * 0.09, HORIZON);
        ctx.lineTo(0.5 + i * 0.3, 1);
        ctx.stroke();
      }
      for (var r = 1; r < 4; r++) {
        var y = HORIZON + (1 - HORIZON) * (r / 4) * (r / 4);
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1, y); ctx.stroke();
      }
    },
    wood: function (ctx) {
      ctx.fillStyle = shade(ctx, 0, HORIZON, 0, 1, '#a9773f', '#7a5228');
      rect(ctx, 0, HORIZON, 1, 1 - HORIZON);

      ctx.strokeStyle = 'rgba(50, 30, 10, 0.4)';
      ctx.lineWidth = 0.005;
      for (var r = 1; r < 5; r++) {
        var y = HORIZON + (1 - HORIZON) * (r / 5) * (r / 5);
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1, y); ctx.stroke();
      }
    },
    carpet: function (ctx) {
      ctx.fillStyle = shade(ctx, 0, HORIZON, 0, 1, '#8a4152', '#5c2634');
      rect(ctx, 0, HORIZON, 1, 1 - HORIZON);

      ctx.fillStyle = 'rgba(255, 208, 120, 0.5)';
      ctx.beginPath();
      ctx.moveTo(0.16, 1); ctx.lineTo(0.34, HORIZON + 0.03);
      ctx.lineTo(0.66, HORIZON + 0.03); ctx.lineTo(0.84, 1);
      ctx.closePath(); ctx.fill();

      ctx.fillStyle = 'rgba(120, 40, 60, 0.7)';
      ctx.beginPath();
      ctx.moveTo(0.24, 1); ctx.lineTo(0.39, HORIZON + 0.06);
      ctx.lineTo(0.61, HORIZON + 0.06); ctx.lineTo(0.76, 1);
      ctx.closePath(); ctx.fill();
    },
    gravel: function (ctx) {
      ctx.fillStyle = shade(ctx, 0, HORIZON, 0, 1, '#6f9a52', '#4a6f36');
      rect(ctx, 0, HORIZON, 1, 1 - HORIZON);

      ctx.fillStyle = '#cbb894';
      ctx.beginPath();
      ctx.moveTo(0.3, HORIZON); ctx.lineTo(0.7, HORIZON);
      ctx.lineTo(1, 1); ctx.lineTo(0, 1);
      ctx.closePath(); ctx.fill();

      ctx.fillStyle = 'rgba(120, 100, 70, 0.35)';
      for (var i = 0; i < 44; i++) {
        var t = (i * 37 % 100) / 100;
        var y = HORIZON + (1 - HORIZON) * ((i * 17 % 100) / 100);
        circle(ctx, 0.5 + (t - 0.5) * (0.4 + (y - HORIZON) * 2.4), y, 0.008);
      }
    },
    stones: function (ctx) {
      ctx.fillStyle = shade(ctx, 0, HORIZON, 0, 1, '#6f9a52', '#4a6f36');
      rect(ctx, 0, HORIZON, 1, 1 - HORIZON);

      ctx.fillStyle = '#b9bec9';
      for (var r = 0; r < 4; r++) {
        var y = HORIZON + (1 - HORIZON) * (r / 4);
        var h = (1 - HORIZON) / 4.6;
        var spread = 0.14 + r * 0.1;
        for (var c = -2; c <= 2; c++) {
          roundRect(ctx, 0.5 + c * spread - spread * 0.44, y, spread * 0.88, h, 0.01);
        }
      }
    }
  };

  /* ------------------------------------------------------------------- Licht */

  var LIGHTS = {
    chandelier: function (ctx) {
      ctx.strokeStyle = '#a98b4a';
      ctx.lineWidth = 0.008;
      ctx.beginPath(); ctx.moveTo(0.5, 0); ctx.lineTo(0.5, 0.12); ctx.stroke();

      ctx.fillStyle = '#e0bd63';
      roundRect(ctx, 0.34, 0.12, 0.32, 0.03, 0.014);

      for (var i = 0; i < 5; i++) {
        var x = 0.37 + i * 0.065;
        ctx.fillStyle = '#e0bd63';
        rect(ctx, x - 0.008, 0.15, 0.016, 0.04);
        ctx.fillStyle = '#fff3c4';
        circle(ctx, x, 0.2, 0.022);
      }

      ctx.fillStyle = 'rgba(255, 235, 160, 0.18)';
      ctx.beginPath();
      ctx.moveTo(0.5, 0.2); ctx.lineTo(0.12, HORIZON); ctx.lineTo(0.88, HORIZON);
      ctx.closePath(); ctx.fill();
    },
    lanterns: function (ctx) {
      [0.16, 0.84].forEach(function (x) {
        ctx.fillStyle = '#4b4f63';
        rect(ctx, x - 0.012, 0.14, 0.024, 0.06);
        ctx.fillStyle = '#2f3346';
        roundRect(ctx, x - 0.05, 0.2, 0.1, 0.12, 0.014);
        ctx.fillStyle = '#ffdb7a';
        roundRect(ctx, x - 0.036, 0.212, 0.072, 0.096, 0.01);

        ctx.fillStyle = 'rgba(255, 220, 130, 0.16)';
        ctx.beginPath();
        ctx.moveTo(x, 0.26); ctx.lineTo(x - 0.18, HORIZON); ctx.lineTo(x + 0.18, HORIZON);
        ctx.closePath(); ctx.fill();
      });
    },
    window: function (ctx) {
      ctx.fillStyle = '#2b3a68';
      ctx.beginPath();
      ctx.moveTo(0.36, 0.42);
      ctx.lineTo(0.36, 0.16);
      ctx.arc(0.5, 0.16, 0.14, Math.PI, 0);
      ctx.lineTo(0.64, 0.42);
      ctx.closePath(); ctx.fill();

      ctx.fillStyle = '#9fd8ff';
      ctx.beginPath();
      ctx.moveTo(0.39, 0.4);
      ctx.lineTo(0.39, 0.17);
      ctx.arc(0.5, 0.17, 0.11, Math.PI, 0);
      ctx.lineTo(0.61, 0.4);
      ctx.closePath(); ctx.fill();

      ctx.strokeStyle = '#2b3a68';
      ctx.lineWidth = 0.01;
      ctx.beginPath(); ctx.moveTo(0.5, 0.07); ctx.lineTo(0.5, 0.4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0.39, 0.28); ctx.lineTo(0.61, 0.28); ctx.stroke();

      ctx.fillStyle = 'rgba(190, 230, 255, 0.2)';
      ctx.beginPath();
      ctx.moveTo(0.4, 0.4); ctx.lineTo(0.16, HORIZON); ctx.lineTo(0.8, HORIZON);
      ctx.closePath(); ctx.fill();
    },
    lamp: function (ctx) {
      ctx.fillStyle = '#4b4f63';
      rect(ctx, 0.815, 0.3, 0.014, HORIZON - 0.3);
      roundRect(ctx, 0.76, HORIZON - 0.02, 0.125, 0.022, 0.01);

      ctx.fillStyle = '#e8c27a';
      ctx.beginPath();
      ctx.moveTo(0.75, 0.3); ctx.lineTo(0.89, 0.3);
      ctx.lineTo(0.865, 0.19); ctx.lineTo(0.775, 0.19);
      ctx.closePath(); ctx.fill();

      ctx.fillStyle = 'rgba(255, 225, 150, 0.16)';
      ctx.beginPath();
      ctx.moveTo(0.75, 0.3); ctx.lineTo(0.6, HORIZON); ctx.lineTo(1, HORIZON);
      ctx.lineTo(0.89, 0.3);
      ctx.closePath(); ctx.fill();
    },
    fountain: function (ctx) {
      ctx.fillStyle = '#b9bec9';
      ctx.beginPath();
      ctx.ellipse(0.5, HORIZON + 0.1, 0.22, 0.07, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5fb8e8';
      ctx.beginPath();
      ctx.ellipse(0.5, HORIZON + 0.095, 0.185, 0.055, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#cdd2dc';
      rect(ctx, 0.48, HORIZON - 0.12, 0.04, 0.16);
      ctx.beginPath();
      ctx.ellipse(0.5, HORIZON - 0.12, 0.09, 0.028, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(160, 220, 255, 0.85)';
      ctx.lineWidth = 0.009;
      for (var s = -1; s <= 1; s += 2) {
        ctx.beginPath();
        ctx.moveTo(0.5, HORIZON - 0.16);
        ctx.quadraticCurveTo(0.5 + s * 0.1, HORIZON - 0.2, 0.5 + s * 0.13, HORIZON - 0.09);
        ctx.stroke();
      }
    },
    tree: function (ctx) {
      ctx.fillStyle = '#6b4a2a';
      rect(ctx, 0.475, HORIZON - 0.18, 0.05, 0.24);

      ctx.fillStyle = '#f2a6c4';
      circle(ctx, 0.5, HORIZON - 0.26, 0.15);
      circle(ctx, 0.38, HORIZON - 0.2, 0.1);
      circle(ctx, 0.62, HORIZON - 0.2, 0.1);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      circle(ctx, 0.45, HORIZON - 0.31, 0.05);
    }
  };

  /* ------------------------------------------------------------------ Moebel */

  var THINGS = {
    armor: function (ctx) {
      var base = HORIZON + 0.16;
      ctx.fillStyle = '#8f96ab';
      circle(ctx, 0.2, base - 0.2, 0.035);
      roundRect(ctx, 0.16, base - 0.17, 0.08, 0.1, 0.018);
      rect(ctx, 0.145, base - 0.15, 0.02, 0.08);
      rect(ctx, 0.235, base - 0.15, 0.02, 0.08);
      rect(ctx, 0.172, base - 0.07, 0.022, 0.07);
      rect(ctx, 0.206, base - 0.07, 0.022, 0.07);
      ctx.fillStyle = '#5c6478';
      rect(ctx, 0.19, base - 0.215, 0.02, 0.03);
      ctx.fillStyle = '#d9ae4e';
      rect(ctx, 0.256, base - 0.19, 0.008, 0.19);
    },
    plant: function (ctx) {
      var base = HORIZON + 0.16;
      ctx.fillStyle = '#a8623b';
      ctx.beginPath();
      ctx.moveTo(0.15, base); ctx.lineTo(0.25, base);
      ctx.lineTo(0.235, base - 0.08); ctx.lineTo(0.165, base - 0.08);
      ctx.closePath(); ctx.fill();

      ctx.strokeStyle = '#3f9a52';
      ctx.lineWidth = 0.014;
      ctx.lineCap = 'round';
      for (var i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(0.2, base - 0.08);
        ctx.quadraticCurveTo(0.2 + i * 0.05, base - 0.2, 0.2 + i * 0.085, base - 0.24);
        ctx.stroke();
      }
    },
    armchair: function (ctx) {
      var base = HORIZON + 0.2;
      ctx.fillStyle = '#7b3f52';
      roundRect(ctx, 0.16, base - 0.22, 0.24, 0.16, 0.03);
      ctx.fillStyle = '#9c5069';
      roundRect(ctx, 0.17, base - 0.1, 0.22, 0.07, 0.02);
      ctx.fillStyle = '#7b3f52';
      roundRect(ctx, 0.15, base - 0.12, 0.045, 0.1, 0.018);
      roundRect(ctx, 0.365, base - 0.12, 0.045, 0.1, 0.018);
      ctx.fillStyle = '#4a2a18';
      rect(ctx, 0.19, base - 0.03, 0.02, 0.03);
      rect(ctx, 0.35, base - 0.03, 0.02, 0.03);
    },
    desk: function (ctx) {
      var base = HORIZON + 0.2;
      ctx.fillStyle = '#7a5228';
      roundRect(ctx, 0.14, base - 0.12, 0.3, 0.022, 0.008);
      rect(ctx, 0.16, base - 0.1, 0.022, 0.1);
      rect(ctx, 0.4, base - 0.1, 0.022, 0.1);
      ctx.fillStyle = '#5f3d1c';
      roundRect(ctx, 0.2, base - 0.098, 0.17, 0.055, 0.008);
      ctx.fillStyle = '#e8e2d0';
      rect(ctx, 0.24, base - 0.132, 0.08, 0.014);
      ctx.fillStyle = '#c9455e';
      rect(ctx, 0.35, base - 0.15, 0.05, 0.032);
    },
    bench: function (ctx) {
      var base = HORIZON + 0.2;
      ctx.fillStyle = '#8a5a30';
      for (var i = 0; i < 3; i++) roundRect(ctx, 0.14, base - 0.19 + i * 0.028, 0.3, 0.018, 0.008);
      roundRect(ctx, 0.14, base - 0.1, 0.3, 0.02, 0.008);
      ctx.fillStyle = '#5c5f70';
      rect(ctx, 0.16, base - 0.09, 0.02, 0.09);
      rect(ctx, 0.4, base - 0.09, 0.02, 0.09);
    },
    swing: function (ctx) {
      var base = HORIZON + 0.2;
      ctx.strokeStyle = '#5c5f70';
      ctx.lineWidth = 0.012;
      ctx.beginPath();
      ctx.moveTo(0.14, base); ctx.lineTo(0.2, base - 0.28);
      ctx.lineTo(0.4, base - 0.28); ctx.lineTo(0.46, base);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0.24, base - 0.28); ctx.lineTo(0.24, base - 0.14);
      ctx.moveTo(0.36, base - 0.28); ctx.lineTo(0.36, base - 0.14);
      ctx.stroke();

      ctx.fillStyle = '#4f9ad6';
      roundRect(ctx, 0.2, base - 0.15, 0.2, 0.035, 0.012);
      ctx.fillStyle = '#7bc0ef';
      roundRect(ctx, 0.2, base - 0.2, 0.2, 0.05, 0.012);
    }
  };

  /* Welche Schicht zeichnet welche Aufgabe? */
  var LAYERS = { wall: WALLS, floor: FLOORS, light: LIGHTS, deco: THINGS, seat: THINGS };

  /* Wo der Platzhalter sitzt, wenn eine Aufgabe noch offen ist. */
  var SPOTS = {
    wall: [0.28, 0.1, 0.44, 0.3, 'Wand'],
    floor: [0.2, HORIZON + 0.06, 0.6, 0.24, 'Boden'],
    light: [0.4, 0.06, 0.2, 0.2, 'Licht'],
    deco: [0.13, HORIZON - 0.12, 0.16, 0.28, 'Deko'],
    seat: [0.13, HORIZON - 0.12, 0.3, 0.3, 'Möbel']
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
    });

    /* Platzhalter zuletzt, damit sie ueber allem liegen und auffallen. */
    room.tasks.forEach(function (task) {
      if (picks[task.key]) return;
      var spot = SPOTS[task.key];
      if (!spot) return;
      placeholder(ctx, spot[0], spot[1], spot[2], spot[3], spot[4]);
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
    var slim = { key: room.key, name: room.name, tasks: room.tasks.filter(function (t) {
      return preview[t.key];
    }) };

    return RoomArt.draw(canvas, slim, preview, width, height);
  };

  RoomArt.HORIZON = HORIZON;

  root.M3 = root.M3 || {};
  root.M3.RoomArt = RoomArt;

})(typeof globalThis !== 'undefined' ? globalThis : this);
