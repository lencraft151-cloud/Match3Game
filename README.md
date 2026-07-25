# Gem Cascade

Ein Match-3-Spiel im Browser: Startbildschirm, Zeitlimit, Levelaufstieg,
Spezialsteine, lokale und optional weltweite Bestenliste.

Kein Build, keine Abhängigkeiten, keine Assets — reines HTML, CSS und
JavaScript. `index.html` im Browser öffnen genügt.

## Spielen

```bash
git clone https://github.com/lencraft151-cloud/Match3Game.git
cd Match3Game
```

Dann `index.html` doppelklicken. Wer lieber einen Server mag:

```bash
python3 -m http.server 8000     # http://localhost:8000
# oder
node server/server.js           # http://localhost:8080, inklusive Bestenliste
```

## Spielregeln

Tausche zwei benachbarte Steine, sodass drei oder mehr gleiche in einer Reihe
liegen. Passt der Zug nicht, federt er zurück. Erreiche die Zielpunktzahl,
bevor die Zeit abläuft — jeder Treffer schenkt dir etwas Zeit zurück.

Nachrutschende Steine, die erneut treffen, lösen **Kaskaden** aus: der
Multiplikator steigt mit jeder Stufe der Kette. Die dicken Punkte stecken
nicht in einzelnen Dreiern, sondern in langen Ketten.

### Spezialsteine

| Entsteht aus | Stein | Wirkung |
|---|---|---|
| 4 in einer Reihe | **Blitz** | Räumt die ganze Zeile oder Spalte |
| L- oder T-Form | **Bombe** | Sprengt alles im Umkreis von einem Feld |
| 5 in einer Reihe | **Prisma** | Beim Tausch verschwinden alle Steine der getauschten Farbe |

Spezialsteine, die von einer Explosion getroffen werden, zünden ihrerseits —
Kettenreaktionen sind ausdrücklich erwünscht. Zwei getauschte Prismen räumen
das komplette Feld.

Ab Level 4 liegen **Felsen** im Weg: nicht tauschbar, aber sie zerbrechen,
wenn direkt daneben ein Treffer landet.

Gibt es keinen gültigen Zug mehr, mischt sich das Feld sichtbar neu.

### Leben, Kristalle und Power-Ups

Du hast **fünf Versuche pro Tag**. Jeder Lauf, in dem dir die Zeit ausgeht,
kostet einen davon; um Mitternacht sind sie wieder da. Aufgeben im Pausenmenü
kostet bewusst nichts — verloren ist nur, wem die Uhr davonläuft.

Für jedes geschaffte Level gibt es **Kristalle 💎**: ein Grundbetrag, ein
Zuschlag pro Levelstufe und einer für jede zweite übrige Sekunde. Schnell
gespielt lohnt sich also doppelt.

Im **Shop** wird daraus Nachschub:

| Posten | Preis | Wirkung |
|---|---|---|
| ❤️ Extra-Leben | 60 💎 | Ein zusätzlicher Versuch, maximal 10 gleichzeitig |
| 🔨 Hammer | 40 💎 | Zerschlägt einen beliebigen Stein — auch einen Fels |
| 🔀 Mischen | 30 💎 | Würfelt das Feld neu durch |
| ⏱️ Zeit | 50 💎 | Legt 15 Sekunden auf die Uhr |

Die drei Power-Ups liegen als Leiste unter dem Brett und werden dort direkt
eingesetzt. Der Hammer braucht ein Ziel: erst antippen, dann den Stein wählen
— ein zweiter Tipp auf den Knopf entschärft ihn wieder. Zum Ausprobieren
startet jeder mit je einem Stück.

Sind alle Versuche weg, führt „Spielen" in den Shop statt ins Spiel, und der
Game-Over-Bildschirm bietet den Kauf direkt an.

Das alles liegt im `localStorage` des Browsers. Wer will, kann es dort
manipulieren — ohne Benutzerkonten und serverseitige Spielstände lässt sich
das nicht verhindern, und dafür ist ein Match-3-Spiel der falsche Ort.

### Steuerung

| Eingabe | Wirkung |
|---|---|
| Ziehen | Stein auf ein Nachbarfeld ziehen |
| Tippen, tippen | Beide Steine nacheinander antippen |
| Pfeiltasten | Auswahlrahmen bewegen |
| Leertaste / Enter | Auswählen, dann mit einer Pfeiltaste tauschen |
| `P` oder `Esc` | Pause |

### Level

Die ersten acht Stufen sind von Hand gesetzt und führen nacheinander die
sechste Farbe, die Felsen und die siebte Farbe ein. Danach geht es
formelbasiert weiter: Ziel plus zehn Prozent pro Stufe, Zeit minus eine
Sekunde bis zu einem Minimum von 50.

