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

function CalcTimelinePeriod_WeightedInterval_StdDev(events, options) {
    options = options || {};
    var minIntervals = options.minIntervals || 1,
        maxIntervals = options.maxIntervals || 5,
        stddevFactor = options.stddevFactor || 2;
        
    if (events.length < minIntervals + 1) {
        return;
    }

    return weightedIntervalAverage(events, maxIntervals, 0.1);
}

function weightedIntervalAverage(events, maxIntervals, minWeight) {
    var intervals = getIntervals(events, maxIntervals),
        weightedDivisor = 0,
        weightedSum = 0,
        filteredIntervals = stdDevIntervalFilter(intervals, 2);

    _.each(filteredIntervals, function(interval, i) {
        var weight = 1 / Math.pow(i + 1, 2);

        weightedDivisor += weight;
        weightedSum += weight * interval;
    });
    return weightedSum / weightedDivisor;
}

function getIntervals(events, maxIntervals) {
    var events = [].concat(events);
    if (maxIntervals) {
        events = _.last(events, maxIntervals + 1);
    }
    events.reverse();

    var last = null,
        intervals = [];

    _.each(events, function(v) {
        if (last) {
            intervals.push(Math.abs(last - v));
        }
        last = v;
    });

    return intervals;
}

function stdDevIntervalFilter(intervals, stddevFactor) {
    stddevFactor = stddevFactor || 1;

    function sum(vals) {
        return _.reduce(vals, function(memo, num) { return memo + num; }, 0);
    }
    
    // minimum 2
    function pstdev(data) {
        return Math.pow(_ss(data) / data.length, 0.5);
    }

    function _ss(data) {
        var c = mean(data);
        return sum(_.map(data, function(x) { return Math.pow((x - c), 2); }));
    }

    // minimum 1
    function mean(data) {
        return sum(data) / data.length;
    }

    // Filter out intervals over 1 stdev from the mean
    var avg = mean(intervals),
        stdev = parseInt(pstdev(intervals)),
        filteredIntervals = _.filter(intervals, function(x) {
            return x <= avg + (stdev * stddevFactor);
        });

    return filteredIntervals;
}

module.exports = CalcTimelinePeriod_WeightedInterval_StdDev;