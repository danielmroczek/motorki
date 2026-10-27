# zuzel-simple

## Co to jest

Gra/symulacja żużlowa "Kreski" - wyścigi na torach zdefiniowanych w plikach SVG (6 torów, m.in. Bydgoszcz) z wyborem liczby zawodników (1–3) i tabelą wyników. Kolory kasków jak w prawdziwym żużlu: red / white / yellow / blue.

Gra jest luźno wzorowana na [kreski.org (wersja 2001)](https://www.kreski.org/ver2001.html).

## Technologie

- Czysty JavaScript (ES modules)
- paper.js — wektorowy canvas
- Klasy: `Game`, `Level`, `Player`, `Vertex`, `EventEmitter`, `ResultsTable`, `TrackSelector`
- Szkielet HTML5 Boilerplate

## Status

Najbardziej rozwinięty „silnik" serii żużlowej, ale niedokończony (`Game.build()` z TODO, „beta" w logo).

## Uruchomienie

Projekt nie wymaga builda — wystarczy serwer statyczny (np. `npx serve` lub `python -m http.server`), ponieważ pliki JS to moduły ES.