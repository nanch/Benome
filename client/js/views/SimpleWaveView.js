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
var $ = require('jquery'),
    Backbone = require('backbone'),
    _ = require('underscore');

var moment = require('app/lib/moment');

Backbone.$ = $;

// App
var WaveCurve = require('app/wavecurve/WaveCurve'),
    CurvePath = require('app/wavecurve/CurvePath'),
    DataSlice = require('app/wavecurve/DataSlice');

// -------------

var SimpleWaveView = Backbone.View.extend({
    tagName: 'div',
    className: 'simple-wave-view',

    events: {
        //'click': ''
    },

    initialize: function(options) {
        options = options || {};

        this.data = options.data || [];

        this.waveColor = options.waveColor || 'black';
        this.beginDate = options.beginDate || this.beginDate;
        this.endDate = options.endDate || this.endDate;
        this.numSegments = options.numSegments || 60;
        this.customContextSplit = options.customContextSplit || null;

        this.leftFraction = options.leftFraction || 0;
        this.widthFraction = options.widthFraction || 1;
        this.heightFraction = options.heightFraction || 1;

        this.outputType = options.outputType != 'image' ? 'canvas' : 'image';

        this.canvas = document.createElement('canvas');
        if (this.outputType == 'image') {
            this.$image = $('<image>')
                                .addClass('streamgraph-image')
                                .appendTo(this.$el);
        }
        else {
            this.$el.append(this.canvas);
        }
    },

    currentSize: function() {
        return {
            width: this.$el.width() * this.widthFraction,
            height: this.$el.height() * this.heightFraction
        }
    },

    clear: function() {
        if (!this.canvas) {
            return;
        }

        var ctx = this.canvas.getContext('2d');
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    },

    render: function(options) {
        options = options || {};
        this.beginDate = options.beginDate || this.beginDate;
        this.endDate = options.endDate || this.endDate;
        this.leftFraction = options.leftFraction || this.leftFraction;
        this.widthFraction = options.widthFraction || this.widthFraction;
        this.heightFraction = options.heightFraction || this.heightFraction;

        var size = this.currentSize();
        this.curveThickness = size.height * 0.95;

        this.canvas.width = size.width;
        this.canvas.height = size.height;

        if (this.leftFraction) {
            $(this.canvas).css({
                left: (size.width * this.leftFraction) + 'px'
            });
        }

        this.clear();
        this.initCurve(options);

        this.waveCurve.render({
            ctx: this.canvas.getContext('2d'),
            contexts: options.contexts,
            numSegments: options.numSegments || this.numSegments,
            thickness: this.curveThickness,
            contextColors: options.contextColors,
            
        });

        if (this.outputType == 'image') {
            this.$image.attr('src', this.canvas.toDataURL());
        }
    },

    initCurve: function(options) {
        options = options || {};
        this.data = options.data || this.data || [];

        // init curve
        var curveOptions = {
                closePath: false,
                curveType: options.curveType || 0
            },

            size = this.currentSize(),
            height = size.height * 0.5,
            width = size.width,
            curvePoints = [
                [width, height],
                [width * 0.5, height],
                [0, height]
            ],

            baseCurve = new CurvePath(curvePoints, curveOptions),
            dataSlice = new DataSlice(this.beginDate, this.endDate, this.data);

        this.waveCurve = new WaveCurve(dataSlice, {
            curve: baseCurve,
            curveOptions: curveOptions,
            customContextSplit: this.customContextSplit,
            pointSizeFunc: function(point) {
                return point['Value'] || 0;
            },
            maxDensity: options.maxDensity,
            //backgroundRenderer: DayAlternate
            backgroundRenderer: SkyColor
        });
    }
});


