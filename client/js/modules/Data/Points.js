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
var Backbone = require('backbone');

// -------------

var Point = require('app/modules/Data/Point.js'),
    getNow = require('app/modules/Util/GetNow.js');

var Points = Backbone.Collection.extend({
    model: Point,
    idAttribute: 'ID',

    initialize: function(models, options) {
        options = options || {};
        this.rootID = options.rootID || null;
        this.contexts = options.contexts;
    },

    getContext: function(contextID) {
        return this.contexts.get(contextID);
    },

    getContextPoints: function(contextID, minAge, refTime) {
        if (!this.getContext(contextID)) {
            return [];
        }

        if (!minAge) {
            // First get all sub-contexts
            var contextIDs = {};

            var context = this.getContext(contextID);
            context && context.traverseDown(function(context) {
                contextIDs[context.id] = true;
            });

            return this.filter(function(p) {
                return p.get('ContextID') in contextIDs;
            });
        }
        else {
            return this.getRecentPoints(minAge, contextID, refTime);
        }
    },

    getRecentPoints: function(minAge, contextID, refTime) {
        minAge = minAge || 86400;
        contextID = contextID || this.rootID;

        var points = this;
        if (contextID && contextID != this.rootID) {
            points = new Points(this.getContextPoints(contextID, null, refTime), {
                                contexts: this.contexts
                            });
        }

        var refTime = refTime || getNow() / 1000,
            limit = refTime - minAge;

        return points.filter(function(p) {
            return p.get('Time') <= refTime && p.get('Time') >= limit && p.getContext();
        });
    }
});

module.exports = Points;