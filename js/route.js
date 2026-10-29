export default class Route {

    /** Skok między punktami Trasy (Radar czuje pierwszy poza 16 px). */
    static ROUTE_STEP = 20;

    /**
     * Generuje Trasę (łuk środkowy toru) z geometrii ścian sparsowanych
     * przez Level. Punkty w kolejności łuku, próbka o stałej gęstości,
     * przesunięte bocznie o wspólny losowy offset (raz na bieg — ADR-0001).
     *
     * @param {Level} level tor z {@link Level#vertices}
     * @param {function} [rng] generator [0,1) (domyślnie Math.random)
     * @param {boolean} [debug=false] rysuj punkty Trasy (overlay debugowy)
     * @returns {Array<{x:number,y:number}>} zamknięta pętla punktów Trasy
     */
    static forTrack(level, rng = Math.random, debug = false) {
        const segments = level.vertices;
        const loop = radialLoop(centroidOf(segments), segments);
        const points = resampleClosed(loop, Route.ROUTE_STEP);
        // wspólny offset boczny losowany raz na bieg (ADR-0001): rng → [−1,1]
        // × 2/3 dystansu do najbliższej ściany (jazda zawsze w torze)
        const bias = 2 * rng() - 1;
        const offset = applyLateralOffset(points, segments, bias);
        // ponowny równomierny resampling — offset nie rozstraja gęstości
        const route = resampleUniform(offset, Route.ROUTE_STEP);
        if (debug) {
            drawDebugOverlay(route);
        }
        return route;
    }

    /**
     * Indeks punktu Trasy najbliższego podanej pozycji startowej — początek
     * cyklicznego waypointa (waypointIdx) dla startujących Komputerów.
     *
     * @param {Array<{x:number,y:number}>} points punkty Trasy
     * @param {{x:number,y:number}} pos pozycja startowa (Level.startPoints[i])
     * @returns {number} indeks do points
     */
    static startIndexFor(points, pos) {
        let best = 0;
        let bestD = Infinity;
        points.forEach((p, i) => {
            const d = (p.x - pos.x) ** 2 + (p.y - pos.y) ** 2;
            if (d < bestD) {
                bestD = d;
                best = i;
            }
        });
        return best;
    }
}

/**
 * Debug overlay: zaznacza punkty Trasy na aktywnej warstwie paper.js
 * (żółto-czerwone kółka, usuwa poprzedni overlay). Wywoływane tylko
 * z debug=true — normalny bieg nie rysuje nic (issue #1: "punktów
 * nie rysujemy").
 */
function drawDebugOverlay(points) {
    if (typeof paper === 'undefined' || !paper.project) {
        return;    // bez paper (np. testy) — overlay pomijamy
    }
    // usuń poprzedni overlay Trasy, jeśli był
    paper.project.activeLayer.children
        .filter(child => child.data && child.data.routeDebug)
        .forEach(child => child.remove());
    points.forEach(p => {
        const dot = new paper.Path.Circle(new paper.Point(p.x, p.y), 2.5);
        dot.strokeColor = 'red';
        dot.fillColor = 'yellow';
        dot.data.routeDebug = true;
        paper.project.activeLayer.addChild(dot);
    });
    paper.view.draw();
}

/** Środek ciężaru środków ścian (root heurystyki osi środkowej). */
function centroidOf(segments) {
    let sx = 0;
    let sy = 0;
    segments.forEach(s => {
        sx += (s.p1.x + s.p2.x) / 2;
        sy += (s.p1.y + s.p2.y) / 2;
    });
    return { x: sx / segments.length, y: sy / segments.length };
}

/**
 * Od korzenia wyrusza promieniem w 360 kierunkach:
 * dla każdego kąta szuka najlepszego punktu pomiędzy przecięciami ze
 * ścianami w tej linii; punkty w kolejności kąta dają zamkniętą pętlę.
 */
function radialLoop(root, segments) {
    // gęsto w kierunkach, by zaokrąglenia narożników nie skracały cieciw
    // resamplowanych poniżej do stałej gęstości (krok euklidesowy ≈ ROUTE_STEP)
    const rays = 360;
    const loop = [];
    for (let i = 0; i < rays; i++) {
        const angle = 2 * Math.PI * i / rays;
        const p = halfwayAlongRay(root, angle, segments);
        if (p) {
            loop.push(p);
        }
    }
    return loop;
}

