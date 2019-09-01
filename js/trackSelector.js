import EventEmitter from './eventEmitter.js';

export default class extends EventEmitter{
    constructor(app) {
        super();
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
        this.emit("change", this.getDefaultTrack());
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
            this.emit("change", e.target.value);
        });
    }

    getDefaultTrack() {
        return this.tracks[0];
    }

    getSelectedTrack() {
        return this.selector.options[this.selector.selectedIndex].value;
    }
}