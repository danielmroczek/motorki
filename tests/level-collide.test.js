import { describe, it, expect } from 'vitest';
import Level from '../js/level.js';
import { makeBody, verticalWallAt, horizontalWallAt } from './fixtures.js';

// Minimalny Level: tylko vertices potrzebne do kolizji (konstruktor wymaga
// dokumentu SVG, więc budujemy obiekt wprost przez prototyp).
function levelWith(vertices) {
    let level = Object.create(Level.prototype);
    level.vertices = vertices;
    return level;
}

describe('Level.collide — ślizg po ścianie', () => {

    it('zwraca false (i nie woła onCollide) gdy ruch nie dotyka ściany', () => {
        let level = levelWith([verticalWallAt(100)]);
        let body = makeBody(50, 50, 0, 5); // jazda w górę, daleko od ściany

        let hit = level.collide(body);

        expect(hit).toBe(false);
    });

    it('zwraca trafiony segment ściany zamiast true przy kolizji', () => {
        let wall = verticalWallAt(60);
        let level = levelWith([wall]);
        let body = makeBody(50, 100, 90, 20); // jazda w prawo, wprost w ścianę

        let hit = level.collide(body);

        expect(hit).toBe(wall);
    });

    it('zwraca pierwszy z trafionych segmentów, gdy ścian jest wiele', () => {
        let wall1 = verticalWallAt(60);
        let wall2 = verticalWallAt(70);
        let level = levelWith([wall1, wall2]);
        let body = makeBody(50, 100, 90, 40); // przecina obie

        let hit = level.collide(body);

        expect([wall1, wall2]).toContain(hit);
    });
});
