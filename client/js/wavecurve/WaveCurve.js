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
var _ = require('backbone/node_modules/underscore');

// App
var CurveSegments = require('app/wavecurve/CurveSegments'),
    CurvePath = require('app/wavecurve/CurvePath');

// -------------

var WaveCurve = function(dataSlice, options) {
	options = options || {}

	this.dataSlice = dataSlice;
	this.defaultNumSegments = 50;

	this.init(options);
}

_.extend(WaveCurve.prototype, {
	init: function(options) {
		options = options || {}

		this.options = options;
		this.curve = options.curve;
        this.maxDensity = options.maxDensity;
		this.curveOptions = options.curveOptions;
        this.pointSizeFunc = options.pointSizeFunc || function(model) { return 50; };
        this.customContextSplit = options.customContextSplit;

		if (!this.curve) {
			this.curve = new CurvePath(options.curvePoints || [], this.curveOptions);
		}
	},

	render: function(options) {
		options = _.extend({}, this.options, options || {});

		var numSegments = options.numSegments || this.defaultNumSegments,
			curveSegments = new CurveSegments(numSegments),
			contexts = options.contexts || ['Base'];

		this.pointsToSegments(curveSegments, this.dataSlice, contexts, _.bind(this.splitContext, this));

		if (options.backgroundRenderer) {
			this.renderBackground(options.backgroundRenderer, options.ctx, this.curve, options.thickness, options.backgroundThickness, this.curveOptions);
		}

		this.drawWave(options.ctx, this.curve, curveSegments, contexts, options.contextColors || {}, options.thickness, this.curveOptions);
	},

	drawWave: function(ctx, baseCurve, curveSegments, contexts, contextColors, waveThickness, curveOptions) {
		var contexts,
			aggregateThickness = {};

        var streamPoints = _.map(contexts, function(streamID) {
            return {
                streamID: streamID,
                points: this.computeWavePoints(baseCurve, curveSegments, streamID, waveThickness, aggregateThickness),
            }
        }, this);

        streamPoints.reverse();
        _.each(streamPoints, function(streamData) {
            var waveCurve = new CurvePath(streamData.points, curveOptions),
                streamID = streamData.streamID;

            ctx.save();
            ctx.fillStyle = contextColors[streamID] || '#ccc';
            this.drawCurve(ctx, waveCurve)
            ctx.fill();
            ctx.restore()
        }, this);

        if (0) {
            ctx.strokeStyle="#FF0000";
            _.each(_.range(0, curveSegments.numSegments), function(i) {
                ctx.strokeRect(i * curveSegments.segmentSize * 900, 0, (i + 1) * curveSegments.segmentSize * 900, 500); 
            });
        }

        /*if (0) {
            var points = this.computeWavePoints(baseCurve, curveSegments, 'Base', waveThickness, {}),
                waveCurve = new CurvePath(points, curveOptions);

            ctx.save();
            ctx.fillStyle = 'rgba(64, 64, 64, 1)';
            this.drawCurve(ctx, waveCurve)
            ctx.fill();
            ctx.restore()
        }*/
    },

    /*
    Points that belong to multiple streams/contexts are added to each stream.
    */
	pointsToSegments: function(curveSegments, dataSlice, contexts, splitFunc) {
        _.each(dataSlice.points, function(point) {
            var position = dataSlice.toPosition(point),
                size = this.pointSizeFunc(point),
                contextIDs = splitFunc(point);

            _.each(_.intersection(contextIDs, contexts), function(contextID) {
                curveSegments.addPoint(contextID, point, position, size);
            });

        }, this);
    },

    splitContext: function(point) {
        // iterate upAssociations
        var contexts = [point.ContextID];
        if (this.customContextSplit) {
            contexts = this.customContextSplit(contexts);
        }

        return (contexts.length > 0) ? contexts : ['Base'];
    },

    renderBackground: function(backgroundClass, ctx, baseCurve, waveThickness, backgroundThickness, curveOptions) {
        ctx.save();

        ctx.strokeStyle = '#000';
        ctx.lineWidth = backgroundThickness || waveThickness * 1.05;
        this.drawCurve(ctx, baseCurve)
        ctx.stroke();

        var bg = new backgroundClass();
        bg.render(ctx, baseCurve, this.dataSlice, waveThickness, curveOptions);

        ctx.restore();
    },

    drawCurve: function(ctx, shape, transform, strokeStyle) {
        var iter = shape.newIter(),
            curveSegment, i = 0;

        ctx.beginPath();
        if (strokeStyle) {
            ctx.strokeStyle = strokeStyle;
        }

        while (curveSegment = iter.next()) {
            var points = curveSegment.getPointsArray();
            points = _.isFunction(transform) ? transform(points) : points;
            
            if (i == 0) {
                ctx.moveTo(points[6], points[7]);
            }

            ctx.bezierCurveTo(points[0], points[1], points[2], points[3], points[4], points[5]);
            i += 1;
        }

        if (0) {
            ctx.save();
            var iter = shape.newIter();
            while (curveSegment = iter.next()) {
                var points = curveSegment.getPointsArray();
                
                ctx.strokeStyle = 'green';
                ctx.strokeRect(points[6]-2, points[7]-2, 4, 4);
                ctx.strokeStyle = 'orange';
                ctx.strokeRect(points[0]-2, points[1]-2, 4, 4);
                ctx.strokeStyle = 'purple';
                ctx.strokeRect(points[2]-2, points[3]-2, 4, 4);
                ctx.strokeStyle = 'cyan';
                ctx.strokeRect(points[4]-2, points[5]-2, 4, 4);
            }
            ctx.restore();
        }
    },

    computeWavePoints: function(baseCurve, curveSegments, streamID, maxSize, aggregateThickness) {
        var curveLength = baseCurve.getTotalLength(),
            numSegments = curveSegments.numSegments,
            segmentLength = curveLength / numSegments,

            maxDensity = this.maxDensity || curveSegments.getMaxDensity(),

            combinedPoints,
            points = [],
            tmpPoints = [],
            minThickness = 0,

            segments = curveSegments.getSegments(streamID);

        combinedPoints = _.map(_.range(0, numSegments + 1), function(i) {
            var thickness,
                curveDistance = i / numSegments,
                segmentDetails = segments[i],
                priorThickness = aggregateThickness[i] || 0;

            if (!segmentDetails) {
                thickness = priorThickness ? minThickness : 0;
            }
            else {
                console.log(segmentDetails.totalSize);
                thickness = Math.max(minThickness, (segmentDetails.totalSize / maxDensity) * maxSize);
            }

            //console.log(streamID, thickness, thickness + priorThickness);

            thickness += priorThickness;
            aggregateThickness[i] = thickness;

            var result = this.getCurveThickness(baseCurve, curveDistance, thickness);
            //console.log(i, curveDistance, thickness);
            return result;
        }, this);

        _.each(combinedPoints, function(point) {
            points.push([point[0].x, point[0].y]);
        });

        if (true) {
            _.each(combinedPoints, function(point) {
                tmpPoints.push([point[1].x, point[1].y]);
            });

            tmpPoints.reverse();
            points = points.concat(tmpPoints);
        }

        return points;
    },

    getCurveThickness: function(curve, curveDistance, thickness) {
        var positionDetails = curve.computePosition(curveDistance),
            position = positionDetails.position,
            x1, y1, x2, y2;

        if (thickness <= 0) {
            x1 = x2 = position.x;
			y1 = y2 = position.y;
        }
        else {
        	thickness /= 2;

	        var normals = positionDetails.segment.getNormals(positionDetails.segmentDistance),
	        	normal1Length = this.calcDistance(normals[0].x, normals[0].y),
	            normal1Scale = thickness / normal1Length,

	            normal2Length = this.calcDistance(normals[1].x, normals[1].y),
	            normal2Scale = thickness / normal2Length;

            x1 = position.x + (normals[0].x * normal1Scale);
            y1 = position.y + (normals[0].y * normal1Scale);

            x2 = position.x + (normals[1].x * normal2Scale);
            y2 = position.y + (normals[1].y * normal2Scale);
	    }

        return [
            {
                x: x1,
                y: y1
            },
            {
                x: x2,
                y: y2
            }
        ];
    },

    calcDistance: function(x1, y1, x2, y2) {
        var a, b;
        if (arguments.length == 4) {
            a = x1 - x2;
            b = y1 - y2;
        }
        else if (arguments.length == 2) {
            if (_.isObject(x1) && _.isObject(y1)) {
                a = x1.x - y1.x;
                b = x1.y - y1.y;
            }
            else {
                a = x1;
                b = y1;
            }
        }

        return Math.sqrt(Math.pow(a, 2) + Math.pow(b, 2));
    }
});

module.exports = WaveCurve;