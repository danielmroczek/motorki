import { describe, it, expect } from 'vitest';
import Brain, {
    CMD,
    LOOKAHEAD_POINTS,
    NEAREST_WINDOW_BACK,
    NEAREST_WINDOW_FWD,
    LOST_DISTANCE,
    DEAD_BAND_DEG
} from '../js/brain.js';
import Level from '../js/level.js';
import Vertex from '../js/vertex.js';

/**
 * Stan gracza-widma: wystarczające pola do decyzji i testu na sucho
 * (środek sprite'a = position; przód = 10 px przed środkiem).
 */
function state(x, y, angle, extra = {}) {
    return Object.assign({
        position: { x, y },
        angle: angle,
        speed: 2,
        anglespeed: 0,
        height: 20,
        frontVertex: { x: 0, y: -10 }
    }, extra);
}

function wall(p1, p2) {
    return new Vertex(p1, p2);
}

function levelWith(...segments) {
    const level = Object.create(Level.prototype);
    level.vertices = segments;
    return level;
}

describe('Brain.constructor — parametry', () => {
    it('ustawia mode/dt i zeruje waypoint/target', () => {
        const brain = new Brain({ mode: 2, dt: 15 });
        expect(brain.mode).toBe(2);
        expect(brain.dt).toBe(15);
        expect(brain.waypointIdx).toBe(0);
        expect(brain.target).toBeNull();
    });

    it('lookahead rośnie z trybem (osobowość: agresja cięcia łuków)', () => {
        expect(new Brain({ mode: 1 }).lookaheadPoints()).toBe(3);
        expect(new Brain({ mode: 2 }).lookaheadPoints()).toBe(4);
        expect(new Brain({ mode: 3 }).lookaheadPoints()).toBe(5);
        expect(new Brain({ mode: 4 }).lookaheadPoints()).toBe(6);
        // poza przedziałem — clamp do [3, 6]
        expect(new Brain({ mode: 0 }).lookaheadPoints()).toBe(3);
        expect(new Brain({ mode: 9 }).lookaheadPoints()).toBe(6);
    });
});

describe('Brain.decide — sterowanie wg błędu kątowego (dead-band)', () => {
    it('cel dokładnie przed sobą → prosto (dead-band)', () => {
        const brain = new Brain({ mode: 1 });
        const player = state(500, 500, 0);
        expect(brain.decide(player, [{ x: 500, y: 400 }, { x: 500, y: 420 }]))
            .toBe(CMD.STRAIGHT);
    });

    it('cel +90° (na wschód) → prawo', () => {
        const brain = new Brain({ mode: 1 });
        const player = state(500, 500, 0);
        // najbliższy punkt = idx 0; cel = idx 0 + look(3) → na wschodzie
        expect(brain.decide(player, [
            { x: 500, y: 500 }, { x: 500, y: 495 },
            { x: 600, y: 500 }, { x: 600, y: 500 }
        ])).toBe(CMD.RIGHT);
    });

    it('cel −90° (na zachód) → lewo', () => {
        const brain = new Brain({ mode: 1 });
        const player = state(500, 500, 0);
        expect(brain.decide(player, [
            { x: 500, y: 500 }, { x: 500, y: 495 },
            { x: 400, y: 500 }, { x: 400, y: 500 }
        ])).toBe(CMD.LEFT);
    });

    it('zawinięcie: kąt 350°, cel na wschód (10°) → prawo', () => {
        const brain = new Brain({ mode: 1 });
        const player = state(500, 500, 350);
        const R = 40;
        const at = (a) => ({
            x: 500 + Math.sin(a * Math.PI / 180) * R,
            y: 500 - Math.cos(a * Math.PI / 180) * R
        });
        // najbliższy ~północ, cel = look(3) dalej ku wschodowi
        const pts = [at(0), at(3), at(10), at(10)];
        expect(brain.decide(player, pts)).toBe(CMD.RIGHT);
    });

    it('zawinięcie: kąt 350°, cel 300° (−50°) → lewo', () => {
        const brain = new Brain({ mode: 1 });
        const player = state(500, 500, 350);
        // najbliższy wyraźnie najbliżej (17 px na północy); cel = idx+3
        const near = { x: 500, y: 483 }; // d = 17
        const far = (a) => ({
            x: 500 + Math.sin(a * Math.PI / 180) * 120,
            y: 500 - Math.cos(a * Math.PI / 180) * 120
        });
        const pts = [near, far(355), far(300), far(300)];
        expect(brain.decide(player, pts)).toBe(CMD.LEFT);
    });
});

