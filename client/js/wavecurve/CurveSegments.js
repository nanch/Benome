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

// -------------

var CurveSegments = function(numSegments) {
	this.numSegments = numSegments;
	this.segmentSize = 1 / this.numSegments;

	this.streams = {};
	this.initStream('Base');
}

_.extend(CurveSegments.prototype, {
	initStream: function(streamID) {
		streamID = streamID || 'Base';

		var streamDetails = {
			segments: {}
		}
		this.streams[streamID] = streamDetails;

		return streamDetails;
	},

	getStream: function(streamID) {
		streamID = streamID || 'Base';

		var streamDetails = this.streams[streamID];
		if (!streamDetails) {
			streamDetails = this.initStream(streamID);
		}

		return streamDetails;
	},

	getSegments: function(streamID) {
		return this.getStream(streamID).segments;
	},

	getSegmentID: function(position) {
		return Math.round((position + (this.segmentSize * 0.5)) / this.segmentSize);
	},

	addToStream: function(streamID, point, position, size) {
		var streamData = this.getStream(streamID),
			segments = streamData.segments,
			segmentID = this.getSegmentID(position);

		var segmentData = segments[segmentID];
		if (!segmentData) {
			segmentData = {
				points: [],
				totalSize: 0
			}

			segments[segmentID] = segmentData;
		}

		segmentData.points.push([position, size, point]);
		segmentData.totalSize += size;
	},

	addPoint: function(streamID, point, position, size) {
		streamID = streamID || 'Base';

		this.addToStream('Base', point, position, size);
		if (streamID != 'Base') {
			this.addToStream(streamID, point, position, size);
		}
	},

	getMaxDensity: function(streamID) {
		streamID = streamID || 'Base';

		var streamData = this.getStream(streamID),
            density = _.max(_.pluck(streamData.segments, 'totalSize'));

        return density;
	}
});

module.exports = CurveSegments;