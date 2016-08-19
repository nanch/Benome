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
    _ = require('underscore'),
    Backbone = require('backbone');

var ButtonGraphView = require('app/modules/Views/ButtonGraphView'),
    StreamGraphD3_Class = require('app/modules/StreamGraphD3'),
    getColor = require('app/modules/Util/GetColor2');

// -------------

var SingleButtonStreamGraph = Backbone.View.extend({
    tagName: 'div',
    className: 'singlebutton-streamgraph-view',

    events: {
    },

    initialize: function(options) {
        options = options || {};
        _.bindAll(this, 'pointAdded', 'render', 'renderLoop');

        this.$el.addClass(this.className);

        this.graphWindow = options.graphWindow || 10;
        this.buttonPointSizeDenom = options.buttonPointSizeDenom || 25;
        this.buttonGraphDef = options.buttonGraphDef;
        this.buttonSizeFactor = options.buttonSizeFactor || 0.9;
        this.points = options.points || [];
        this.targetInterval = options.targetInterval || null;


        this.$buttonContainer = $('<div>')
                                    .attr('id', 'button-container')
                                    .css({
                                        'width': '100%',
                                        'height': '100%',
                                        'position': 'absolute',
                                        'z-index': 2
                                    })
                                    .appendTo(this.$el);

        this.$centerGraphContainer = $('<canvas>')
                                    .attr('id', 'graph-container')
                                    .css({
                                        'width': '100%',
                                        'height': '100%',
                                        'position': 'absolute',
                                        'z-index': 1
                                    })
                                    .appendTo(this.$el);

        this.streamGraph = new StreamGraphD3_Class();

        // Delay resize until there is a pause
        var renderDebounce = _.debounce(this.render, 200);
        $(window).bind('resize', renderDebounce);

        this.throttledRender = _.throttle(this.render, 1000);

        this.renderButton();
        _.delay(this.renderLoop, 100);
    },

    renderLoop: function() {
        try {
            this.throttledRender({
                noResize: true
            });
        }
        catch (e) {}

        _.delay(this.renderLoop, 100);
    },

    render: function(options) {
        this.renderButton(options);
        this.renderCenterGraph(options);

        return this;
    },

    renderCenterGraph: function(options) {
        var $graphEl = this.$centerGraphContainer,
            _this = this;

        var $container = this.$buttonContainer,
            containerWidth = $container.width(),
            containerHeight = $container.height(),
            buttonSize = containerHeight * this.buttonSizeFactor,

            graphWidth = containerWidth - buttonSize,
            graphHeight = containerHeight,
            graphTop = 0,
            graphLeft = buttonSize;

        $graphEl.css({
            width: graphWidth + 'px',
            height: graphHeight + 'px',
            left: graphLeft + 'px',
            top: graphTop + 'px'
        });

        var refTime = Date.now() / 1000,
            graphWindow = this.graphWindow,
            buttonGraph = this.buttonGraph;

        var points = _.chain(buttonGraph.streamState.points)
                        .filter(function(pointTime) {
                            return pointTime <= refTime && pointTime >= (refTime - graphWindow);
                        })
                        .map(function(pointTime) {
                            return [pointTime, buttonGraph.color];
                        })
                        .sortBy(function(v) {
                            return -v[0];
                        })
                    .value();
        
        var data = null;
        if (buttonGraph.streamState.points.length > 0) {
            buttonGraph.calcData(this.targetInterval);

            if (buttonGraph.streamState.data) {
                data = [{
                    Color: buttonGraph.streamState.color,
                    Data: buttonGraph.streamState.data
                }];
            }
        }

        if (!data) {
            $graphEl.hide();
            return;
        }
        $graphEl.show();

        this.streamGraph.render({
                data: data,
                outputType: 'Canvas',
                destEl: $graphEl.get()[0],
                width: $graphEl.width(),
                height: $graphEl.height(),
                antiAlias: true,
            }, function(canvas, yMax, yTotal) {
                var ctx = canvas.getContext('2d'),
                    posY = graphHeight / 2,
                    circleSize = graphHeight / 25;

                _.each(points, function(p) {
                    var pointTime = p[0],
                        pointColor = p[1],
                        posX = ((refTime - pointTime) / graphWindow) * graphWidth;

                    ctx.beginPath();
                    ctx.arc(posX, posY, circleSize, 0, Math.PI * 2, true);
                    ctx.lineWidth = (circleSize / 3);
                    ctx.strokeStyle = 'black';
                    ctx.stroke();

                    ctx.fillStyle = pointColor;
                    ctx.fill();
                });
            }
        );
    },

    renderButton: function(options) {
        options = options || {};

        var $container = this.$buttonContainer,
            containerWidth = $container.width(),
            containerHeight = $container.height(),
            buttonSize = containerHeight * this.buttonSizeFactor;

        var buttonGraph = this.buttonGraph,
            leftPos = 0,
            topPos = 0;

        if (!buttonGraph) {
            // Initialize
            var $el = $('<div>')
                        .attr('id', 'single-button-1')
                        .css({
                            width: buttonSize + 'px',
                            height: buttonSize + 'px',
                            left: leftPos + 'px',
                            top: topPos + 'px'  
                        })
                        .appendTo($container);

            var buttonGraph = new ButtonGraphView({
                el: $el,
                label: this.buttonGraphDef.label,
                color: getColor(0, 8),
                graphDisabled: true,
                points: this.points,
                window: this.graphWindow,
                targetInterval: this.targetInterval
            });
            buttonGraph.on('PointAdded', this.pointAdded);
            buttonGraph.render();

            this.buttonGraph = buttonGraph;
        }
        else {
            if (!options.noResize) {
                buttonGraph.$el.css({
                    width: buttonSize + 'px',
                    height: buttonSize + 'px',
                    left: leftPos + 'px',
                    top: topPos + 'px'  
                });
                buttonGraph.render();
            }
            else {
                buttonGraph.renderGraph();
            }
        }
    },

    pointAdded: function() {
        this.renderCenterGraph();
    }
});
_.extend(SingleButtonStreamGraph.prototype, Backbone.Events);

module.exports = SingleButtonStreamGraph;