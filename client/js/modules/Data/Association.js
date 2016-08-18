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

var Association = Backbone.Model.extend({
    modelType: 'Association',
    idAttribute: 'ID',

    initialize: function() {
        this.set('ID', this.get('SourceID') + '|' + this.get('Name') + '|' + this.get('DestID'));
    },

    url: function() {
        return '/app/data/association/' + this.id;
    },

    getSourceModel: function() {
        var sourceID = this.get('SourceID');
        return this.collection.getContext(sourceID);
    },

    getDestModel: function() {
        var destID = this.get('DestID');
        return this.collection.getContext(destID);
    }
});

module.exports = Association;