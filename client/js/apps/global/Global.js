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
    _ = require('underscore'),
    Backbone = require('backbone'),
    moment = require('app/lib/moment');

window.$ = window.jQuery = $;

var GraphVisual = require('app/GraphVisual');

// Inherit from general App class
// Encapsulate custom UI and logic to be applied when necessary

function GlobalApp(appID, options) {
	options = options || {};
	this.G = this.G || options.G || require('app/Global')();
	this.name = 'Global';
	this.appID = appID;

	_.bindAll(this, 'calcGraphData', 'getLayer');

	// Define set of attributes
	this.initPointAttributes();
}
_.extend(GlobalApp.prototype, {
	postInit: function() {

	},

	initPointAttributes: function() {
		this.pointAttributes = {
	        'Text': {
	            AttrID: 'Text',
	            Label: 'Notes',
	            Type: 'Text',
	            Def: {}
	        },
	        'Timing': {
	            AttrID: 'Timing',
	            Label: 'Timing',
	            Type: 'Interval',
	            Def: {}
	        }
		};

		this.contextAttributes = {
	        'Label': {
	            AttrID: 'Label',
	            Label: 'Label',
	            Type: 'TextLine',
	            Def: {}
	        },
	        'TargetFrequency': {
	            AttrID: 'TargetFrequency',
	            Label: 'Target Frequency',
	            Type: 'Frequency',
	            Def: {}
	        }
		};
	},

	getPointAttributeDefs: function() {
		var attributeDefs = [];
		_.each(this.pointAttributes, function(attrDef, attrID) {
			var attrDef = $.extend(true, {}, attrDef);

			if (attrID == 'Timing') {
				attrDef.Value = {
	                'Time': Date.now() / 1000,
	                'Duration': 0
	            }
			}

			attributeDefs.push(attrDef);
		}, this);

		return attributeDefs;
	},

	getContextAttributeDefs: function() {
		var attributeDefs = [];
		_.each(this.contextAttributes, function(attrDef, attrID) {
			var attrDef = $.extend(true, {}, attrDef);
			attributeDefs.push(attrDef);
		}, this);

		return attributeDefs;
	},

	getPointEventHandlers: function() {
		return {};
	},

	getContextEventHandlers: function() {
		return {};
	},

	calcGraphData: function(contextID, surfaceView, options) {
		options = options || {};

		var context = surfaceView.contextModel;
		var state = {
			'ContextData': {}
		};

		var graphWindow = options.graphWindow || (3 * 86400),
			numSegments = Math.max(10, Math.min(1000, options.numSegments || 20)),
			maxDepth = Math.min(3, options.maxDepth || 1),
			initialDepth = context.getDepth(),
			aggregateContexts = {};

		context.traverseDown(function(context, traverseDepth, state) {
			if (context.isLeaf()) {
				var targetInterval = context.getNS('TargetFrequency') || null,
					graphOptions = {
						targetInterval: targetInterval,
						includeEmpty: !!targetInterval
					};
				var aggregateContext = context.toDepth(maxDepth, initialDepth),
					aggregateContextID = aggregateContext.id;

				if (!(aggregateContextID in state.ContextData)) {
					state.ContextData[aggregateContextID] = {};
					aggregateContexts[aggregateContextID] = aggregateContext;
				}

				if (targetInterval) {
					// merge with all other data under the same parent at this depth
					var graphData = context.calcGraphFrequency(graphWindow * 4, numSegments, graphOptions);
					state.ContextData[aggregateContextID][context.id] = graphData;
				}
			}
		}, state);

		// TODO: Add context weighting and sort by weight. Refer to newserver2//Viz.js code

		var layers = _.compact(_.map(_.values(aggregateContexts), function(levelContext) {
			var levelData = _.compact(_.values(state.ContextData[levelContext.id]));

			if (levelData.length) {
				// Sum the level components
				return {
					'LayerID': levelContext.id,
					'Color': levelContext.getColor(null, options.colorFade || 0.5),
					'NumLayers': levelData.length,
					'Data': this.G.sumArrays(levelData)
				}
			}
		}, this));

		/*var nowTotal = 0;
		if (layers.length) {
			var numLayers = 0;
			_.each(layers, function(layer) {
				nowTotal += layer.Data[0];
				numLayers += layer.NumLayers;
			});
			console.log(nowTotal / numLayers);
		}*/
		return layers;
	},

	getLayer: function(layerID, surfaceView) {
        var graphData = this.G.graphData,
            viewID = surfaceView.baseView.viewID,
            cluster = surfaceView.baseView.cluster,
            contextData = graphData[viewID],
            layerData = null;

        if (contextData && contextData[layerID]) {
            //contextData.ContextID = viewID;
            layerData = contextData[layerID].Data;
        }

        if (layerID == 'Frequency') {
            var tmpLayerData = [];
            if (layerData) {
                tmpLayerData.push(layerData);
            }

            // Traverse structure down from here, 
            var childContexts = cluster.contexts.getFromRoot(viewID);
            _.each(childContexts, function(contextModel) {
                var contextID = contextModel.id;
                var contextData = graphData[contextID];
                if (contextData && contextData['Frequency']) {
                    //contextData.ContextID = contextID;
                    tmpLayerData.push(contextData['Frequency'].Data);
                }
            }, this);

            var result = [];
            if (tmpLayerData.length) {
                _.map(_.range(0, tmpLayerData[0].length), function(i) {
                    var total = 0;
                    _.each(_.range(0, tmpLayerData.length), function(j) {
                        total += tmpLayerData[j][i] || 0;
                    });
                    result[i] = total / tmpLayerData.length;
                });
            }

            if (result.length) {
                layerData = result;
            }
        }

        return layerData;
    },

	surfaceRender: function(clusterController, clusterMode, surfaceView, surfaceModeView, options, featuresAlreadyRendered) {
		if (featuresAlreadyRendered.Background) {
			return;
		}

		var context = surfaceView.contextModel,
			G = this.G;

		options = options || {};
		if (clusterMode == 'Expanded' || clusterMode == 'Exclusive' || clusterMode == 'Compact') {
			var regionWidth = surfaceModeView.regionWidth,
				regionHeight = surfaceModeView.regionHeight,

				graphWidth = options.graphWidth,
				graphHeight = options.graphHeight,

				top = 0,
				left = 0,
				render = false,

				graphOptions = {};

			if (clusterMode == 'Expanded') {
				var numDays = 7;
				_.extend(graphOptions, {
					graphWindow: numDays * 86400,
					numSegments: numDays * 10,
					numLabels: numDays
				});
                graphWidth = graphWidth || regionHeight;
                graphHeight = graphHeight || regionWidth;

                var clusterFocusID = clusterController.cluster.focusID,
                	isFocus = surfaceView.contextModel.id == clusterFocusID;
                if (G.isMobile) {
                	render = isFocus;
                }
                else {
                	// Only if the clusterFocus is a neighbour
                	render = isFocus || surfaceView.contextModel.hasNeighbour(clusterFocusID);
                }
			}
			else if (clusterMode == 'Exclusive') {
				render = true;
				var numDays = 14;
				_.extend(graphOptions, {
					graphWindow: numDays * 86400,
					numSegments: numDays * 5,
					numLabels: numDays
				});
				graphWidth = graphWidth || (regionWidth * 0.9);
	            graphHeight = graphHeight || (regionHeight * 0.7);

		        left = regionWidth * 0.05;
		        top = regionHeight * 0.15;
			}
			else if (clusterMode == 'Compact') {
				if (surfaceView.contextModel.id == clusterController.cluster.focusID) {
					var numDays = 1;
					_.extend(graphOptions, {
						graphWindow: numDays * 86400,
						numSegments: 24,
						numLabels: numDays
					});
	                graphWidth = graphWidth || regionHeight;
	                graphHeight = graphHeight || regionWidth;

	                render = true;
	            }
			}

			if (render) {
		        if (!surfaceModeView.G2) {
		            surfaceModeView.G2 = new GraphVisual(surfaceModeView, this.calcGraphData, {
		            	G: G,
		            	labels: true,
		            	labelFunc: function(rawTotal, total, numSegments, layers, segmentIdx, layerData) {
		            		return 0;

		            		/*var numLayers = G.sum(_.pluck(layers, 'NumLayers'));
		            		return parseInt(total / numLayers);*/
		            	}
		            });
		        }
		        surfaceModeView.G2.render(graphWidth, graphHeight, graphOptions, left, top);
		    }
		    else {
		    	surfaceModeView.G2 && surfaceModeView.G2.hide();
		    }
	    }

	    return {
	    	'Background': true
	    }
	}
});

module.exports = GlobalApp;