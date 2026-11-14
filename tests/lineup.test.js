import { describe, it, expect } from 'vitest';
import {
    COLORS,
    COLOR_LABELS,
    CONTROL_SETS,
    buildEntries,
    colorsForSession,
    controlsFor,
    entriesFromCounts,
    shuffleColors
} from '../js/lineup.js';

function fakeStorage(initial = {}) {
    const data = { ...initial };
    return {
        getItem: key => (key in data ? data[key] : null),
        setItem: (key, value) => { data[key] = String(value); }
    };
}

/** rng zwracające kolejno podane wartości (cyklicznie). */
function sequence(values) {
    let i = 0;
    return () => values[i++ % values.length];
}

describe('lineup: kolory sesji', () => {
    it('shuffleColors tasuje pełną pulę kolorów', () => {
        const colors = shuffleColors(sequence([0, 0, 0]));

        expect(colors).toHaveLength(COLORS.length);
        expect([...colors].sort()).toEqual([...COLORS].sort());
    });

    it('shuffleColors jest deterministyczne dla wstrzykniętego rng', () => {
        expect(shuffleColors(sequence([0.9, 0.1, 0.4])))
            .toEqual(shuffleColors(sequence([0.9, 0.1, 0.4])));
    });

    it('colorsForSession losuje raz i zapisuje w magazynie', () => {
        const storage = fakeStorage();
        const first = colorsForSession(storage, sequence([0.2, 0.7, 0.5]));

        expect([...first].sort()).toEqual([...COLORS].sort());
        // kolejne wejście na stronę nie losuje ponownie (ADR-0002)
        expect(colorsForSession(storage, sequence([0.9, 0.9, 0.9]))).toEqual(first);
    });

    it('colorsForSession odrzuca uszkodzony zapis i losuje na nowo', () => {
        const storage = fakeStorage({ 'zuzel-simple.colors': '["red","red"]' });
        const colors = colorsForSession(storage, sequence([0, 0, 0]));

        expect(colors).toHaveLength(COLORS.length);
        expect(new Set(colors).size).toBe(COLORS.length);
    });

    it('colorsForSession działa bez magazynu (private mode)', () => {
        const colors = colorsForSession(null, sequence([0.5]));

        expect(colors).toHaveLength(COLORS.length);
        expect(new Set(colors).size).toBe(COLORS.length);
    });
});

describe('lineup: klawisze', () => {
    it('slot 4 dostaje Numpad 4/6/5 z aliasem , .', () => {
        const controls = controlsFor(3);

        expect(controls.label).toBe('Num 4/6');
        expect(controls.left).toContain('Numpad4');
        expect(controls.left).toContain('Numpad5');
        expect(controls.right).toContain('Numpad6');
        expect(controls.left).toContain('Comma');
        expect(controls.right).toContain('Period');
    });

    it('slot 1 może skręcić w prawo też strzałką w dół', () => {
        expect(controlsFor(0).right).toContain('ArrowDown');
        // UI pokazuje tylko ◄ ► — alias jest wyłącznie w dokumentacji
        expect(controlsFor(0).label).toBe('◄ ►');
    });

    it('piąty człowiek nie ma zestawu klawiszy', () => {
        expect(controlsFor(4)).toBe(null);
    });

    it('zestawy klawiszy używają kodów (e.code), nie nazw z e.key', () => {
        const all = CONTROL_SETS.flatMap(set => [...set.left, ...set.right]);

        // NumLock zmienia e.key Numpad4 → Home, ale e.code zostaje Numpad4
        expect(all).not.toContain('Home');
        expect(all).not.toContain('PageDown');
        expect(all.every(code => /^[A-Z][A-Za-z0-9]+$/.test(code))).toBe(true);
    });
});

describe('lineup: wpisy stawki', () => {
    const colors = ['red', 'white', 'yellow', 'blue'];

    it('pomija puste sloty i zachowuje kolejność slotów', () => {
        const entries = buildEntries(
            ['human', 'empty', 'computer', 'human'], colors);

        expect(entries.map(e => e.slot)).toEqual([0, 2, 3]);
        expect(entries.map(e => e.color)).toEqual(['red', 'yellow', 'blue']);
    });

    it('klawisze wynikają z pozycji slotu, nie z kolejności ludzi', () => {
        const entries = buildEntries(
            ['empty', 'human', 'empty', 'human'], colors);
        const humans = entries.filter(e => !e.computer);

        // puste sloty nie przesuwają sterowania: slot 2 → A/S, slot 4 → Num 4/6
        expect(humans[0]).toMatchObject({ slot: 1 });
        expect(humans[0].controls.left).toEqual(['KeyA']);
        expect(humans[1]).toMatchObject({ slot: 3 });
        expect(humans[1].controls.label).toBe('Num 4/6');
    });

    it('gracz na pozycji 3 ma K/L, gdy sloty 1–2 są puste', () => {
        const entries = buildEntries(
            ['empty', 'empty', 'human', 'computer'], colors);

        expect(entries[0].controls.left).toEqual(['KeyK']);
        expect(entries[0].controls.right).toEqual(['KeyL']);
    });

    it('ludzie mają polską nazwę koloru, komputery numer w kolejności slotów', () => {
        const entries = buildEntries(
            ['computer', 'human', 'computer', 'empty'],
            ['blue', 'red', 'white', 'yellow']);

        expect(entries[0]).toMatchObject({ name: 'Komputer 1', computer: true });
        expect(entries[1]).toMatchObject({ name: COLOR_LABELS.red });
        expect(entries[1].computer).toBeUndefined();
        expect(entries[2]).toMatchObject({ name: 'Komputer 2' });
    });

    it('entriesFromCounts dopełnia puste sloty i mapuje kolory', () => {
        const entries = entriesFromCounts(2, 1);

        expect(entries).toHaveLength(3);
        expect(entries.filter(e => !e.computer)).toHaveLength(2);
        expect(entries[2]).toMatchObject({ state: 'computer', name: 'Komputer 1' });
    });
});
