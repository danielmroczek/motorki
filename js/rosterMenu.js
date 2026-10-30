/**
 * Roster menu — jedna lista 4 slotów zamiast dwóch radio-grup
 * (Ludzie/Komputery). Każdy slot przełącza cyklem:
 *   pusty → człowiek → komputer → pusty…
 * Slotów jest 4, więc stawka nigdy nie przekracza 4 zawodników; pusty slot
 * = mniejsza stawka (zgodnie z pulą kolorów i Start na torze).
 * Kolor motocykla losowany jest na starcie biegu (taski kolorów w Game),
 * więc slot w menu nie obiecuje żadnego koloru.
 */

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
     * @param {{onchange?: function, storage?: Storage}} [options]
     */
    constructor(container, { onchange = null, storage = (typeof window !== 'undefined' ? window.sessionStorage : null) } = {}) {
        this.container = container;
        this.onchange = onchange;
        this.storage = storage;
        // domyślnie: 1 człowiek + 3 komputery = pełna stawka
        // (pula 4 kolorów i 4 punkty startowe toru)
        this.states = ['human', 'computer', 'computer', 'computer'];
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
     * Programatyczne ustawienie stawki (np. parę klawiszy 1/2/3 w biegu):
     * N ludzi, reszta 4 slotów = Komputery. Menu i magazyn od razu
     * odzwierciedlają nową stawkę, więc kolejna sesja przywróci to,
     * co było na starcie ostatniego biegu.
     *
     * @param {number} people liczba ludzi 0–4 (reszta → Komputery)
     */
    set(people) {
        const humans = Math.min(4, Math.max(0, people));
        this.states = Array.from({ length: 4 }, (_, i) =>
            i < humans ? 'human' : 'computer');
        this.save();
        this.render();
        if (this.onchange) {
            this.onchange(this.summary());
        }
    }

    render() {
        this.container.querySelectorAll('.slot').forEach(slot => {
            const idx = parseInt(slot.dataset.slot, 10);
            const state = this.states[idx];
            const icon = slot.querySelector('.slot-icon');
            slot.dataset.state = state;
            if (state === 'human') {
                icon.className = 'slot-icon fas fa-male';
                slot.title = 'Człowiek';
            } else if (state === 'computer') {
                icon.className = 'slot-icon fas fa-robot';
                slot.title = 'Komputer';
            } else {
                icon.className = 'slot-icon';
                slot.title = 'Pusty slot';
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
