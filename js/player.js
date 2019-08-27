import EventEmitter from './eventEmitter.js';
import Util from './util.js';
import Vertex from './vertex.js';

export default class Player extends EventEmitter{
    constructor(color, layers) {
        super();

        this.skidmarkMaxSegmentLength = 5;
        this.skidmarkMaxPathLength = 100;
        
        this.position = {
            x: 400,
            y: 350
        };
        this.height = 20;
        this.width = 7;

        this.PHYSICS_TYPE = {
            FAST: {
                anglespeedAccel: 1.5,
                anglespeedMinMax: 5,
                anglespeedBrake: 5,
                maxSpeed: 20,
                minSpeed: 2,
                acceleration: 0.8
            },
            SLOW: {
                anglespeedAccel: 1.5,
                anglespeedMinMax: 6,
                anglespeedBrake: 7,
                maxSpeed: 20,
                minSpeed: 2,
                acceleration: 0.6
            }
        }

        this.physics = this.PHYSICS_TYPE.SLOW;
        this.angle = 90;
        this.anglespeed = 0;
        this.speed = this.physics.minSpeed;

        this.verbose = false;
        this.moveVector = [];
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

        this.normalizedBodyVertices = [
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
        this.frontVertex = {
            x: 0,
            y: -this.height / 2
        }

        this.layers = layers;
        this.skidmark = new Path({
            strokeColor: new Color(0, 0, 0, 0.75),
            strokeWidth: 4,
            strokeCap: 'butt',
            strokeJoin: 'round',
            dashArray: [1.5, 1.5]
        });

        this.skidmarkRasterGroup = new Group();
        this.skidmarkRasterGroup.addChild(this.skidmark);
        this.layers.skidmarks.addChild(this.skidmarkRasterGroup);

        if (this.verbose) {
            this.debugVector = new Path.Line({
                from: this.frontVertex,
                to: this.frontVertex,
                strokeWidth: 5,
                strokeColor: 'pink'
            });

            this.debugBody = new Path({
                segments: this.normalizedBodyVertices,
                strokeWidth: 4,
                strokeColor: 'purple',
                closed: true
            });
    
        }
    }

    async init() {
        this.svg = await Util.loadSvg(`img/moto-${this.color}.svg`);

        this.body = project.importSVG(this.svg, {
            insert: false
        });

        this.wheels = {
            front: this.body.children["front-wheel"],
            back: this.body.children["back-wheel"]
        }

        this.layers.players.addChild(this.body);
        this.body.applyMatrix = false;

        if (this.verbose) {
            this.layers.players.addChild(this.debugVector);
            this.layers.players.addChild(this.debugBody);
        }
        
    }

    move(timediff) {
        if (this.started) {
            this.angle = Util.normalizeAngle(this.angle);

            if (!this.inCollision) {
                // steering
                if (this.controls["left"] === this.controls["right"]) {
                    let sign = Math.sign(this.anglespeed);
                    this.anglespeed -= sign * this.physics.anglespeedAccel * (timediff / 30);
                    if (sign !== Math.sign(this.anglespeed)) {
                        this.anglespeed = 0;
                    }
                } else if (this.controls["left"]) {
                    this.anglespeed -= this.physics.anglespeedAccel * (timediff / 30);
                } else if (this.controls["right"]) {
                    this.anglespeed += this.physics.anglespeedAccel * (timediff / 30);
                }

                this.angle += this.anglespeed * (timediff / 30);

                this.anglespeed = Math.min(this.anglespeed, this.physics.anglespeedMinMax);
                this.anglespeed = Math.max(this.anglespeed, -this.physics.anglespeedMinMax);

                this.lastPosition = this.position;
            } else {
                this.revertPosition();
                this.angle += this.anglespeed;
            }

            this.speed += this.physics.acceleration - (Math.abs(this.anglespeed) / this.physics.anglespeedBrake);
            this.speed = Math.min(this.speed, this.physics.maxSpeed);
            this.speed = Math.max(this.speed, this.physics.minSpeed);

            let dx = Math.sin(this.angle * (Math.PI / 180));
            let dy = -Math.cos(this.angle * (Math.PI / 180));

            //add power to velocity to get new point

            this.position = {
                x: this.position.x + dx * this.speed * (timediff / 30),
                y: this.position.y + dy * this.speed * (timediff / 30)
            };

            this.updateVertices();
        }

        if (this.startedLap) {
            this.lapTime += timediff;
        }
    }

    updateVertices() {
        // moveVector
        this.oldFrontVertex = this.newFrontVertex;
        this.newFrontVertex = Util.movePoint(Util.rotatePoint(this.frontVertex, this.angle), this.position);
        this.moveVector = new Vertex(this.oldFrontVertex ? this.oldFrontVertex : this.newFrontVertex, 
            this.newFrontVertex);

        // bodyVector
        this.bodyPoints = [];
        this.normalizedBodyVertices.forEach(p => {
            this.bodyPoints.push(Util.movePoint(Util.rotatePoint(p, this.angle), this.position));
        });

        this.bodyPoints.push(this.bodyPoints[0]); // close the loop

        this.bodyVector = Vertex.fromPoints(this.bodyPoints)
        
    }

    draw(e) {
        this.body.position = new Point(this.position);
        this.body.rotation = this.angle + this.speed * this.anglespeed;
  
        this.wheels.front.rotation = (-this.speed + this.physics.maxSpeed / 3) * this.anglespeed;

        if (this.verbose) {
            this.debugVector.segments[0].point = new Point(this.oldFrontVertex);
            this.debugVector.segments[1].point = new Point(this.newFrontVertex);

            for (let i = 0; i < this.bodyVector.length; i += 1) {
                this.debugBody.segments[i].point = new Point(this.bodyVector[i].p1);
            }
        }

        if (!this.lastPosition ||
            (this.lastPosition.x == this.position.x &&
                 this.lastPosition.y == this.position.y)) {
            return;
        }

        if (!this.body.inCollision) {
            this.drawSkidmarks();
        }
    };

    drawSkidmarks() {
        let newPoint = this.wheels.back.localToGlobal(this.wheels.back.position);
        if (this.skidmark.lastCurve &&
            this.skidmark.lastCurve.length < this.skidmarkMaxSegmentLength) {
            this.skidmark.lastSegment.point = newPoint;
        }
        else {
            this.skidmark.add(newPoint);
        }
        if (this.skidmark.length > this.skidmarkMaxPathLength) {
            // this.skidmark.simplify();
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
            this.layers.skidmarks.addChild(this.skidmarkRasterGroup);
        }
    }

    checkLap(startLine) {
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

    finishAndStartLap() {
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

    steerOff(s) {
        if (!s) {
            // turn all off
            Object.keys(this.controls).forEach(control => {
               this.controls[control] = 0;
            });
        } else {
            this.controls[s] = 0;
        }

    };

    steerOn(s) {
        this.controls[s] = 1;
    };

    onCollide(collisions) {
        this.inCollision = true;

        this.speed /= 2; // slow it a bit
        this.speed = Math.max(this.speed, this.physics.minSpeed);

        let vertex = collisions[0];
        let collisionAngle = ((Math.atan2(vertex.p1.y - vertex.p2.y, vertex.p1.x - vertex.p2.x) * 180 / Math.PI) - 90);
        collisionAngle = Util.normalizeAngle(collisionAngle, 180);
        
        vertex = new Vertex(this.oldFrontVertex, this.newFrontVertex);
        let playerAngle = ((Math.atan2(vertex.p1.y - vertex.p2.y, vertex.p1.x - vertex.p2.x) * 180 / Math.PI) - 90)
        playerAngle = Util.normalizeAngle(playerAngle, 180);
        
        if (collisionAngle - 90 < playerAngle && playerAngle < collisionAngle) {
            this.anglespeed = this.physics.anglespeedMinMax;
        } else if (collisionAngle + 90 < playerAngle) {
            this.anglespeed = this.physics.anglespeedMinMax;
        } else {
            this.anglespeed = -this.physics.anglespeedMinMax;
        }
    };

    revertPosition() {
        this.position = this.lastPosition;
        this.newFrontVertex = this.oldFrontVertex;
    }

    dispose() {
        this.body.remove();
        if (this.verbose) {
            this.debugVector.remove();
            this.debugBody.remove();
        }
    };
}
