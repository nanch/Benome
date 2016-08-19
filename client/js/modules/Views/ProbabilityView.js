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

var ProbabilityView = Backbone.View.extend({
    tagName: 'div',
    className: 'probability-view',

    events: {},

    initialize: function(options) {
        options = options || {};
        _.bindAll(this, 'renderTick', 'onFuncChanged');

        this.paused = false;
        this.$container = options.container;
        this.direction = options.direction || 'ltr';
        this.label = options.label || '';
        this.initialX = this.$container.width() / 2;
        this.curveFuncs = options.curveFuncs;
        this.curveFuncs.on('FuncChanged', this.onFuncChanged)

        this.backgroundColor = options.backgroundColor || '#000';
        this.pointColor = '#FFF'; //'rgba(0,0,0,0)'; //options.color || '#FFF';
        this.pointRadius = options.pointRadius;
        this.intervalWidth = options.intervalWidth || 15;

        this.renderTickInterval = 25;
        this.renderTick();

        this.isVisible = false;
    },

    renderTick: function() {
        if (this.refTime && this.isVisible) {
            var width = this.$container.width(),
                secPerPixel = (this.intervalWidth * 2) / width,
                deltaTime = (Date.now() - (this.refTime * 1000)) / 1000,
                deltaX = deltaTime / secPerPixel,
                leftPos = this.getLeftPos(deltaX);
            
            if ((this.direction == 'rtl' && leftPos < -width) || (this.direction == 'ltr' && leftPos > 2 * width)) {
                this.$el.hide();
                this.isVisible = false;
            }
            else {
                // Shift element over
                this.$el.css({
                    'left': leftPos + 'px'
                });
            }
        }
        
        _.delay(this.renderTick, this.renderTickInterval);
    },

    getLeftPos: function(deltaX, regionWidth) {
        var leftPos,
            regionWidth = regionWidth || this.$el.width();

        if (this.direction == 'ltr') {
            leftPos = this.initialX + deltaX - regionWidth;
        }
        else {
            leftPos = this.initialX - deltaX;
        }

        return leftPos;
    },

    onFuncChanged: function(waveDef) {
        this.refTime = waveDef.RefTime;
        this.period = waveDef.Period;

        this.render(waveDef);
    },

    getSize: function() {
        return {
            width: this.$el.width(),
            height: this.$el.height()
        }
    },

    render: function(waveDef) {
        if (!waveDef) {
            return;
        }

        this.$el.show();
        this.isVisible = true;

        var period = parseFloat(waveDef.Period),
            refTime = waveDef.RefTime;

        var width = this.$container.width(),
            secPerPixel = (this.intervalWidth * 2) / width,
            deltaTime = (Date.now() - (this.refTime * 1000)) / 1000,
            deltaX = deltaTime / secPerPixel,

            regionWidth = (period / secPerPixel),
            regionHeight = this.$container.height();

        this.$el
            .css({
                'width': regionWidth + 'px',
                'height': regionHeight + 'px',
                'background-color': this.backgroundColor,
                'left': this.getLeftPos(deltaX, regionWidth) + 'px'
            })
            .empty();

        // Add the first

        var pointSize = this.pointRadius * 2;

        $('<div>')
            .addClass('timeline-point-view')
            .css({
                'left': ((regionWidth / 2) - (pointSize / 2)) + 'px',
                'top': ((regionHeight / 2) - (pointSize / 2)) + 'px',
                'width': pointSize + 'px',
                'height': pointSize + 'px',
                'backgroundColor': this.pointColor
            })
            .text(this.label)
            .appendTo(this.$el);

        var numProbablePairs = 5,
            diffPos = regionWidth / numProbablePairs / 2;

        diffPos = Math.min(pointSize / 2, diffPos);

        _.each(_.range(0, numProbablePairs), function(i) {
            var opacity = (1 - (i / numProbablePairs)) - 0.2;
                leftPos = diffPos * (i + 1);

            $('<div>')
                .addClass('timeline-point-view')
                .css({
                    'left': ((regionWidth / 2) - (pointSize / 2) - leftPos) + 'px',
                    'top': ((regionHeight / 2) - (pointSize / 2)) + 'px',
                    'width': pointSize + 'px',
                    'height': pointSize + 'px',
                    'z-index': -1 - i,
                    'opacity': opacity,
                    'backgroundColor': this.pointColor
                })
                .text(this.label)
                .appendTo(this.$el);

            $('<div>')
                .addClass('timeline-point-view')
                .css({
                    'left': ((regionWidth / 2) - (pointSize / 2) + leftPos) + 'px',
                    'top': ((regionHeight / 2) - (pointSize / 2)) + 'px',
                    'width': pointSize + 'px',
                    'height': pointSize + 'px',
                    'z-index': -1 - i,
                    'opacity': opacity,
                    'backgroundColor': this.pointColor
                })
                .text(this.label)
                .appendTo(this.$el);
        }, this);

        return this;
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
    }
});

module.exports = ProbabilityView;