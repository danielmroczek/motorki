export default {
    rotatePoint(point, angle) {
        angle = angle * Math.PI / 180.0;
        return {
            x: Math.cos(angle) * (point.x) - Math.sin(angle) * (point.y),
            y: Math.sin(angle) * (point.x) + Math.cos(angle) * (point.y)
        };
    },

    movePoint(point, vector) {
        return {
            x: point.x + vector.x,
            y: point.y + vector.y
        }
    },

    intersectLineLine(a1, a2, b1, b2) {
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

    pathToPoints(path, tolerance = 1.005, minDistance = 5) {
        if (!path) {
            return [];
        }

        let getSegmentData = function (path) {
            let segList = path.pathSegList;

            let segLengthList = [];
            let lastAddedLength = null;
            let lengthPath = document.createElementNS("http://www.w3.org/2000/svg", 'path');

            for (let i = 0; i < segList.numberOfItems; i += 1) {
                let segment = segList.getItem(i);
                lengthPath.pathSegList.appendItem(segment);
                let currentLength = lengthPath.getTotalLength();
                if (currentLength != lastAddedLength) {
                    segLengthList.push({
                        length: currentLength,
                        type: segment.pathSegTypeAsLetter.toUpperCase()

                    });
                    lastAddedLength = currentLength;
                }
            }
            return segLengthList;
        };

        let segInfo = getSegmentData(path);

        let getDist = function (p1, p2) {
            return Math.sqrt(
                (Math.pow(p1.x - p2.x, 2)) +
                (Math.pow(p1.y - p2.y, 2))
            );
        };

        let interpolate = function (start, end) {
            let realDist = Math.abs(end - start);
            let p1 = path.getPointAtLength(start);
            let p2 = path.getPointAtLength(end);
            let fakeDist = getDist(p1, p2);

            if (realDist === 0) {
                return [];
            }

            if (fakeDist !== 0 && realDist / fakeDist <= tolerance) {
                return [];
            }

            if (fakeDist !== 0 && fakeDist <= minDistance) {
                return [];
            }

            let half = realDist / 2 + start;

            return [].concat(
                interpolate(start, half),
                path.getPointAtLength(half),
                interpolate(half, end)
            )
        };

        let output = [];
        for (let i = 1; i < segInfo.length; i += 1) {
            output.push(path.getPointAtLength(segInfo[i - 1].length));
            output.push(interpolate(segInfo[i - 1].length, segInfo[i].length));
        }

        output.push(path.getPointAtLength(segInfo[segInfo.length - 1].length));

        return [].concat(...output);
    },
    
    random (arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    },

    /**
     * Return a shuffled version of an array. Doesn't change original array.
     * 
     * @param {Array} arr An array to shuffle
     * @returns {Array} Shuffled Array
     */
    shuffle([...arr]) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i],arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    },
    
    findSide (vertex, point) {
        let d = (point.x - vertex.p1.x) * (vertex.p2.y - vertex.p1.y) - (point.y - vertex.p1.y) * (vertex.p2.x - vertex.p1.x);
        return Math.sign(d);
    },

    /**
     * @async
     * Loads provided uri as svg document.
     * 
     * @param {String} svgSource uri for svg
     * @returns {Document} svg as document
     */
    async loadSvg(svgSource) {
        let svgText = await (await fetch(svgSource)).text();
        return new DOMParser().parseFromString(svgText, "image/svg+xml");
    }

};