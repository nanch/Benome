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
var _ = require('underscore'),
    Backbone = require('backbone'),
    BackboneIndex = require('app/lib/backbone.index.js');

// -------------

var Association = require('app/modules/Data/Association.js');

var Associations = Backbone.Collection.extend({
    model: Association,

    initialize: function(models, options) {
        options = options || {};
        this.contexts = options.contexts;
    },

    getContext: function(contextID) {
        return this.contexts.get(contextID);
    },

    // Returns the destination ID - the outV
    getContextAssoc: function(sourceContextID, assocName) {
        // This depends on the collection being indexed
        var sourceAssocs = this.where({
            'SourceID': sourceContextID,
            'Name': assocName
        });

        return _.map(sourceAssocs, function(a) {
            return a.get('DestID') - 0;
        });
    },

    // Returns the assoc model itself - the edge
    getContextAssoc2: function(sourceContextID, assocName) {
        return this.filter(function(a) {
                    return a.get('SourceID') == sourceContextID && a.get('Name') == assocName;
                });
    },

    setAssoc: function(assocName, sourceContextID, destContextID, options) {
        options = options || {};

        var currentAssoc = this.getContextAssoc2(sourceContextID, assocName)[0];
        if (currentAssoc) {
            // If it exists, update it
            currentAssoc.set('DestID', destContextID);
        }
        else {
            // Otherwise add it
            currentAssoc = this.addAssoc(assocName, sourceContextID, destContextID);
        }

        if (options.save) {
            currentAssoc.save();
        }

        return currentAssoc;
    },

    addAssoc: function(assocName, sourceContextID, destContextID, options) {
        options = options || {};

        var assoc = this.add({
            'Name': assocName,
            'SourceID': sourceContextID,
            'DestID': destContextID
        });

        if (options.save) {
            assoc.save();
        }

        return assoc;
    },

    removeAssoc: function(assocName, sourceContextID, destContextID) {
        var assocID = sourceContextID + '|' + assocName + '|' + destContextID;
        var assoc = this.get(assocID);
        if (assoc) {
            assoc.destroy();
        }
    }
});
BackboneIndex(Associations);

module.exports = Associations;