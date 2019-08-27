import Util from "./util.js";
import Vertex from "./vertex.js";

export default class Level {

    /**
     * 
     * @param {Document} svg 
     */
    constructor(svg) {
        if (!svg) {
            return;
        }

        this.verbose = false;

        // vertices for collisions with track
        this.vertices = [];
        svg.querySelectorAll('path.track').forEach(path => {
            let points = Util.pathToPoints(path, this.SVG_PRECISION);
            this.vertices = this.vertices.concat(Vertex.fromPoints(points));
        });

        // start points for each player
        this.startPoints = [];
        svg.querySelectorAll('metadata > start').forEach(startPoint => {
            this.startPoints.push({
                x: parseInt(startPoint.getAttribute('x')),
                y: parseInt(startPoint.getAttribute('y')),
                angle: parseInt(startPoint.getAttribute('a')),
                speed: parseInt(startPoint.getAttribute('s')) // unused for now
            });
        });

        // start line for time measuring
        let startLinePath = svg.querySelector('path.startline');
        if (startLinePath) {
            let start = startLinePath.getPointAtLength(0);
            let end = startLinePath.getPointAtLength(startLinePath.getTotalLength());
            this.startLine = new Vertex(start, end);
        }

        this.img = project.importSVG(svg, {
            insert: false
        });

        this.background = svg.querySelector('.background').style.fill;
    }

    /**
     * Builder like method.
     * 
     * @param {String} svgSource url with svg uri 
     */
    static async load(svgSource) {
        let svg = await Util.loadSvg(svgSource);
        return new Level(svg);
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
        let collisions = [];
        this.vertices.forEach(levelVertex => {
            if (levelVertex.collide(body.moveVector)) {
                collisions.push(levelVertex);
            }
        });

        if (collisions.length) {
            if (!body.inCollision) {
                body.onCollide(collisions);
            }
            return true;
        } 

        return false;
    };

    dispose() {
        if (this.img) {
            this.img.remove();
        }
    }

}
