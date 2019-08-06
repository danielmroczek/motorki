import Game from "./game.js";

window.addEventListener('load', () => {
    paper.install(window);
    paper.settings.insertItems = false;

    let game;

    let tracks = [
        '294',
        'ataq',
        'berserker',
        'bydgoszcz',
        'byMateusz',
        'hamar'
    ];

    let sel = document.getElementById('trackList');
    tracks.forEach(track => {
        let opt = document.createElement('option');
        opt.innerHTML = track;
        opt.value = track;
        sel.appendChild(opt);
    });

    restart(tracks[0]);

    sel.addEventListener('change', e => {
        sel.blur();
        restart(e.target.value);
    });

    function restart(track) {
        if (game) {
            //project.clear();
            view.remove();
            game.stop();
        }
        game = new Game();
        let background = game.loadLevel('tracks/' + track + '.svg');
        document.body.style.background = background;
        game.start();
    }
});
