import { describe, it, expect, beforeAll } from 'vitest';
import { makeBody, verticalWallAt, horizontalWallAt } from './fixtures.js';

// Node nie ma paper.js — konstruktor Playera tworzy tylko obiekty rysujące,
// których w tych testach nie dotykamy.
beforeAll(() => {
    const noop = () => {};
    globalThis.Path = class { constructor() {} add() {} };
    globalThis.Color = class {};
    globalThis.Point = class {};
    globalThis.Group = class { addChild() {} };
    globalThis.Path.Line = class { constructor() {} };
});

/**
 * Reakcja na kolizję ze ścianą zbudowana na surowym obiekcie z fixtures
 * (ta sama logikaImageSharp działa w Playerze na right tej samej wejściowej
 * trójce: pozycja, stary/new wierzchołek, moveVector).
 */
import Player from '../js/player.js';

// Ślizg liczymy przez prawdziwego Playera: wstrzykujemy kolizję jak robi to
// Game.tick — najpierw move() wykonuje krok (position−lastPosition = krok
// ticku, który revertPosition rozbija na normalną/styczną), potem reakcja.
function playerAt(x, y, angleDeg, step) {
    let player = new Player('red', dummyLayers());
    player.position = { x, y };
    player.angle = angleDeg;
    player.speed = step; // krok ticku = speed * (1000/60)/30 = speed/2 →
    player.start();
    // symulacja move(): krok + wierzchołki (bez rysowania)
    let dx = Math.sin(angleDeg * Math.PI / 180);
    let dy = -Math.cos(angleDeg * Math.PI / 180);
    player.lastPosition = { x, y };
    player.position = { x: x + dx * step / 2, y: y + dy * step / 2 };
    let body = makeBody(x, y, angleDeg, step / 2);
    player.oldFrontVertex = body.oldFrontVertex;
    player.newFrontVertex = body.newFrontVertex;
    player.moveVector = body.moveVector;
    return player;
}

function dummyLayers() {
    return {
        skidmarks: {
            addChild() {}
        }
    };
}

describe('Reakcja na kolizję ze ścianą — ślizg (spec #18)', () => {

    it('ruch w prawo w pionową ścianę: składowa normalna cofnięta, styczny slizg zostaje', () => {
        // jazda w prawo (80°): dx=sin80>0, dy=-cos80<0 (lekko w górę)
        let player = playerAt(50, 100, 80, 20);
        let wall = verticalWallAt(60);

        player.onCollide([wall]);
        player.revertPosition(wall);

        // X cofnięte do ściany (koniec rysowania w ścianie), Y zostaje przesunięte w górę
        expect(player.position.x).toBeLessThan(60);
        expect(player.position.y).toBeLessThan(100);
    });

    it('ruch pod kątem do poziomej ściany: slizg wzdłuż ściany', () => {
        // jazda w dół z odchyłką w prawo (170°): dx=sin170>0, dy=-cos170>0
        let player = playerAt(100, 50, 170, 20);
        let wall = horizontalWallAt(88);

        player.onCollide([wall]);
        player.revertPosition(wall);

        // Y cofnięte powyżej ściany, X przesunięte w prawo
        expect(player.position.y).toBeLessThan(88);
        expect(player.position.x).toBeGreaterThan(100);
    });

    it('ruch wprost w ścianę (90°): pozycja cofnięta do linii kolizji, brak dryfu', () => {
        let player = playerAt(50, 100, 90, 20);
        let wall = verticalWallAt(60);

        player.onCollide([wall]);
        player.revertPosition(wall);

        // brak składowej stycznej: pozycja cofnięta, bez dryfu wzdłuż ściany
        expect(player.position.y).toBe(100);
        expect(player.position.x).toBeLessThan(60);
    });

    it('zderzenie z motocyklem (bez ściany): pełny revert jak dotychczas', () => {
        let player = playerAt(50, 100, 80, 20);

        player.onCollide([verticalWallAt(60)]); // wchodzi w inCollision, kick anglespeed
        player.revertPosition(); // collidePlayers przechodzi bez ściany

        expect(player.position).toEqual(player.lastPosition ? player.lastPosition : { x: 50, y: 100 });
        // pełny revert = pozycja wraca na punkt sprzed kroku
        expect(player.position.x).toBe(50);
        expect(player.position.y).toBe(100);
    });
});
