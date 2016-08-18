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
var _ = require('backbone/node_modules/underscore');

// -------------

var streamToFrequencyTarget = require('app/modules/Functions/StreamToFrequencyTarget'),
    calcPeriod = require('app/modules/Functions/CalcTimelinePeriod_WeightedInterval_StdDev'),
    sumArrays = require('app/modules/Util/SumArrays');

function computeClusterGraphs(rootContext, graphWindow, numSegments, anchorTime, force) {
    anchorTime = anchorTime || Date.now() / 1000;

    if (!rootContext) {
        console.log('computeClusterGraphs: missing rootContext')
        return;
    }

    if (force) {
        rootContext.collection.each(function(context) {
            context.graphData = null;
            context.aggregateGraphData = null;
        });
    }

    // Calculate graph data and target interval for each leaf context
    // This is so the data can be easily aggregated
    // FIXME: Should be done elsewhere and invalidated appropriately
    rootContext.collection.each(function(context) {
        if (!context.isLeaf() || context.graphData) {
            return;
        }

        var pointTimes = _.map(context.getPoints(), function(point) {
            return point.get('Time');
        });

        var targetInterval = context.getNS('TargetFrequency') || calcPeriod(pointTimes);
        if (!targetInterval) {
            return;
        }

        context.graphData = streamToFrequencyTarget(pointTimes, graphWindow, numSegments, {
            targetInterval: targetInterval,
            anchorTime: anchorTime
        });
    });

    function aggregateLayerData(context) {
        context.traverseDown(function(context, traverseDepth, state) {
            if (context.aggregateGraphData) {
                return;
            }
            if (context.isLeaf()) {
                context.aggregateGraphData = context.graphData;
                return;
            }

            var aggregateGraphData = [],
                downAssocContexts = context.getAssocModels('down');

            _.each(downAssocContexts, function(assocContext) {
                if (!assocContext.aggregateGraphData) {
                    aggregateLayerData(assocContext);
                }
                if (assocContext.aggregateGraphData) {
                    aggregateGraphData.push(assocContext.aggregateGraphData)
                }
            });

            context.aggregateGraphData = _.map(sumArrays(aggregateGraphData), function(val) {
                return val / aggregateGraphData.length;
            });
        });
    }

    aggregateLayerData(rootContext);
}

module.exports = computeClusterGraphs;