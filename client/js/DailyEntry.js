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
    jQueryColor = require('app/lib/jquery.color'),
    _ = require('backbone/node_modules/underscore'),
    Backbone = require('backbone'),
    moment = require('app/lib/moment');

window.$ = window.jQuery = $;

// -------------

$(function() {

(function(window, document) {

function jsonGet(url, data, success, error, complete, timeout) {
    data = data || {};
    error = error || defaultErrorCallback;
    success = success || defaultSuccessCallback;
    timeout = timeout || 5000;

    $.ajax(url, {
        data: {
            //'Params': JSON.stringify(data)
        },
        //contentType : 'application/json',
        type: 'GET',
        //dataType: 'json',
        success: success,
        error: error,
        complete: complete,
        timeout: timeout
    });
}

function defaultSuccessCallback(response, textStatus, jqXHR) {
    console.log('success', response);
}

function defaultErrorCallback(jqXHR, textStatus, errorThrown) {
    console.log('error', textStatus);
}

var Segment = function(details) {
    this.name = details.Name;
    this.beginText = details.Begin;
    this.duration = details.Duration * 60;
    this.contexts = details.Contexts;

    this.beginMoment = this.getMoment();
    this.endMoment = moment(this.beginMoment).add(this.duration, 'seconds');
}
_.extend(Segment.prototype, {
    getID: function() {
        return this.name + '-' + this.beginText;
    },

    getMoment: function() {
        var beginSplit = this.beginText.split(':'),
            hour = parseInt(beginSplit[0]),
            minute = parseInt(beginSplit[1]);

        var ts = moment()
                .startOf('day')
                .add(hour, 'hours')
                .add(minute, 'minutes');

        return ts;
    },

    timeContained: function(ts) {
        ts = moment(ts) || moment();
        return ts.isAfter(this.beginMoment) && ts.isBefore(this.endMoment)
    },

    pointContained: function(point, adjust) {
        adjust = adjust || 0;
        return this.timeContained((point.Time * 1000) + adjust);
    },

    pointCoverage: function(point, adjust) {
        // Compute whether point is found within any of the segments
        // If point has a duration, then calculate degree of containment

        var adjust = adjust || 0,
            pointBegin = moment((point.Time + adjust) * 1000),
            pointEnd = moment((point.EndTime + adjust) * 1000);

        var endsDuring = this.timeContained((point.EndTime + adjust) * 1000),
            endsAfter = pointEnd.isAfter(this.endMoment),
            beginsDuring = this.timeContained((point.Time + adjust) * 1000),
            beginsBefore = pointBegin.isBefore(this.beginMoment);

        if (beginsBefore && endsAfter) {
            return this.duration;
        }
        else if (beginsBefore && endsDuring) {
            var overlap = pointEnd.format('X') - this.beginMoment.format('X');
            return overlap;
        }
        else if (beginsDuring && endsAfter) {
            var overlap = pointBegin.format('X') - this.beginMoment.format('X');
            return this.duration - overlap;
        }
        else if (beginsDuring && endsDuring) {
            return point.Duration;
        }
        else {
            return 0;
        }
    }
});

var MultiSegment = function(segments, contextID) {
    this.segments = segments;
    this.contextID = contextID;
}
_.extend(MultiSegment.prototype, {
    getName: function() {

    },

    pointContained: function(point, adjust) {
        return _.any(this.segments, function(segment) {
            return segment.pointContained(point, adjust);
        });
    },

    pointCoverage: function(point, adjust) {
        var segmentResults = _.map(this.segments, function(segment) {
            return {
                'Segment': segment,
                'Coverage': segment.pointCoverage(point, adjust)
            }
        });

        // Limit to segment with greatest overlap, for now, even though it's not entirely accurate.
        return _.max(segmentResults, function(result) {
            return result.Coverage;
        });
    }
});

var DailySchedule = function() {
    this.dailySchedules = [{
        dayName: 'Workday',
        rootContextID: 'rI',
        activateFunc: function(ts) {
            ts = moment(ts);
            return ts.day() >= 1 && ts.day() <= 4;
        },
        segments: [
            new Segment({
                'Name': 'Snack',
                'Begin': '7:00',
                'Duration': 5,
                'Contexts': ['1rF']
            }),
            new Segment({
                'Name': 'Warmup Exercise',
                'Begin': '7:05',
                'Duration': 15,
                'Contexts': ['1Cw']
            }),
            new Segment({
                'Name': 'Breakfast',
                'Begin': '7:20',
                'Duration': 20,
                'Contexts': ['1Ca']
            }),
            new Segment({
                'Name': 'Personal Care',
                'Begin': '7:40',
                'Duration': 20,
                'Contexts': ['1zQ', 'mS']
            }),
            new Segment({
                'Name': 'Paying Work',
                'Begin': '8:00',
                'Duration': 180,
                'Contexts': ['Kc']
            }),
            new Segment({
                'Name': 'Lunch',
                'Begin': '11:00',
                'Duration': 30,
                'Contexts': ['1Cb']
            }),
            new Segment({
                'Name': 'Paying Work',
                'Begin': '11:30',
                'Duration': 180,
                'Contexts': ['Kc']
            }),
            new Segment({
                'Name': 'Snack',
                'Begin': '14:30',
                'Duration': 30,
                'Contexts': ['1rF']
            }),
            new Segment({
                'Name': 'Personal Projects',
                'Begin': '15:00',
                'Duration': 150,
                'Contexts': ['3CJ'] //2Kl', '3dw']
            }),
            new Segment({
                'Name': 'Dinner',
                'Begin': '17:30',
                'Duration': 45,
                'Contexts': ['1rD']
            }),
            new Segment({
                'Name': 'Household',
                'Begin': '18:15',
                'Duration': 15,
                'Contexts': ['mM']
            }),
            new Segment({
                'Name': 'Evening Activity',
                'Begin': '18:30',
                'Duration': 255,
                'Contexts': ['1zT', '1zS', '2Zm', '2Zn']
            }),
            new Segment({
                'Name': 'Evening Personal Care',
                'Begin': '22:45',
                'Duration': 15,
                'Contexts': ['1zQ', 'mS']
            }),
            new Segment({
                'Name': 'Sleep',
                'Begin': '23:00',
                'Duration': 480,
                'Contexts': ['1fD']
            })
        ]
        // Grocery shopping: ot
    }]
};

_.extend(DailySchedule.prototype, {
    isMobile: ('ontouchstart' in document.documentElement),
    isAndroid: (/android/i.test(navigator.userAgent)),
    isApple: (/iphone|ipod|ipad/i.test(navigator.userAgent)),
    isMac: (/Macintosh/.test(navigator.userAgent)),
    isTablet: (/ipad/i.test(navigator.userAgent) || ((/android/i.test(navigator.userAgent)) && !(/mobile/i.test(navigator.userAgent)))),

    init: function(options) {
        options = options || {};
        _.bindAll(this, 'getData');

        this.$container = $('#segment-container');
        window.E = this;
        this.results = {};

        this.getData();

        this.numDays = 7 * 8;
    },

    getSchedule: function() {
        var now = moment();
        return _.find(this.dailySchedules, function(daySchedule) {
            return true;
            return daySchedule.activateFunc(now);
        });
    },

    initSkeleton: function($container) {
        $container = $container || this.$container;

        var prevSchedule = this.currentSchedule;
        this.currentSchedule = this.getSchedule();
        if (!this.currentSchedule) {
            $container.html('No schedule today');
            return;
        }

        if (!prevSchedule || prevSchedule.dayName != this.currentSchedule.dayName) {
            $container.empty();

            _.each(this.currentSchedule.segments, function(segment, i) {
                var ts = segment.beginMoment;

                var $segmentEl = $('<div>')
                                .addClass('segment')
                                .attr('data-idx', i)
                                .html('<div class="segment-header">' + ts.format('hh:mma') + ' - ' + segment.name + '</div><div class="options"></div>');
                
                $container.append($segmentEl);
            }, this);
        }
    },

    renderGraph: function(rootContextID, numDays) {
        // Create indexes
        var currentSchedule = this.getSchedule();
        if (!currentSchedule) {
            console.log('No schedule');
            return;
        }

        var contextToSegment = {};
        _.each(currentSchedule.segments, function(segment, i) {
            _.each(segment.contexts, function(contextID) {
                if (!(contextID in contextToSegment)) {
                    contextToSegment[contextID] = [];
                }
                contextToSegment[contextID].push(segment);
            }, this);
        });

        _.each(contextToSegment, function(segments, contextID) {
            contextToSegment[contextID] = new MultiSegment(segments, contextID);
        });

        var _this = this,
            metrics = {},
            EOD = moment().endOf('day');

        var calcDay = function(p) {
            var pointTime = moment(p.Time * 1000),
                daysDiff = EOD.diff(pointTime, 'days');
            return daysDiff;
        }

        this.getPoints(rootContextID, numDays - 1, function(points) {
            // Group by day
            var pointGroups = _.groupBy(points, calcDay);
            _.each(pointGroups, function(dayPoints, i) {
                i = i - 0;
                metrics[i] = {
                    'Coverage': {
                        'ScheduleCoverage': 0,
                        'ScheduleTime': 0,
                        'ActionTime': 0
                    },
                    'Contain': {
                        'NumPoints': 0,
                        'NumContained': 0
                    },
                    'WorkTime': 0
                }

                var segmentDedup = {};

                _.each(dayPoints, function(p) {
                    var contextID = p.ContextID;
                    while (contextID) {
                        var segments = contextToSegment[contextID];
                        if (segments) {
                            // TODO: Handle the case where there are multiple actions for a single
                            // segment. Don't want to include the segment duration multiple times.
                            if (contextID == 'Kc') {
                                metrics[i].WorkTime += p.Duration;
                            }
                            var adjust = i * 86400;
                            if (p.Duration) {
                                var result = segments.pointCoverage(p, adjust);

                                // If there's no segment coverage then the action was completely outside
                                // the schedule, and so doesn't contribute to the degree to which
                                // the actual schedule was covered
                                if (result.Coverage > 0) {
                                    metrics[i].Coverage.ScheduleCoverage += result.Coverage;

                                    // The duration of the point
                                    metrics[i].Coverage.ActionTime += p.Duration;

                                    var segmentID = result.Segment.getID();
                                    if (!(segmentID in segmentDedup)) {
                                        segmentDedup[segmentID] = true;

                                        // The duration of the segment (only once)
                                        metrics[i].Coverage.ScheduleTime += result.Segment.duration;
                                    }
                                }
                            }
                            else {
                                var result = segments.pointContained(p, adjust);
                                metrics[i].Contain.NumPoints += 1;
                                metrics[i].Contain.NumContained += (result ? 1 : 0);
                            }
                        }

                        var parentContext = _this.contextIdx[contextID];
                        contextID = parentContext ? parentContext.upAssociations[0] : null;
                    }
                });

                /*console.log('Day: ' + i);
                console.log('Coverage: ' + (metrics[i].Coverage / 86400));
                console.log('Contain: ' + (metrics[i].Contain.NumContained / metrics[i].Contain.NumPoints));*/
            });

            var beginDate1 = EOD,
                endDate1 = moment(beginDate1).subtract(numDays, 'days');

            var adherenceData = _.map(_.range(0, numDays), function(i) {
                var dayMetrics = metrics[i],
                    val = 0;

                if (dayMetrics) {
                    //val = 100 * (dayMetrics.Contain.NumContained / dayMetrics.Contain.NumPoints);
                    //val = 100 * (dayMetrics.Coverage.ScheduleCoverage / 86400);
                    val = 100 * (dayMetrics.Coverage.ScheduleCoverage / dayMetrics.Coverage.ScheduleTime);
                }

                return Math.round(val || 0);
            });

            var workData = _.map(_.range(0, numDays), function(i) {
                var val = 0;
                if (metrics[i]) {
                    val = (metrics[i].WorkTime / 3600) / 8;
                }

                return Math.round(Math.min(1.0, val) * 100);
            });

            var coverageData = _.map(_.range(0, numDays), function(i) {
                var val = 0;
                if (metrics[i]) {
                    val = metrics[i].Coverage.ScheduleTime / 86400;
                }

                return Math.round(val * 100);
            });

            _this.renderStreamGraph('#stream-graph', numDays, [workData, adherenceData]);

            if (metrics && metrics[0]) {
                _this.setTodaysMetrics(metrics[0]);
            }
            _this.setTodaysHours(points, 'Kc');
        });
    },

    renderStreamGraph: function(container, numSegments, layers) {
        //console.log(JSON.stringify(layers));
        
        // Layers ordered inner first, outer last
        var symLayers = [].concat(layers).reverse();
        symLayers = symLayers.concat(layers);

        var w = $(container).width(),
            h = $(container).height(),
            svgEl = this.renderStreamGraphSVG(w, h, numSegments, symLayers),
            serializer = new XMLSerializer(),
            svgStr = serializer.serializeToString(svgEl),
            svgDataUrl = 'data:image/svg+xml;base64,' + window.btoa(svgStr);

        var svgImgReady = function() {
            var canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            canvas.getContext('2d').drawImage(svgImg, 0, 0, w, h);
            var imgDataUrl = canvas.toDataURL('image/png');
            console.log(imgDataUrl.length, imgDataUrl.length);

            var outImg = new Image();
            outImg.src = imgDataUrl;
            $(container).empty().append(outImg);
        }

        var svgImg = new Image();
        svgImg.width = w;
        svgImg.height = h;
        svgImg.onload = svgImgReady;
        svgImg.src = svgDataUrl;
        if (svgImg.complete) {
            svgImgReady();
        }

/*
            svgEl = this.renderStreamGraphSVG(w, h, numSegments, symLayers),
            serializer = new XMLSerializer(),
            svgStr = serializer.serializeToString(svgEl),
            svgDataUrl = 'data:image/svg+xml;base64,' + window.btoa(svgStr);

        var svgImg = new Image();
        svgImg.width = w;
        svgImg.height = h;
        svgImg.src = svgDataUrl;

        var canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(svgImg, 0, 0, w, h);
        var imgDataUrl = canvas.toDataURL('image/png');

        var outImg = new Image();
        outImg.src = imgDataUrl;
        $(container).empty().append(outImg);

        console.log(Date.now() - t);
        return outImg;*/
    },

    renderStreamGraphSVG: function(width, height, numSegments, layers) {
        if (!this.$svgContainer) {
            this.$svgContainer = $('<div>').hide().appendTo('body');
        }
        this.$svgContainer.empty();
        var stack = d3.layout.stack().offset('silhouette'),
            layers0 = stack(layers.map(function(d) {
                    return formatLayer(d);
                }));

        var x = d3.scale.linear()
            .domain([0, numSegments - 1])
            .range([0, width]);

        var y = d3.scale.linear()
            .domain([0, d3.max(layers0, function(layer) {
                return d3.max(layer, function(d) { return d.y0 + d.y; });
            })])
            .range([height, 0]);

        var area = d3.svg.area()
            .x(function(d) { return x(d.x); })
            .y0(function(d) { return y(d.y0); })
            .y1(function(d) { return y(d.y0 + d.y); });

        var svg = d3.select(this.$svgContainer.get()[0]).append('svg')
                    .attr('width', width)
                    .attr('height', height);

        svg.selectAll('path')
            .data(layers0)
          .enter().append('path')
            .attr('d', area)
            .style('fill', function(d, layerID) { 
                if (layerID == 0 || layerID == 3) {
                    return '#666';
                }
                else if (layerID == 1 || layerID == 2) {
                    return '#888';
                }
                return '#aaa';
            });

        function formatLayer(data) {
          return data.map(function(v, i) {
            return {x: i, y: v};
          });
        }

        return $('svg', this.$svgContainer).get()[0];
    },

    setTodaysMetrics: function(metrics) {
        if (metrics.Coverage.ScheduleTime) {
            $('.today-coverage-rel > span').html(Math.round(100 * metrics.Coverage.ScheduleCoverage / metrics.Coverage.ScheduleTime));
        }
        else {
            $('.today-coverage-rel > span').html(0);
        }
        $('.today-coverage-abs > span').html(Math.round(100 * metrics.Coverage.ScheduleCoverage / 86400));
        $('.today-contain > span').html(Math.round(100 * metrics.Contain.NumContained / metrics.Contain.NumPoints));
    },

    setTodaysHours: function(points, contextID) {
        var _this = this,
            dayBegin = moment().startOf('day'),
            dayEnd = moment().endOf('day'),

            weekBegin = moment().startOf('week'),
            weekEnd = moment().endOf('week'),

            lastWeekBegin = moment().startOf('week').subtract(1, 'weeks'),
            lastWeekEnd = moment().endOf('week').subtract(1, 'weeks'),

            monthEnd = moment().endOf('day'),
            monthBegin = moment().endOf('day').subtract(4, 'weeks'),

            newBegin = moment('2015-09-25T00:00:00.000'),

            dayTime = 0,
            weekTime = 0,
            lastWeekTime = 0,
            monthTime = 0,
            newTime = 0;

        function getPoints(contextID) {
            var context = _this.contextIdx[contextID];
            if (!context) {
                return;
            }
            _.each(context.downAssociations, function(contextID) {
                _.each(points, function(point) {
                    if (point.ContextID != contextID) {
                        return false;
                    }

                    if (moment(point.Time * 1000).isBetween(dayBegin, dayEnd)) {
                        dayTime += point.Duration;
                    }

                    if (moment(point.Time * 1000).isBetween(weekBegin, weekEnd)) {
                        weekTime += point.Duration;
                    }

                    if (moment(point.Time * 1000).isBetween(lastWeekBegin, lastWeekEnd)) {
                        lastWeekTime += point.Duration;
                    }

                    if (moment(point.Time * 1000).isBetween(monthBegin, monthEnd)) {
                        monthTime += point.Duration;
                    }

                    if (moment(point.Time * 1000).isBetween(newBegin, monthEnd)) {
                        newTime += point.Duration;
                    }
                });

                getPoints(contextID);
            });
        }

        getPoints(contextID);
        var hours = (dayTime / 3600).toFixed(1);
        $('.hours-today > span').html(hours);

        var hours = (weekTime / 3600).toFixed(1);
        $('.hours-week > span').html(hours);

        var hours = (lastWeekTime / 3600).toFixed(1);
        $('.hours-lastweek > span').html(hours);

        var hours = (monthTime / 3600).toFixed(1);
        $('.hours-month > span').html(hours);

        var hours = (newTime / 3600).toFixed(1);
        $('.hours-new > span').html(hours);
    },

    setSegmentActive: function(segment, $segmentEl) {
        var now = moment();
        if (segment.timeContained(now)) {
            $segmentEl.addClass('active');
        }
    },

    getData: function() {
        this.initSkeleton(this.$container);

        if (this.currentSchedule) {
            $('.segment').removeClass('active');

            /*_.each(this.currentSchedule.segments, function(segment, i) {
                var $segmentEl = $('.segment[data-idx=' + i + ']'),
                    uniqueId = Math.round(Math.random() * 1000000),
                    _this = this;

                this.setSegmentActive(segment, $segmentEl);
                this.results[uniqueId] = [];

                var onComplete = _.after(segment.contexts.length, function() {
                    _this.renderOptions(_this.processContexts(_this.results[uniqueId]), $segmentEl);
                    delete _this.results[uniqueId]
                });

                function success(contexts) {
                    _this.results[uniqueId] = _this.results[uniqueId].concat(contexts);
                    onComplete();
                }

                _.each(segment.contexts, function(contextID) {
                    this.getContextData(contextID, success, $segmentEl);
                }, this);
            }, this);*/

            var _this = this

            var success = function(contexts) {
                var contextIdx = {}
                _.each(contexts, function(context) {
                    contextIdx[context.sid] = context;
                });
                _this.contextIdx = contextIdx;

                _.each(_this.currentSchedule.segments, function(segment, i) {
                    var $segmentEl = $('.segment[data-idx=' + i + ']');
                    this.setSegmentActive(segment, $segmentEl);

                    var segmentContexts = [];
                    _.each(segment.contexts, function(contextID) {
                        var downContexts = this.getDownContexts(contextIdx, contextID);
                        segmentContexts = segmentContexts.concat(downContexts);
                    }, this);

                    this.renderOptions(this.processContexts(segmentContexts), $segmentEl);
                }, _this);

                _this.renderGraph('rI', _this.numDays);
            };

            this.getContextData(this.currentSchedule.rootContextID, success);
        }

        _.delay(this.getData, 5 * 60 * 1000);
    },

    getDownContexts: function(contextIdx, contextID) {
        var downContexts = [];

        var context = contextIdx[contextID];
        if (!context) {
            return downContexts;
        }

        _.each(context.downAssociations, function(downContextID) {
            downContexts.push(contextIdx[downContextID]);
            downContexts = downContexts.concat(this.getDownContexts(contextIdx, downContextID));
        }, this);

        return downContexts;
    },

    processContexts: function(contexts) {
        var topOptions = _.chain(contexts)
            .sortBy(function(context) {
                var metaData = context.MetaData || {};
                var score = metaData.CurrentScore || 0;
                return -score;
            })
            .filter(function(context) {
                return context.downAssociations.length == 0;
            })
            .first(10)
            .map(function(context) {
                return context.label
            })
            .value();

        return topOptions;
    },

    renderOptions: function(optionNames, $segmentEl) {
        $('.options', $segmentEl)
                .empty()
                .append(
                    $('<div>')
                        .addClass('option-details')
                        .html(optionNames.join(', ')
                    ));
    },

    getPoints: function(contextID, days, success) {
        var days = days || 1,
            interval = days * 86400,
            anchorTime = moment().endOf('day') / 1000;

        jsonGet('/app/data/points/' + contextID + '?AnchorTime=' + anchorTime + '&Interval=' + interval, null, success);
    },

    getContextData: function(contextID, success, $segmentEl) {
        var _this = this;
        success = success || function(contexts) {
            _this.renderOptions(_this.processContexts(contexts), $segmentEl);
        };

        jsonGet('/app/data/contexts/' + contextID, null, success);
    },

    QueryString: function() {
        var queryString = {};
        var query = window.location.search.substring(1);
        var vars = query.split('&');

        for (var i = 0; i < vars.length; i++) {
            var pair = vars[i].split('='),
                first = pair[0],
                second = pair[1];

            if (typeof queryString[first] === 'undefined') {
                queryString[first] = second;
            }
            else if (typeof queryString[first] === 'string') {
                queryString[first] = [queryString[first], second];
            }
            else {
                queryString[first].push(second);
            }
        } 
        return queryString;
    }()
});

var dailySchedule = new DailySchedule();
dailySchedule.init();
window.ds = dailySchedule;

}(window, document));

});
