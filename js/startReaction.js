/**
 * Adaptacyjna reakcja startowa Komputera (spec decyzja #16, issue #3).
 *
 * Moduł czyta/zapisuje w `localStorage` ostatnie 10 próbek startów
 * człowieka. Próbka = czas pierwszego skrętu człowieka po GO (ms).
 * Próbki z falstartem są odrzucane **przed** zapisem (nie trafiają do
 * `commit`); przy 2+ ludziach w biegu zapisywana jest średnia z próbek
 * biegu.
 *
 * Opóźnienie startu Komputera = mediana historii × czynnik osobowości
 * (0,75 / 0,9 / 1,1 / 1,3 wg scatter-mode 1–4) + mały szum.
 * Bez historii → 140–320 ms.
 */

const STORAGE_KEY = 'zuzel-simple.starts';
const MAX_SAMPLES = 10;

/** Czynniki osobowości wg scatter-mode 1–4 (oryginał, fizyka.md §10). */
export const MODE_FACTORS = {
    1: 0.75,
    2: 0.9,
    3: 1.1,
    4: 1.3
};

/** Bez historii: opóźnienie startu z tego przedziału (ms). */
export const DEFAULT_REACTION_MIN = 140;
export const DEFAULT_REACTION_MAX = 320;

/** Połowa rozrzutu szumu wokół mediana × czynnik (ms). */
export const NOISE_HALF_SPREAD = 20;

export default class StartReaction {
    /**
     * @param {object} [options]
     * @param {Storage} [options.storage] magazyn (domyślnie localStorage;
     *   podmienialny w testach)
     * @param {function} [options.rng] generator [0,1) (domyślnie Math.random)
     * @param {number} [options.max] maksimum próbek utrzymywanych w magazynie
     */
    constructor({ storage = (typeof window !== 'undefined' ? window.localStorage : null), rng = Math.random, max = MAX_SAMPLES } = {}) {
        this.storage = storage;
        this.rng = rng;
        this.max = max;
    }

    /** Próbki (ms) z magazynu — najstarsze najpierw. */
    getSamples() {
        if (!this.storage) {
            return [];
        }
        try {
            const raw = this.storage.getItem(STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(parsed)) {
                return [];
            }
            return parsed.filter(n => typeof n === 'number' && isFinite(n) && n >= 0);
        } catch (e) {
            return [];
        }
    }

    /**
     * Zapis po biegu (spec decyzja #16): przyjmuje próbki biegu
     * (czas pierwszego skrętu po GO, ms), uśrednia przy 2+ ludziach
     * i dokładaje jedną próbkę do historii (ostatnie 10).
     *
     * @param {number[]} samples czasy pierwszych skrętów ludzi(po GO, ms)
     */
    commit(samples) {
        if (!this.storage || !Array.isArray(samples) || samples.length === 0) {
            return;
        }
        const next = this.getSamples().concat(averageOf(samples)).slice(-this.max);
        try {
            this.storage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch (e) {
            // magazyn niedostępny (private mode itd.) — ignorujemy
        }
    }

    /**
     * Opóźnienie startu Komputera o podanym scatter-mode (ms).
     *
     * @param {number} [mode] scatter-mode 1–4 (spec decyzja #15)
     * @returns {number} opóźnienie w ms
     */
    delayFor(mode = 1) {
        const samples = this.getSamples();

        if (samples.length === 0) {
            return DEFAULT_REACTION_MIN + this.rng() *
                (DEFAULT_REACTION_MAX - DEFAULT_REACTION_MIN);
        }

        const factor = MODE_FACTORS[mode] || MODE_FACTORS[1];
        const noise = (this.rng() - 0.5) * NOISE_HALF_SPREAD * 2;
        return Math.max(0, medianOf(samples) * factor + noise);
    }
}

function averageOf(values) {
    const sum = values.reduce((a, b) => a + b, 0);
    return sum / values.length;
}

function medianOf(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 1) {
        return sorted[mid];
    }
    return (sorted[mid - 1] + sorted[mid]) / 2;
}
