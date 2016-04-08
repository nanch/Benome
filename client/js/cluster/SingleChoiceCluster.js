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
    _ = require('backbone/node_modules/underscore');

var BenomeGlobal = require('app/Global'),
    Cluster = require('app/Cluster'),
    Data = require('app/models/Data'),
    BaseClusterController = require('app/cluster/BaseClusterController');


function SingleChoiceCluster($container, choices, options) {
    this.$container = $container;
    this.choices = choices;

    var containerWidth = options.width || $container.width(),
        containerHeight = options.height || $container.height();

    this.rootContextID = 1;
    this.lastID = 2;

    // Setup and render the cluster
    var rootClusterOptions = {
            hideRoot: false,
            compressRoot: true,
            layoutChange: true,
            hideLabels: false,
            labelIDsOnly: false,

            radiusScaleFactor: !BenomeGlobal.isTablet && BenomeGlobal.isMobile ? 0.5 : 0.43,
            scaleFactor: 0.85,
            spaceFactor: 0.7,
            focusAngleArc: 360,
            focusStartAngle: 30,
            childAngleArc: 210,
            maxDepth: null,
            numDetailLevels: 6,
            dropDisabled: true,
            dragDisabled: true
        },
        contextCollection = this.generateCollection(choices, this.rootContextID);
    
    BaseClusterController.call(this, contextCollection, rootClusterOptions);

    var cluster = new Cluster('SingleChoiceCluster-asdf', this, {$el: this.$container});
    this.setCluster(cluster);
    BenomeGlobal.addCluster(cluster);

    cluster.setFocus(this.rootContextID);
    cluster.setFilterLevel(0, {noRender: true});
    cluster.setRadius(containerWidth / 4);
    this.setPosition();
}
_.extend(SingleChoiceCluster.prototype, BaseClusterController.prototype, {
    render: function(options) {
        if (this.cluster) {
            options = _.extend({
                noAnimate: true
            }, options);
            this.cluster.render(options);
        }
    },

    getModeParams: function(contextModel) {
        return {
            sourceData: this.sourceData
        }
    },

    generateCollection: function(choices, rootID) {
        var rootContextID = rootID || this.lastID;

        rootContextID += '';

        // Init the data structure
        var pointsCollection = new Data.Points([], {rootID: rootContextID}),
            associationCollection = new Data.Associations([]),
            contextCollection = new Data.Contexts([], {
                rootID: rootContextID,
                points: pointsCollection,
                associations: associationCollection
            });

        // Inject data

        // Root context
        var rootContext = new Data.Context({
            'ID': rootContextID,
            'Label': ''
        });
        contextCollection.add([rootContext]);

        _.each(choices, function(choiceDef) {
            this.lastID += 1;
            var choiceID = this.lastID + '';
            // Neighbours w/ associations
            var choiceContext = new Data.Context({
                'ID': choiceID,
                'Label': choiceDef.Label,
                'choiceValue': choiceDef.Value,
                'choiceID': choiceDef.ID
            });
            associationCollection.addAssoc('up', choiceID, rootContextID, {save: false});
            associationCollection.addAssoc('down', rootContextID, choiceID, {save: false});

            contextCollection.add([choiceContext]);
        }, this);

        return contextCollection;
    }
});

module.exports = SingleChoiceCluster;