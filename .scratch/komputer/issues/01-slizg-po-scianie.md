# 01 — Ślizg po ścianie (poprawa kolizji)

Status: resolved

Część specu: `.scratch/komputer/spec.md`, decyzja #18. Seed dla Komputera — lepki
stan przy ścianie psułby i ludzi, i testy na sucho Mózgu.

## Zadanie

1. `Level.collide` (`js/level.js`) zwraca dziś tylko bool — dodać zwrot segmentu
   trafionego segmentu ściany (lub null).
2. Reakcja na kolizję (`Player.onCollide` / `revertPosition`, `js/player.js`):
   zamiast pełnego reverctu — cofnięcie tylko składnika ruchu **normalnego** do
   ściany; składnik styczny zostaje, tłumiony (dobierz współczynnik, np. 0.9
   jak w oryginale przy zderzeniu motor–motor).
3. Zachowania niezmienione: speed /= 2 przy zderzeniach z innymi, kick
   anglespeed, licznik okrążeń, ghost. Test ręczny: dociśnięcie ArrowRight
   w bandę spowalnia i płynie wzdłuż niej, nie zamiera.

## Kryterium

Gracz dociśnięty do ściany w kąt tonie wzdłuż niej zamiast stać w miejscu;
scenariusze zwykłej jazdy wyglądają jak dotychczas.

## Comments

### Implementacja (2026-10-28)

- `Level.collide` zwraca trafiony segment ściany (`Vertex`) lub `false` —
  `Game.tick` przekazuje go do `Player.revertPosition(wall)`; kolizje
  gracz–gracz (`collidePlayers`) wołają revert **bez** ściany (pełny cof jak
  dotychczas, speed /= 2 stays w `onCollide`).
- Ślizg: krok ticku rozbijany na składową normalną (do ściany — odrzucana)
  i styczną (wzdłuż ściany — zostaje, tłumiona × 0.9 jak mnożnik zderzeń
  oryginału). Pozycja po ślizgu staje się `lastPosition` następnego ticku,
  więc kontakt kumuluje postęp wzdłuż bandy.
- Front motocykla cofany zawsze na bliską stronę ściany (pełny revert
  wierzchołka) — inaczej kolejne moveVector startowałyby za ścianą i kolizje
  przestawały się rejestrować (wykryte i przetestowane w
  `tests/slide-multi-tick.test.js`).
- Testy (Vitest, nowy setup: `package.json`, `vitest.config.js`, `tests/`):
  zwrot segmentu, 3 scenariusze ślizgu, ślizg wielo-tickowy oraz powrót do
  normalnej jazdy po ustąpieniu kolizji — razem 9 testów.

### Znalezione ograniczenie (istniejące, nie zmieniane)

Pierwszy tick po starcie ma `moveVector` zerowy (`oldFrontVertex = null`),
a front skacze ~10 px od pozycji — ściana bliżej niż ~10 px startu może
zostać przeskoczona bez detekcji. Zachowanie oryginału, poza zakresem #18.
