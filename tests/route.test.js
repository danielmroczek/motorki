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

    it('losuje wspólny boczny offset z rng — raz na bieg', () => {
        // rng = 0.5 zawsze → offset zerowy; rng avaryjny → przesunięcie
        const rnd = () => 0.5;
        const neutral = Route.forTrack(level, rnd);
        const other = Route.forTrack(level, () => 0.9);
        expect(routesDiffer(neutral, other)).toBe(true);

        // determinizm: ten sam rng → ta sama trasa
        expect(Route.forTrack(level, () => 0.9)).toEqual(other);

        // dwa różne losowania dają różne trasy (kryterium: ponowne
        // uruchomienie biegu daje inny offset)
        const seq = [0.9, 0.1];
        let i = 0;
        const a = Route.forTrack(level, () => seq[i++]);
        i = 0;
        const seq2 = [0.1, 0.9];
        const b = Route.forTrack(level, () => seq2[i++]);
        expect(routesDiffer(a, b)).toBe(true);
    });

    it('wskazuje startIndex — punkt Trasy najbliższy pozycji startowej', () => {
        // rng = 0.5 → offset zerowy: pozycje punktów są deterministyczne,
        // inaczej losowy boczny offset robi z tego test flaky
        const points = Route.forTrack(level, () => 0.5);
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