var DayAlternate = function() {};
_.extend(DayAlternate.prototype, {
    darkColor: '#000',
    lightColor: '#111',

    render: function(ctx, baseCurve, dataSlice, waveThickness, curveOptions) {
        // Get range from DataSlice
        var intervalBegin = dataSlice.begin,
            intervalEnd = dataSlice.end,
            intervalRange = intervalBegin - intervalEnd,

            // Discover and iterate the days in range (via Date object)
            dayIter = new DayIterator(new Date(intervalBegin), new Date(intervalEnd)),
            currentDay,
            dayIdx = 0;

        console.log('begin', moment(dataSlice.begin).format('MMM DD hh:mma'));
        console.log('end', moment(dataSlice.end).format('MMM DD hh:mma'));

        while (currentDay = dayIter.next()) {
            var dayBegin = currentDay.begin.getTime(),
                dayEnd = currentDay.end.getTime();

            // Get begin and end positions
            var beginPos = (intervalBegin - dayEnd) / intervalRange,
                endPos = (intervalBegin - dayBegin) / intervalRange;

            if (_.isNaN(beginPos) || _.isNaN(endPos)) {
                debugger
            }

            var segmentCurve = this.generatePartialSegment(baseCurve, beginPos, endPos, curveOptions),
                appearance = {
                    strokeStyle: dayIdx % 2 == 0 ? this.darkColor : this.lightColor,
                    lineWidth: 1.0
                };

            this.drawSegmentCurve(segmentCurve, appearance, ctx, waveThickness);
            dayIdx += 1;
        }

        /*ctx.save();
        var dayIter = new DayIterator(new Date(intervalBegin), new Date(intervalEnd));
        var i = 0;
        while (currentDay = dayIter.next()) {
            var dayBegin = currentDay.begin.getTime(),
                dayEnd = currentDay.end.getTime();

            // Get begin and end positions
            var beginPos = (intervalBegin - dayEnd) / intervalRange,
                endPos = (intervalBegin - dayBegin) / intervalRange;

            console.log(beginPos, endPos, ctx);

            ctx.fillStyle = i % 2 == 0 ? '#F00' : '#0F0';

            var rectWidth = ctx.canvas.width * (endPos - beginPos);
            ctx.fillRect(rectWidth * i, 0, rectWidth, ctx.canvas.height);
            //ctx.fillRect(852 * beginPos, 75, 20, 20);
            i += 1;
        }
        ctx.restore();*/
    },

    generatePartialSegment: function(baseCurve, beginPosition, endPosition, curveOptions, numSegments) {
        var segmentCurvePoints = [],
            numSegments = numSegments || 20,
            segmentLength = 1 / numSegments;

        segmentCurvePoints.push(this.getPoints(baseCurve, beginPosition));

        var z = beginPosition + segmentLength;
        while (z < endPosition) {
            segmentCurvePoints.push(this.getPoints(baseCurve, z));
            z += segmentLength;
        }

        if (segmentCurvePoints.length == 1) {
            segmentCurvePoints.push(this.getPoints(baseCurve, (beginPosition + endPosition) / 2));
        }
        segmentCurvePoints.push(this.getPoints(baseCurve, endPosition));

        return new CurvePath(segmentCurvePoints, curveOptions);
    },

    getPoints: function(baseCurve, position) {
        var positionDetails = baseCurve.computePosition(position);
        if (!positionDetails || !positionDetails.position) {
            console.log('Invalid position: ' + position);
            console.log(positionDetails);
            return null;
        }

        return [positionDetails.position.x, positionDetails.position.y];
    },

    drawSegmentCurve: function(segmentCurve, appearance, ctx, waveThickness) {
        var iter = segmentCurve.newIter({reverse: true}),
            curveSegment, points,
            i = 0;

        ctx.strokeStyle = appearance.strokeStyle;
        ctx.lineWidth = appearance.lineWidth * waveThickness;
        ctx.lineCap = 'butt';

        ctx.beginPath();

        while (curveSegment = iter.next()) {
            points = curveSegment.getPointsArray();

            ctx.moveTo(points[6], points[7]);
            ctx.bezierCurveTo(points[0], points[1], points[2], points[3], points[4], points[5]);
            i += 1;
        }
        ctx.stroke();
    }
});

var SkyColor = function() {};

