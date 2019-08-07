import Game from "./game.js";
import trackSelector from "./trackSelector.js";

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
        this.trackSelector = new trackSelector(this);
        this.trackSelector.init();
    }

    start() {
        this.restart();
    }

    async restart(track) {
        if (!track) {
            track = this.trackSelector.getDefaultTrack();
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