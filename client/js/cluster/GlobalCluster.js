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
    _ = require('backbone/node_modules/underscore');

var SurfaceView = require('app/cluster/SurfaceView'),
    SimpleSurfaceView = require('app/cluster/surfaces/SimpleSurfaceView'),
    BaseClusterController = require('app/cluster/BaseClusterController');


function GlobalCluster(struct, contextCollection, options) {
    options = options || {};
    this.G = this.G || options.G || require('app/Global')();
    struct = struct || {};

    _.bindAll(this, 'onCreatorIncomingDrop', 'layerReady', 'onInputClusterLongPress', 
                'onShowPointEdit', 'onClusterInitialized', 'onDestroyerIncomingDrop');

    // Setup and render the cluster
    var defaultClusterOptions = {
        hideRoot: false,
        layoutChange: true,
        hideLabels: false,
        labelIDsOnly: false,
        noCompress: false,

        radiusScaleFactor: 0.4,
        scaleFactor: 0.6,
        spaceFactor: 0.7,
        focusAngleArc: 360,
        focusStartAngle: 30,
        childAngleArc: 210,
        maxDepth: null,
        numDetailLevels: 6
    };
    struct.Options = _.extend({}, defaultClusterOptions, struct.Options || {});

    this.on('ShowPointEdit', this.onShowPointEdit);
    this.on('ClusterInitialized', this.onClusterInitialized);

    // Call the base constructor
    BaseClusterController.call(this, struct, contextCollection);

    // FIXME: drop Exclusive down to Expanded until load sort order is fixed
    // The cluster isn't fully ready here yet
    var clusterMode = options.clusterMode == 'Exclusive' ? 'Expanded': options.clusterMode;
    this.setClusterMode(clusterMode || 'Compact', {
        render: false
    });
}

