/**
 * Roster menu — jedna lista 4 slotów zamiast dwóch radio-grup
 * (Ludzie/Komputery). Każdy slot przełącza cyklem:
 *   pusty → człowiek → komputer → pusty…
 * Slotów jest 4, więc stawka nigdy nie przekracza 4 zawodników; pusty slot
 * = mniejsza stawka (zgodnie z pulą kolorów i Start na torze).
 *
 * Slot ma stały kolor kasku na całą sesję (losowany raz na wejście na stronę),
 * więc menu pokazuje, kim gracz będzie — kolor i klawisze są widoczne przed
 * Startem (ADR-0002).
 */

import { buildEntries, colorsForSession, HELMET_HEX, isLightHelmet } from './lineup.js';

const STATES = ['empty', 'human', 'computer'];

/** Kolejność przełączenia slotu (cykl). */
const NEXT_STATE = {
    empty: 'human',
    human: 'computer',
    computer: 'empty'
};

export default class RosterMenu {
    /**
     * @param {HTMLElement} container element .roster z 4 przyciskami .slot
     * @param {{onchange?: function, storage?: Storage, rng?: function}} [options]
     */
    constructor(container, {
        onchange = null,
        storage = (typeof window !== 'undefined' ? window.sessionStorage : null),
        rng = Math.random
    } = {}) {
        this.container = container;
        this.onchange = onchange;
        this.storage = storage;
        // domyślnie: 1 człowiek + 3 komputery = pełna stawka
        // (pula 4 kolorów i 4 punkty startowe toru)
        this.states = ['human', 'computer', 'computer', 'computer'];
        // kolor per slot — stały w sesji (restart biegu go nie zmienia)
        this.colors = colorsForSession(storage, rng);
        this.restore();
        this.bind();
        this.render();
    }

    bind() {
        this.container.querySelectorAll('.slot').forEach(slot => {
            slot.addEventListener('click', () => {
                const idx = parseInt(slot.dataset.slot, 10);
                this.states[idx] = NEXT_STATE[this.states[idx]];
                this.save();
                this.render();
                if (this.onchange) {
                    this.onchange(this.summary());
                }
            });
        });
    }

    /**
     * Stawka w kolejności slotów (bez pustych) — wejście dla Game.
     * Zawiera kolor, nazwę i klawisze ludzi.
     *
     * @returns {Array}
     */
    entries() {
        return buildEntries(this.states, this.colors);
    }

    render() {
        const entries = this.entries();
        this.container.querySelectorAll('.slot').forEach(slot => {
            const idx = parseInt(slot.dataset.slot, 10);
            const state = this.states[idx];
            const color = this.colors[idx];
            const entry = entries.find(e => e.slot === idx);
            const icon = slot.querySelector('.slot-icon');
            slot.dataset.state = state;
            slot.dataset.color = color;
            slot.style.setProperty('--helmet', HELMET_HEX[color]);
            // na jasnym tle (biały/żółty kask) ikona i napis muszą być ciemne
            slot.dataset.text = isLightHelmet(color) ? 'dark' : 'light';

            let keys = slot.querySelector('.slot-keys');
            if (!keys) {
                keys = document.createElement('span');
                keys.className = 'slot-keys';
                slot.appendChild(keys);
            }

            if (state === 'human') {
                icon.className = 'slot-icon fas fa-male';
                keys.textContent = entry && entry.controls ? entry.controls.label : '';
                slot.title = `Człowiek — ${entry ? entry.name : color} — ${keys.textContent}`;
            } else if (state === 'computer') {
                icon.className = 'slot-icon fas fa-robot';
                keys.textContent = '';
                slot.title = `Komputer — ${entry ? entry.name : color}`;
            } else {
                icon.className = 'slot-icon';
                keys.textContent = '';
                slot.title = `Pusty slot — ${entry ? entry.name : color}`;
            }
        });
        this.container.dataset.summary = this.summaryString();
    }

    /** Liczba ludzi i komputerów dla Game options. */
    summary() {
        let people = 0;
        let computers = 0;
        this.states.forEach(s => {
            if (s === 'human') people += 1;
            if (s === 'computer') computers += 1;
        });
        return { people, computers };
    }

    /** „1+2" — skrótowa etykieta stawki (debug, aria, storage). */
    summaryString() {
        const { people, computers } = this.summary();
        return `${people}+${computers}`;
    }

    save() {
        if (!this.storage) {
            return;
        }
        try {
            this.storage.setItem(
                'zuzel-simple.roster', JSON.stringify(this.states));
        } catch (e) {
            // brak magazynu (private mode) — stan zostaje w pamięci
        }
    }

    restore() {
        if (!this.storage) {
            return;
        }
        try {
            const raw = this.storage.getItem('zuzel-simple.roster');
            const parsed = raw ? JSON.parse(raw) : null;
            if (Array.isArray(parsed) && parsed.length === 4 &&
                parsed.every(s => STATES.includes(s))) {
                this.states = parsed;
            }
        } catch (e) {
            // uszkodzony JSON — zostaje domyślna stawka
        }
    }
}
