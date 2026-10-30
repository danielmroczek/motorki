# zuzel-simple

## Co to jest

Gra/symulacja żużlowa "Kreski" - wyścigi na torach zdefiniowanych w plikach SVG (6 torów, m.in. Bydgoszcz) z wyborem liczby zawodników (1–3) i tabelą wyników. Kolory kasków jak w prawdziwym żużlu: red / white / yellow / blue.

Gra jest luźno wzorowana na [kreski.org (wersja 2001)](https://www.kreski.org/ver2001.html).

## Technologie

- Czysty JavaScript (ES modules)
- paper.js — wektorowy canvas
- Klasy: `Game`, `Level`, `Player`, `Vertex`, `Route`, `Brain`, `StartReaction`, `EventEmitter`, `ResultsTable`, `TrackSelector`
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
skok dający gęstą linię jazdy). Na starcie biegu
losowany jest **jeden wspólny boczny offset** (wartość z `rng`, ta sama dla
wszystkich Komputerów w biegu), przesuwający trasę wzdłuż lokalnych normalnych
— ograniczony do 2/3 dystansu do najbliższej ściany, więc trasa zawsze zostaje
w torze. Ponowne uruchomienie biegu daje inny offset (ADR-0001).

**Orientacja pętli** jest zgodna z zamierzonym kierunkiem jazdy toru:
`forTrack` sprawdza najbliższy punkt startowy (`Level.startPoints[0].angle`)
i odwraca pętlę, gdy jej przebieg od startu prowadzi „pod prąd". Dzięki temu
jazda „naprzód po pętli" (pure-pursuit) pokrywa się z kierunkiem startu
człowieka, a przekraczanie linii mety zalicza okrążenia zamiast ustawiać
flagę `cheat`.

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

Moduł `js/brain.js` to autorski sterownik **pure-pursuit** (zastąpił port
logiki Radara z oryginału, który gonił najbliższy punkt Trasy i przy punktach
bliższych niż 16 px wymuszał ±90° skręty — stąd „bączki" i kręcenie się
w kółko). Logika na klatkę:

1. **Najbliższy punkt Trasy** — okno skanowania od `waypointIdx − 6`
	do `waypointIdx + 22` (z zawijaniem); gdy najlepszy dystans przekracza
	`LOST_DISTANCE` (45 px), skan pełny. Wskazanie tylko **kotwiczy**
	pozycję na pętli — nie jest celem skrętu.
2. **Cel wyprzedzający** — celem jest punkt `look` pozycji **naprzód po
	pętli**, gdzie `look = min(6, max(3, 2 + mode))` → tryby 1–4 patrzą
	3–6 punktów przed siebie (przy `ROUTE_STEP = 20 px` to 60–120 px
	wyprzedzenia). Tak wygląda cięcie toru: motocyklista celuje w punkt
	na horyzoncie zamiast w kółko pod nosem.
3. **Sterowanie kątowe z martwą strefą** — błąd kątowy
	`wrap180(kąt celu − angle)`; przy `|błąd| ≤ DEAD_BAND_DEG` (8°) komenda
	`STRAIGHT`, inaczej zwrot w stronę błędu. Martwa strefa eliminuje
	pompowanie sterem przy mnożących się mikropoprawkach.

**Test na sucho (§5.3)**: przed przyjęciem komendy Mózg symuluje kolejny
krok fizyki (pozycja, kąt, speed, anglespeed) i sprawdza `Level.collide`
oraz ciała pozostałych zawodników na symulowanych wektorach — read-only.
Kolejność prób jest **od przodu**: `STRAIGHT`, potem `LEFT`, `RIGHT`;
pierwsza niekolidująca wygrywa, a gdy wszystkie kolidują — zostaje
decyzja naturalna. Bez licznika stuck i eliminacji (spec decyzja #19).

API:

```js
const brain = new Brain({ mode: 1, rng: Math.random, dt: 1000 / 60 });
const cmd = brain.decide(player, route, { level, players }); // −1 / 0 / +1
brain.decide(player, route); // bez world — czysta logika, bez fallbacku
```

Eksporty: `CMD` (`LEFT/-1`, `STRAIGHT/0`, `RIGHT/+1`) oraz stałe
dostrajające: `LOOKAHEAD_POINTS` (3), `NEAREST_WINDOW_BACK` (6),
`NEAREST_WINDOW_FWD` (22), `LOST_DISTANCE` (45), `DEAD_BAND_DEG` (8).
Detale: GitHub issue `danielmroczek/motorki#2`, testy w
`tests/brain.test.js` (jednostkowe) i `tests/brain-lap.test.js`
(pełne okrążenie na torze syntetycznym — postęp pętli, korytarz ±38 px,
limit kolizji). Mózg jest podłączony do gry: każdy Komputer
dostaje własną instancję `Brain`, a jego komendy sterują motocyklem
tak samo jak klawisze człowieka.

## Reakcja startowa (`StartReaction`)

Moduł `js/startReaction.js` adaptuje opóźnienie startowe Komputerów do
historii człowieka, zapisywanej w `localStorage` (klucz
`zuzel-simple.starts`, ostatnie 10 próbek). Próbka = czas pierwszego
skrętu człowieka po GO; przy 2+ ludziach do jednej próbki trafia
średnia, a motocykl, który falstartował, nie dostarcza próbki. Zapis
następuje po biegu. Opóźnienie Komputera = mediana historii ×
czynnik osobowości (0,75 / 0,9 / 1,1 / 1,3 wg trybu) + mały szum;
bez historii to 140–320 ms. Moment startu widać w konsoli
(`Komputer N: start po X ms`).

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

## Menu

Stawka to **4 sloty** w jednej listwie: kliknięcie slotu przełącza
cyklicznie **pusty → człowiek → komputer**. W sumie na starcie jest tyle
motocykli, ile zajętych slotów (1–4; tyle ma tor punktów startowych i pula
kolorów), więc niemożliwe stawki albo "za duże" pole nie istnieją. Wybór
zapamiętywany jest w sesji (odświeżenie strony nie kasuje ustawienia).
Domyslna stawka po świeżym załadowaniu: 1 człowiek (czerwony) + 3 komputery.
0 ludzi dozwolone — podglądowa jazda samych Komputerów. Nazwy w rankingu:
ludzie = kolor kasku, Komputery = „Komputer 1"…"N".