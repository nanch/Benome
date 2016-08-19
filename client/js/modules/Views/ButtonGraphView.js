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
    _ = require('underscore'),
    Backbone = require('backbone');

// Classes
var ButtonView = require('app/modules/Views/ButtonView'),
    StreamGraphD3_Class = require('app/modules/StreamGraphD3');

// Functions
var streamToFrequencyTarget = require('app/modules/Functions/StreamToFrequencyTarget'),
    calcPeriod = require('app/modules/Functions/CalcTimelinePeriod_WeightedInterval_StdDev');

// -------------

function darkenColor(color, darkenFactor) {
    var c = $.Color(color);
    c = c.transition($.Color('#000'), darkenFactor);
    return c.toHexString();
}

var ButtonGraphView = Backbone.View.extend({
    tagName: 'div',
    className: 'button-graph-view',

    events: {
    },

    initialize: function(options) {
        options = options || {};
        _.bindAll(this, 'onPointAdded', 'drawPoints');

        this.$el.addClass(this.className);

        var points = options.points || [],
            targetInterval = options.targetInterval || calcPeriod(points),
            wnd = options.window || 30,
            numSegments = options.numSegments || 200;

        this.color = options.color;
        this.graphColor = darkenColor(this.color, 0.35);
        this.pointSizeDenom = options.pointSizeDenom || 25;
        this.graphDisabled = options.graphDisabled;

        this.streamState = {
            points: points,
            targetInterval: targetInterval,
            window: wnd,
            numSegments: numSegments,
            numPoints: points.length,
            color: this.color,
            graphColor: this.graphColor,
            data: [
                streamToFrequencyTarget(points, wnd, numSegments, {
                        targetInterval: targetInterval
                    })
            ]
        }

        this.button = new ButtonView({
            el: this.$el,
            buttonID: this.buttonID,
            color: this.color
        });

        this.$bgEl = $('<canvas>')
                        .addClass('background')
                        .appendTo(this.button.$el);

        this.button.on('PointAdded', this.onPointAdded);

        if (!this.graphDisabled) {
            this.streamGraph = new StreamGraphD3_Class({
                graphID: options.label
            });
        }
        this.setLabel(options.label);
    },

    setPoints: function(points) {
        this.streamState.points = points;
        this.calcData();
        this.renderGraph();
    },

    onPointAdded: function(pointTime) {
        pointTime = pointTime / 1000;
        
        this.addPoint(pointTime);
        this.trigger('PointAdded', pointTime);
    },

    addPoint: function(pointTime) {
        pointTime = pointTime || Date.now() / 1000;
        var streamState = this.streamState;
        streamState.points.push(pointTime);

        this.calcData();
        this.renderGraph();
    },

    calcData: function(targetInterval) {
        var streamState = this.streamState;
        var targetInterval = targetInterval || streamState.targetInterval || calcPeriod(streamState.points);
        streamState.targetInterval = targetInterval;

        var anchorTime = Date.now() / 1000;
        streamState.data = streamToFrequencyTarget(streamState.points, streamState.window, streamState.numSegments, {
            targetInterval: targetInterval,
            anchorTime: anchorTime
        });
        streamState.anchorTime = anchorTime;

        return streamState;
    },

    render: function() {
        this.button.render();
        this.renderGraph();
        return this;
    },

    renderGraph: function() {
        if (this.graphDisabled) {
            return;
        }

        var streamState = this.streamState,
            $bgEl = this.$bgEl,

            anchorTime = streamState.anchorTime || (Date.now() / 1000),
            graphWindow = streamState.window,

            graphWidth = $bgEl.width(),
            graphHeight = $bgEl.height(),

            canvas = $bgEl.get()[0],
            _this = this;

        if (!streamState.data) {
            if (streamState.points.length) {
                var ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, graphWidth, graphHeight);
                this.drawPoints(anchorTime, graphWidth, graphHeight, streamState);
            }
            else {
                $bgEl.hide();
            }
            return;
        }
        $bgEl.show();

        this.streamGraph.render({
                data: [
                    {
                        Color: streamState.graphColor,
                        Data: streamState.data
                    }
                ],
                outputType: 'Canvas',
                destEl: canvas,
                width: graphWidth,
                height: graphHeight,
                antiAlias: true,
            }, function(canvas, yMax, yTotal) {
                _this.drawPoints(anchorTime, graphWidth, graphHeight, streamState);
            }
        );
    },

    drawPoints: function(anchorTime, graphWidth, graphHeight, streamState) {
        var canvas = this.$bgEl.get()[0],
            ctx = canvas.getContext('2d'),
            graphWindow = streamState.window,
            posY = graphHeight / 2,
            circleSize = graphHeight / this.pointSizeDenom,
            pointColor = streamState.color;

        _.each(streamState.points, function(pointTime) {
            var posX = ((anchorTime - pointTime) / graphWindow) * graphWidth;

            ctx.beginPath();
            ctx.arc(posX, posY, circleSize, 0, Math.PI * 2, true);
            ctx.lineWidth = (circleSize / 3);
            ctx.strokeStyle = 'black';
            ctx.stroke();

            ctx.fillStyle = pointColor;
            ctx.fill();
        });
    },

    getSize: function() {
        return this.button.getSize();
    },

    setLabel: function(label) {
        this.button.setLabel(label || '');
    }
});
_.extend(ButtonGraphView.prototype, Backbone.Events);

module.exports = ButtonGraphView;