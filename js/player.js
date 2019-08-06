import { Util, Vertex } from './util.js';

export default function Player(color, layers) {
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
