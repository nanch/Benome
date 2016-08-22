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

var $ = require('jquery'),
    Backbone = require('backbone'),
    _ = require('underscore'),
    d3 = require('d3');

function GraphVisual(modeView, graphDataFunc, options) {
    options = options || {};
    this.G = this.G || options.G || require('app/Global')();
    
    this.modeView = modeView;
    this.surfaceView = this.modeView.surfaceView;
    this.graphDataFunc = graphDataFunc;
    this.options = options;

    if (!this.$graphOverlay) {
        this.$graphOverlay = $('<div>')
                                    .css({
                                        'position': 'absolute',
                                        'z-index': '-4',
                                        'width': '100%',
                                        'height': '100%'
                                    })
                                    .appendTo(this.modeView.$el);
    }
}
_.extend(GraphVisual.prototype, {
    hide: function() {
        this.modeView.$backgroundImage.hide();
        this.$graphOverlay.hide();
    },

    show: function() {
        this.modeView.$backgroundImage.show();
        this.$graphOverlay.show();
    },

    render: function(width, height, graphOptions, left, top) {
        graphOptions = _.extend(this.options, graphOptions);

        this.width = width || this.width;
        this.height = height || this.height;
        this.left = left || this.left || 0;
        this.top = top || this.top || 0;

        var contextID = this.surfaceView.baseView.viewID,
            layers = this.graphDataFunc(contextID, this.surfaceView, graphOptions);

        if (layers.length) {
            this.show();
            this.renderStreamGraph(this.modeView.$backgroundImage, layers[0].Data.length,
                                    layers, this.width, this.height, graphOptions);

            if (graphOptions.labels !== false) {
                this.renderLabels(layers, this.width, this.height, this.left, this.top,
                                    graphOptions.numLabels, graphOptions.labelFunc);
            }
        }
        else {
            //console.log('hide', contextID, this.surfaceView.contextModel.getNS('Label'), layers, layers.length);
            this.hide();
        }
    },

    renderLabels: function(layers, width, height, left, top, numLabels, labelFunc) {
        this.$graphOverlay.css({
            'width': width + 'px',
            'height': height + 'px',
            'left': (left || 0) + 'px',
            'top': (top || 0) + 'px'
        });

        // Sum each of the layers
        var layerData = this.G.sumArrays(_.pluck(layers, 'Data'));

        var numSegments = numLabels || layerData.length,
            segmentWidth = width / Math.max(1, (numSegments - 1)),
            segmentStep = layerData.length / Math.max(1, (numSegments - 1)),
            fontSize = Math.min(height / 6, (segmentWidth * 0.45)),
            //this.surfaceView.viewState.fontSize[0] / 4
            y = (height / 2) - (fontSize / 2);

        this.$graphOverlay
            .empty()
            .css({
                'font-size': fontSize + 'px',
                'line-height': '1em'
            });

        _.each(_.range(0, numSegments), function(segmentIdx) {
            var x = (segmentWidth * segmentIdx) - (segmentWidth / 2),
                rawVal = layerData[segmentIdx],
                val = layerData[Math.floor(segmentIdx * segmentStep)];

            if (labelFunc) {
                val = labelFunc(rawVal, val, numSegments, layers, segmentIdx, layerData);
            }

            if (val > 0) {
                var $blah = $('<div>')
                                .css({
                                    'position': 'absolute',
                                    'left': x + 'px',
                                    'top': y + 'px',
                                    'width': segmentWidth + 'px',
                                    'height': '1em',
                                    'text-align': 'center'
                                })
                                .text(val)
                                .appendTo(this.$graphOverlay);

                if (segmentIdx == 0) {  // FIXME: properly test for today
                    $blah.css({
                        'font-weight': 'bold',
                        'color': 'orange'
                    });
                }
            }
        }, this);
    },

    renderStreamGraph: function(container, numSegments, layers, width, height, graphOptions) {
        if (!width) {
            width = this.width * 0.8;
        }
        if (!height) {
            height = this.height * 0.5;
        }

        // Layers ordered inner first, outer last
        var symLayers = layers.slice().reverse();
        symLayers = symLayers.concat(layers);

        var svgEl = this.renderStreamGraphSVG(width, height, numSegments, symLayers, graphOptions);
        
        // Anti-aliasing disabled to eliminate light edges on interior paths
        //svgEl.setAttribute('shape-rendering', 'crispEdges');

        var serializer = new XMLSerializer(),
            svgStr = serializer.serializeToString(svgEl),
            svgDataUrl = 'data:image/svg+xml;base64,' + window.btoa(svgStr);

        var svgImgReady = function() {
            var canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            canvas.getContext('2d').drawImage(svgImg, 0, 0, width, height);
            var imgDataUrl = canvas.toDataURL('image/png');

            var outImg = new Image();
            outImg.src = imgDataUrl;
            $(container).empty().append(outImg);
        }

        var svgImg = new Image();
        svgImg.width = width;
        svgImg.height = height;
        svgImg.onload = svgImgReady;
        svgImg.src = svgDataUrl;
        if (svgImg.complete) {
            svgImgReady();
        }
    },

    countLayers: function(layers) {
        var numLayers = 0;
        _.each(_.compact(layers), function(layer) {
            numLayers += layer.NumLayers || 1;
        });

        return numLayers;
    },

    renderStreamGraphSVG: function(width, height, numSegments, layers, options) {
        options = options || {};

        if (!this.$svgContainer) {
            this.$svgContainer = $('<div>').hide().appendTo('body');
        }
        this.$svgContainer.empty();

        var numLayers = this.countLayers(layers);

        if (options.forceMax) {
            _.each(layers, function(layer) {
                layer.Data[layer.Data.length - 1] = layer.NumLayers * 100;
            });
        }

        var layerKeys = _.range(0, numLayers);

        function formatLayers(layers) {
            return _.map(_.range(0, numSegments), function(i) {
                var z = {};
                _.each(layers, function(layer, layerIdx) {
                    var layerData = layer.Data;
                    z[layerIdx] = layerData[i];
                });

                return z;
            });
        }

        var stack = d3.stack()
                        .keys(layerKeys)
                        .offset(d3.stackOffsetSilhouette),
            layers0 = stack(formatLayers(layers));

        var layerColors = _.map(layers, function(layer) {
            return layer.Color || '#888';
        });

        var x = d3.scaleLinear()
            .domain([0, numSegments - 1])
            .range([0, width]);

        var yMax = d3.max(layers0, function(layer) {
            return d3.max(layer, function(d) {
                return d[0] + d[1];
            });
        });

        var y = d3.scaleLinear()
            .domain([0, yMax])
            .range([height, 0]);

        var area = d3.area()
            .x(function(d, idx, layer) {
                return x(idx);
            })
            .y0(function(d) {
                return y(d[0]) - (height / 2);
            })
            .y1(function(d) {
                return y(d[1]) - (height / 2);
            });

            /*.x(function(d) {
                return x(d.x);
            })
            .y0(function(d) {
                return y(d.y0);
            })
            .y1(function(d) {
                return y(d.y0 + d.y);
            });*/

        var svg = d3.select(this.$svgContainer.get()[0]).append('svg')
                    .attr('width', width)
                    .attr('height', height);

        var _this = this;

        svg.selectAll('path')
            .data(layers0)
          .enter().append('path')
            .attr('d', area)
            .style('fill', function(d, layerIdx) {
                return layerColors[layerIdx];
            });

        function formatLayer(data) {
          return _.map(data.Data, function(v, i) {
            return {x: i, y: v};
          });
        }

        return $('svg', this.$svgContainer).get()[0];
    }
});

module.exports = GraphVisual;