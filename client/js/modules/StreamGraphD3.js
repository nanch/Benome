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

function StreamGraphD3(options) {
    _.bindAll(this, 'svgImgReady');
    options = options || {};
    this.defaultOptions = {
        'antiAlias': true,
        'horizSymmetry': true,
        'outputType': 'HtmlImage', // also PNG, Canvas and SVG
        'destEl': null, // For direct write to destination element. Applies to HtmlImage, PNG, and Canvas
        'forceMax': false,
        'defaultColor': '#888',
        'width': 200,
        'height': 100
    }

    this.options = _.extend(this.defaultOptions, options);
}
_.extend(StreamGraphD3.prototype, {
    render: function(options, callback) {
        options = _.extend(this.options, options);
        this.graphID = options.graphID;

        var layers = options.dataFunc ? options.dataFunc(options) : options.data;
        this.numLayers = this.countLayers(layers);
        layers = _.compact(layers);

        var numSegments = layers.length && layers[0].Data && layers[0].Data.length;
        this.renderStreamGraph(numSegments, layers, callback, options);
    },

    countLayers: function(layers) {
        var numLayers = 0;
        _.each(_.compact(layers), function(layer) {
            numLayers += layer.NumLayers || 1;
        });

        return numLayers;
    },

    renderStreamGraph: function(numSegments, layers, callback, options) {
        var dataLayers = layers,
            width = options.width || 200,
            height = options.height || 100,
            _this = this;

        if (options.horizSymmetry) {
            // Layers ordered inner first, outer last
            dataLayers = layers.slice().reverse();
            dataLayers = dataLayers.concat(layers);
        }

        var result = this.renderStreamGraphSVG(width, height, numSegments, dataLayers, options);
        var svgEl = result.svgEl;
        
        if (!options.antiAlias) {
            svgEl.setAttribute('shape-rendering', 'crispEdges');
        }

        if (options.outputType == 'SVG') {
            callback && callback(svgEl);
        }
        else {
            var serializer = new XMLSerializer(),
                svgStr = serializer.serializeToString(svgEl),
                svgDataUrl = 'data:image/svg+xml;base64,' + window.btoa(svgStr);

            var svgImg = new Image();
            svgImg.width = width;
            svgImg.height = height;
            svgImg.onload = function(options, result, callback) {
                return function() {
                    _this.svgImgReady(svgImg, width, height, options, result, callback);
                }
            }(options, result, callback);

            svgImg.src = svgDataUrl;
            if (svgImg.complete) {
                this.svgImgReady(svgImg, width, height, options, result, callback);
            }
        }
    },

    svgImgReady: function(svgImg, width, height, options, result, callback) {
        var canvas;

        if (options.outputType == 'Canvas' && options.destEl) {
            canvas = options.destEl;
        }
        else {
            canvas = document.createElement('canvas');
        }
        canvas.width = width;
        canvas.height = height;

        var scaleFactor = result.yMax / (this.numLayers * 100 * 2);
        var ctx = canvas.getContext('2d');

        if (scaleFactor) {
            var yTranslate = canvas.height * scaleFactor;

            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.translate(0, (canvas.height - yTranslate) / 2);
            ctx.scale(1, scaleFactor);
            ctx.drawImage(svgImg, 0, 0, width, height);
            ctx.setTransform(1, 0, 0, 1, 0, 0);
        }
        else {
            ctx.scale(1, 1);
            ctx.setTransform(1, 0, 0, 1, 0, 0);
        }

        if (options.outputType == 'Canvas') {
            callback && callback(canvas, result.yMax, result.yTotal);
        }
        else {
            var imgDataUrl = canvas.toDataURL('image/png');

            if (options.outputType == 'PNG') {
                callback(imgDataUrl);
            }
            else {
                var outImg = options.destEl || new Image();
                outImg.src = imgDataUrl;
                callback && callback(outImg);
            }
        }
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
            return layer.Color || options.defaultColor;
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
            .domain([0, yMax * 1.2])
            .range([height, 0]);

        var area = d3.area()
            //.curve(d3.curveMonotoneX)
            .x(function(d, idx, layer) {
                return x(idx);
            })
            .y0(function(d) {
                return y(d[0]) - (height / 2);
            })
            .y1(function(d) {
                return y(d[1]) - (height / 2); // d[0] + d[1]);
            });

        var svg = d3.select(this.$svgContainer.get()[0]).append('svg')
                    .attr('width', width)
                    .attr('height', height);

        svg.selectAll('path')
            .data(layers0)
          .enter().append('path')
            .attr('d', area)
            .style('fill', function(d, layerIdx) {
                return layerColors[layerIdx];
            });

        return {
            svgEl: $('svg', this.$svgContainer).get()[0],
            yMax: yMax,
            yTotal: numLayers * 100
        }
    }
});

module.exports = StreamGraphD3;