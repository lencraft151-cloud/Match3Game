# Gem Cascade

Ein Match-3-Spiel mit Level-Landkarte, Aufgaben statt Punktejagd,
Sternewertung, Leben, Boostern und einem Schloss zum Einrichten — plus
optionaler weltweiter Bestenliste.

Kein Build, keine Abhängigkeiten, keine Bilddateien — reines HTML, CSS und
JavaScript. Jedes Symbol im Spiel ist gezeichnet, nicht geladen.
`index.html` im Browser öffnen genügt.

**Spielen:** https://lencraft151-cloud.github.io/Match3Game/

## Als App installieren

**[Download-Seite →](https://lencraft151-cloud.github.io/Match3Game/download/)**

| Gerät | Weg | Hinweis |
|---|---|---|
| Android | [`GemCascade.apk`](download/) | Bringt das Spiel mit, läuft **offline**, **keine Berechtigungen** |
| iPhone/iPad | [`GemCascade.mobileconfig`](download/) | Legt ein Symbol auf den Home-Bildschirm |
| iPhone/iPad | Safari → Teilen → „Zum Home-Bildschirm" | Braucht gar kein Profil |
| Desktop | Installieren-Symbol in der Adressleiste | PWA, funktioniert ebenfalls offline |

Zwei Dinge vorweg, damit die Warnungen niemanden überraschen: Das APK ist
mit einem **eigenen Schlüssel signiert** und nicht über den Play Store
verteilt — Android warnt deshalb vor „unbekannten Quellen", so wie bei jeder
App außerhalb des Stores. Das iOS-Profil ist **unsigniert** und wird als
„Nicht verifiziert" angezeigt; es enthält ausschließlich einen Web Clip, also
ein Symbol, das das Spiel im Vollbild öffnet — keine Zertifikate, keine
Zugriffsrechte. Für Store-Pakete bräuchte es kostenpflichtige
Entwicklerkonten.

Das APK wird von [`android/build.sh`](android/build.sh) erzeugt: `aapt2`,
`javac`, `d8`, `zipalign` und `apksigner` direkt, ohne Gradle. Für eine App
aus einer einzigen Activity ohne Abhängigkeiten sind das sieben
nachvollziehbare Schritte statt eines halben Build-Systems.

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

Das Übungslevel **führt**, statt nur nebenher zu erklären. Neun Schritte, und
in jedem geht genau das, was der Text gerade verlangt: beim Lesen liegt ein
Schleier über dem Brett, beim Tauschen leuchtet **ein bestimmtes Paar** und
alles andere federt mit einer Begründung zurück, beim Power-Up-Schritt musst
du die Bombe wirklich einsetzen — sie ist dort wie alle Booster
**unbegrenzt** und kostet nichts vom Vorrat. Abgeschlossen ist es erst, wenn
der Text durch ist: eine früh nebenbei erfüllte Aufgabe beendet es nicht.

Darüber liegen die Level als Bahn aus nummerierten Knoten. Ganz am Anfang ist
**nur das Übungslevel** offen — Level 1 geht auf, sobald du es durch hast.
Danach schaltet jedes geschaffte Level genau eines frei. Das aktuelle trägt eine Krone, geschaffte zeigen ihre Sterne und
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

Ein Level stellt eine oder zwei davon. Oben im HUD stehen sie als Marke: der
**gezeichnete Stein** mit einem Fortschrittsring drumherum und der Restzahl
daneben. Das Symbol kommt aus derselben Funktion wie das Spielfeld — die
Aufgabe kann deshalb gar nicht erst eine andere Form zeigen als die, die
tatsächlich fällt. (Vorher stand dort ein Emoji: für den Smaragd, der als
Dreieck fällt, gab es nur einen grünen Kreis.)

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
| 4 in einer Reihe | **Blitz** | Räumt die Zeile oder Spalte — in Richtung deiner Kette |
| L- oder T-Form | **Kreuz** | Räumt Zeile **und** Spalte auf einmal |
| 5 in einer Reihe | **Prisma** | Beim Tausch verschwinden alle Steine der getauschten Farbe |

Spezialsteine, die von einer Explosion getroffen werden, zünden ihrerseits.
Zwei getauschte Prismen räumen das komplette Feld.

Die Steine auf dem Brett und die Booster aus dem Shop überschneiden sich
bewusst **nicht**: Die 3×3-Sprengung gibt es nur als gekaufte Bombe, und wo
Blitz und Rakete beide eine Linie räumen, unterscheidet sich der Weg dorthin
— beim Blitz bestimmt die Richtung deiner Kette, wohin er schlägt, bei der
Rakete entscheidet der Zufall. Der verdiente Stein ist der planbare. Vorher
hieß der Stein aus der L-Form ebenfalls „Bombe" und tat dasselbe wie der
gekaufte Booster; damit war der Kauf entwertet.

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

## Leben, Kristalle, Booster

Du hast **fünf Leben**. Ein verlorenes Level kostet eines. Alle **30 Minuten**
wächst eines nach (bis fünf), und um **Mitternacht** sind ohnehin alle wieder
da — der Countdown bis zum nächsten Herz steht oben auf der Karte.

Gehen dir mitten im Level die Züge aus, kannst du **weiterspielen statt
aufzugeben**: fünf Extra-Züge gegen Kristalle. Der Preis steigt mit jedem
Nachkauf im selben Level. Erst ein abgebrochener Versuch kostet ein Leben —
und zwar **beides**, Aufgeben wie Neu starten. Beide Knöpfe im Pausemenü sagen
das vorher an. Im Übungslevel kostet nichts etwas.

**Kristalle 💎** gibt es für jedes geschaffte Level: Grundbetrag, Zuschlag pro
Levelstufe und Zuschlag pro Stern.

Im **Shop** wird daraus Nachschub:

| Posten | Preis | Wirkung |
|---|---|---|
| Rakete | 45 💎 | Fegt eine ganze **Reihe oder Spalte** leer |
| Bombe | 70 💎 | Sprengt **3 × 3**: das angetippte Feld und alle acht Nachbarn, Felsen inklusive |
| Extra-Züge | 90 💎 | Legt 7 Züge drauf |
| Mischen | 140 💎 | Würfelt das Feld neu und sorgt für mindestens 4 mögliche Züge |
| Extra-Leben | 170 💎 | Ein zusätzliches Leben, maximal 10 gleichzeitig |

Die Leiter richtet sich danach, wie viel ein Posten wirklich rettet, nicht
danach, wie stark er aussieht. Eine Rakete räumt schön auf, ist aber
ersetzbar. **Mischen** holt dich aus einer Sackgasse, in der sonst gar nichts
mehr geht — das ist der Posten, der ein Level rettet, und deshalb der teuerste
Booster. Darüber liegt nur noch das **Leben** selbst.

Die vier Booster liegen als runde Knöpfe unter dem Brett und **kosten selbst
keinen Zug**. Rakete und Bombe brauchen ein Ziel: erst antippen, dann das Feld
wählen — ein zweiter Tipp auf den Knopf entschärft sie wieder. Ist ein Vorrat
leer, zeigt die Anzahl-Blase ein **+** und der Knopf führt direkt in den Shop;
zurück geht es ins laufende Level, nicht auf die Karte.

## Wie das Ganze aussieht

Die Oberfläche folgt der Formensprache großer Handy-Match-3-Spiele: dicke
Knöpfe mit sichtbarer Unterkante, die beim Drücken um genau diese Kante
einsinken, Umriss-Schrift, die auf jedem Untergrund lesbar bleibt,
Bannerbögen über der Panelkante und ein Brettrahmen mit Nieten in den Ecken.
Die Farben bleiben Königsblau und Gold.

Zwei Dinge daran sind mehr als Kosmetik:

**Kein einziges Emoji.** Jedes Symbol — Herz, Kristall, Münze, Zahnrad,
Booster, Sterne auf der Karte — wird in
[`js/icons.js`](js/icons.js) auf ein Canvas gezeichnet. Emojis sehen auf
jedem Gerät anders aus und tragen eine fremde Formensprache ins Spiel; neben
einem selbstgezeichneten Rubin wirkt ein 🔨 wie ein Aufkleber auf einem
Gemälde.

**Eine Kulisse hinter dem Brett.** Jedes der sechs Brett-Themen bekommt einen
eigenen Raum: Sandsteinhalle mit Rüstung, Bibliothek mit Springbrunnen,
Heckengarten mit Bank. Gezeichnet wird das nicht neu —
[`js/scene.js`](js/scene.js) benutzt dieselben Wände, Böden, Lichter und
Möbel, die [`js/roomart.js`](js/roomart.js) für das Schloss malt. Der Raum
wird einmal je Thema und Breite in einen Puffer gemalt und danach nur noch
kopiert; jeden Frame eine Mauer neu zu mauern wäre Verschwendung. Ein
Themenwechsel blendet über, außer man hat Bewegung abbestellt.

Dass die Zuordnung Thema → Raum stimmt, prüft
[`test/scene.test.js`](test/scene.test.js) gegen die echten Tabellen. Ein
Tippfehler in einem Schlüssel fiele beim Zeichnen sonst nicht auf: die
Schicht würde stillschweigend übersprungen, und die leere Wand müsste man in
dem einen von sechs Themen suchen, das nur alle vier Level drankommt.

## Das Schloss einrichten

Neben den Kristallen gibt es **Münzen**, und zwar für jedes geschaffte Level.
Sie gehen nicht in den Shop, sondern ins Schloss: drei Räume — Eingangshalle,
Bibliothek, Rosengarten — mit je vier Aufgaben und zwei Varianten zur Auswahl.
Marmor oder Parkett, Bücherregale oder Gemälde, Springbrunnen oder Blütenbaum.

Zwei getrennte Töpfe, mit Absicht: würde Einrichten aus derselben Kasse
bezahlt wie Booster und Leben, wäre jede hübsche Entscheidung ein Rückschritt
im Spiel. So läuft beides nebeneinander.

Ein Level bringt rund 70 bis 150 Münzen, ein Raum kostet 640 bis 940 — das
sind gemessene sechs bis acht Level pro Raum, zwanzig fürs ganze Schloss. Ein
Raum geht erst auf, wenn der davor fertig ist. Die Räume sind wie alles andere
gezeichnet, nicht geladen: [`js/roomart.js`](js/roomart.js) malt sie auf ein
Canvas.

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
node test/board.test.js     # 46 Prüfungen — Spielfeldlogik
node test/player.test.js    # 74 Prüfungen — Leben, Kristalle, Münzen, Käufe
node test/levels.test.js    # 44 Prüfungen — Level, Aufgaben, Übungslevel
node test/tutorial.test.js  # 35 Prüfungen — Erklärkette im Übungslevel
node test/rooms.test.js     # 36 Prüfungen — Zimmer, Freischaltung, Preise
node test/scene.test.js     # 66 Prüfungen — Kulisse je Brett-Thema
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

`tutorial.test.js` prüft die beiden Zusagen des Übungslevels: es endet **erst,
wenn der Text durch ist** — auch wenn die Aufgabe schon vorher erfüllt wurde —
und jeder Schritt sperrt, was er nicht verlangt.

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
js/icons.js         Alle Symbole, gezeichnet statt Emoji
js/rooms.js         Zimmer, Aufgaben und Preise — ohne DOM, in Node testbar
js/roomart.js       Die Zimmer auf Canvas malen
js/scene.js         Die Kulisse hinter dem Spielfeld, ein Raum je Thema
js/leaderboard.js   Online-Client mit lokalem Fallback
js/ui.js            Screens, HUD, Popups
js/main.js          Bootstrap, Eingabe, Ablaufsteuerung
server/server.js    Bestenlisten-Server
sw.js               Service Worker fuer den Offline-Betrieb
manifest.webmanifest  PWA-Angaben
icons/              App-Icon als SVG plus gerenderte PNG-Groessen
android/            Android-Projekt und Build-Skript
download/           Download-Seite, APK und iOS-Profil
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
