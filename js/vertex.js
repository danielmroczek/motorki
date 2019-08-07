import Util from './util.js';

export default class Vertex {
    constructor(p1, p2) {
        this.p1 = p1;
        this.p2 = p2;

        this.x = Math.min(p1.x, p2.x);
        this.y = Math.min(p1.y, p2.y);

        this.width = Math.max(p1.x, p2.x) - this.x;
        this.height = Math.max(p1.y, p2.y) - this.y;
    }

    /**
     * 
     * @param {Array} points 
     * @returns {Array} array of vertices
     */
    static fromPoints(points) {
        let vertices = [];
        for (let i = 1; i < points.length; i += 1) {
            let p1 = points[i - 1];
            let p2 = points[i];
            let v = new Vertex(p1, p2);
            vertices.push(v);
        }
        return vertices;
    }

    boundingBoxCollision(vertex) {
        return this.x < vertex.x + vertex.width &&
            this.x + this.width > vertex.x &&
            this.y < vertex.y + vertex.height &&
            this.height + this.y > vertex.y;
    }

    collide(vertex) {
        return this.boundingBoxCollision(vertex) && Util.intersectLineLine(this.p1, this.p2, vertex.p1, vertex.p2);
    }
}