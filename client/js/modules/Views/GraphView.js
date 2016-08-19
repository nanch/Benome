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

// -------------

var GraphView = Backbone.View.extend({
    tagName: 'div',
    className: 'graph-view',

    events: {},

    initialize: function(options) {
        options = options || {};
        _.bindAll(this, 'renderTick', 'onFuncChanged');

        this.paused = false;

        this.curveFuncs = options.curveFuncs;
        this.curveFuncs.on('FuncChanged', this.onFuncChanged)

        this.initialX = options.initialX || 0;
        this.resetInitialX = options.resetInitialX || 0;
        this.backgroundColor = options.backgroundColor || '#000';
        this.intervalWidth = options.intervalWidth || 15;

        this.segments = [];
        this.initSegment(this.initialX);
        
        this.xStep = 1;

        this.displayInterval = options.displayInterval || 1200;
        this.displayIntervalAnchor = options.displayIntervalAnchor || Date.now();

        this.lastBackgroundState = null;
        this.currentX = this.initialX;

        this.leftSegmentPos = 0;
        this.rightSegmentPos = 1;

        this.intervalCtr = 0;

        this.anchorTime = Date.now(); // May be any time
        this.refTime = Date.now(); // Always now

        this.renderTickInterval = 50;
        this.renderTick();
    },

    renderTick: function() {
        this.render();
        
        _.delay(this.renderTick, this.renderTickInterval);
    },

    onFuncChanged: function(waveDef) {
        this.intervalCtr = 0;

        this.anchorTime = Date.now(); // May be any time
        this.refTime = Date.now(); // Always now

        this.positionSegment(0, this.initialX, 0);
        this.currentX = this.initialX;
        this.renderSegment(this.leftSegmentPos, 0);
    },

    initSegment: function(initialX) {
        var canvas = this.initCanvas(this.initialX);
        this.$el.append(canvas);
        this.segments.push([canvas.getContext('2d'), $(canvas), canvas]);
    },

    initCanvas: function(initialX) {
        var canvas = document.createElement('canvas');

        var size = this.getSize();
        canvas.width = size.width;
        canvas.height = size.height;
        
        context = canvas.getContext('2d');
        context.strokeStyle = '#222';
        context.lineJoin = 'round';
        context.save();

        $(canvas)
            .css({
                'position': 'absolute',
                'transform': 'translateX(' + initialX + 'px)'
            });

        return canvas;
    },

    getSize: function() {
        return {
            width: this.$el.width(),
            height: this.$el.height()
        }
    },

    render: function(options) {
        options = options || {};

        this.positionSegment(0, this.currentX, this.leftSegmentPos);

        var width = this.getSize().width;
        if (this.currentX < -width) {
            this.segments[0][1].hide();
        }
        else {
            this.segments[0][1].show();
            var secPerPixel = this.intervalWidth / width,
                deltaTime = (Date.now() - this.anchorTime) / 1000,
                deltaX = deltaTime / secPerPixel;

            this.currentX = this.initialX - deltaX;
        }

        return this;
    },

    renderSegment: function(segmentIdx, intervalOffset) {
        var size = this.getSize();

        var ctx = this.segments[segmentIdx][0];
        ctx.clearRect(0, 0, size.width, size.height);

        _.each(this.curveFuncs.getFuncs(), function(funcDef) {
            this.renderCurve(ctx, funcDef, intervalOffset || 0);
        }, this);
    },

    renderCurve: function(ctx, funcDef, intervalOffset) {
        var f = funcDef.func;

        ctx.strokeStyle = funcDef.color || '#00f';
        ctx.lineWidth = funcDef.size || 2;
        ctx.beginPath();

        var anchorTime = this.anchorTime,
            deltaTime = 0,
            size = this.getSize(),
            height = size.height,
            width = size.width,
            timeStep = width / this.intervalWidth,
            xStep = this.xStep,
            result,
            x = 0,
            y;

        if (intervalOffset) {
            anchorTime += intervalOffset * this.intervalLength;
        }

        result = f(anchorTime);
        y = result.val;
        ctx.moveTo(0,  (y * height) + (((1 - result.decayFactor) / 2) * height));

        var timeStep = (this.intervalWidth * 1000) / width;

        for (i = 0; i <= width + xStep; i += xStep) {
            deltaTime = i * timeStep;
            result = f(anchorTime + deltaTime);
            y = result.val,
            ctx.lineTo(i, (y * height) + (((1 - result.decayFactor) / 2) * height));
        }

        ctx.stroke();
    },

    positionSegment: function(segmentIdx, x, pos) {
        x = x || 0;
        x += (pos * this.getSize().width);

        var $canvas = this.segments[segmentIdx][1];
        $canvas.css({
            'transform': 'translateX(' + x + 'px)'
        });
    }
});

module.exports = GraphView;