_.extend(GlobalCluster.prototype, BaseClusterController.prototype, {
    onClusterShortPress: function(e, view) {
        var cluster = this.cluster;

        if (cluster.focusID != view.viewID && cluster.config.layoutChange) {
            // Set focus to pressed view
            cluster.setFocus(view.viewID, false);
        }

        if (this.clusterMode == 'Expanded') {
            this.setClusterMode('Compact', {render: true})
        }
        else if (this.clusterMode == 'Compact') {
            this.setClusterMode('Expanded', {render: true})
        }
        else if (this.clusterMode == 'Exclusive') {
            this.unsetExclusive();
        }
    },

    setClusterMode: function(clusterMode, options) {
        options = options || {};

        if (clusterMode == 'Compact') {
            this.setCompact(options);
        }
        else if (clusterMode == 'Expanded') {
            this.setExpanded(options);
        }
        else if (clusterMode == 'Exclusive') {
            this.setExclusive(options);
        }
    },

    onClusterLongPress: function(e, view) {
        if (this.clusterMode == 'Exclusive') {
            this.unsetExclusive();
        }
        else {
            this.setClusterMode('Exclusive', {
                render: true,
                focusID: view.viewID
            });
        }
    },

    onBeforeClusterClicked: function(e, view) {
        this.G.trigger('GlobalClusterClicked', e, view);
    },
    
    setCompact: function(options) {
        options = options || {};
        this.clusterMode = 'Compact';
        this.G.setLastClusterMode(this.clusterMode);

        var cluster = this.cluster;
        cluster.setRadius(this.getClusterSize());
        cluster.setConfig(_.extend({}, this.clusterConfig, {
            scaleFactor: 0.6,
            spaceFactor: 0.7
        }));

        if (options.render) {
            cluster.render();
        }
    },

    setExpanded: function(options) {
        options = options || {};
        this.clusterMode = 'Expanded';
        this.G.setLastClusterMode(this.clusterMode);

        var cluster = this.cluster;
        cluster.setRadius(this.getClusterSize() * 1.8);
        cluster.setConfig(_.extend({}, this.clusterConfig, {
            scaleFactor: 0.29,
            spaceFactor: 0.45
        }));

        if (options.render) {
            cluster.render();
        }
    },

    setExclusive: function(options) {
        options = options || {};
        this.prevClusterMode = this.clusterMode;
        this.clusterMode = 'Exclusive';
        this.G.setLastClusterMode(this.clusterMode);

        var cluster = this.cluster,
            globalSize = this.G.globalSize(),
            refSize = Math.min(globalSize.width, globalSize.height);

        cluster.setRadius((refSize / 2) * 1.25);
        cluster.setConfig({
            hideChildren: true
        });

        this.prevClusterFocusID = null;
        if (options.focusID) {
            cluster.setFocus(options.focusID);

            if (options.focusID != cluster.lastFocusID) {
                this.prevClusterFocusID = cluster.lastFocusID;
            }
        }

        var focusID = options.focusID || cluster.focusID,
            view = cluster.getView(focusID);

        view.el.setAttribute('BDragSource', '0');

        this.G.trigger('SetExclusive', cluster);

        if (options.render) {
            cluster.render();
        }

        if (view.darkColor3) {
            view.$el.css({
                'background': view.darkColor3.toRgbaString()
            });
        }
        else {
            console.log('setExclusive: View has no color yet');
        }

        var viewState = cluster.lastLayoutData.data[focusID];
        this.G.trigger('PushContext', view, viewState);
    },

    unsetExclusive: function() {
        var cluster = this.cluster,
            view = cluster.getView(cluster.focusID),
            viewState = cluster.lastLayoutData.data[cluster.focusID];

        if (this.prevClusterFocusID) {
            cluster.setFocus(this.prevClusterFocusID);
        }

        cluster.setConfig({
            hideChildren: true
        });

        view.el.setAttribute('BDragSource', '1');
        view.renderColor(null, true);

        this.G.trigger('PopContext', view, viewState);

        if (this.prevClusterMode == 'Expanded') {
            this.setClusterMode('Expanded', {render: true});
        }
        else if (this.prevClusterMode == 'Compact') {
            this.setClusterMode('Compact', {render: true});
        }
    },

    onClusterInitialized: function(controller, cluster) {
        if (!cluster.focusID) {
            cluster.setFocus(this.rootContextID);
        }
        cluster.setFilterLevel(0, {noRender: true});
        cluster.setRadius(this.getClusterSize());
        this.setPosition();

        cluster.on('CreatorIncomingDrop', this.onCreatorIncomingDrop);
        cluster.on('DestroyerIncomingDrop', this.onDestroyerIncomingDrop);

        this.on('CreatorIncomingDrop', this.onCreatorIncomingDrop);
        this.on('DestroyerIncomingDrop', this.onDestroyerIncomingDrop);
    },

    onShowPointEdit: function(pointID, contextID, changeCallback, initialPos) {
        var view = this.cluster.getView(contextID);

        var clusterDef = this.G.generatePointAttributeCluster(view.model);
        clusterDef.RenderOptions.initialPos = initialPos;
        clusterDef.Options.radiusScaleFactor = 0.4;

        var color = view.cluster.getColor(view.viewID);
        clusterDef.Options.rootColor = color;
        clusterDef.Origin = view;

        var _this = this;

        this.pushCluster({
            originalView: view,
            clusterDef: clusterDef,
            pointID: pointID,
            point: view.cluster.contexts.points.get(pointID),
            initialPos: initialPos,
            initValues: function(clusterDef, options) {
                var point = options.point;
                return {
                    'Text': point.get('Text', 1),
                    'Timing': {
                        'Time': point.get('Time',1),
                        'Duration': point.get('Duration', 1)
                    },
                    'Bonuses': point.get('Bonuses', 2001)
                }
            },
            commit: function(options) {
                var values = options.values,
                    point = options.point;

                if (point) {
                    _this.G.trigger('UpdatePoint', _this.cluster.clusterID, point, values);
                }
            },
            complete: changeCallback
        });
    },

    onCreatorIncomingDrop: function(dragView, dragDetails, dropDetails, callback) {
        var view = dragView;

        if (view.className != 'simple-view' || !view.model.isLeaf()) {
            return;
        }

        // Only push the cluster if it's a hold
        // Otherwise add the point and show the AddFeedback

        var color = view.cluster.getColor(view.viewID);

        if (dropDetails.isHold) {
            var clusterDef = this.G.generatePointAttributeCluster(view.model);
            clusterDef.RenderOptions.initialPos = {
                x: dropDetails.currentX,
                y: dropDetails.currentY
            };

            clusterDef.Options.rootColor = color;
            clusterDef.Origin = view;

            var _this = this;

            this.pushCluster({
                originalView: view,
                clusterDef: clusterDef,
                color: color,
                commit: function(options) {
                    var values = options.values,
                        originalView = options.originalView;

                    var dropDetails = {};
                    _this.G.trigger('AddPoint', originalView.viewID, originalView.clusterID, {
                        UpdatedAttributes: values,
                        Color: color
                    }, null, {
                        showHistory: false,
                        showAddFeedback: false,
                        toParent: false,
                        showDetail: false
                    });
                }
            });
        }
        else {
            var dropDetails = {};
            this.G.trigger('AddPoint', view.viewID, view.clusterID, {
                UpdatedAttributes: {
                    Timing: {
                        Time: Date.now() / 1000,
                        Duration: 0
                    }
                },
                Color: color
            }, null, {
                showHistory: false,
                showAddFeedback: true,
                toParent: false,
                showDetail: false
            });
        }

        if (callback) {
            callback(true);
        }
    },

    onDestroyerIncomingDrop: function(dragView, dragDetails, dropDetails, callback) {
        var view = dragView;

        if (view.className == 'simple-view') {
            // Delete the context
            var contextID = view.viewID,
                cluster = dragView.cluster,
                clusterID = cluster.clusterID,
                noFocus = null,
                successCallback = null;

            if (contextID != cluster.rootID) {
                this.G.trigger('DeleteContext', contextID, clusterID, noFocus, successCallback);
            }
        }
        else if (view.className == 'point-list-view' || view.className == 'activity-interval-view') {
            if (view.model && !view.nonDeletable) {
                // Delete the point
                var successCallback = null,
                    pointModel = dragView.model,
                    pointID = pointModel.id,
                    parentContextID = pointModel.get('ContextID');

                this.G.trigger('DeletePoint', pointID, parentContextID, successCallback);
            }
        }

        if (callback) {
            callback(true);
        }
    },

    addNode: function(nodeDef, parentContextID, contextCollection) {
        var contextModel = BaseClusterController.prototype.addNode.call(this, nodeDef, parentContextID, contextCollection);

        if (contextModel) {
            contextModel.save({}, {type: 'post'});
        }

        var parentView = this.cluster.getView(parentContextID);
        this.G.trigger('ContextCreated', contextModel.id, parentView);
        return contextModel;
    },

    getNextID: function() {
        return this.G.nextID();
    },

    getSurfaceViewClass: function(contextModel) {
        return SimpleSurfaceView;
    },

    getSurfaceViewClass: function(contextModel) {
        var surfaces = require('app/cluster/GeneralSurfaces'),
            contextType = contextModel.get('Type') || this.struct.NodeType,
            SurfaceViewCls = surfaces[contextType] || SurfaceView;

        return SurfaceViewCls;
    },

    getSurfaceView: function(viewID, viewState, baseView, contextModel) {
        var view = BaseClusterController.prototype.getSurfaceView.call(this, viewID, viewState, baseView, contextModel);

        if (this.clusterMode == 'Expanded' && !viewState.parentID) {
            view.setDisplayMode('Edit');
        }
        else if (this.clusterMode == 'Exclusive' && viewState.depth == 1) {
            view.setDisplayMode('Exclusive');
        }
        else {
            view.setDisplayMode('View');
        }
        return view;
    }
});

module.exports = GlobalCluster;