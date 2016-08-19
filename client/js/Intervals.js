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

var _ = require('underscore');

function Intervals() {
    this.intervals = [
        {
            'IntervalName': 'Year',
            'SimpleName': 'Yearly',
            'ShortAbbrev': 'y',
            'Interval': 86400 * 365,
            'SimpleVariance': 0.1,
            'MultiVariance': 0.1
        },
        {
            'IntervalName': 'Month',
            'SimpleName': 'Monthly',
            'ShortAbbrev': 'm',
            'Interval': 86400 * 30,
            'SimpleVariance': 0.1,
            'MultiVariance': 0.1
        },
        {
            'IntervalName': 'Week',
            'SimpleName': 'Weekly',
            'ShortAbbrev': 'w',
            'Interval': 86400 * 7,
            'SimpleVariance': 0.1,
            'MultiVariance': 0.1
        },
        {
            'IntervalName': 'Day',
            'SimpleName': 'Daily',
            'ShortAbbrev': 'd',
            'Interval': 86400,
            'SimpleVariance': 0.1,
            'MultiVariance': 0.1
        },
        {
            'IntervalName': 'Hour',
            'SimpleName': 'Hourly',
            'ShortAbbrev': 'h',
            'Interval': 3600,
            'SimpleVariance': 0.1,
            'MultiVariance': 0.1
        },
        {
            'IntervalName': 'Minute',
            'SimpleName': 'Every minute',
            'ShortAbbrev': 'min',
            'Interval': 60,
            'SimpleVariance': 0.1,
            'MultiVariance': 0.1

        },
        {
            'IntervalName': 'Second',
            'SimpleName': 'Every second',
            'ShortAbbrev': 's',
            'Interval': 1,
            'SimpleVariance': 0.1,
            'MultiVariance': 0.1

        }
    ];
};

_.extend(Intervals.prototype, {
    intervalToFriendly: function(currentInterval) {
        if (!currentInterval) {
            return '';
        }

        var result = null;
        _.find(this.intervals, function(intervalDef, i, intervals) {
            var variance = intervalDef.SimpleVariance * intervalDef.Interval,
                intervalLowThreshold = intervalDef.Interval - variance,
                intervalHighThreshold = intervalDef.Interval + variance;

            if (currentInterval >= intervalLowThreshold) {
                // Matches interval directly
                if (currentInterval <= intervalHighThreshold) {
                    result = intervalDef.SimpleName;
                }
                // A multiple of current interval (always the largest)
                else {
                    result = 'Every few ' + intervalDef.IntervalName + 's';
                }
                return true;
            }
            // Nothing to do if it's the last interval type
            else if (i == intervals.length - 1) {
                return true;
            }
            // A fraction of current interval, so on to the next
            else {
                var nextIntervalDef = intervals[i + 1],
                    z = nextIntervalDef.Interval + (nextIntervalDef.SimpleVariance * nextIntervalDef.Interval);

                // A simple match, so skip and let it get caught next iteration
                if (currentInterval <= z) {
                    return;
                }

                //console.log(currentInterval + '/' + intervalDef.Interval);

                var numPer = Math.round(intervalDef.Interval / currentInterval);
                result = numPer + '/' + intervalDef.ShortAbbrev;
                return true;
            }
        });

        return result || 'Rapid';
    },

    // Increase frequency
    incrementInterval: function(currentInterval) {
        if (!currentInterval) {
            return;
        }

        var result = null;
        _.find(this.intervals, function(intervalDef, i, intervals) {
            if (i == 0) {
                return 0;
            }
            else if (currentInterval >= intervalDef.Interval) {
                var prevInterval = intervals[i - 1].Interval,
                    numPer = Math.round(prevInterval / currentInterval);

                result = prevInterval / (numPer + 1);
                return true;
            }
        });

        return result;
    },

    // Decrease frequency
    // Not implemented, just a copy of incrementInterval above
    decrementInterval: function(currentInterval) {
        if (!currentInterval) {
            return;
        }

        var result = null;
        _.find(this.intervals, function(intervalDef, i, intervals) {
            if (i == 0) {
                return 0;
            }
            else if (currentInterval >= intervalDef.Interval) {
                var numPer = Math.round(currentInterval / intervalDef.Interval);
                result = intervalDef.Interval * (numPer + 1);
                return true;
            }
        });

        return result;
    }
});

module.exports = Intervals;