# Bestenlisten-Server

Kleiner HTTP-Server ohne jede Abhängigkeit — nur Node-Bordmittel, ab Node 18.
Er beantwortet die Bestenlisten-API und liefert nebenbei die Spieldateien aus,
kann das Spiel also auch allein hosten.

```bash
node server/server.js              # http://localhost:8080
PORT=3000 node server/server.js    # anderer Port
```

## API

| Methode | Pfad                      | Beschreibung |
|---------|---------------------------|--------------|
| `GET`   | `/api/scores?limit=20`    | Top-Liste, absteigend nach Punkten. `limit` max. 100. |
| `POST`  | `/api/scores`             | Neuer Eintrag: `{ "name": "...", "score": 12345, "level": 4 }` |
| `GET`   | `/api/health`             | Statuscheck für Uptime-Monitore |

Antwort auf ein erfolgreiches `POST`:

```json
{ "ok": true, "rank": 3, "total": 42, "scores": [ ... ] }
```

Kurzer Test:

```bash
curl -X POST http://localhost:8080/api/scores \
  -H 'Content-Type: application/json' \
  -d '{"name":"Ada","score":31000,"level":6}'

curl http://localhost:8080/api/scores
```

## Im Spiel aktivieren

Trage in [`js/config.js`](../js/config.js) die Basis-URL des Servers ein —
ohne abschließenden Slash und ohne `/api`:

```js
LEADERBOARD_API: 'https://deine-app.onrender.com',
```

Läuft das Spiel direkt auf diesem Server, genügt `'.'`.

Bleibt das Feld leer oder antwortet der Server nicht innerhalb von vier
Sekunden, fällt das Spiel automatisch auf die lokale Bestenliste im Browser
zurück und zeigt ein Offline-Badge. Scores, die den Server nicht erreicht
haben, werden zwischengespeichert und beim nächsten Start nachgereicht.

## Speicherung

Standardmäßig `server/scores.json`, umlegbar über `SCORES_FILE`:

```bash
SCORES_FILE=/data/scores.json node server/server.js
```

Geschrieben wird über eine temporäre Datei mit anschließendem `rename`, damit
ein Absturz mitten im Schreiben die Liste nicht zerlegt. Ist die Datei beim
Start unlesbar, wird sie als `scores.json.broken-<zeitstempel>` weggesichert
statt überschrieben.

Behalten werden die besten 500 Einträge.

## Deployment

Der Server hat keine Abhängigkeiten, es gibt also nichts zu bauen. Er liest
`PORT` aus der Umgebung — das reicht für die meisten Hoster.

**Render** — neuer Web Service, Runtime Node:

- Build Command: *(leer lassen)*
- Start Command: `node server/server.js`

**Fly.io** — `fly launch`, dann in der `fly.toml`:

```toml
[processes]
  app = "node server/server.js"
```

**Eigener Server** — mit systemd oder pm2 starten und einen Reverse Proxy
davorsetzen.

> **Wichtig bei Gratis-Tarifen:** Viele Hoster haben ein flüchtiges
> Dateisystem — bei jedem Neustart wäre die Bestenliste weg. Leg ein
> persistentes Volume an und zeig mit `SCORES_FILE` darauf.

Läuft das Spiel auf GitHub Pages und der Server woanders, greift automatisch
CORS (`Access-Control-Allow-Origin: *`).

## Was dieser Server *nicht* leistet

Ehrlich gesagt: **Die Punktzahlen sind nicht fälschungssicher.** Das Spiel
läuft vollständig im Browser, also kann jeder mit der Entwicklerkonsole einen
beliebigen Wert an `/api/scores` schicken. Der Server prüft nur grobe
Plausibilität (Typen, `score` zwischen 0 und 10.000.000, `level` zwischen 1
und 999) und begrenzt die Rate auf 15 Einträge pro IP und Minute.

Für eine Bestenliste unter Freunden reicht das. Wer sie gegen Manipulation
absichern will, kommt um serverseitige Spiellogik nicht herum — der Server
müsste dann die Züge selbst nachrechnen, nicht nur das Ergebnis entgegennehmen.

Auch die IP-Erkennung fürs Rate-Limit verlässt sich hinter einem Reverse Proxy
auf `X-Forwarded-For`, und der ist fälschbar.

Es gibt keine Authentifizierung: Namen sind frei wählbar und werden nicht
reserviert. Eingehende Namen werden auf 16 Zeichen gekürzt, von Steuerzeichen
befreit und ausschließlich über `textContent` ins DOM geschrieben.
