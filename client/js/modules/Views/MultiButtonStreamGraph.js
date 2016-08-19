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

var MultiButtonSteamGraph = Backbone.View.extend({
    tagName: 'div',
    className: 'multibutton-streamgraph-view',

    events: {
    },

    initialize: function(options) {
        options = options || {};
        _.bindAll(this, 'pointAdded', 'render', 'renderLoop');

        this.$el.addClass(this.className);

        this.graphWindow = options.graphWindow || 10;
        this.buttonGraphNumSegments = options.buttonGraphNumSegments || 100;
        this.buttonPointSizeDenom = options.buttonPointSizeDenom || 25;
        this.buttonGraphDefs = options.buttonGraphDefs;
        this.buttonGraphDisabled = options.buttonGraphDisabled;

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

        this.buttonGraphs = [];
        this.streamGraph = new StreamGraphD3_Class();

        this.graphDef = options.graphDef || {
            width: 0.42,
            height: 0.40,
            top: 0.30,
            left: 0.29
        }

        // Delay resize until there is a pause
        var renderDebounce = _.debounce(this.render, 200);
        $(window).bind('resize', renderDebounce);

        this.throttledRender = _.throttle(this.render, 1000);

        this.renderButtons();
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
        this.renderButtons(options);
        this.renderCenterGraph(options);

        return this;
    },

    renderCenterGraph: function(options) {
        var $graphEl = this.$centerGraphContainer,
            _this = this;

        var $container = this.$buttonContainer,
            containerWidth = $container.width(),
            containerHeight = $container.height(),
            graphWidth = containerWidth * this.graphDef.width,
            graphHeight = containerHeight * this.graphDef.height,
            graphTop = containerHeight * this.graphDef.top,
            graphLeft = containerWidth * this.graphDef.left;

        $graphEl.css({
            width: graphWidth + 'px',
            height: graphHeight + 'px',
            left: graphLeft + 'px',
            top: graphTop + 'px'
        });

        var collectedPoints = [],
            refTime = Date.now() / 1000,
            graphWindow = this.graphWindow;

        _.each(this.buttonGraphs, function(buttonGraph) {
            var points = _.chain(buttonGraph.streamState.points)
                            .filter(function(pointTime) {
                                return pointTime <= refTime && pointTime >= (refTime - graphWindow);
                            })
                            .map(function(pointTime) {
                                return [pointTime, buttonGraph.color];
                            })
                        .value();

            collectedPoints = collectedPoints.concat(points);
        });
        
        collectedPoints = _.sortBy(collectedPoints, function(v) {
            return -v[0];
        });

        var data = _.map(this.buttonGraphs, function(buttonGraph) {
            if (buttonGraph.streamState.points.length > 0) {
                buttonGraph.calcData();

                if (buttonGraph.streamState.data) {
                    return {
                        Color: buttonGraph.streamState.color,
                        Data: buttonGraph.streamState.data
                    }
                }
            }
        });

        if (_.compact(data).length == 0) {
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

                _.each(collectedPoints, function(p) {
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

    renderButtons: function(options) {
        options = options || {};

        var $container = this.$buttonContainer,
            containerWidth = $container.width(),
            containerHeight = $container.height(),
            buttonSize;

        _.each(this.buttonGraphDefs, function(buttonGraphDef, i) {
            var buttonGraph = this.buttonGraphs[i],
                xPos = buttonGraphDef.x,
                yPos = buttonGraphDef.y,
                sizeFactor = buttonGraphDef.size;

            if (sizeFactor) {
                buttonSize = containerHeight * sizeFactor;
            }
            else {
                buttonSize = Math.min(containerWidth, containerHeight) / 3.2;
            }

            var leftPos = ((containerWidth * xPos) - (buttonSize / 2)),
                topPos = ((containerHeight * yPos) - (buttonSize / 2));

            if (!buttonGraph) {
                // Initialize
                var $el = $('<div>')
                            .attr('id', 'button-' + i)
                            .css({
                                width: buttonSize + 'px',
                                height: buttonSize + 'px',
                                left: leftPos + 'px',
                                top: topPos + 'px'  
                            })
                            .appendTo($container);

                var buttonGraph = new ButtonGraphView({
                    el: $el,
                    label: buttonGraphDef.label,
                    color: getColor(i, 8),
                    targetInterval: buttonGraphDef.targetInterval,
                    points: buttonGraphDef.points,
                    window: this.graphWindow,
                    numSegments: this.buttonGraphNumSegments,
                    pointSizeDenom: this.buttonPointSizeDenom,
                    graphDisabled: this.buttonGraphDisabled
                });
                buttonGraph.on('PointAdded', this.pointAdded);
                buttonGraph.render();

                this.buttonGraphs[i] = buttonGraph;
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
        }, this);
    },

    pointAdded: function() {
        this.renderCenterGraph();
    }
});
_.extend(MultiButtonSteamGraph.prototype, Backbone.Events);

module.exports = MultiButtonSteamGraph;