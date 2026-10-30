import { describe, it, expect } from 'vitest';
import Brain from '../js/brain.js';
import Route from '../js/route.js';
import Level from '../js/level.js';
import Vertex from '../js/vertex.js';
import Player from '../js/player.js';

/**
 * Test behawioralny Mózgu: pojedynczy Komputer ma być w stanie okrążyć
 * podkowy tor owalny (wygenerowany Level + Route.forTrack)without
 * zbłądzenia — user test: „ Komputer kręci się w miejsce, bączki; ma
 * jechać do przodu jak najszybciej; bez skalę każdego punkt坚持下去".
 *
 * Motorsymulacja krok po kroku analogiczna do Player.move (sterowanie,
 * speed, angle, pozycja) + prosty wall-clip (revert + połowa speed),
 * z pominięciem kolizji motocykl–motocykl (jeździmy sami). Assert
 * sprawdza to, na czym zamerza user: full lap w rozsądnym czasie
 * oraz brak jazdy szalęw (stała bliskość punktów Trasy, brak zderzeń).
 */

/** Owalny tor: dwie elipsy (wewnętrzna, zewnętrzna) próbkowane co 1°. */
function ovalWalls(cx, cy, aIn, bIn, aOut, bOut) {
    const segs = [];
    for (let d = 0; d < 360; d += 1) {
        const a = d * Math.PI / 180;
        const w1 = {
            x: cx + Math.cos(a) * aIn,
            y: cy + Math.sin(a) * bIn
        };
        const w2 = {
            x: cx + Math.cos(a + Math.PI / 180) * aIn,
            y: cy + Math.sin(a + Math.PI / 180) * bIn
        };
        segs.push(new Vertex(w1, w2));

        const o1 = { x: cx + Math.cos(a) * aOut, y: cy + Math.sin(a) * bOut };
        const o2 = {
            x: cx + Math.cos(a + Math.PI / 180) * aOut,
            y: cy + Math.sin(a + Math.PI / 180) * bOut
        };
        segs.push(new Vertex(o1, o2));
    }
    return segs;
}

function ovalLevel() {
    const level = Object.create(Level.prototype);
    level.vertices = ovalWalls(500, 400, 140, 90, 240, 190);
    return level;
}

/** Stub gracza na symulację move/tick (fizyka jak Player, papier pomijalny). */
function bike(x, y, angle) {
    return {
        position: { x, y },
        angle: angle,
        speed: Player.PHYSICS_TYPE.SLOW.maxSpeed,
        anglespeed: 0,
        height: 20,
        width: 7,
        physics: Player.PHYSICS_TYPE.SLOW,
        inCollision: false,
        frontVertex: { x: 0, y: -10 },
        moveVector: []
    };
}

/** Jeden krok symulowany (analogia Player.move; dt = 1000/60). */
function step(bikepos, cmd, level, dt = 1000 / 60) {
    const p = bikepos.physics;
    let anglespeed = bikepos.anglespeed || 0;
    if (cmd === 0) {
        const sign = Math.sign(anglespeed);
        anglespeed -= sign * p.anglespeedAccel * (dt / 30);
        if (sign !== Math.sign(anglespeed)) {
            anglespeed = 0;
        }
    } else {
        anglespeed += cmd * p.anglespeedAccel * (dt / 30);
    }
    anglespeed = Math.min(anglespeed, p.anglespeedMinMax);
    anglespeed = Math.max(anglespeed, -p.anglespeedMinMax);

    let speed = bikepos.speed || 0;
    speed += p.acceleration * dt / 16 - (Math.abs(anglespeed) / p.anglespeedBrake * dt / 16);
    speed = Math.min(speed, p.maxSpeed);
    speed = Math.max(speed, p.minSpeed);

    const angle = bikepos.angle + anglespeed * (dt / 30);
    const dx = Math.sin(angle * Math.PI / 180);
    const dy = -Math.cos(angle * Math.PI / 180);

    const next = {
        x: bikepos.position.x + dx * speed * (dt / 30),
        y: bikepos.position.y + dy * speed * (dt / 30)
    };

    // prosty wall-clip: kolizja FRONTU → cofamy, przepoławiamy speed
    const front = {
        x: next.x + dx * -bikepos.frontVertex.y,
        y: next.y + dy * -bikepos.frontVertex.y
    };
    const wall = level.vertices.some(v => v.collide(new Vertex(
        { x: bikepos.position.x + dx * -bikepos.frontVertex.y, y: bikepos.position.y + dy * -bikepos.frontVertex.y },
        front
    )));

    bikepos.anglespeed = anglespeed;
    bikepos.speed = wall ? speed / 2 : speed;
    bikepos.angle = ((angle % 360) + 360) % 360;
    if (!wall) {
        bikepos.position = next;
    }
    bikepos.inCollision = wall;
    return wall;
}

describe("Brain — jazda do przodu po Trasie (user feedback: bez kręcenia bączków)", () => {
    it('Komputer okrąża owalny tor bez utykania (pełna pętla Trasy ≤ 12 s)', () => {
        const level = ovalLevel();
        const route = Route.forTrack(level, () => 0.5); // zero offsetu — śr. linia
        const brain = new Brain({ mode: 2, rng: () => 0.5 });
        brain.waypointIdx = Route.startIndexFor(route, { x: 500, y: 400 - 140 });

        const rider = bike(500, 400 - 140, 90); // start na środku prostej belki, skierowany „wschód"

        const perimeter = routePerimeter(route);
        let idx = Route.startIndexFor(route, rider.position);
        let progress = 0;
        const dt = 1000 / 60;
        const maxTicks = Math.ceil(12000 / dt);
        let ticks = 0;
        let collisions = 0;
        let maxRouteDist = 0;

        while (progress < perimeter && ticks < maxTicks) {
            const cmd = brain.decide(rider, route, { level, players: [] });
            if (step(rider, cmd, level, dt)) {
                collisions += 1;
            }
            const nowIdx = Route.startIndexFor(route, rider.position);
            let d = nowIdx - idx;
            if (d > route.length / 2) {
                d -= route.length;
            }
            if (d < -route.length / 2) {
                d += route.length;
            }
            progress += d * (perimeter / route.length);
            idx = nowIdx;
            maxRouteDist = Math.max(maxRouteDist, nearestRouteDist(rider.position, route));
            ticks += 1;
        }

        // 1) okrążył tor (pełna pętla w rozsądnym czasie)…
        expect(progress).toBeGreaterThanOrEqual(perimeter);
        // 2) …jazda stabilize: nigdy nie oddalił się od Trasy na więcej
        //    niż szerokość korytarza (50 px do bandy + zapas)
        expect(maxRouteDist).toBeLessThan(38);
        // 3) driveuforia: nie tkwi w ścianie — kolizji (walls clip)
        //    może być kilka (ślizg), ale nie setki utknięcia
        expect(collisions).toBeLessThan(maxTicks * 0.05);
    });
});

function routePerimeter(route) {
    let sum = 0;
    for (let i = 0; i < route.length; i++) {
        const a = route[i];
        const b = route[(i + 1) % route.length];
        sum += Math.hypot(b.x - a.x, b.y - a.y);
    }
    return sum;
}

function nearestRouteDist(pos, route) {
    let best = Infinity;
    route.forEach(p => {
        best = Math.min(best, Math.hypot(p.x - pos.x, p.y - pos.y));
    });
    return best;
}