function halfwayAlongRay(root, angle, segments) {
    const dir = { x: Math.cos(angle), y: Math.sin(angle) };
    // wszystkie przecięcia promienia ze ścianami, posortowane po głębokości
    const hits = [];
    const EPS = 0.001;
    segments.forEach(s => {
        const t = raySegmentIntersection(root, dir, s);
        if (t !== null && t > EPS) {
            hits.push(t);
        }
    });
    if (hits.length < 2) {
        return null;
    }
    hits.sort((a, b) => a - b);
    // wybieramy parę sąsiednich przecięć, której punkt środkowy ma naj-
    // większy light od wszystkich ścian (heurystyka osi środkowej).
    // Dziobki bandy zewnętrznej, linia startu czy wypustki to ściany,
    // które przecinają tor „w poprzek": pierwsze dwa przecięcia bywa, że
    // dotyczą właśnie nich, a prawdziwy środek toru zawsze ma większy
    // dystans od ścian niż punkt wciśnięty między wypustkę a bandę.
    let best = null;
    let bestClear = -1;
    for (let i = 0; i < hits.length - 1; i++) {
        const t = (hits[i] + hits[i + 1]) / 2;
        const mid = { x: root.x + dir.x * t, y: root.y + dir.y * t };
        const clear = pointSegDistanceMin(mid, segments);
        if (clear > bestClear) {
            bestClear = clear;
            best = mid;
        }
    }
    return best;
}

/** Minimalny dystans od punktu do ścian (odległość punkt–odcinek). */
function pointSegDistanceMin(p, segments) {
    let best = Infinity;
    segments.forEach(seg => {
        best = Math.min(best, pointSegDistance(p, seg));
    });
    return best;
}

/** Odległość punktu od odcinka ściany (rzut zawężony do długości odcinka). */
function pointSegDistance(p, seg) {
    const ex = seg.p2.x - seg.p1.x;
    const ey = seg.p2.y - seg.p1.y;
    const len2 = ex * ex + ey * ey;
    let t = len2 > 0 ? ((p.x - seg.p1.x) * ex + (p.y - seg.p1.y) * ey) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const dx = p.x - (seg.p1.x + ex * t);
    const dy = p.y - (seg.p1.y + ey * t);
    return Math.hypot(dx, dy);
}

/**
 * Przepróbkowuje zamkniętą pętlę do punktów o stałej gęstości ~step px.
 *
 * Radar (fizyka.md §8.4) mierzy odległości euklidesowe (cieciwy) między
 * kolejnymi punktami Trasy, więc po drobnym resamplingu wygładzamy pętlę
 * w oknie ~step px — narożniki pętli zaokrąglają się i cieciwa między
 * sąsiednimi punktami ≈ długości łuku (bez tego ostre narożniki torów
 * prostokątnych dawałyby cieciwy poniżej RADAR_MIN_DIST). Na końcu
 * resampling ściśle równomierny po łuku: wszystkie odstępy identyczne,
 * więc Radar czuje punkty dokładnie co ROUTE_STEP px.
 *
 * @param {Array<{x:number,y:number}>} loop zamknięta pętla punktów
 * @param {number} step odstęp między punktami Trasy (px)
 * @returns {Array<{x:number,y:number}>} pętla o stałym kroku ~step px
 */
function resampleClosed(loop, step) {
    if (loop.length < 2) {
        return loop;
    }
    const FINE_STEP = 2; // gęsta baza do wygładzania (px)
    const fine = resampleUniform(loop, FINE_STEP);
    // okno ±step/2 px zaokrągla narożniki w skali kroku Trasy
    const halfWindow = Math.max(2, Math.round(step / FINE_STEP / 2));
    const smooth = smoothClosed(fine, halfWindow);
    return resampleUniform(smooth, step);
}

