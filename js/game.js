
import Level from './level.js';
import Player from './player.js';
import { Util, Vertex } from './util.js';

export default function Game() {
    const SVG_PRECISION = 1.001; // closer to 1 -> better precision
    const FPS = 60;
    const HEIGHT = 448;
    const WIDTH = 640;
    const timestep = 1000 / FPS;
    const canvas = document.getElementById('gc');
    const playerColors = [
        'red',
        'white',
        'yellow',
        'blue'
    ];
    let map = new Rectangle(new Point(0,0), [WIDTH, HEIGHT]);
    let center = map.getCenter();
    let that = this;
    that.stopped = false;

    let player;
    let level;
    let bodies = [];
    let lastFrameTime;
    let loopId;
    let delta = 0;

    let results = {
        current: $('#results .current'),
        last: $('#results .last'),
        best: $('#results .best')
    };
    Object.keys(results).forEach(result => {
       results[result].text("N/A");
    });

    // Paper.js things
    paper.setup(canvas);
    view.onFrame = drawLoop;
    view.onResize = onResize;
    view.draw();

    let layers = {
        level: new Layer(),
        lastSkidMarks: new Layer({
            opacity: 0.5
        }),
        skidmarks: new Layer(),
        players: new Layer()
    };

    Object.keys(layers).forEach(layerName => {
        let layer = layers[layerName];
        project.addLayer(layer);
    });

    //todo: move to level
    this.loadLevel = function (svgSource) {
        let svg = $.get({
            url: svgSource,
            async: false
        }).responseXML;

        let vertices = [];
        $(svg).find('path.track').toArray().forEach(path => {
            let points = Util.pathToPoints(path, SVG_PRECISION);
            vertices = vertices.concat(Util.pointsToVertices(points));
        });

        level = new Level();
        level.vertices = vertices;
        level.updateImage(svg);

        // start points for each player
        $(svg).find('metadata > start').each((i, startPoint) => {
            startPoint = $(startPoint);
            level.startPoints.push({
                x: parseInt(startPoint.attr('x')),
                y: parseInt(startPoint.attr('y')),
                angle: parseInt(startPoint.attr('a')),
                speed: parseInt(startPoint.attr('s')) // unused for now
            });
        });

        // start line for time measuring
        let startLinePath = $(svg).find('path.startline')[0];
        if (startLinePath) {
            let start = startLinePath.getPointAtLength(0);
            let end = startLinePath.getPointAtLength(startLinePath.getTotalLength());
            level.startLine = new Vertex(start, end);
        }

        let background = svg.querySelector('.background').style.fill;

        return background;
    };

    this.start = function () {
        that.stopped = null;

        // setup layers
        layers.lastSkidMarks.removeChildren();
        layers.lastSkidMarks.addChild(layers.skidmarks.rasterize());
        layers.skidmarks.removeChildren();

        layers.level.removeChildren();
        layers.level.addChild(level.img);

        // setup players
        player = new Player(Util.random(playerColors), layers);
        player.addEventListener('lap', data => {
            that.playerLap(data);
        });
        player.addEventListener('lapstarted', data => {
            that.playerLapStarted(data);
        });

        bodies = [
            player
        ];

        let startPoint = Util.random(level.startPoints);
        player.position = {
            x: startPoint.x,
            y: startPoint.y,
        };
        player.angle = startPoint.angle;


        // other stuff
        onResize();

        document.addEventListener("keydown", onKeydown);
        document.addEventListener("keyup", onKeyup);
        ['touchstart', 'touchend', 'touchmove', 'touchcancel'].forEach(event => {
           window.addEventListener(event, touchControl);
        });

        lastFrameTime = performance.now();
        loopId = setInterval(loop, timestep);
    };

    this.stop = function () {
        let promise = new Promise((res, rej) => {
            that.stopped = res;
        });

        bodies.forEach(body => {
            body.dispose();
        });
        level.dispose();

        document.removeEventListener("keydown", onKeydown);
        document.removeEventListener("keyup", onKeyup);
        ['touchstart', 'touchend', 'touchmove', 'touchcancel'].forEach(event => {
            window.removeEventListener(event, touchControl);
        });
        return promise;
    };

    this.restart = function () {
        this.stop().then(this.start);
    };

    function onKeydown(e) {
        //todo: move key constant to player
        switch (e.key) {
            case "ArrowLeft":
                player.steerOn("left");
                break;

            case "ArrowRight":
                player.steerOn("right");
                break;

            case "r":
            case "R":
                that.restart();
                return;
        }

        switch (e.key) {
            case "ArrowLeft":
            case "ArrowRight":
                player.started = true;
                break;
        }
    }

    function onKeyup(e) {
        switch (e.key) {
            // LEFT
            case "ArrowLeft":
                player.steerOff("left");
                break;

            // RIGHT
            case "ArrowRight":
                player.steerOff("right");
                break;
        }
    }

    function touchControl(e) {
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

        player.steerOff();
        if (controls.left === controls.right) {
            return;
        }

        if (controls.left > controls.right) {
            player.steerOn('left');
        } else {
            player.steerOn('right');
        }

        player.started = true;
    }

    function loop() {
        let timestamp = performance.now();
        delta += timestamp - lastFrameTime;
        lastFrameTime = timestamp;

        while (delta >= timestep) {
            tick(timestep);
            delta -= timestep;
        }

        if (that.stopped) {
            clearInterval(loopId);
            that.stopped();
        }
    }

    function tick(timediff) {
        bodies.forEach(body => {
            body.move(timediff);
            //collideBodies(body);
            level.collide(body);
            body.checkLap(level.startLine);
        });
    }

    function drawLoop(e) {
        bodies.forEach(body => {
            body.draw(e);
        });

        if (player.startedLap) {
            results.current.text((player.lapTime / 1000).toFixed(2));
        }
    }

    function onResize(event) {
        view.setZoom(view.getViewSize().getWidth() / WIDTH);
        view.setCenter(center);
    }

    this.dispose = function() {
        level.dispose();
    };

    let best = Number.MAX_VALUE;
    this.playerLap = function (data) {
        results.last.text((data.time / 1000).toFixed(2));
        if (data.time < best) {
            best = data.time;
            results.best.text((data.time / 1000).toFixed(2));
        }
        //console.log(`${data.player.color} player has ended lap in ${(data.time / 1000).toFixed(2)}`);
    };

    this.playerLapStarted = function (data) {
        // Nothing to do as for now
    };
}