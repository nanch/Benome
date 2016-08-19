/*
Copyright 2016 Steve Hazel

This file is part of Benome.

Benome is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License version 3
as published by the Free Software Foundation.

Benome is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with Benome. If not, see http://www.gnu.org/licenses/.
*/

// Libs
var _ = require('underscore');

// -------------

var CubicBezierCurve = function(P1, C1, C2, P2) {
    this.P1 = P1;
    this.C1 = C1;
    this.C2 = C2;
    this.P2 = P2;

    this.lengths = [];
};

_.extend(CubicBezierCurve.prototype, {
    getPointsArray: function() {
        return [
            this.C1.x,
            this.C1.y,
            this.C2.x,
            this.C2.y,
            this.P2.x,
            this.P2.y,
            this.P1.x,
            this.P1.y
        ]
    },

    getLength: function(step) {
        var stepInt = Math.round(step * 1000);
        if (this.lengths[stepInt]) {
            return this.lengths[stepInt];
        }

        step = step || 0.1;

        var func = function(ctx, t, x1, y1, x2, y2, options, totalLength) {
            // distance between the points
            if (!totalLength) totalLength = 0;
            return totalLength + (Math.pow(Math.pow((x2 - x1), 2) + Math.pow((y2 - y1), 2), 0.5));
        }

        var length = this.iterateSegments(func, {step: step});
        this.lengths[stepInt] = length;
        return length;
    },

    // Given the set of control points, compute values as separated by step and exec passed func against each coordinate
    iterateSegments: function(func, options) {
        options = options || {};
        var step = options.step || 0.1,
            lastX = null,
            lastY = null,
            result = null,
            t, coords, currentX, currentY;

        for (t = 0.0; t <= 1.0; t += step) {
            coords = this.getSegmentValue(t);
            currentX = coords.x;
            currentY = coords.y;

            if (lastX != null) {
                result = func(this, t, lastX, lastY, currentX, currentY, options, result);
            }

            lastX = currentX;
            lastY = currentY;
        }

        return result;
    },

    /*
        Compute the X and Y coordinates of a given percentage along the curve
    */
    getSegmentValue: function(percent) {
        //====================================\\
        // 13thParallel.org Beziér Curve Code \\
        //   by Dan Pupius (www.pupius.net)   \\
        //====================================\\

        function B1(t) { return t * t * t }
        function B2(t) { return 3 * t * t * (1-t) }
        function B3(t) { return 3 * t * (1-t) * (1-t) }
        function B4(t) { return (1-t) * (1-t) * (1-t) }

        var posX = this.P1.x * B1(percent) + this.C1.x * B2(percent) + this.C2.x * B3(percent) + this.P2.x * B4(percent),
            posY = this.P1.y * B1(percent) + this.C1.y * B2(percent) + this.C2.y * B3(percent) + this.P2.y * B4(percent);

        return {
            x: posX,
            y: posY
        }
    },

    lineIntersectionFunc: function(p0_x, p0_y, p1_x, p1_y, p2_x, p2_y, p3_x, p3_y) {
        var s1_x = p1_x - p0_x,
            s1_y = p1_y - p0_y,

            s2_x = p3_x - p2_x,
            s2_y = p3_y - p2_y,

            s = (-s1_y * (p0_x - p2_x) + s1_x * (p0_y - p2_y)) / (-s2_x * s1_y + s1_x * s2_y),
            t = ( s2_x * (p0_y - p2_y) - s2_y * (p0_x - p2_x)) / (-s2_x * s1_y + s1_x * s2_y),
            i_x, i_y;

        if (s >= 0 && s <= 1 && t >= 0 && t <= 1) {
            // Collision detected
            i_x = p0_x + (t * s1_x);
            i_y = p0_y + (t * s1_y);

            return {
                x: i_x,
                y: i_y
            }
        }

        return null;
    },

    getLineIntersection: function(line) {
        var func = function(ctx, t, x1, y1, x2, y2, oParams, result) {
            var r = ctx.lineIntersectionFunc(oParams.line.P1.x, oParams.line.P1.y, oParams.line.P2.x, oParams.line.P2.y, x1, y1, x2, y2);
            if (r != null) {
                result = r;
                result.curvePos = 1 - t;
                result.curve = ctx;
            }

            return result;
        }

        return this.iterateSegments(func, {line: line, step: 0.05});
    },

    getNormals: function(curveDistance) {
        if (curveDistance >= 1) {
            curveDistance = 1 / 1.025;
        }

        var p1 = this.getSegmentValue(curveDistance / 1.02),
            p2 = this.getSegmentValue(curveDistance * 1.02),

            x1 = -(p2.y - p1.y),
            y1 = (p2.x - p1.x),

            x2 = (p2.y - p1.y),
            y2 = -(p2.x - p1.x),

            slope = (y2 - y1) / (x2 - x1);

        return [{
                    x: x1,
                    y: y1,
                    slope: slope
                },
                {
                    x: x2,
                    y: y2,
                    slope: -slope 
                }];
    }
});

module.exports = CubicBezierCurve;