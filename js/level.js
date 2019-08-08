export default class Level {
    constructor() {
        this.vertices = [];
        this.verbose = false;
        this.startPoints = [];
        this.startLine = null;
    }
    

    /**
     * NOT USED since using Paper JS
     * @deprecated
     * Draw level.
     * @param {CanvasRenderingContext2D} ctx 
     */
    draw(ctx) {
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

    collide(body) {
        let result = false;

        body.vertices.some(bodyVertex => {
            this.vertices.some(levelVertex => {
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

    updateImage(svg) {
        this.img = project.importSVG(svg, {
            insert: false
        });
    };

    dispose() {
        if (this.img) {
            this.img.remove();
        }
    }

}
