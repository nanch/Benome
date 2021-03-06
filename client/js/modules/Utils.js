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
    _ = require('underscore');

// -------------

var Utils = function Utils() {};
_.extend(Utils.prototype, {
    idToInt: function(idStr) {
        var base;
        if (idStr.indexOf('-') >= 0) {
            // It's an offline UUID
            base = '0123456789abcdef';
            idStr = idStr.replace(/-/g, '');
        }
        else {
            base = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
        }

        var length = base.length,
            result = 0;

        for (var i = 0; i < idStr.length; i++) {
            var c = idStr[idStr.length - i - 1];
            result += Math.pow(length, i) * base.indexOf(c);
        }

        return result;
    },

    seedRandom: function(s) {
        return function() {
            s = Math.sin(s) * 10000; return s - Math.floor(s);
        }
    },

    getColor: function(id) {
        var random = this.seedRandom(this.idToInt(id)),
            numHues = 16,
            hue = (360 / numHues) * (random() * numHues),
            saturation = 0.5,
            lightness = 0.6,
            color = $.Color()
                        .hue(hue)
                        .saturation(saturation)
                        .lightness(lightness)
                        .alpha(1),
            hexColor = color.toHexString();

        return hexColor;
    },

    getRadialGradient: function(colors, gradientStops, baseColor, cssPrefix) {
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
        if (cssPrefix == '-webkit-') {
            background = '-webkit-' + background;
        }

        return background;
    }
});

module.exports = Utils;