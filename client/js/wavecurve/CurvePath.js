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

var _ = require('backbone/node_modules/underscore');

var CubicBezierCurve = require('app/wavecurve/CubicBezierCurve'),
    CurvePathIterator = require('app/wavecurve/CurvePathIterator');

// Curve is always input and stored left-to-right
var CurvePath = function(pointData, options) {
    options = options || {};
    this.closedPath = options.closePath || false;
    this.curveType = options.curveType || 0;

    this.pointData = _.compact(pointData);

    this.CubicBezierCurve = options.CubicBezierCurve || CubicBezierCurve;
    this.CurvePathIterator = options.CurvePathIterator || CurvePathIterator;

    if (this.closedPath && !options.pathDataClosed) {
        // Closing the path affects its length, so the begin point must be added as the end point
        this.pointData.push([pointData[0][0], pointData[0][1]]);
    }

    this.curveData = this.pointsToBezier(this.pointData, this.closedPath, this.curveType);
    this.numPoints = this.curveData.length + 1;

    this.beginSegmentPos = null;
    this.endSegmentPos = null;

    if (options.begin != null) {
        var t = this.computePosition(options.begin);
        this.setBeginPosition({
            curveIdx: t.segmentIdx,
            curvePos: 1 - t.segmentDistance
        });
    }

    if (options.end) {
        var t = this.computePosition(options.end);
        this.setEndPosition({
            curveIdx: t.segmentIdx,
            curvePos: 1 - t.segmentDistance
        });
    }

    return this;
};

