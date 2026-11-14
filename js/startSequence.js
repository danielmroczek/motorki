/**
 * Harmonogram startu (3 etapy).
 *
 * Etap 1 (przygotowanie) i 2 (gotowość) mają stały czas; dopiero pauza
 * przed etapem 3 (start) jest losowa — jak w F1: lampki się palą,
 * a zielone zapala się po nieprzewidywalnej zwłoce.
 */

export const STAGE = {
    PREPARE: 'prepare',
    READY: 'ready',
    START: 'start'
};

/** Czas etapu 1 i 2 (ms). */
export const STAGE_MS = 1200;

/** Zakres losowej pauzy przed startem (ms). */
export const RANDOM_PAUSE_MIN = 800;
export const RANDOM_PAUSE_MAX = 2500;

/**
 * Zwraca harmonogram etapów startu: `[{stage, at}]`, rosnąco po `at`.
 *
 * @param {function} [rng] generator [0,1) (domyślnie Math.random)
 * @returns {{stage: string, at: number}[]}
 */
export function buildStartSchedule(rng = Math.random) {
    const pause = RANDOM_PAUSE_MIN + rng() * (RANDOM_PAUSE_MAX - RANDOM_PAUSE_MIN);

    return [
        { stage: STAGE.PREPARE, at: 0 },
        { stage: STAGE.READY, at: STAGE_MS },
        { stage: STAGE.START, at: STAGE_MS * 2 + pause }
    ];
}
