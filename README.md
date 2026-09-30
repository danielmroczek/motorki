# zuzel-simple

## Co to jest

Gra/symulacja żużlowa „Brum.io (beta)" — wyścigi na torach zdefiniowanych w plikach SVG (6 torów, m.in. Bydgoszcz) z wyborem liczby zawodników (1–3) i tabelą wyników. Kolory kasków jak w prawdziwym żużlu: red / white / yellow / blue.

## Technologie

- Czysty JavaScript (ES modules)
- paper.js — wektorowy canvas
- Klasy: `Game`, `Level`, `Player`, `Vertex`, `EventEmitter`, `ResultsTable`, `TrackSelector`
- Szkielet HTML5 Boilerplate

## Status

Najbardziej rozwinięty „silnik" serii żużlowej, ale niedokończony (`Game.build()` z TODO, „beta" w logo).

## Dodatkowe informacje

Kulminacja serii projektów żużlowych: `speedway-game` (Phaser) → `svg-path-to-points` (badania torów) → `zuzel-simple` (własny silnik na paper.js).
