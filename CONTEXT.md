# Kreski

Gra żużlowa „Kreski" — jednoczęściowa gra wyścigowa na torach SVG. Ten dokument to wyłącznie słownik domeny (język projektu), nie specyfikacja.

## Language

**Bieg (heat)**:
Pojedyncza, skończona rozgrywka: odliczanie → jazda (kilka okrążeń) → podsumowanie. W oryginale (kreski.org 2001) na serię składa się wiele biegów — tu, na razie, seria = 1 bieg.
_Avoid_: wyścig, race, mecz.

**Jazda (racing)**:
Faza biegu, w której motocykle poruszają się i mierzone są okrążenia. Zaczyna się w momencie zgaszenia świateł, kończy gdy wszyscy ukończą.
_Avoid_: wyścig.

**Odliczanie (countdown)**:
Faza przed startem: zapalanie świateł z losowym rytmem, losowa pauza, zgaszenie świateł = legalny moment startu. Wzorowane na oryginale (losowe opóźnienie 1,5–5,5 s).
_Avoid_: intro, animacja startowa.

**Falstart (jump start)**:
Próba ruszenia przed zgaszeniem świateł; każde wciśnięcie sterowania to +1 s kary doliczanej do czasu końcowego gracza. Celowe odstępstwo od oryginału (tam: eliminacja).
_Avoid_: dyskwalifikacja.

**Podsumowanie (results)**:
Faza po zakończeniu jazdy: ranking końcowy z czasami; wyjście ręczne (przycisk/klawisz) wraca do menu.
_Avoid_: ekran końcowy, game over.

**Klasyfikacja (ranking)**:
Ustalanie miejsc w Podsumowaniu wg łącznego czasu (okrążenia + kary), a nie czysto wg kolejności na mecie — kary mogą zmienić kolejność.

**Okrążenie (lap)**:
Pełne przejechanie trasy od linii startu-mety w dobrą stronę. Liczba okrążeń na bieg: 4.
_Avoid_: kolo, round.

**Ukończenie (finish)**:
Moment przekroczenia linii mety po przejechaniu ostatniego (4.) okrążenia.
_Avoid_: koniec biegu (to wyzwalacz Podsumowania, nie sam moment).
