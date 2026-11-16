export default class Route {

    /** Skok między punktami Trasy (Radar czuje pierwszy poza 16 px). */
    static ROUTE_STEP = 20;

    /**
     * Maksymalny boczny offset w stronę WEWNĘTRZNĄ jako ułamek dystansu do
     * najbliższej ściany (ADR-0003).
     */
    static MAX_OFFSET_IN = 0.5;

    /**
     * Maksymalny boczny offset w stronę ZEWNĘTRZNĄ jako ułamek dystansu do
     * najbliższej ściany — pas jest przycięty od zewnątrz, bo zewnętrzna linia
     * jest dłuższa i tylko odbierała botom czas (ADR-0003).
     */
    static MAX_OFFSET_OUT = 0.2;

    /**
     * Baza Tras: łuk środkowy toru z geometrii ścian sparsowanych przez
     * Level, próbka o stałej gęstości, zorientowany zgodnie z kierunkiem
     * jazdy. Liczona raz na bieg — z niej powstają Trasy wszystkich
     * Komputerów (ADR-0003).
     *
     * @param {Level} level tor z {@link Level#vertices}
     * @returns {Array<{x:number,y:number}>} zamknięta pętla bez offsetu
     */
    static baseLoop(level) {
        const segments = level.vertices;
        const loop = radialLoop(centroidOf(segments), segments);
        const points = resampleClosed(loop, Route.ROUTE_STEP);
        // Orientacja pętli zgodnie z zamierzonym kierunkiem jazdy toru.
        // radialLoop porządkuje punkty po kącie promienia, więc pętla
        // dostaje sztywną orientację (zgodną z zegarem na ekranie), która
        // na realnych torach bywa PRZECIWNA do jazdy wyznaczonej kątem
        // startowym (Level.startPoints[0].angle). Pure-pursuit (Brain)
        // celuje w punkty "naprzód po pętli" — odwrotna orientacja Trasy
        // oznaczałaby jazdę pod prąd i okrążenia naliczane jako cheat.
        orientLoopToStart(points, firstStartPoint(level));
        return points;
    }

    /**
     * Trasy dla stawki Komputerów: wspólna baza + osobna linia na każdy
     * komputer (ADR-0003). Linie rozchodzą się od strony wewnętrznej: pas
     * dzielony jest na `count` warstw o równym prawdopodobieństwie rozkładu
     * liniowego (gęstość maleje w stronę zewnętrznej), warstwy tasowane,
     * a komputer dostaje środek swojej warstwy z jitterem ±1/4 jej szerokości.
     * Kolejność tras odpowiada kolejności Komputerów w stawce.
     *
     * @param {Level} level tor z {@link Level#vertices}
     * @param {number} count liczba Komputerów (0 → brak tras, bez geometrii)
     * @param {function} [rng] generator [0,1) (domyślnie Math.random)
     * @returns {Array<Array<{x:number,y:number}>>} pętle Tras
     */
    static forField(level, count, rng = Math.random) {
        if (!count || count <= 0) {
            return [];
        }
        const segments = level.vertices;
        const base = Route.baseLoop(level);
        const signs = innerSigns(base);
        return stratifiedLanes(count, rng).map(lane => {
            const offset = applyLateralOffset(base, segments, signs, lane);
            // ponowny równomierny resampling — offset nie rozstraja gęstości
            return resampleUniform(offset, Route.ROUTE_STEP);
        });
    }

    /**
     * Trasa pojedynczego Komputera (wrapper na {@link Route.forField}).
     *
     * @param {Level} level tor z {@link Level#vertices}
     * @param {function} [rng] generator [0,1) (domyślnie Math.random)
     * @param {boolean} [debug=false] rysuj punkty Trasy na warstwie paper.js
     *   (sam podgląd geometrii — kolor bazy, bez tożsamości gracza)
     * @returns {Array<{x:number,y:number}>} zamknięta pętla punktów Trasy
     */
    static forTrack(level, rng = Math.random, debug = false) {
        const routes = Route.forField(level, 1, rng);
        if (debug) {
            Route.drawDebug([{ points: routes[0] }]);
        }
        return routes[0];
    }

    /**
     * Overlay debugowy: zaznacza punkty Tras na aktywnej warstwie paper.js.
     * Każda Trasa rysowana kolorem kasku swojego Komputera — linia jest
     * tożsama z graczem (ADR-0004). Bez paper.js no-op.
     *
     * @param {Array<{points:Array<{x:number,y:number}>, color?:string}>} routes
     *   Trasa + kolor gracza (brak koloru → kolor bazy)
     */
    static drawDebug(routes) {
        drawDebugOverlay(routes);
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
 * Pierwszy punkt startowy toru (Level.startPoints[0]) albo null, gdy tor
   go nie deklaruje (stuby w testach mają tylko .vertices).
 */
function firstStartPoint(level) {
    const starts = level && level.startPoints;
    if (Array.isArray(starts) && starts.length > 0 && starts[0]) {
        return starts[0];
    }
    return null;
}

/**
 * Odwraca kolejność punktów pętli, gdy biegnie pod prąd względem kąta
 * startowego. Kąt jest w konwencji gry (0° = północ, rosnąco zgodnie
 * z zegarem), więc kierunek jazdy to (sin a, −cos a).
 *
 * Styczna pętli liczona jest w następnym punkcie (idx+1). Gdy jest ona
 * prostopadła do jazdy (iloczyn skalarny ≈ 0 — start leży na zakręcie
 * „poprzecznym" do stycznej), porównujemy w pierwszą stronę drugą
 * połowę łuku: sprzęgamy orientację z LOOPSZYM segmentem pętli (punkt
 * idx + quarterCount), gdzie styczna jest już przekątna względem prostej
 * startu. Gdy obie styczne są prostopadłe (teoretycznie: idealne
 * kółko z promieniem = 0) — TCP orientacja zostaje (rówie dobra).
 */
function orientLoopToStart(points, start) {
    if (!start || !Number.isFinite(start.angle) || !points || points.length < 2) {
        return;
    }
    const alongAt = (i) => {
        const a = points[i % points.length];
        const b = points[(i + 1) % points.length];
        const rad = start.angle * Math.PI / 180;
        return (b.x - a.x) * Math.sin(rad) + (b.y - a.y) * (-Math.cos(rad));
    };
    const idx = nearestPointIndex(points, start);
    let along = alongAt(idx);
    if (Math.abs(along) < 1e-6) {
        // styczna w starcie prostopadła do jazdy — decydować ma segment
        // ćwierć pętli dalej, gdzie styczna jest już przekątna
        along = alongAt(idx + Math.floor(points.length / 4));
    }
    if (along < 0) {
        points.reverse();
    }
}

/** Indeks punktu najbliższego pozycji (jak Route.startIndexFor). */
function nearestPointIndex(points, pos) {
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

/**
 * Kolor punktów Trasy w overlayu debugowym, gdy nikt po niej nie jedzie
 * (sama baza toru). Fiolet jest poza pulą kasków, więc nie da się pomylić
 * z linią gracza (ADR-0004).
 */
export const BASE_DEBUG_COLOR = '#8e24aa';

/**
 * Debug overlay: zaznacza punkty Tras na aktywnej warstwie paper.js —
 * każda Trasa kolorem kasku swojego Komputera, żeby linia była tożsama
 * z graczem (usuwa poprzedni overlay). Wywoływane tylko z debug=true —
 * normalny bieg nie rysuje nic (issue #1: "punktów nie rysujemy").
 *
 * @param {Array<{points:Array<{x:number,y:number}>, color?:string}>} routes
 */
function drawDebugOverlay(routes) {
    if (typeof paper === 'undefined' || !paper.project) {
        return;    // bez paper (np. testy) — overlay pomijamy
    }
    // usuń poprzedni overlay Tras, jeśli był
    paper.project.activeLayer.children
        .filter(child => child.data && child.data.routeDebug)
        .forEach(child => child.remove());
    routes.forEach(route => {
        const color = route.color || BASE_DEBUG_COLOR;
        route.points.forEach(p => {
            const dot = new paper.Path.Circle(new paper.Point(p.x, p.y), 2.5);
            dot.strokeColor = color;
            dot.fillColor = color;
            dot.data.routeDebug = true;
            paper.project.activeLayer.addChild(dot);
        });
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
 * Losuje pozycję w pasie (0 = skraj wewnętrzny, 1 = skraj zewnętrzny) dla
 * każdego z `count` Komputerów. Pas dzielony jest na `count` warstw o
 * **równym prawdopodobieństwie** rozkładu liniowego malejącego w stronę
 * zewnętrzną (gęstość ∝ 1 − t), warstwy tasowane, a komputer trafia w środek
 * swojej warstwy z jitterem do ±1/4 jej szerokości — linie są więc
 * gwarantowanie rozdzielone, a większość stawki jedzie po wewnętrznej
 * (ADR-0003). Dla count = 1 losujemy z całego pasa tym samym rozkładem.
 *
 * @param {number} count liczba Komputerów
 * @param {function} rng generator [0,1)
 * @returns {number[]} pozycja w pasie per komputer, w podanej kolejności
 */
function stratifiedLanes(count, rng) {
    if (count === 1) {
        return [laneFromProbability(rng())];
    }
    const strata = [];
    for (let i = 0; i < count; i++) {
        strata.push(i);
    }
    // tasowanie warstw (Fisher–Yates na przekazanym rng — determinizm testów)
    for (let i = strata.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [strata[i], strata[j]] = [strata[j], strata[i]];
    }
    const width = 1 / count;
    const jitter = width / 4;
    return strata.map(stratum => {
        const probability = (stratum + 0.5) * width + (2 * rng() - 1) * jitter;
        return laneFromProbability(probability);
    });
}

/**
 * Odwrotna dystrybuanta rozkładu liniowego o gęstości ∝ (1 − t) na [0, 1]:
 * F(t) = 2t − t², więc t = 1 − √(1 − u). u = 0 → skraj wewnętrzny,
 * u = 1 → skraj zewnętrzny.
 */
function laneFromProbability(u) {
    const clamped = Math.min(1, Math.max(0, u));
    return 1 - Math.sqrt(1 - clamped);
}

/**
 * Która strona lokalnej normalnej prowadzi do wnętrza pętli Trasy (czyli do
 * infieldu — strony wewnętrznej toru). Trasa otacza infield, więc wystarczy
 * punkt-w-wielokącie na punkcie odsuniętym o ~0.5 px wzdłuż ±normalnej.
 * Przypadki niejednoznaczne (bardzo wąskie szyjki, pętle przecinające się)
 * dostają znak większościowy.
 *
 * @param {Array<{x:number,y:number}>} points pętla Trasy
 * @returns {number[]} +1/−1 per punkt: kierunek normalnej do wnętrza
 */
function innerSigns(points) {
    const PROBE = 0.5;
    const signs = points.map((p, i) => {
        const n = normalAt(points, i);
        const plus = pointInPolygon(p.x + n.x * PROBE, p.y + n.y * PROBE, points);
        const minus = pointInPolygon(p.x - n.x * PROBE, p.y - n.y * PROBE, points);
        if (plus === minus) {
            return 0;
        }
        return plus ? 1 : -1;
    });
    const known = signs.filter(sign => sign !== 0);
    const majority = known.reduce((sum, sign) => sum + sign, 0) >= 0 ? 1 : -1;
    return signs.map(sign => sign || majority);
}

/** Jednostkowa normalna Trasy w punkcie i (z prostej przez sąsiadów). */
function normalAt(points, i) {
    const a = points[(i - 1 + points.length) % points.length];
    const b = points[(i + 1) % points.length];
    const tx = b.x - a.x;
    const ty = b.y - a.y;
    const tlen = Math.hypot(tx, ty) || 1;
    return { x: -ty / tlen, y: tx / tlen };
}

/** Czy punkt leży wewnątrz zamkniętego wielokąta (ray casting). */
function pointInPolygon(x, y, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const pi = polygon[i];
        const pj = polygon[j];
        const crosses = (pi.y > y) !== (pj.y > y);
        if (crosses && x < (pj.x - pi.x) * (y - pi.y) / (pj.y - pi.y) + pi.x) {
            inside = !inside;
        }
    }
    return inside;
}

/**
 * Przesuwa punkty Trasy wzdłuż lokalnej normalnej w stronę wnętrza pętli.
 * `lane` ∈ [0, 1] to pozycja w pasie (0 = skraj wewnętrzny, 1 = skraj
 * zewnętrzny) mapowana na offset: wewnątrz do `MAX_OFFSET_IN` dystansu do
 * najbliższej ściany, na zewnątrz do `MAX_OFFSET_OUT` (ADR-0003). Offset
 * korzysta z mniejszego dystansu do ścian (promienie w ±normalnej), więc
 * Trasa zostaje w bezpiecznym marginesie niezależnie od strony.
 */
function applyLateralOffset(points, segments, signs, lane) {
    const amount = Route.MAX_OFFSET_IN - lane * (Route.MAX_OFFSET_IN + Route.MAX_OFFSET_OUT);
    if (amount === 0) {
        return points;
    }
    return points.map((p, i) => {
        const n = normalAt(points, i);
        const inward = { x: n.x * signs[i], y: n.y * signs[i] };

        // dystans do najbliższej ściany (promienie w ±normalnej skanują
        // oba kierunki; zerowy dystans → brak luzu)
        const room = wallDistance(p, inward, segments);
        if (room <= 0 || room === Infinity) {
            return p;
        }
        const shift = amount * room;
        return { x: p.x + inward.x * shift, y: p.y + inward.y * shift };
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