_.extend(SkyColor.prototype, {
    skyBlue: '#1768ed',
    skyBlack: '#222',

    render: function(ctx, baseCurve, dataSlice, waveThickness, curveOptions) {
        var numSegments = 200;

        var segments = _.map(_.range(0, numSegments), function() { return {lightness: 0} });
            layerWidth = waveThickness * 1.025;

            /*,
            backingLayers = this.generateBacking(baseCurve, layerWidth);

        _.each(backingLayers, function(layer) {
            layer.renderer(layer, ctx, waveThickness, curveOptions);
        }, this);*/

        this.lightLayer(segments, dataSlice);
        this.skyLayer(segments, dataSlice);

        // Function to translate each segment into a color value

        // Compress segments into contiguous partial curves
        var idx = 0,
            result,
            points = [],
            f = 0;

        while (idx < segments.length) {
            result = this.segmentSlurp(segments, idx);
            value = result.value;
            //console.log(idx, result.length, value);

            var beginPosition = result.start / numSegments,
                endPosition = result.end / numSegments;

            var segmentCurvePoints = [];
            segmentCurvePoints.push(this.getPoints(baseCurve, beginPosition));
            var z = beginPosition + (1 / numSegments);
            while (z < endPosition) {
                segmentCurvePoints.push(this.getPoints(baseCurve, z));
                z += 1 / numSegments;
            }

            if (segmentCurvePoints.length == 1) {
                segmentCurvePoints.push(this.getPoints(baseCurve, (beginPosition + endPosition) / 2));
            }
            segmentCurvePoints.push(this.getPoints(baseCurve, endPosition));

            var appearance = {
                    strokeStyle: value.toRgbaString(),
                    lineWidth: 1.0
                },
                segmentCurve = new CurvePath(segmentCurvePoints, curveOptions);

            this.drawSegmentCurve(segmentCurve, appearance, ctx, waveThickness);
            idx = result.end;
            f += 1;
        }
    },

    segmentSlurp: function(segments, idx) {
        var same = true,
            value = this.computeSkyColor(segments[idx]),
            segmentValue = null,
            j = idx + 1,
            num = 1;

        while (same && j < segments.length) {
            segmentValue = this.computeSkyColor(segments[j]);
            same = value.is(segmentValue);
            j += 1;

            if (same) {
                num += 1;
            }
        }

        return {
            value: value,
            start: idx,
            end: idx + num,
            length: num
        }
    },

    computeSkyColor: function(segmentData) {
        //blend() $.Color(val, val, val, 1.0);
        var color = $.Color(this.skyBlue).alpha(segmentData.lightness);
        return color;
    },

    lightLayer: function(segments, dataSlice) {
        var numSegments = segments.length,
            transitionTime = 60 * 60,

            // Get range from DataSlice
            begin = dataSlice.begin,
            end = dataSlice.end,

            // Discover and iterate the days in range (via Date object)
            dayIter = new DayIterator(new Date(begin), new Date(end)),
            currentDay,
            dayIdx = 0,
            sunData;

        while (currentDay = dayIter.next()) {
            sunData = this.getSun(currentDay.begin, [49.4167, -123.6167]);
            this.renderDayLight(segments, begin, end, currentDay, transitionTime, sunData)
            dayIdx += 1;
        }

        return segments;
    },

    renderDayLight: function(segments, rangeBeginTime, rangeEndTime, currentDay, transitionTime, sunData) {
        var range = Math.abs(rangeBeginTime - rangeEndTime),
            numSegments = segments.length,
            segmentInterval = range / numSegments,

            dayBegin = currentDay.begin,
            dayEnd = currentDay.end,

            dayBeginTime = dayBegin.getTime(),
            dayEndTime = dayEnd.getTime(),

            dayBeginSegment = Math.floor(((rangeBeginTime - dayEndTime) / range) * numSegments),
            dayEndSegment = Math.floor(((rangeBeginTime - dayBeginTime) / range) * numSegments),

            numDaySegments = Math.abs(dayEndSegment - dayBeginSegment),
            
            i = 0,
            segmentTime,
            lightValue;

        segmentTime = (dayBegin.getHours() * 3600) + (dayBegin.getMinutes() * 60) + dayBegin.getSeconds();
        for (i = 0; i < numDaySegments; i++) {
            lightValue = this.getDaylight(segmentTime, transitionTime, sunData)
            segments[dayBeginSegment + (numDaySegments - i - 1)].lightness = lightValue;
            segmentTime += segmentInterval / 1000;
        }

        return segments;
    },

    getDaylight: function(dayTime, transitionTime, sunData) {
        var lightValue;

        if (dayTime < (sunData.riseSec - transitionTime) || dayTime > (sunData.setSec + transitionTime)) {
            // Night
            lightValue = 0;
        }
        else if (dayTime > sunData.setSec) {
            // Dusk
            lightValue = 1 - ((dayTime - sunData.setSec) / transitionTime);
        }
        else if (dayTime < sunData.riseSec) {
            // Dawn
            lightValue = 1 - ((sunData.riseSec - dayTime) / transitionTime);
        }
        else {
            // Day
            lightValue = 1;
        }

        return lightValue;
    },

    skyLayer: function(segments, dataSlice) {

    },

    getSun: function(date, latLng) {
        date = date || new Date();
        var riseSetDetails = new SunriseSunset(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), latLng[0], latLng[1]);

        var tzOffset = -date.getTimezoneOffset() / 60,
            sunriseHour = riseSetDetails.sunriseLocalHours(tzOffset),
            sunsetHour = riseSetDetails.sunsetLocalHours(tzOffset);

        function formatHour(hourFloat) {
            var hour = Math.floor(hourFloat),
                minute = Math.round((hourFloat - hour) * 60);

            return hour + ':' + minute;
        }

        return {
            riseHour: sunriseHour,
            setHour: sunsetHour,
            riseSec: sunriseHour * 3600,
            setSec: sunsetHour * 3600,
            riseTime: formatHour(sunriseHour),
            setTime: formatHour(sunsetHour),
            risePct: (sunriseHour * 3600) / 86400,
            setPct: (sunsetHour * 3600) / 86400
        }
    },

    generateBacking: function(baseCurve, backgroundLayers, layerWidth) {
        return _.map(backgroundLayers, function(backgroundLayer) {
            var layerID = backgroundLayer.layerID,
                layerType = backgroundLayer.layerType,
                layerOptions = backgroundLayer.options,
                layerDetails = null,
                layerRenderer;

            if (layerType == 'Segment') {
                layerRenderer = this.drawBackingLayer_Segment;
                layerDetails = this.generateSequentialSegment(baseCurve, 
                                                                layerOptions.begin,
                                                                layerOptions.end,
                                                                layerOptions.step,
                                                                layerOptions.appearance);
            }
            else if (layerType == 'Bars') {
                layerRenderer = this.drawBackingLayer_Bars;
                layerDetails = this.generateBars(baseCurve, layerOptions.bars);
            }

            return {
                layerID: layerID,
                details: layerDetails,
                renderer: layerRenderer
            };
        }, this);
    },

    generateSequentialSegment: function(baseCurve, startPosition, endPosition, segmentLength, appearance) {
        var currentPosition = startPosition;

        var points = [],
            appearanceData = [],
            distance;

        while (currentPosition < endPosition) {
            points.push(this.getPoints(baseCurve, currentPosition));

            distance = (currentPosition - startPosition) / (endPosition - startPosition);

            if (_.isFunction(appearance)) {
                appearanceData.push(appearance(currentPosition, startPosition, endPosition, segmentLength, distance));
            }
            else {
                appearanceData.push(appearance);
            }
            
            currentPosition += segmentLength;
        }
        points.push(this.getPoints(baseCurve, endPosition));

        return {
            points: points,
            appearance: appearanceData
        }
    },

    generateBars: function(baseCurve, bars, thickness) {
        var points = [],
            appearance = [];

        _.each(bars, function(barDetails) {
            points.push(this.getCurveThickness(baseCurve, barDetails[0], thickness));
            appearance.push({
                lineWidth: barDetails[1],
                strokeStyle: barDetails[2]
            });
        }, this);

        return {
            points: points,
            appearance: appearance
        }
    },

    drawBackingLayer_Bars: function(layer, ctx, waveThickness, curveOptions) {
        _.each(layer.details.points, function(linePoints, i) {
            appearance = layer.details.appearance[i];

            ctx.beginPath();
            ctx.strokeStyle = appearance.strokeStyle;
            ctx.lineWidth = appearance.lineWidth * waveThickness;
            ctx.moveTo(linePoints[0].x, linePoints[0].y);
            ctx.lineTo(linePoints[1].x, linePoints[1].y);
            ctx.stroke();
        });
    },

    drawSegmentCurve: function(segmentCurve, appearance, ctx, waveThickness) {
        var iter = segmentCurve.newIter({reverse: true}),
            curveSegment, points,
            i = 0;

        ctx.strokeStyle = appearance.strokeStyle;
        ctx.lineWidth = appearance.lineWidth * waveThickness;
        ctx.lineCap = 'butt';

        ctx.beginPath();

        while (curveSegment = iter.next()) {
            points = curveSegment.getPointsArray();

            ctx.moveTo(points[6], points[7]);
            ctx.bezierCurveTo(points[0], points[1], points[2], points[3], points[4], points[5]);
            i += 1;
        }
        ctx.stroke();
    },

    drawBackingLayer_Segment: function(layer, ctx, waveThickness, curveOptions) {
        var layerPoints = layer.details.points,
            appearances = layer.details.appearance,
            layerCurve = new CurvePath(layerPoints, curveOptions),
            iter = layerCurve.newIter({reverse: true}),
            curveSegment, points, i = 0;

        while (curveSegment = iter.next()) {
            appearance = appearances[i] || {};
            _.defaults(appearance, {
                lineWidth: 5,
                strokeStyle: 'red'
            });

            ctx.beginPath();
            ctx.strokeStyle = appearance.strokeStyle;
            ctx.lineWidth = appearance.lineWidth * waveThickness;

            points = curveSegment.getPointsArray();
            ctx.moveTo(points[6], points[7]);
            ctx.bezierCurveTo(points[0], points[1], points[2], points[3], points[4], points[5]);
            ctx.stroke();
            i += 1;
        }
    },

    getPoints: function(baseCurve, position) {
        var positionDetails = baseCurve.computePosition(position);
        return [positionDetails.position.x, positionDetails.position.y];
    }
});


