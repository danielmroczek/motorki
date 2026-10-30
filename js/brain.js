import Util from './util.js';
import Vertex from './vertex.js';
import Player from './player.js';

/**
 * Mózg Komputera — port logiki oryginału (fizyka.md §8.3–§8.6, GitHub issue #2).
 *
 * Trzy warstwy:
 *  1. Radar (§8.4): od bieżącego waypointa 10 punktów Trasy do przodu,
 *     pomiń odczyty bliższe niż 16 px od środka sprite'a; odczyt Radaru =
 *     najbliższy punkt za progiem w oknie („best" startuje z 9999 — jak
 *     w oryginale). Rozmycie Scatter (całkowite, jak rand()%scatter −
 *     scatter/2 w §8.3) losowane osobno na X i Y **co klatkę**.
 *  2. Kąt celu (§8.5): atan2(dy, dx)·180/π + 90 z delty odczytów Radaru
 *     klatka → klatka (AI_SetTargetDir); pierwsza klatka — wantedDir =
 *     kierunek gracza. Konwencja gry: 0° = północ, rosnąco CW.
 *  3. Drzewo decyzyjne (§8.6): dAng = kąt celu − kierunek (zawinięty do
 *     ±180°); dAng < −10° → lewo, dAng ≥ +21° → prawo, pas środkowy
 *     z korektą „marży" od mode % 5. Komenda: −1 / 0 / +1 — ta sama
 *     semantyka co klawisze człowieka.
 *
 * Test na sucho (§5.3, spec decyzja #14): jeśli wybrana komenda kończy się
 * kolizją w mini-symulacji następnego kroku (pozycja, kąt, speed, anglespeed
 * po komendzie + istniejące `Level.collide` / `collidePlayers` na
 * symulowanych wektorach — read-only), Mózg próbuje −1, 0, +1 po kolei.
 *
 * Bez licznika stuck i eliminacji (spec decyzja #19).
 */

/** Komendy Mózgu — identyczna semantyka klawiszy człowieka. */
export const CMD = {
    LEFT: -1,
    STRAIGHT: 0,
    RIGHT: 1
};

/** Stałe oryginału (fizyka.md §8.1). Nazwy z §16.6 oryginału — port. */
export const AI_SCATTER_MOD = 5;
export const AI_SCATTER_MAX = 4;
export const AI_TURN_LEFT_THRESH = -10;
export const AI_TURN_RIGHT_THRESH = 21;
export const RADAR_MIN_DIST = 16.0;
export const RADAR_LOOKAHEAD = 10;

export default class Brain {

    /**
     * @param {object} [options]
     * @param {number} [options.mode] Scatter-mode Komputera 1–4 (spec decyzja
     *   #15: kolejność dodawania do stawki; jitter 3/2/1/0 px)
     * @param {function} [options.rng] generator [0,1) (domyślnie Math.random)
     * @param {number} [options.dt] krok symulacji na sucho (ms; 1000/60 jak gra)
     */
    constructor({ mode = 1, rng = Math.random, dt = 1000 / 60 } = {}) {
        this.mode = mode;
        this.rng = rng;
        this.dt = dt;

        // Scatter: oryginał losuje jitter = 4 − mode % 5 px; tryby 1–4 specu
        // dają 3/2/1/0 px (mode % 5 → 1..4), wyższe/zerowe clampujemy.
        this.scatter = Math.min(3, Math.max(0, AI_SCATTER_MAX - (mode % AI_SCATTER_MOD)));

        // indeks waypointa Trasy (cykliczny, zawijany do przodu — §8.4)
        this.waypointIdx = 0;
        // kąt celu z poprzedniej klatki (wantedDir oryginału, §8.5)
        this.wantedDir = null;
        // punkt celu z Radaru (radarX/radarY oryginału — cache między klatkami)
        this.target = null;
    }