describe('Brain — najbliższy punkt Trasy (okno + pełny skan)', () => {
    it('okno wokół waypointa: wybiera najbliższy punkt (przód i tył okna)', () => {
        const brain = new Brain({ mode: 1 });
        brain.waypointIdx = 10;
        const player = state(100, 100, 0);
        const route = [];
        for (let i = 0; i < 40; i += 1) {
            route.push({ x: -1000 + i, y: -1000 }); // daleko — poza oknem
        }
        route[8] = { x: 120, y: 100 }; // 20 px przed waypointem (w oknie)
        route[10] = { x: 100, y: 100 }; // dokładnie pod graczem
        brain.decide(player, route);
        expect(brain.waypointIdx).toBe(10);
    });

    it('gubi się (wszystko w oknie dalej niż próg) → pełny skan pętli', () => {
        const brain = new Brain({ mode: 1 });
        brain.waypointIdx = 0;
        const player = state(500, 500, 0);
        const route = [];
        // pseudo-trasa: punkty zbite daleko od gracza z wyjątkiem idx 20
        for (let i = 0; i < 60; i += 1) {
            route.push({ x: 0, y: 0 });
        }
        route[20] = { x: 520, y: 500 };
        brain.decide(player, route);
        expect(brain.waypointIdx).toBe(20);
    });

    it('cel wybiega w przód o lookahead punktów od najbliższego', () => {
        const brain = new Brain({ mode: 1 });
        const player = state(0, 0, 0);
        const route = [];
        for (let i = 0; i < 12; i += 1) {
            route.push({ x: 1000, y: 1000 }); // daleko (pełny skan)
        }
        // najbliższy = idx 1 (0 px), cel = idx 1 + 3 = 4
        route[1] = { x: 0, y: 0 };
        route[4] = { x: 100, y: 0 };
        const res = brain.decide(player, route);
        expect(brain.target).toBe(route[4]);
        expect(res).toBe(CMD.RIGHT); // cel na wschód
    });
});

describe('Brain — pusta Trasa i stałe modułu', () => {
    it('pusta/brak Trasy → prosto (brak celu)', () => {
        const brain = new Brain({ mode: 1 });
        expect(brain.decide(state(0, 0, 45), [])).toBe(CMD.STRAIGHT);
        expect(brain.decide(state(0, 0, 45), null)).toBe(CMD.STRAIGHT);
        expect(brain.target).toBeNull();
    });

    it('stałe modułu mają oczekiwane wartości', () => {
        expect(LOOKAHEAD_POINTS).toBe(3);
        expect(NEAREST_WINDOW_BACK).toBe(6);
        expect(NEAREST_WINDOW_FWD).toBe(22);
        expect(LOST_DISTANCE).toBe(45);
        expect(DEAD_BAND_DEG).toBe(8);
    });
});

