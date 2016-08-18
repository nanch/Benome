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
    _ = require('backbone/node_modules/underscore');

// -------------

var getNow = require('app/modules/Util/GetNow.js');

function DataConstructor(initialID) {
    this.init(initialID);
}
_.extend(DataConstructor.prototype, {
    init: function(initialID) {
        this.initialID = initialID || 1;
        this.lastID = this.initialID;
        this.contexts = [];
        this.associations = [];
        this.points = [];

        this.hasChildren = {};
    },

    nextID: function() {
        this.lastID += 1;
        return this.lastID;
    },

    add: function(label, parentID, contextID) {
        label = label || '';
        if (!parentID && !contextID) {
            contextID = this.initialID;
        }
        else {
            contextID = contextID || this.nextID();
        }

        this.contexts.push({
            'ID': contextID,
            '1__Label': label,
            '1__Time': getNow() / 1000
        });

        if (parentID) {
            this.associations.push({
                'ID': parentID + '|down|' + contextID,
                'SourceID': parentID,
                'Name': 'down',
                'DestID': contextID
            });

            this.associations.push({
                'ID': contextID + '|up|' + parentID,
                'SourceID': contextID,
                'Name': 'up',
                'DestID': parentID
            });

            this.hasChildren[parentID] = true;
        }

        return contextID;
    },

    addMulti: function(numContexts, parentID) {
        return _.map(_.range(0, numContexts), function() {
            return this.add('', parentID);
        }, this);
    },

    getData: function() {
        return {
            RootID: this.initialID,
            Contexts: this.contexts,
            Associations: this.associations,
            Points: this.points
        }
    },

    setPoints: function(points) {
        this.points = points;
    }
});

module.exports = DataConstructor;