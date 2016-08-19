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
    Hammer = require('hammerjs'),
    moment = require('app/lib/moment');
Backbone.$ = $;

var PointListView = require('app/views/PointListView');

// -------------

var TimelineView = Backbone.View.extend({
    tagName: 'div',
    className: 'timeline-view',

    events: {
    },

    initialize: function(options) {
        options = options || {};
        this.G = this.G || options.G || require('app/Global')();
        _.bindAll(this, 'render', 'pointDropHandler');
        
        this.dragHandler = options.dragHandler || null;
        this.hideLabels = options.hideLabels || false;
        this.visible = !!options.visible;
        this.clusterController = options.clusterController;
        this.timeIntervalHours = 4;
        this.setPointsCollection(options.points);
    },

    setPointsCollection: function(pointsCollection) {
        if (pointsCollection) {
            this.points = pointsCollection;
            this.points.on('add change remove', this.render);

            this.render();
        }
    },

    render: function() {
        this.$el.empty();

        // Starting from the beginning of the day to now

        // 
        var now = new Date(),
            numDaysDisplayed = 1.5,
            refTime = moment().subtract(24 * numDaysDisplayed, 'hours'),
            segmentSize = this.timeIntervalHours,
            numSegments = (24 * numDaysDisplayed) / segmentSize; // Math.floor(now.getHours() / segmentSize);

        var displayPoints = _.map(_.range(0, numSegments + 1), function(hour) {
            var clientTime = moment(refTime);
            clientTime.add(hour * segmentSize, 'hours');

            return new Backbone.Model({
                PointType: 'Time',
                ClientTime: clientTime,
                Time: Math.round(clientTime.unix())
            });
        });

        var points = [];
        if (this.points) {
            points = this.points.getRecentPoints(86400 * numDaysDisplayed);
        }

        var timelinePoints = _.sortBy(displayPoints.concat(points), function(p) {
            return -p.get('Time');
        });

        this.pointViews = [];

        _.each(timelinePoints, function(point) {
            if (point.get('PointType') == 'Time') {
                var hour = point.get('ClientTime').get('hours'),
                    $timeItem = $('<div>')
                                    .addClass('timeline-time-item')
                                    .text(hour + ':00');

                if (this.G.isMobile) {
                    $timeItem.addClass('timeline-time-item-mobile');
                }

                if (hour == 0) {
                    $timeItem.addClass('timeline-time-item-highlight');
                }

                this.$el.append($timeItem);
            }
            else {
                var pointView = new PointListView({
                                                    G: this.G,
                                                    model: point,
                                                    hideLabel: this.hideLabels,
                                                    clusterController: this.clusterController,
                                                    dragHandler: this.dragHandler,
                                                    dropHandler: this.pointDropHandler
                                                });
                this.pointViews.push(pointView);
                this.$el.append(pointView.render());

                /*pointView.$el.data('timelinePoint', {
                        pointID: point.id,
                        contextID: point.get('ContextID')
                    });*/

            }
        }, this);
    },

    pointDropHandler: function(dropView, dragView, dragDetails, dropDetails) {
        if (dragView.className == 'point-list-view') {
            this.movePoint(dragView, dropView);
        }
    },

    calcDestTimestamp: function(destPoint) {
        var destPointIdx = _.indexOf(this.pointViews, destPoint),
            nearPoint = this.pointViews[destPointIdx - 1];

        if (nearPoint) {
            // Return the midpoint
            return Math.round(destPoint.model.get('Time') - ((nearPoint.model.get('Time') - destPoint.model.get('Time')) / 2));
        }
        else {
            // Either slightly newer or halfway to EOD
            return destPoint.model.get('Time') - 5;
        }
    },

    movePoint: function(originView, destView) {
        if (originView.model.id == destView.model.id) {
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

    toggleVisible: function(force, quick) {
        if (!this.visible || force === true) {
            this.show(!quick);
        }
        else if (this.visible || force === false) {
            this.hide(!quick);
        }
    },

    hide: function(anim) {
        this.visible = false;
        if (!anim) {
            this.$el.hide();
        }
        else {
            this.$el
                .animate({
                        'opacity': 0
                    }, {
                        duration: 150,
                        complete: function() {
                            $(this).hide();
                        }
                    });
        }

    },

    show: function(anim) {
        this.visible = true;
        if (!anim) {
            this.$el
                .css({
                        opacity: 1
                    })
                .show()
        }
        else {
            this.$el
                .css({
                    opacity: 0
                })
                .show()
                .animate({
                    'opacity': 1
                }, {duration: 300});
        }
    }
});

module.exports = TimelineView;