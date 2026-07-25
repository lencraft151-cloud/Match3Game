# Gem Cascade

Ein Match-3-Spiel im Browser mit Level-Landkarte, Aufgaben statt Punktejagd,
Sternewertung, Leben, Kristallen und Power-Ups — plus optionaler weltweiter
Bestenliste.

Kein Build, keine Abhängigkeiten, keine Assets — reines HTML, CSS und
JavaScript. `index.html` im Browser öffnen genügt.

**Spielen:** https://lencraft151-cloud.github.io/Match3Game/

## Lokal starten

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

## So läuft das Spiel

Ganz unten auf der **Landkarte** sitzt der **?**-Knoten: ein Übungslevel
**ohne Zuglimit**, das kein Leben kostet, sich nicht verlieren lässt und das
Spiel Schritt für Schritt erklärt. Es bleibt dauerhaft offen.

Darüber liegen die Level als Bahn aus nummerierten Knoten. Zu Beginn ist nur
Level 1 offen; jedes geschaffte Level schaltet genau eines frei. Das aktuelle trägt eine Krone, geschaffte zeigen ihre Sterne und
lassen sich für fehlende Sterne wiederholen, der Rest ist gesperrt. Ein Tipp auf den Knoten öffnet die Levelkarte mit Aufgabe und
Zugzahl.

Im Level tauschst du zwei benachbarte Steine, sodass drei oder mehr gleiche in
einer Reihe liegen. **Jeder Zug zählt** — aber nur, wenn er trifft: ein
Fehlversuch federt zurück und kostet nichts.

Nachrutschende Steine, die erneut treffen, lösen **Kaskaden** aus; der
Multiplikator steigt mit jeder Stufe der Kette. Die dicken Punkte stecken
nicht in einzelnen Dreiern, sondern in langen Ketten.

Sind die Aufgaben erfüllt, folgt das **Zug-Finale**: jeder übrige Zug wird
automatisch in einen Blitz verwandelt. Sparsam spielen zahlt sich also
doppelt aus — in Punkten und in Sternen.

### Aufgaben

| Typ | Beispiel |
|---|---|
| Sammeln | „12 Rubine sammeln" |
| Felsen | „8 Felsen zerschlagen" |
| Punkte | „10.000 Punkte" |

Ein Level stellt eine oder zwei davon. Oben im HUD stehen sie als Marke mit
Restzahl und werden abgehakt, sobald sie erfüllt sind.

Die Zahlen sind bewusst **klein und knapp**: Level 1 verlangt sechs Rubine in
acht Zügen. Damit zählt jeder einzelne Zug sichtbar, und ein Level ist in
zwei Minuten gespielt.

### Sterne

Wie viele Züge beim Erfüllen der Aufgaben übrig waren:

| Übrig | Sterne |
|---|---|
| ab 40 % | ★★★ |
| ab 15 % | ★★ |
| darunter | ★ |

### Spezialsteine

| Entsteht aus | Stein | Wirkung |
|---|---|---|
| 4 in einer Reihe | **Blitz** | Räumt die ganze Zeile oder Spalte |
| L- oder T-Form | **Bombe** | Sprengt alles im Umkreis von einem Feld |
| 5 in einer Reihe | **Prisma** | Beim Tausch verschwinden alle Steine der getauschten Farbe |

Spezialsteine, die von einer Explosion getroffen werden, zünden ihrerseits.
Zwei getauschte Prismen räumen das komplette Feld.

**Felsen** liegen ab Level 4 im Weg: nicht tauschbar, aber sie zerbrechen,
wenn direkt daneben ein Treffer landet. Gibt es keinen gültigen Zug mehr,
mischt sich das Feld sichtbar neu.

### Steuerung

| Eingabe | Wirkung |
|---|---|
| Ziehen | Stein auf ein Nachbarfeld ziehen |
| Tippen, tippen | Beide Steine nacheinander antippen |
| Pfeiltasten | Auswahlrahmen bewegen |
| Leertaste / Enter | Auswählen, dann mit einer Pfeiltaste tauschen |
| `P` oder `Esc` | Pause |

## Leben, Kristalle, Power-Ups

