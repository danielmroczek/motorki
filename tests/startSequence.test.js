import { describe, it, expect } from 'vitest';
import { buildStartSchedule, STAGE, STAGE_MS, RANDOM_PAUSE_MIN, RANDOM_PAUSE_MAX } from '../js/startSequence.js';

describe('StartSequence — 3 etapy startu', () => {
    it('etapy 1–2 mają stały czas, etap 3 dokłada losową pauzę (rng = 0)', () => {
        const schedule = buildStartSchedule(() => 0);

        expect(schedule).toEqual([
            { stage: STAGE.PREPARE, at: 0 },
            { stage: STAGE.READY, at: STAGE_MS },
            { stage: STAGE.START, at: STAGE_MS * 2 + RANDOM_PAUSE_MIN }
        ]);
    });

    it('pauza przed startem mieści się w zakresie (rng dąży do 1)', () => {
        const schedule = buildStartSchedule(() => 0.999999);
        const startAt = schedule[2].at;

        expect(startAt).toBeGreaterThanOrEqual(STAGE_MS * 2 + RANDOM_PAUSE_MIN);
        expect(startAt).toBeLessThan(STAGE_MS * 2 + RANDOM_PAUSE_MAX);
    });

    it('start zawsze następuje po gotowości', () => {
        for (const value of [0, 0.1, 0.5, 0.9, 0.99]) {
            const schedule = buildStartSchedule(() => value);
            expect(schedule[0].stage).toBe(STAGE.PREPARE);
            expect(schedule[1].stage).toBe(STAGE.READY);
            expect(schedule[2].stage).toBe(STAGE.START);
            expect(schedule[0].at).toBeLessThan(schedule[1].at);
            expect(schedule[1].at).toBeLessThan(schedule[2].at);
        }
    });
});
