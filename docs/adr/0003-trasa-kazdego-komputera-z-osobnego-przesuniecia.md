# Trasa każdego Komputera z osobnego, stratyfikowanego przesunięcia łuku toru

ADR-0001 ustalił **jeden wspólny boczny offset na bieg**: cała stawka Komputerów
jechała po identycznej Trasie, a indywidualność wynikała wyłącznie z osobowości
Mózgu (lookahead 3→6 punktów) i mnożnika reakcji startowej. Skutki w rozgrywce:
boty jadą gęsiego po jednej linii, więc wyprzedzanie jest walką o ten sam
korytarz, a bieg 3 Komputerów wygląda „taśmowo". Oryginał czytał trasy AI
z osobnych plików `<tor>_ai_d01..d04` — indywidualna linia per komputer jest
więc bliższa pierwowzorowi niż wspólny offset.

**Decyzja:** Trasę bazową (łuk środkowy, wygładzony, zorientowany zgodnie
z kierunkiem jazdy) liczymy **raz na bieg**, a każdy Komputer dostaje własną
linię: `Route.forField(level, count, rng)` przesuwa bazę o **osobny** offset
wzdłuż lokalnych normalnych, **w stronę wnętrza pętli**.

- **Strona wewnętrzna:** wyznaczana geometrycznie raz na punkt bazy — Trasa
  otacza infield, więc wystarczy test punkt-w-wielokącie na punkcie odsuniętym
  o 0,5 px wzdłuż ±normalnej (odporne też na tory wklęsłe). Przypadki
  niejednoznaczne dostają znak większościowy.
- **Zakres:** `MAX_OFFSET_IN = 0.5` w stronę wewnętrzną i tylko
  `MAX_OFFSET_OUT = 0.2` w stronę zewnętrzną (w ułamkach dystansu do najbliższej
  ściany, czyli maks. 1/4 szczeliny od osi po stronie wewnętrznej). Pas jest
  przycięty od zewnątrz, bo zewnętrzna linia jest dłuższa i tylko odbierała
  botom czas.
- **Rozkład:** pozycja w pasie (0 = skraj wewnętrzny, 1 = skraj zewnętrzny)
  losowana jest z gęstości **liniowej malejącej w stronę zewnętrzną**
  (p ∝ 1 − t); funkcja odwrotna $t = 1 - \sqrt{1-u}$. Większość stawki jedzie
  więc po wewnętrznej.
- **Rozdzielenie linii:** pas dzielony na `count` warstw o **równym
  prawdopodobieństwie** (kwantyle powyższego rozkładu), warstwy tasowane
  (Fisher–Yates na przekazanym `rng`), a komputer dostaje **środek swojej
  warstwy z jitterem do ±1/4 jej szerokości**. Linie są gwarantowanie różne,
  a nie przypadkowo „bliźniacze" jak przy niezależnym losowaniu; przy 4 botach
  daje to biasy ≈ −0,91 / −0,71 / −0,46 / −0,10 (wszystkie po wewnętrznej).
- **Jeden komputer:** przy `count = 1` losujemy z całego pasa tym samym
  rozkładem — różnorodność między biegami zostaje, tylko przesunięta do wnętrza.
- **Zero komputerów:** `forField` zwraca pustą tablicę i **nie dotyka geometrii**.
- **Własność Trasy:** trasa żyje w `brain.route` (nie ma już `Game.route`);
  `Brain.decide(player, route, world)` zachowuje trasę argumentem, więc pozostaje
  funkcją czystą, a testy Mózgu karmią go dowolnymi tablicami.
- **Overlay debugowy** (`?debug=true`) rysuje wszystkie Trasy stawki, każdą
  innym kolorem — inaczej nie da się zweryfikować, że linie się rozjechały.

## Considered Options

- **Wspólny offset (status quo, ADR-0001)** — prostszy, ale stawka jedzie po
  jednej linii; odrzucone jako źródło „taśmowej" jazdy.
- **Niezależne losowanie offsetu per komputer** — proste, ale przy 4 botach
  dwa mogą wypaść niemal identycznie; stąd stratyfikacja.
- **Same środki warstw (bez jitteru)** — najczystsze rozdzielenie, ale linie są
  wtedy „schodkowe" i powtarzalne co bieg; jitter ±1/4 warstwy zachowuje
  różnorodność między biegami bez ryzyka zbliżenia linii.
- **Symetryczny pas + skos próbkowania** — przesuwa całą stawkę, ale nie
  przycina zewnętrza, więc jeden bot dalej może wylosować wyraźnie dłuższą
  linię; dlatego limit zewnętrzny jest mniejszy od wewnętrznego.
- **Strona wewnętrzna z obwodu (empirycznie)** — policzyć obwód dwóch skrajnych
  linii i wybrać krótszą: prostsze, ale 2× więcej generacji i utożsamia
  „wewnętrzną" z „krótszą", co na nietypowych torach bywa nieprawdą.
- **Offset powiązany z `mode`** (mode 1 wewnętrzna, mode 4 zewnętrzna) — daje
  stały charakter bota, ale odbiera różnorodność między biegami i dubluje
  osobowość, która już siedzi w lookaheadzie i reakcji startowej.

## Consequences

- Koszt: jedna baza na bieg + `count` × (offset + resampling); przy 4 botach
  pomijalny wobec samego `radialLoop` (360 promieni × ściany).
- Różne linie mają różną długość, więc boty dostają różne czasy okrążenia z samej
  geometrii — **świadomie akceptowane** (w oryginale boty też miały różne trasy),
  bez kompensacji. Pomiar na torze `294` (3 komputery): przy pasie symetrycznym
  obwody **1082 / 1231 / 1353 px** i czasy **2,75–3,53 s**; po przejściu na
  jednostronny pas z gęstością liniową obwody **1059 / 1113 / 1228 px** (baza
  ≈1269), a czasy **2,82–3,28 s** — rozrzut stopniał o ok. 40%. Dźwignią, gdyby
  kiedyś był zbyt duży, jest para `MAX_OFFSET_IN`/`MAX_OFFSET_OUT`.
- Odchylenia od własnej Trasy w zakrętach (nawet 40–70 px i ślizg po bandzie)
  występują **także przy wspólnej Trasie** — to cecha pure-pursuit z pełnym
  gazem, nie skutek jednostronnego pasa; mierzone przed i po zmianie.
- Na starcie motocykl stoi na stałym punkcie pola, więc pierwsze klatki to
  skręt do własnej linii (do ~1/4 szczeliny w bok). Mózg toleruje to pełnym
  skanem po `LOST_DISTANCE = 45 px`; jeśli w rozgrywce pojawi się szarpanina,
  następnym krokiem jest wygaszanie offsetu wzdłuż pierwszych ~200 px łuku.
- Aktualizuje decyzję #12 w `docs/spec/komputer.md`; ADR-0001 zostaje jako
  zapis wcześniejszego wyboru (ADR są niezmienne).
