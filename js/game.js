import Level from './level.js';
import Player from './player.js';
import Util from './util.js';
import EventEmitter from './eventEmitter.js';
import ResultsTable from './resultsTable.js';
import Brain from './brain.js';
import Route from './route.js';
import StartReaction from './startReaction.js';
import { buildStartSchedule, STAGE } from './startSequence.js';
import { COLORS, HELMET_HEX, entriesFromCounts, isLightHelmet } from './lineup.js';

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
            computersCount: 0,
            laps: 4,
            // generator losowości (etap startu itd.; podmienialny w testach)
            rng: Math.random,
            // stawka w kolejności slotów (RosterMenu.entries()); brak = z liczników
            slots: null
        }, options);
        this.timestep = 1000 / this.options.fps;

        this.playerColors = COLORS;

        this.players = [];
        // humans in slot order — keys come from the slot position (ADR-0002)
        this.humanPlayers = [];
        // wpisy planszy startowej [{player, pole}]
        this.lineup = [];
        // znaczniki klawiszy nad motocyklami ludzi
        this.markersVisible = true;
        this.stopped = false;
        this.delta = 0;
        // elapsed race time since GO (ms; tick-accumulated, pause-safe)
        this.raceElapsed = 0;
        // Route shared by all Computers (generated once per race — ADR-0001)
        this.route = null;
        // Computer brains (parallel to computer players, scatter modes 1..4)
        this.brains = [];
        // Computer start reaction timestamps per player (index → ms after GO)
        this.computerReactions = new Map();
        // human first-turn samples of the current race (spec decyzja #16);
        // falstarters are rejected (their presses before GO do not count)
        this.falstarters = new Set();
        this.startSamples = [];

        // race state machine: countdown -> racing -> results
        this.state = null;
        this.countdownElapsed = 0;
        // harmonogram 3 etapów startu (patrz startSequence.js)
        this.startSchedule = [];
        this.startStageIndex = -1;
        this.countdownStage = null;
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
        this.state = 'lineup';

        this.setupLayers();
        await this.setupPlayers();

        this.fitStageIntoParentContainer();
        this.addHooks();

        // plansza startowa (kto kim jest, skąd startuje) — App decyduje,
        // kiedy rusza odliczanie (proceed()); kolejność pól jest już wylosowana
        this.emit('lineup', this.lineupData());

        this.lastFrameTime = performance.now();
        requestAnimationFrame(e => this.loop(e));
    }

    /** Dane planszy startowej i legendy (kolejność pól na torze). */
    lineupData() {
        return [...this.lineup]
            .sort((a, b) => a.pole - b.pole)
            .map(({ player, pole }) => ({
                pole,
                name: player.name,
                color: player.color,
                computer: !!player.computer,
                controls: player.keySet || null
            }));
    }

    /**
     * Koniec planszy startowej — startuje odliczanie. Wywoływane przez App
     * po timeoucie albo po klawiszu pomijającym.
     */
    proceed() {
        if (this.state !== 'lineup') {
            return;
        }
        this.beginCountdown();
    }

    /** Znaczniki klawiszy nad motocyklami ludzi (H / koniec 1. okrążenia). */
    setMarkersVisible(visible) {
        this.markersVisible = visible;
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
        this.humanPlayers = [];
        this.brains = [];
        this.brainByPlayer = new Map();
        this.computerReactions = new Map();
        this.falstarters = new Set();
        this.startSamples = [];
        // pola startowe losowane każdy bieg — stawka za każdym razem inna;
        // tasujemy PRZYPISANIE pól (permutacja indeksów), żeby numer pola
        // odpowiadał realnemu miejscu na linii startu
        let pointOrder = Util.shuffle(this.level.startPoints.map((point, index) => index));
        let entries = (this.options.slots && this.options.slots.length)
            ? this.options.slots
            : entriesFromCounts(this.options.playersCount, this.options.computersCount);
        this.resultsTable.clear();

        this.route = Route.forTrack(this.level);
        this.lineup = [];

        for (let entry of entries) {
            let player = new Player(entry.color, this.layers);
            await player.init();

            let pointIndex = pointOrder.pop();
            if (pointIndex === undefined) {
                pointIndex = 0;
            }
            let startPoint = this.level.startPoints[pointIndex];

            player.position = {
                x: startPoint.x,
                y: startPoint.y,
            };
            player.angle = startPoint.angle;
            player.updateVertices();

            player.slot = entry.slot;
            // tożsamość: ludzie = polska nazwa koloru, komputery = „Komputer N"
            player.name = entry.name;
            player.helmetColor = HELMET_HEX[entry.color] || '#fff';

            this.players.push(player);
            this.resultsTable.add(player);
            this.lineup.push({ player: player, pole: pointIndex + 1 });

            if (entry.computer) {
                // Computer: scatter mode = order of adding to the field
                // (spec decyzja #15); numeracja idzie po slotach
                player.computer = true;
                player.mode = this.brains.length + 1;
                let brain = new Brain({ mode: player.mode });
                brain.waypointIdx = Route.startIndexFor(this.route, startPoint);
                this.brains.push(brain);
                this.brainByPlayer.set(player, brain);
            } else {
                // keys come from the slot's fixed position (ADR-0002):
                // slot 3 always plays K/L, even with empty slots before it
                player.keySet = entry.controls;
                this.humanPlayers.push(player);
                this.attachMarker(player);
            }

            player.addEventListener('lap', data => this.onPlayerLap(data));
            player.addEventListener('falstart', falstarter => this.emit('falstart', falstarter));
            player.addEventListener('falstart', falstarter => {
                // falstarted riders do not contribute start samples
                this.falstarters.add(falstarter);
            });
        };
    }

    /**
     * Znacznik nad motocyklem człowieka: kolorowa kropka + skrót klawiszy.
     * Widoczny w odliczaniu i na 1. okrążeniu (przełączany z legendą).
     */
    attachMarker(player) {
        if (typeof Path === 'undefined' || typeof PointText === 'undefined') {
            return;
        }

        let circle = new Path.Circle({
            radius: 8,
            fillColor: player.helmetColor,
            strokeColor: '#000',
            strokeWidth: 1
        });
        // kontrast: na jasnym kasku (biały/żółty) czarne napisy
        let lightHelmet = isLightHelmet(player.color);
        let text = new PointText({
            content: player.keySet ? player.keySet.short : '',
            justification: 'center',
            fontSize: 7,
            fontWeight: 'bold',
            fillColor: lightHelmet ? '#000' : '#fff'
        });
        text.position = [0, 0];

        player.marker = new Group([circle, text]);
        player.marker.visible = false;
        this.layers.players.addChild(player.marker);
    }

    beginCountdown() {
        this.state = 'countdown';
        this.countdownElapsed = 0;
        this.startSchedule = buildStartSchedule(this.options.rng);
        this.startStageIndex = -1;
        this.countdownStage = null;
        this.emit('countdown', this);
        this.advanceCountdown();
    }

    /** Emituje etapy startu, których czas już nadszedł; start = `go()`. */
    advanceCountdown() {
        while (this.startStageIndex + 1 < this.startSchedule.length) {
            let next = this.startSchedule[this.startStageIndex + 1];
            if (this.countdownElapsed < next.at) {
                return;
            }
            this.startStageIndex += 1;
            this.countdownStage = next.stage;
            this.emit('countdownstage', {
                stage: next.stage,
                game: this
            });
            if (next.stage === STAGE.START) {
                this.go();
                return;
            }
        }
    }

    go() {
        this.state = 'racing';
        this.raceElapsed = 0;
        // bikes wait at the start line until the player presses a control key
        this.emit('go', this);

        // Computers roll their reaction latency right after GO (spec decyzja
        // #16): median of human starts × personality factor + noise, or
        // 140–320 ms with no history. Logged for verification (kryterium b.).
        let startReaction = this.options.startReaction || this.startReaction;
        if (!startReaction) {
            startReaction = this.startReaction = new StartReaction();
        }
        this.players.forEach(player => {
            if (player.computer) {
                let delay = startReaction.delayFor(player.mode);
                this.computerReactions.set(player, delay);
                if (typeof console !== 'undefined') {
                    console.log(`${player.name}: start po ${Math.round(delay)} ms (mode ${player.mode})`);
                }
            }
        });
    }

    steer(player, direction, isPress) {
        if (!player || player.computer) {
            // human input never drives a Computer (0-people races etc.)
            return;
        }

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
            this.recordStartSample(player);
        }
    }

    /**
     * Sample of a human launch: time of the first turn after GO (spec
     * decyzja #16). Falstarters are rejected; committed after the race.
     */
    recordStartSample(player) {
        if (player.computer) {
            return; // Computers never record samples
        }
        if (this.falstarters.has(player)) {
            return;
        }
        this.startSamples.push(this.raceElapsed);
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
        // czas biegu liczony od zielonego światła — postój na starcie też się liczy
        player.finishTime = this.raceElapsed;
        player.finish();
        this.emit('playerfinished', player);

        let allFinished = this.players.every(p => p.finished);
        if (allFinished) {
            this.finishRace();
        }
    }

    finishRace() {
        this.state = 'results';

        // save the race's human start samples to the reaction history
        let startReaction = this.options.startReaction || this.startReaction;
        if (startReaction) {
            startReaction.commit(this.startSamples);
        }

        // klasyfikacja: czas od zielonego (standing start liczy się każdemu)
        // + kary; suma okrążeń służy już tylko najlepszemu okrążeniu
        let ranking = this.players.map(player => {
            let total = player.finishTime + player.penaltyMs;

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

    /**
     * Człowiek, którego zestaw klawiszy zawiera `code` (dopasowanie po
     * `KeyboardEvent.code`, więc NumLock i układ klawiatury nie mają znaczenia).
     *
     * @param {string} code
     * @returns {Player|null}
     */
    playerForKey(code) {
        if (!code) {
            return null;
        }
        return this.humanPlayers.find(player =>
            player.keySet &&
            (player.keySet.left.includes(code) || player.keySet.right.includes(code))
        ) || null;
    }

    /** 'left' / 'right' dla `code` w zestawie klawiszy gracza. */
    directionForKey(player, code) {
        return player.keySet.left.includes(code) ? 'left' : 'right';
    }

    onKeydown(e) {
        let player = this.playerForKey(e.code);
        if (player) {
            this.steer(player, this.directionForKey(player, e.code), !e.repeat);
            return;
        }

        switch (e.code) {
            case "KeyR":
                this.restart();
                return;

            case "KeyP":
                this.togglePause();
                break;

            case "KeyH":
                // App przełącza legendę i znaczniki (widoczność UI, nie fizyka).
                // Po 1. okrążeniu H nie wskrzesza legendy (ADR-0002).
                if (this.canToggleLegend()) {
                    this.emit('legendtoggle');
                }
                break;
        }
    }

    /**
     * Legenda ma sens tylko do końca 1. okrążenia: w LINEUP, odliczaniu i
     * dopóki choć jeden człowiek nie zamknął pierwszego okrążenia.
     */
    canToggleLegend() {
        if (this.state === 'lineup' || this.state === 'countdown') {
            return true;
        }
        if (this.state !== 'racing') {
            return false;
        }
        return this.humanPlayers.some(player => player.lapTimes.length < 1);
    }

    onKeyup(e) {
        let player = this.playerForKey(e.code);
        if (player) {
            player.steerOff(this.directionForKey(player, e.code));
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

        let human = this.humanPlayers[0];
        if (!human) {
            // podgląd samych komputerów — palce nie mają kim sterować
            return;
        }

        human.steerOff();
        if (controls.left === controls.right) {
            return;
        }

        if (controls.left > controls.right) {
            this.steer(human, 'left', e.type === 'touchstart');
        } else {
            this.steer(human, 'right', e.type === 'touchstart');
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
            this.advanceCountdown();

            return;
        }

        if (this.state !== 'racing') {
            // plansza startowa / podsumowanie: bez ruchu i bez AI
            return;
        }

        this.raceElapsed += timediff;

        this.players.forEach((player, index) => {
            if (player.finished) return;

            // Computer driver: every racing frame the Brain sets
            // Player.controls (existing seam) — same semantics as keys
            let brain = this.brainByPlayer.get(player);
            if (brain && !player.started && this.raceElapsed >= (this.computerReactions.get(player) || 0)) {
                player.start();
            }
            if (brain && player.started) {
                let cmd = brain.decide(player, this.route, {
                    level: this.level,
                    players: this.players
                });
                player.steerOff();
                if (cmd === -1) {
                    player.steerOn('left');
                } else if (cmd === 1) {
                    player.steerOn('right');
                }
            }

            player.move(timediff);

            let wallHit = null;
            if (!this.collidePlayers(player)) {
                wallHit = this.level.collide(player);
                if (!wallHit) {
                    player.inCollision = false;
                }
            }

            if (player.inCollision) {
                // wall segment => slide along it; rider collision => full revert
                player.revertPosition(wallHit);
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
            if (player.marker && player.body) {
                // marker nie obraca się z motocyklem (body.applyMatrix = false);
                // pozycja liczona z logicznych współrzędnych gracza, nie z matrixa SVG.
                // Bok, nie góra — na linii startu motocykle stoją jeden za drugim,
                // więc etykieta nad motocyklem wchodzi na zawodnika z przodu.
                player.marker.position = new Point(player.position.x + 24, player.position.y);
                // znacznik tylko do startu tego motorka — w trakcie jazdy zbędny
                player.marker.visible = this.markersVisible && !player.started;
            }
            player.draw(e);
        });
    }

    dispose() {
        this.removeHooks();
        this.level.dispose();
    };
}