    /**
     * Jedna decyzja Mózgu dla bieżącej klatki (AI_Brain, §8.6).
     *
     * @param {Player} player motocykl (position, angle, speed, anglespeed)
     * @param {Array<{x:number,y:number}>} route punkty Trasy (pętla)
     * @param {object} [world] środowisko do testu na sucho:
     *   `{ level, players }` (Level i stawka). Bez world — czysta logika,
     *   bez kolizyjnego fallbacku.
     * @returns {number} −1 lewo / 0 prosto / +1 prawo
     */
    decide(player, route, world = null) {
        if (!route || route.length === 0) {
            // brak Trasy → prosto (nic nie ryzykujemy)
            return CMD.STRAIGHT;
        }

        const prevTarget = this.target;
        this.scan(player, route);

        if (!this.target) {
            // Radar niczego nie znalazł (nawet nigdy wcześniej) → prosto,
            // bez testu na sucho (dx == dy == 0 w oryginale, §8.6)
            return CMD.STRAIGHT;
        }

        this.updateWantedDir(player, prevTarget);

        // wektor środek sprite'a → odczyt Radaru (do korekty w paśmie prostym)
        const dToTarget = {
            dx: this.target.x - player.position.x,
            dy: this.target.y - player.position.y
        };

        const dAng = wrap180(this.wantedDir - player.angle);
        const cmd = this.brainCmd(player, dAng, dToTarget);

        // Fallback anty-kolizyjny (§8.6): jeśli wybrana komenda koliduje,
        // próbuj −1, 0, +1 po kolei (naturalna jest ostatnią próbą ±1).
        if (world != null && this.wouldCollide(player, cmd, world)) {
            for (const probe of [CMD.LEFT, CMD.STRAIGHT, CMD.RIGHT]) {
                if (!this.wouldCollide(player, probe, world)) {
                    return probe;
                }
            }
        }

        return cmd;
    }

    /**
     * Drzewo decyzyjne (§8.6): dAng < −10° → lewo; pas środkowy (−10..21°)
     * z korektą „marży" zależną od mode % 5 (doskok w stronę Radaru / prosto /
     * powrót w lewo gdy przekręcił); dAng ≥ 21° → prawo.
     */
    brainCmd(player, dAng, dToTarget) {
        if (dAng < AI_TURN_LEFT_THRESH) {
            return CMD.LEFT;
        }
        if (dAng >= AI_TURN_RIGHT_THRESH) {
            return CMD.RIGHT;
        }

        // Korekta w paśmie prostym (fizyka.md §8.6): „kąt" = bezwzględny
        // kierunek na odczyt Radaru (atan2(dy,dx)·180/π + 90, zawinięty do
        // ±180°) — oryginał NIE odejmuje tu kierunku gracza. „Marża" =
        // −(mode % 5)·turnStep/2. turnStep oryginału (krok skrętu co klatkę)
        // w tej fizyce ≈ physics.anglespeedAccel·dt/30.
        const physics = player.physics || Player.PHYSICS_TYPE.SLOW;
        const heading = wrap180(
            Math.atan2(dToTarget.dy, dToTarget.dx) * 180 / Math.PI + 90
        );
        const lane = this.mode % AI_SCATTER_MOD;                 // 0..4
        const turnStep = physics.anglespeedAccel * this.dt / 30;
        const margin = -lane * turnStep / 2;                     // dzielenie w dół ku 0

        if (margin < heading) {
            // jeszcze blisko — czy da się dalej doskakiwać?
            // (cap oryginału: steering < 2·turnStep — tu jako granica
            // prędkości kątowej, bo port nie trzyma akumulatora steering)
            if (lane * 3 < heading && (player.anglespeed || 0) < 2 * turnStep) {
                return CMD.RIGHT;
            }
            return CMD.STRAIGHT;
        }
        return CMD.LEFT;                                         // przekręcił
    }

    /**
     * Radar (§8.4): okno 10 punktów Trasy do przodu od bieżącego waypointa;
     * wygrywa najbliższy punkt dalej niż 16 px od środka sprite'a.
     * Scatter losowany per punkt, osobno na osie X i Y (rng).
     * Bez trafu — cel z poprzedniej klatki zostaje (radarX/radarY oryginału).
     */
    scan(player, route) {
        const count = route.length;
        const head = player.position; // środek sprite'a = pozycja gracza
        let best = Infinity;
        let candidate = null;

        for (let i = this.waypointIdx; i < this.waypointIdx + RADAR_LOOKAHEAD; i++) {
            // zawinięcie indeksu do przodu (§8.3); rozmycie całkowite,
            // jak rand()%scatter − scatter/2 w oryginale (§8.3)
            const idx = ((i % count) + count) % count;
            // rozmycie całkowite: rand()%scatter − scatter/2 (oryginał, §8.3);
            // scatter == 0 → brak rozmycia (ochrona przed modulo przez 0)
            const s = this.scatter;
            const jx = s > 0 ? (Math.floor(this.rng() * s) % s) - Math.trunc(s / 2) : 0;
            const jy = s > 0 ? (Math.floor(this.rng() * s) % s) - Math.trunc(s / 2) : 0;
            const px = route[idx].x + jx;
            const py = route[idx].y + jy;
            const d = Math.hypot(px - head.x, py - head.y);
            if (d < best && d > RADAR_MIN_DIST) {
                best = d;
                candidate = i;
                this.target = { x: px, y: py };
            }
        }

        if (candidate !== null) {
            this.waypointIdx = candidate;
            // zawinięcie do przodu: idx wykraczający poza Trasę → 0 (§8.4)
            if (this.waypointIdx >= count) {
                this.waypointIdx = 0;
            }
        }
    }

