import Util from './util.js';
import Vertex from './vertex.js';
import Player from './player.js';

/**
 * Mózg Komputera — pure-pursuit: jazda do przodu po linii wyścigu.
 *
 * Przepisany po feedbacku z rozgrywki (2026-10-30): port oryginalnego AI
 * (fizyka.md §8) celował co klatkę w NAJBLIŻSZY punkt Trasy, więc przy
 * ciasnych punktach kierunek celu skakał o ±90° i Komputer wywijał
 * bączki / krążył w miejscu, zamiast jechać. Nowa logika jest prosta
 * i szybka:
 *
 *  1. Najbliższy punkt Trasy (okno wokół ostatniego waypointa; gdy
 *     się gubi — pełny skan pętli).
 *  2. Cel = punkt Trasy kilka pozycji DO PRZODU wzdłuż pętli — cel
 *     „wybiega" przed motocykl, więc jazda tnie łuki (racing line),
 *     a nie klei się do każdego punkcika.
 *  3. Sterowanie wg błędu kątowego do celu (0° = północ, CW): poza
 *     martwym pasem skręt, w pasie prosto = pełny gaz.
 *  4. Test na sucho (fizyka.md §5.3): jeśli wybrana komenda kończy się
 *     kolizją w mini-symulacji następnego kroku, próbujemy prosto →
 *     lewo → prawo (pierwsza wolna); gdy wszystkie kolidują — zostaje
 *     decyzja naturalna (ślizg po bandzie robi resztę).
 *
 * Osobowość trybów 1–4 (dawniej Scatter, spec decyzja #15 → decyzja
 * #20): im wyższy tryb, tym dłużej cel wybiega w przód — wyższe tryby
 * tną zakręty agresywniej i jadą szybciej.
 */

/** Komendy Mózgu — identyczna semantyka klawiszy człowieka. */
export const CMD = {
    LEFT: -1,
    STRAIGHT: 0,
    RIGHT: 1
};

/** Ile punktów Trasy (co ~20 px) cel wybiega przed najbliższy punkt. */
export const LOOKAHEAD_POINTS = 3; // dla mode 1; mode 4 → 6
/** Okno przeszukiwania Trasy wokół ostatniego waypointa (indeksy). */
export const NEAREST_WINDOW_BACK = 6;
export const NEAREST_WINDOW_FWD = 22;
/** Powyżej tej odległości (px) okno lokalne się „gubi" → pełny skan. */
export const LOST_DISTANCE = 45;
/** Martwy pas błędu kątowego (°) — w nim jedziemy prosto (pełny gaz). */
export const DEAD_BAND_DEG = 8;

export default class Brain {

    /**
     * @param {object} [options]
     * @param {number} [options.mode] tryb Komputera 1–4 (osobowość:
     *   siła wybiegania celu w przód)
     * @param {function} [options.rng] generator [0,1) (domyślnie Math.random)
     * @param {number} [options.dt] krok symulacji na sucho (ms; 1000/60 jak gra)
     */
    constructor({ mode = 1, rng = Math.random, dt = 1000 / 60 } = {}) {
        this.mode = mode;
        this.rng = rng;
        this.dt = dt;

        // indeks najbliższego punktu Trasy (Game ustawia startowy przez
        // Route.startIndexFor; potem aktualizowany co klatkę)
        this.waypointIdx = 0;
        // aktualny punkt celu (cache — debug/overlay/następna klatka)
        this.target = null;
    }

    /**
     * Jedna decyzja Mózgu dla bieżącej klatki.
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
            this.target = null;
            return CMD.STRAIGHT;
        }

        const count = route.length;
        const nearest = this.findNearest(player, route);
        this.waypointIdx = nearest.idx;

        // cel wybiega w przód wzdłuż pętli — jazda po linii wyścigu,
        // nie od punkcika do punkcika
        const look = this.lookaheadPoints();
        this.target = route[(nearest.idx + look) % count];

        let cmd = this.cmdTo(this.target, player);

        // Fallback anty-kolizyjny (§5.3): jeśli wybrana komenda koliduje,
        // próbuj prosto → lewo → prawo (prosto pierwszy — nie tracimy prędkości).
        if (world != null && this.wouldCollide(player, cmd, world)) {
            for (const probe of [CMD.STRAIGHT, CMD.LEFT, CMD.RIGHT]) {
                if (probe !== cmd && !this.wouldCollide(player, probe, world)) {
                    return probe;
                }
            }
        }

        return cmd;
    }

    /**
     * Wybieganie celu w przód wg trybu: mode 1 → 3 punkty (60 px,
     * ostrożnie), mode 4 → 6 punktów (120 px — agresywne cięcie łuków).
     */
    lookaheadPoints() {
        return Math.min(6, Math.max(LOOKAHEAD_POINTS, 2 + (this.mode || 1)));
    }

    /**
     * Najbliższy punkt Trasy: przeszukujemy okno indeksów wokół
     * ostatniego waypointa (cígłość jazdy wzdłuż pętli); jeśli najlepszy
     * traf w oknie jest dalej niż LOST_DISTANCE, robimy pełny skan pętli
     * (start biegu / ekskursja poza Trasę).
     */
    findNearest(player, route) {
        const count = route.length;
        const head = player.position;

        let bestIdx = null;
        let bestDist = Infinity;
        const scan = (from, to) => {
            for (let k = from; k <= to; k += 1) {
                const idx = ((k % count) + count) % count;
                const p = route[idx];
                const d = Math.hypot(p.x - head.x, p.y - head.y);
                if (d < bestDist) {
                    bestDist = d;
                    bestIdx = idx;
                }
            }
        };

        scan(
            this.waypointIdx - NEAREST_WINDOW_BACK,
            this.waypointIdx + NEAREST_WINDOW_FWD
        );

        if (bestDist > LOST_DISTANCE) {
            bestIdx = null;
            bestDist = Infinity;
            scan(0, count - 1);
        }

        return { idx: bestIdx, dist: bestDist };
    }

    /**
     * Sterowanie wg błędu kątowego (kierunek na cel − kierunek jazdy):
     * poza martwym pasem skręt, w pasie prosto — zero pompowania
     * sterowaniem, maksymalna prędkość na prostych.
     */
    cmdTo(target, player) {
        const err = wrap180(angleOfPoint(player, target) - player.angle);
        if (err > DEAD_BAND_DEG) {
            return CMD.RIGHT;
        }
        if (err < -DEAD_BAND_DEG) {
            return CMD.LEFT;
        }
        return CMD.STRAIGHT;
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

/** Kąt (0° = północ, rosnąco CW) z pozycji gracza do punktu. */
function angleOfPoint(player, point) {
    return Util.normalizeAngle(
        Math.atan2(point.y - player.position.y, point.x - player.position.x) * 180 / Math.PI + 90
    );
}

/** Zawinięcie kąta do przedziału (−180, 180]. */
function wrap180(angle) {
    return ((angle % 360) + 540) % 360 - 180;
}
