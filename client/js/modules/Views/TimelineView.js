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
    _ = require('backbone/node_modules/underscore'),
    Backbone = require('backbone');

// -------------

var TimelinePointView = Backbone.View.extend({
    tagName: 'div',
    className: 'timeline-point-view',

    events: {
    },

    initialize: function(options) {
        options = options || {};
        this.timeStamp = options.timeStamp;
        this.color = options.color;
    },

    setColor: function(color) {
        this.color = color;
    },

    render: function(options) {
        options = options || {};

        this.$el.css({
            'background-color': options.color || this.color,
            'left': Math.ceil(options.left || 0) + 'px',
            'top': Math.ceil(options.top || 0) + 'px',
            'width': Math.ceil(options.radius * 2) + 'px',
            'height': Math.ceil(options.radius * 2) + 'px'
        });

        return this;
    }
});

var TimelineView = Backbone.View.extend({
    tagName: 'div',
    className: 'timeline-view',

    events: {
    },

    initialize: function(options) {
        options = options || {};
        _.bindAll(this, 'addPoint', 'renderTick');
        
        this.setColor(options.color || 'white');
        this.interval = options.interval || 15; // seconds
        this.direction = options.direction || 'ltr';

        this.on('AddPoint', this.addPoint);
        this.points = [];
        this.pointViews = {};

        this.renderTickInterval = 25;
        this.renderTick(this.renderTickInterval);
    },

    renderTick: function(intervalLength) {
        this.render();
        
        _.delay(this.renderTick, this.renderTickInterval);
    },

    setColor: function(color) {
        this.color = color;
    },

    addPoint: function(pointTime) {
        pointTime = pointTime || Date.now();
        this.points.push(pointTime);
        //this.render();
    },

    render: function(options) {
        options = options || {};
        this.pointRadius = options.pointRadius || this.pointRadius;

        var cutoff = this.interval * 1000,
            cutoffTime = Date.now() - cutoff,
            interval = this.interval,
            width = this.$el.width(),
            height = this.$el.height(),
            pointRadius = this.pointRadius;

        _.each(this.points, function(pointTime) {
            var pointTimeView = this.pointViews[pointTime],
                leftPos = (((pointTime - cutoffTime) / (interval * 1000)) * width) - pointRadius;
            //console.log(pointTime, pointTimeView, pointTimeView && pointTimeView.timeStamp);

            if (this.direction == 'ltr') {
                leftPos = width - leftPos;
            }

            if (pointTime >= cutoffTime - (cutoff * 1.25)) {
                if (!pointTimeView) {
                    pointTimeView = new TimelinePointView({
                        timeStamp: pointTime
                    });

                    pointTimeView.$el.appendTo(this.$el);
                }

                pointTimeView.render({
                    color: this.color,
                    radius: pointRadius,
                    left: leftPos,
                    top: (height - (pointRadius * 2)) / 2
                });

                this.pointViews[pointTime] = pointTimeView;
            }
            else {
                if (pointTimeView) {
                    pointTimeView.$el.remove();
                    pointTimeView.$el = null;
                    pointTimeView = null;
                    delete this.pointViews[pointTime];
                }
            }
        }, this);

        return this;
    }
});
_.extend(TimelineView.prototype, Backbone.Events);

module.exports = TimelineView;