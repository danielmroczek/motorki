import { describe, it, expect, beforeAll } from 'vitest';
import { verticalWallAt } from './fixtures.js';
import Player from '../js/player.js';

// Node nie ma paper.js — konstruktor Playera tworzy tylko obiekty rysujące.
beforeAll(() => {
    globalThis.Path = class { add() {} };
    globalThis.Color = class {};
    globalThis.Point = class {};
    globalThis.Group = class { addChild() {} };
    globalThis.Path.Line = class {};
});

const TICK = 1000 / 60;

/** Gracz jadący w kierunku angleDeg, trzymane lewo/prawo opcjonalnie. */
function rider(x, y, angleDeg) {
    let player = new Player('red', { skidmarks: { addChild() {} } });
    player.angle = angleDeg;
    player.position = { x, y };
    player.controls.left = 1; // scenariusz zgłoszony: jazda wzdłuż krawędzi z trzymaonym skrętem
    player.start();
    return player;
}

/** Tick = Game.tick عليه sequence: move → level collide → reaction. */
function tick(player, walls) {
    player.move(TICK);
    let hit = null;
    for (let w of walls) {
        if (w.collide(player.moveVector)) { hit = w; break; }
    }
    if (hit) player.onCollide([hit]);
    if (!hit) player.inCollision = false;
    if (player.inCollision) player.revertPosition(hit);
    return hit;
}

describe('Wystrzelenie z toru przy trakcie ślizgu ze skrętem (bug: bike flew off-screen)', () => {

    it('dociśnięty pod kątem do ściany z trzymaonym skrętem nigdy nie wylatuje (300 ticków)', () => {
        // 45° w prawo-dół, ściana pionowa z lewej — reprodukcja buga,
        // w której pozycja rosla ~2x na tick aż poza planszę
        let player = rider(50, 100, 45);
        let walls = [verticalWallAt(38)];

        let maxDisp = 0;
        for (let i = 0; i < 300; i += 1) {
            let before = { ...player.position };
            tick(player, walls);
            let disp = Math.hypot(player.position.x - before.x, player.position.y - before.y);
            maxDisp = Math.max(maxDisp, disp);
            // pojedynczy tick fizyczny ≈ 11 px max (speed 20 * 16.67/30);
            // ślizg jest tłumiony, więc każdy skok musi być mniejszy
            expect(disp).toBeLessThan(15);
        }
        // po 300 tickach na max prędkości gracz wciąż "na planszy"
        expect(Math.abs(player.position.x)).toBeLessThan(2000);
        expect(Math.abs(player.position.y)).toBeLessThan(2000);
        expect(maxDisp).toBeLessThan(15);
    });
});
