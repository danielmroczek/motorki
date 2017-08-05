window.addEventListener('load', () => {
    let game = new Game();
    game.start();
});


function Game() {
    let canvas = document.getElementById('gc');
    let ctx = canvas.getContext("2d");
    let player = new Player();


    this.start = function () {
        document.addEventListener("keydown", onKeydown);
        document.addEventListener("keyup", onKeyup);
        setInterval(loop, 1000 / 30);
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

    function loop() {
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        player.move();
        player.draw(ctx);

        if (player.x < 0) {
            player.x = canvas.width;
        }
        if (player.x > canvas.width) {
            player.x = 0;
        }
        if (player.y < 0) {
            player.y = canvas.height;
        }
        if (player.y > canvas.height) {
            player.y = 0;
        }
    }
}

function Player() {
    this.x = 400;
    this.y = 300;
    this.height = 30;
    this.width = 10;

    this.angle = 0;
    this.anglespeed = 0;
    this.anglespeedAccel = 2;
    this.anglespeedMinMax = 8;
    this.anglespeedBrake = 5;

    this.maxSpeed = 30;
    this.minSpeed = 2;
    this.speed = this.minSpeed;
    this.acceleration = 0.9;

    this.verbose = true;

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

    this.reset = function () {
        this.x = 400;
        this.y = 300;
    };

    this.updateVertices = function () {
        let newVertices = [];

        defaultVertices.forEach((p) => {
            newVertices.push(Util.movePoint(Util.rotatePoint(p, this.angle), {
                x: this.x,
                y: this.y
            }));
        });

        this.vertices = newVertices;

    };

    this.move = function () {
        this.angle %= 360;

        // steering
        if (this.controls["left"] === this.controls["right"]) {
            this.anglespeed -= Math.sign(this.anglespeed) * this.anglespeedAccel;
        } else if (this.controls["left"]) {
            this.anglespeed -= this.anglespeedAccel;
        } else if (this.controls["right"]) {
            this.anglespeed += this.anglespeedAccel;
        }
        console.log(this.anglespeed + " " + this.controls.left + " " + this.controls.right);

        this.angle += this.anglespeed;
        this.anglespeed = Math.min(this.anglespeed, this.anglespeedMinMax);
        this.anglespeed = Math.max(this.anglespeed, -this.anglespeedMinMax);

        this.speed += this.acceleration - (Math.abs(this.anglespeed) / this.anglespeedBrake);
        this.speed = Math.min(this.speed, this.maxSpeed);
        this.speed = Math.max(this.speed, this.minSpeed);

        let dx = Math.sin(this.angle * (Math.PI / 180));
        let dy = -Math.cos(this.angle * (Math.PI / 180));

        //add power to velocity to get new point

        this.x += dx * this.speed;
        this.y += dy * this.speed;

        this.updateVertices();
        console.log(this.speed);
    };

    this.draw = function (ctx) {
        ctx.save();

        ctx.translate(this.x, this.y);
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


}

function Level(vertices) {


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
    }
};
