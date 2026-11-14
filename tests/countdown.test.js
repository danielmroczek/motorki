import { describe, it, expect } from 'vitest';
import Game from '../js/game.js';
import { STAGE, STAGE_MS, RANDOM_PAUSE_MIN } from '../js/startSequence.js';

describe('Game — sekwencja startu (3 etapy)', () => {
    it('emituje etapy po kolei i startuje po losowej pauzie', () => {
        const game = new Game({ rng: () => 0 });
        const stages = [];
        let started = false;

        game.addEventListener('countdownstage', ({ stage }) => stages.push(stage));
        game.addEventListener('go', () => {
            started = true;
        });

        game.beginCountdown();
        expect(stages).toEqual([STAGE.PREPARE]);

        game.tick(STAGE_MS);
        expect(stages).toEqual([STAGE.PREPARE, STAGE.READY]);
        expect(started).toBe(false);

        game.tick(STAGE_MS + RANDOM_PAUSE_MIN);
        expect(stages).toEqual([STAGE.PREPARE, STAGE.READY, STAGE.START]);
        expect(started).toBe(true);
        expect(game.state).toBe('racing');
        expect(game.raceElapsed).toBe(0);
    });

    it('skok czasu (np. po powrocie z innej karty) nie gubi etapów', () => {
        const game = new Game({ rng: () => 0 });
        const stages = [];

        game.addEventListener('countdownstage', ({ stage }) => stages.push(stage));
        game.beginCountdown();

        game.countdownElapsed = STAGE_MS * 2 + RANDOM_PAUSE_MIN;
        game.tick(0);

        expect(stages).toEqual([STAGE.PREPARE, STAGE.READY, STAGE.START]);
        expect(game.state).toBe('racing');
    });
});
