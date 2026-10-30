import { describe, it, expect } from 'vitest';
import Brain, { CMD } from '../js/brain.js';
import Level from '../js/level.js';
import Vertex from '../js/vertex.js';

/**
 * Stan gracza-widma: wystarczające pola do decyzji i testu na sucho
 * (środek sprite'a = position; front = 10 px przed środkiem).
 */
function state(x, y, angle, extra = {}) {
    return Object.assign({
        position: { x, y },
        angle: angle,
        speed: 2,
        anglespeed: 0,
        height: 20
    }, extra);
}

/** rng neutralny: jitter trafia dokładnie w środek Scattera (0 px). */
const N = () => 0.5;

function wall(p1, p2) {
    return new Vertex(p1, p2);
}

function levelWith(...segments) {
    const level = Object.create(Level.prototype);
    level.vertices = segments;
    return level;
}

describe('Brain.constructor — konwencja Scatter (spec decyzja #15)', () => {
    it('mapuje mode 1–4 na jitter 3/2/1/0 px (oryginał: 4 − mode % 5)', () => {
        expect(new Brain({ mode: 1 }).scatter).toBe(3);
        expect(new Brain({ mode: 2 }).scatter).toBe(2);
        expect(new Brain({ mode: 3 }).scatter).toBe(1);
        expect(new Brain({ mode: 4 }).scatter).toBe(0);
    });

    it('modes spoza 1–4 są ograniczone do przedziału [0, 3] px', () => {
        expect(new Brain({ mode: 0 }).scatter).toBe(3);
        expect(new Brain({ mode: 9 }).scatter).toBe(0);
    });
});

describe('Brain.decide — drzewo decyzyjne (§8.6)', () => {
    it('cel dokładnie przed sobą → prosto', () => {
        const brain = new Brain({ mode: 4, rng: N });
        const player = state(500, 500, 0);
        expect(brain.decide(player, [{ x: 500, y: 400 }])).toBe(CMD.STRAIGHT);
        expect(brain.waypointIdx).toBe(0);
    });

    it('cel +90° (na wschód) → prawo', () => {
        const brain = new Brain({ mode: 4, rng: N });
        const player = state(500, 500, 0);
        expect(brain.decide(player, [{ x: 600, y: 500 }])).toBe(CMD.RIGHT);
    });

    it('cel −90° (na zachód) → lewo', () => {
        const brain = new Brain({ mode: 4, rng: N });
        const player = state(500, 500, 0);
        expect(brain.decide(player, [{ x: 400, y: 500 }])).toBe(CMD.LEFT);
    });

    it('dAng +18° (lane 4, margin<kąt) → doskok w prawo (§8.6 korekta marży)', () => {
        const brain = new Brain({ mode: 4, rng: N });
        const player = state(0, 0, 0);
        const D = 100;
        const px = Math.sin(18 * Math.PI / 180) * D;
        const py = -Math.cos(18 * Math.PI / 180) * D;
        // oryginał: margin = −4·turnStep/2 < 18, lane·3 = 12 < 18 → cmd 1
        expect(brain.decide(player, [{ x: px, y: py }])).toBe(CMD.RIGHT);
    });

    it('dAng +5° (lane 4): lane·3 = 12 ≥ 5 → prosto (koniec doskoku)', () => {
        const brain = new Brain({ mode: 4, rng: N });
        const player = state(0, 0, 0);
        const D = 200;
        const px = Math.sin(5 * Math.PI / 180) * D;
        const py = -Math.cos(5 * Math.PI / 180) * D;
        expect(brain.decide(player, [{ x: px, y: py }])).toBe(CMD.STRAIGHT);
    });

    it('dAng −5° (mode 4) → przekręcił w lewo (margin < kąt ujemny nie zachodzi… margin < 355-typ → kąt −5 < margin ujemny zależnie od turnStep)', () => {
        const brain = new Brain({ mode: 1, rng: N });
        const player = state(0, 0, 0);
        const D = 200;
        const px = Math.sin(-5 * Math.PI / 180) * D;
        const py = -Math.cos(-5 * Math.PI / 180) * D;
        expect(brain.decide(player, [{ x: px, y: py }])).toBe(CMD.LEFT);
    });

    it('dAng +25° → prawo', () => {
        const brain = new Brain({ mode: 4, rng: N });
        const player = state(0, 0, 0);
        const D = 100;
        const px = Math.sin(25 * Math.PI / 180) * D;
        const py = -Math.cos(25 * Math.PI / 180) * D;
        expect(brain.decide(player, [{ x: px, y: py }])).toBe(CMD.RIGHT);
    });

    it('dAng −15° → lewo', () => {
        const brain = new Brain({ mode: 4, rng: N });
        const player = state(0, 0, 0);
        const D = 100;
        const px = Math.sin(-15 * Math.PI / 180) * D;
        const py = -Math.cos(-15 * Math.PI / 180) * D;
        expect(brain.decide(player, [{ x: px, y: py }])).toBe(CMD.LEFT);
    });

    it('zawinięcie dAng: kąt 350°, cel 10° (dAng = +20) → prosto', () => {
        const brain = new Brain({ mode: 4, rng: N });
        const player = state(500, 500, 350);
        const D = 100;
        const px = 500 + Math.sin(10 * Math.PI / 180) * D;
        const py = 500 - Math.cos(10 * Math.PI / 180) * D;
        expect(brain.decide(player, [{ x: px, y: py }])).toBe(CMD.STRAIGHT);
    });

    it('zawinięcie dAng: kąt 350°, cel 300° (dAng = −50) → lewo', () => {
        const brain = new Brain({ mode: 4, rng: N });
        const player = state(500, 500, 350);
        const D = 100;
        const px = 500 + Math.sin(300 * Math.PI / 180) * D;
        const py = 500 - Math.cos(300 * Math.PI / 180) * D;
        expect(brain.decide(player, [{ x: px, y: py }])).toBe(CMD.LEFT);
    });
});

