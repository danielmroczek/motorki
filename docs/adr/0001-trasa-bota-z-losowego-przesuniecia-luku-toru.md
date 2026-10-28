# Trasa Komputera powstaje z losowego przesunięcia łuku toru

Oryginał (Żuzel 2001, mot.exe) czytał trasy AI z plików `<tor>_ai_d01..d04` — stałych,
ręcznie utworzonych zestawów punktów (1–1000 na plik). Remake torów SVG nie ma żadnej
takiej danych i nie chcieliśmy ręcznie tworzyć 24 plików tras dla 6 torów.

**Decyzja:** Trasa jest generowana w runtime z geometrii toru SVG — łuk środkowy toru
(wyznaczony ze ścian) o stałej gęstości punktów, przesunięty bocznie o losowy offset
losowany **raz na bieg** (wspólny dla wszystkich Komputerów w biegu — indywidualność
jazdy wynika ze Scatter, nie z różnych Tras). Konsumuje ją niemal 1:1 radar i mózg
oryginału (jitter/scatter, progi kąta −10°/+21°, fallback kolejności −1/0/1), więc
zachowanie jezdne jest zgodne z pierwowzorem.

## Considered Options

- **Pliki tras w SVG toru** (`<path data-ai="d1">`) — wierniejsze oryginałowi, ale
  ręczny koszt dla każdego toru; Tor przybywające z komunitu nie miałby tras.
- **Stałe 4 warianty trasy (replikacja `_ai_d01..04`)** — odrzucone na korzyść losowego
  offsetu: ta sama wartość (różnorodność Tras między biegami), zero danych do utrzymywania.

## Consequences

- Generowanie tras jest umieszczone w kodzie (krytyczny kod dla jakości jazdy Komputerów),
  nie w zasobach — zmiana geometrii toru SVG automatycznie aktualizuje Trasy.
- Losowy offset oznacza, że powtórka tego samego toru może biec inaczej — celowe,
  zgodne z rolą losowania trasy przez oryginał na starcie biegu (przegląd 9 wpisów).
