# Feature: Bieg (race)

Odkryte przez grilling (Q1–Q14). Słownik: patrz `CONTEXT.md`.

## Cykl życia

```
MENU (App) ──Start──▶ COUNTDOWN ──GO──▶ RACING ──wszyscy ukończyli──▶ RESULTS ──przycisk / Enter / Esc──▶ MENU
```

P = pauza we wszystkich fazach (także odliczania). R = restart. Esc = porzucenie → menu.

## Decyzje

| # | Obszar | Decyzja |
|---|--------|---------|
| 1 | Odliczanie | Wiernie jak w oryginale: czerwone światła od razu, JEDNO losowe opóźnienie `rand()%400*10 + 1500` ms (równe 1500–5490, kroki 10 ms), potem zielone = GO. Overlay DOM nad .stage; nowoczesna stylistyka dozwolona; bez dźwięku w v1. |
| 2 | Falstart | Każde przedwczesne skręcenie = +1 s kary do czasu końcowego + toast „Falstart +1 s". |
| 3 | Wyścig | `laps = 4`; banner „Okrążenie X/4"; istniejące eventy checkLap/lap bez zmian semantyki (pierwsze przekroczenie = start okrążenia). |
| 4 | Meta | Każdy gracz kończy 4 okrążenia niezależnie; skończony motocykl znika (fade out) i przestaje kolidować; podsumowanie dopiero gdy WSZYSCY skończą. |
| 5 | Podsumowanie | Ranking 1–3 po czasie łącznym (okrążenia + kary — kary mogą zmienić kolejność); czas łączny + najlepsze okrążenie (+ wiersz kar gdy > 0); wyjście tylko ręczne (przycisk + Enter/Esc) → menu. |
| 6 | Klawisze | R = restart, Esc = porzucenie → menu, P = pauza. |
| 7 | Dodatkowo | Brak ADR (decyzja tanie do odwrócenia); terminologia z CONTEXT.md („Bieg", „Okrążenie", „Falstart +1 s"). |
| 8 | Brak wyścigu AI | Gracze = motocykle sterowane klawiszami; brak botów. |
| 9 | Pozycje startowe | Istniejący losowy przydział startPoints + kolorów (jak dotychczas). |

## Seams

- Stan w `Game` (`this.state`: `countdown` → `racing` → `results`), sterowany z `tick()` (pauza zamraża wszystko naturalnie).
- `App` (main.js) zostaje w MENU i nasłuchuje eventów gry; overlaye to DOM, nie canvas.
- Falstart: w fazie odliczania wciśnięcie sterowania NIE ustawia `Player.started` — tylko `penaltyMs += 1000` + event `falstart`.
- Kolejność/ ranking: total = Σ czasy okrążeń + penaltyMs; bestLap = min(z lapów).
- Skończony gracz: `finished=true` → pomijany w kolizjach, fade out w draw, nie liczy przekroczeń.

## Wartości

- Laps: 4 (opcja `options.laps`, brak UI).
- Krok losowania: 10 ms, od 1500 ms, do 5490 ms.
- Kara falstartu: 1000 ms na zdarzenie (może się kumulować).
