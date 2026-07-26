/* ==========================================================================
   Service Worker — das Spiel offline verfuegbar machen.

   Zwei Strategien, bewusst getrennt:

     Navigation (die Seite selbst)  Netz zuerst, Cache als Rueckfall.
       Sonst bekaeme man nach einem Update tagelang die alte Version zu
       sehen, ohne zu verstehen warum.

     Alles andere (Skripte, CSS, Bilder)  Cache zuerst, im Hintergrund
       auffrischen. Das ist schnell und funktioniert ohne Netz.

   Der Cache-Name traegt eine Version. Wird sie erhoeht, raeumt `activate`
   alle alten Caches ab — ohne das sammeln sich Altlasten im Browser an, die
   niemand mehr loswird.
   ========================================================================== */

var VERSION = 'gemcascade-v3';

var ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/config.js',
  './js/utils.js',
  './js/goals.js',
  './js/player.js',
  './js/audio.js',
  './js/icons.js',
  './js/particles.js',
  './js/levels.js',
  './js/board.js',
  './js/leaderboard.js',
  './js/rooms.js',
  './js/roomart.js',
  './js/game.js',
  './js/map.js',
  './js/tutorial.js',
  './js/ui.js',
  './js/main.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(VERSION)
      /* Einzeln statt addAll: eine fehlende Datei darf nicht die ganze
         Installation scheitern lassen. */
      .then(function (cache) {
        return Promise.all(ASSETS.map(function (url) {
          return cache.add(url).catch(function () { /* egal */ });
        }));
      })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.map(function (key) {
          return key === VERSION ? null : caches.delete(key);
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var request = event.request;

  if (request.method !== 'GET') return;

  var url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  /* Die Bestenliste darf nie aus dem Cache kommen — eine alte Rangliste ist
     schlimmer als gar keine. */
  if (url.pathname.indexOf('/api/') === 0) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(function (response) {
          var copy = response.clone();
          caches.open(VERSION).then(function (c) { c.put(request, copy); });
          return response;
        })
        .catch(function () {
          return caches.match(request).then(function (hit) {
            return hit || caches.match('./index.html');
          });
        })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(function (hit) {
      var network = fetch(request).then(function (response) {
        if (response && response.status === 200) {
          var copy = response.clone();
          caches.open(VERSION).then(function (c) { c.put(request, copy); });
        }
        return response;
      }).catch(function () { return hit; });

      return hit || network;
    })
  );
});
