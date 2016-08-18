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

var Point = Backbone.Model.extend({
    modelType: 'Point',
    idAttribute: 'ID',
    url: function() {
        return '/app/data/point/' + this.id;
    },

    get: function(name, namespaceID) {
        if (name == 'ID' && !namespaceID) {
            return Backbone.Model.prototype.get.call(this, name);
        }
            
        if (name.substr(0, 3) == '1__' && !namespaceID) {
            name = name.substr(3);
        }
        
        namespaceID = namespaceID || 1;
        var key = namespaceID + '__' + name;
        return Backbone.Model.prototype.get.call(this, key);
    },

    getLabel: function() {
        var label = this.getContext().getLabel();
        return label;
    },

    getContext: function() {
        if (!this.contextModel) {
            this.contextModel = this.collection.getContext(this.getContextID());
        }
        return this.contextModel;
    },

    getContextID: function() {
        return this.get('ContextID')
    }
});

module.exports = Point;