import { describe, it, expect, beforeEach } from 'vitest';
import StartReaction, { MODE_FACTORS } from '../js/startReaction.js';

/**
 * Magazyn w pamięci — podmiana localStorage w testach (Node, brak window).
 */
function memoryStorage() {
    const map = new Map();
    return {
        getItem: k => (map.has(k) ? map.get(k) : null),
        setItem: (k, v) => map.set(k, String(v)),
        removeItem: k => map.delete(k),
        _map: map
    };
}

describe('StartReaction — historia startów (spec decyzja #16)', () => {
    it('commit zapisuje próbki w localStorage (jeden profil)', () => {
        const storage = memoryStorage();
        const reaction = new StartReaction({ storage });
        reaction.commit([250]);
        expect(storage.getItem('zuzel-simple.starts')).toBe('[250]');
    });

    it('utrzymuje tylko ostatnie 10 próbek', () => {
        const reaction = new StartReaction({ storage: memoryStorage() });
        for (let i = 1; i <= 12; i += 1) {
            reaction.commit([i * 10]);
        }
        expect(reaction.getSamples()).toEqual([30, 40, 50, 60, 70, 80, 90, 100, 110, 120]);
    });

    it('2+ ludzi w biegu → zapis średniej jako jedna próbka', () => {
        const reaction = new StartReaction({ storage: memoryStorage() });
        reaction.commit([200, 300]);
        expect(reaction.getSamples()).toEqual([250]);
    });

    it('puste próbki (bieg samych Komputerów) — nie zapisuje nic', () => {
        const storage = memoryStorage();
        const reaction = new StartReaction({ storage });
        reaction.commit([]);
        expect(storage.getItem('zuzel-simple.starts')).toBeNull();
    });

    it('uszkodzony JSON w magazynie → traktuje jako brak historii', () => {
        const storage = memoryStorage();
        storage.setItem('zuzel-simple.starts', 'not-json{');
        const reaction = new StartReaction({ storage });
        expect(reaction.getSamples()).toEqual([]);
    });

    it('brak magazynu (np. testy w Node) — działa bez błędu', () => {
        const reaction = new StartReaction({ storage: null });
        expect(() => reaction.commit([200])).not.toThrow();
        expect(reaction.getSamples()).toEqual([]);
    });
});

describe('StartReaction — opóźnienie startu (mediana × czynnik + szum)', () => {
    it('mediana 200 ms × czynnik 0,75 (mode 1) → ok. 150 ms', () => {
        const reaction = new StartReaction({ storage: memoryStorage(), rng: () => 0.5 });
        for (let i = 0; i < 5; i += 1) {
            reaction.commit([200]);
        }
        expect(reaction.delayFor(1)).toBeCloseTo(150, 5);
    });

    it('czynniki osobowości: 0,75/0,9/1,1/1,3 dla mode 1–4', () => {
        expect(MODE_FACTORS[1]).toBe(0.75);
        expect(MODE_FACTORS[2]).toBe(0.9);
        expect(MODE_FACTORS[3]).toBe(1.1);
        expect(MODE_FACTORS[4]).toBe(1.3);
        const reaction = new StartReaction({ storage: memoryStorage(), rng: () => 0.5 });
        for (let i = 0; i < 5; i += 1) {
            reaction.commit([200]); // mediana 200
        }
        expect(reaction.delayFor(2)).toBeCloseTo(180, 5);
        expect(reaction.delayFor(3)).toBeCloseTo(220, 5);
        expect(reaction.delayFor(4)).toBeCloseTo(260, 5);
    });

    it('nieparzysta liczba próbek → mediana ze środka', () => {
        const reaction = new StartReaction({ storage: memoryStorage(), rng: () => 0.5 });
        [300, 100, 200, 400, 500].forEach(s => reaction.commit([s]));
        // mediana [100,200,300,400,500] = 300 → mode 1: 225
        expect(reaction.delayFor(1)).toBeCloseTo(225, 5);
    });

    it('szum ≤ 20 ms wokół mediana × czynnik', () => {
        let lo = Infinity;
        let hi = -Infinity;
        for (let v = 0; v < 1; v += 0.01) {
            const reaction = new StartReaction({ storage: memoryStorage(), rng: () => v });
            for (let i = 0; i < 5; i += 1) {
                reaction.commit([200]);
            }
            const d = reaction.delayFor(2); // 180 ± szum
            lo = Math.min(lo, d);
            hi = Math.max(hi, d);
        }
        expect(lo).toBeGreaterThanOrEqual(160);
        expect(hi).toBeLessThanOrEqual(200);
    });

    it('brak historii → opóźnienie 140–320 ms', () => {
        const reaction = new StartReaction({ storage: memoryStorage(), rng: () => 0 });
        expect(reaction.delayFor(1)).toBe(140);
        const reactionHi = new StartReaction({ storage: memoryStorage(), rng: () => 1 - 1e-12 });
        expect(reactionHi.delayFor(1)).toBeCloseTo(320, 3);
    });
});
