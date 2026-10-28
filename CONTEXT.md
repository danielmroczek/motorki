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

**Komputer (computer)**:
Motocykl, który sam generuje polecenia lewo/prawo zamiast człowieka. Na starcie biegu jest ich łącznie (z ludźmi) do 4.
_Avoid_: bot, AI, gracz komputerowy, CPU.

**Radar (radar)**:
Wycinek spojrzenia Komputera do przodu: najbliższy punkt trasy dalej niż minimalny dystans — cel, do którego dopasowuje kąt.
_Avoid_: cel, target, waypoint (to punkt na Trasie, nie odczyt Radaru).

**Mózg (brain)**:
Logika decyzyjna Komputera: porównuje kąt celu z obecnym kierunkiem i decyduje: prosto, lewo lub prawo — z wyjątkiem kolizyjnych prób.
_Avoid_: AI, sterownik, kontroler.

**Trasa (route)**:
Ciąg kolejnych punktów wskazujących przebieg jazdy wokół toru, losowany na bieg. Komputer ma własną Trasę, prowadzi ją cyklicznie i podąża za nią przez cały bieg; generowana z geometrii toru SVG.
_Avoid_: waypointy, ścieżka, linia jazdy.

**Scatter**:
Rozmycie punktu Radaru na poszczególnych klatkach, określające dokładność prowadzenia Komputera — mniejszy scatter = precyzyjniejsza jazda. Różni Komputery mają inne poziomy scatter.
_Avoid_: jitter, szum, losowość.

**Ślizg (ślizg po ścianie)**:
Reakcja motocykla na uderzenie w ścianę toru: składowa ruchu prostopadła do ściany jest odrzucana, a równoległa zostaje w tłumionej formie — motocykl płynie wzdłuż bandy zamiast zastygać w miejscu.
_Avoid_: wall slide, slajd.
