import Game from "./game.js";
import TrackSelector from "./trackSelector.js";
import Route from "./route.js";
import RosterMenu from "./rosterMenu.js";
import StartSound from "./startSound.js";
import { STAGE } from "./startSequence.js";
import { HELMET_HEX } from "./lineup.js";

window.addEventListener('load', () => {
    let app = new App();
    app.init();
});

class App {
    constructor() {
        // Nothing to do
        if (document.location.hash == '#atwork') {
            document.querySelector('.logo').style.visibility = 'hidden';
            document.querySelector('.trackpreview').style.visibility= 'hidden';
            document.querySelector('.stage').style.visibility= 'hidden';
        } 
    }

    init() {
        // ?debug=true — podgląd Tras Komputerów na torze
        this.debugRoutes = new URLSearchParams(window.location.search).get('debug') === 'true';
        this.initPaper();
        this.initRoster();
        this.initTrackSelector();
        this.initRaceOverlays();
        this.initShortcuts();
        this.start();
    }

    /**
     * Reguła UX: Enter uruchamia widoczny przycisk primary (zielony),
     * Esc — widoczny secondary (stłumiony); bez secondary Esc opuszcza bieg.
     */
    initShortcuts() {
        document.addEventListener('keydown', e => {
            if (e.repeat) {
                return;
            }

            if (e.key === 'Enter') {
                // natywnie tylko gdy fokus jest już na primary; w przeciwnym
                // razie (np. po kliknięciu slotu rostera) Enter startuje grę
                const active = document.activeElement;
                if (active instanceof HTMLButtonElement && active.classList.contains('primary')) {
                    return;
                }
                this.activateButton('.primary');
            } else if (e.key === 'Escape') {
                if (!this.activateButton('.secondary') && this.game) {
                    this.backToMenu();
                }
            }
        });
    }

    /** Klika pierwszy widoczny przycisk pasujący do selektora. */
    activateButton(selector) {
        let button = Array.from(document.querySelectorAll(`button${selector}`))
            .find(candidate => candidate.getClientRects().length > 0);
        if (!button) {
            return false;
        }
        button.click();
        return true;
    }

    initRoster() {
        this.rosterMenu = new RosterMenu(
            document.querySelector('.roster'));
    }

    initPaper() {
        paper.install(window);
        paper.settings.insertItems = false;
    }

    initTrackSelector() {
        this.trackSelector = new TrackSelector(this);
        this.trackSelector.addEventListener("change", track => {
            // this.restart(track);
            document.querySelector(".trackpreview").src = 'tracks/' + track + '.svg';
        })
        this.trackSelector.init();
    }

    initRaceOverlays() {
        this.countdownOverlay = document.querySelector('.countdown');
        this.goLabel = this.countdownOverlay.querySelector('.go');
        this.lapBanner = document.querySelector('.lap-banner');
        this.falstartOverlay = document.querySelector('.falstart');
        this.raceResultOverlay = document.querySelector('.race-result');

        this.lineupBoard = document.querySelector('.lineup-board');
        this.lineupList = this.lineupBoard.querySelector('.lineup-list');
        this.lineupTrack = this.lineupBoard.querySelector('.lineup-track');
        this.legend = document.querySelector('.hud-legend');
        this.legendList = this.legend.querySelector('.legend-list');
        this.lineupEntries = [];

        document.querySelector('button.to-menu').addEventListener('click', () => {
            this.backToMenu();
        });
        document.querySelector('button.replay').addEventListener('click', () => {
            if (this.game && this.game.state === 'results') {
                this.game.restart();
            }
        });
    }

    start() {
        //this.restart(this.trackSelector.getDefaultTrack());
        document.querySelector('button.start').addEventListener('click', e => {
            // gest użytkownika — jedyny moment, w którym wolno odblokować audio
            this.startSound = this.startSound || new StartSound();
            this.startSound.unlock();
            this.restart(this.trackSelector.getSelectedTrack());
        });
    }

    async backToMenu() {
        this.hideOverlays();

        if (this.game) {
            view.remove();
            await this.game.stop();
            this.game = null;
        }

        // the full-size container blocks clicks over the stage, so hide/show it, not just .menu
        document.querySelector('.menu-container').classList.remove('hidden');
    }

    hideOverlays() {
        this.countdownOverlay.classList.remove('green', 'stage-1', 'stage-2');
        this.countdownOverlay.classList.add('hidden');
        this.raceResultOverlay.classList.add('hidden');
        this.falstartOverlay.classList.add('hidden');
        this.lapBanner.classList.add('hidden');
        this.lineupBoard.classList.add('hidden');
        this.legend.classList.add('hidden');
        this.clearLineupTimers();
        // a stale GO timeout would otherwise flip overlays after we left the race
        window.clearTimeout(this.goTimeout);
    }

    clearLineupTimers() {
        window.clearTimeout(this.lineupTimeout);
        if (this.lineupSkipHandler) {
            document.removeEventListener('keydown', this.lineupSkipHandler);
            this.lineupSkipHandler = null;
        }
    }

