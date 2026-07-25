/* ==========================================================================
   Effekte — Partikel, Schockwellen, Lichtstrahlen und Fliegetexte.

   Alles laeuft ueber feste Arrays, die bei Bedarf wachsen und deren tote
   Eintraege per Swap-Remove verschwinden: kein Objekt-Recycling-Zoo, aber
   auch kein Allokationsgewitter pro Frame.

   Koordinaten sind Pixel im Board-Canvas.
   ========================================================================== */

(function (root) {
  'use strict';

  var Utils = root.M3.Utils;

  function Fx() {
    this.particles = [];
    this.rings = [];
    this.beams = [];
    this.texts = [];
    /* Bei "reduzierte Bewegung" bleibt alles sichtbar, nur deutlich ruhiger. */
    this.intensity = Utils.prefersReducedMotion() ? 0.25 : 1;
  }

  Fx.prototype.clear = function () {
    this.particles.length = 0;
    this.rings.length = 0;
    this.beams.length = 0;
    this.texts.length = 0;
  };

  Fx.prototype.count = function () {
    return this.particles.length + this.rings.length + this.beams.length + this.texts.length;
  };

  /* ------------------------------------------------------------- Erzeugen */

  /* Funkenregen in Steinfarbe — der Standardeffekt beim Treffer. */
  Fx.prototype.burst = function (x, y, color, amount, power) {
    var n = Math.max(1, Math.round((amount || 14) * this.intensity));
    var force = power || 1;

    for (var i = 0; i < n; i++) {
      var angle = Math.random() * Math.PI * 2;
      var speed = (60 + Math.random() * 190) * force;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40,
        life: 0,
        maxLife: 0.45 + Math.random() * 0.4,
        size: 2 + Math.random() * 4,
        color: color,
        rot: Math.random() * Math.PI,
        vrot: (Math.random() - 0.5) * 12,
        gravity: 620,
        shard: Math.random() < 0.45
      });
    }
  };

  /* Expandierender Ring — Bomben und Levelabschluss. */
  Fx.prototype.ring = function (x, y, maxRadius, color, width) {
    this.rings.push({
      x: x,
      y: y,
      r: maxRadius * 0.12,
      maxR: maxRadius,
      life: 0,
      maxLife: 0.5,
      color: color,
      width: width || 4
    });
  };

  /* Lichtstrahl ueber eine Zeile oder Spalte. */
  Fx.prototype.beam = function (x, y, length, thickness, horizontal, color) {
    this.beams.push({
      x: x,
      y: y,
      length: length,
      thickness: thickness,
      horizontal: horizontal,
      color: color,
      life: 0,
      maxLife: 0.38
    });
  };

  /* Aufsteigende Punktzahl. */
  Fx.prototype.text = function (x, y, label, color, size) {
    this.texts.push({
      x: x,
      y: y,
      label: label,
      color: color || '#ffffff',
      size: size || 20,
      life: 0,
      maxLife: 0.95,
      drift: (Math.random() - 0.5) * 26
    });
  };

  /* -------------------------------------------------------------- Update */

  function sweep(list, dt, step) {
    for (var i = list.length - 1; i >= 0; i--) {
      var item = list[i];
      item.life += dt;
      if (item.life >= item.maxLife) {
        list[i] = list[list.length - 1];
        list.pop();
        continue;
      }
      if (step) step(item, dt);
    }
  }

  Fx.prototype.update = function (dt) {
    sweep(this.particles, dt, function (p, d) {
      p.vy += p.gravity * d;
      p.vx *= 0.985;
      p.x += p.vx * d;
      p.y += p.vy * d;
      p.rot += p.vrot * d;
    });

    sweep(this.rings, dt, function (r) {
      var t = r.life / r.maxLife;
      r.r = Utils.lerp(r.maxR * 0.12, r.maxR, Utils.easeOutCubic(t));
    });

    sweep(this.beams, dt, null);

    sweep(this.texts, dt, function (t, d) {
      t.y -= 58 * d;
      t.x += t.drift * d;
    });
  };

  /* -------------------------------------------------------------- Zeichnen */

  Fx.prototype.draw = function (ctx) {
    var i, item, t, alpha;

    ctx.save();

    /* Additiv — Funken und Strahlen sollen leuchten, nicht kleben. */
    ctx.globalCompositeOperation = 'lighter';

    for (i = 0; i < this.beams.length; i++) {
      item = this.beams[i];
      t = item.life / item.maxLife;
      alpha = (1 - t) * 0.85;
      var grow = 0.4 + Utils.easeOutCubic(t) * 0.9;

      ctx.globalAlpha = alpha;
      ctx.fillStyle = item.color;
      ctx.shadowBlur = 26;
      ctx.shadowColor = item.color;

      var th = item.thickness * grow;
      if (item.horizontal) {
        ctx.fillRect(item.x, item.y - th / 2, item.length, th);
      } else {
        ctx.fillRect(item.x - th / 2, item.y, th, item.length);
      }
    }
    ctx.shadowBlur = 0;

    for (i = 0; i < this.rings.length; i++) {
      item = this.rings[i];
      t = item.life / item.maxLife;
      ctx.globalAlpha = (1 - t) * 0.9;
      ctx.strokeStyle = item.color;
      ctx.lineWidth = item.width * (1 - t * 0.6);
      ctx.beginPath();
      ctx.arc(item.x, item.y, item.r, 0, Math.PI * 2);
      ctx.stroke();
    }

    for (i = 0; i < this.particles.length; i++) {
      item = this.particles[i];
      t = item.life / item.maxLife;
      ctx.globalAlpha = 1 - t * t;
      ctx.fillStyle = item.color;

      if (item.shard) {
        ctx.save();
        ctx.translate(item.x, item.y);
        ctx.rotate(item.rot);
        var s = item.size * (1 - t * 0.55);
        ctx.fillRect(-s, -s * 0.4, s * 2, s * 0.8);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(item.x, item.y, item.size * (1 - t * 0.7), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    /* Text wieder normal zeichnen, sonst wird er auf hellem Grund unlesbar. */
    ctx.globalCompositeOperation = 'source-over';

    for (i = 0; i < this.texts.length; i++) {
      item = this.texts[i];
      t = item.life / item.maxLife;
      /* Kurz reinpoppen, dann ausblenden. */
      var pop = t < 0.15 ? Utils.easeOutBack(t / 0.15) : 1;
      ctx.globalAlpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;

      ctx.save();
      ctx.translate(item.x, item.y);
      ctx.scale(pop, pop);
      ctx.font = '800 ' + item.size + 'px ' + Fx.FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,0.65)';
      ctx.strokeText(item.label, 0, 0);
      ctx.fillStyle = item.color;
      ctx.fillText(item.label, 0, 0);
      ctx.restore();
    }

    ctx.restore();
  };

  Fx.FONT = '"Segoe UI", system-ui, -apple-system, sans-serif';

  root.M3 = root.M3 || {};
  root.M3.Fx = Fx;

})(typeof globalThis !== 'undefined' ? globalThis : this);
