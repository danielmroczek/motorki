import { describe, it, expect, beforeAll } from 'vitest';
import { makeBody, verticalWallAt } from './fixtures.js';
import Player from '../js/player.js';

// Node nie ma paper.js — konstruktor Playera tworzy tylko obiekty rysujące,
// których w tych testach nie dotykamy.
beforeAll(() => {
    globalThis.Path = class { add() {} };
    globalThis.Color = class {};
    globalThis.Point = class {};
    globalThis.Group = class { addChild() {} };
    globalThis.Path.Line = class {};
});

/** Zaślepiona warstwa rysowania i symulacja pętli Game.tick (move→collide→revert). */
function slidingPlayer(angleDeg) {
    let player = new Player('red', { skidmarks: { addChild() {} } });
    player.angle = angleDeg;
    player.position = { x: 50, y: 100 };
    player.start();
    return player;
}

/** Jeden tick gry na żywym Playerze (16,67 ms jak w grze — fps 60). */
function tick(player, levelVertices) {
    player.move(1000 / 60);
    let hit = simulateLevelCollide(player, levelVertices);

    // dokładnie semantyka Game.tick: czysty tick czyści flagę,
    // Level.collide przy pierwszym trafieniu woła onCollide (inCollision = true)
    if (hit && !player.inCollision) player.onCollide([hit]);
    if (!hit) player.inCollision = false;

    if (player.inCollision) {
        player.revertPosition(hit); // hit = null dla zderzeń, segment dla ściany
    }
}

/** Uproszczone Level.collide dla wyznaczonych segmentów. */
function simulateLevelCollide(player, vertices) {
    for (let wall of vertices) {
        if (wall.collide(player.moveVector)) {
            return wall;
        }
    }
    return null;
}

describe('Wielo-tickowy ślizg po pionowej ścianie (spec #18)', () => {

    it('dociśnięty w ścianę gracz postępuje wzdłuż niej — nie zamiera', () => {
        let player = slidingPlayer(80); // w prawo, lekko w górę — ściana z prawej
        player.position = { x: 20, y: 100 };

        for (let i = 0; i < 30; i += 1) {
            tick(player, [verticalWallAt(60)]);
        }
        let x1 = player.position.x;
        let y1 = player.position.y;

        // postęp wzdłuż ściany (w górę, y maleje), a nie unieruchomienie
        expect(y1).toBeLessThan(100);
        expect(x1).toBeLessThanOrEqual(60); // nigdy nie wchodzi w ścianę
        expect(player.speed).toBeGreaterThanOrEqual(player.physics.minSpeed);
    });

    it('po ustąpieniu kolizji gracz wraca do normalnej jazdy', () => {
        let player = slidingPlayer(80);
        player.position = { x: 20, y: 100 };

        for (let i = 0; i < 20; i += 1) {
            tick(player, [verticalWallAt(60)]); // wciśnięty w ścianę
        }
        // floates przy ścianie: progress w górę, pozycja nie wjeżdża w ścianę
        expect(player.position.y).toBeLessThan(100);
        expect(player.position.x).toBeLessThanOrEqual(60);
        let yAtWall = player.position.y;

        // ściana znika (np. koniec bandy) — kolizja musi zostać zdjęta
        for (let i = 0; i < 10; i += 1) {
            tick(player, []);
        }
        expect(player.inCollision).toBe(false);
        // rusza dalej w swoim kierunku (80° = w prawo i w górę)
        expect(player.position.y).toBeLessThan(yAtWall);
    });
});