describe('Brain — Radar (§8.4)', () => {
    it('pomija punkty bliższe niż 16 px od środka sprite\'a', () => {
        const brain = new Brain({ mode: 4, rng: N });
        const player = state(500, 500, 0);
        const cmd = brain.decide(player, [
            { x: 500, y: 490 }, // 10 px — pomijany
            { x: 600, y: 500 } // 100 px — wschód
        ]);
        expect(cmd).toBe(CMD.RIGHT);
        expect(brain.waypointIdx).toBe(1);
    });

    it('wybiera najbliższy punkt za progiem 16 px w oknie 10 do przodu (§8.4)', () => {
        const brain = new Brain({ mode: 4, rng: N });
        const player = state(0, 0, 0);
        brain.decide(player, [
            { x: 0, y: -30 }, // 30 px — najbliższy za progiem
            { x: 0, y: -60 } // 60 px — dalej, więc nie wygrywa
        ]);
        expect(brain.waypointIdx).toBe(0);
    });

    it('okno 10 punktów zawija do przodu (idx wykracza poza Trasę → 0)', () => {
        const brain = new Brain({ mode: 4, rng: N });
        brain.waypointIdx = 1; // ostatni punkt Trasy
        const player = state(0, 0, 0);
        const cmd = brain.decide(player, [
            { x: 300, y: 0 }, // idx 0 — dostępny przez zawinięcie okna
            { x: 0, y: 10 } // idx 1 — 10 px, pomijany
        ]);
        expect(cmd).toBe(CMD.RIGHT); // cel na wschód
        expect(brain.waypointIdx).toBe(0); // zawinięcie do przodu
    });

    it('nic poza 16 px w oknie → decyzja na wczorajszym celu (radarX/radarY oryginału)', () => {
        const brain = new Brain({ mode: 4, rng: N });
        const player = state(0, 0, 0);
        expect(brain.decide(player, [{ x: 300, y: 0 }])).toBe(CMD.RIGHT);

        // wszystkie punkty okna blisko gracza (< 16 px) — decyzja na starym celu
        const close = [];
        for (let i = 0; i < 11; i++) {
            close.push({ x: i, y: 8 });
        }
        expect(brain.decide(player, close)).toBe(CMD.RIGHT);
    });

    it('pusta/brak Trasy → prosto (brak celu)', () => {
        const brain = new Brain({ mode: 4, rng: N });
        expect(brain.decide(state(0, 0, 45), [])).toBe(CMD.STRAIGHT);
        expect(brain.decide(state(0, 0, 45), null)).toBe(CMD.STRAIGHT);
    });

    it('Scatter losowany co klatkę, osobno na osie X i Y — wartości całkowite (rand()%scatter − scatter/2, §8.3)', () => {
        const brainLow = new Brain({ mode: 1, rng: () => 0 }); // jitter: −1, −1
        const brainHigh = new Brain({ mode: 1, rng: () => 0.999 }); // jitter: 2 % 3 − 1 = +1
        const brainMid = new Brain({ mode: 4, rng: () => 0 }); // mode 4: scatter 0 → brak rozmycia
        const player = state(0, 0, 0);
        brainLow.decide(player, [{ x: 100, y: 0 }]);
        brainHigh.decide(player, [{ x: 100, y: 0 }]);
        brainMid.decide(player, [{ x: 100, y: 0 }]);
        expect(brainLow.target.x).toBe(99);
        expect(brainLow.target.y).toBe(-1);
        expect(brainHigh.target.x).toBe(101);
        expect(brainHigh.target.y).toBe(1);
        expect(brainMid.target.x).toBe(100);
        expect(brainMid.target.y).toBe(0);
    });

    it('Scatter mode 1 przyjmuje tylko wartości {−1, 0, +1} (integers, §8.3)', () => {
        const brain = new Brain({ mode: 1, rng: () => 0 }); // zawsze jitter −1
        const player = state(0, 0, 0);
        brain.decide(player, [{ x: 50, y: 0 }]);
        expect(Number.isInteger(brain.target.x)).toBe(true);
        expect(Number.isInteger(brain.target.y)).toBe(true);
        expect(brain.target.x).toBeLessThanOrEqual(51);
        expect(brain.target.x).toBeGreaterThanOrEqual(49);
    });
});

