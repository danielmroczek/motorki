
import Level from './level.js';
import Player from './player.js';
import Util from './util.js';
import Vertex from './vertex.js';

export default class Game {

    constructor() {
        this.SVG_PRECISION = 1.001; // closer to 1 -> better precision
        this.FPS = 60;
        this.HEIGHT = 448;
        this.WIDTH = 640;
        this.CANVAS_ID = 'gc';
        this.timestep = 1000 / this.FPS;
        this.playerColors = [
            'red',
            'white',
            'yellow',
            'blue'
        ];
        this.map = new Rectangle(new Point(0,0), [this.WIDTH, this.HEIGHT]);
        this.center = this.map.getCenter();
        this.stopped = false;
    
        this.bodies = [];
        this.delta = 0;
    }

    init() {
        this.initPaper();
        this.initLayers();
        this.initResults();
    }
    
    initPaper() {
        let canvas = document.getElementById(this.CANVAS_ID);
        paper.setup(canvas);

        view.on('frame', e => this.drawLoop(e));
        view.on('resize', e => this.onResize(e));
        view.draw();
    }

    initResults() {
        this.results = {
            current: document.querySelector('#results .current'),
            last: document.querySelector('#results .last'),
            best: document.querySelector('#results .best')
        };

        this.best = Number.MAX_VALUE;

        Object.values(results).forEach(result => result.textContent = "N/A");
    }

    initLayers() {
        this.layers = {
            level: new Layer(),
            lastSkidMarks: new Layer({
                opacity: 0.5
            }),
            skidmarks: new Layer(),
            players: new Layer()
        };

        Object.values(this.layers).forEach(layer => project.addLayer(layer));
    }

    setupLayers() {
        this.layers.lastSkidMarks.removeChildren();
        this.layers.lastSkidMarks.addChild(this.layers.skidmarks.rasterize());
        this.layers.skidmarks.removeChildren();
        this.layers.level.removeChildren();
        this.layers.level.addChild(this.level.img);
    }


    //TODO: move to level
    async loadLevel(svgSource) {
        // TODO: use fetch

        let svg = await Util.loadSvg(svgSource);
        let vertices = [];

        //TODO: use queryselector
        svg.querySelectorAll('path.track').forEach(path => {
            let points = Util.pathToPoints(path, this.SVG_PRECISION);
            vertices = vertices.concat(Vertex.fromPoints(points));
        });

        this.level = new Level();
        this.level.vertices = vertices;
        this.level.updateImage(svg);

        // start points for each player
        svg.querySelectorAll('metadata > start').forEach(startPoint => {
            this.level.startPoints.push({
                x: parseInt(startPoint.getAttribute('x')),
                y: parseInt(startPoint.getAttribute('y')),
                angle: parseInt(startPoint.getAttribute('a')),
                speed: parseInt(startPoint.getAttribute('s')) // unused for now
            });
        });

        // start line for time measuring
        let startLinePath = svg.querySelector('path.startline');
        if (startLinePath) {
            let start = startLinePath.getPointAtLength(0);
            let end = startLinePath.getPointAtLength(startLinePath.getTotalLength());
            this.level.startLine = new Vertex(start, end);
        }

        let background = svg.querySelector('.background').style.fill;

        return background;
    }

    async start() {
        this.stopped = null;

        this.setupLayers();
        await this.setupPlayers();

        this.onResize();

        this.addHooks();

        this.lastFrameTime = performance.now();
        this.loopId = setInterval(e => this.loop(e), this.timestep);
    }

    addHooks() {
        this.eventListeners = {
            'keydown': e => this.onKeydown(e),
            'keyup': e => this.onKeyup(e),
            'touchstart': e => this.touchControl(e),
            'touchend': e => this.touchControl(e),
            'touchmove': e => this.touchControl(e),
            'touchcancel': e => this.touchControl(e)
        }

        for (let [type, listener] of Object.entries(this.eventListeners)) {
            document.addEventListener(type, listener);
        }
    }

    removeHooks() {
        for (let [type, listener] of Object.entries(this.eventListeners)) {
            document.removeEventListener(type, listener);
        }
    }

    async setupPlayers() {
        this.player = new Player(Util.random(this.playerColors), this.layers);
        await this.player.init();

        this.player.addEventListener('lap', data => {
            this.playerLap(data);
        });
        this.player.addEventListener('lapstarted', data => {
            this.playerLapStarted(data);
        });
        this.bodies = [
            this.player
        ];
        this.startPoint = Util.random(this.level.startPoints);
        this.player.position = {
            x: this.startPoint.x,
            y: this.startPoint.y,
        };
        this.player.angle = this.startPoint.angle;
    }

    stop() {
        let promise = new Promise((res, rej) => {
            this.stopped = res;
        });

        this.bodies.forEach(body => {
            body.dispose();
        });
        this.level.dispose();

        this.removeHooks();
        return promise;
    }

    async restart() {
        await this.stop();
        this.start();
    }

    onKeydown(e) {
        //TODO: move key constant to player
        switch (e.key) {
            case "ArrowLeft":
                this.player.steerOn("left");
                break;

            case "ArrowRight":
                this.player.steerOn("right");
                break;

            case "r":
            case "R":
                this.restart();
                return;
        }

        switch (e.key) {
            case "ArrowLeft":
            case "ArrowRight":
                this.player.started = true;
                break;
        }
    }

    onKeyup(e) {
        switch (e.key) {
            // LEFT
            case "ArrowLeft":
                this.player.steerOff("left");
                break;

            // RIGHT
            case "ArrowRight":
                this.player.steerOff("right");
                break;
        }
    }

    touchControl(e) {
        let touches = Array.prototype.slice.call(e.touches);
        let controls = {
            left: 0,
            right: 0
        };
        let middle = window.innerWidth / 2;
        touches.forEach(touch => {
            if (touch.clientX < middle) {
                controls.left += 1;
            } else {
                controls.right += 1;
            }
        });

        this.player.steerOff();
        if (controls.left === controls.right) {
            return;
        }

        if (controls.left > controls.right) {
            player.steerOn('left');
        } else {
            player.steerOn('right');
        }

        this.player.started = true;
    }

    loop() {
        let timestamp = performance.now();
        this.delta += timestamp - this.lastFrameTime;
        this.lastFrameTime = timestamp;

        while (this.delta >= this.timestep) {
            this.tick(this.timestep);
            this.delta -= this.timestep;
        }

        if (this.stopped) {
            clearInterval(this.loopId);
            this.stopped();
        }
    }

    tick(timediff) {
        this.bodies.forEach(body => {
            body.move(timediff);
            //collideBodies(body);
            this.level.collide(body);
            body.checkLap(this.level.startLine);
        });
    }

    drawLoop(e) {
        this.bodies.forEach(body => {
            body.draw(e);
        });

        // TODO: change to PlayerLap event
        if (this.player && this.player.startedLap) {
            this.results.current.textContent = (this.player.lapTime / 1000).toFixed(2);
        }
    }

    onResize(event) {
        view.setZoom(view.getViewSize().getWidth() / this.WIDTH);
        view.setCenter(this.center);
    }

    dispose() {
        this.level.dispose();
    };

    playerLap(data) {
        const lapTimeFormatted = (data.time / 1000).toFixed(2);
        this.results.last.textContent = lapTimeFormatted;
        if (data.time < this.best) {
            this.best = data.time;
            this.results.best.textContent = lapTimeFormatted;
        }
        //console.log(`${data.player.color} player has ended lap in ${lapTimeFormatted}`);
    };

    playerLapStarted(data) {
        // Nothing to do as for now
    };
}