describe('Brain — fallback anty-kolizyjny (test na sucho §5.3)', () => {
    it('wybrana komenda wolna — decyzja bez zmian, jeden test na sucho', () => {
        const brain = new Brain({ mode: 1 });
        const player = state(500, 500, 0);
        const attempts = [];
        brain.wouldCollide = (p, cmd) => {
            attempts.push(cmd);
            return false;
        };
        const cmd = brain.decide(player, [
            { x: 500, y: 500 }, { x: 500, y: 495 },
            { x: 600, y: 500 }, { x: 600, y: 500 }
        ], {});
        expect(cmd).toBe(CMD.RIGHT);
        expect(attempts).toEqual([CMD.RIGHT]);
    });

    it('naturalna i obie próby kolidują → pierwotna decyzja zostaje', () => {
        const brain = new Brain({ mode: 1 });
        const player = state(500, 500, 0);
        const attempts = [];
        // naturalna (PRAWO, cel na wschodzie) i obie próby kolidują —
        // pierwotna decyzja zostaje
        brain.wouldCollide = (p, cmd) => {
            attempts.push(cmd);
            return true;
        };
        const cmd = brain.decide(player, [
            { x: 500, y: 500 }, { x: 500, y: 495 },
            { x: 600, y: 500 }, { x: 600, y: 500 }
        ], {});
        expect(cmd).toBe(CMD.RIGHT);
        expect(attempts).toEqual([CMD.RIGHT, CMD.STRAIGHT, CMD.LEFT]);
    });

    it('naturalna koliduje, PROSTO wolne → PROSTO (utrzymanie prędkości)', () => {
        const brain = new Brain({ mode: 1 });
        const player = state(500, 500, 0);
        brain.wouldCollide = (p, cmd) => cmd === CMD.RIGHT;
        const cmd = brain.decide(player, [
            { x: 500, y: 500 }, { x: 500, y: 495 },
            { x: 600, y: 500 }, { x: 600, y: 500 }
        ], {});
        expect(cmd).toBe(CMD.STRAIGHT);
    });

    it('brak world — logika czysta, bez testu na sucho', () => {
        const brain = new Brain({ mode: 1 });
        let calls = 0;
        brain.wouldCollide = () => {
            calls += 1;
            return true;
        };
        const cmd = brain.decide(state(0, 0, 0), [
            { x: 0, y: 0 }, { x: 0, y: -5 },
            { x: 100, y: 0 }, { x: 100, y: 0 }
        ]);
        expect(cmd).toBe(CMD.RIGHT);
        expect(calls).toBe(0);
    });

    it('integracja: Level.collide na symulowanych wektorach — ściana przed sobą, prosto wolne', () => {
        // ściana pozioma tak szeroka, że wszystkie komendy kolidują w wąskim
        // kroku symulacji — naturalna (prosto, cel też na północy) zostaje
        const level = levelWith(wall({ x: -100, y: -14 }, { x: 100, y: -14 }));
        const brain = new Brain({ mode: 1 });
        const player = state(0, 0, 0, { speed: 10 });
        const attempts = [];
        const base = brain.wouldCollide.bind(brain);
        brain.wouldCollide = (p, cmd, world) => {
            attempts.push(cmd);
            return base(p, cmd, world);
        };
        const cmd = brain.decide(
            player,
            [{ x: 0, y: 0 }, { x: 0, y: -5 }, { x: 0, y: -100 }, { x: 0, y: -120 }],
            { level, players: [] }
        );
        expect(cmd).toBe(CMD.STRAIGHT);
        // naturalna PROSTO koliduje → próby PROSTO/LEWO/PRAWO wszystkie
        // kolidują (szeroka ściana) — wróciła decyzja naturalna
        expect(attempts).toEqual([CMD.STRAIGHT, CMD.LEFT, CMD.RIGHT]);
    });

    it('integracja: ściana ukośna po prawej przed sobą → nie skręca w prawo', () => {
        // gracz w (0,0) kątem 0 (północ); suchy krok Mózgu jest wąski
        // (≈5,9 px do przodu, odchylenie boczne ±0,13 px), więc
        // różnicowanie komend wymaga ściany ukośnej
        const level = levelWith(wall({ x: 1, y: -14 }, { x: -0.02, y: -11 }));
        const brain = new Brain({ mode: 1 });
        const player = state(0, 0, 0, { speed: 10 });
        const cmd = brain.decide(
            player,
            [{ x: 0, y: 0 }, { x: 0, y: -5 }, { x: 0, y: -100 }, { x: 0, y: -120 }],
            { level, players: [] }
        );
        expect(cmd).not.toBe(CMD.RIGHT);
    });
});