describe('Brain — fallback anty-kolizyjny (test na sucho §5.3)', () => {
    it('wybrana komenda wolna — decyzja bez zmian, jeden test na sucho', () => {
        const brain = new Brain({ mode: 4, rng: N });
        const player = state(500, 500, 0);
        const attempts = [];
        brain.wouldCollide = (p, cmd) => {
            attempts.push(cmd);
            return false;
        };
        const cmd = brain.decide(player, [{ x: 600, y: 500 }], {});
        expect(cmd).toBe(CMD.RIGHT);
        expect(attempts).toEqual([CMD.RIGHT]);
    });

    it('wybrana koliduje → po kolei −1, 0, +1; zatrzymuje się na pierwszej wolnej', () => {
        const brain = new Brain({ mode: 4, rng: N });
        const player = state(500, 500, 0);
        const attempts = [];
        // naturalna komenda to PRAWO (cel na wschodzie); koliduje,
        // LEWO również koliduje, PROSTO wolne — fallback się na nim zatrzymuje
        brain.wouldCollide = (p, cmd) => {
            attempts.push(cmd);
            return cmd === CMD.RIGHT || cmd === CMD.LEFT;
        };
        const cmd = brain.decide(player, [{ x: 600, y: 500 }], {});
        expect(cmd).toBe(CMD.STRAIGHT);
        expect(attempts).toEqual([CMD.RIGHT, CMD.LEFT, CMD.STRAIGHT]);
    });

    it('wszystkie trzy kolidują → pierwotna decyzja (pełna kolejność prób)', () => {
        const brain = new Brain({ mode: 4, rng: N });
        const player = state(500, 500, 0);
        const attempts = [];
        brain.wouldCollide = (p, cmd) => {
            attempts.push(cmd);
            return true;
        };
        const cmd = brain.decide(player, [{ x: 600, y: 500 }], {});
        expect(cmd).toBe(CMD.RIGHT);
        expect(attempts).toEqual([CMD.RIGHT, CMD.LEFT, CMD.STRAIGHT, CMD.RIGHT]);
    });

    it('brak world — logika czysta, bez testu na sucho', () => {
        const brain = new Brain({ mode: 4, rng: N });
        let calls = 0;
        brain.wouldCollide = () => {
            calls += 1;
            return true;
        };
        const cmd = brain.decide(state(0, 0, 0), [{ x: 600, y: 500 }]);
        expect(cmd).toBe(CMD.RIGHT);
        expect(calls).toBe(0);
    });

    it('integracja: Level.collide na symulowanych wektorach — ściana przed sobą wymusza skręt w prawo', () => {
        // ściana pozioma y = −14, rozpięta tak szeroko, że wszystkie
        // trzy komendy kolidują (krok symulacji ≈5,9 px do przodu,
        // odchylenie boczne ±0,13 px w jednej klatce) — pierwotna decyzja zostaje
        const level = levelWith(wall({ x: -100, y: -14 }, { x: 100, y: -14 }));
        const brain = new Brain({ mode: 4, rng: N });
        const player = state(0, 0, 0, { speed: 10 });
        const attempts = [];
        const base = brain.wouldCollide.bind(brain);
        brain.wouldCollide = (p, cmd, world) => {
            attempts.push(cmd);
            return base(p, cmd, world);
        };
        const cmd = brain.decide(
            player,
            [{ x: 0, y: -100 }, { x: 0, y: -120 }],
            { level, players: [] }
        );
        expect(cmd).toBe(CMD.STRAIGHT);
        // próby na sucho: naturalna prosto, potem fallback −1, 0, +1
        expect(attempts).toEqual([CMD.STRAIGHT, CMD.LEFT, CMD.STRAIGHT, CMD.RIGHT]);
    });

    it('integracja: ściana po lewej przed sobą → fallback wybiera skręt w prawo', () => {
        // gracz w (0,0) kątem 0 (północ); suchy krok Mózgu jest wąski
        // (≈5,9 px do przodu, odchylenie x zaledwie ±0,13 px), więc
        // różnicowanie komend wymaga ściany ukośnej: od (−1,−14) do
        // (0.02,−11) — prosto i lewo przecinają ją, prawo (front w
        // x ≈ +0,13) omija jej prawy koniec
        const level = levelWith(wall({ x: -1, y: -14 }, { x: 0.02, y: -11 }));
        const brain = new Brain({ mode: 4, rng: N });
        const player = state(0, 0, 0, { speed: 10 });
        const cmd = brain.decide(
            player,
            [{ x: 0, y: -100 }, { x: 0, y: -120 }],
            { level, players: [] }
        );
        expect(cmd).toBe(CMD.RIGHT);
    });

    it('integracja: pełna szerokość ściany przed sobą → pierwotna decyzja zostaje', () => {
        const level = levelWith(wall({ x: -100, y: -12 }, { x: 100, y: -12 }));
        const brain = new Brain({ mode: 4, rng: N });
        const player = state(0, 0, 0, { speed: 10 });
        const cmd = brain.decide(player, [{ x: 0, y: -100 }], { level });
        expect(cmd).toBe(CMD.STRAIGHT);
    });
});
