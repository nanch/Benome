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
var TimelineView = require('app/modules/Views/TimelineView'),
    ButtonView = require('app/modules/Views/ButtonView'),
    WaveState = require('app/modules/WaveState'),
    GraphView = require('app/modules/Views/GraphView'),
    ProbabilityView = require('app/modules/Views/ProbabilityView'),

    calcPeriod = require('app/modules/Functions/CalcTimelinePeriod_WeightedInterval_StdDev'),
    getColor = require('app/modules/Util/GetColor2');

// -------------

var ButtonTimelineView = Backbone.View.extend({
    tagName: 'div',
    className: 'button-timeline-view',

    events: {
    },

    initialize: function(options) {
        options = options || {};
        _.bindAll(this, 'onPointAdded');

        this.buttonLabel = options.label;
        this.intervalWidth = options.intervalWidth || 15;

        this.minIntervals = options.minIntervals || 1;
        this.maxIntervals = options.maxIntervals || 5;
        this.stddevFactor = options.stddevFactor || 1;
        this.showWave = options.showWave;
        this.timelineHeight = options.timelineHeight || 0.75;
        this.direction = options.direction || 'ltr';
        this.probabilityLabel = options.probabilityLabel || '';
        this.color = options.color || getColor(0);

        this.$buttonEl = $('<div>')
                            .addClass('button-view')
                            .appendTo(this.$el);

        this.buttonView = new ButtonView({
            label: this.buttonLabel,
            el: this.$buttonEl,
            color: this.color
        });

        var _this = this;
        this.buttonView.on('PointAdded', this.onPointAdded);

        if (!this.timelineView) {
            this.$timelineEl = $('<div>')
                                .addClass('timeline-view')
                                .appendTo(this.$el);

            this.timelineView = new TimelineView({
                color: this.buttonView.color,
                el: this.$timelineEl,
                interval: this.intervalWidth,
                direction: this.direction
            });
        }

        this.$graphEl = $('<div>')
                            .addClass('graph-view')
                            .appendTo(this.$el);

        this.waveState = new WaveState({
            waveSize: 4,
            waveColor: '#00f',
            waveFunc: function() {
                return _this.buttonView.buttonID;
            }
        });
    },

    onPointAdded: function(pointTime) {
        this.timelineView.addPoint(pointTime);

        var period = calcPeriod(this.timelineView.points, {
            minIntervals: this.minIntervals,
            maxIntervals: this.maxIntervals,
            stddevFactor: this.stddevFactor
        });

        if (period) {
            this.waveState.updateWave({
                waveID: this.buttonView.buttonID,
                Period: (period * 2 / 1000).toFixed(4),
                Decay: 0.4,
                RefTime: Date.now() / 1000
            });
        }

        this.trigger('PointAdded', this);
    },

    render: function(options) {
        options = options || {};

        var activityName = '',
            containerWidth = this.$el.width(),
            containerHeight = this.$el.height(),
            buttonRadius = 0.45 * containerHeight,
            buttonAreaLeft = (containerWidth / 2) - buttonRadius,
            buttonAreaTop = containerHeight * 0.03,
            _this = this;

        this.$buttonEl.css({
            'top': buttonAreaTop + 'px',
            'left': buttonAreaLeft + 'px',
            'width': (buttonRadius * 2) + 'px',
            'height': (buttonRadius * 2) + 'px'
        });
        this.buttonView.render();

        var timelineWidth = containerWidth * 0.5,
            timelineHeight = containerHeight * this.timelineHeight,
            timelineTop = (containerHeight - timelineHeight) / 2,
            pointRadius = timelineHeight / 2;

        var timelineLeft = this.direction == 'ltr' ? (containerWidth / 2) - (pointRadius * 2) : 0;

        this.$timelineEl.css({
            'top': timelineTop + 'px',
            'left': timelineLeft + 'px',
            'width': timelineWidth + 'px',
            'height': timelineHeight + 'px'
        });
        this.timelineView.render({
            pointRadius: pointRadius
        });

        var graphLeft = this.direction == 'ltr' ? (containerWidth / 2) : 0,
            graphWidth = containerWidth,
            graphHeight = containerHeight * 0.75,
            graphTop = (containerHeight - graphHeight) / 2;

        this.$graphEl.css({
            'top': graphTop + 'px',
            'left': graphLeft + 'px',
            'width': graphWidth + 'px',
            'height': graphHeight + 'px'
        });

        if (!this.graphView) {
            if (this.showWave === true) {
                this.graphView = new GraphView({
                    el: this.$graphEl, 
                    backgroundColor: 'rgba(0,0,0,1)',
                    initialX: containerWidth / 2,
                    intervalWidth: this.intervalWidth * 2,
                    displayInterval: 1000,
                    displayIntervalAnchor: Date.now(),
                    intervalLength: 2000,
                    curveFuncs: this.waveState,
                    direction: this.direction
                });
            }
            else if (this.showWave === false) {
                this.graphView = new ProbabilityView({
                    container: this.$el,
                    //backgroundColor: 'rgba(50,150,250,1)',
                    pointRadius: pointRadius,
                    backgroundColor: 'rgba(0,0,0,0)',
                    color: this.buttonView.color,
                    intervalWidth: this.intervalWidth,
                    intervalLength: 2000,
                    curveFuncs: this.waveState,
                    direction: this.direction,
                    label: this.probabilityLabel
                });
            }

            this.graphView.$el.appendTo(this.$el);
        }

        return this;
    }
});
_.extend(ButtonTimelineView.prototype, Backbone.Events);

module.exports = ButtonTimelineView;