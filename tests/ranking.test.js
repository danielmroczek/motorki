import { describe, it, expect } from 'vitest';
import Game from '../js/game.js';

/**
 * Atrapa zawodnika — tu interesuje nas wyłącznie klasyfikacja
 * (czasy okrążeń, kara, moment przekroczenia mety).
 */
function fakePlayer(name, lapTimes, penaltyMs = 0) {
    return {
        name,
        lapTimes: [...lapTimes],
        penaltyMs: 0 + penaltyMs,
        finished: false,
        finish() {
            this.finished = true;
        }
    };
}

/** Kończy bieg: każdy zawodnik przekracza metę po `elapsed` ms od zielonego. */
function finishRace(game, finishers) {
    let ranking = null;
    game.addEventListener('racefinished', entries => {
        ranking = entries;
    });

    finishers.forEach(({ player, elapsed }) => {
        game.raceElapsed = elapsed;
        game.playerFinished(player);
    });

    return ranking;
}

describe('Ranking — czas biegu od zielonego światła', () => {
    it('późny start przeważa nad lepszymi okrążeniami', () => {
        const game = new Game({ laps: 4 });

        const quickButLate = fakePlayer('Szybki ale późno', [4000, 4000, 4000, 4000]);
        const slowerButEarlier = fakePlayer('Wolniejszy ale wcześniej', [5000, 5000, 5000, 5000]);
        game.players = [quickButLate, slowerButEarlier];

        const ranking = finishRace(game, [
            { player: quickButLate, elapsed: 22000 },
            { player: slowerButEarlier, elapsed: 21000 }
        ]);

        expect(ranking.map(entry => entry.player.name)).toEqual([
            'Wolniejszy ale wcześniej',
            'Szybki ale późno'
        ]);
        expect(ranking.map(entry => entry.total)).toEqual([21000, 22000]);
        // najlepsze okrążenie nadal liczone z okrążeń
        expect(ranking[1].best).toBe(4000);
    });

    it('kara falstartu dolicza się do czasu biegu', () => {
        const game = new Game({ laps: 4 });

        const penalized = fakePlayer('Z karą', [4000, 4000, 4000, 4000], 2000);
        const clean = fakePlayer('Bez kary', [4500, 4500, 4500, 4500]);
        game.players = [penalized, clean];

        const ranking = finishRace(game, [
            { player: penalized, elapsed: 10000 },
            { player: clean, elapsed: 11000 }
        ]);

        expect(ranking.map(entry => entry.player.name)).toEqual(['Bez kary', 'Z karą']);
        expect(ranking[1].total).toBe(12000);
        expect(ranking[1].penaltyMs).toBe(2000);
    });
});