    /**
     * Plansza startowa: kolejność pól, kolor, nazwa i klawisze — każdy
     * wie, kim jest i skąd startuje, zanim zgasną światła (ADR-0002).
     */
    showLineup(entries) {
        this.lineupEntries = entries;

        this.lineupList.innerHTML = '';
        entries.forEach(entry => {
            let li = document.createElement('li');
            li.style.setProperty('--helmet', HELMET_HEX[entry.color]);
            if (entry.computer) {
                li.classList.add('is-computer');
            }
            li.innerHTML = `
                <span class="pole">Pole ${entry.pole}</span>
                <span class="chip"></span>
                <span class="name">${entry.name}</span>
                <span class="keys">${entry.controls ? entry.controls.label : 'komputer'}</span>
            `;
            this.lineupList.appendChild(li);
        });

        this.lineupTrack.textContent = this.trackSelector.getSelectedTrack() || '';
        this.lineupBoard.classList.remove('hidden');

        this.clearLineupTimers();
        // plansza jest pomijalna i nie nalicza falstartu
        this.lineupTimeout = window.setTimeout(() => this.beginCountdown(), App.LINEUP_MS);
        this.lineupSkipHandler = e => {
            if (e.code === 'Enter' || e.code === 'Space') {
                this.beginCountdown();
            }
        };
        document.addEventListener('keydown', this.lineupSkipHandler);
    }

    beginCountdown() {
        if (!this.game || this.game.state !== 'lineup') {
            this.clearLineupTimers();
            return;
        }
        this.clearLineupTimers();
        this.lineupBoard.classList.add('hidden');
        this.game.proceed();
    }

    /** Legenda widoczna w odliczaniu i na 1. okrążeniu (H przełącza). */
    showLegend() {
        if (!this.lineupEntries.some(entry => !entry.computer)) {
            // podgląd samych komputerów — nie ma kogo identyfikować
            return;
        }

        this.legendList.innerHTML = '';
        this.lineupEntries.forEach(entry => {
            let li = document.createElement('li');
            li.style.setProperty('--helmet', HELMET_HEX[entry.color]);
            if (entry.computer) {
                li.classList.add('is-computer');
            }
            li.innerHTML = `
                <span class="chip"></span>
                <span class="name">${entry.name}</span>
                ${entry.controls ? `<span class="keys">${entry.controls.label}</span>` : ''}
            `;
            this.legendList.appendChild(li);
        });
        this.legend.classList.remove('hidden');
        if (this.game) {
            this.game.setMarkersVisible(true);
        }
    }

    hideLegend() {
        this.legend.classList.add('hidden');
        if (this.game) {
            this.game.setMarkersVisible(false);
        }
    }

    toggleLegend() {
        if (this.legend.classList.contains('hidden')) {
            this.showLegend();
        } else {
            this.hideLegend();
        }
    }

    async restart(track) {
        if (!track) {
            throw new Error("Invalid argument");
        }

        // stawka: wpisy w kolejności slotów (kolor stały w sesji, klawisze
        // przypisane do kolejności ludzi) — Game nie tasuje już kolorów
        let slots = this.rosterMenu.entries();

        if (this.game) {
            //project.clear();
            view.remove();
            this.game.stop();
        }

        let options = {
            playersCount: slots.filter(entry => !entry.computer).length,
            computersCount: slots.filter(entry => entry.computer).length,
            slots: slots
        }

        this.game = new Game(options);
        this.game.init();

        // ?debug=true — uchwyt do instancji gry dla inspekcji z konsoli
        if (new URLSearchParams(window.location.search).get('debug') === 'true') {
            window.game = this.game;
        }

        //TODO: Refactor. Reacting to change level event?
        let background = await this.game.loadLevel('tracks/' + track + '.svg');
        document.querySelector('.stage').style.background = background;

        // ?debug=true — podglądowy overlay Tras (przed startem: sama baza)
        if (this.debugRoutes) {
            this.showRouteDebug();
        }

        this.hideOverlays();

        this.game.addEventListener('lineup', entries => {
            this.hideOverlays();
            this.showLineup(entries);
            if (this.debugRoutes) {
                // stawka gotowa — pokaż faktyczne Trasy Komputerów
                this.showRouteDebug();
            }
        });

        this.game.addEventListener('countdown', () => {
            this.hideOverlays();
            this.goLabel.classList.remove('hidden');
            this.goLabel.textContent = '';
            this.countdownOverlay.classList.remove('hidden');
            this.showLegend();
        });

        this.game.addEventListener('countdownstage', ({ stage }) => {
            this.applyCountdownStage(stage);
            if (this.startSound) {
                this.startSound.play(stage);
            }
        });

        this.game.addEventListener('go', () => {
            // 'green' należy do .countdown — CSS: div.stage .countdown.green .light
            this.goTimeout = window.setTimeout(() => {
                this.countdownOverlay.classList.add('hidden');
                this.lapBanner.classList.remove('hidden');
                this.lapBanner.textContent = 'Okrążenie 1/' + this.game.options.laps;
            }, 700);
        });

        this.game.addEventListener('legendtoggle', () => {
            this.toggleLegend();
        });

        this.game.addEventListener('falstart', () => {
            this.falstartOverlay.classList.remove('hidden');
            window.clearTimeout(this.falstartTimeout);
            this.falstartTimeout = window.setTimeout(() => {
                this.falstartOverlay.classList.add('hidden');
            }, 1500);
        });

        this.game.addEventListener('lapcompleted', data => {
            // banner tracks the CURRENT lap: completing lap N puts the rider on lap N+1
            this.lapBanner.textContent = `Okrążenie ${data.lap + 1}/${this.game.options.laps}`;
            this.lapBanner.classList.remove('hidden');
            if (data.lap >= 1 && this.game.humanPlayers.every(player => player.lapTimes.length >= 1)) {
                // 1. okrążenie zamknięte przez wszystkich ludzi — koniec identyfikacji
                this.hideLegend();
            }
        });

        this.game.addEventListener('playerfinished', player => {
            if (this.game.players.some(p => !p.finished)) {
                this.lapBanner.textContent = 'Meta!';
            }
        });

        this.game.addEventListener('racefinished', ranking => {
            this.lapBanner.classList.add('hidden');
            this.hideLegend();
            this.showResults(ranking);
        });


        // hide menu (the full-size container intercepts clicks over the stage)
        document.querySelector('.menu-container').classList.add('hidden');
        this.game.start();
    }

