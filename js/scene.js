/* ==========================================================================
   Scene — die Kulisse hinter dem Spielfeld.

   Jedes Brett-Thema aus game.js bekommt einen eigenen Raum: Wand, Boden,
   Licht und ein Moebelstueck. Gezeichnet wird nichts Neues — die Bausteine
   liegen schon in roomart.js und malen dort die Zimmer des Schlosses. Sie
   arbeiten in einem Koordinatensystem von 0 bis 1 mit dem Horizont als
   Trennlinie, also passen sie hier ohne Umrechnung hinein.

   Zwei Dinge sind wichtig:

   1. Die Kulisse wird *einmal* pro Thema und Groesse in einen Puffer gemalt
      und danach nur noch kopiert. Sechzig Mal pro Sekunde eine Mauer zu
      mauern waere Verschwendung, und das Bild aendert sich ohnehin nicht.

   2. Ein Raum ist breiter als hoch, ein Handy ist hoeher als breit. Deshalb
      wird der Raum als Band in natuerlichen Verhaeltnissen gezeichnet und
      unten angesetzt; darueber laeuft der Wandton weiter. Wuerde man den
      Raum auf die Bildschirmform ziehen, waeren die Mauersteine so hoch wie
      Tueren.
   ========================================================================== */

(function (root) {
  'use strict';

  var Scene = {};

  /* Wie breit ein Raum im Verhaeltnis zu seiner Hoehe ist. Darauf sind die
     Moebel in roomart.js gezeichnet. */
  var BAND_RATIO = 1.55;

  /* Sechs Themen, sechs Raeume. Die Schluessel sind die aus roomart.js;
     dass es sie wirklich gibt, prueft test/scene.test.js — ein Tippfehler
     soll nicht erst als leere Wand auffallen. */
  var ROOMS = {
    royal:   { wall: 'stone',     floor: 'marble', light: 'chandelier', thing: 'armor' },
    amber:   { wall: 'panel',     floor: 'wood',   light: 'lamp',       thing: 'desk' },
    emerald: { wall: 'hedge',     floor: 'gravel', light: 'tree',       thing: 'bench' },
    violet:  { wall: 'paintings', floor: 'carpet', light: 'lanterns',   thing: 'armchair' },
    frost:   { wall: 'wall',      floor: 'stones', light: 'window',     thing: 'plant' },
    ember:   { wall: 'shelves',   floor: 'wood',   light: 'fountain',   thing: 'swing' }
  };

  Scene.ROOMS = ROOMS;

  /* ------------------------------------------------------------- Zeichnen */

  /* Malt einen Raum in ein eigenes Canvas und gibt zusaetzlich den Ton
     zurueck, der oben an der Wand steht — damit laesst sich die Flaeche
     ueber dem Band fuellen, ohne die Farbe ein zweites Mal aufzuschreiben. */
  function paintBand(width, height, key) {
    var RoomArt = root.M3.RoomArt;
    var room = ROOMS[key] || ROOMS.royal;

    var buffer = root.document.createElement('canvas');
    buffer.width = Math.max(2, Math.round(width));
    buffer.height = Math.max(2, Math.round(height));

    var ctx = buffer.getContext('2d');
    ctx.setTransform(buffer.width, 0, 0, buffer.height, 0, 0);

    var layers = RoomArt.LAYERS;
    var order = [
      layers.wall[room.wall],
      layers.floor[room.floor],
      layers.light[room.light],
      layers.deco[room.thing]
    ];

    for (var i = 0; i < order.length; i++) {
      if (!order[i]) continue;
      ctx.save();
      order[i](ctx);
      ctx.restore();
    }

    /* Der Ton oben an der Wand, direkt aus dem Bild gelesen. */
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    var px = ctx.getImageData(1, 1, 1, 1).data;

    return {
      canvas: buffer,
      rgb: [px[0], px[1], px[2]],
      sky: 'rgb(' + px[0] + ',' + px[1] + ',' + px[2] + ')'
    };
  }

  /* Setzt eine fertige Kulisse in die volle Bildschirmflaeche: unten das
     Band, darueber laeuft der Wandton weiter und wird nach oben dunkler —
     eine gleichmaessige Flaeche saehe aus wie ein Fehler, ein Verlauf sieht
     aus wie eine hohe Wand. */
  function blit(ctx, band, w, h, alpha) {
    if (!band) return;

    var bandH = Math.min(h, w / BAND_RATIO);
    var top = h - bandH;

    ctx.save();
    ctx.globalAlpha = alpha;

    if (top > 0) {
      var up = ctx.createLinearGradient(0, 0, 0, top);
      up.addColorStop(0, shadeOf(band.rgb, 0.42));
      up.addColorStop(1, band.sky);
      ctx.fillStyle = up;
      ctx.fillRect(0, 0, w, top + 1);
    }

    ctx.drawImage(band.canvas, 0, top, w, bandH);
    ctx.restore();
  }

  /* Derselbe Ton, nur dunkler. */
  function shadeOf(rgb, factor) {
    return 'rgb(' + Math.round(rgb[0] * factor) + ',' +
                    Math.round(rgb[1] * factor) + ',' +
                    Math.round(rgb[2] * factor) + ')';
  }

  /* --------------------------------------------------------------- Zustand */

  var canvas = null;
  var ctx = null;
  var w = 0;
  var h = 0;
  var dpr = 1;

  var themeKey = null;
  var current = null;
  var previous = null;
  var fade = 1;         /* 1 = Uebergang fertig */
  var active = false;
  var bandWidth = 0;    /* Breite, auf die der Puffer gemalt wurde */

  var FADE_SECONDS = 0.9;

  /* Der Puffer haengt nur an der Breite. Gerundet auf 64er-Schritte, damit
     ein Ziehen am Fensterrand nicht bei jedem Pixel eine Mauer neu mauert —
     ein bisschen Skalierung sieht man einer Wand nicht an, ein Ruckeln
     schon. */
  function bandWidthFor(width) {
    return Math.max(320, Math.min(Math.ceil(width / 64) * 64, 1100));
  }

  Scene.attach = function (element) {
    canvas = element;
    if (!canvas) return false;
    ctx = canvas.getContext('2d');
    Scene.resize();
    return true;
  };

  Scene.resize = function () {
    if (!canvas) return;

    dpr = Math.min(root.devicePixelRatio || 1, 2);
    w = root.innerWidth;
    h = root.innerHeight;

    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    /* Neu gemalt wird nur, wenn sich die Bandbreite wirklich geaendert hat.
       Sonst reicht es, das vorhandene Bild neu einzusetzen — beim Drehen
       oder Ziehen am Fensterrand kaeme sonst bei jedem Schritt eine ganze
       Mauer neu. */
    var bandW = bandWidthFor(w);

    if (themeKey && bandW !== bandWidth) {
      current = paintBand(bandW, bandW / BAND_RATIO, themeKey);
      bandWidth = bandW;
      previous = null;
      fade = 1;
    }

    Scene.draw();
  };

  /* Ein neues Thema blendet sich ueber das alte. Wer Bewegung abbestellt
     hat, bekommt den Wechsel hart — aber er bekommt ihn. */
  Scene.setTheme = function (key) {
    if (!canvas || !key || key === themeKey) return;

    var Utils = root.M3.Utils;
    var bandW = bandWidthFor(w);

    previous = current;
    themeKey = key;
    current = paintBand(bandW, bandW / BAND_RATIO, key);
    bandWidth = bandW;
    fade = (previous && Utils && !Utils.prefersReducedMotion()) ? 0 : 1;
  };

  Scene.setActive = function (value) {
    active = !!value;
    if (canvas) canvas.classList.toggle('is-on', active);
  };

  Scene.update = function (dt) {
    if (fade >= 1) return;
    fade = Math.min(1, fade + dt / FADE_SECONDS);
  };

  Scene.draw = function () {
    if (!ctx) return;

    ctx.clearRect(0, 0, w, h);
    if (!current) return;

    if (previous && fade < 1) blit(ctx, previous, w, h, 1);
    blit(ctx, current, w, h, previous ? fade : 1);

    if (fade >= 1) previous = null;

    /* Der Schleier. Ohne ihn kaempft eine gemauerte Wand mit den Steinen auf
       dem Brett um die Aufmerksamkeit — und gewinnt. Mit zu viel davon ist
       die Kulisse umsonst gezeichnet, deshalb liegt er nur so dick, dass
       das Brett noch deutlich davor steht. */
    var veil = ctx.createLinearGradient(0, 0, 0, h);
    veil.addColorStop(0, 'rgba(8, 17, 58, 0.5)');
    veil.addColorStop(0.42, 'rgba(8, 17, 58, 0.3)');
    veil.addColorStop(1, 'rgba(8, 17, 58, 0.28)');
    ctx.fillStyle = veil;
    ctx.fillRect(0, 0, w, h);
  };

  /* Nur fuer Tests: welcher Raum gehoert zu welchem Thema. */
  Scene.roomFor = function (key) {
    return ROOMS[key] || null;
  };

  root.M3 = root.M3 || {};
  root.M3.Scene = Scene;

  if (typeof module !== 'undefined' && module.exports) module.exports = Scene;

})(typeof globalThis !== 'undefined' ? globalThis : this);
