/**
 * Tony startu syntezowane w WebAudio (bez sampli).
 *
 * Etapy 1–2 dzielą ten sam ton, start jest o kwintę wyżej. Moduł jest
 * cichy (no-op), gdy WebAudio jest niedostępne lub kontekst pozostaje
 * zawieszony przez politykę autoplay.
 */

import { STAGE } from './startSequence.js';

const STAGE_FREQUENCY = {
    [STAGE.PREPARE]: 440,
    [STAGE.READY]: 440,
    [STAGE.START]: 660
};

const VOLUME = 0.12;
const DURATION = 0.07;

export default class StartSound {
    constructor() {
        this.context = null;
    }

    /** Tworzy kontekst i próbuje go odblokować (wywoływane z gestu użytkownika). */
    unlock() {
        const context = this.ensureContext();
        if (context && context.state === 'suspended') {
            context.resume().catch(() => {});
        }
    }

    /**
     * Odtwarza ton przypisany do etapu startu.
     *
     * @param {string} stage nazwa etapu z startSequence
     */
    play(stage) {
        const frequency = STAGE_FREQUENCY[stage];
        const context = this.ensureContext();
        if (!frequency || !context) {
            return;
        }
        if (context.state === 'suspended') {
            context.resume().catch(() => {});
        }

        try {
            const now = context.currentTime;
            const oscillator = context.createOscillator();
            const gain = context.createGain();

            oscillator.type = 'square';
            oscillator.frequency.setValueAtTime(frequency, now);

            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.exponentialRampToValueAtTime(VOLUME, now + 0.005);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + DURATION);

            oscillator.connect(gain);
            gain.connect(context.destination);
            oscillator.start(now);
            oscillator.stop(now + DURATION);
        } catch (e) {
            // audio nie może przerwać pętli gry ani startu biegu
        }
    }

    ensureContext() {
        if (this.context) {
            return this.context;
        }
        const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!AudioContextClass) {
            return null;
        }
        try {
            this.context = new AudioContextClass();
        } catch (e) {
            // np. NotSupportedError — gra działa dalej bez dźwięku
            return null;
        }
        return this.context;
    }
}
