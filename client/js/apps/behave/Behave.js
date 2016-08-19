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

function BehaveApp(appID, options) {
	options = options || {};
	this.G = this.G || options.G || require('app/Global')();
	this.name = 'Behave';
	this.appID = appID;

	_.bindAll(this, 'renderValue', 'updateScore', 'calcGraphData', 'bonusDefCommit');

	var G = this.G;
	G.on('GlobalClusterRendered', this.updateScore);

	this.$availBalance = $('<div>')
							.addClass('avail-balance')
							.text('')
							.appendTo(G.$el);

	// Define set of attributes
	this.initPointAttributes();

	var _this = this;
	G.on('AfterClusterRender', function(cluster) {
		if (cluster.clusterID == G.globalCluster.cluster.clusterID) {
			_this.updateScore({
				noRenderGraph: true
			});
		}
	})
}
_.extend(BehaveApp.prototype, {
	postInit: function(globalCluster) {
		this.contexts = globalCluster.cluster.contexts;
		this.contexts.points.on('add remove change', this.updateScore);
	},

	initPointAttributes: function() {
		this.pointAttributes = {
			'Bonuses': {
	            AttrID: 'Bonuses',
	            Label: 'Bonuses',
	            Type: 'ClusterContainer',
	            Def: {
				    Type: 'Cluster',
				    ClusterType: 'Boolean',
				    RootType: 'BooleanRoot',
				    Constructor: false,

				    // Optional. Will default to cluster preference.
				    ConstructType: 'BooleanOption',

				    // Optional. Will default to cluster preference.
				    ConstructDef: {
				        AttrID: 'NewBonus',
				        Label: null,
				        Name: '',
				        GlobalMultiplier: false,
				        MultiplierValue: 1
				    },

				    Container: null,
				    Layer: false,
				    Name: 'Bonuses',
				    Render: true,
				    RenderOptions: {},
				    Options: {},
				    EventHandlers: {
				        onEdit: function(clusterController, viewID, view, surfaceView, contextModel) {
				            return contextModel.get('Type') == 'BooleanOption';
				        }
				    },
				    Nodes: []
				}
	        }
		};

		this.contextAttributes = {
			'BaseValue': {
				AttrID: 'BaseValue',
	            Label: 'BaseValue',
	            Type: 'Numeric',
	            DefaultValue: 10
			},
			'Bonuses': {
	            AttrID: 'Bonuses',
	            Label: 'Bonuses',
	            Type: 'ClusterContainer',
	            Def: {
				    Type: 'Cluster',
				    ClusterType: 'ContextDef',
				    RootType: 'ContextDefRoot',
				    Constructor: true,

				    // Optional. Will default to cluster preference.
				    ConstructType: 'ContextDef',

				    // Optional. Will default to cluster preference.
				    ConstructDef: {
				        AttrID: 'NewBonus',
				        Type: 'ContextDef',
				        Label: 'Bonus',
				        Name: '',
				        GlobalMultiplier: false,
				        MultiplierValue: 1,
				        EventHandlers: {
				        	onInit: function(clusterController, contextID) {
				        		var view = clusterController.cluster.getView(contextID);
				        		if (!view) {
				        			return;
				        		}

				        		clusterController.showEditCluster(view);
				        	}
				        }
				    },

				    Editable: true,
				    EditDef: {
					    Type: 'Cluster',
					    ClusterType: 'Attribute',
					    Constructor: false,
					    Container: null,
					    Layer: true,
					    Name: 'New Bonus',
					    Render: true,
					    RenderOptions: {},
					    Options: {
					    	visibleUIElements: [],
					    	clusterSize: 'Expanded'
					    },
					    EventHandlers: {
					    },
					    Nodes: [
					        {
					            'AttrID': 'Label',
					            'Label': 'Set the name of this bonus',
					            'Type': 'TextLine',
					            'DefaultValue': ''
					        },
					        {
					            'AttrID': 'Text',
					            'Label': 'Any notes for this bonus?',
					            'Type': 'Text',
					            'DefaultValue': ''
					        },
					        {
					            'AttrID': 'MultiplierValue',
					            'Label': 'How big is this bonus?',
					            'Type': 'Numeric',
					            'DefaultValue': 1
					        },
					        {
					            'AttrID': 'GlobalMultiplier',
					            'Label': 'Is this a super-bonus?',
					            'Type': 'Boolean',
					            'DefaultValue': false
					        }
					    ]
					},

				    Container: null,
				    Layer: false,
				    Name: 'Bonuses',
				    Render: true,
				    RenderOptions: {},
				    Options: {},
				    EventHandlers: {
				        onEdit: function(clusterController, viewID, view, surfaceView, contextModel) {
				            //return contextModel.get('Type') == 'ContextDef';
				            return true;
				        }
				    },
				    Nodes: []
				}
	        }
		}

		this.appContext = this.G.globalCollection.get(this.appID);
		this.bonusDefContext = _.find(this.appContext.getAssocModels('down'), function(outContext) {
			return outContext.getNS('Label') == 'Bonuses';
		});
	},

	getBonuses: function() {
		return this.getContextBonusDefs(this.bonusDefContext);
	},

	getContextBonusDefs: function(bonusDefContext) {
		var namespaceID = this.appID,
			result = {};

		_.each(bonusDefContext.getAssocModels('down'), function(bonusContext) {
			var bonusID = bonusContext.id;
			result[bonusID] = {
				'AttrID': bonusContext.getNS('AttrID', namespaceID),
				'OriginalContextID': bonusContext.id,
				//'Type': 'ContextDef',
		        'GlobalMultiplier': !!parseInt(bonusContext.getNS('GlobalMultiplier', namespaceID)),
		        'MultiplierValue': parseInt(bonusContext.getNS('MultiplierValue', namespaceID)) || 1,
		        'Label': bonusContext.getNS('Label', namespaceID),
		        'Text': bonusContext.getNS('Text', namespaceID)
			}
		}, this);

		return result;
	},

	getPointAttributeDefs: function() {
		var attributeDefs = [];
		_.each(this.pointAttributes, function(attrDef, attrID) {
			var attrDef = $.extend(true, {}, attrDef);

			if (attrID == 'Bonuses') {
				_.each(this.getBonuses(), function(bonusDef, bonusID) {
					attrDef.Def.Nodes.push($.extend(true, {}, bonusDef));
				}, this);
			}

			attributeDefs.push(attrDef);
		}, this);

		return attributeDefs;
	},

	getContextAttributeDefs: function() {
		var attributeDefs = [];
		_.each(this.contextAttributes, function(attrDef, attrID) {
			var attrDef = $.extend(true, {}, attrDef);

			if (attrID == 'Bonuses') {
				_.each(this.getBonuses(), function(bonusDef, bonusID) {
					attrDef.Def.Nodes.push($.extend(true, {}, bonusDef));
				}, this);
			}

			attributeDefs.push(attrDef);
		}, this);

		return attributeDefs;
	},

	getPointEventHandlers: function(contextModel) {
		return {
			onValueChange: this.renderValue,
			onReady: this.renderValue
		}
	},

	getContextEventHandlers: function(contextModel) {
		return {
			onCommit: this.bonusDefCommit
		};
	},

	bonusDefCommit: function(values, context, options) {
		var updateAttributes = {};
		_.each(values, function(val, attributeName) {
			if (attributeName == 'Label' || attributeName == 'BaseValue') {
				updateAttributes[attributeName] = val;

				if (attributeName == 'BaseValue') {
					// Clear the cache so the change takes immediate effect
					this.bonusBaseCache = null;
				}
			}
			else if (attributeName == 'Bonuses') {
				_.each(val, function(bonusDef, originalContextID) {
					if (!originalContextID) {
						return;
					}

					if (_.isString(originalContextID) && originalContextID.substr(0, 8) == 'NewBonus') {
						//console.log('New bonus', bonusDef);
						var clusterID = context.collection.clusterController.cluster.clusterID,
							parentContextID = this.bonusDefContext.id;

						this.G.trigger('AddContext', parentContextID, clusterID, bonusDef); //, loadCallback)
					}
					else {
						var contextID = parseInt(originalContextID);
						if (!_.isNaN(contextID)) {
							//console.log('Existing bonus', originalContextID, bonusDef);
							this.G.trigger('UpdateContext', contextID, bonusDef);
								 //, loadCallback, loadCallbackOptions) {
						}
					}
				}, this);
			}
		}, this);

		return updateAttributes;
	},

	surfaceRender: function(cluster, clusterMode, surfaceView, surfaceModeView, options) {
		options = options || {};
		if (clusterMode == 'Expanded' || clusterMode == 'Exclusive') {
			var regionWidth = surfaceModeView.regionWidth,
				regionHeight = surfaceModeView.regionHeight,

				graphWidth = options.graphWidth,
				graphHeight = options.graphHeight,

				top = 0,
				left = 0

				graphOptions = {};

			if (clusterMode == 'Expanded') {
				var numDays = 7;
				_.extend(graphOptions, {
					numDays: numDays,
					graphWindow: numDays * 86400,
					numSegments: numDays * 5,
					numLabels: numDays
				});

                graphWidth = graphWidth || regionHeight;
                graphHeight = graphHeight || regionWidth;
			}
			else {
				var numDays = 14;
				_.extend(graphOptions, {
					numDays: numDays,
					graphWindow: numDays * 86400,
					numSegments: numDays * 5,
					numLabels: numDays
				});

				graphWidth = graphWidth || (regionWidth * 0.9);
	            graphHeight = graphHeight || (regionHeight * 0.7);

		        left = regionWidth * 0.05;
		        top = regionHeight * 0.15;
			}

	        if (!surfaceModeView.Graph) {
	            surfaceModeView.Graph = new GraphVisual(surfaceModeView, this.calcGraphData, {
	            	G: this.G,
	            	labels: true,
	            	labelFunc: function(rawTotal, total, numSegments, layers, segmentIdx, layerData) {
	            		return rawTotal;
	            	}
	            });
	        }
	        surfaceModeView.Graph.render(graphWidth, graphHeight, graphOptions, left, top);
	    }
	},

	updateScore: function(options) {
		options = options || {};

		var clusterController = this.G.globalCluster,
			cluster = clusterController.cluster,
			pointBalance = this.calcPointBalance(clusterController),
			dayRange = clusterController.clusterMode == 'Expanded' ? 7 * 86400 : 'today';

        var _this = this;
        function updateScores(focusContextID, parentContextID) {
        	var focusView = cluster.getView(focusContextID);

        	if (focusView && focusView.surfaceView) {
        		var rangePoints = _this.calcRangePoints(clusterController, focusContextID, dayRange);
	        	rangePoints = rangePoints || '';
	        	focusView.surfaceView.setExtra(rangePoints);

		        _.each(focusView.model.getNeighbourModels(), function(childModel) {
		        	var childContextID = childModel.id;
		        	if (childContextID != parentContextID) {
		        		updateScores(childContextID, focusContextID);
		        	}
		        }, _this);
		    }
	    }

	    updateScores(cluster.focusID);
        this.$availBalance.text(pointBalance || '');

        if (!options.noRenderGraph) {
	        // Re-render surface if graph is visible
	        if (clusterController.clusterMode == 'Expanded' || clusterController.clusterMode == 'Exclusive' ) {
		        var focusID = cluster.focusID,
		        	focusView = cluster.getView(focusID);
	        	focusView.surfaceView.render();
	        }
	    }
	},

	calcGraphData: function(contextID, surfaceView, graphOptions) {
		var clusterController = this.G.globalCluster;
        var renderEOD = moment(this.G.getNow()).endOf('day');

        var clusterContexts = clusterController.cluster.contexts,
        	contextModel = clusterContexts.get(contextID),
        	neighbours = contextModel.getAssoc('down');

        // Include focus
        neighbours.push(contextID);

        var points = clusterContexts.points.getRecentPoints(graphOptions.graphWindow, contextID);

        _.each(points, function(point) {
        	var contextID = point.get('ContextID'),
        		contextModel = clusterContexts.get(contextID);

        	while (contextModel) {
        		if (_.indexOf(neighbours, contextModel.id) >= 0) {
        			point.neighbourContextID = contextModel.id;
        			break;
        		}
        		contextModel = contextModel.getParent();
        	}
        });

        var dayPoints = _.groupBy(points, function(p) {
		        	var pointTime = moment(p.get('Time') * 1000),
			            daysDiff = renderEOD.diff(pointTime, 'days');
			        return daysDiff;
			    });

        var graphData = _.object(_.map(neighbours, function(contextID) {
        	return [contextID, []];
        }));

        _.each(_.range(0, graphOptions.numDays), function(dayIdx) {
            var points = dayPoints[dayIdx],
            	dayContextPoints = _.groupBy(points, function(p) {
			        return p.neighbourContextID;
			    });

			_.each(neighbours, function(contextID) {
				graphData[contextID][dayIdx] = this.sumPoints(dayContextPoints[contextID] || []);
			}, this);
        }, this);

        var graphLayers = _.map(graphData, function(data, contextID) {
        	return {
        		'LayerID': contextID,
        		'Color': clusterContexts.get(contextID).getColor(null, 0.5),
        		'Data': data
        	}
        });

        return graphLayers;
	},

	calcTodaysPoints: function(clusterController, contextID) {
		var daySeconds = moment().diff(moment().startOf('day')) / 1000;
		return this.calcRangePoints(clusterController, contextID, daySeconds);
	},

	calcRangePoints: function(clusterController, contextID, rangeSeconds) {
		if (rangeSeconds == 'today') {
			return this.calcTodaysPoints(clusterController, contextID);
		}
		var rangePoints = clusterController.cluster.contexts.points.getRecentPoints(rangeSeconds, contextID);
		return this.sumPoints(rangePoints);
	},

	calcPointBalance: function(clusterController) {
		var pointsCollection = clusterController.cluster.contexts.points,
			points = pointsCollection.models;

		return this.sumPoints(points);
	},

	sumPoints: function(points) {
		var sum = 0;
		var pointValues = _.map(points, function(point) {
			var contextID = point.getContextID(),
				pointBonuses = point.get('Bonuses', this.appID) || {};

			var baseValue = this.getBonusBaseValue(contextID) - 0,
				pointVal = this.calcPoints(baseValue, pointBonuses);

			sum += pointVal;
        	return [point, contextID, pointVal];
		}, this);

		return sum;
	},

	calcPoints: function(baseValue,  bonusFlags) {
	    bonusFlags = bonusFlags || {};

	    var total = baseValue,
	        globalMultiplier = 1;

	    _.each(bonusFlags, function(bonusEnabled, bonusID) {
	        if (!bonusEnabled) {
	            return;
	        }

	        var bonusDef = this.getBonuses()[bonusID] || {
	            'GlobalMultiplier': false,
	            'MultiplierValue': 1,
	            'Text': ''
	        };

	        var multiplier = bonusDef.MultiplierValue;
	        if (bonusDef.GlobalMultiplier) {
	            globalMultiplier *= multiplier;
	        }
	        else {
	            total += baseValue * multiplier;
	        }
	    }, this);
	    total *= globalMultiplier;

	    return Math.round(total);
	},

	getBonusBaseValue: function(contextID) {
        if (!this.bonusBaseCache) {
            this.bonusBaseCache = {};
        }

        var baseValue = this.bonusBaseCache[contextID];
        if (!_.isNumber(baseValue)) {

	        var context = this.contexts.get(contextID);
	        while (context) {
	        	var contextBaseValue = context.getNS('BaseValue', this.appID);
	        	if (contextBaseValue) {
	        		baseValue = parseInt(contextBaseValue) || 10;
	        		this.bonusBaseCache[contextID] = baseValue;
	        		break;
	        	}
	            context = this.contexts.get(context.getParentID());
	        }
        }

        return baseValue || 10;
    },

	renderValue: function(clusterController, newValue, allValues) {
        allValues = allValues || {};

        // FIXME: SUPER HACKY FOR NOW

        var bonusSurfaceViewID = clusterController.contextCollection.findWhere({'AttrID': 'Bonuses'}).id - 0,
            bonusSurfaceView = clusterController.surfaceViewCache[bonusSurfaceViewID],
            bonusClusterController;

        if (bonusSurfaceView) {
        	bonusClusterController = bonusSurfaceView.cluster;
        }
        else {
        	return;
        }

        // Calculate and display the point value
        var baseValue = this.getBonusBaseValue(clusterController.struct.Origin.viewID),
        	totalPoints = this.calcPoints(baseValue, allValues.Bonuses),
            numBonusPoints = totalPoints - baseValue,
            bonusText = numBonusPoints > 0 ? '+' + numBonusPoints : '';

        // FIXME: SUPER HACKY FOR NOW

        // Update the attribute cluster root
        var rootID = clusterController.contextCollection.rootID,
            rootSurfaceView = clusterController.surfaceViewCache[rootID];
        rootSurfaceView.$el.html('<br><br>' + rootSurfaceView.contextModel.get('Label') + '<br><br><span style="font-size: 2em">' + totalPoints + '</span>');

        // Update the bonus node surface
        var bonusSurfaceModeView = bonusSurfaceView.getModeView('View');
        bonusSurfaceModeView.$el.html('<br>' + bonusSurfaceView.contextModel.get('Label') + '<br><br><span style="font-size: 2em">' + bonusText + '</span>');

        if (bonusClusterController) {
            // Update the bonus cluster root
            var bonusClusterRootID = bonusClusterController.contextCollection.rootID,
                bonusRootSurfaceView = bonusClusterController.surfaceViewCache[bonusClusterRootID];

            bonusRootSurfaceView.$el.html('<br><br>' + bonusRootSurfaceView.contextModel.get('Label') + '<br><br><span style="font-size: 2em">' + bonusText + '</span>');
        }
    }
});

module.exports = BehaveApp;