Irgendwann holt einen die Kurve ein — das ist Absicht. Das Spiel ist eine
Highscore-Jagd, kein Endgegner, und jeder Lauf soll ein Ende finden.

Weil Treffer mit mehr Farben deutlich seltener werden (gemessen: rund 590
Punkte pro Zug bei fünf Farben, aber nur 287 bei sieben), ist ein Stein bei
mehr Farben entsprechend mehr wert. Das hält die Ausbeute über alle Stufen
bei etwa 450 Punkten pro Zug.

## Bestenliste

Ohne weitere Einrichtung speichert das Spiel die Bestenliste lokal im Browser
und zeigt ein Offline-Badge.

Für eine **weltweite** Liste liegt in [`server/`](server/) ein Node-Server
ohne Abhängigkeiten bereit. Nach dem Deployment trägst du dessen URL in
[`js/config.js`](js/config.js) ein:

```js
LEADERBOARD_API: 'https://deine-app.onrender.com',
```

Details, Deploy-Anleitung und die Grenzen der Fälschungssicherheit stehen in
[`server/README.md`](server/README.md). Kurzfassung: ein rein clientseitiges
Spiel kann Punktzahlen nicht garantieren — für eine Liste unter Freunden
reicht es, als Turnierwertung nicht.

Erreicht der Server nicht rechtzeitig eine Antwort, fällt das Spiel
automatisch auf die lokale Liste zurück; nicht zugestellte Einträge werden
zwischengespeichert und beim nächsten Start nachgereicht.

## Auf GitHub Pages veröffentlichen

Der Workflow [`.github/workflows/pages.yml`](.github/workflows/pages.yml)
veröffentlicht das Spiel bei jedem Push. Einmalig nötig:

**Settings → Pages → Source** auf **GitHub Actions** stellen.

Der Workflow lässt vor dem Deployment die Board-Tests laufen und kopiert nur
`index.html`, `css/` und `js/` — Server und Tests bleiben draußen.

GitHub Pages ist rein statisch und kann kein Node ausführen. Das Spiel läuft
dort vollständig, für die Online-Bestenliste braucht der Server einen eigenen
Platz (siehe oben).

## Tests

```bash
node test/board.test.js     # 38 Prüfungen
node test/player.test.js    # 42 Prüfungen
```

Ohne Framework und ohne Browser.

`board.test.js` prüft Startfelder ohne geschenkte Treffer, Match- und
Cluster-Erkennung, Spezialsteine, Kettenreaktionen, Felsen, Schwerkraft,
Sackgassen und einen Dauerlauf über 600 Züge.

`player.test.js` prüft Leben, den Tageswechsel um Mitternacht, die
Kristallberechnung, Käufe samt Obergrenzen und was bei manipulierten oder
kaputten Spielständen passiert.

## Aufbau

```
index.html          Alle Screens
css/style.css       Styling, Screen-Übergänge, Responsive
js/config.js        Einstellungen — hier stehen Leaderboard-URL und Preise
js/utils.js         Mathe, Easing, Zufall, Speicher
js/player.js        Leben, Kristalle, Power-Up-Vorrat, Tageswechsel
js/audio.js         Effekte, zur Laufzeit synthetisiert (keine Audiodateien)
js/particles.js     Partikel, Schockwellen, Lichtstrahlen, Fliegetexte
js/levels.js        Level-Definitionen
js/board.js         Spielfeldlogik — ohne DOM, in Node testbar
js/game.js          Zustandsautomat, Animationen, Canvas-Rendering
js/leaderboard.js   Online-Client mit lokalem Fallback
js/ui.js            Screens und HUD
js/main.js          Bootstrap, Eingabe, Bildschleife
server/server.js    Bestenlisten-Server
test/board.test.js  Tests der Spielfeldlogik
test/player.test.js Tests für Leben, Kristalle und Käufe
```

`board.js` kennt weder Canvas noch DOM und lässt sich deshalb direkt in Node
testen. `game.js` hängt den Steinen nur Darstellungsfelder an.

## Barrierefreiheit

- Jede Farbe hat zusätzlich eine **eigene Form** — das Spiel bleibt bei
  Farbfehlsichtigkeit lesbar.
- Vollständig mit der Tastatur spielbar.
- `prefers-reduced-motion` wird respektiert: Partikel, Screen-Shake und
  Hintergrundbewegung fahren deutlich zurück, das Spiel bleibt voll spielbar.
- Ton lässt sich abschalten, die Einstellung bleibt gespeichert.

## Browser

Getestet mit Chromium in Desktop- und Handy-Auflösung. Benötigt Canvas 2D und
`requestAnimationFrame`; Web Audio und `localStorage` sind optional — fehlen
sie, läuft das Spiel ohne Ton beziehungsweise ohne gespeicherte Bestenliste
weiter, statt abzustürzen.
