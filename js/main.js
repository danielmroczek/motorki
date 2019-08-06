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

function Game() {
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

function Player(color, layers) {
    const skidmarkMaxSegmentLength = 5;
    const skidmarkMaxPathLength = 100;
    const listeners = {};
    this.position = {
        x: 400,
        y: 350
    };
    this.height = 20;
    this.width = 7;

    this.angle = 90;
    this.anglespeed = 0;
    this.anglespeedAccel = 1.5;
    this.anglespeedMinMax = 5;
    this.anglespeedBrake = 5;

    this.maxSpeed = 20;
    this.minSpeed = 2;
    this.speed = this.minSpeed;
    this.acceleration = 0.8;

    this.verbose = false;
    this.vertices = [];
    this.cheat = false;

    this.color = color;
    this.colors = {
        main: "#F44336",
        front: "#4CAF50",
        back: "#795548",
        debug: "#E91E63"
    };

    this.controls = {
        "left": 0,
        "right": 0
    };

    // if player has moved already
    this.started = false;
    // if player has crossed start line for the first time
    this.startedLap = false;

    let defaultVertices = [
        {
            x: -this.width / 2,
            y: -this.height / 2
        }, {
            x: this.width / 2,
            y: -this.height / 2
        }, {
            x: this.width / 2,
            y: this.height / 2
        }, {
            x: -this.width / 2,
            y: this.height / 2
        }
    ];

    this.skidmark = new Path({
        strokeColor: new Color(0, 0, 0, 0.75),
        strokeWidth: 4,
        strokeCap: 'butt',
        strokeJoin: 'round',
        dashArray: [1.5, 1.5]
    });

    this.skidmarkRasterGroup = new Group();
    this.skidmarkRasterGroup.addChild(this.skidmark);
    layers.skidmarks.addChild(this.skidmarkRasterGroup);

    let svg = $.get({
        url: `img/moto-${color}.svg`,
        async: false
    }).responseXML;

    let body = project.importSVG(svg, {
        insert: false
    });
    layers.players.addChild(body);

    body.applyMatrix = false;

    let debugBody;

    if (this.verbose) {
        debugBody = new Path.Circle({
            center: this.position,
            radius: 5,
            fillColor: this.colors.debug
        });

        debugBody.applyMatrix = false;
    }

    this.updateVertices = function () {
        let points = [];
        defaultVertices.forEach(p => {
            points.push(Util.movePoint(Util.rotatePoint(p, this.angle), this.position));
        });

        points.push(points[0]);
        let newVertices = Util.pointsToVertices(points);

        // using vertices in correct order - front, right, left, back
        this.vertices = [newVertices[0], newVertices[1], newVertices[3], newVertices[2]];
    };

    this.move = function (timediff) {
        if (this.started) {
            this.angle %= 360;

            if (!this.inCollision) {
                // steering
                if (this.controls["left"] === this.controls["right"]) {
                    let sign = Math.sign(this.anglespeed);
                    this.anglespeed -= sign * this.anglespeedAccel * (timediff / 30);
                    if (sign !== Math.sign(this.anglespeed)) {
                        this.anglespeed = 0;
                    }
                } else if (this.controls["left"]) {
                    this.anglespeed -= this.anglespeedAccel * (timediff / 30);
                } else if (this.controls["right"]) {
                    this.anglespeed += this.anglespeedAccel * (timediff / 30);
                }

                this.angle += this.anglespeed * (timediff / 30);

                this.anglespeed = Math.min(this.anglespeed, this.anglespeedMinMax);
                this.anglespeed = Math.max(this.anglespeed, -this.anglespeedMinMax);
            }

            this.speed += this.acceleration - (Math.abs(this.anglespeed) / this.anglespeedBrake);
            this.speed = Math.min(this.speed, this.maxSpeed);
            this.speed = Math.max(this.speed, this.minSpeed);

            let dx = Math.sin(this.angle * (Math.PI / 180));
            let dy = -Math.cos(this.angle * (Math.PI / 180));

            //add power to velocity to get new point

            this.lastPosition = this.position;
            this.position = {
                x: this.position.x + dx * this.speed * (timediff / 30),
                y: this.position.y + dy * this.speed * (timediff / 30)
            };

            //console.log(this.speed);
            this.updateVertices();
        }

        if (this.startedLap) {
            this.lapTime += timediff;
        }
        //console.log(this.angle);
    };
    this.draw = function (e) {
        body.position = new Point(this.position);
        body.rotation = this.angle + this.speed * this.anglespeed;

        let frontWheel = body.children["front-wheel"];
        let backWheel = body.children["back-wheel"];
        frontWheel.rotation = (-this.speed + this.maxSpeed / 3) * this.anglespeed;

        if (debugBody) {
            debugBody.position = new Point(this.position);
        }

        if (!this.lastPosition ||
            (this.lastPosition.x == this.position.x &&
                 this.lastPosition.y == this.position.y)) {
            return;
        }

        let newPoint = backWheel.localToGlobal(backWheel.position);
        if (this.skidmark.lastCurve &&
            this.skidmark.lastCurve.length < skidmarkMaxSegmentLength) {

            this.skidmark.lastSegment.point = newPoint;
        } else {
            this.skidmark.add(newPoint);
        }

        if (this.skidmark.length > skidmarkMaxPathLength) {
            //this.skidmark.simplify();
            let raster = this.skidmarkRasterGroup.rasterize();
            this.skidmarkRasterGroup.remove();
            this.skidmarkRasterGroup = new Group();
            this.skidmarkRasterGroup.addChild(raster);
            let lastSegment = this.skidmark.lastSegment;
            let length = this.skidmark.length;
            this.skidmark.removeSegments();
            this.skidmark.add(lastSegment);
            this.skidmark.dashOffset = (length + this.skidmark.dashOffset) % 3;
            this.skidmarkRasterGroup.addChild(this.skidmark);
            layers.skidmarks.addChild(this.skidmarkRasterGroup);
        }

    };
    this.checkLap = function (startLine) {
        if (!startLine || !this.lastPosition) {
            return;
        }
        let moveVertex = new Vertex(this.position, this.lastPosition);
        if (moveVertex.collide(startLine)) {
            let side = Util.findSide(startLine, this.position);
            if (side > 0) {
                // ==>
                if (!this.cheat) {
                    this.finishAndStartLap();
                }

                this.cheat = false;
            } else if (side < 0) {
                // <==
                this.cheat = true;
            }
        }
    };

    this.finishAndStartLap = function () {
        let currentTime = this.lapTime;
        this.lapTime = 0;

        if (!this.startedLap) {
            this.startedLap = true;
            this.emit('lapstarted', this);
            return;
        }

        this.emit('lap', {
          player: this,
          time: currentTime
        });
    };

    this.steerOff = function (s) {
        if (!s) {
            // turn all off
            Object.keys(this.controls).forEach(control => {
               this.controls[control] = 0;
            });
        } else {
            this.controls[s] = 0;
        }

    };

    this.steerOn = function (s) {
        this.controls[s] = 1;
    };

    this.onCollide = function (vertex) {
        // What to do?

        this.position = this.lastPosition;
        this.speed /= 3;

        let collisionAngle = (Math.atan2(vertex.p1.y - vertex.p2.y, vertex.p1.x - vertex.p2.x) * 180 / Math.PI) - 90;
        this.angle = -this.angle + 2 * (collisionAngle);

    };

    this.dispose = function () {
        body.remove();
    };

    this.addEventListener = function(event, callback) {
        if (!event || typeof callback !== "function" ) {
            return;
        }

        let eventListeners = listeners[event];
        if (!eventListeners) {
            eventListeners = [];
            listeners[event] = eventListeners;
        }


        eventListeners.push(callback);
    };
    this.emit = function(event, data) {
        let eventListeners = listeners[event];
        if (!eventListeners) {
            return;
        }

        eventListeners.forEach(listener => {
            listener.call(this, data);
        });
    }
}
function Level() {
    this.vertices = [];
    this.verbose = false;
    this.startPoints = [];
    this.startLine = null;

    this.img;

    this.draw = function (ctx) {
        if (this.img) {
            ctx.drawImage(this.img, 0, 0);
        }

        if (this.verbose) {
            this.vertices.forEach(path => {
                ctx.beginPath();
                let lastPoint = path[path.length - 1];
                ctx.moveTo(lastPoint.x, lastPoint.y);
                path.forEach(p => {
                    ctx.lineTo(p.x, p.y);
                    ctx.stroke();
                });

            });
        }
    };

    this.collide = function (body) {
        let result = false;
        let that = this;
        body.vertices.some(bodyVertex => {
            that.vertices.some(levelVertex => {
                if (levelVertex.collide(bodyVertex)) {
                    if (!body.inCollision) {
                        body.onCollide(levelVertex);
                        body.inCollision = true;
                    }
                    result = true;
                }
                return result;
            });
            return result
        });
        if (!result) {
            body.inCollision = false;
        }
    };

    this.updateImage = function (svg) {
        this.img = project.importSVG(svg, {
            insert: false
        });
    };

    this.dispose = function() {
        if (this.img) {
            this.img.remove();
        }
    }

}
function Vertex(p1, p2) {
    this.p1 = p1;
    this.p2 = p2;

    this.x = Math.min(p1.x, p2.x);
    this.y = Math.min(p1.y, p2.y);

    this.width = Math.max(p1.x, p2.x) - this.x;
    this.height = Math.max(p1.y, p2.y) - this.y;

    let that = this;

    function boundingBoxCollision(vertex) {
        return that.x < vertex.x + vertex.width &&
            that.x + that.width > vertex.x &&
            that.y < vertex.y + vertex.height &&
            that.height + that.y > vertex.y;
    }

    this.collide = function (vertex) {
        return boundingBoxCollision(vertex) && Util.intersectLineLine(this.p1, this.p2, vertex.p1, vertex.p2);

    }
}

let Util = {
    rotatePoint(point, angle) {
        angle = angle * Math.PI / 180.0;
        return {
            x: Math.cos(angle) * (point.x) - Math.sin(angle) * (point.y),
            y: Math.sin(angle) * (point.x) + Math.cos(angle) * (point.y)
        };
    },
    movePoint(point, vector) {
        return {
            x: point.x + vector.x,
            y: point.y + vector.y
        }
    },
    intersectLineLine(a1, a2, b1, b2) {
        var result = false;

        var ua_t = (b2.x - b1.x) * (a1.y - b1.y) - (b2.y - b1.y) * (a1.x - b1.x);
        var ub_t = (a2.x - a1.x) * (a1.y - b1.y) - (a2.y - a1.y) * (a1.x - b1.x);
        var u_b = (b2.y - b1.y) * (a2.x - a1.x) - (b2.x - b1.x) * (a2.y - a1.y);

        if (u_b != 0) {
            var ua = ua_t / u_b;
            var ub = ub_t / u_b;

            if (0 <= ua && ua <= 1 && 0 <= ub && ub <= 1) {
                result = true;
                // result.points.push(
                //     new Point2D(
                //         a1.x + ua * (a2.x - a1.x),
                //         a1.y + ua * (a2.y - a1.y)
                //     )
                // );
            }
        }

        return result;
    },
    pathToPoints(path, tolerance, minDistance) {
        if (!path) {
            return [];
        }

        tolerance = tolerance || 1.005;
        minDistance = minDistance || 5;

        let getSegmentData = function (path) {
            let segList = path.pathSegList;

            let segLengthList = [];
            let lastAddedLength = null;
            let lengthPath = document.createElementNS("http://www.w3.org/2000/svg", 'path');

            for (let i = 0; i < segList.numberOfItems; i += 1) {
                let segment = segList.getItem(i);
                lengthPath.pathSegList.appendItem(segment);
                let currentLength = lengthPath.getTotalLength();
                if (currentLength != lastAddedLength) {
                    segLengthList.push({
                        length: currentLength,
                        type: segment.pathSegTypeAsLetter.toUpperCase()

                    });
                    lastAddedLength = currentLength;
                }
            }
            return segLengthList;
        };

        let segInfo = getSegmentData(path);

        let getDist = function (p1, p2) {
            return Math.sqrt(
                (Math.pow(p1.x - p2.x, 2)) +
                (Math.pow(p1.y - p2.y, 2))
            );
        };

        let interpolate = function (start, end) {
            let realDist = Math.abs(end - start);
            let p1 = path.getPointAtLength(start);
            let p2 = path.getPointAtLength(end);
            let fakeDist = getDist(p1, p2);

            if (realDist === 0) {
                return [];
            }

            if (fakeDist !== 0 && realDist / fakeDist <= tolerance) {
                return [];
            }

            if (fakeDist !== 0 && fakeDist <= minDistance) {
                return [];
            }

            let half = realDist / 2 + start;

            return [].concat(
                interpolate(start, half),
                path.getPointAtLength(half),
                interpolate(half, end)
            )
        };

        let output = [];
        for (let i = 1; i < segInfo.length; i += 1) {
            output.push(path.getPointAtLength(segInfo[i - 1].length));
            output.push(interpolate(segInfo[i - 1].length, segInfo[i].length));
        }

        output.push(path.getPointAtLength(segInfo[segInfo.length - 1].length));

        return [].concat(...output);
    },
    pointsToVertices(points) {
        let vertices = [];
        for (let i = 1; i < points.length; i += 1) {
            let p1 = points[i - 1];
            let p2 = points[i];
            let v = new Vertex(p1, p2);
            vertices.push(v);
        }
        return vertices;
    },
    random (arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    },
    findSide (vertex, point) {
        let d = (point.x - vertex.p1.x) * (vertex.p2.y - vertex.p1.y) - (point.y - vertex.p1.y) * (vertex.p2.x - vertex.p1.x);
        return Math.sign(d);
    }

};
