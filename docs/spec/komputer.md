# Feature: Komputer (bot)

Odkryte przez grilling (2 rundy, Q1–Q16), 2026-10-28. Słownik: patrz `CONTEXT.md`
(Komputer, Radar, Mózg, Trasa, Scatter). Decyzje zasugerowane RE oryginału
(`d:\docs\zuzel-analysis\fizyka.md` §5–§8, §10). ADR: `docs/adr/0001-...`
(Trasa z losowego przesunięcia łuku toru).

## Cykl życia

```
MENU ──Start──▶ COUNTDOWN ──GO + reakcja──▶ RACING (Trasa cykliczna)──▶ RESULTS
```

- Komputery przechodzą tę samą maszynę stanów co ludzie: odliczanie, falstart
  niemożliwy (nie dotykają sterowania przed GO), ruszają po losowej reakcji.
- W RACING, w każdej klatce: Mózg generuje komendę −1 / 0 / +1 (lewo / prosto /
  prawo), identyczną semantyką jak wciśnięcie klawisza przez człowieka.
- Ukończenie = 4 okrążenia → ghost znika i przestaje kolidować, jak człowiek.
- Podsumowanie: Komputery w rankingu jak ludzie (czas + kary; kary Komputera = 0).

## Decyzje

| # | Obszar | Decyzja |
|---|--------|---------|
| 10 | Unieważnienie #8 | Decyzja #8 spec biegów („brak botów") unieważniona przez tę decyzję. |
| 11 | Port logiki | Pełny port 3 warstw oryginału: Trasa → Radar → Mózg (fizyka.md §8). |
| 12 | Trasa | Generowana z geometrii toru SVG: łuk środkowy, losowy boczny offset **raz na bieg**, wspólny dla Komputerów; punkty o stałej gęstości, cyklizowane do przodu (`waypointIdx ≥ count → 0`). ADR-0001. |
| 13 | Radar | Patrz §8.4 oryginału: 10 punktów Trasy do przodu, pierwszy dalej niż 16 px, obietnica celu = najdalszy punkt, jitter Scatter osobno co klatkę na osie X/Y. |
| 14 | Mózg | Patrz §8.6 oryginału: dAng = kąt celu − kierunek; > +21° → prawo, < −10° → lewo, inaczej prósto z marżą. Fallback: jeśli ruch punktowany kończy kolizją (test na sucho), próbuje −1/0/1 po kolei. |
| 15 | Scatter | mode 1–4 wg kolejności dodawania do stawki → jitter 3/2/1/0 px. |
| 16 | Start | Reakcja = mediana ostatnich 10 startów człowieka × czynnik osobowości (0,75/0,9/1,1/1,3 wg scatter-mode) + mały szum; bez historii → 140–320 ms. Sample zapisywany po biegu (ludzie bez falstartu; przy 2+ ludzi średnia). Magazyn: `localStorage`, jeden profil (bez per-tor). |
| 17 | Menu | Dwie kontrolki: **Ludzie 0–3** (istniejące) i **Komputery 0–4**; limit łącznie ≤ 4; **0 ludzi dozwolone** (podglądowa jazda samych Komputerów). Nazwy: ludzie = kolor (jak dotychczas), Komputery = „Komputer 1"…"N". |
| 18 | Kolizje (poprawka, nie port) | Ślizg po ścianie: `Level.collide` zwraca trafiony segment; przy kolizji cofamy tylko składnik ruchu **normalny** do ściany, składnik styczny zostaje (tłumiony). Dotyczy wszystkich motocykli. Tył kadłuba bez testu (na później). |
| 19 | Brak stuck/eliminacji | Bez licznika stuck i eliminacji (zmiana reguł biegu to osobny feature). Unikanie przez fallback Mózgu; jeśli testy pokażą, że Komputer utyka — wracamy do tematu. |

## Seams

- Mózg to kontroler on top of istniejącego seamu `Player.controls = {left, right}` —
  co klatkę w fazie `racing` ustawia `steerOn`/`steerOff`; kolizje, finansowanie
  prędkości, okrążenia, falstart i ghosty działają bez zmian logiki gracza.
- Próba na sucho (odpowiednik `StepperSim` oryginału) = lokalny mini-symulacja
  stanu (pozycja, kąt, prędkość, anglespeed) + wywołania istniejących
  `Level.collide` / `collidePlayers` na symulowanych wektorach — read-only, bez
  dotykania stanu rzeczywistego gracza (fizyka.md §5.3).
- Adaptacja startówek samodzielny moduł (localStorage), zasilany eventem
  pierwszego skrętu po GO.
- Menu: nowa opcja przechodzi przez te same przeguby co playersCount.
- Ślizg ściany modyfikuje tylko ścieżkę reakcji `onCollide` + zwrot segmentu z `Level.collide`.

## Wartości

- RADAR_MIN_DIST: 16 px; RADAR_LOOKAHEAD: 10 punktów.
- Progi Mózgu: AI_TURN_RIGHT_THRESH +21°, AI_TURN_LEFT_THRESH −10°.
- Scatter mode 1–4 → jitter 3/2/1/0 px (oryginał: 4 − mode % 5).
- Reakcja: default 140–320 ms; mediana × 0,75 / 0,9 / 1,1 / 1,3 + szum.
- Historia startów: 10 próbek w `localStorage`.
- Limit stawki: 4 motocykle łącznie (ludzie + Komputery).
