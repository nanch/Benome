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
    _ = require('backbone/node_modules/underscore'),
    Hammer = require('hammerjs');

Backbone.$ = $;



var ReportView = Backbone.View.extend({
    tagName: 'div',
    className: 'report',

    initialize: function(options) {
        options = options || {};
        _.bindAll(this, 'render');

        this.hideLabels = options.hideLabels || false;
    },

    render: function(options) {
        options = options || {};
        var contextID = options.contextID || this.contextID || this.B.getActiveContextID();

        if (!contextID) {
            return;
        }

        this.contextID = contextID;

        this.$el
            .empty()
            .scrollTop(0)
            .scrollLeft(0);

        var _this = this,
            data = {};

        var s = function(response, textStatus, jqXHR) {
            if (response && response.Success) {
                if (response.Data && response.Data.DayPoints) {
                    _this._render(response.Data.DayPoints);
                }
            }
        }

        this.B.jsonGet('/context/report/' + contextID + '?callback=?', data, s);

        return this;
    },

    _render: function(dayPoints) {
        this.points = dayPoints || [];

        if (this.points.length == 0) {
            this.B.trigger('HistoryEmpty');
            return;
        }

        var $base = $('<div>').addClass('report'),
            _this = this;

        _.each(_.first(this.points, 7), function(dayData) {
            var epochDay = dayData[0],
                weekDay = dayData[1],
                points = dayData[2],
                dayStr = dayData[3];

            var $col = $('<div>').addClass('activity-column').data('columnID', epochDay),
                $header = $('<div>')
                                .addClass('header')
                                .text(dayStr);

            $col.append($header);

            _.each(points, function(point) {
                var backgroundColor = this.B.getColor(point.ContextID),
                    textColor = this.B.contrastColor(backgroundColor);

                var $activity = $('<div>')
                                    .addClass('activity')
                                    .data('pointDetails', {
                                        pointID: point.ID,
                                        contextID: point.ContextID,
                                        columnID: epochDay
                                    })
                                    .css({
                                        'background-color': backgroundColor,
                                        'color': textColor
                                    });

                var mc = new Hammer($activity.get()[0]);
                mc.on('press', function(e) {
                    this.B.deletePoint(point.ID, point.ContextID, _this.render);
                    return false;
                });

                mc.on('tap', function(e) {
                    this.B.addPoint(point.ContextID, null, null, _this.render);
                    return false;
                });

                if (!this.hideLabels) {
                    $activity.text(point.Label);
                }

                $col.append($activity);
            }, this);

            $base.append($col);
        }, this);

        this.$el.append($base);
    },

    getAllPoints: function() {
        var allPoints = [];
        _.each(this.points, function(dayData) {
            var columnPoints = [].concat(dayData[2]);
            allPoints = allPoints.concat(columnPoints.reverse());
        });

        return allPoints;
    },

    getColumnPoints: function(columnID) {
        var columnData = _.find(this.points, function(dayData) {
            return dayData[0] == columnID;
        });

        return [].concat(columnData[2]).reverse();
    },

    calcDestTimestamp: function(pointDetails) {
        var columnPoints = this.getColumnPoints(pointDetails.columnID),
            destPoint = _.find(columnPoints, function(point) {
                return point.ID == pointDetails.pointID;
            }),
            destPointIdx = _.indexOf(columnPoints, destPoint),
            nearPoint = columnPoints[destPointIdx - 1];

        if (nearPoint) {
            // Return the midpoint
            return Math.round(destPoint.Time + ((nearPoint.Time - destPoint.Time) / 2));
        }
        else {
            // Either slightly newer or halfway to EOD
            return destPoint.Time + 5;
        }
    },

    movePoint: function(originDetails, destDetails) {
        if (originDetails.pointID == destDetails.pointID) {
            return;
        }

        // Calculate new timestamp and save it to the server
        var newTimeStamp = this.calcDestTimestamp(destDetails);
        if (newTimeStamp) {
            this.B.modifyPointTimestamp(originDetails.pointID, newTimeStamp, this.render);
        }
    },

    show: function() {
        this.$el.show();
    },

    hide: function() {
        this.$el.hide();
    }
});

module.exports = ReportView;