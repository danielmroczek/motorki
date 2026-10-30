# zuzel-simple

## Co to jest

Gra/symulacja żużlowa "Kreski" - wyścigi na torach zdefiniowanych w plikach SVG (6 torów, m.in. Bydgoszcz) z wyborem liczby zawodników (1–3) i tabelą wyników. Kolory kasków jak w prawdziwym żużlu: red / white / yellow / blue.

Gra jest luźno wzorowana na [kreski.org (wersja 2001)](https://www.kreski.org/ver2001.html).

## Technologie

- Czysty JavaScript (ES modules)
- paper.js — wektorowy canvas
- Klasy: `Game`, `Level`, `Player`, `Vertex`, `Route`, `Brain`, `EventEmitter`, `ResultsTable`, `TrackSelector`
- Szkielet HTML5 Boilerplate
- Testy: [Vitest](https://vitest.dev) (`npm test`)

## Fizyka kolizji

Kolizje są segmentowe (linie, bez pikseli). Zderzenie z innym motocyklem
cofa ruch i tnie prędkość na pół. Uderzenie w ścianę toru to **ślizg**:
składowa ruchu prostopadła do ściany jest odrzucana, a równoległa zostaje
(tłumiona × 0.9) — motocykl jazie wzdłuż bandy zamiast zastygać w miejscu.
Detale: GitHub issue `danielmroczek/kreski#4`, testy w `tests/`.

## Trasa Komputera (`Route`)

Moduł `js/route.js` generuje z geometrii ścian toru (już sparsowanych przez
`Level`) **łuk środkowy** toru, próbkowany o stałą gęstość (`ROUTE_STEP = 20 px`,
skok czuły dla Radara — min. 16 px, fizyka oryginału §8.4). Na starcie biegu
losowany jest **jeden wspólny boczny offset** (wartość z `rng`, ta sama dla
wszystkich Komputerów w biegu), przesuwający trasę wzdłuż lokalnych normalnych
— ograniczony do 2/3 dystansu do najbliższej ściany, więc trasa zawsze zostaje
w torze. Ponowne uruchomienie biegu daje inny offset (ADR-0001).

API (obie metody synchroniczne):

```js
const points = Route.forTrack(level, rng);          // pętla [{x, y}]
const idx = Route.startIndexFor(points, startPos);  // najbliższy punkt Trasy
Route.forTrack(level, rng, true);                   // + overlay punktów (paper.js)
```

Domyślnie punktów nie rysujemy — trzeci argument (`debug = true`) zaznacza
punkty Trasy na aktywnej warstwie paper.js (żółto-czerwone kółka; bez
paper.js no-op). Detale:
GitHub issue `danielmroczek/kreski#1`, ADR `docs/adr/0001-trasa-bota-...md`,
testy w `tests/route.test.js`.

**Podgląd w grze:** uruchom stronę z parametrem `?debug=true`
(np. `http://127.0.0.1:5501/index.html?debug=true`) i wystartuj bieg —
punkty Trasy pojawią się jako żółto-czerwone kropki na warstwie `players`.

## Mózg Komputera (`Brain`)

Moduł `js/brain.js` to port logiki sterującej Komputerem z oryginału
(fizyka.md §8.3–§8.6). Trzy warstwy:

1. **Radar (§8.4)** — od bieżącego waypointa ogląda okno 10 punktów Trasy
	do przodu, pomija punkty bliższe niż **16 px** od środka sprite'a
	(`position` = środek sprite'a, przód sprite'a jest 10 px przed nim)
	i wybiera najbliższy punkt za progiem. `waypointIdx >= count → 0`
	(zawijanie do przodu). Każdy punkt dostaje **Scatter** — jitter
	całkowity `rand()%scatter − scatter/2` px wg trybu Komputera (1–4:
	3/2/1/0 px), losowany osobno na osie X i Y **co klatkę**. Gdy nic
	nie spełnia progu, odczyt Radaru z poprzedniej klatki zostaje
	(`radarX`/`radarY` oryginału).
2. **Kąt celu (§8.5)** — `atan2(dy, dx)·180/π + 90` (konwencja gry:
	0° = północ, rosnąco CW) z delty odczytów Radaru klatka → klatka
	(`AI_SetTargetDir`). Pierwsza klatka (brak starego odczytu):
	`wantedDir = dir` — jak w oryginale.
3. **Drzewo decyzyjne (§8.6)** — `dAng` = kąt celu − kierunek (zawinięty
	do ±180°): `dAng ≥ +21° → prawo`, `dAng < −10° → lewo`, a w paśmie
	środkowym **korekta marży**: `margin = −(mode % 5)·turnStep/2`;
	jeśli `lane·3 < kąt` — doskok w prawo, inaczej prosto; gdy przekręcił
	— powrót w lewo. Komenda: `−1 / 0 / +1` — ta sama semantyka
	klawiszy człowieka.

**Test na sucho (§5.3)**: przed przyjęciem komendy Mózg symuluje kolejny
krok fizyki (pozycja, kąt, speed, anglespeed) i sprawdza `Level.collide`
oraz ciała pozostałych zawodników na symulowanych wektorach — read-only.
Jeśli wybrana komenda koliduje, próbuje `−1, 0, +1` po kolei i bierze
pierwszą wolną; gdy wszystkie kolidują — zostaje przy decyzji naturalnej.
Bez licznika stuck i eliminacji (spec decyzja #19).

API:

```js
const brain = new Brain({ mode: 1, rng: Math.random, dt: 1000 / 60 });
const cmd = brain.decide(player, route, { level, players }); // −1 / 0 / +1
brain.decide(player, route); // bez world — czysta logika, bez fallbacku
```

Eksporty: `CMD` (`LEFT/-1`, `STRAIGHT/0`, `RIGHT/+1`) i stałe oryginału
(`AI_SCATTER_MOD`, `AI_SCATTER_MAX`, `AI_TURN_LEFT_THRESH`,
`AI_TURN_RIGHT_THRESH`, `RADAR_MIN_DIST`, `RADAR_LOOKAHEAD`).
Detale: GitHub issue `danielmroczek/motorki#2`, testy w
`tests/brain.test.js`. **Uwaga:** Mózg nie jest jeszcze podłączony do gry —
podpięcie do `Game` to osobny ticket (#3).

## Status

Najbardziej rozwinięty „silnik" serii żużlowej, ale niedokończony (`Game.build()` z TODO, „beta" w logo).

## Uruchomienie

Projekt nie wymaga builda — wystarczy serwer statyczny (np. `npx serve` lub `python -m http.server`), ponieważ pliki JS to moduły ES.

## Bieg

Przyciskiem **Start** (lub z menu głównego) rozpoczyna się bieg, który przechodzi przez stany:
menu → **odliczanie** → **wyścig** → **podsumowanie** → menu.

- **Odliczanie** — czerwone światła gaszą się po losowym czasie (1,5–5,5 s) i zapalają się na zielono ze napisem „GO". Wciśnięcie sterowania zgaszenie świateł oznacza **falstart** (+1 s kary, komunikat na ekranie).
- **Start** — po zielonym świetle motocykl stoi na linii startu; rusza dopiero po wciśnięciu klawisza sterowania. To nadaje sens kary za falstart.
- **Wyścig** — 4 okrążenia (pasek „Okrążenie X/4"); zawodnik, który przekroczy metę jako ostatni z aktualnie jadących, widzi napis „Meta!", a jego motocykl wygasza się (fade-out).
- **Podsumowanie** — tabela rankingu: pozycja, kolor kasku (Kto), łączny czas (suma okrążeń + kary), najlepsze okrążenie oraz kary. Zwycięzca wyróżniony kolorem akcentu.

Klawisze w biegu: `1`/`2`/`3` — zmiana liczby zawodników (restart), `R` — restart, `P` — pauza, `Esc` — porzucenie biegu (powrót do menu), `Enter` — powrót do menu z podsumowania. Sterowanie: strzałki (gracz 1), `A`/`S` (gracz 2), `K`/`L` (gracz 3).