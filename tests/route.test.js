import { describe, it, expect } from 'vitest';
import Level from '../js/level.js';
import Route from '../js/route.js';
import Vertex from '../js/vertex.js';

// zamknięty tor (pierścień): banda zewnętrzna 100..200 × 200..300
// + banda wewnętrzna 130..170 × 230..270 (jak prawdziwe tor SVG)
const SEGMENTS = [
    // zewnętrzna
    [{ x: 100, y: 200 }, { x: 100, y: 300 }],
    [{ x: 200, y: 200 }, { x: 200, y: 300 }],
    [{ x: 100, y: 200 }, { x: 200, y: 200 }],
    [{ x: 100, y: 300 }, { x: 200, y: 300 }],
    // wewnętrzna
    [{ x: 130, y: 230 }, { x: 130, y: 270 }],
    [{ x: 170, y: 230 }, { x: 170, y: 270 }],
    [{ x: 130, y: 230 }, { x: 170, y: 230 }],
    [{ x: 130, y: 270 }, { x: 170, y: 270 }],
];

function levelWith(walls) {
    const vertices = walls.map(([p1, p2]) => new Vertex(p1, p2));
    const level = Object.create(Level.prototype);
    level.vertices = vertices;
    return level;
}

const level = levelWith(SEGMENTS);

/** Czy trasy a i b różnią się choć w jednym punkcie o więcej niż tol px. */
function routesDiffer(a, b) {
    if (a.length !== b.length) {
        return true;
    }
    return a.some((p, i) => {
        return Math.hypot(p.x - b[i].x, p.y - b[i].y) > 2;
    });
}

/** Obwód zamkniętej pętli punktów (px). */
function perimeterOf(points) {
    let perimeter = 0;
    for (let i = 0; i < points.length; i++) {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        perimeter += Math.hypot(b.x - a.x, b.y - a.y);
    }
    return perimeter;
}

/** Znak pola powierzchni pętli — orientacja (zgodnie/przeciwnie do zegara). */
function signedArea(points) {
    let area = 0;
    for (let i = 0; i < points.length; i++) {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        area += a.x * b.y - b.x * a.y;
    }
    return area / 2;
}

/** Ile razy pętla skręca „w drugą stronę” — dowód, że jest wklęsła. */
function concaveTurns(points) {
    let turns = 0;
    for (let i = 0; i < points.length; i++) {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        const c = points[(i + 2) % points.length];
        const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
        if (cross < 0) {
            turns += 1;
        }
    }
    return turns;
}

/**
 * Tor „nerka”: pas wokół krzywej r(θ) = R·(1 + a·cos 2θ) — przy dużym `a`
 * pętla Trasy jest **wklęsła** w talii (znak skrętu się zmienia), więc test
 * sprawdza wykrywanie wnętrza także poza przypadkiem wypukłym.
 */
function peanutLevel(R = 120, a = 0.35, gap = 30, samples = 72) {
    const ring = (dr) => Array.from({ length: samples }, (_, i) => {
        const theta = 2 * Math.PI * i / samples;
        const radius = R * (1 + a * Math.cos(2 * theta)) + dr;
        return { x: 200 + radius * Math.cos(theta), y: 200 + radius * Math.sin(theta) };
    });
    const walls = [];
    [gap / 2, -gap / 2].forEach(dr => {
        const points = ring(dr);
        points.forEach((p, i) => walls.push([p, points[(i + 1) % points.length]]));
    });
    return levelWith(walls);
}

