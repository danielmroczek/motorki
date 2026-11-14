/**
 * Lineup — tożsamość zawodników w biegu: kolor kasku przypisany do slotu
 * rostera (stały w sesji), zestawy klawiszy ludzi oraz wpisy stawki
 * w kolejności slotów.
 *
 * Kolor jest losowany raz na wejście na stronę i trzymany w sessionStorage,
 * więc `R` (restart biegu) nie zmienia tym, kim jest gracz (ADR-0002).
 * Klawisze przypisane są do POZYCJI SLOTU (slot 1 → strzałki, slot 2 → A/S,
 * slot 3 → K/L, slot 4 → Num 4/6), więc obsadzenie samego slotu 3 daje `K/L`
 * — wybór slotu jest jednocześnie wyborem sterowania.
 */

/** Pula kolorów kasków (kolejność bazowa przed tasowaniem). */
export const COLORS = ['red', 'white', 'yellow', 'blue'];

/** Polskie nazwy kolorów — tożsamość człowieka w HUD i wynikach. */
export const COLOR_LABELS = {
    red: 'Czerwony',
    white: 'Biały',
    yellow: 'Żółty',
    blue: 'Niebieski'
};

/** Kolory kasków z SVG motocykli (znaczniki nad graczami). */
export const HELMET_HEX = {
    red: '#b71c1c',
    white: '#bdbdbd',
    yellow: '#f9a825',
    blue: '#3f51b5'
};

/**
 * Czy kolor kasku jest jasny — na takim tle tekst/ikona muszą być ciemne.
 * Jedno źródło tej reguły dla menu i znaczników (ADR-0002).
 *
 * @param {string} color
 * @returns {boolean}
 */
export function isLightHelmet(color) {
    return color === 'white' || color === 'yellow';
}

/**
 * Zestawy klawiszy ludzi — dopasowanie po `KeyboardEvent.code`, więc działa
 * niezależnie od układu klawiatury i stanu NumLock.
 *
 * Aliasy ergonomiczne (nie pokazywane w UI, tylko w dokumentacji):
 * - 1. zestaw: `ArrowDown` skręca w prawo (wygodniej pod palcami),
 * - 4. zestaw: `Numpad5` skręca w lewo, plus `,`/`.` dla laptopów bez numpada.
 */
export const CONTROL_SETS = [
    {
        label: '◄ ►',
        short: '◄►',
        left: ['ArrowLeft'],
        right: ['ArrowRight', 'ArrowDown']
    },
    { label: 'A / S', short: 'AS', left: ['KeyA'], right: ['KeyS'] },
    { label: 'K / L', short: 'KL', left: ['KeyK'], right: ['KeyL'] },
    {
        label: 'Num 4/6',
        short: '4 6',
        left: ['Numpad4', 'Numpad5', 'Comma'],
        right: ['Numpad6', 'Period']
    }
];

const STORAGE_KEY = 'zuzel-simple.colors';

/**
 * Losowa permutacja puli kolorów. `rng` wstrzykiwane w testach.
 *
 * @param {function(): number} rng
 * @returns {string[]} 4 kolory
 */
export function shuffleColors(rng = Math.random) {
    const colors = [...COLORS];
    for (let i = colors.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rng() * (i + 1));
        [colors[i], colors[j]] = [colors[j], colors[i]];
    }
    return colors;
}

function isColorList(value) {
    return Array.isArray(value) && value.length === COLORS.length &&
        COLORS.every(color => value.includes(color));
}

/**
 * Kolory slotów z magazynu sesji; przy braku/uszkodzeniu — nowe losowanie.
 *
 * @param {Storage} [storage]
 * @param {function(): number} [rng]
 * @returns {string[]} kolor per slot
 */
export function colorsForSession(storage, rng = Math.random) {
    if (storage) {
        try {
            const raw = storage.getItem(STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : null;
            if (isColorList(parsed)) {
                return parsed;
            }
        } catch (e) {
            // uszkodzony JSON — losujemy na nowo
        }
    }

    const colors = shuffleColors(rng);
    if (storage) {
        try {
            storage.setItem(STORAGE_KEY, JSON.stringify(colors));
        } catch (e) {
            // brak magazynu (private mode) — kolory zostają w pamięci
        }
    }
    return colors;
}

/**
 * Zestaw klawiszy przypisany do POZYCJI slotu (1 → 4), a nie do kolejności
 * ludzi: gracz na pozycji 3 zawsze ma `K/L`, nawet gdy sloty 1–2 są puste
 * albo zajęte przez Komputery. Dzięki temu wybór slotu = wybór sterowania
 * (ADR-0002).
 *
 * @param {number} slot indeks slotu 0–3
 * @returns {object|null}
 */
export function controlsFor(slot) {
    return CONTROL_SETS[slot] || null;
}

/**
 * Wpisy stawki w kolejności slotów — bez pustych slotów. Komputery
 * numerowane są w kolejności slotów („Komputer 1" to pierwszy slot-komputer).
 * Klawisze ludzi wynikają z pozycji slotu, nie z kolejności obsadzenia.
 *
 * @param {string[]} states '[empty'|'human'|'computer'] per slot
 * @param {string[]} colors kolor per slot
 * @returns {Array<{slot: number, state: string, color: string, name: string,
 *   computer?: boolean, controls?: object}>}
 */
export function buildEntries(states, colors) {
    let computers = 0;

    return states.reduce((entries, state, slot) => {
        if (state === 'empty') {
            return entries;
        }

        const color = colors[slot];

        if (state === 'human') {
            entries.push({
                slot,
                state,
                color,
                name: COLOR_LABELS[color],
                controls: controlsFor(slot)
            });
            return entries;
        }

        computers += 1;
        entries.push({
            slot,
            state,
            color,
            computer: true,
            name: `Komputer ${computers}`
        });
        return entries;
    }, []);
}

/**
 * Stawka dla samej liczby ludzi/komputerów (Game bez rostera, testy):
 * ludzie zajmują pierwsze sloty, komputery kolejne.
 *
 * @param {number} people
 * @param {number} computers
 * @param {string[]} [colors]
 * @returns {Array}
 */
export function entriesFromCounts(people, computers, colors = COLORS) {
    const states = [];
    for (let i = 0; i < people; i += 1) {
        states.push('human');
    }
    for (let i = 0; i < computers; i += 1) {
        states.push('computer');
    }
    while (states.length < COLORS.length) {
        states.push('empty');
    }
    return buildEntries(states, colors);
}
