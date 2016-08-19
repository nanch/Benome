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
	_ = require('underscore');

function Colors(cluster, options) {
    options = options || {};
    this.cluster = cluster;
    this.rootContextID = options.rootContextID;
    this.minLightness = options.minLightness;
    this.colorCache = {};
}

_.extend(Colors.prototype, {
    seedRandom: function(s) {
        return function() {
            s = Math.sin(s) * 10000; return s - Math.floor(s);
        }
    },

    getColor: function(contextID, fresh, baseLightnessAdjust) {
        if (!fresh && contextID in this.colorCache) {
            var color = this.colorCache[contextID];
            if (_.isNumber(baseLightnessAdjust)) {
                var c = $.Color(color);
                c = c.transition($.Color('#000'), baseLightnessAdjust);
                color = c.toHexString();
            }

            return color;
        }

        var rootContext = this.cluster.contexts.get(this.rootContextID);
        if (!rootContext) {
            return '#ccc';
        }

        var random = this.seedRandom(parseInt(contextID));

        var baseContextID = this.cluster.contexts.getBaseContext(contextID),
            sortedContexts = rootContext.getAssoc('down').sort(),
            numBaseHues = 8,
            numDepthHues = 8;

        var _this = this;
        function depthColor(contextID) {
            var parentContext = _this.cluster.contexts.get(contextID),
                parentContextID = parentContext && parentContext.getParentID();
                
            if (parentContextID && parentContextID != _this.rootContextID) {
                var parentData = depthColor(parentContextID),
                    hueRange = parentData.HueRange / parentData.NumHues,
                    halfHueRange = hueRange / 2,
                    halfParentRange = parentData.HueRange / 2,
                    hue = Math.round((parentData.Hue - halfParentRange) + (random() * parentData.HueRange));

                return {
                    'Depth': parentData.Depth + 1,
                    'Hue': hue,
                    'HueRange': hueRange,
                    'NumHues': numDepthHues
                }
            }
            else {
                var baseContextID = contextID,
                    numHues = numBaseHues,
                    hueRange = 360 / numHues,
                    halfHueRange = hueRange / 2;

                return {
                    'Depth': 1,
                    'Hue': halfHueRange + (hueRange * _.indexOf(sortedContexts, baseContextID)),
                    'HueRange': hueRange,
                    'NumHues': numHues
                }
            }
        }

        var colorResult = depthColor(contextID),
            hue = colorResult.Hue,
            depth = colorResult.Depth;


        var baseHue = hue,

            // Random variance
            saturationAdjust = 0.25 * random(),
            saturation = 0.5 + saturationAdjust,

            // Darker as it goes deeper
            lightnessAdjust = ((depth - 1) * (0.15 * random())),
            lightness = Math.max(this.minLightness, 0.5 - lightnessAdjust);

        if (_.isNumber(baseLightnessAdjust)) {
            lightness *= baseLightnessAdjust;
        }

        var color = $.Color()
                        .hue(baseHue)
                        .saturation(saturation)
                        .lightness(lightness)
                        .alpha(1);

        var hexColor = color.toHexString();

        this.colorCache[contextID] = hexColor;
        return hexColor;
    }
});

module.exports = Colors;