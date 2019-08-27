
import Level from './level.js';
import Player from './player.js';
import Util from './util.js';
import EventEmitter from './eventEmitter.js';

export default class Game extends EventEmitter {

    constructor() {
        super();
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

        this.playersCount = 1;
        this.players = [];

        this.map = new Rectangle(new Point(0, 0), [this.WIDTH, this.HEIGHT]);
        this.center = this.map.getCenter();
        this.stopped = false;

        this.delta = 0;
    }

    static async build(track) {
        //TODO: implement?

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

    // TODO: move somewhere
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

    async loadLevel(svgSource) {
        this.level = await Level.load(svgSource);
        return this.level.background;
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

    setupLayers() {
        this.layers.lastSkidMarks.removeChildren();
        this.layers.lastSkidMarks.addChild(this.layers.skidmarks.rasterize());
        this.layers.skidmarks.removeChildren();
        this.layers.level.removeChildren();
        this.layers.level.addChild(this.level.img);
    }

    async setupPlayers() {
        this.players = [];
        let startPoints = Util.shuffle(this.level.startPoints);
        let colors = Util.shuffle(this.playerColors);

        for (let i = 0; i < this.playersCount; i += 1) {
            let player = new Player(colors.pop(), this.layers);
            await player.init();

            player.addEventListener('lap', data => {
                this.playerLap(data);
            });
            player.addEventListener('lapstarted', data => {
                this.playerLapStarted(data);
            });

            let startPoint = startPoints.pop();

            player.position = {
                x: startPoint.x,
                y: startPoint.y,
            };
            player.angle = startPoint.angle;
            player.updateVertices();

            this.players.push(player);
        };
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

    stop() {
        let promise = new Promise((res, rej) => {
            this.stopped = res;
        });

        this.players.forEach(player => {
            player.dispose();
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
                this.players[0].steerOn("left");
                break;

            case "ArrowRight":
                this.players[0].steerOn("right");
                break;

            case "A":
            case "a":
                this.players[1].steerOn("left");
                break;

            case "S":
            case "s":
                this.players[1].steerOn("right");
                break;

            case "1":
                this.playersCount = 1;
                this.restart();
                return;

            case "2":
                this.playersCount = 2;
                this.restart();
                return;


            case "r":
            case "R":
                this.restart();
                return;
        }

        switch (e.key) {
            case "ArrowLeft":
            case "ArrowRight":
                this.players[0].started = true;
                break;

            case "A":
            case "a":
            case "S":
            case "s":
                this.players[1].started = true;
                break;
        }
    }

    onKeyup(e) {
        switch (e.key) {
            // LEFT
            case "ArrowLeft":
                this.players[0].steerOff("left");
                break;

            // RIGHT
            case "ArrowRight":
                this.players[0].steerOff("right");
                break;

            case "A":
            case "a":
                this.players[1].steerOff("left");
                break;

            case "S":
            case "s":
                this.players[1].steerOff("right");
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

        this.players[0].steerOff();
        if (controls.left === controls.right) {
            return;
        }

        if (controls.left > controls.right) {
            this.players[0].steerOn('left');
        } else {
            this.players[0].steerOn('right');
        }

        this.players[0].started = true;
    }

    loop() {
        let timestamp = performance.now();
        this.delta += timestamp - this.lastFrameTime;

        while (this.delta >= this.timestep) {
            this.tick(this.timestep);
            this.delta -= this.timestep;
        }

        if (this.stopped) {
            clearInterval(this.loopId);
            this.stopped();
        }

        // TODO: subject to change, maybe should be calculated at the beginning?
        this.lastFrameTime = performance.now();
    }

    tick(timediff) {
        this.players.forEach(player => {
            player.move(timediff);

            if(!this.collidePlayers(player)) {
                if(!this.level.collide(player)) {
                    player.inCollision = false;
                }
            }

            player.checkLap(this.level.startLine);
        });
    }

    collidePlayers(p1) {
        let result = false;
        this.players.some(p2 => {
            // continue when dealing with the same player
            if (p1 === p2) return false;
            
            p2.bodyVector.some(p2vector => {
                if (p2vector.collide(p1.moveVector)) {
                    if (!p1.inCollision) {
                        p1.onCollide([p2vector]);           
                    }
                    
                    // dont check other vectors of p2, already having collision
                    result = true;
                    return result;
                }
            }) 

            // dont check other players vectors, already having collision
            return result;
        })

        return result;
    }

    drawLoop(e) {
        this.players.forEach(player => {
            player.draw(e);
        });

        // TODO: change to PlayerLap event
        if (this.players[0] && this.players[0].startedLap) {
            this.results.current.textContent = (this.players[0].lapTime / 1000).toFixed(2);
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