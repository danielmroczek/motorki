# Feature: Bieg (race)

Odkryte przez grilling (Q1–Q14). Słownik: patrz `CONTEXT.md`.

## Cykl życia

```
MENU (App) ──Start──▶ LINEUP (plansza stawki) ──▶ COUNTDOWN ──GO──▶ RACING ──wszyscy ukończyli──▶ RESULTS ──Enter / R──▶ ten sam bieg; przycisk / Esc──▶ MENU
```

P = pauza we wszystkich fazach (także odliczania). R = restart. Esc = porzucenie → menu.
H = legenda (kto kim jest / jak steruje) — tylko w LINEUP, COUNTDOWN i na 1. okrążeniu.

LINEUP: plansza „Stawka" (pole startowe, kolor, nazwa, klawisze; pomijalna `Enter`/`Spacja`,
bez falstartu). Dodana przez ADR-0002 — decyzja #9 poniżej częściowo unieważniona.

## Decyzje

| # | Obszar | Decyzja |
|---|--------|---------|
| 1 | Odliczanie | Trzy etapy: **Ready** (1,2 s, czerwone lampki, ton 440 Hz) → **Set** (1,2 s, pomarańczowe lampki, ten sam ton) → losowa pauza 0,8–2,5 s → **Go!** (3 zielone lampki, ton 660 Hz). Tony syntezowane w WebAudio (70 ms, `square`), bez sampli. Overlay DOM nad .stage; nowoczesna stylistyka dozwolona. |
| 2 | Falstart | Każde przedwczesne skręcenie = +1 s kary do czasu końcowego + toast „Falstart +1 s". |
| 3 | Wyścig | `laps = 4`; banner „Okrążenie X/4"; istniejące eventy checkLap/lap bez zmian semantyki (pierwsze przekroczenie = start okrążenia). |
| 4 | Meta | Każdy gracz kończy 4 okrążenia niezależnie; skończony motocykl znika (fade out) i przestaje kolidować; podsumowanie dopiero gdy WSZYSCY skończą. |
| 5 | Podsumowanie | Ranking po czasie biegu od zielonego światła do mety (`raceElapsed`, standing start liczy się każdemu) + kary — kary mogą zmienić kolejność; czas biegu + najlepsze okrążenie (+ wiersz kar gdy > 0); dwa przyciski: „Jeszcze raz” (primary, Enter / R = powtórka tego samego biegu) i „Do menu” (secondary, Esc). |
| 6 | Klawisze | R = restart, Esc = porzucenie → menu, P = pauza. Reguła UX: Enter uruchamia widoczny przycisk primary (zielony), Esc — secondary (stłumiony); w menu Enter startuje bieg, w podsumowaniu Enter = jeszcze raz. |
| 7 | Dodatkowo | Brak ADR (decyzja tanie do odwrócenia); terminologia z CONTEXT.md („Bieg", „Okrążenie", „Falstart +1 s"). |
| 8 | Brak wyścigu AI | Gracze = motocykle sterowane klawiszami; brak botów. |
| 9 | Pozycje startowe | ~~Istniejący losowy przydział startPoints + kolorów (jak dotychczas).~~ **Zaktualizowane przez ADR-0002:** pola startowe losowane co bieg (permutacja indeksów), kolory przypisane do slotów rostera i stałe w sesji. |

## Seams

- Stan w `Game` (`this.state`: `lineup` → `countdown` → `racing` → `results`), sterowany z `tick()` (pauza zamraża wszystko naturalnie). W `lineup` tick nie liczy czasu ani nie rusza AI — czeka na `proceed()` z `App`.
- `App` (main.js) zostaje w MENU i nasłuchuje eventów gry; overlaye to DOM, nie canvas.
- Falstart: w fazie odliczania wciśnięcie sterowania NIE ustawia `Player.started` — tylko `penaltyMs += 1000` + event `falstart`.
- Odliczanie: `Game.beginCountdown()` buduje harmonogram (`startSequence.js`: etapy 1–2 stałe, pauza przed startem losowa) i emituje `countdownstage`; `Game.advanceCountdown()` w `tick()` przechodzi przez etapy, a etap `start` wywołuje `go()`. `App` mapuje etap na klasy `.countdown` (`stage-1` / `stage-2` / `green`) i podpis w `.go`, oraz odtwarza ton (`startSound.js`, odblokowany klikiem „Start").
- Kolejność/ ranking: total = `player.finishTime` (raceElapsed na mecie) + penaltyMs; bestLap = min(z lapów).
- Skończony gracz: `finished=true` → pomijany w kolizjach, fade out w draw, nie liczy przekroczeń.

## Wartości

- Laps: 4 (opcja `options.laps`, brak UI).
- Etapy startu: 1200 ms (przygotowanie), 1200 ms (gotowość), pauza 800–2500 ms (losowa), potem start.
- Kara falstartu: 1000 ms na zdarzenie (może się kumulować).
