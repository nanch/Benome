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
    Mousetrap = require('mousetrap');;

function Keyboard(options) {
    this.initKeyboard(options);
}

_.extend(Keyboard.prototype, {
    initKeyboard: function(options) {
        _.bindAll(this, 'onFocusChanged', 'onNavKey');

        this.rhKeyMap = {
            'm': 1,
            'j': 4,
            'u': 7,
            'i': 8,
            'o': 9,
            'l': 6,
            '.': 3,
            ',': 2,
            'k': 5
        };

        var keypadStartAngle = 135,
            keypadAngleIncrement = 45,
            normalizeAngle = this.normalizeAngle;

        this.keypadAngles = _.map([1,4,7,8,9,6,3,2], function(keyID, i) {
            var keypadAngle = keypadStartAngle + (i * keypadAngleIncrement);
            return [
                keyID,
                normalizeAngle(keypadAngle),
                normalizeAngle(keypadAngle - (keypadAngleIncrement / 2)),
                normalizeAngle(keypadAngle + (keypadAngleIncrement / 2))
            ];
        });

        function arcOverlaps(testLow, testHigh, baseLow, baseHigh) {
            testLow = normalizeAngle(testLow);
            testHigh = normalizeAngle(testHigh);
            baseLow = normalizeAngle(baseLow);
            baseHigh = normalizeAngle(baseHigh);

            return (testLow >= baseLow && testLow <= baseHigh) ||
                    (testHigh <= baseHigh && testHigh >= baseLow);
        }

        var _this = this;
        // Bind to keypad numbers (depends on numlock being on)

        // Home row keypad analog. Disabled for now to avoid conflicts when typing.
        // ['m', 'j', 'u', 'i', 'o', 'l', '.', ',', 'k']

        Mousetrap.bind(['1', '2', '3', '4', '5', '6', '7', '8', '9'], this.onNavKey);

        Mousetrap.bind(['enter'], function(e) {
            _this.trigger('AddPoint');
        });

        Mousetrap.bind(['+'], function(e) {
            _this.trigger('NarrowFilter', _this, _this.cluster);
        });

        Mousetrap.bind(['-'], function(e) {
            _this.trigger('WidenFilter', _this, _this.cluster);
        });

        Mousetrap.bind(['*'], function(e) {
            _this.trigger('ModifyContext', _this, _this.cluster);
        });

        Mousetrap.bind(['/'], function(e) {
            _this.trigger('ToggleViewMode', _this, _this.cluster);
        });

        Mousetrap.bind(['0'], function(e) {
            _this.trigger('CreateContext', _this, _this.cluster);
        });

        function numpadDecimal(e) {
            _this.trigger('DeleteContext', _this, _this.cluster);
        }
    },

    setKeyboardState: function(contextList) {
        this.keyboardContextList = contextList || null;
    },

    normalizeAngle: function(angle, highAngle) {
        var result = Math.atan2(Math.sin(angle * Math.PI / 180), Math.cos(angle * Math.PI / 180)) * (180 / Math.PI)
        return result + 180;
    },

    angleContained: function(testAngle, baseLow, baseHigh) {
        testAngle = this.normalizeAngle(testAngle);
        baseLow = this.normalizeAngle(baseLow, baseHigh);
        baseHigh = this.normalizeAngle(baseHigh);

        return testAngle >= baseLow && testAngle <= baseHigh;
    },

    onFocusChanged: function(cluster, focusID, focusModel, lastFocusID, lastFocusModel, layoutData) {
        if (!focusModel) {
            return;
        }
        var focusData = layoutData.data[focusID],
            startAngle = focusData.startAngle,
            orderedVisibleNeighbours = focusData.orderedNeighbours;

        if (!orderedVisibleNeighbours) {
            return;
        }

        var angleIncrement = 360 / orderedVisibleNeighbours.length;

        var y = _.map(orderedVisibleNeighbours, function(neighbourID, i) {
            var neighbourAngle = startAngle + (i * angleIncrement);
            return [
                neighbourID,
                this.normalizeAngle(neighbourAngle),
                this.normalizeAngle(neighbourAngle - (angleIncrement / 2)),
                this.normalizeAngle(neighbourAngle + (angleIncrement / 2))
            ];
        }, this);
        this.setKeyboardState(y);
    },

    setCluster: function(cluster) {
        this.cluster = cluster;
        this.cluster.on('FocusChanged', this.onFocusChanged);
    },

    onNavKey: function(e) {
        if (e.key == '.') {
            if (e.code == 'NumpadDecimal') {
                // Numpad decimal is bound to something else
                numpadDecimal(e);
                return;
            }
            else {
                console.log('period');
            }
        }

        var keyID = this.rhKeyMap[e.key] || parseInt(e.key),
            _this = this;

        if (this.keyboardContextList && this.cluster) {
            if (keyID == 5) {
                var parentContext = this.cluster.contexts.get(this.cluster.focusID).getParent();
                if (parentContext) {
                    this.cluster.setFocus(parentContext.id, true);
                }
                return;
            }

            var keypadDetails = _.find(this.keypadAngles, function(x) {
                return x[0] === keyID;
            });

            var matchedContexts = _.filter(this.keyboardContextList, function(contextDetails) {
                return this.angleContained(contextDetails[1], keypadDetails[2], keypadDetails[3])
            }, this);

            if (matchedContexts.length == 0) {
                // Grab the closest context
                var result = _.chain(this.keyboardContextList)
                    .map(function(contextDetails) {
                        var angle1 = _this.normalizeAngle(contextDetails[1]),
                            angle2 = _this.normalizeAngle(keypadDetails[1]);

                        if (Math.abs(angle1 - angle2) > 180) {
                            // All angles are to be acute.
                            if (angle1 > angle2) {
                                angle1 -= 360;
                            }
                            else if (angle2 > angle1) {
                                angle2 -= 360;
                            }
                        }

                        var distance = Math.abs(angle1 - angle2);
                        return [contextDetails, distance];
                    })
                    .sortBy(function(distances) {
                        return distances[1];
                    })
                    .first()
                .value();

                if (result) {
                    this.cluster.setFocus(result[0][0], true);
                }
            }
            else if (matchedContexts.length == 1) {
                // Switch focus directly
                this.cluster.setFocus(matchedContexts[0][0], true);
            }
            else {
                // Disambiguate somehow
                _.each(matchedContexts, function(x) {
                    console.log(this.cluster.contexts.get(x[0]).getNS('Label'));
                });
            }
        }
    }
});

_.extend(Keyboard.prototype, Backbone.Events);
module.exports = Keyboard;