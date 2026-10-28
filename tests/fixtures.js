import Vertex from '../js/vertex.js';

const DEG = Math.PI / 180;

/**
 * Buduje "body" gracza w formacie, którego używają Level.collide oraz
 * reakcja na kolizję: moveVector (tor przodu) + stare i nowe położenie
 * wierzchołka przodu.
 *
 * @param {number} x  pozycja startowa X
 * @param {number} y  pozycja startowa Y
 * @param {number} angleDeg  kąt w stopniach (0 = północ, rosnąco CW)
 * @param {number} step  długość kroku (px)
 */
export function makeBody(x, y, angleDeg, step = 10) {
    let dx = Math.sin(angleDeg * DEG);
    let dy = -Math.cos(angleDeg * DEG);

    let oldFront = { x: x, y: y };
    let newFront = { x: x + dx * step, y: y + dy * step };

    return {
        oldFrontVertex: oldFront,
        newFrontVertex: newFront,
        moveVector: new Vertex(oldFront, newFront),
        stepX: newFront.x - oldFront.x,
        stepY: newFront.y - oldFront.y,
        inCollision: false,
        onCollide() {} // stub jak w Playerze (reakcje testujemy na wyższym seamie)
    };
}

/** Ściana: pionowy segment od (wallX, y1) do (wallX, y2). */
export function verticalWallAt(wallX, y1 = -1000, y2 = 1000) {
    return new Vertex({ x: wallX, y: y1 }, { x: wallX, y: y2 });
}

/** Ściana: poziomy segment od (x1, wallY) do (x2, wallY). */
export function horizontalWallAt(wallY, x1 = -1000, x2 = 1000) {
    return new Vertex({ x: x1, y: wallY }, { x: x2, y: wallY });
}
