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
    this.height = 50;
    this.width = 10;

    this.angle = 0;
    this.anglespeed = 5;

    this.maxSpeed = 20;
    this.minSpeed = 2;
    this.speed = this.minSpeed;
    this.acceleration = 0.9;

    this.controls = {
        "left": 0,
        "right": 0
    };

    this.reset = function () {
        this.x = 400;
        this.y = 300;
    };

    this.move = function () {
        this.angle %= 360;

        var dx = Math.sin(this.angle * (Math.PI / 180));
        var dy = -Math.cos(this.angle * (Math.PI / 180));

        //add power to velocity to get new point

        this.x += dx * this.speed;
        this.y += dy * this.speed;

        // steering

        let angleSpeed = this.controls["left"] * -this.anglespeed + this.controls["right"] * this.anglespeed;
        this.angle += angleSpeed;

        this.speed += this.acceleration - Math.abs(angleSpeed) / 4.5;
        this.speed = Math.min(this.speed, this.maxSpeed);
        this.speed = Math.max(this.speed, this.minSpeed);

        console.log(this.speed);
    };

    this.draw = function (ctx) {
        ctx.save();
        ctx.fillStyle = "red";
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle * Math.PI / 180);
        ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
        //ctx.translate(this.x, this.y);
        ctx.restore();
    };

    this.steer = function (amount) {
        this.anglespeed += amount;

    };

    this.steerOff = function (s) {
        this.controls[s] = 0;
    };

    this.steerOn = function (s) {
        this.controls[s] = 1;
    };


}
