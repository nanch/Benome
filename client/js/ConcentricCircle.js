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
    jQueryColor = require('app/lib/jquery.color'),
    _ = require('backbone/node_modules/underscore');

function ConcentricCircle(options) {
    options = options || {};

    this.gradientStops = options.gradientStops || [0, 0.4, 0.7, 1];
    this.scoreTransitions = [0, 0.5, 1] || options.scoreTransitions;
    this.alpha = options.alpha || 0.4;

    if ('webkitAnimation' in document.body.style) {
        this.cssPrefix = '-webkit-';
    }
    else if ('MozAnimation' in document.body.style) {
        this.cssPrefix = '-moz-';
    }
}

_.extend(ConcentricCircle.prototype, {
    getCurrentColor: function(rangeScores) {
        return this.scoreToColor(rangeScores[0]);
    },

    scoreToColor: function(score) {
        var alpha = this.alpha,
            red = $.Color('red').alpha(alpha),
            orange = $.Color('#ffa500').alpha(alpha),
            green = $.Color('green').alpha(alpha),
            grey = $.Color('#555').alpha(alpha),
            color = green;

        if (!_.isNumber(score) || _.isNaN(score)) {
            color = red;
        }
        else if (!score || score <= this.scoreTransitions[0]) {
            color = red;
        }
        else if (score <= this.scoreTransitions[1]) {
            color = orange.transition(red, 1 - ((score - this.scoreTransitions[0]) * 2));
        }
        else if (score <= this.scoreTransitions[2]) {
            color = green.transition(orange, 1 - ((score - this.scoreTransitions[1]) * 2));
        }
        return color.alpha(alpha).toRgbaString();
    },

    getRadialGradient: function(rangeScores, colors, gradientStops, baseColor) {
        if (!colors) {
            // Now the colors, from recent to oldest range
            var colors = _.map(rangeScores, function(score) {
                return this.scoreToColor(score);
            }, this);

            colors.reverse();
        }

        gradientStops = gradientStops || this.gradientStops;
        
        var cssStops = [],
            stopDistances = _.map(gradientStops, function(v) { return v * 0.71 }), // 0.71 adjusts to circle's radius instead of square's
            numStops = stopDistances.length;

        _.each(stopDistances, function(stopDistance, i) {
            if (numStops - i > colors.length) {
                color = baseColor || 'rgba(0,0,0,0)';
            }
            else {
                color = colors[i - (numStops - colors.length)];
            }

            if (i == 0) {
                color + ' ' + (stopDistance * 100) + '%'
            }
            cssStops.push(color + ' ' + Math.round(stopDistance * 100) + '%');
        });

        var background = 'radial-gradient(' + cssStops.join(', ') + ')';
        if (this.cssPrefix == '-webkit-') {
            background = '-webkit-' + background;
        }

        //console.log('-----------------------------');

        return background;
    },

    getCanvasGradient: function() {
        canvas.width = size * 2;
        canvas.height = size * 2;

        var ctx = canvas.getContext('2d');
        ctx.beginPath();
        ctx.arc(size, size, size, 0, Math.PI * 2, true);
            
        var gradient = ctx.createRadialGradient(size, size, 0, size, size, size);

        var stopDistances = [0, 0.35, 0.60, 1.0],
            numStops = stopDistances.length;

        _.each(stopDistances, function(stopDistance, i) {
            if (numStops - i > colors.length) {
                color = 'rgba(0,0,0,0)';
            }
            else {
                color = colors[i - (numStops - colors.length)];
            }

            gradient.addColorStop(stopDistance, color);
        });

        ctx.fillStyle = gradient;
        ctx.fill();
    },

    renderCircle2: function() {
        var red = $.Color('red').alpha(0.5).toRgbaString(),
            orange = $.Color('orange').alpha(0.5).toRgbaString(),
            green = $.Color('green').alpha(0.5).toRgbaString();

        if (this.cssPrefix == '-webkit-') {
            this.el.css({
                'background': '-webkit-radial-gradient(' + red + ', ' + orange + ' , ' + green + ' , ' + green + ')'
            });
        }
        else {
            this.el.css({
                'background': 'radial-gradient(' + red + ', ' + orange + ' , ' + green + ' , ' + green + ')'
            });
        }

        this.el.css({
            'border': '5px solid ' + this.baseColor.alpha(0.5).toRgbaString()
        });
    }
});

module.exports = ConcentricCircle;