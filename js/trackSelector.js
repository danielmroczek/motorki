export default class {
    constructor(app) {
        this.app = app;
        this.selector = document.getElementById('trackList');
        this.tracks = [
            '294',
            'ataq',
            'berserker',
            'bydgoszcz',
            'byMateusz',
            'hamar'
        ];
    }

    init() {
        this.populateTrackSelector();
        this.addHooks();
    }

    populateTrackSelector() { 
        this.tracks.forEach(track => {
            let opt = document.createElement('option');
            opt.innerHTML = track;
            opt.value = track;
            this.selector.appendChild(opt);
        });
    }

    addHooks() {
        this.selector.addEventListener('change', e => {
            this.selector.blur();
            this.app.restart(e.target.value);
        });
    }

    getDefaultTrack() {
        return this.tracks[0];
    }
}