/*
Given an interval bounded by two dates, break up the interval into the actual days represented
    The days can be fractional.
*/
DayIterator = function(beginDate, endDate) {
    this.beginDate = beginDate;
    this.endDate = endDate;
    this.reverse = beginDate.getTime() > endDate.getTime();
    this.previousDay = null;
};

_.extend(DayIterator.prototype, {
    next: function() {
        if (this.finished) {
            return null;
        }

        var dayBegin, dayEnd,
            first = false;

        if (!this.previousDay) {
            first = true;
            dayBegin = this.beginDate;
        }
        else {
            dayBegin = this.previousDay;
        }

        dayEnd = new Date(dayBegin);

        if (this.reverse) {
            dayEnd.setHours(0);
            dayEnd.setMinutes(0);
            dayEnd.setSeconds(0);
            dayEnd.setMilliseconds(0);

            if (dayEnd.getTime() <= this.endDate.getTime()) {
                dayEnd = this.endDate;
                this.finished = true;
            }
            else {
                var prev = new Date(dayEnd);
                prev.setMilliseconds(-1);
                this.previousDay = prev;
            }

            return {
                begin: dayEnd,
                end: dayBegin
            }
        }
        else {
            dayEnd.setHours(23);
            dayEnd.setMinutes(59);
            dayEnd.setSeconds(59);
            dayEnd.setMilliseconds(-1);

            if (dayEnd.getTime() >= this.endDate.getTime()) {
                dayEnd = this.endDate;
                this.finished = true;
            }
            else {
                dayEnd.setMilliseconds(1000);
                this.previousDay = dayEnd;
            }

            return {
                begin: dayBegin,
                end: dayEnd
            }
        }
    }
});

