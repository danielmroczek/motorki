# Motorki

## Co to jest

Gra/symulacja żużlowa "Motorki" - wyścigi na torach zdefiniowanych w plikach SVG (6 torów, m.in. Bydgoszcz) z wyborem liczby zawodników (1–3) i tabelą wyników. Kolory kasków jak w prawdziwym żużlu: red / white / yellow / blue.

Gra jest luźno wzorowana na oryginalnej grze [kreski.org (wersja 2001)](https://www.kreski.org/ver2001.html).

## Technologie

- Czysty JavaScript (ES modules)
- paper.js — wektorowy canvas
- Klasy: `Game`, `Level`, `Player`, `Vertex`, `Route`, `Brain`, `StartReaction`, `EventEmitter`, `ResultsTable`, `TrackSelector`, `RosterMenu`
- Moduł `js/lineup.js` — tożsamość graczy: kolor ⇄ slot, klawisze ⇄ kolejność ludzi (ADR-0002)
- Szkielet HTML5 Boilerplate
- Testy: [Vitest](https://vitest.dev) (`npm test`)

## Fizyka kolizji

Kolizje są segmentowe (linie, bez pikseli). Zderzenie z innym motocyklem
cofa ruch i tnie prędkość na pół. Uderzenie w ścianę toru to **ślizg**:
składowa ruchu prostopadła do ściany jest odrzucana, a równoległa zostaje
(tłumiona × 0.9) — motocykl jazie wzdłuż bandy zamiast zastygać w miejscu.
Detale: GitHub issue `danielmroczek/motorki#4`, testy w `tests/`.

## Trasa Komputera (`Route`)

Moduł `js/route.js` generuje z geometrii ścian toru (już sparsowanych przez
`Level`) **łuk środkowy** toru, próbkowany o stałą gęstość (`ROUTE_STEP = 20 px`,
skok dający gęstą linię jazdy). Baza liczona jest **raz na bieg**
(`Route.baseLoop`), a każdy Komputer dostaje **własną** linię: osobny offset
w stronę **wnętrza** pętli, rozłożony stratyfikacją pasa — warstwy o równym
prawdopodobieństwie rozkładu liniowego (gęstość maleje w stronę zewnętrzną) są
tasowane, a bot trafia w środek swojej warstwy z jitterem do ±1/4 jej
szerokości, więc linie nie są „bliźniacze". Pas jest przycięty od zewnątrz:
`MAX_OFFSET_IN = 0.5` i `MAX_OFFSET_OUT = 0.2` dystansu do najbliższej ściany
(czyli maks. 1/4 szczeliny od osi po stronie wewnętrznej) — trasa zawsze
zostaje w torze. Ponowne uruchomienie biegu daje inne linie (ADR-0003).

**Orientacja pętli** jest zgodna z zamierzonym kierunkiem jazdy toru:
`baseLoop` sprawdza najbliższy punkt startowy (`Level.startPoints[0].angle`)
i odwraca pętlę, gdy jej przebieg od startu prowadzi „pod prąd". Dzięki temu
jazda „naprzód po pętli" (pure-pursuit) pokrywa się z kierunkiem startu
człowieka, a przekraczanie linii mety zalicza okrążenia zamiast ustawiać
flagę `cheat`.

API (wszystkie metody synchroniczne):

```js
const routes = Route.forField(level, 3, rng);       // Trasa per komputer [{x, y}]
const idx = Route.startIndexFor(routes[0], startPos); // najbliższy punkt Trasy
const points = Route.forTrack(level, rng);          // jedna Trasa (wrapper)
Route.forTrack(level, rng, true);                   // + overlay punktów (paper.js)
```

Domyślnie punktów nie rysujemy — trzeci argument (`debug = true`) zaznacza
punkty Trasy na aktywnej warstwie paper.js (każda Trasa innym kolorem; bez
paper.js no-op). `Route.drawDebug(routes)` rysuje całą stawkę — tak robi
`?debug=true`. Detale:
GitHub issue `danielmroczek/motorki#1`, ADR `docs/adr/0003-trasa-kazdego-...md`
(wcześniej `0001`), testy w `tests/route.test.js`.

**Podgląd w grze:** uruchom stronę z parametrem `?debug=true`
(np. `http://127.0.0.1:5501/index.html?debug=true`) i wystartuj bieg —
punkty Tras Komputerów pojawią się jako kolorowe kropki na warstwie `players`
(bez Komputerów w stawce: sama linia środkowa).

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

- **Odliczanie** — trzy etapy: **Ready** (1,2 s, czerwone lampki), **Set** (1,2 s, pomarańczowe lampki), potem losowa pauza 0,8–2,5 s i **Go!** (zielone lampki). Etapy 1–2 mają stały czas; losowa jest tylko pauza przed startem. Każdy etap ma krótki ton syntezowany w WebAudio (dwa pierwsze ten sam, start wyższy). Wciśnięcie sterowania przed zielonym światłem oznacza **falstart** (+1 s kary, komunikat na ekranie).
- **Start** — po zielonym świetle motocykl stoi na linii startu; rusza dopiero po wciśnięciu klawisza sterowania. To nadaje sens kary za falstart.
- **Wyścig** — 4 okrążenia (pasek „Okrążenie X/4"); zawodnik, który przekroczy metę jako ostatni z aktualnie jadących, widzi napis „Meta!", a jego motocykl wygasza się (fade-out).
- **Podsumowanie** — tabela rankingu: pozycja, chip koloru + nazwa (Kto, np. „Czerwony" albo „Komputer 1") ze skrótem klawiszy człowieka, czas biegu liczony od zielonego światła do mety (+ kary; postój na starcie też się liczy), najlepsze okrążenie oraz kary. Zwycięzca wyróżniony kolorem akcentu.

Klawisze w biegu: `R` — restart biegu, `P` — pauza, `H` — legenda (kto kim jest i jak steruje), `Esc` — porzucenie biegu (powrót do menu). Reguła UX: `Enter` uruchamia widoczny przycisk primary (zielony), `Esc` — secondary (stłumiony). W menu `Enter` startuje bieg; w podsumowaniu `Enter` (przycisk „Jeszcze raz”) powtarza ten sam bieg, a `Esc` / „Do menu” wraca do menu. Sterowanie zależy od **pozycji slotu**: 1 → strzałki, 2 → `A`/`S`, 3 → `K`/`L`, 4 → `Num 4`/`Num 6` (niezależnie od tego, ilu jest ludzi i które sloty są puste). Aliasy ergonomiczne (nie pokazywane w UI): `ArrowDown` skręca w prawo w 1. zestawie, `Num 5` skręca w lewo w 4. zestawie, a `,`/`.` działają w 4. zestawie na laptopach bez numpada. Zmiana liczby ludzi odbywa się wyłącznie w menu — skróty `1/2/3` w biegu zostały usunięte (ADR-0002).

## Identyfikacja graczy

Kolor kasku jest przypisany do slotu rostera i losowany **raz na wejście na stronę** (sesja), więc restart biegu (`R`) nie zmienia tym, kim jesteś. Klawisze są przypisane do **pozycji slotu** i się nie przesuwają: slot 1 → `◄ ►`, slot 2 → `A/S`, slot 3 → `K/L`, slot 4 → `Num 4/6` (dopasowanie po `e.code`, więc NumLock nie ma znaczenia). Puste sloty i Komputery nie zmieniają sterowania pozostałych — wybór slotu jest jednocześnie wyborem klawiszy.

Przed każdym biegiem pojawia się **plansza „Stawka"**: pole startowe, chip koloru, nazwa i klawisze (pomijalna `Enter`/`Spacja`, bez falstartu). Pola startowe losowane są co bieg (permutacja indeksów — numer pola odpowiada realnemu miejscu na linii startu). Podczas odliczania widoczna jest **legenda HUD** (kolor + nazwa + klawisze) oraz **znaczniki klawiszy** przy motocyklach ludzi — znacznik znika, gdy dany motocykl ruszy ze startu; legenda zostaje do zamknięcia 1. okrążenia przez wszystkich ludzi. `H` przełącza legendę tylko w tym oknie (plansza, odliczanie, 1. okrążenie).



## Menu

Stawka to **4 sloty** w jednej listwie: kliknięcie slotu przełącza
cyklicznie **pusty → człowiek → komputer**. W sumie na starcie jest tyle
motocykli, ile zajętych slotów (1–4; tyle ma tor punktów startowych i pula
kolorów), więc niemożliwe stawki albo "za duże" pole nie istnieją. Wybór
zapamiętywany jest w sesji (odświeżenie strony nie kasuje ustawienia).
Każdy slot ma **pełne tło w kolorze kasku** przypisanego na całą sesję (flat
look), a sloty obsadzone człowiekiem pokazują swoje klawisze — jeszcze przed
`Start` wiadomo, kim się będzie i jak się steruje. Klawisze zależą od pozycji
slotu, nie od liczby graczy, więc można wybrać sobie sterowanie (np. sam slot 3
= `K/L`). Domyslna stawka po świeżym załadowaniu: 1 człowiek + 3 komputery
(kolor człowieka zależy od losowania sesji). 0 ludzi dozwolone — podglądowa jazda
samych Komputerów (bez legendy i znaczników). Nazwy w rankingu:
ludzie = polska nazwa koloru („Czerwony"), Komputery = „Komputer 1"…"N".