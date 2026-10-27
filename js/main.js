import Game from "./game.js";
import TrackSelector from "./trackSelector.js";

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
        this.initPaper();
        this.initTrackSelector();
        this.initRaceOverlays();
        this.start();
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

        document.querySelector('button.to-menu').addEventListener('click', () => {
            this.backToMenu();
        });
    }

    start() {
        //this.restart(this.trackSelector.getDefaultTrack());
        document.querySelector('button.start').addEventListener('click', e => {
            this.restart(this.trackSelector.getSelectedTrack());
        });
    }

    async backToMenu() {
        this.hideOverlays();

        document.removeEventListener('keydown', this.raceKeyHandler);

        if (this.game) {
            view.remove();
            await this.game.stop();
            this.game = null;
        }

        // the full-size container blocks clicks over the stage, so hide/show it, not just .menu
        document.querySelector('.menu-container').classList.remove('hidden');
    }

    hideOverlays() {
        this.countdownOverlay.classList.remove('green');
        this.countdownOverlay.classList.add('hidden');
        this.raceResultOverlay.classList.add('hidden');
        this.falstartOverlay.classList.add('hidden');
        this.lapBanner.classList.add('hidden');
        // a stale GO timeout would otherwise flip overlays after we left the race
        window.clearTimeout(this.goTimeout);
    }

    async restart(track) {
        if (!track) {
            throw new Error("Invalid argument");
        }

        if (this.game) {
            //project.clear();
            view.remove();
            this.game.stop();
        }

        let options = {
            playersCount: document.querySelector('input[name=playersCount]:checked').value
        }

        this.game = new Game(options);
        this.game.init();

        //TODO: Refactor. Reacting to change level event?
        let background = await this.game.loadLevel('tracks/' + track + '.svg');
        document.querySelector('.stage').style.background = background;

        this.hideOverlays();

        this.game.addEventListener('countdown', () => {
            this.hideOverlays();
            this.goLabel.classList.add('hidden');
            this.countdownOverlay.classList.remove('hidden');
        });

        this.game.addEventListener('go', () => {
            // 'green' belongs on .countdown: CSS matches div.stage .countdown.green .light
            this.countdownOverlay.classList.add('green');
            this.goLabel.classList.remove('hidden');
            this.goTimeout = window.setTimeout(() => {
                this.countdownOverlay.classList.add('hidden');
                this.lapBanner.classList.remove('hidden');
                this.lapBanner.textContent = 'Okrążenie 1/' + this.game.options.laps;
            }, 700);
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
        });

        this.game.addEventListener('playerfinished', player => {
            if (this.game.players.some(p => !p.finished)) {
                this.lapBanner.textContent = 'Meta!';
            }
        });

        this.game.addEventListener('racefinished', ranking => {
            this.lapBanner.classList.add('hidden');
            this.showResults(ranking);
        });

        // restart (R/1/2/3 keys) re-enters this method; drop the previous handler first
        let previousKeyHandler = this.raceKeyHandler;
        this.raceKeyHandler = e => {
            if (!this.game) {
                return;
            }

            if (e.key === 'Escape') {
                this.backToMenu();
                return;
            }

            if (e.key === 'Enter' && this.game.state === 'results') {
                this.backToMenu();
            }
        };

        if (previousKeyHandler) {
            document.removeEventListener('keydown', previousKeyHandler);
        }
        document.addEventListener('keydown', this.raceKeyHandler);


        // hide menu (the full-size container intercepts clicks over the stage)
        document.querySelector('.menu-container').classList.add('hidden');
        this.game.start();
    }

    showResults(ranking) {
        let tbody = this.raceResultOverlay.querySelector('tbody');
        tbody.innerHTML = '';

        ranking.forEach((entry, index) => {
            let row = document.createElement('tr');
            if (index === 0) {
                row.classList.add('pos-1');
            }

            row.innerHTML = `
                <td>${index + 1}.</td>
                <td>${entry.player.color}</td>
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