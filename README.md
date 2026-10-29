# zuzel-simple

## Co to jest

Gra/symulacja żużlowa "Kreski" - wyścigi na torach zdefiniowanych w plikach SVG (6 torów, m.in. Bydgoszcz) z wyborem liczby zawodników (1–3) i tabelą wyników. Kolory kasków jak w prawdziwym żużlu: red / white / yellow / blue.

Gra jest luźno wzorowana na [kreski.org (wersja 2001)](https://www.kreski.org/ver2001.html).

## Technologie

- Czysty JavaScript (ES modules)
- paper.js — wektorowy canvas
- Klasy: `Game`, `Level`, `Player`, `Vertex`, `Route`, `EventEmitter`, `ResultsTable`, `TrackSelector`
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