var DayIterator2 = function(beginDate, endDate) {
    this.beginDate = moment(beginDate);
    this.endDate = moment(endDate);
    this.reverse = beginDate.isAfter(endDate);
    this.previousDay = null;
};

_.extend(DayIterator2.prototype, {
    next: function() {
        if (this.finished) {
            return null;
        }

        var dayBegin, dayEnd,
            first = false;

        if (!this.previousDay) {
            first = true;
            dayBegin = this.beginDate;
        }
        else {
            dayBegin = this.previousDay;
        }

        dayEnd = moment(dayBegin);

        if (this.reverse) {
            dayEnd.startOf('day');

            if (dayEnd.isBefore(this.endDate)) {
                dayEnd = this.endDate;
                this.finished = true;
            }
            else {
                this.previousDay = moment(dayEnd).endOf('day');
            }

            return {
                begin: dayEnd.format('x') - 0,
                end: dayBegin.format('x') - 0
            }
        }
        else {
            dayEnd.endOf('day');

            if (dayEnd.isAfter(this.endDate)) {
                dayEnd = this.endDate;
                this.finished = true;
            }
            else {
                dayEnd.setMilliseconds(1000);
                this.previousDay = moment(dayEnd).startOf('day').add(1, 'days');
            }

            return {
                begin: dayBegin.format('x') - 0,
                end: dayEnd.format('x') - 0
            }
        }
    }
});

