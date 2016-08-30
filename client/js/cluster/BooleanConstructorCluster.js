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
    moment = require('moment');

var BenomeGlobal = require('app/Global'),
    Cluster = require('app/Cluster'),
    Data = require('app/models/Data'),
    SimpleSurfaceView = require('app/cluster/surfaces/SimpleSurfaceView');
    BaseClusterController = require('app/cluster/BaseClusterController');
    

function BooleanConstructorCluster($container, clusterOptions, constructContextDef) {
    _.bindAll(this, 'creatorDrop');

    this.$container = $container;
    clusterOptions = clusterOptions || {};
    this.constructContextDef = constructContextDef || {};

    this.rootContextID = 2;
    this.lastID = 2;
    this.clusterMode = 'Normal';
    this.sourceData = {};

    // Setup and render the cluster
    var defaultClusterOptions = {
        hideRoot: false,
        layoutChange: true,
        noCompress: true,
        moveDisabled: false,

        hideLabels: false,
        labelIDsOnly: false,

        radiusScaleFactor: !BenomeGlobal.isTablet && BenomeGlobal.isMobile ? 0.5 : 0.43,
        scaleFactor: !BenomeGlobal.isTablet && BenomeGlobal.isMobile ? 0.6 : 0.6,
        spaceFactor: 0.7,
        focusAngleArc: 360,
        focusStartAngle: 30,
        childAngleArc: 210,
        maxDepth: null,
        numDetailLevels: 6
    };
    this.clusterOptions = _.extend(defaultClusterOptions, clusterOptions);

    var contextCollection = this.generateCollection([], this.rootContextID, clusterOptions.label);
    BaseClusterController.call(this, contextCollection, this.clusterOptions);

    var cluster = new Cluster('BooleanConstructorCluster-1234', this, {$el: this.$container});
    this.setCluster(cluster);
    BenomeGlobal.addCluster(cluster);

    cluster.setFocus(this.rootContextID);
    cluster.setFilterLevel(0, {noRender: true});
    cluster.setRadius(this.getClusterSize());
    this.setPosition();

    cluster.on('CreatorDrop', this.creatorDrop);
}

_.extend(BooleanConstructorCluster.prototype, BaseClusterController.prototype, {
    creatorDrop: function(dropView, dragView, dragDetails, dropDetails) {
        var newContext = this.addContext({

        }, dropView.viewID, dropView.model, dropView.surfaceView);

        if (newContext) {
            this.cluster.setFocus(newContext.id);
            this.cluster.render();
        }
        else {
            console.log('Further children not allowed');
        }
    },

    render: function(options) {
        if (this.cluster) {
            this.cluster.render({
                noAnimate: true
            });
        }
    },

    getValues: function(allValues) {
        return this.clusterController.getValues();
    },

    generateCollection: function(attributes, rootID, rootLabel) {
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
            'AttrID': 'Root',
            'Label': rootLabel || '',
            'NodeType': 'Root'
        });
        contextCollection.add([rootContext]);

        return contextCollection;
    },

    addContext: function(contextDef, parentID, parentContext, parentSurfaceView) {
        parentID = parentID || this.rootContextID;

        if (parentID != this.rootContextID) {
            return;
        }

        this.lastID += 1;

        var contextID = this.lastID + '',
            attributes = _.extend({
                                'ID': contextID
                            },
                            this.constructContextDef, contextDef),
            context = new Data.Context(attributes),
            contextCollection = this.contextCollection;

        contextCollection.associations.addAssoc('up', contextID, parentID, {save: false});
        contextCollection.associations.addAssoc('down', parentID, contextID, {save: false});
        contextCollection.add([context]);

        return context;
    },

    activityShortPressed: function(e, view) {
        var lastClusterMode = this.clusterMode;

        if (this.clusterMode == 'Expanded') {
            this.clusterMode = 'Normal';
            this.setClusterCompact();
        }
        else {
            this.clusterMode = 'Expanded';
            this.setClusterExpanded();
        }
    },

    getModeParams: function(contextModel) {
        return {
            sourceData: this.sourceData
        }
    },

    getSurfaceViewClass: function(contextModel) {
        var AttributeSurfaces = require('app/cluster/AttributeSurfaces');

        if (contextModel.get('nodeType') != 'Root') {
            return AttributeSurfaces['BonusDetails'];
        }
        else {
            return SimpleSurfaceView;
        }
    },

    getValues: function(allValues) {
        return _.object(_.compact(_.map(this.surfaceViewCache, function(surfaceView, viewID) {
            if (!_.isUndefined(surfaceView.newValue)) {
                return [surfaceView.contextModel.get('ID'), surfaceView.newValue];
            }
        })));
    },

    getSurfaceView: function(viewID, viewState, baseView, contextModel) {
        var view = BaseClusterController.prototype.getSurfaceView.call(this, viewID, viewState, baseView, contextModel);

        if (this.clusterMode == 'Expanded' && !viewState.parentID) {
            view.setDisplayMode('Edit');
        }
        else {
            view.setDisplayMode('View');
        }

        if (!viewState.parentID) {
            //console.log(this.getValues());
        }

        return view;
    },
    
    setClusterCompact: function() {
        var cluster = this.cluster;
        cluster.setRadius(this.getClusterSize());
        cluster.setConfig({
            hideChildren: false,
            scaleFactor: 0.6,
            spaceFactor: 0.7,
            focusAngleArc: 360,
            focusStartAngle: 30,
            childAngleArc: 210
        });
        cluster.render();
    },

    setClusterExpanded: function() {
        var cluster = this.cluster;
        cluster.setRadius(this.getClusterSize() * 1.6);
        cluster.setConfig({
            hideChildren: false,
            scaleFactor: 0.35,
            spaceFactor: 0.45,
            focusAngleArc: 360,
            focusStartAngle: 30,
            childAngleArc: 210
        });
        cluster.render();
    },

    getRefSize: function() {
        return Math.min(this.$container.width(), this.$container.height());
    },

    getClusterSize: function() {
        var refSize = this.getRefSize();
        return ((refSize / 2) * 0.8) * this.rootClusterOptions.radiusScaleFactor;
    }
});

module.exports = BooleanConstructorCluster;