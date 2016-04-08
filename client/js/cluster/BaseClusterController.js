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

var Data = require('app/models/Data'),
    Cluster = require('app/Cluster'),
    SimpleView = require('app/views/SimpleView'),
    SimpleSurfaceView = require('app/cluster/surfaces/SimpleSurfaceView');

function BaseClusterController(struct, contextCollection, options) {
    options = options || {};
    this.G = this.G || options.G || require('app/Global')();
    _.bindAll(this, 'onClusterLongPress', 'onClusterShortPress', 'onClusterClicked', 
            'onValueChange', 'onCreatorDrop', 'onDestroyerDrop', 'layerReady',
            'onBeforeClusterClicked', 'dataReady', 'showEditCluster');

    this.struct = struct
    this.defaultConstructDef = {};

    this.randomID = Math.round(Math.random() * 100000);
    this.clusterID = struct.ID || 'Cluster-' + this.randomID;
    this.$container = struct.Container;
    this.clusterAttributes = struct.Nodes;
    this.clusterConfig = struct.Options;
    this.eventHandlers = struct.EventHandlers || {};
    this.parentCluster = struct.ParentCluster || null;

    this.containerWidth = this.clusterConfig.containerWidth || this.$container.width(),
    this.containerHeight = this.clusterConfig.containerHeight || this.$container.height();

    this.surfaceViewCache = {};
    this.lastID = 2;

    this.on('DataReady', this.dataReady);

    if (!contextCollection) {
        this.rootContextID = 2;
        this.contextCollection = this.generateCollection(struct.Nodes, this.rootContextID, this.clusterConfig.label);
    }
    else {
        this.rootContextID = contextCollection.rootID;
        this.contextCollection = contextCollection;
    }
    this.trigger('DataReady', this.contextCollection);
}
_.extend(BaseClusterController.prototype, {
    render: function(options) {
        options = options || {};
        if (this.cluster) {
            options.rootColor = options.rootColor || this.clusterConfig.rootColor || null;
            this.cluster.render(options);

            if (this.eventHandlers.onReady) {
                this.eventHandlers.onReady(this, null, this.getValues());
            }
        }
    },

    dataReady: function(contextCollection) {
        var cluster = new Cluster(this.clusterID, this, {
            $el: this.$container,
            listeners: {
                'BeforeActivityClicked': this.onBeforeClusterClicked
            },
            G: this.G
        });
        this.setCluster(cluster);
        this.G.addCluster(cluster);

        this.trigger('ClusterInitialized', this, cluster);
    },

    setCluster: function(cluster) {
        this.cluster = cluster;
        this.cluster.on('ActivityShortPressed', this.onClusterShortPress);
        this.cluster.on('ActivityPressed', this.onClusterLongPress);
        this.cluster.on('ActivityClicked', this.onClusterClicked);
        this.cluster.on('CreatorDrop', this.onCreatorDrop);
        this.cluster.on('DestroyerDrop', this.onDestroyerDrop);

        var _this = this;
        this.cluster.on('AfterRender', function() {
            _this.trigger('AfterRender', cluster);
        });
    },

    setPosition: function(x, y) {
        if (_.isNumber(x) && _.isNumber(y)) {
            this.cluster.setPosition({
                x: x,
                y: y
            });
        }
        else {
            this.cluster.setPosition({
                x: this.containerWidth / 2,
                y: this.containerHeight / 2
            });
        }
    },

    generateCollection: function(nodes, rootID, rootLabel) {
        nodes = nodes || [];
        var rootContextID = rootID || this.lastID;
        rootLabel = rootLabel || '';

        rootContextID += '';

        // Init the data structure
        var pointsCollection = new Data.Points([], {rootID: rootContextID, G: this.G}),
            associationCollection = new Data.Associations([], {G: this.G}),
            contextCollection = new Data.Contexts([], {
                G: this.G,
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
            'Type': this.struct.RootType || this.struct.NodeType || 'SimpleSurfaceView'
        }, {
            G: this.G
        });
        contextCollection.add([rootContext]);

        _.each(nodes, function(nodeDef) {
            this.addNode(nodeDef, rootContextID, contextCollection);
        }, this);

        return contextCollection;
    },

    onBeforeClusterClicked: function(e, view) {},
    onClusterClicked: function(e, view) {},
    onClusterShortPress: function(e, view) {},

    onClusterLongPress: function(e, view) {
        if (this.struct.Editable && this.struct.EditDef) {
            this.showEditCluster(view);
        }
    },

    showEditCluster: function(view) {
        var clusterDef = $.extend(true, {}, this.struct.EditDef);
        clusterDef.Origin = view;

        var initialPos = {
            x: view.$el.offset().left + (view.$el.width() / 2),
            y: view.$el.offset().top + (view.$el.height() / 2)
        };
        clusterDef.RenderOptions.initialPos = initialPos;

        this.pushCluster({
            originalView: view,
            contextModel: view.model,
            clusterDef: clusterDef,
            visibleUIElements: clusterDef.Options.visibleUIElements,
            initialPos: initialPos,
            initValues: function(clusterDef, options) {
                var contextModel = options.contextModel;
                return _.object(_.map(options.clusterDef.Nodes, function(nodeDef) {
                    var nodeAttributeID = nodeDef.AttrID,
                        nodeValue = contextModel.get(nodeAttributeID);

                    return [nodeAttributeID, nodeValue];
                }));
            },
            commit: function(options) {
                var values = options.values,
                    contextModel = options.contextModel;
                contextModel.set(values);

                if (view.surfaceView) {
                    view.surfaceView.render();
                }

                this.onValueChange();
            }
        });
    },

    pushCluster: function(options) {
        options = options || {};
        if (!options.originalView) {
            return;
        }

        var visibleUIElements = options.visibleUIElements || ['Creator', 'Destroyer'];

        var layerZIndex;
        if (this.parentCluster) {
            layerZIndex = this.parentCluster.currentZIndex + 1;
        }
        else {
            layerZIndex = this.cluster.currentZIndex + 1;
        }

        this.G.setUILayers(layerZIndex, visibleUIElements);
        this.G.trigger('PushLayer', layerZIndex, this.layerReady, options);
        return true;
    },

    layerReady: function($layer, options) {
        options = options || {};

        var clusterDef = options.clusterDef;
        clusterDef.Container = $layer;
        clusterDef.Render = true;

        if (_.isFunction(options.initValues)) {
            // Both params passed by reference and may be modified
            clusterDef.Value = options.initValues(clusterDef, options);
        }

        var layerCluster = this.G.renderStructure(clusterDef);
        if (!layerCluster) {
            console.log('layerCluster not initialized');
            return;
        }
        options.layerCluster = layerCluster;

        var _this = this;
        layerCluster.on('LongPress', function(e, view) {
            _this.onInputClusterLongPress(e, view, options);
        });
    },

    onInputClusterLongPress: function(e, pressView, options) {
        options = options || {};

        // Capture the value and close the layer
        this.G.trigger('PopLayer');
        this.G.unsetUILayers();

        if (_.isFunction(options.commit)) {
            var commitOptions = _.extend({}, options);
            commitOptions.values = options.layerCluster.getValues();
            options.commit.call(this, commitOptions);
        }

        if (_.isFunction(options.complete)) {
            options.complete.call(this);
        }
    },

    onCreatorDrop: function(dropView, dragView, dragDetails, dropDetails) {
        var simpleNodeDef = _.extend({}, this.defaultConstructDef, this.struct.ConstructDef || {}),
            constructType = this.struct.ConstructType || this.defaultConstructType;

        if (!_.isString(simpleNodeDef.Label)) {
            simpleNodeDef.Label = simpleNodeDef.AttrID;
        }
        simpleNodeDef.AttrID = simpleNodeDef.AttrID + '-' + Math.round(Math.random() * 100000);
        var nodeDef = this.G.transformNode(constructType, simpleNodeDef),
            newContext = this.addNode(nodeDef, dropView.viewID),
            contextID = newContext.id;

        this.setViewState(contextID, nodeDef.Value);
        
        if (newContext) {
            this.cluster.render();

            if (this.struct.ConstructDef && this.struct.ConstructDef.EventHandlers && this.struct.ConstructDef.EventHandlers.onInit) {
                this.struct.ConstructDef.EventHandlers.onInit(this, contextID);
            }
        }
        else {
            console.log('Further children not allowed');
        }
    },

    onDestroyerDrop: function(dropView, dragView, dragDetails, dropDetails) {
        var view = dropView,
            contextID = view.viewID,
            contextModel = this.cluster.contexts.get(contextID);

        var clusterDef = this.G.generateContextAttributeCluster(contextModel);

        var initialPos = {
            x: dropDetails.currentX,
            y: dropDetails.currentY
        };
        clusterDef.RenderOptions.initialPos = initialPos;
        clusterDef.Options.radiusScaleFactor = 0.4;

        var color = this.cluster.getColor(contextID);
        clusterDef.Options.rootColor = color;
        clusterDef.Origin = null;

        var _this = this;
        this.pushCluster({
            originalView: view,
            clusterDef: clusterDef,
            visibleUIElements: clusterDef.Options.visibleUIElements,
            contextModel: contextModel,
            contextID: contextID,
            initialPos: initialPos,
            initValues: function(clusterDef, options) {
                var context = options.contextModel;
                return {
                    'Label': context.getNS('Label'),
                    'TargetFrequency': context.getNS('TargetFrequency'),
                    'BaseValue': context.getNS('BaseValue', 2001) || 10
                }
            },
            commit: function(options) {
                var values = options.values,
                    context = options.contextModel;

                if (context) {
                    var updateAttributes = values,
                        eventHandlers = options.clusterDef && options.clusterDef.EventHandlers;

                    if (_.isFunction(eventHandlers.onCommit)) {
                        updateAttributes = eventHandlers.onCommit(updateAttributes, context, options);
                    }

                    if (_.keys(updateAttributes).length > 0) {
                        _this.G.trigger('UpdateContext', context.id, updateAttributes);
                    }
                }
            },
            complete: function() {
            }
        });
    },

    addNode: function(nodeDef, parentID, contextCollection) {
        nodeDef = nodeDef || {};
        contextCollection = contextCollection || this.contextCollection;

        // nodeDef is modified here so do a deep clone first
        nodeDef == $.extend(true, {}, nodeDef);

        var parentID = parentID || contextCollection.rootID,
            associationCollection = contextCollection.associations;

        var nodeID = this.getNextID();
        nodeDef.ID = nodeID;

        if (this.struct.Value && nodeDef.AttrID in this.struct.Value) {
            nodeDef.Value = this.struct.Value[nodeDef.AttrID];
        }
        else if (_.isUndefined(nodeDef.Value) || _.isNull(nodeDef.Value)) {
            nodeDef.Value = this.struct.DefaultValue || null;
        }

        nodeDef.ParentID = parentID;

        // Neighbours w/ associations
        var nodeContext = new Data.Context(nodeDef, {G: this.G});

        var saveAssoc = !!this.G.localOnly;
        associationCollection.addAssoc('up', nodeID, parentID, {save: saveAssoc});
        associationCollection.addAssoc('down', parentID, nodeID, {save: saveAssoc});

        contextCollection.add([nodeContext]); // , {silent: true}

        return nodeContext;
    },

    getNextID: function() {
        this.lastID += 1;
        return this.lastID;
    },

    setViewState: function(viewID, value) {},

    getElementView: function(contextID, isRoot, isGlobalRoot, options) {
        return SimpleView;
    },

    getContextCollection: function() {
        return this.contextCollection;
    },

    getConfig: function() {
        return this.clusterConfig;
    },

    getModeParams: function() {
        return {};
    },

    getSurfaceViewClass: function(contextModel) {
        return SimpleSurfaceView;
    },

    getSurfaceView: function(viewID, viewState, baseView, contextModel) {
        var view = this.surfaceViewCache[viewID];
        if (!view) {
            var SurfaceViewCls = this.getSurfaceViewClass(contextModel);
            view = new SurfaceViewCls({
                G: this.G,
                viewState: viewState,
                baseView: baseView,
                contextModel: contextModel,
                clusterController: this,
                modeParams: this.getModeParams(contextModel)
            });

            this.listenTo(view, 'ValueChanged', this.onValueChange);
        }
        else {
            view.setState(viewState);
        }

        this.surfaceViewCache[viewID] = view;
        return view;
    },

    getValues: function() {
        return _.object(_.compact(_.map(this.surfaceViewCache, function(surfaceView, viewID) {
            var nodeDefID = surfaceView.contextModel.get('AttrID');
            if (!nodeDefID) {
                return;
            }

            if (_.isUndefined(surfaceView.newValue)) {
                return [nodeDefID, surfaceView.getValue()];
            }
            else {
                return [nodeDefID, surfaceView.newValue];
            }
        })));
    },

    onValueChange: function(newValue) {
        if (this.eventHandlers.onValueChange) {
            this.eventHandlers.onValueChange(this, newValue, this.getValues());
        }
    },

    getRefSize: function() {
        return Math.min(this.containerWidth, this.containerHeight);
    },

    getClusterSize: function() {
        return (this.getRefSize() / 2) * this.clusterConfig.radiusScaleFactor;
    }
});
_.extend(BaseClusterController.prototype, Backbone.Events)

module.exports = BaseClusterController;