//   SunriseSunset Class (2011-05-02)
//
// OVERVIEW
//
//   Implementation of http://williams.best.vwh.net/sunrise_sunset_algorithm.htm
//
// LICENSE
//
//   Copyright 2011 Preston Hunt <me@prestonhunt.com>
//
//   Licensed under the Apache License, Version 2.0 (the "License");
//   you may not use this file except in compliance with the License.
//   You may obtain a copy of the License at
//
//       http://www.apache.org/licenses/LICENSE-2.0
//
//   Unless required by applicable law or agreed to in writing, software
//   distributed under the License is distributed on an "AS IS" BASIS,
//   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//   See the License for the specific language governing permissions and
//   limitations under the License.
//
// DESCRIPTION
//
//   Provides sunrise and sunset times for specified date and position.
//   All dates are UTC.  Year is 4-digit.  Month is 1-12.  Day is 1-31.
//   Longitude is positive for east, negative for west. Latitude is
//   positive for north, negative for south.
//
// SAMPLE USAGE
//
//   var tokyo = new SunriseSunset( 2011, 1, 19, 35+40/60, 139+45/60); 
//   tokyo.sunriseUtcHours()      --> 21.8199 = 21:49 GMT
//   tokyo.sunsetUtcHours()       --> 7.9070  = 07:54 GMT
//   tokyo.sunriseLocalHours(9)   --> 6.8199  = 06:49 at GMT+9
//   tokyo.sunsunsetLocalHours(9) --> 16.9070 = 16:54 at GMT+9
//   tokyo.isDaylight(1.5)        --> true
//
//   var losangeles = new SunriseSunset( 2011, 1, 19, 34.05, -118.233333333 );
//   etc.

var SunriseSunset = function( utcFullYear, utcMonth, utcDay, latitude, longitude ) {
    this.zenith = 90 + 50/60; //   offical      = 90 degrees 50'
                              //   civil        = 96 degrees
                              //   nautical     = 102 degrees
                              //   astronomical = 108 degrees

    this.utcFullYear = utcFullYear;
    this.utcMonth = utcMonth;
    this.utcDay = utcDay;
    this.latitude = latitude;
    this.longitude = longitude;

    this.rising = true; // set to true for sunrise, false for sunset
    this.lngHour = this.longitude / 15;
};

