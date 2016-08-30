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
    _ = require('underscore'),
    moment = require('app/lib/moment'),
    Hammer = require('hammerjs');

Backbone.$ = $;

var PointListView = require('app/views/PointListView');

var HistoryView = Backbone.View.extend({
    tagName: 'div',
    className: 'history',

    initialize: function(options) {
        options = options || {};
        this.G = this.G || options.G || require('app/Global')();
        _.bindAll(this, 'render', 'pointDropHandler', 'pointTargetDropHandler', 'calcPointColumn',
                    'dragHandler', 'scrollDragEndHandler', 'scrollDragMoveHandler');

        this.$container = options.container;
        this.numDays = options.numDays || 28;
        this.pointDragHandler = options.dragHandler || null;
        this.hideLabels = options.hideLabels || false;

        this.pointViewCache = {};

        this.$el.attr('BDragSource', '1');
        this.$el.data('ViewRef', this);

        this.G.globalCluster.cluster.contexts.points.on('remove', this.render);

        var _this = this,
            mc = new Hammer(this.$el.get()[0], {}),
            press = new Hammer.Press({ time: 500, threshold: 4});

        mc.add([press]);
        mc.on('press', function(e) {
            if ($(e.target).hasClass(_this.className)) {
                _this.trigger('Pressed');
                return false;
            }
        });

        this.scrollXAnchor = 0;
    },

    dragHandler: function(dragView, dragDetails) {
        var $ot = $(dragDetails.originalTarget);
        dragDetails.dragProxyStartX = parseInt($ot.css('left'));
        dragDetails.dragProxyStartY = parseInt($ot.css('top'));

        return {
            'dropHighlightDisabled': true,
            'dragMoveHandler': this.scrollDragMoveHandler,
            'dragEndHandler': this.scrollDragEndHandler
        }
    },

    scrollDragMoveHandler: function(dragDetails, moveDetails) {
        var newX = Math.max(0, this.scrollXAnchor + (moveDetails.deltaX * 2));
        this.$container.scrollLeft(newX);
        this.lastXVal = Math.min(newX, this.$container.scrollLeft());
    },

    scrollDragEndHandler: function(dragDetails, moveDetails) {
        this.scrollXAnchor = this.lastXVal;
    },

    render: function(options) {
        options = options || {};
        var contextID = options.contextID || this.contextID;

        if (!contextID) {
            return;
        }

        this.contextID = contextID;
        this.renderEOD = moment(this.G.getNow()).endOf('day');

        this.$el
            .empty();

        var leftScroll = 0;
        if (options.keepScrollPos) {
            leftScroll = this.lastXVal;
        }
        else {
            this.lastXVal = 0;
            this.scrollXAnchor = 0;
        }

        this.$container
            .scrollTop(0)
            .scrollLeft(0);

        var clusterController = this.G.globalCluster,
            contexts = clusterController.cluster.contexts,
            points = contexts.points.getRecentPoints(86400 * this.numDays, this.contextID),
            dayPoints = _.chain(points)
                            .filter(function(point) {
                                return point.getContext().isLeaf();
                            })
                            .groupBy(this.calcPointColumn)
                        .value();

        this.pointViews = [];
        _.each(_.range(0, this.numDays), function(dayIdx) {
            var points = _.sortBy(dayPoints[dayIdx], function(p) {
                    return p.get('Time');
                }),
                dayStamp = this.G.getNow() - (dayIdx * 86400 * 1000),
                dayStr = moment(dayStamp).format('ddd D'),
                colWidth = points.length > 0 ? 8 : 3;

            var $col = $('<div>')
                            .addClass('activity-column')
                            .data('columnID', dayIdx)
                            .css({width: this.G.fontSize * colWidth}),

                $header = $('<div>')
                                .addClass('header')
                                .css({
                                    'font-size': '1em'
                                })
                                .text(dayStr);

            if (moment(dayStamp).dayOfYear() == moment(this.G.getNow()).dayOfYear()) {
                $header.addClass('header-highlight');
            }

            $col.append($header);

            if (points.length > 0) {
                _.each(points, function(point) {
                    var pointView = this.pointViewCache[point.id] || new PointListView({
                        G: this.G,
                        model: point,
                        hideLabel: this.hideLabels,
                        contextCollection: contexts,
                        clusterController: clusterController,
                        showCallback: this.render,
                        addCallback: this.render,
                        dragHandler: this.pointDragHandler,
                        dropHandler: this.pointDropHandler
                    });
                    this.pointViewCache[point.id] = pointView;
                    this.pointViews.push(pointView);
                    $col.append(pointView.render());

                    pointView.columnID = dayIdx;
                }, this);
            }
            else {
                var pointTargetView = new PointTargetView({
                    timeStamp: parseInt(dayStamp / 1000),
                    dropHandler: this.pointTargetDropHandler
                });
                $col.append(pointTargetView.render());
            }

            this.$el.append($col);
        }, this);

        this.$container
            .scrollLeft(leftScroll);

        return this;
    },

    calcPointColumn: function(p) {
        var pointTime = moment(p.get('Time') * 1000),
            daysDiff = this.renderEOD.diff(pointTime, 'days');
        return daysDiff;
    },

    pointDropHandler: function(dropView, dragView, dragDetails, dropDetails) {
        this.movePoint(dragView, dropView);
    },

    pointTargetDropHandler: function(dropView, dragView, dragDetails, dropDetails) {
        var values = {
                'Timing': {
                    'Time': dropView.timeStamp
                }
            },
            point = dragView.model;

        if (point) {
            this.G.trigger('UpdatePoint', null, point, values, this.render, {keepScrollPos: true});
        }
    },

    getAllPoints: function() {
        var allPoints = [];
        _.each(this.points, function(dayData) {
            var columnPoints = dayData[2].slice();
            allPoints = allPoints.concat(columnPoints.reverse());
        });

        return allPoints;
    },

    getColumnPoints: function(columnIdx) {
        var _this = this;
        var columnData = _.filter(this.pointViews, function(pointView) {
            return _this.calcPointColumn(pointView.model) == columnIdx;
        })
        columnData = _.sortBy(columnData, function(pointView) {
            return -pointView.model.get('Time');
        })

        return columnData;
    },

    calcDestTimestamp: function(destPoint) {
        var columnPoints = this.getColumnPoints(this.calcPointColumn(destPoint.model)),
            destPointIdx = _.indexOf(columnPoints, destPoint),
            nearPoint = columnPoints[destPointIdx - 1];

        if (nearPoint) {
            // Return the midpoint
            return Math.round(destPoint.model.get('Time') + ((nearPoint.model.get('Time') - destPoint.model.get('Time')) / 2));
        }
        else {
            // Either slightly newer or halfway to EOD
            return destPoint.model.get('Time') + 5;
        }
    },

    movePoint: function(originView, destView) {
        if (!originView.model || originView.model.id == destView.model.id) {
            return;
        }

        // Calculate new timestamp and save it to the server
        var newTimeStamp = this.calcDestTimestamp(destView);
        if (newTimeStamp) {
            var values = {
                    'Timing': {
                        'Time': newTimeStamp
                    }
                },
                point = originView.model;

            if (point) {
                this.G.trigger('UpdatePoint', null, point, values, this.render);
            }
        }
    },

    show: function() {
        if (this.$container) {
            this.$container.show();
        }
        this.lastXVal = 0;
        this.scrollXAnchor = 0;
        this.$container.scrollLeft(0);
    },

    hide: function() {
        if (this.$container) {
            this.$container.hide();
        }
    }
});
_.extend(HistoryView, Backbone.Events);

var PointTargetView = Backbone.View.extend({
    tagName: 'div',
    className: 'point-target',

    events: {
    },

    initialize: function(options) {
        options = options || {};
        _.bindAll(this, 'render');

        this.timeStamp = options.timeStamp;
        this.dropHandler = options.dropHandler || null;

        this.el.setAttribute('BDropTarget', '1');
        this.$el.data('ViewRef', this);
    },

    render: function() {
        return this.$el;
    }
});

module.exports = HistoryView;