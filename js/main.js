window.addEventListener('load', () => {
    let game = new Game();

    let track = 'track1';
    let svg = $.get({
       url: track + '.svg',
       async: false
    });

    game.loadLevel(svg.responseXML);
    game.start();
});


function Game() {
    const SVG_PRECISION = 50;
    let canvas = document.getElementById('gc');
    let ctx = canvas.getContext("2d");
    let player = new Player();
    let level = new Level();
    let start = null;
    let bodies = [
        player
    ];

    this.loadLevel = function(svg) {
        //TODO: use correct vewbox
        let vertices = [];
        let svgEl = svg.firstElementChild;
        // console.dir(svgEl);
        $(svg).find('path').toArray().forEach(path => {
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

        level.vertices = vertices;
    };

    this.start = function () {
        document.addEventListener("keydown", onKeydown);
        document.addEventListener("keyup", onKeyup);
        window.requestAnimationFrame(loop);
    };

    function onKeydown(e) {
        switch (e.key) {
            // LEFT
            case "ArrowLeft":
                player.steerOn("left");
                break;

            // RIGHT
            case "ArrowRight":
                player.steerOn("right");
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
        let timediff = timestamp - start;
        if (!start) {
            start = timestamp;
            window.requestAnimationFrame(loop);
            return;
        }

        start = timestamp;
        console.log(timediff);

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




        window.requestAnimationFrame(loop);
    }
}

function Player() {
    this.position = {
        x: 400,
        y: 450
    };
    this.height = 30;
    this.width = 10;

    this.angle = 90;
    this.anglespeed = 0;
    this.anglespeedAccel = 0.7;
    this.anglespeedMinMax = 3;
    this.anglespeedBrake = 3.4;

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
        this.angle %= 360;

        // steering
        if (this.controls["left"] === this.controls["right"]) {
            let sign = Math.sign(this.anglespeed);
            this.anglespeed -= sign * this.anglespeedAccel;
            if (sign !== Math.sign(this.anglespeed)) {
                this.anglespeed = 0;
            }
        } else if (this.controls["left"]) {
            this.anglespeed -= this.anglespeedAccel;
            this.angle += this.anglespeed * (timediff / 30);
        } else if (this.controls["right"]) {
            this.anglespeed += this.anglespeedAccel;
            this.angle += this.anglespeed * (timediff / 30);
        }

        this.angle += this.anglespeed * (timediff / 30);

        this.anglespeed = Math.min(this.anglespeed, this.anglespeedMinMax);
        this.anglespeed = Math.max(this.anglespeed, -this.anglespeedMinMax);

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
        console.log(this.angle);
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
        this.speed = this.speed / 2;

        let collisionAngle = Math.atan2(p1.x - p2.x, p1.y - p2.y) * 180 / Math.PI;
        console.log("Collision!" + collisionAngle);
        this.angle += collisionAngle + 90;

    }


}

function Level(vertices) {
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

    this.draw = function (ctx) {

        this.vertices.forEach(path => {
            ctx.beginPath();
            let lastPoint = path[path.length - 1];
            ctx.moveTo(lastPoint.x, lastPoint.y);
            path.forEach(p => {
                ctx.lineTo(p.x, p.y);
                ctx.stroke();
            });

        });
    };

    this.collide = function (body) {
        let result = false;
        let prevBodyPoint = body.vertices[body.vertices.length - 1];
        let that = this;
        body.vertices.some(bodyPoint => {
            that.vertices.some(polygon => {
                let prevLevelPoint = polygon[polygon.length - 1];
                polygon.some(levelPoint => {
                    if (Util.intersectLineLine(prevBodyPoint, bodyPoint, prevLevelPoint, levelPoint)) {
                        body.onCollide(prevLevelPoint, levelPoint);
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
    }
};
