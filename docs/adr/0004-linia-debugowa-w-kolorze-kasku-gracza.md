# Linia debugowa Trasy w kolorze kasku swojego gracza

ADR-0003 ustalił overlay `?debug=true` rysujący **wszystkie Trasy stawki, każdą
innym kolorem** (paleta `DEBUG_COLORS` indeksowana kolejnością tras). Kolor niósł
więc numer porządkowy Trasy — jedyny cel: odróżnić linie od siebie. W praktyce
było to mylące: kolor linii nie mówił, **czyj** to tor jazdy, a żeby ustalić,
który Komputer jedzie którą linią, trzeba było zestawiać kolejność w tablicy
`brains` z legendą HUD. Prośba z rozgrywki: kolor linii ma być tożsamy
z kolorem gracza (`biały, żółty, niebieski, czerwony`).

**Decyzja:** kolor punktów Trasy w overlayu to **kolor kasku gracza**, któremu ta
Trasa należy (`Player.helmetColor`, źródło: `HELMET_HEX` z `js/lineup.js`,
ADR-0002). Paleta `DEBUG_COLORS` znika.

- **API:** `Route.drawDebug(routes)` przyjmuje wpisy `{ points, color }` —
  `points` to pętla punktów Trasy, `color` kolor gracza. Brak koloru oznacza
  linię „niczyją” (sama baza toru) i dostaje `Route.BASE_DEBUG_COLOR`.
- **Własność koloru:** kolor zostaje przy graczu. `Game` nie kopiuje go do
  Mózgu — overlay w `main.js` sięga po gracza przez `game.brainByPlayer`, więc
  **Mózg pozostaje logiką decyzyjną** (CONTEXT.md) i nie nosi pól prezentacyjnych.
- **Linia bazy:** fiolet `#8e24aa` — poza pulą kasków (`red/white/yellow/blue`),
  więc nie da się jej pomylić z linią żadnego gracza. Wcześniejszy szary
  `#9e9e9e` był zbyt bliski „białego” kasku (`#bdbdbd`).
- **Zakres:** linie dostają wyłącznie Komputery — tylko one mają Trasę
  (`Route` = „trasa pojedynczego Komputera”). Człowiek nie ma linii, bo nie ma
  czego rysować; w domyślnej stawce 1 + 3 widać trzy z czterech kolorów kasków.

## Considered Options

- **Paleta indeksowana kolejnością Tras (status quo, ADR-0003)** — odrzucona:
  kolor nie identyfikuje gracza, a debug wymagał mapowania w głowie.
- **Kolor w polu Mózgu (`brain.helmetColor`)** — najprostsze w `main.js`, ale
  wprowadza do Mózgu pole czysto prezentacyjne i dubluje dane `Player`; odrzucone.
- **Szary kolor linii bazy** — odrzucony, bo zlewa się z białym kaskiem.
- **Osobny typ `{ points, color }` (klasa `DebugRoute`)** — nadmiar dla dwóch pól
  w prywatnym API debugowym; wystarcza kształt obiektu opisanego w JSDoc.

## Consequences

- `Route.forTrack(level, rng, true)` (podgląd samej geometrii) rysuje linię
  bez koloru gracza — fioletem; JSDoc mówi to wprost.
- Zmiana jest czysto debugowa: nie dotyka fizyki, AI ani rankingu.
- Aktualizuje punkt „Overlay debugowy” z ADR-0003 (ADR-0001/0003 zostają jako
  zapis wcześniejszych wyborów); README opisuje nowe API i kolory.
