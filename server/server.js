#!/usr/bin/env node
/* ==========================================================================
   Gem Cascade — Bestenlisten-Server

   Bewusst ohne Abhaengigkeiten: nur Node-Bordmittel (>= 18). Der Server
   beantwortet die Bestenlisten-API und liefert nebenbei die statischen
   Spieldateien aus, kann das Spiel also allein hosten.

       node server/server.js
       PORT=3000 node server/server.js

   API
       GET  /api/scores?limit=20   ->  { scores: [ { name, score, level, ts } ] }
       POST /api/scores            <-  { name, score, level }
                                   ->  { ok: true, rank: 3, scores: [...] }

   Gespeichert wird in server/scores.json (per Umgebungsvariable SCORES_FILE
   umlegbar — auf Hosts mit fluechtigem Dateisystem am besten auf ein
   persistentes Volume zeigen lassen).
   ========================================================================== */

'use strict';

const http = require('http');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const url = require('url');

const PORT = parseInt(process.env.PORT, 10) || 8080;
const HOST = process.env.HOST || '0.0.0.0';

const ROOT = path.resolve(__dirname, '..');
const SCORES_FILE = process.env.SCORES_FILE
  ? path.resolve(process.env.SCORES_FILE)
  : path.join(__dirname, 'scores.json');

/* Wie viele Eintraege dauerhaft aufgehoben werden. */
const MAX_STORED = 500;
const MAX_LIMIT = 100;
const MAX_BODY_BYTES = 2048;

/* Rate-Limit pro IP und Minute. */
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX_READS = 120;
const RATE_MAX_WRITES = 15;

/* ========================================================================= */
/*  Speicher                                                                 */
/* ========================================================================= */

let scores = [];
let writeQueue = Promise.resolve();

function loadScores() {
  try {
    const raw = fs.readFileSync(SCORES_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      scores = parsed.filter(isValidStoredEntry);
      sortScores();
      console.log(`[scores] ${scores.length} Eintraege geladen aus ${SCORES_FILE}`);
      return;
    }
    console.warn('[scores] Datei enthaelt kein Array — starte mit leerer Liste');
  } catch (err) {
    if (err.code !== 'ENOENT') {
      /* Kaputte Datei nicht stillschweigend ueberschreiben: erst wegsichern. */
      const backup = `${SCORES_FILE}.broken-${Date.now()}`;
      try {
        fs.renameSync(SCORES_FILE, backup);
        console.warn(`[scores] Datei unlesbar (${err.message}) — gesichert als ${backup}`);
      } catch (_) {
        console.warn(`[scores] Datei unlesbar: ${err.message}`);
      }
    }
  }
  scores = [];
}

function isValidStoredEntry(e) {
  return e
    && typeof e.name === 'string'
    && Number.isFinite(e.score)
    && Number.isFinite(e.level)
    && Number.isFinite(e.ts);
}

function sortScores() {
  /* Hoechste Punktzahl zuerst; bei Gleichstand gewinnt der aeltere Eintrag,
     damit sich Plaetze nicht bei jedem Neustart umsortieren. */
  scores.sort((a, b) => (b.score - a.score) || (a.ts - b.ts));
}

/* Schreibvorgaenge laufen nacheinander und ueber eine temporaere Datei,
   damit ein Absturz mitten im Schreiben die Liste nicht zerlegt. */
function persist() {
  writeQueue = writeQueue.then(async () => {
    const tmp = `${SCORES_FILE}.tmp`;
    try {
      await fsp.mkdir(path.dirname(SCORES_FILE), { recursive: true });
      await fsp.writeFile(tmp, JSON.stringify(scores, null, 2), 'utf8');
      await fsp.rename(tmp, SCORES_FILE);
    } catch (err) {
      console.error(`[scores] Speichern fehlgeschlagen: ${err.message}`);
    }
  });
  return writeQueue;
}

/* ========================================================================= */
/*  Validierung                                                              */
/* ========================================================================= */

function sanitizeName(raw) {
  const name = String(raw == null ? '' : raw)
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 16);
  return name || 'Spieler';
}

/* Ein rein clientseitiges Spiel kann keine echten Scores garantieren — hier
   werden nur grobe Unsinnswerte abgefangen (siehe server/README.md). */
function validateSubmission(body) {
  if (!body || typeof body !== 'object') return { error: 'Body muss ein JSON-Objekt sein' };

  const score = Number(body.score);
  const level = Number(body.level);

  if (!Number.isFinite(score) || score < 0 || score > 10000000) {
    return { error: 'score muss zwischen 0 und 10000000 liegen' };
  }
  if (!Number.isFinite(level) || level < 1 || level > 999) {
    return { error: 'level muss zwischen 1 und 999 liegen' };
  }

  return {
    entry: {
      name: sanitizeName(body.name),
      score: Math.round(score),
      level: Math.round(level),
      ts: Date.now()
    }
  };
}

/* ========================================================================= */
/*  Rate-Limit                                                               */
/* ========================================================================= */

const buckets = new Map();

function clientIp(req) {
  /* Hinter einem Reverse Proxy (Render, Fly, nginx) steht die echte IP im
     X-Forwarded-For-Header. Der ist faelschbar — fuer ein Spiel-Leaderboard
     ist das ein akzeptabler Kompromiss, siehe server/README.md. */
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
}

