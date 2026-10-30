# Feature: Komputer (bot)

Odkryte przez grilling (2 rundy, Q1–Q16), 2026-10-28. Słownik: patrz `CONTEXT.md`
(Komputer, Radar, Mózg, Trasa, Scatter). Decyzje zasugerowane RE oryginału
(`d:\docs\zuzel-analysis\fizyka.md` §5–§8, §10). ADR: `docs/adr/0001-...`
(Trasa z losowego przesunięcia łuku toru). Tickets: GitHub issues
`danielmroczek/kreski` #1–#4 (źródło prawdy dla stanu wykonania).

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
| 17 | Menu | Jedna lista **4 slotów** (`rosterMenu.js`): klik slotu przełącza pusty → człowiek → komputer → pusty; stawka 1–4 motocykli wg zajętych slotów (limity puli kolorów i punktów startowych toru — niemożliwe kombinacje nie istnieją). Domyslnie **1 człowiek + 3 komputery**; **0 ludzi dozwolone** (podglądowa jazda samych Komputerów). Nazwy: ludzie = kolor (jak dotychczas), Komputery = „Komputer 1"…"N". Wybór trzymany w `sessionStorage`. Klawisze `1`/`2`/`3` w biegu: N ludzi + **reszta 4 slotów = Komputery** (`restartWithPeople` — uzupełnia, nie tylko dociska) i **synchronizują menu** przez `Game.rosterChanged` → `RosterMenu.set()`, więc menu i magazyn zawsze pokazują stawkę ostatniego biegu. Slot w menu nie obiecuje koloru motocykla (kolory losuje stawka). |
| 18 | Kolizje (poprawka, nie port) | Ślizg po ścianie: `Level.collide` zwraca trafiony segment; przy kolizji cofamy tylko składnik ruchu **normalny** do ściany, składnik styczny zostaje (tłumiony). Dotyczy wszystkich motocykli. Tył kadłuba bez testu (na później). |
| 19 | Brak stuck/eliminacji | Bez licznika stuck i eliminacji (zmiana reguł biegu to osobny feature). Unikanie przez fallback Mózgu; jeśli testy pokażą, że Komputer utyka — wracamy do tematu. |
| 20 | Pure-pursuit zamiast portu (unieważnia #11, #13–#15) | Port Radara (§8.4–§8.6) gonił najbliższy punkt Trasy — przy punktach bliższych niż ~16 px cel zmieniał się o ±90°/klatkę → „bączki" i jazda w kółko. Nowa logika **pure-pursuit**: najbliższy punkt (okno ±6/22, fallback pełny skan po 45 px) tylko kotwiczy pozycję na pętli; celem skrętu jest punkt `look` naprzód po pętli (`look = min(6, max(3, 2 + mode))`); sterowanie kątowe z martwą strefą ±8°. Fallback testu na sucho zachowany, kolejność prób **od przodu**: prosto → lewo → prawo. Trasa zorientowana zgodnie z kierunkiem startu toru (`Level.startPoints[0].angle`; gdy styczna w starcie jest prostopadła do jazdy, rozstrzyga segment ćwierć pętli dalej — start na zakręcie nie zostawia Trasy pod prąd) — w przeciwnym razie Komputery jadą pod prąd i okrążenia nie są zaliczane (`cheat`). Mode 1–4 pozostaje osobowością (patrz 3–6 punktów przed siebie). |

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

- Pure-pursuit: LOOKAHEAD_POINTS 3; okno najbliższego punktu −6/+22;
  LOST_DISTANCE 45 px; DEAD_BAND_DEG 8°; lookahead wg mode = min(6, max(3, 2+mode)).
- Reakcja: default 140–320 ms; mediana × 0,75 / 0,9 / 1,1 / 1,3 + szum.
- Historia startów: 10 próbek w `localStorage`.
- Limit stawki: 4 motocykle łącznie (ludzie + Komputery).
