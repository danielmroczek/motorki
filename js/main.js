window.addEventListener('load', () => {
    paper.install(window);

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
            game.stop();
        }
        game = new Game();
        game.loadLevel('tracks/' + track + '.svg');
        game.start();
    }
});

function Game() {
    const SVG_PRECISION = 1.001; // closer to 1 -> better precision
    const FPS = 60;
    const canvas = document.getElementById('gc');
    const ctx = canvas.getContext("2d");
    let that = this;
    that.stopped = false;

    let player;
    let level;
    let bodies = [];
    let starttime;

    // Paper.js things
    paper.setup(canvas);
    view.onFrame = drawLoop;
    view.draw();

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
        level.layer.importSVG(svg);
        level.updateImage(svgSource);

        $(svg).find('metadata > start').each((i, startPoint) => {
            startPoint = $(startPoint);
            level.startPoints.push({
                x: parseInt(startPoint.attr('x')),
                y: parseInt(startPoint.attr('y')),
                angle: startPoint.attr('a'),
                speed: startPoint.attr('s') // unused for now
            });
        });
    };

    this.start = function () {
        player = new Player();
        that.stopped = null;
        bodies = [
            player
        ];

        let startPoint = level.startPoints[Math.floor(Math.random() * level.startPoints.length)];
        player.position = {
            x: startPoint.x,
            y: startPoint.y,
        };
        player.angle = startPoint.angle;

        document.addEventListener("keydown", onKeydown);
        document.addEventListener("keyup", onKeyup);

        //window.requestAnimationFrame(drawLoop);
        setTimeout(loop, 1000 / FPS);
    };

    this.stop = function () {
        let promise = new Promise((res, rej) => {
            that.stopped = res;
        });

        document.removeEventListener("keydown", onKeydown);
        document.removeEventListener("keyup", onKeyup);
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

    function loop() {
        let timestamp = new Date().getTime();
        if (!starttime) {
            starttime = timestamp;
            setTimeout(loop, 1000 / FPS);
            return;
        }
        let timediff = timestamp - starttime;

        starttime = timestamp;
        // console.log(timediff);

        bodies.forEach(body => {
            body.move(timediff);
            //collideBodies(body);
            level.collide(body);

            if (body.position.x < 0) {
                body.position.x = canvas.width;
            }
            if (body.position.x > canvas.width) {
                body.position.x = 0;
            }
            if (body.position.y < 0) {
                body.position.y = canvas.height;
            }
            if (body.position.y > canvas.height) {
                body.position.y = 0;
            }
        });

        if (!that.stopped) {
            setTimeout(loop, 1000 / FPS);
        } else {
            that.stopped();
        }
    }

    function drawLoop() {
        // ctx.fillStyle = "white";
        // ctx.fillRect(0, 0, canvas.width, canvas.height);

        // level.draw(ctx);

        bodies.forEach(body => {
            body.draw();
        });

        //window.requestAnimationFrame(drawLoop);
    }
}
function Player() {
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

    this.started = false;

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

    let body = new Path.Rectangle(this.position, [this.width, this.height]);
    body.strokeColor = this.colors.front;
    body.fillColor = this.colors.main;
    body.applyMatrix = false;


    this.updateVertices = function () {
        let points = [];
        defaultVertices.forEach(p => {
            points.push(Util.movePoint(Util.rotatePoint(p, this.angle), this.position));
        });

        points.push(points[0]);
        let newVertices = Util.pointsToVertices(points);

        this.vertices = newVertices;
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
        //console.log(this.angle);
    };

    //TODO: remove all ctx-canvas stuff
    this.draw = function (ctx) {

        body.position = new Point(this.position);
        body.rotation = this.angle;
        console.log(body.rotation);

        // ctx.save();
        //
        // let points = [];
        // this.vertices.forEach(v => {
        //     points.push([v.p1.x, v.p1.y]);
        // });
        //
        // //let body = new Path(points);
        // //body.strokeColor = 'black';
        // //body.fillColor = 'white';
        //
        // ctx.translate(this.position.x, this.position.y);
        // ctx.rotate(this.angle * Math.PI / 180);
        //
        // ctx.fillStyle = this.colors.main;
        // ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
        //
        // ctx.fillStyle = this.colors.front;
        // ctx.fillRect(-this.width / 2, (-this.height / 2) - 2, this.width, 6);
        //
        // ctx.fillStyle = this.colors.back;
        // ctx.fillRect(-this.width / 2, (this.height / 2) - 2, this.width, 6);
        //
        // ctx.restore();
        //
        // if (this.verbose) {
        //     ctx.beginPath();
        //     this.vertices.forEach((p) => {
        //         ctx.beginPath();
        //         ctx.arc(p.x, p.y, 2, 0, 2 * Math.PI, false);
        //         ctx.fillStyle = this.colors.debug;
        //         ctx.fill();
        //     });
        //
        // }
    };

    this.steerOff = function (s) {
        this.controls[s] = 0;
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

    }


}
function Level() {
    this.svg;
    this.vertices = [];
    this.verbose = false;
    this.startPoints = [];

    this.layer = new Layer();

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
        this.img = new Image();
        this.img.src = svg;
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
    rotatePoint: function (point, angle) {
        angle = angle * Math.PI / 180.0;
        return {
            x: Math.cos(angle) * (point.x) - Math.sin(angle) * (point.y),
            y: Math.sin(angle) * (point.x) + Math.cos(angle) * (point.y)
        };
    },
    movePoint: function (point, vector) {
        return {
            x: point.x + vector.x,
            y: point.y + vector.y
        }
    },
    intersectLineLine: function (a1, a2, b1, b2) {
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
    pathToPoints: function pathToPointsAdaptiveSegments(path, tolerance, minDistance) {
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
        console.dir(segInfo);

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
    pointsToVertices: function (points) {
        let vertices = [];
        for (let i = 1; i < points.length; i += 1) {
            let p1 = points[i - 1];
            let p2 = points[i];
            let v = new Vertex(p1, p2);
            vertices.push(v);
        }
        return vertices;
    }

};