SunriseSunset.prototype = {
    sin: function( deg ) { return Math.sin( deg * Math.PI / 180 ); },
    cos: function( deg ) { return Math.cos( deg * Math.PI / 180 ); },
    tan: function( deg ) { return Math.tan( deg * Math.PI / 180 ); },
    asin: function( x ) { return (180/Math.PI) * Math.asin(x); },
    acos: function( x ) { return (180/Math.PI) * Math.acos(x); },
    atan: function( x ) { return (180/Math.PI) * Math.atan(x); },

    getDOY: function() {
        var month = this.utcMonth,
            year = this.utcFullYear,
            day = this.utcDay;

        var N1 = Math.floor( 275 * month / 9 );
        var N2 = Math.floor( (month + 9) / 12 );
        var N3 = (1 + Math.floor((year - 4 * Math.floor(year / 4 ) + 2) / 3));
        var N = N1 - (N2 * N3) + day - 30;
        return N;
    },

    approximateTime: function() {
        var doy = this.getDOY();
        if ( this.rising ) {
            return doy + ((6 - this.lngHour) / 24);
        } else {
            return doy + ((18 - this.lngHour) / 24);
        }
    },

    meanAnomaly: function() {
        var t = this.approximateTime();
        return (0.9856 * t) - 3.289;
    },

    trueLongitude: function() {
        var M = this.meanAnomaly();
        var L = M + (1.916 * this.sin(M)) + (0.020 * this.sin(2 * M)) + 282.634;
        return L % 360;
    },

    rightAscension: function() {
        var L = this.trueLongitude();
        var RA = this.atan(0.91764 * this.tan(L));
        RA %= 360;

        var Lquadrant  = (Math.floor( L/90)) * 90;
        var RAquadrant = (Math.floor(RA/90)) * 90;
        RA = RA + (Lquadrant - RAquadrant);
        RA /= 15;

        return RA;
    },

    sinDec: function() {
        var L = this.trueLongitude(),
            sinDec = 0.39782 * this.sin(L);

        return sinDec;
    },

    cosDec: function() {
        return this.cos(this.asin(this.sinDec()));
    },

    localMeanTime: function() {
        var cosH = (this.cos(this.zenith) - (this.sinDec() * this.sin(this.latitude))) 
            / (this.cosDec() * this.cos(this.latitude));

        if (cosH >  1) {
            return "the sun never rises on this location (on the specified date)";
        } else if (cosH < -1) {
            return "the sun never sets on this location (on the specified date)";
        } else {
            var H = this.rising ? 360 - this.acos(cosH) : this.acos(cosH);
            H /= 15;
            var RA = this.rightAscension();
            var t = this.approximateTime();
            var T = H + RA - (0.06571 * t) - 6.622;
            return T;
        }
    },

    hoursRange: function( h ) {
        return (h+24) % 24;
    },

    UTCTime: function() {
        var T = this.localMeanTime();
        var UT = T - this.lngHour;
        return this.hoursRange( UT );
        //if ( UT < 0 ) UT += 24;
        //return UT % 24;
    },

    sunriseUtcHours: function() {
        this.rising = true;
        return this.UTCTime();
    },

    sunsetUtcHours: function() {
        this.rising = false;
        return this.UTCTime();
    },

    sunriseLocalHours: function(gmt) {
        return this.hoursRange( gmt + this.sunriseUtcHours() );
    },

    sunsetLocalHours: function(gmt) {
        return this.hoursRange( gmt + this.sunsetUtcHours() );
    },

    isDaylight: function( utcCurrentHours ) {
        var sunriseHours = this.sunriseUtcHours(),
            sunsetHours = this.sunsetUtcHours();

        if ( sunsetHours < sunriseHours ) {
            // Either the sunrise or sunset time is for tomorrow
            if ( utcCurrentHours > sunriseHours ) {
                return true;
            } else if ( utcCurrentHours < sunsetHours ) {
                return true;
            } else {
                return false;
            }
        }

        if ( utcCurrentHours >= sunriseHours ) {
            return utcCurrentHours < sunsetHours;
        } 

        return false;
    }
};

module.exports = SimpleWaveView;