describe('Route.forTrack — łuk środkowy', () => {
    it('zwraca punkty leżące pomiędzy ścianami', () => {
        const points = Route.forTrack(level);
        expect(points.length).toBeGreaterThan(0);
        points.forEach(p => {
            expect(p.x).toBeGreaterThanOrEqual(100);
            expect(p.x).toBeLessThanOrEqual(200);
        });
    });

    it('zwraca pętlę obejmującą tor (całkowity obrót >= 2π)', () => {
        const points = Route.forTrack(level);
        expect(angleSpan(points)).toBeGreaterThanOrEqual(2 * Math.PI - 0.1);
    });
    it('zwraca punkty o gęstości ~ROUTE_STEP px (nadaje się pod Radar)', () => {
        const points = Route.forTrack(level);
        let minStep = Infinity;
        let maxStep = 0;
        for (let i = 0; i < points.length; i++) {
            const p1 = points[i];
            const p2 = points[(i + 1) % points.length];
            const d = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            minStep = Math.min(minStep, d);
            maxStep = Math.max(maxStep, d);
        }
        // wymagany niezmiennik (fizyka.md §8.4): Radar czuje kolejne punkty
        // co ~16+ px — czyli żaden krok nie spada poniżej RADAR_MIN_DIST,
        // a punkty na czubkach nie wiszą bezczynnie (krok ≤ 2·step − 16)
        const RADAR_MIN_DIST = 16;
        expect(minStep).toBeGreaterThanOrEqual(RADAR_MIN_DIST);
        expect(maxStep).toBeLessThanOrEqual(2 * Route.ROUTE_STEP - RADAR_MIN_DIST);
        // i kroki nie rozjeżdżają się zbyt mocno względem kroku nominalnego
        expect(minStep).toBeGreaterThanOrEqual(Route.ROUTE_STEP * 0.7);
        expect(maxStep).toBeLessThanOrEqual(Route.ROUTE_STEP * 1.3);
    });

    it('forTrack losuje linię z rng — raz na bieg, po stronie wewnętrznej', () => {
        const base = Route.baseLoop(level);
        // rng = 0.5 → mediana rozkładu liniowego, czyli linia po wewnętrznej
        const inner = Route.forTrack(level, () => 0.5);
        expect(routesDiffer(base, inner)).toBe(true);

        // determinizm: ten sam rng → ta sama trasa
        expect(Route.forTrack(level, () => 0.5)).toEqual(inner);

        // u → 1 to skraj zewnętrzny pasa (przycięty do MAX_OFFSET_OUT)
        const outer = Route.forTrack(level, () => 1 - 1e-9);
        expect(routesDiffer(inner, outer)).toBe(true);
    });

    it('forField — linie leżą po wewnętrznej i skracają obwód', () => {
        const base = Route.baseLoop(level);
        const basePerimeter = perimeterOf(base);
        const routes = Route.forField(level, 4, () => 0.5);
        expect(routes).toHaveLength(4);

        // żadna linia nie wychodzi na zewnątrz bazy — każda skraca okrążenie
        routes.forEach(route => {
            expect(perimeterOf(route)).toBeLessThan(basePerimeter);
            route.forEach(p => {
                expect(p.x).toBeGreaterThan(100);
                expect(p.x).toBeLessThan(200);
                expect(p.y).toBeGreaterThan(200);
                expect(p.y).toBeLessThan(300);
            });
        });

        // linie są rozdzielone (nie „bliźniaki”) — coraz dalej od bandy zewnętrznej
        const xs = routes
            .map(route => route[Route.startIndexFor(route, { x: 185, y: 250 })].x)
            .sort((a, b) => a - b);
        for (let i = 1; i < xs.length; i++) {
            expect(xs[i] - xs[i - 1]).toBeGreaterThan(1);
        }
    });

    it('forTrack — skraj zewnętrzny pasa ograniczony do MAX_OFFSET_OUT', () => {
        const base = Route.baseLoop(level);
        const outer = Route.forTrack(level, () => 1 - 1e-9);
        expect(perimeterOf(outer)).toBeGreaterThan(perimeterOf(base));

        // prawa prosta bazy: x = 185, szczelina 30 px (room = 15 px) →
        // przesunięcie na zewnątrz = 0.2 · 15 = 3 px
        const p = outer[Route.startIndexFor(outer, { x: 185, y: 250 })];
        expect(p.x).toBeGreaterThan(187.4);
        expect(p.x).toBeLessThan(188.6);
    });

    it('forField — odwrócona orientacja pętli (startPoints) nadal trzyma linie po wewnętrznej', () => {
        const flipped = levelWith(SEGMENTS);
        // kąt startowy 90° wymusza jazdę „pod prąd” pętli z radialLoop,
        // więc orientLoopToStart odwraca kolejność punktów (normalna też
        // zmienia znak — wnętrze musi być wykryte geometrycznie)
        flipped.startPoints = [{ x: 185, y: 250, angle: 90 }];
        const plain = Route.baseLoop(level);
        const reversed = Route.baseLoop(flipped);
        expect(Math.sign(signedArea(reversed))).toBe(-Math.sign(signedArea(plain)));

        const basePerimeter = perimeterOf(reversed);
        const routes = Route.forField(flipped, 3, () => 0.5);
        expect(routes).toHaveLength(3);
        routes.forEach(route => {
            expect(perimeterOf(route)).toBeLessThan(basePerimeter);
            route.forEach(p => {
                expect(p.x).toBeGreaterThan(100);
                expect(p.x).toBeLessThan(200);
                expect(p.y).toBeGreaterThan(200);
                expect(p.y).toBeLessThan(300);
            });
        });
    });

    it('forField — tor wklęsły (nerka): linie nadal po wewnętrznej', () => {
        const concave = peanutLevel();
        const base = Route.baseLoop(concave);
        // sanity: pętla bazy naprawdę jest wklęsła (skręt zmienia znak)
        expect(concaveTurns(base)).toBeGreaterThan(0);

        const basePerimeter = perimeterOf(base);
        const routes = Route.forField(concave, 3, () => 0.5);
        expect(routes).toHaveLength(3);
        routes.forEach(route => {
            expect(perimeterOf(route)).toBeLessThan(basePerimeter);
        });
    });

    it('forField — zero komputerów nie liczy geometrii i zwraca brak tras', () => {
        let calls = 0;
        const rng = () => { calls++; return 0.5; };
        const noWalls = Object.create(Level.prototype);
        noWalls.vertices = [];
        expect(Route.forField(noWalls, 0, rng)).toEqual([]);
        expect(calls).toBe(0);
    });

    it('forField — determinizm: ten sam rng daje te same trasy', () => {
        const seq = [0.1, 0.7, 0.3, 0.9, 0.2, 0.4, 0.8, 0.6];
        const run = () => {
            let i = 0;
            return Route.forField(level, 3, () => seq[i++]);
        };
        expect(run()).toEqual(run());
    });

    it('wskazuje startIndex — punkt Trasy najbliższy pozycji startowej', () => {
        // baza bez offsetu → pozycje punktów są deterministyczne (inaczej
        // losowana linia robi z tego test flaky)
        const points = Route.baseLoop(level);
        // start (185, 250) to dokładnie pierwszy punkt pętli (kąt 0)
        const idx = Route.startIndexFor(points, { x: 185, y: 250 });
        expect(points[idx]).toEqual(points[0]);

        // pozycja przy innej części pętli → najbliższy punkt, nie zawsze 0
        const idxFar = Route.startIndexFor(points, { x: 115, y: 250 });
        expect(points[idxFar].x).toBeLessThan(120);
        expect(idxFar).not.toBe(0);
    });

    it('tor eliptyczny (zróżnicowana szczelina) — nadal zamknięty łuk w torze', () => {
        // elipsa: zewnętrzna rx=140, ry=90; wewnętrzna rx=100, ry=55,
        // po 36 odcinkach każdy (tor bez prostych / ostrych narożników)
        const ellipseWalls = (rx, ry) => {
            const segs = [];
            const N = 36;
            for (let i = 0; i < N; i++) {
                const a1 = 2 * Math.PI * i / N;
                const a2 = 2 * Math.PI * (i + 1) / N;
                segs.push([
                    { x: 150 + rx * Math.cos(a1), y: 150 + ry * Math.sin(a1) },
                    { x: 150 + rx * Math.cos(a2), y: 150 + ry * Math.sin(a2) }
                ]);
            }
            return segs;
        };
        const walls = [...ellipseWalls(140, 90), ...ellipseWalls(100, 55)];
        const ellipseLevel = levelWith(walls);

        const points = Route.forTrack(ellipseLevel);
        expect(points.length).toBeGreaterThan(8);
        // zamknięta pętla obejmująca tor
        expect(angleSpan(points)).toBeGreaterThanOrEqual(2 * Math.PI - 0.2);
        // punkty zawarte w obrysie toru (między ścianami zewnętrznymi)
        points.forEach(p => {
            expect(p.x).toBeGreaterThan(0);
            expect(p.x).toBeLessThan(300);
        });

        // gęstość nie rozpada się na elipsie
        let minStep = Infinity;
        for (let i = 0; i < points.length; i++) {
            const q = points[(i + 1) % points.length];
            minStep = Math.min(minStep, Math.hypot(q.x - points[i].x, q.y - points[i].y));
        }
        expect(minStep).toBeGreaterThanOrEqual(16);
    });

});

function angleSpan(points) {
    // sumaryczny obrót (total turning angle) kolejnych odcinków pętli —
    // prosta zamknięta pętla obraca się dokładnie raz: 2π
    let span = 0;
    let prev = points[points.length - 1];
    points.forEach(p => {
        const a = Math.atan2(p.y - prev.y, p.x - prev.x);
        if (span === 0) {
            span = a;
        } else {
            let d = a - span;
            while (d > Math.PI) d -= 2 * Math.PI;
            while (d < -Math.PI) d += 2 * Math.PI;
            span += d;
        }
        prev = p;
    });
    return Math.abs(span);
}