# 03 — Radar i Mózg (port logiki oryginału)

Status: ready-for-agent

Część specu: decyzje #11, #13, #14, #15, #19. Źródło prawdy: `d:\docs\zuzel-analysis\fizyka.md` §8.1–§8.6.

## Zadanie

1. **Radar** (§8.4): od bieżącego indeksu waypointa 10 punktów Trasy do przodu;
   pomiń punkty bliższe niż 16 px od środka sprite'a; wybierz najdalszy; jitter
   Scatter (mode → 3/2/1/0 px) losowany osobno na X i Y **co klatkę**;
   `waypointIdx >= count → 0` (zawinięcie do przodu).
2. **Kąt celu** (§8.5): atan2(dx, dy)·180/π, konwencja gry: 0° = północ, rosnąco CW.
3. **Mózg** (§8.6): dAng = kątCelu − kąt; > +21° → prawo, < −10° → lewo,
   inaczej prosto. Komenda: −1 / 0 / +1.
4. **Test na sucho** (§5.3): mini-symulacja następnego kroku (pozycja, kąt,
   speed, anglespeed po komendzie) + istniejące `Level.collide` /
   `collidePlayers` na symulowanych wektorach, read-only. Jeśli wybrana komenda
   koliduje → próbuje −1, 0, +1 po kolei (fallback §8.7/8.6 oryginału).
5. **Bez** licznika stuck i eliminacji (decyzja #19).

## Kryterium

Moduł Mózgu testowany ręcznie/na konsoli: dla próbek stanu zwraca oczekiwane
komendy; przy zbliżeniu do ściany fallback wybiera komendę wolną od kolizji.
