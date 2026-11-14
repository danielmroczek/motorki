# Tożsamość gracza: kolor ze slotu rostera, klawisze z pozycji slotu

W biegu 2–4 graczy nie było wiadomo, kto jest kim: kolory kasków tasowały się w
`Game.setupPlayers()` przy **każdym** starcie (także po `R`), a klawisze były
przypięte do indeksu w tablicy `players` — czyli do kolejności „ludzie, potem
komputery", a nie do slotu w menu. Czwarty człowiek nie miał żadnych klawiszy,
mimo że roster pozwalał obsadzić nim slot. Nikt też nie widział sterowania
przed startem ani nie wiedział, z którego pola startuje.

**Decyzja:** tożsamość gracza rozdzielamy na dwie niezależne osie:

- **kolor kasku ⇄ slot rostera** — losowany **raz na wejście na stronę**
  (permutacja puli `red/white/yellow/blue` zapisana w `sessionStorage`
  `zuzel-simple.colors`). `R` i restart biegu nie zmieniają, kim jest gracz;
  menu pokazuje kolor pełnym tłem slotu (flat look), więc wybór stawki jest
  świadomy. `Game` nie tasuje już kolorów — dostaje gotowe wpisy (`options.slots`).
- **klawisze ⇄ pozycja slotu** (slot 1 → `◄ ►`, slot 2 → `A/S`, slot 3 → `K/L`,
  slot 4 → `Num 4/6`): puste sloty i Komputery nie przesuwają sterowania, więc
  wybór slotu jest jednocześnie wyborem klawiszy. Dopasowanie po
  `KeyboardEvent.code`, więc NumLock i układ klawiatury nie rozjeżdżają
  czwartego zestawu (`e.key` przy wyłączonym NumLocku to `Home`/`PageDown`).
  Aliasy ergonomiczne, celowo nieobecne w UI: `ArrowDown` = prawo w 1. zestawie,
  `Num 5` = lewo w 4. zestawie, `,`/`.` = lewo/prawo w 4. zestawie (laptopy
  bez numpada).

Identyfikację komunikujemy w trzech miejscach: plansza „Stawka" przed
odliczaniem (pole startowe, kolor, nazwa, klawisze; pomijalna `Enter`/`Spacja`,
bez falstartu), legenda HUD + znaczniki klawiszy przy motocyklach ludzi
(znacznik znika, gdy motocykl ruszy; legenda do zamknięcia 1. okrążenia przez
wszystkich ludzi, `H` przełącza tylko w tym oknie) oraz tabela wyników (chip
koloru, nazwa, klawisze). Pola startowe
nadal tasują się **co bieg**, ale tasujemy permutację indeksów — numer pola
odpowiada realnemu miejscu na linii startu, a plansza jest sortowana po polu.

## Considered Options

- **Klawisze przypięte do kolejności ludzi** („N-ty człowiek = N-ty zestaw") —
  odrzucone: przy pustym slocie 1 gracz ze slotu 2 dostawał strzałki, więc nie
  dało się świadomie wybrać sterowania. Pozycja slotu jest stała i widoczna
  w menu.
- **Losowanie kolorów co bieg** — świeższe, ale po `R` gracz nagle staje się
  innym kolorem; łamie naukę sterowania w trakcie serii restartów.
- **Zmiana stawki klawiszami `1/2/3` w biegu** — usunięta: przy 4 ludziach na
  jednej klawiaturze to łatwa pomyłka, a roster w menu wystarcza.

## Consequences

- `js/lineup.js` jest jedynym źródłem prawdy o kolorach, nazwach, kontraście
  tekstu (`isLightHelmet`) i zestawach klawiszy; `RosterMenu` renderuje z niego
  menu, `Game` buduje z niego bieg.
- Nowe elementy HUD (plansza, legenda, znaczniki) są czystym UI w `main.js` —
  nie dotykają fizyki ani AI; `Game` jedynie przełącza widoczność znaczników.
- Zmiana liczby ludzi wymaga wyjścia do menu (`Esc`), nie skrótu w biegu.
