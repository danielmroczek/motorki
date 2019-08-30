export default class ResultsTable {
    constructor(selector) {
        this.element = document.querySelector(selector);
        this.players = [];
        this.blankText = 'N/A';
        this.hiddenClass = 'hidden';
    }

    add(player) {
        this.players.push(player);
        let element = this.element.querySelector(`div:nth-child(${this.players.length})`);
        element.classList.remove(this.hiddenClass);
        element.classList.add(player.color);

        let fields = {
            current: element.querySelector('.current'),
            last: element.querySelector('.last'),
            best: element.querySelector('.best')
        }

        let best = Number.MAX_VALUE;
        
        player.addEventListener('timeupdate', e => {
            fields.current.textContent = (player.lapTime / 1000).toFixed(2);
        });

        player.addEventListener('lap', data => {
            const lapTimeFormatted = (data.time / 1000).toFixed(2);
            fields.last.textContent = lapTimeFormatted;
            if (data.time < best) {
                best = data.time;
                fields.best.textContent = lapTimeFormatted;
            }
        });
        player.addEventListener('lapstarted', data => {
            // Nothing to do as for now
        });
    }

    clear() {
        this.players = [];

        this.element.querySelectorAll('div').forEach(element => {
            element.removeAttribute('class');
            element.classList.add(this.hiddenClass)
        })

        this.element.querySelectorAll('span').forEach(element => {
            element.textContent = this.blankText;
        });


    }
}