    /**
     * Etapy startu: czerwone lampki → pomarańczowe → zielone.
     * Ten sam element `.go` niesie podpis etapu.
     */
    applyCountdownStage(stage) {
        this.countdownOverlay.classList.remove('stage-1', 'stage-2', 'green');

        if (stage === STAGE.PREPARE) {
            this.countdownOverlay.classList.add('stage-1');
            this.goLabel.textContent = 'Ready';
        } else if (stage === STAGE.READY) {
            this.countdownOverlay.classList.add('stage-2');
            this.goLabel.textContent = 'Set';
        } else if (stage === STAGE.START) {
            this.countdownOverlay.classList.add('green');
            this.goLabel.textContent = 'Go!';
        }
    }

    /**
     * Rysuje punkty Tras Komputerów na warstwie players (na wierzchu toru) —
     * podgląd linii, po których faktycznie jadą boty (ADR-0003).
     * Rysowanie należy do Route (`Route.drawDebug`); tutaj tylko
     * aktywujemy właściwą warstwę, bo Route dodaje kropki do warstwy
     * aktywnej, a aplikacja ustawia insertItems = false.
     */
    showRouteDebug() {
        const playersLayer = this.game.layers.players;
        const previouslyActive = project.activeLayer;
        playersLayer.activate();
        // kolor linii bierzemy od gracza (właściciela koloru kasku), a nie
        // od Mózgu — overlay jest debugiem, nie częścią logiki decyzyjnej
        const routes = this.game.players
            .filter(player => player.computer)
            .map(player => ({ player, brain: this.game.brainByPlayer.get(player) }))
            .filter(({ brain }) => brain && brain.route)
            .map(({ player, brain }) => ({ points: brain.route, color: player.helmetColor }));
        if (routes.length > 0) {
            Route.drawDebug(routes);
        } else {
            // brak Komputerów w stawce — pokaż samą bazę (środkową linię)
            Route.drawDebug([{ points: Route.baseLoop(this.game.level) }]);
        }
        // paper.js nie pozwala przypisać project.activeLayer bezpośrednio
        previouslyActive.activate();
    }

    showResults(ranking) {
        let tbody = this.raceResultOverlay.querySelector('tbody');
        tbody.innerHTML = '';

        ranking.forEach((entry, index) => {
            let row = document.createElement('tr');
            if (index === 0) {
                row.classList.add('pos-1');
            }

            let player = entry.player;
            let keys = player.keySet
                ? `<span class="keys">${player.keySet.label}</span>`
                : '';

            row.innerHTML = `
                <td>${index + 1}.</td>
                <td><span class="chip" style="--helmet: ${HELMET_HEX[player.color]}"></span>
                    ${player.name || player.color}${keys}</td>
                <td>${(entry.total / 1000).toFixed(2)} s</td>
                <td>${(entry.best / 1000).toFixed(2)} s</td>
                <td>${entry.penaltyMs > 0 ? `+${entry.penaltyMs / 1000} s` : '-'}</td>
            `;

            tbody.appendChild(row);
        });

        this.countdownOverlay.classList.add('hidden');
        this.raceResultOverlay.classList.remove('hidden');
        this.raceResultOverlay.focus();
    }
}

/** Czas planszy startowej przed odliczaniem (pomijalnej). */
App.LINEUP_MS = 3000;