/** Ponowne próbkowanie zamkniętej pętli co step px po łuku. */
function resampleUniform(loop, step) {
    const lens = loop.map((a, i) => {
        const b = loop[(i + 1) % loop.length];
        return Math.hypot(b.x - a.x, b.y - a.y);
    });
    const perimeter = lens.reduce((a, b) => a + b, 0);
    if (perimeter < step) {
        return loop;
    }
    const pointAt = (d) => {
        const dd = ((d % perimeter) + perimeter) % perimeter;
        let acc = 0;
        for (let i = 0; i < loop.length; i++) {
            if (acc + lens[i] >= dd) {
                const t = lens[i] > 0 ? (dd - acc) / lens[i] : 0;
                const a = loop[i];
                const b = loop[(i + 1) % loop.length];
                return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
            }
            acc += lens[i];
        }
        return loop[0];
    };
    const n = Math.max(8, Math.round(perimeter / step));
    const out = [];
    for (let i = 0; i < n; i++) {
        out.push(pointAt(i * perimeter / n));
    }
    return out;
}

/**
 * Średnia krocząca w oknie ±half punktów (z zawijaniem) — zaokrągla
 * narożniki pętli w skali okna, cieciwy ≈ łuki przy późniejszym resamplingu.
 */
function smoothClosed(loop, half) {
    return loop.map((_, i) => {
        let sx = 0;
        let sy = 0;
        for (let k = -half; k <= half; k++) {
            const p = loop[(i + k + loop.length) % loop.length];
            sx += p.x;
            sy += p.y;
        }
        const cnt = 2 * half + 1;
        return { x: sx / cnt, y: sy / cnt };
    });
}

/**
 * Przesuwa punkty Trasy wzdłuż lokalnej normalnej o bias · 2/3 dystansu
 * do najbliższej ściany (bias ∈ [−1, 1] — jedna losowana wartość na bieg,
 * wspólna dla wszystkich Komputerów — ADR-0001). Offset nie wynosi więc
 * więcej niż 2/3 dystansu do bandy, więc Trasa zostaje w bezpiecznym
 * marginesie od ścian.
 */
function applyLateralOffset(points, segments, bias) {
    if (bias === 0) {
        return points;
    }
    return points.map((p, i) => {
        // normalna lokalna: z prostej przez sąsiednie punkty Trasy
        const a = points[(i - 1 + points.length) % points.length];
        const b = points[(i + 1) % points.length];
        const tx = b.x - a.x;
        const ty = b.y - a.y;
        const tlen = Math.hypot(tx, ty) || 1;
        const nx = -ty / tlen;
        const ny = tx / tlen;

        // dystans do najbliższej ściany (promienie w ±normalnej skanują
        // oba kierunki; zerowy dystans → brak luzu)
        const room = wallDistance(p, { x: nx, y: ny }, segments);
        if (room <= 0 || room === Infinity) {
            return p;
        }
        const shift = bias * room * 2 / 3;
        return { x: p.x + nx * shift, y: p.y + ny * shift };
    });
}

/** Dystans do najbliższej ściany wzdłuż (±) normalnej (lekkie przesunięcie startu). */
function wallDistance(from, dir, segments) {
    let best = Infinity;
    const EPS = 0.5; // pomijamy przecięcia ~0 (punkt startowy na pętli)
    segments.forEach(seg => {
        [dir, { x: -dir.x, y: -dir.y }].forEach(d => {
            const t = raySegmentIntersection(from, d, seg);
            if (t !== null && t > EPS) {
                best = Math.min(best, t);
            }
        });
    });
    return best;
}

/**
 * Przecięcie promienia (root + t*dir, t > 0) z odcinkiem ściany (p1..p2).
 * Zwraca t albo null, gdy brak przecięcia.
 */
function raySegmentIntersection(root, dir, seg) {
    const ex = seg.p2.x - seg.p1.x;
    const ey = seg.p2.y - seg.p1.y;
    const denom = dir.x * ey - dir.y * ex;
    if (Math.abs(denom) < 1e-12) {
        return null;    // równoległe
    }
    const rx = seg.p1.x - root.x;
    const ry = seg.p1.y - root.y;
    // Cramer dla: t·dir − u·e = (p1 − root);
    // macierz [[dir −e]] → t = cross(q, e)/cross(dir, e), u = cross(q, dir)/cross(dir, e)
    const t = (rx * ey - ry * ex) / denom;
    const u = (rx * dir.y - ry * dir.x) / denom;
    if (t > 0 && u >= 0 && u <= 1) {
        return t;
    }
    return null;
}