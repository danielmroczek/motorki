export default function Level() {
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
