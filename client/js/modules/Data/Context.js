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
var _ = require('underscore'),
    Backbone = require('backbone');

// -------------

var sum = require('app/modules/Util/Sum.js'),
    getNow = require('app/modules/Util/GetNow.js');

// -------------

var ContextProperties = Backbone.Model.extend({
    modelType: 'ContextProperties',
    initialize: function() {}
});

var ContextMetaData = Backbone.Model.extend({
    modelType: 'ContextMetaData',
    initialize: function() {}
});

var Context = Backbone.Model.extend({
    modelType: 'Context',
    idAttribute: 'ID',

    url: function() {
        return '/app/data/context/' + this.id;
    },

    initialize: function(attributes, options) {
        options = options || {};
        _.bindAll(this, 'onPointChanged', 'stdDevIntervalFilter');

        if (!this.getNS('Timestamp')) {
            this.set('1__Timestamp', getNow() / 1000, {silent: true});
        }

        this.properties = new ContextProperties(this.getLocal('Properties') || {});
        this.metaData = new ContextMetaData(this.getLocal('MetaData') || {});

        this.linkID = null;
        this.linkModel = null;

        this.on('PointChanged', this.onPointChanged);
        this.on('change:1__AdjustDelta', this.onPointChanged);
    },

    getColor: function(fresh, baseLightnessAdjust) {
        if (this.collection && this.collection.clusterController) {
            return this.collection.clusterController.cluster.getColor(this.id, fresh, baseLightnessAdjust);
        }
    },

    traverseDown: function(cb, state, depth) {
        state = state || {};
        depth = depth || 1;

        cb(this, depth, state);
        _.each(this.getAssocModels('down'), function(childContext) {
            childContext.traverseDown(cb, state, depth + 1);
        }, this);
    },

    getNS: function(name, namespaceID) {
        namespaceID = namespaceID || 1;
        var key = namespaceID + '__' + name;
        return Backbone.Model.prototype.get.call(this, key);
    },

    onPointChanged: function(point) {
        var scoreChanged = this.updateScore();
        if (scoreChanged) {
            this.set('PointChanged', new Date().getTime());
        }
    },

    parse: function(response, x, y) {
        if (this.properties) {
            this.properties.set(response.Properties);
        }
        else {
            this.properties = new ContextProperties(response.Properties || {});
        }

        if (this.metaData) {
            this.metaData.set(response.MetaData);
        }
        else {
            this.metaData = new ContextMetaData(response.MetaData || {});
        }

        return response;
    },

    toJSON: function(options) {
        var attributes = _.clone(this.attributes);

        delete attributes.MetaData;
        delete attributes.Points;

        attributes.Properties = this.properties.toJSON();

        return attributes;
    },

    getLabel: function() {
        return this.getNS('Label');
    },

    getPoints: function(minAge, refTime) {
        minAge = minAge || 0;
        if (this.collection) {
            return this.collection.points.getContextPoints(this.id, minAge, refTime);
        }
    },

    isLink: function() {
        var label = this.getLocalNS('Label') || '';
        label += '';
        return label.indexOf('link-') == 0;
    },

    isLeaf: function() {
        return this.getAssoc('down').length == 0;
    },

    hasChild: function(contextID) {
        return _.indexOf(this.getAssoc('down'), contextID) != -1;
    },

    getLinkID: function() {
        var label = this.getLocalNS('Label') || '';
        label += '';
        return label.substring(5);
    },

    initLink: function() {
        if (this.linkID) {
            return;
        }

        if (this.isLink()) {
            this.linkID = this.getLinkID();
            this.linkModel = this.collection.get(this.linkID);
        }
    },

    get: function(attrName) {
        var val = null;
        this.initLink();

        if (this.linkModel) {
            val = this.linkModel.get(attrName);
        }
        else {
            val = this.getLocal(attrName);
        }
        return val;
    },

    getLocal: function(attrName) {
        return Backbone.Model.prototype.get.apply(this, arguments);
    },

    getLocalNS: function(attrName, namespaceID) {
        namespaceID = namespaceID || 1;
        var key = namespaceID + '__' + attrName;
        return Backbone.Model.prototype.get.call(this, key);
    },

    set: function(attrs, options) {
        this.initLink();

        if (this.linkModel) {
            return this.linkModel.set(attrs);
        }
        else {
            return Backbone.Model.prototype.set.apply(this, arguments);
        }
    },

    setParent: function(parentID) {
        this.collection && this.collection.associations.setAssoc('up', this.id, parentID);
    },

    getParentID: function() {
        if (this.isRoot) {
            return null;
        }
        return this.getAssoc('up')[0];
    },

    getParent: function() {
        return this.collection && this.collection.get(this.getParentID());
    },

    getDepth: function() {
        var depth = 1,
            parent = this.getParent();

        while (parent) {
            parent = parent.getParent();
            depth += 1;
        }

        return depth;
    },

    toDepth: function(targetDepth, baseDepth) {
        // If baseDepth is provided, targetDepth becomes relative
        var currentDepth = this.getDepth();
        if (baseDepth) {
            targetDepth += baseDepth;
        }

        if (targetDepth == 0 || currentDepth <= targetDepth) {
            return this;
        }

        var nextContext = this;
        while (currentDepth > targetDepth) {
            nextContext = nextContext.getParent();
            currentDepth -= 1;
        }

        return nextContext;
    },

    getAssoc: function(assocName) {
        if (this.collection) {
            return this.collection.associations.getContextAssoc(this.id, assocName);
        }
        return [];
    },

    getAssocModels: function(assocName) {
        var _this = this;
        return _.compact(_.map(this.getAssoc(assocName), function(contextID) {
            return _this.collection.get(contextID);
        }));
    },

    getNeighbours: function() {
        return this.getAssoc('up').concat(this.getAssoc('down'));
    },

    getNeighbourModels: function() {
        return this.getAssocModels('up').concat(this.getAssocModels('down'));
    },

    hasNeighbour: function(neighbourID) {
        return _.contains(this.getNeighbours(), neighbourID);
    },

    setDistanceScore: function(distanceScore) {
        this.initLink();
        if (this.linkModel) {
            this.linkModel.distanceScore = distanceScore;
        }
        else {
            this.distanceScore = distanceScore;
        }
    },

    getDistanceScore: function() {
        this.initLink();
        if (this.linkModel) {
            return this.linkModel.distanceScore;
        }
        else {
            return this.distanceScore;
        }
    },

    updateScore: function(anchorTime) {
        var lastScore = this.metaData.get('CurrentScore'),
            newMetaData = this.calcContextScore({
                anchorTime: anchorTime
            });

        this.metaData.set(newMetaData);
        this.calcInteriorScore();

        return newMetaData.CurrentScore != lastScore;
    },

    stdDevIntervalFilter: function(intervals) {
        var sum = this.G.sum;
        
        // minimum 2
        function pstdev(data) {
            return Math.pow(_ss(data) / data.length, 0.5);
        }

        function _ss(data) {
            var c = mean(data);
            return sum(_.map(data, function(x) { return Math.pow((x - c), 2); }));
        }

        // minimum 1
        function mean(data) {
            return sum(data) / data.length;
        }

        // Filter out intervals over 1 stdev from the mean
        var avg = mean(intervals),
            stdev = parseInt(pstdev(intervals)),
            filteredIntervals = _.filter(intervals, function(x) {
                return x < avg + stdev;
            });

        return filteredIntervals;
    },

    calcContextScore: function(options) {
        options = options || {};
        anchorTime = options.anchorTime || getNow() / 1000;
        //interval = options.interval || (86400 * 30);

        var includeAdjustment = true,
            points = this.getPoints(0, null, anchorTime);

        var stdDevFilter = this.stdDevIntervalFilter;

        function calcAvgInterval(pts, anchorTime) {
            // pts sorted high to low
            var intervals = [],
                lastTime = null; //anchorTime;

            _.each(pts, function(pointTime) {
                if (_.isNull(lastTime)) {
                    lastTime = pointTime;
                    return;
                }
                intervals.push(lastTime - pointTime);
                lastTime = pointTime;
            });

            var filteredIntervals = stdDevFilter(intervals);
            return sum(filteredIntervals) / filteredIntervals.length;
        }

        var timeSince = null,
            timeSinceAdjusted = null,
            score = null,
            recentInterval_5 = null,
            recentInterval_10 = null,
            adjustDelta = this.getNS('AdjustDelta') || 0,
            targetInterval = this.getNS('TargetFrequency') || 0;

        // Simplify structure
        var pts = _.chain(points)
                        .map(function(p) {
                            return p.get('Time');
                        })
                        // FIXME: Causes problems if client and server times are not properly sync'd
                        // Remove points ahead of the anchor time (in case it is in the past or points are in the future)
                        .filter(function(t) {
                            return t <= anchorTime;
                        })
                        // Now largest (newest) to smallest (oldest)
                        .sortBy(function(t) {
                            return -t
                        })
                        .first(10)
                    .value();

        if (pts.length) {
            timeSince = anchorTime - pts[0];
            timeSinceAdjusted = timeSince;
        }

        if (pts.length > 1) {
            //recentInterval_10 = calcAvgInterval(_.first(pts, 10), anchorTime);

            /*
            Linear proportion between time since last action and recent average interval
            Clamped to between 0.0 and 1.0 for now to keep it simple
            0 = just done
            0.5 = do soon
            1.0 = way overdue
            */

            if (targetInterval) {
                scoreInterval = targetInterval;
            }
            else {
                recentInterval_5 = calcAvgInterval(_.first(pts, 5), anchorTime);
                scoreInterval = recentInterval_5;
            }

            timeSinceAdjusted = timeSince;
            if (includeAdjustment) {
                timeSinceAdjusted += adjustDelta;
            }

            score = Math.max(0, Math.min(1.0, 0.5 * (timeSinceAdjusted / scoreInterval)));
        }

        return {
            'TimeSince': timeSince,
            'TimeSinceAdjusted': timeSinceAdjusted,
            'CurrentScore': score,
            'RecentInterval_5': recentInterval_5,
            'RecentInterval_10': recentInterval_10,
            'Weight': 1.0,
        }
    },

    calcInteriorScore: function(noTraverse) {
        if (this.isLeaf()) {
            var parentModel = this.getParent();
            parentModel && parentModel.calcInteriorScore();
            return;
        }

        var childContexts = _.compact(this.getAssocModels('down'));
        if (!childContexts || !childContexts.length) {
            return;
        }
            
        var totalScore = 0,
            numScores = 0,
            currentScore = 0,
            lastScore;

        _.each(childContexts, function(context) {
            var childScore = context.metaData.get('CurrentScore');
            if (!_.isNumber(childScore)) {
                return;
            }

            totalScore += childScore;
            numScores += 1;
        });

        lastScore = this.metaData.get('CurrentScore');
        if (numScores > 0) {
            currentScore = totalScore / numScores;
        }

        if (currentScore != lastScore) {
            this.metaData.set('CurrentScore', currentScore);

            if (!noTraverse) {
                var parent = this.getParent();
                if (parent) {
                    parent.calcInteriorScore();
                }
            }
        }
    },

    stdDevIntervalFilter: function(intervals) {
        // minimum 2
        function pstdev(data) {
            return Math.pow(_ss(data) / data.length, 0.5);
        }

        function _ss(data) {
            var c = mean(data);
            return sum(_.map(data, function(x) { return Math.pow((x - c), 2); }));
        }

        // minimum 1
        function mean(data) {
            return sum(data) / data.length;
        }

        // Filter out intervals over 1 stdev from the mean
        var avg = mean(intervals),
            stdev = parseInt(pstdev(intervals)),
            filteredIntervals = _.filter(intervals, function(x) {
                return x < avg + stdev;
            });

        return filteredIntervals;
    },

    /*calcGraphFrequency: function(window, numSegments, options) {
        options = options || {};
        
        var _this = this;

        function getIntervals(points, anchorTime) {
            // points sorted high to low
            var intervals = [],
                lastTime = anchorTime;

            _.each(points, function(pointTime) {
                intervals.push(lastTime - pointTime);
                lastTime = pointTime;   
            });
                
            return intervals
        }

        function calcTargetInterval(points, anchorTime) {
            var intervals = getIntervals(_.first(points, 20), anchorTime);
            var filteredIntervals = _this.stdDevIntervalFilter(intervals);
            var avgInterval = sum(filteredIntervals) / filteredIntervals.length;
            return avgInterval;
        }

        function initArray(size, value) {
            var arr = [];
            while (size--) {
                arr.push(value);
            }
            return arr;
        }

        function computeFrequency(points, targetInterval, anchorTime, window, numSegments, options) {
            options = options || {};
            var increment = window / numSegments,
                maxScore = 100,
                segments = initArray(numSegments, 0);

            if (points.length <= 1) {
                if (options.includeEmpty) {
                    return segments;
                }
                return null;
            }

            _.each(points, function(pointTime) {
                // Now cascade the scores.
                // Scores from older points get overridden by scores from newer points.
                var segmentIdx = parseInt(Math.ceil((anchorTime - pointTime) / increment));
                if (segmentIdx >= numSegments) {
                    console.log('SegmentIdx too large: ' + segmentIdx);
                    return;
                }

                var score = maxScore;
                while (segmentIdx >= 0 && score >= 0) {
                    var segmentAge = anchorTime - (segmentIdx * increment) - pointTime;

                    if (!options.decreaseImmed) {
                        segmentAge -= targetInterval;
                    }

                    score = Math.max(0, targetInterval - segmentAge) / targetInterval;
                    score = Math.min(maxScore, Math.round(score * maxScore));

                    if (score >= 0 && score >= segments[segmentIdx]) {
                        segments[segmentIdx] = score;
                    }

                    segmentIdx -= 1;
                }
            });

            return segments;
        }

        numSegments = numSegments || 100;
        anchorTime = options.anchorTime || Date.now() / 1000;
        window = window || 86400 * 14;

        var points = _.map(this.getPoints(window), function(point) {
            return parseInt(point.get('1__Time'));
        });
        points.sort();

        var targetInterval = options.targetInterval || calcTargetInterval(points.slice().reverse(), anchorTime);
        return computeFrequency(points, targetInterval, anchorTime, window, numSegments, {
            decreaseImmed: !!options.decreaseImmed,
            includeEmpty: !!options.includeEmpty
        });
    }*/
});

module.exports = Context;