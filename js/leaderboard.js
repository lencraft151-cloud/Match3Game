/* ==========================================================================
   Bestenliste — eine Schnittstelle, zwei Quellen.

   Ist in `js/config.js` keine `LEADERBOARD_API` gesetzt oder antwortet der
   Server nicht rechtzeitig, arbeitet das Spiel einfach mit der lokalen Liste
   im Browser weiter. Die Oberflaeche zeigt dann ein "Offline"-Badge, statt
   eine Fehlermeldung zu werfen.

   Eintrag: { name, score, level, ts }
   ========================================================================== */

(function (root) {
  'use strict';

  var Utils = root.M3.Utils;
  var CONFIG = root.M3.CONFIG;

  var Leaderboard = {};

  /* Zuletzt gesehener Serverzustand — steuert nur das Badge in der UI. */
  var lastOnlineOk = null;

  Leaderboard.isConfigured = function () {
    return typeof CONFIG.LEADERBOARD_API === 'string' && CONFIG.LEADERBOARD_API.length > 0;
  };

  Leaderboard.lastOnlineState = function () {
    return lastOnlineOk;
  };

  function apiUrl(path) {
    var base = CONFIG.LEADERBOARD_API.replace(/\/+$/, '');
    return base + path;
  }

  /* fetch mit hartem Zeitlimit — ein haengender Server darf das Spiel nicht
     blockieren. AbortController ist ueberall dort verfuegbar, wo auch fetch
     existiert; fehlt beides, laeuft sofort der lokale Zweig. */
  function fetchWithTimeout(url, options) {
    if (typeof root.fetch !== 'function') {
      return Promise.reject(new Error('fetch nicht verfuegbar'));
    }

    var controller = typeof root.AbortController === 'function' ? new root.AbortController() : null;
    var opts = Object.assign({}, options || {});
    if (controller) opts.signal = controller.signal;

    var timer = root.setTimeout(function () {
      if (controller) controller.abort();
    }, CONFIG.API_TIMEOUT_MS);

    return root.fetch(url, opts).then(function (res) {
      root.clearTimeout(timer);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }, function (err) {
      root.clearTimeout(timer);
      throw err;
    });
  }

  /* ---------------------------------------------------------- Lokale Liste */

  Leaderboard.localEntries = function () {
    var list = Utils.storeGet(CONFIG.STORE_SCORES, []);
    if (!Array.isArray(list)) return [];
    return list
      .filter(function (e) { return e && typeof e.score === 'number'; })
      .sort(function (a, b) { return b.score - a.score; });
  };

  Leaderboard.localBest = function () {
    var list = Leaderboard.localEntries();
    return list.length ? list[0].score : 0;
  };

  Leaderboard.saveLocal = function (entry) {
    var list = Leaderboard.localEntries();
    list.push(entry);
    list.sort(function (a, b) { return b.score - a.score; });
    /* Etwas mehr behalten als angezeigt wird, aber nicht unbegrenzt wachsen. */
    Utils.storeSet(CONFIG.STORE_SCORES, list.slice(0, 50));
    return list.indexOf(entry) + 1;
  };

  /* ------------------------------------------------------------ Nachreichen */

  /* Scores, die den Server nicht erreicht haben, warten hier auf den
     naechsten Versuch — sonst geht der Lauf einfach verloren. */
  function pending() {
    var list = Utils.storeGet(CONFIG.STORE_PENDING, []);
    return Array.isArray(list) ? list : [];
  }

  function setPending(list) {
    Utils.storeSet(CONFIG.STORE_PENDING, list.slice(0, 20));
  }

  function queuePending(entry) {
    var list = pending();
    list.push(entry);
    setPending(list);
  }

  Leaderboard.flushPending = function () {
    if (!Leaderboard.isConfigured()) return Promise.resolve(0);

    var list = pending();
    if (!list.length) return Promise.resolve(0);

    var sent = 0;
    var chain = Promise.resolve();

    list.forEach(function (entry) {
      chain = chain.then(function () {
        return postScore(entry).then(function () {
          sent++;
        }, function () {
          /* Weiterhin offline — der Rest bleibt in der Warteschlange. */
        });
      });
    });

    return chain.then(function () {
      setPending(list.slice(sent));
      return sent;
    });
  };

  /* --------------------------------------------------------------- Abrufen */

  function postScore(entry) {
    return fetchWithTimeout(apiUrl('/api/scores'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: entry.name,
        score: entry.score,
        level: entry.level
      })
    });
  }

  /* Liefert { online, entries }. `online: false` heisst: es ist die lokale
     Liste, egal ob eine API konfiguriert ist oder nicht. */
  Leaderboard.fetchTop = function (limit) {
    var max = limit || CONFIG.SCORE_LIMIT;

    if (!Leaderboard.isConfigured()) {
      lastOnlineOk = false;
      return Promise.resolve({ online: false, entries: Leaderboard.localEntries().slice(0, max) });
    }

    return fetchWithTimeout(apiUrl('/api/scores?limit=' + max), { method: 'GET' })
      .then(function (data) {
        lastOnlineOk = true;
        var entries = (data && Array.isArray(data.scores)) ? data.scores : [];
        return { online: true, entries: entries.slice(0, max) };
      })
      .catch(function () {
        lastOnlineOk = false;
        return { online: false, entries: Leaderboard.localEntries().slice(0, max) };
      });
  };

  /* Traegt einen Score ein. Lokal wird immer gespeichert — auch wenn der
     Server erreichbar ist, damit die eigene Historie erhalten bleibt. */
  Leaderboard.submit = function (rawName, score, level) {
    var entry = {
      name: Utils.sanitizeName(rawName),
      score: Math.max(0, Math.round(score) || 0),
      level: Math.max(1, Math.round(level) || 1),
      ts: Date.now()
    };

    Utils.storeSet(CONFIG.STORE_NAME, entry.name);
    var localRank = Leaderboard.saveLocal(entry);

    if (!Leaderboard.isConfigured()) {
      lastOnlineOk = false;
      return Promise.resolve({ online: false, entry: entry, localRank: localRank });
    }

    return postScore(entry).then(function (data) {
      lastOnlineOk = true;
      return {
        online: true,
        entry: entry,
        localRank: localRank,
        rank: data && data.rank ? data.rank : null
      };
    }, function () {
      lastOnlineOk = false;
      queuePending(entry);
      return { online: false, entry: entry, localRank: localRank, queued: true };
    });
  };

  Leaderboard.rememberedName = function () {
    var stored = Utils.storeGet(CONFIG.STORE_NAME, '');
    return typeof stored === 'string' ? stored : '';
  };

  root.M3.Leaderboard = Leaderboard;

})(typeof globalThis !== 'undefined' ? globalThis : this);
