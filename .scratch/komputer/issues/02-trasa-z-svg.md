# 02 — Trasa z geometrii toru SVG

Status: ready-for-agent

Część specu: decyzja #12; ADR: `docs/adr/0001-trasa-bota-z-losowego-przesuniecia-luku-toru.md`.

## Zadanie

1. Nowy moduł (np. `js/route.js`): z punktów ścian toru (już parsowanych przez
   `Level`) wyznacza łuk środkowy, próbkowany o stałej gęstości.
2. Offset boczny losowany **raz na bieg** (jedna wartość wspólna dla wszystkich
   Komputerów w biegu); punktów tak dużo, żeby Radar czuł kolejne punkty
   co ~16+ px skoku.
3. API: `Route.forTrack(level, rng) -> punkty [{x,y}]`, podaje też punkt startowy
   najbliższy pozycji startowej (do wyznaczenia pierwszego indeksu waypointa).
4. Punktów nie rysujemy (debug overlay za護 jako flaga Argumentu).

## Kryterium

Na każdym z 6 torów pokolenie zwraca sensowny zamknięty łuk obejmujący tor;
zgaszenie i ponowne tazzenie biegu daje inny offset.
