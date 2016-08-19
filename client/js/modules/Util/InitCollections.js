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
var _ = require('underscore');

// -------------

var Points = require('app/modules/Data/Points'),
    Contexts = require('app/modules/Data/Contexts'),
    Associations = require('app/modules/Data/Associations');

function setInitialData(contexts, initialData) {
    _.each(initialData, function(initialData, collectionID) {
        var col = null;
        if (collectionID == 'Contexts') {
            col = contexts;
        }
        else if (collectionID == 'Associations') {
            col = contexts.associations;
        }
        else if (collectionID == 'Points') {
            col = contexts.points;
        }
        if (!col) {
            return;
        }

        var models = col.add(initialData);
        /*_.each(models, function(model) {
            model.save({}, {
                'silent': true
            });
        })*/
    }, this);

    contexts.points.on('change add remove', function(pointModel, response) {
        var pointContext = pointModel.getContext();
        if (pointContext) {
            pointContext.trigger('PointChanged', pointModel);
        }
    });
}

function initCollections(rootContextID, initialData, options) {
    options = options || 0;
    
    var points = new Points([], {rootID: rootContextID});
    points.url = '/app/data/points/' + rootContextID;

    var associations = new Associations([], {});
    associations.url = '/app/data/associations/' + rootContextID;

    var contexts = new Contexts([], _.extend({
        rootID: rootContextID,
        associations: associations,
        points: points
    }, options));
    contexts.url = '/app/data/contexts/' + rootContextID;

    if (initialData) {
        setInitialData(contexts, initialData);
    }

    return contexts;
}

module.exports = initCollections;