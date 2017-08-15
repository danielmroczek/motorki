window.addEventListener('load', () => {
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
    const SVG_PRECISION = 30;
    const canvas = document.getElementById('gc');
    const ctx = canvas.getContext("2d");
    let that = this;
    that.stopped = false;

    let player;
    let level;
    let bodies = [];
    let starttime;


    this.loadLevel = function (svgSource) {
        let svg = $.get({
            url: svgSource,
            async: false
        }).responseXML;

        let vertices = [];
        let svgEl = svg.firstElementChild;
        // console.dir(svgEl);
        $(svg).find('path.track').toArray().forEach(path => {
            let length = path.getTotalLength();
            let i = 0;
            let polygon = [];

            while (i < length) {
                let point = path.getPointAtLength(i);
                polygon.push(point);
                i += SVG_PRECISION;
            }
            vertices.push(polygon);
        });

        level = new Level();
        level.vertices = vertices;
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


        window.requestAnimationFrame(loop);
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
        //setTimeout(0, );
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

    function loop(timestamp) {
        //let timestamp = new Date().getTime();
        let timediff = timestamp - starttime;
        if (!starttime) {
            starttime = timestamp;
            window.requestAnimationFrame(loop);
            return;
        }

        starttime = timestamp;
        //console.log(timediff);

        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        level.draw(ctx);

        bodies.forEach(body => {
            body.move(timediff);
            body.draw(ctx);
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
            window.requestAnimationFrame(loop);
        } else {
            that.stopped();
        }
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


    this.updateVertices = function () {
        let newVertices = [];

        defaultVertices.forEach((p) => {
            newVertices.push(Util.movePoint(Util.rotatePoint(p, this.angle), this.position));
        });

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

            this.updateVertices();
        }
        //console.log(this.angle);
    };

    this.draw = function (ctx) {
        ctx.save();

        ctx.translate(this.position.x, this.position.y);
        ctx.rotate(this.angle * Math.PI / 180);

        ctx.fillStyle = this.colors.main;
        ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);

        ctx.fillStyle = this.colors.front;
        ctx.fillRect(-this.width / 2, (-this.height / 2) - 2, this.width, 6);

        ctx.fillStyle = this.colors.back;
        ctx.fillRect(-this.width / 2, (this.height / 2) - 2, this.width, 6);

        ctx.restore();

        if (this.verbose) {
            ctx.beginPath();
            this.vertices.forEach((p) => {
                ctx.beginPath();
                ctx.arc(p.x, p.y, 2, 0, 2 * Math.PI, false);
                ctx.fillStyle = this.colors.debug;
                ctx.fill();
            });

        }
    };

    this.steerOff = function (s) {
        this.controls[s] = 0;
    };

    this.steerOn = function (s) {
        this.controls[s] = 1;
    };

    this.onCollide = function (p1, p2) {
        // What to do?

        this.position = this.lastPosition;
        this.speed /= 3;

        let collisionAngle = (Math.atan2(p1.y - p2.y, p1.x - p2.x) * 180 / Math.PI) - 90;
        this.angle = -this.angle + 2 * (collisionAngle);

    }


}

function Level() {
    this.svg;
    this.vertices = [
        [{
            x: 300,
            y: 25
        }, {
            x: 900,
            y: 25
        }, {
            x: 1150,
            y: 175
        }, {
            x: 1150,
            y: 425
        }, {
            x: 900,
            y: 575
        }, {
            x: 300,
            y: 575
        }, {
            x: 50,
            y: 425
        }, {
            x: 50,
            y: 175
        }], [
            {
                x: 325,
                y: 250
            }, {
                x: 875,
                y: 250
            }, {
                x: 900,
                y: 275
            }, {
                x: 900,
                y: 325
            }, {
                x: 875,
                y: 350
            }, {
                x: 325,
                y: 350
            }, {
                x: 300,
                y: 325
            }, {
                x: 300,
                y: 275
            }
        ]];
    this.verbose = false;
    this.startPoints = [];

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
        let prevBodyPoint = body.vertices[body.vertices.length - 1];
        body.vertices.some(bodyPoint => {
            that.vertices.some(polygon => {
                let prevLevelPoint = polygon[polygon.length - 1];
                polygon.some(levelPoint => {
                    if (Util.intersectLineLine(prevBodyPoint, bodyPoint, prevLevelPoint, levelPoint)) {
                        if (!body.inCollision) {
                            body.onCollide(prevLevelPoint, levelPoint);
                            body.inCollision = true;
                        }
                        result = true;
                    }
                    prevLevelPoint = levelPoint;
                    return result;
                });
                return result
            });
            prevBodyPoint = bodyPoint;
            return result
        });
        if (!result) {
            body.inCollision = false;
        }
    }

    this.updateImage = function (svg) {
        this.img = new Image();
        this.img.src = svg;
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

    pathToPolygon: function (path, samples) {
        if (!samples) samples = 0;

        // Put all path segments in a queue
        for (var segs = [], s = path.pathSegList, i = s.numberOfItems - 1; i >= 0; --i) {
            segs[i] = s.getItem(i);
        }
        var segments = segs.concat();

        var lastSeg = null, points = [], x = 0, y = 0;
        var addSegmentPoint = function (s) {
            if (s.pathSegType == SVGPathSeg.PATHSEG_CLOSEPATH) {

            } else {
                if (s.pathSegType % 2 == 1 && s.pathSegType > 1) {
                    // All odd-numbered path types are relative, except PATHSEG_CLOSEPATH (1)
                    x += s.x;
                    y += s.y;
                } else {
                    x = s.x;
                    y = s.y;
                }
                var lastPoint = points[points.length - 1];
                if (!lastPoint || x != lastPoint[0] || y != lastPoint[1]) {
                    points.push({
                        x, y
                    });
                }
            }
        };
        for (var d = 0, len = path.getTotalLength(), step = len / samples; d <= len; d += step) {
            var seg = segments[path.getPathSegAtLength(d)];
            var pt = path.getPointAtLength(d);
            if (seg !== lastSeg) {
                lastSeg = seg;
                while (segs.length && segs[0] != seg) addSegmentPoint(segs.shift());
            }
            var lastPoint = points[points.length - 1];
            if (!lastPoint || pt.x != lastPoint[0] || pt.y != lastPoint[1]) {
                points.push(pt);
            }
        }
        for (var i = 0, len = segs.length; i < len; ++i) addSegmentPoint(segs[i]);
        return points;
    }
};