    /**
     * Kąt celu (§8.5, AI_SetTargetDir): z delty odczytów Radaru
     * klatka → klatka. Pierwsza klatka (brak starego odczytu):
     * wantedDir = obecny kierunek gracza — dokładnie jak oryginał
     * (`oldRadX == 0 → dir`), bez „poprawki artefaktu" sprzed review.
     * Zostaje bez zmian, gdy odczyt się nie zmienił.
     */
    updateWantedDir(player, prevTarget) {
        if (!prevTarget) {
            // pierwsza klatka: kąt celu = obecny kierunek gracza (§8.5)
            this.wantedDir = Util.normalizeAngle(player.angle);
            return;
        }
        const dx = this.target.x - prevTarget.x;
        const dy = this.target.y - prevTarget.y;

        if (dx === 0 && dy === 0) {
            return; // cel bez zmian — wantedDir zostaje
        }

        // konwencja gry: 0° = północ, rosnąco CW (+90, bo y ekranu w dół)
        const angle = Math.atan2(dy, dx) * 180 / Math.PI + 90;
        this.wantedDir = Util.normalizeAngle(angle);
    }

    /**
     * Test na sucho (§5.3): czy podana komenda w następnym kroku kończy się
     * kolizją? Mini-symulacja jednego kroku fizyki gracza (pozycja, kąt,
     * speed, anglespeed po komendzie) + istniejące `Level.collide` /
     * collidePlayers na symulowanych wektorach — read-only.
     */
    wouldCollide(player, cmd, world) {
        const body = this.simulatedBody(player, cmd);

        if (world.level && world.level.collide(body)) {
            return true;
        }

        const players = world.players || [];
        return players.some(p2 => {
            if (p2 === player || p2.finished) {
                return false;
            }
            return (p2.bodyVector || []).some(v => v.collide(body.moveVector));
        });
    }

    /**
     * Krok na sucho: stan gracza po jednej komendzie w jednym dt —
     * ta sama matematyka co `Player.move`, ale bez dotykania stanu
     * rzeczywistego (wynik tylko w lokalnych zmiennych, jak `StepperSim`).
     */
    simulatedBody(player, cmd) {
        const physics = player.physics || Player.PHYSICS_TYPE.SLOW;
        const dt = this.dt;

        // sterowanie (Player.move: lewo −, prawo +, prosto → wygaszanie)
        let anglespeed = player.anglespeed || 0;
        if (cmd === 0) {
            const sign = Math.sign(anglespeed);
            anglespeed -= sign * physics.anglespeedAccel * (dt / 30);
            if (sign !== Math.sign(anglespeed)) {
                anglespeed = 0;
            }
        } else {
            anglespeed += cmd * physics.anglespeedAccel * (dt / 30);
        }
        anglespeed = Math.min(anglespeed, physics.anglespeedMinMax);
        anglespeed = Math.max(anglespeed, -physics.anglespeedMinMax);

        // prędkość (nowe anglespeed hamuje, jak w Player.move)
        let speed = player.speed || 0;
        speed += physics.acceleration * dt / 16 -
            (Math.abs(anglespeed) / physics.anglespeedBrake * dt / 16);
        speed = Math.min(speed, physics.maxSpeed);
        speed = Math.max(speed, physics.minSpeed);

        // kierunek i pozycja
        const angle = Util.normalizeAngle(player.angle + anglespeed * (dt / 30));
        const dx = Math.sin(angle * Math.PI / 180);
        const dy = -Math.cos(angle * Math.PI / 180);
        const position = {
            x: player.position.x + dx * speed * (dt / 30),
            y: player.position.y + dy * speed * (dt / 30)
        };

        // wierzchołek przodu (Player.frontVertex: (0, −height/2) obrócony
        // i przesunięty), stary → nowy tworzy moveVector do testu kolizji
        const oldFront = Util.movePoint(
            Util.rotatePoint(frontVertexOf(player), player.angle), player.position);
        const newFront = Util.movePoint(
            Util.rotatePoint(frontVertexOf(player), angle), position);

        return {
            oldFrontVertex: oldFront,
            newFrontVertex: newFront,
            moveVector: new Vertex(oldFront, newFront),
            inCollision: false,
            onCollide() {} // no-op — symulacja read-only
        };
    }
}

function frontVertexOf(player) {
    return player.frontVertex || { x: 0, y: -10 };
}

/** Zawinięcie kąta do przedziału (−180, 180]. */
function wrap180(angle) {
    return ((angle % 360) + 540) % 360 - 180;
}
