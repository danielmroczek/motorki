# 04 — Podpięcie Komputera do gry i menu

Status: ready-for-agent

Część specu: decyzje #10, #16, #17. Zależności: 01–03.

## Zadanie

1. **Kontroler**: co klatkę fazy `racing` dla każdego Komputera Mózg ustawia
   `Player.controls.left/right` (seam istniejący). Komputer nie dotyka sterowania
   w odliczaniu (falstart niemożliwy), rusza po reakcji (pkt 2).
2. **Adaptacyjna reakcja startowa**: moduł czytający/zapisujący `localStorage`
   (ostatnie 10 próbek); sample = czas pierwszego skrętu człowieka po GO
   (średnia przy 2+ ludziach, próbki z falstartem odrzucone), zapis po biegu;
   opóźnienie Komputera = mediana × 0,75/0,9/1,1/1,3 (wg scatter-mode) + szum;
   brak historii → 140–320 ms.
3. **Menu**: kontrolka „Komputery: 0–4" + istniejące „Ludzie"; limit łącznie
   ≤ 4; 0 ludzi dozwolone (start biegu samych Komputerów). Nazwy: Komputery = 
   „Komputer 1"…„N" (HUD + tabela Podsumowania), ludzie = kolor jak dotychczas.
4. **Cykl życia**: ukończenie → ghost znika, Podsumowanie czeka na wszystkich;
   ranking po czasie łącznym (kary Komputera = 0); R/Esc/P działają jak dotychczas.

## Kryterium

Manuel: 1 człowiek + 1–3 Komputery jadą cały bieg do mety i lądują w rankingu;
0 ludzi odpala bieg samych Komputerów; opóźnienie startu Komputerów zbliżone
do własnej historii startów (widać w konsoli/podglądzie).