Du hast **fünf Leben**. Ein verlorenes Level kostet eines. Alle **30 Minuten**
wächst eines nach (bis fünf), und um **Mitternacht** sind ohnehin alle wieder
da — der Countdown bis zum nächsten Herz steht oben auf der Karte.

Gehen dir mitten im Level die Züge aus, kannst du **weiterspielen statt
aufzugeben**: fünf Extra-Züge gegen Kristalle. Der Preis steigt mit jedem
Nachkauf im selben Level. Erst wenn du wirklich aufgibst, kostet es ein Leben.

**Kristalle 💎** gibt es für jedes geschaffte Level: Grundbetrag, Zuschlag pro
Levelstufe und Zuschlag pro Stern.

Im **Shop** wird daraus Nachschub:

| Posten | Preis | Wirkung |
|---|---|---|
| 🔀 Mischen | 60 💎 | Würfelt das Feld neu und sorgt für mindestens 4 mögliche Züge |
| 🔨 Hammer | 80 💎 | Räumt ein **Kreuz**: das angetippte Feld und seine vier Nachbarn, Felsen inklusive |
| ➕ Extra-Züge | 100 💎 | Legt 7 Züge drauf |
| ❤️ Extra-Leben | 130 💎 | Ein zusätzliches Leben, maximal 10 gleichzeitig |

Die drei Power-Ups liegen als Leiste unter dem Brett und **kosten selbst
keinen Zug**. Der Hammer braucht ein Ziel: erst antippen, dann das Feld
wählen — ein zweiter Tipp auf den Knopf entschärft ihn wieder. Ist ein
Vorrat leer, bleibt der Knopf antippbar und sagt dir unter dem Brett, was
Nachschub kostet.

Alles davon liegt im `localStorage` des Browsers. Wer will, kann es dort
manipulieren — ohne Benutzerkonten und serverseitige Spielstände lässt sich
das nicht verhindern.

## Bestenliste

Gewertet werden die **über alle Level gesammelten Punkte**; das höchste Level
steht als Zusatz daneben. Eingetragen wird über den Pokal-Knopf auf der Karte.

Ohne weitere Einrichtung bleibt die Liste lokal im Browser. Für eine
**weltweite** Liste liegt in [`server/`](server/) ein Node-Server ohne
Abhängigkeiten bereit. Nach dem Deployment trägst du dessen URL in
[`js/config.js`](js/config.js) ein:

```js
LEADERBOARD_API: 'https://deine-app.onrender.com',
```

Details und die Grenzen der Fälschungssicherheit stehen in
[`server/README.md`](server/README.md). Kurzfassung: ein rein clientseitiges
Spiel kann Punktzahlen nicht garantieren — für eine Liste unter Freunden
reicht es, als Turnierwertung nicht.

Erreicht der Server nicht rechtzeitig eine Antwort, fällt das Spiel
automatisch auf die lokale Liste zurück; nicht zugestellte Einträge werden
zwischengespeichert und beim nächsten Start nachgereicht.

## Level-Balance

Die Zugzahlen sind **gemessen, nicht geschätzt**:

```bash
node test/balance.js            # Level 1–30, je 40 Versuche
node test/balance.js 1 60 100   # Level 1–60, je 100 Versuche
```

Ein Bot spielt stur den erstbesten gültigen Zug und plant nichts. Zielkorridor
ist eine Erfolgsquote von **60 bis 85 Prozent** — ein Mensch liegt darüber.
Stand der letzten Messung liegen Level 1–36 alle zwischen **58 und 87
Prozent**, dicht um 65–75 herum.

Kleine Zahlen sind dabei schwerer, als es proportional aussieht: bei acht
Zügen schlägt ein einziger Glücksfall stark durch. Die Zugzahlen sind
deshalb einzeln gemessen und nicht heruntergerechnet.

Bei Felsen entscheidet übrigens nicht die Zugzahl, sondern wie viele
überhaupt auf dem Feld liegen: bei 6 gesetzten Felsen schafft der Bot nur in
48 % der Fälle vier Treffer, bei 8 Felsen in 85 %. Einzelne Felsen werden
schlicht nie von einem Treffer erwischt. Deshalb liegen immer deutlich mehr
Felsen herum, als die Aufgabe verlangt.

