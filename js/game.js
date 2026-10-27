import Level from './level.js';
import Player from './player.js';
import Util from './util.js';
import EventEmitter from './eventEmitter.js';
import ResultsTable from './resultsTable.js';

export default class Game extends EventEmitter {
    constructor(options) {
        super();
        this.options = Object.assign({
            svgPrecision: 1.001,
            fps: 60,
            canvasSelector: "#gamecanvas",
            stage: {
                width: 640,
                height: 448
            },
            playersCount: 1,
            laps: 4
        }, options);
        this.timestep = 1000 / this.options.fps;

        this.playerColors = [
            'red',
            'white',
            'yellow',
            'blue'
        ];

        this.players = [];
        this.stopped = false;
        this.delta = 0;

        // race state machine: countdown -> racing -> results
        this.state = null;
        this.countdownElapsed = 0;
        this.countdownDuration = 0;
    }

    static async build(track) {
        //TODO: implement?

    }

    init() {
        this.initPaper();
        this.initLayers();
        this.resultsTable = new ResultsTable('.results');
        window.scrollTo(0, 1); //fake fullscreen
    }

    initPaper() {
        this.canvas = document.querySelector(this.options.canvasSelector);
        Object.assign(this.canvas, this.options.stage);
        paper.setup(this.canvas);
        this.center = new Rectangle([0, 0], this.options.stage).center;
        window.addEventListener("resize", e => this.fitStageIntoParentContainer());

        view.on('frame', e => this.drawLoop(e));
    }

    fitStageIntoParentContainer() {
        let container = this.canvas.parentElement;
        // now we need to fit stage into parent
        let width = container.clientWidth;
        let height = container.clientHeight;

        let stageWidth = this.options.stage.width;
        let stageHeight = this.options.stage.height;

        let scale = width / height < stageWidth / stageHeight ? width / stageWidth : height / stageHeight;

        view.viewSize = {
            width: stageWidth * scale,
            height: stageHeight * scale
        }

        view.setCenter(this.center);
        view.zoom = scale;
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

        this.fitStageIntoParentContainer();
        this.addHooks();
        this.beginCountdown();

        this.lastFrameTime = performance.now();
        requestAnimationFrame(e => this.loop(e));
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
        this.resultsTable.clear();

        for (let i = 0; i < this.options.playersCount; i += 1) {
            let player = new Player(colors.pop(), this.layers);
            await player.init();

            let startPoint = startPoints.pop();

            player.position = {
                x: startPoint.x,
                y: startPoint.y,
            };
            player.angle = startPoint.angle;
            player.updateVertices();

            this.players.push(player);
            this.resultsTable.add(player);

            player.addEventListener('lap', data => this.onPlayerLap(data));
            player.addEventListener('falstart', falstarter => this.emit('falstart', falstarter));
        };
    }

    beginCountdown() {
        this.state = 'countdown';
        this.countdownElapsed = 0;
        this.countdownDuration = Math.floor(Math.random() * 400) * 10 + 1500;
        this.emit('countdown', this);
    }

    go() {
        this.state = 'racing';
        // bikes wait at the start line until the player presses a control key
        this.emit('go', this);
    }

    steer(player, direction, isPress) {
        player.steerOn(direction);

        if (!isPress) {
            return;
        }

        if (this.state === 'countdown') {
            // steering before the green light is a falstart (penalty)
            player.falstart();
        } else if (this.state === 'racing' && !player.started) {
            // launching takes a fresh control press after GO
            player.start();
        }
    }

    onPlayerLap(data) {
        let player = data.player;

        player.lapTimes.push(data.time);

        if (player.lapTimes.length < this.options.laps) {
            this.emit('lapcompleted', {
                player: player,
                lap: player.lapTimes.length,
                time: data.time
            });
            return;
        }

        this.playerFinished(player);
    }

    playerFinished(player) {
        player.finish();
        this.emit('playerfinished', player);

        let allFinished = this.players.every(p => p.finished);
        if (allFinished) {
            this.finishRace();
        }
    }

    finishRace() {
        this.state = 'results';

        let ranking = this.players.map(player => {
            let total = player.lapTimes.reduce((sum, lapTime) => sum + lapTime, 0) + player.penaltyMs;

            return {
                player: player,
                total: total,
                best: Math.min(...player.lapTimes),
                penaltyMs: player.penaltyMs
            };
        });

        ranking.sort((a, b) => a.total - b.total);

        this.emit('racefinished', ranking);
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
            if (type.startsWith("touch")) {
                document.querySelector('div.stage').addEventListener(type, listener)
            } else {
                document.addEventListener(type, listener);
            }
        }
    }

    removeHooks() {
        for (let [type, listener] of Object.entries(this.eventListeners)) {
            if (type.startsWith("touch")) {
                document.querySelector('div.stage').removeEventListener(type, listener)
            } else {
                document.removeEventListener(type, listener);
            }
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
                this.steer(this.players[0], "left", !e.repeat);
                break;

            case "ArrowRight":
                this.steer(this.players[0], "right", !e.repeat);
                break;

            case "A":
            case "a":
                this.steer(this.players[1], "left", !e.repeat);
                break;

            case "S":
            case "s":
                this.steer(this.players[1], "right", !e.repeat);
                break;

            case "K":
            case "k":
                this.steer(this.players[2], "left", !e.repeat);
                break;

            case "L":
            case "l":
                this.steer(this.players[2], "right", !e.repeat);
                break;

            case "1":
                this.options.playersCount = 1;
                this.restart();
                return;

            case "2":
                this.options.playersCount = 2;
                this.restart();
                return;

            case "3":
                this.options.playersCount = 3;
                this.restart();
                return;

            case "r":
            case "R":
                this.restart();
                return;

            case "p":
            case "P":
                this.togglePause();
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

            case "K":
            case "k":
                this.players[2].steerOff("left");
                break;

            case "L":
            case "l":
                this.players[2].steerOff("right");
                break;
        }
    }

    touchControl(e) {
        e.preventDefault();

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
            this.steer(this.players[0], 'left', e.type === 'touchstart');
        } else {
            this.steer(this.players[0], 'right', e.type === 'touchstart');
        }
    }

    loop() {
        if (!this.paused) {
            let timestamp = performance.now();
            this.delta += timestamp - this.lastFrameTime;

            while (this.delta >= this.timestep) {
                this.tick(this.timestep);
                this.delta -= this.timestep;
            }
        }

        // TODO: subject to change, maybe should be calculated at the beginning?
        this.lastFrameTime = performance.now();

        if (this.stopped) {
            this.stopped();
        } else {
            requestAnimationFrame(e => this.loop(e));// request animation frame call next loop
        }

    }

    togglePause() {
        this.paused = !this.paused;
    }

    pause() {
        this.paused = true;
    }

    unpause() {
        this.paused = false;
    }

    tick(timediff) {
        if (this.state === 'countdown') {
            this.countdownElapsed += timediff;

            if (this.countdownElapsed >= this.countdownDuration) {
                this.go();
            }

            return;
        }

        this.players.forEach(player => {
            if (player.finished) return;

            player.move(timediff);

            if (!this.collidePlayers(player)) {
                if (!this.level.collide(player)) {
                    player.inCollision = false;
                }
            }

            if (player.inCollision) {
                player.revertPosition();
            }

            player.checkLap(this.level.startLine);
        });
    }

    collidePlayers(p1) {
        let result = false;
        this.players.some(p2 => {
            // continue when dealing with the same player
            if (p1 === p2) return false;

            // finished players are ghosts
            if (p2.finished) return false;
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
    }

    dispose() {
        this.removeHooks();
        this.level.dispose();
    };
}