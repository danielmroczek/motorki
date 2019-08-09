import Game from "./game.js";
import TrackSelector from "./trackSelector.js";

window.addEventListener('load', () => {
    let app = new App();
    app.init();
});

class App {
    constructor() {
        // Nothing to do
    }

    init() {
        this.initPaper();
        this.initTrackSelector();
        this.start();
    }

    initPaper() {
        paper.install(window);
        paper.settings.insertItems = false;
    }

    initTrackSelector() {
        this.trackSelector = new TrackSelector(this);
        this.trackSelector.init();
        this.trackSelector.addEventListener("change", track => {
            this.restart(track);
        })
    }

    start() {
        this.restart(this.trackSelector.getDefaultTrack());
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
        this.game = new Game();
        this.game.init();

        //TODO: Refactor. Reacting to change level event?
        let background = await this.game.loadLevel('tracks/' + track + '.svg');
        document.body.style.background = background;
        this.game.start();
    }
}