_.extend(CurvePath.prototype, {

    /*
        positions include:
            path position
            segment id
            segment position
            other helpful data
    */
    getBeginPosition: function() {
        if (this.beginSegmentPos != null) {
            return this.beginSegmentPos;
        }
        else {
            return {
                curveIdx: 0,
                curvePos: 0
            }
        }
    },

    getEndPosition: function() {
        if (this.endSegmentPos != null) {
            return this.endSegmentPos;
        }
        else {
            return {
                curveIdx: this.getCurveData().length - 1,
                curvePos: 1
            }
        }
    },

    setBeginPosition: function(position) {
        this.beginSegmentPos = position;
    },

    setEndPosition: function(position) {
        this.endSegmentPos = position;
    },

    computePosition: function(distance, fromEnd) {
        var curve, curveLength,
            segmentDistance = null,
            targetSegment = null,
            tmpLength = 0,

            // compute total path length
            pathLength = this.getTotalLength(),

            // compute partial path length
            partialPathLength = this.getLength1(),

            targetDistance = distance * partialPathLength,

            beginSegmentPos = this.getBeginPosition(),
            endSegmentPos = this.getEndPosition(),

            beginIdx = beginSegmentPos.curveIdx,
            endIdx = endSegmentPos.curveIdx,

            numCurves = this.getCurveData().length,
            i;

        if (endIdx < beginIdx) endIdx += numCurves;

        for (i = beginIdx; i <= endIdx; i++) {
            if (i >= numCurves) {
                curve = this.curveData[i - numCurves];
            }
            else {
                curve = this.curveData[i];
            }

            curveLength = curve.getLength();

            if (i == beginIdx) {
                // get applicable length in begin segment
                tmpLength += curveLength - (curveLength * beginSegmentPos.curvePos);
            }
            else if (i == endIdx) {
                // get applicable length in end segment
                tmpLength += curveLength * endSegmentPos.curvePos;
            }
            else {
                // add all other segment lengths
                tmpLength += curveLength;
            }

            if (tmpLength >= targetDistance) {
                targetSegment = curve;

                // translate path distance to segment distance.
                if (false && i == endIdx) {
                    segmentDistance = 1 - (endSegmentPos.curvePos - segmentDistance);
                }
                else {
                    segmentDistance = 1 - ((targetDistance - (tmpLength - curveLength)) / curveLength);
                }

                break;
            }
        }

        var position = null;
        if (targetSegment != null && segmentDistance != null) {
            position = targetSegment.getSegmentValue(segmentDistance);
        }

        return {
            segmentIdx: i,
            segment: targetSegment,
            segmentDistance: segmentDistance,
            position: position
        };
    },

    getCurveData: function() {
        return this.curveData;
    },

    getPointData: function(reversed) {
        if (reversed) {
            return this.pointData.slice().reverse()
        }
        else {
            return this.pointData;
        }
    },

    // Accepts CurvePath and options dict as parameters
    // Returns an array structure: [C1, C2, P2, P1]

    getPoints: function(appendCurve, options) {
        appendCurve = appendCurve || {};
        options = options || appendCurve || {};

        var appendReversed = options.appendReversed || false,
            resultPoints = this.getPointsArray(),
            appendPoints = [];

        // If there's a passed curve, append its points, reversed if needed.
        if (appendCurve.className == 'CurvePath') {
            if (appendReversed) {
                // Get the reversed raw data points
                var pointData = appendCurve.getPointData(appendReversed);

                // Recompute the curve
                var tmpPoints = this.pointsToBezier(pointData, this.closedPath, this.curveType);

                // Get the recomputed curve points
                appendPoints = this.getPointsArray(tmpPoints);
            }
            else {
                appendPoints = appendCurve.getPointsArray();
            }

            resultPoints = resultPoints.concat(appendPoints);
        }

        return resultPoints;
    },

    getPointsArray: function(curveData) {
        curveData = curveData || this.getCurveData();
        var resultPoints = [],
            i;

        for (i in curveData) {
            resultPoints.push(curveData[i].getPointsArray());
        }

        return resultPoints;
    },

    // Static
    // Points treated as a Catmull-Rom path
    // Return value is a dict containing all four cubic-bezier control points of segment.
    pointsToBezier: function(points, close, curveType) {

        //************************************************
        //
        // Catmull-Rom Spline to Bezier Spline Converter
        //
        // This code is available under the MIT or GPL licenses, and it takes
        // inspiration from Maxim Shemanarev's Anti-Grain Geometry library.
        //
        // author: schepers, created: 07-09-2010
        //
        //************************************************

        close = close && points.length >= 2;
        curveType = curveType || 0;

        var crp = [],
            i, point;

        for (i in points) {
            point = points[i];
            crp.push(point[0]);
            crp.push(point[1]);
        }

        if (close) {
            // Extend the path by one more point
            crp.push(points[1][0]);
            crp.push(points[1][1]);
        }

        // 6 is a smooth continuous curve.  40 is a straight-line polygon.  1.7 < x < 6 is concave.
        // curveType is between -100 and 100.  < 0 maps to between 1.7 and 6.
        //      > 0 maps to between 6 and 40

        var d = 6;

        if (curveType < 0) {
            d -= (6 - 1.7) * (Math.abs(curveType) / 100);
        }
        else if (curveType > 0) {
            d += (40 - 6) * (Math.abs(curveType) / 100);
        }

        var result = [];
        for (i = 0, iLen = crp.length; iLen - 2 > i; i+=2) {
            var p = [];
            if ( 0 == i ) {
                p.push( {x: (crp[ i ]), y: (crp[ i + 1 ])} );
                p.push( {x: (crp[ i ]), y: (crp[ i + 1 ])} );
                p.push( {x: (crp[ i + 2 ]), y: (crp[ i + 3 ])} );
                p.push( {x: (crp[ i + 4 ]), y: (crp[ i + 5 ])} );
            }
            else if ( iLen - 4 == i ) {
                p.push( {x: (crp[ i - 2 ]), y: (crp[ i - 1 ])} );
                p.push( {x: (crp[ i ]), y: (crp[ i + 1 ])} );
                p.push( {x: (crp[ i + 2 ]), y: (crp[ i + 3 ])} );
                p.push( {x: (crp[ i + 2 ]), y: (crp[ i + 3 ])} );
            }
            else {
                p.push( {x: (crp[ i - 2 ]), y: (crp[ i - 1 ])} );
                p.push( {x: (crp[ i ]), y: (crp[ i + 1 ])} );
                p.push( {x: (crp[ i + 2 ]), y: (crp[ i + 3 ])} );
                p.push( {x: (crp[ i + 4 ]), y: (crp[ i + 5 ])} );
            }

            // Catmull-Rom to Cubic Bezier conversion matrix
            //        0             1             0             0
            //      -1/d            1            1/d            0
            //        0            1/d            1           -1/d
            //        0             0             1             0

            var oBezierPoints = {
                P1: { x: p[1].x,    y: p[1].y },
                C1: { x: ((-p[0].x + d * p[1].x + p[2].x) / d), y: ((-p[0].y + d*p[1].y + p[2].y) / d)},
                C2: { x: ((p[1].x  + d * p[2].x - p[3].x) / d), y: (( p[1].y + d*p[2].y - p[3].y) / d)},
                P2: { x: p[2].x,    y: p[2].y }
            }

            result.push(oBezierPoints);
        }

        if (close) {
            // Shift the last point's C1 to the first point
            result[0].C1.x = result[result.length - 1].C1.x;
            result[0].C1.y = result[result.length - 1].C1.y;

            // Remove the last point
            result.pop();
        }

        for (i in result) {
            result[i] = new this.CubicBezierCurve(result[i].P1, result[i].C1, result[i].C2, result[i].P2);
        }

        return result;
    },

    /*
        Given an array of data points on the same scale as this curve, return an array of points representing a related curve.
    */
    getRelatedCurvePoints: function(dataPoints, below) {
        var relatedCurve = [],
            j;

        for (j in dataPoints) {
            var dataX = dataPoints[j].x,
                dataY = dataPoints[j].y,
                baseY = null,
                i;

            // find the segment that bounds the X value
            for (i = 0; i < this.curveData.length; i++) {
                var curve = this.curveData[i],
                    // curve is stored left to right

                    curveX1 = curve.P1.x,
                    curveY1 = curve.P1.y,

                    curveX2 = curve.P2.x,
                    percent;

                if (dataX <= curveX2) {
                    // Translate position into a percentage
                    percent = 1 - ((dataX - curveX1) / (curveX2 - curveX1))

                    // Given the percentage and the curve params, compute the Y value
                    baseY = curve.getSegmentValue(percent).y;

                    break;
                }
            }

            if (below) {
                relatedCurve.push([dataX, baseY + dataY]);
            }
            else {
                relatedCurve.push([dataX, baseY - dataY]);
            }
        }

        return relatedCurve;
    },

    /*
    */
    getPartialCurvePoints: function(beginPosition, endPosition) {
        var outPoints = [],
            positionMap = {};

        // First translate each current point into a position
        this.iterateCurveSegments(function() {
            
        })
        // Then grab all points that are inside the passed range
        // Then add the points at the two positiosn passed



        return outPoints;
    },

    iterateCurveSegments: function(func, options) {
        var result = null,
            i, curve;
        // Loop through all curve segments, applying function to each one in sequence
        // Returns a code and a result?
        for (i in this.curveData) {
            curve = this.curveData[i];
            result = curve.iterateSegments(func, options);

            if (result != null) break;
        }

        return result;
    },

    newIter: function(options) {
        return new this.CurvePathIterator(this, options);
    },

    getLength1: function(step) {
        var totalLength = 0,

            beginSegmentPos = this.getBeginPosition(),
            endSegmentPos = this.getEndPosition(),

            beginIdx = beginSegmentPos.curveIdx,
            endIdx = endSegmentPos.curveIdx,

            numCurves = this.getCurveData().length,
            i, curve, curveLength;

        if (endIdx < beginIdx) endIdx += numCurves;

        for (i = beginIdx; i <= endIdx; i++) {
            if (i >= numCurves) {
                curve = this.curveData[i - numCurves];
            }
            else {
                curve = this.curveData[i];
            }

            curveLength = curve.getLength()

            if (i == beginIdx) {
                // get applicable length in begin segment
                totalLength += curveLength - (curveLength * beginSegmentPos.curvePos);
            }
            else if (i == endIdx) {
                // get applicable length in end segment
                totalLength += curveLength * endSegmentPos.curvePos;
            }
            else {
                // sum all other segments in full
                totalLength += curveLength;
            }
        }

        return totalLength;
    },

    getLength3: function(step) {
        var totalLength = 0,
            iter = this.newIter(),
            curve;

        while (curve = iter.next()) {
            totalLength += curve.getLength();
        }

        return totalLength;
    },

    getLength2: function(step) {
        var totalLength = 0,
            i, curve;

        for (i in this.curveData) {
            curve = this.curveData[i];
            totalLength += curve.getLength();
        }

        return totalLength;
    },

    getTotalLength: function() {
        return this.getLength2();
    },

    getNumSegments: function() {
        return this.curveData.length;
    },

    getLineIntersection: function(oLine, multiple) {
        var outResult = [],
            curveLength = 0,
            length = 0,
            pathLength = this.getTotalLength(),
            i, curve;

        for (i in this.curveData) {
            curve = this.curveData[i];
            curveLength = curve.getLength();

            result = curve.getLineIntersection(oLine);
            if (result != null) {
                result.curveIdx = parseInt(i);
                result.pathPreLength = length;
                result.pathPos = (length + (curveLength * result.curvePos)) / pathLength;

                if (multiple) {
                    outResult.push(result);
                }
                else {
                    outResult = result;
                    break;
                }
            }

            length += curveLength;
        }

        return outResult;
    }
});

module.exports = CurvePath;