function rateLimited(req, isWrite) {
  const ip = clientIp(req);
  const now = Date.now();
  let bucket = buckets.get(ip);

  if (!bucket || now > bucket.resetAt) {
    bucket = { reads: 0, writes: 0, resetAt: now + RATE_WINDOW_MS };
    buckets.set(ip, bucket);
  }

  if (isWrite) {
    bucket.writes++;
    return bucket.writes > RATE_MAX_WRITES;
  }
  bucket.reads++;
  return bucket.reads > RATE_MAX_READS;
}

/* Abgelaufene Eintraege regelmaessig wegraeumen, damit die Map nicht waechst. */
const sweeper = setInterval(() => {
  const now = Date.now();
  for (const [ip, bucket] of buckets) {
    if (now > bucket.resetAt) buckets.delete(ip);
  }
}, RATE_WINDOW_MS);
sweeper.unref();

/* ========================================================================= */
/*  HTTP-Hilfen                                                              */
/* ========================================================================= */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400'
};

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    ...CORS
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Body zu gross'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new Error('Ungueltiges JSON'));
      }
    });

    req.on('error', reject);
  });
}

/* ========================================================================= */
/*  Statische Dateien                                                        */
/* ========================================================================= */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.md': 'text/markdown; charset=utf-8'
};

async function serveStatic(req, res, pathname) {
  const relative = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
  const target = path.resolve(ROOT, relative);

  /* Pfad muss innerhalb des Projektordners bleiben — sonst waere jede Datei
     des Hosts abrufbar. `path.resolve` loest ".." bereits auf, der Praefix-
     Test faengt den Rest. */
  if (target !== ROOT && !target.startsWith(ROOT + path.sep)) {
    return sendJson(res, 403, { error: 'Zugriff verweigert' });
  }

  /* Die Score-Datei und alles unter .git gehen niemanden etwas an. */
  if (target === SCORES_FILE || target.includes(`${path.sep}.git${path.sep}`)) {
    return sendJson(res, 404, { error: 'Nicht gefunden' });
  }

  let stat;
  try {
    stat = await fsp.stat(target);
  } catch (err) {
    return sendJson(res, 404, { error: 'Nicht gefunden' });
  }

  if (stat.isDirectory()) return sendJson(res, 404, { error: 'Nicht gefunden' });

  const ext = path.extname(target).toLowerCase();
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Length': stat.size,
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300'
  });

  fs.createReadStream(target)
    .on('error', () => res.destroy())
    .pipe(res);
}

/* ========================================================================= */
/*  Routen                                                                   */
/* ========================================================================= */

function publicView(list) {
  return list.map((e) => ({ name: e.name, score: e.score, level: e.level, ts: e.ts }));
}

async function handleGetScores(req, res, query) {
  const requested = parseInt(query.limit, 10);
  const limit = Number.isFinite(requested)
    ? Math.min(MAX_LIMIT, Math.max(1, requested))
    : 20;

  sendJson(res, 200, { scores: publicView(scores.slice(0, limit)) });
}

async function handlePostScore(req, res) {
  let body;
  try {
    body = await readBody(req);
  } catch (err) {
    return sendJson(res, 400, { error: err.message });
  }

  const { error, entry } = validateSubmission(body);
  if (error) return sendJson(res, 400, { error });

  scores.push(entry);
  sortScores();

  const rank = scores.indexOf(entry) + 1;

  if (scores.length > MAX_STORED) scores.length = MAX_STORED;
  persist();

  console.log(`[scores] ${entry.name} — ${entry.score} Punkte (Level ${entry.level}), Platz ${rank}`);

  sendJson(res, 201, {
    ok: true,
    rank,
    total: scores.length,
    scores: publicView(scores.slice(0, 20))
  });
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname || '/';

  try {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, CORS);
      return res.end();
    }

    if (pathname === '/api/scores') {
      const isWrite = req.method === 'POST';

      if (rateLimited(req, isWrite)) {
        return sendJson(res, 429, { error: 'Zu viele Anfragen — bitte kurz warten' });
      }

      if (req.method === 'GET') return await handleGetScores(req, res, parsed.query);
      if (isWrite) return await handlePostScore(req, res);

      return sendJson(res, 405, { error: 'Methode nicht erlaubt' });
    }

    if (pathname === '/api/health') {
      return sendJson(res, 200, { ok: true, entries: scores.length, uptime: process.uptime() });
    }

    if (pathname.startsWith('/api/')) {
      return sendJson(res, 404, { error: 'Unbekannter Endpunkt' });
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return sendJson(res, 405, { error: 'Methode nicht erlaubt' });
    }

    await serveStatic(req, res, pathname);
  } catch (err) {
    console.error('[server]', err);
    if (!res.headersSent) sendJson(res, 500, { error: 'Interner Fehler' });
    else res.destroy();
  }
});

/* ========================================================================= */

loadScores();

server.listen(PORT, HOST, () => {
  console.log(`Gem Cascade laeuft auf http://${HOST}:${PORT}`);
  console.log(`Bestenliste: ${SCORES_FILE}`);
});

function shutdown(signal) {
  console.log(`\n${signal} — fahre herunter`);
  server.close(() => {
    writeQueue.then(() => process.exit(0));
  });
  /* Falls offene Verbindungen haengen, trotzdem beenden. */
  setTimeout(() => process.exit(0), 3000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