Gemessene Ausbeute pro 25 Bot-Züge: rund 23 Steine je Farbe bei fünf Farben,
17 bei sechs, 13 bei sieben. Weil Treffer mit mehr Farben deutlich seltener
werden, ist ein Stein dann entsprechend mehr wert — sonst wären Punkteziele in
späten Leveln unerreichbar.

## Tests

```bash
node test/board.test.js     # 43 Prüfungen — Spielfeldlogik
node test/player.test.js    # 57 Prüfungen — Leben, Kristalle, Käufe
node test/levels.test.js    # 41 Prüfungen — Level, Aufgaben, Übungslevel
```

Ohne Framework und ohne Browser.

`board.test.js` prüft Startfelder ohne geschenkte Treffer, Match- und
Cluster-Erkennung, Spezialsteine, Kettenreaktionen, Felsen, Schwerkraft,
Sackgassen und einen Dauerlauf über 600 Züge.

`player.test.js` prüft Leben, den Nachfüll-Timer, den Tageswechsel, die
Kristallberechnung, Käufe samt Obergrenzen und manipulierte Spielstände.

`levels.test.js` prüft vor allem, dass **kein Level unlösbar** ist: keine
Sammelaufgabe auf eine Farbe, die es im Level nicht gibt, und keine
Felsaufgabe über der Zahl der gesetzten Felsen.

## Aufbau

```
index.html          Alle Screens
css/style.css       Königsblau/Gold-Theme, Karte, Popups, Responsive
js/config.js        Einstellungen — Leaderboard-URL, Preise, Zeiten
js/utils.js         Mathe, Easing, Zufall, Speicher
js/goals.js         Aufgabentypen, Beschriftung, Fortschritt
js/player.js        Leben, Kristalle, Power-Up-Vorrat, Nachfüll-Timer
js/audio.js         Effekte, zur Laufzeit synthetisiert (keine Audiodateien)
js/particles.js     Partikel, Schockwellen, Lichtstrahlen, Fliegetexte
js/levels.js        Leveldefinitionen und Sternewertung
js/board.js         Spielfeldlogik — ohne DOM, in Node testbar
js/game.js          Zustandsautomat, Züge, Animationen, Canvas-Rendering
js/map.js           Level-Landkarte
js/tutorial.js      Erklärschritte im Übungslevel
js/leaderboard.js   Online-Client mit lokalem Fallback
js/ui.js            Screens, HUD, Popups
js/main.js          Bootstrap, Eingabe, Ablaufsteuerung
server/server.js    Bestenlisten-Server
test/               Tests und das Balance-Werkzeug
```

`board.js` und `goals.js` kennen weder Canvas noch DOM und lassen sich deshalb
direkt in Node testen. `game.js` hängt den Steinen nur Darstellungsfelder an.

## Auf GitHub Pages veröffentlichen

Der Workflow [`.github/workflows/pages.yml`](.github/workflows/pages.yml)
veröffentlicht bei jedem Push und lässt vorher die Tests laufen.

> **Wichtig:** Die `github-pages`-Umgebung akzeptiert Deployments nur vom
> Branch `main`. Entwickelt wird auf dem Feature-Branch, veröffentlicht wird
> mit:
>
> ```bash
> git push origin claude/match3-game-animations-xy2ooe:main
> ```

GitHub Pages ist rein statisch und kann kein Node ausführen. Das Spiel läuft
dort vollständig; für die Online-Bestenliste braucht der Server einen eigenen
Platz (siehe oben).

## Barrierefreiheit

- Jede Farbe hat zusätzlich eine **eigene Form** — das Spiel bleibt bei
  Farbfehlsichtigkeit lesbar.
- Vollständig mit der Tastatur spielbar, Kartenknoten inklusive.
- `prefers-reduced-motion` wird respektiert: Partikel, Screen-Shake und
  Hintergrundbewegung fahren deutlich zurück, das Spiel bleibt voll spielbar.
- Ton lässt sich abschalten, die Einstellung bleibt gespeichert.

## Browser

Getestet mit Chromium in Desktop- und Handy-Auflösung. Benötigt Canvas 2D und
`requestAnimationFrame`; Web Audio und `localStorage` sind optional — fehlen
sie, läuft das Spiel ohne Ton beziehungsweise ohne gespeicherten Fortschritt
weiter, statt abzustürzen.
