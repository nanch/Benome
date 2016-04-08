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

var DataSlice = function(valueBegin, valueEnd, dataPoints) {
	this.points = dataPoints;
	this.begin = valueBegin;
	this.end = valueEnd;
}

_.extend(DataSlice.prototype, {
	toPosition: function(point) {
		var value = (point['Time'] * 1000) || this.begin;
		return (value - this.end) / (this.begin - this.end);
	},

	getPoints: function(transformFunc) {
		return _.map(this.points, function(point) {
			return transformFunc(point, this.toPosition(point));
		}, this);
	}
});

module.exports = DataSlice;