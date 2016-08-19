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
    Backbone = require('backbone'),
    BackboneIndex = require('app/lib/backbone.index.js');

// -------------

var Association = Backbone.Model.extend({
    modelType: 'Association',
    idAttribute: 'ID',

    initialize: function() {
        this.set('ID', this.get('SourceID') + '|' + this.get('Name') + '|' + this.get('DestID'));
    },

    url: function() {
        return '/app/data/association/' + this.id;
    },

    getSourceModel: function() {
        var sourceID = this.get('SourceID');
        return this.collection.getContext(sourceID);
    },

    getDestModel: function() {
        var destID = this.get('DestID');
        return this.collection.getContext(destID);
    }
});

var Associations = Backbone.Collection.extend({
    model: Association,

    initialize: function(models, options) {
        options = options || {};
        this.G = this.G || options.G || require('app/Global')();
        this.contexts = options.contexts;
    },

    getContext: function(contextID) {
        return this.contexts.get(contextID);
    },

    // Returns the destination ID - the outV
    getContextAssoc: function(sourceContextID, assocName) {
        // This depends on the collection being indexed
        var sourceAssocs = this.where({
            'SourceID': sourceContextID,
            'Name': assocName
        });

        return _.map(sourceAssocs, function(a) {
            return a.get('DestID') - 0;
        });
    },

    // Returns the assoc model itself - the edge
    getContextAssoc2: function(sourceContextID, assocName) {
        return this.filter(function(a) {
                    return a.get('SourceID') == sourceContextID && a.get('Name') == assocName;
                });
    },

    setAssoc: function(assocName, sourceContextID, destContextID, options) {
        options = options || {};

        var currentAssoc = this.getContextAssoc2(sourceContextID, assocName)[0];
        if (currentAssoc) {
            // If it exists, update it
            currentAssoc.set('DestID', destContextID);
        }
        else {
            // Otherwise add it
            currentAssoc = this.addAssoc(assocName, sourceContextID, destContextID);
        }

        if (options.save) {
            currentAssoc.save();
        }

        return currentAssoc;
    },

    addAssoc: function(assocName, sourceContextID, destContextID, options) {
        options = options || {};

        var assoc = this.add({
            'Name': assocName,
            'SourceID': sourceContextID,
            'DestID': destContextID
        });

        if (options.save) {
            assoc.save();
        }

        return assoc;
    },

    removeAssoc: function(assocName, sourceContextID, destContextID) {
        var assocID = sourceContextID + '|' + assocName + '|' + destContextID;
        var assoc = this.get(assocID);
        if (assoc) {
            assoc.destroy();
        }
    }
});

BackboneIndex(Associations);

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

var Points = Backbone.Collection.extend({
    model: Point,
    idAttribute: 'ID',

    initialize: function(models, options) {
        options = options || {};
        this.G = this.G || options.G || require('app/Global')();
        this.rootID = options.rootID || null;
        this.contexts = options.contexts;
    },

    getContext: function(contextID) {
        return this.contexts.get(contextID);
    },

    getContextPoints: function(contextID, minAge) {
        if (!this.getContext(contextID)) {
            return [];
        }

        if (!minAge) {
            // First get all sub-contexts
            var contextIDs = {};

            var context = this.getContext(contextID);
            context && context.traverseDown(function(context) {
                contextIDs[context.id] = true;
            });

            return this.filter(function(p) {
                return p.get('ContextID') in contextIDs;
            });
        }
        else {
            return this.getRecentPoints(minAge, contextID);
        }
    },

    getRecentPoints: function(minAge, contextID) {
        minAge = minAge || 86400;
        contextID = contextID || this.rootID;

        var points = this;
        if (contextID && contextID != this.rootID) {
            points = new Points(this.getContextPoints(contextID), {contexts: this.contexts, G: this.G});
        }

        var refTime = this.G.getNow() / 1000,
            limit = refTime - minAge;

        return points.filter(function(p) {
            return p.get('Time') <= refTime && p.get('Time') >= limit && p.getContext();
        });
    }
});

var Context = Backbone.Model.extend({
    modelType: 'Context',
    idAttribute: 'ID',

    url: function() {
        return '/app/data/context/' + this.id;
    },

    initialize: function(attributes, options) {
        options = options || {};
        this.G = options.G || (this.collection && this.collection.G);

        _.bindAll(this, 'onPointChanged', 'stdDevIntervalFilter');

        if (!this.getNS('Timestamp')) {
            this.set('1__Timestamp', this.G.getNow() / 1000, {silent: true});
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

    getPoints: function(minAge) {
        minAge = minAge || 0;
        if (this.collection) {
            return this.collection.points.getContextPoints(this.id, minAge);
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
            newMetaData = this.calcContextScore();

        this.metaData.set(newMetaData);
        this.calcInteriorScore();

        return newMetaData.CurrentScore != lastScore;
    },

    calcContextScore: function(options) {
        options = options || {};
        anchorTime = options.anchorTime || this.G.getNow() / 1000;
        interval = options.interval || (86400 * 30);

        var includeAdjustment = true,
            points = this.getPoints(); // interval, anchorTime

        var sum = this.G.sum,
            stdDevFilter = this.stdDevIntervalFilter;

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
            targetInterval = this.get('TargetFrequency') || 0;

        // Simplify structure
        var pts = _.chain(points)
                        .map(function(p) {
                            return p.get('Time');
                        })
                        // FIXME: Removed until client and server time sync issues are resolved
                        /*// Remove points ahead of the anchor time (in case it is in the past)
                        .filter(function(t) {
                            return t <= anchorTime;
                        })*/
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
            recentInterval_5 = calcAvgInterval(_.first(pts, 5), anchorTime);
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
                scoreInterval = recentInterval_5;
            }

            timeSinceAdjusted = timeSince;
            if (includeAdjustment) {
                timeSinceAdjusted += adjustDelta;
            }

            score = Math.max(0, Math.min(1.0, 0.5 * (timeSinceAdjusted / scoreInterval)));
        }

        //console.log(this.getLabel(), this.id, score, pts);
        
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

    calcGraphFrequency: function(window, numSegments, options) {
        options = options || {};
        
        var sum = this.G.sum,
            _this = this;

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
    }
});

var ContextProperties = Backbone.Model.extend({
    modelType: 'ContextProperties',
    initialize: function() {}
});

var ContextMetaData = Backbone.Model.extend({
    modelType: 'ContextMetaData',
    initialize: function() {}
});

var Contexts = Backbone.Collection.extend({
    model: Context,

    initialize: function(models, options) {
        options = options || {};
        this.G = this.G || options.G || require('app/Global')();
        _.bindAll(this, 'contextAddedToParent', 'contextRemovedFromParent', 'contextChangedOnParent', 
                    'parentReset', 'contextAddedToChild', 'contextRemovedFromChild', 'hostsScore');

        this.parentCollection = options.parentCollection || this;
        this.rootID = options.rootID || null;
        this.newContextBumpTime = options.newContextBumpTime || 60 * 10; // 10 minutes

        this.points = options.points;
        this.associations = options.associations;

        if (this.points) {
            this.points.contexts = this;
        }
    },

    getRoot: function() {
        return this.get(this.rootID);
    },

    isChildOf: function(model, rootID) {
        rootID = rootID || this.rootID;
        if (!rootID) {
            return true;
        }

        var parentModel = model,
            isChild = false;

        while (parentModel) {
            if (parentModel.id == rootID) {
                isChild = true;
                break;
            }
            parentModel = this.get(parentModel.getAssoc('up')[0]);
        }

        return isChild;
    },

    collectionFromRoot: function(rootID) {
        rootID = rootID || this.rootID;

        var models = this.getFromRoot(rootID);
        var rootCollection = new Contexts(models, {
            parentCollection: this,
            associations: this.associations,
            points: this.points,
            rootID: rootID,
            G: this.G
        });
        rootCollection.get(rootID).isRoot = true;
        rootCollection.bindCollection(this);

        return rootCollection;
    },

    bindCollection: function(parentCollection) {
        parentCollection.on('add', this.contextAddedToParent);
        parentCollection.on('remove', this.contextRemovedFromParent);
        parentCollection.on('change', this.contextChangedOnParent);
        parentCollection.on('reset', this.parentReset);

        this.on('add', parentCollection.contextAddedToChild);
        this.on('remove', parentCollection.contextRemovedFromChild);
    },

    contextAddedToChild: function(model) {
        if (!this.get(model.id)) {
            this.add(model, {'silent': true});
        }
    },

    contextRemovedFromChild: function(model) {
        if (this.get(model.id)) {
            this.remove(model, {'silent': true});
        }
    },

    parentReset: function() {
        this.reset([]);
    },

    contextAddedToParent: function(model) {
        if (this.rootID && this.isChildOf(model, this.rootID)) {
            this.add(model);
        }
    },

    contextRemovedFromParent: function(model) {
        this.remove(model);
    },

    contextChangedOnParent: function(model) {
        if (this.rootID && this.isChildOf(model, this.rootID)) {
            this.trigger('change', model);
        }
    },

    getFromRoot: function(rootID, options) {
        options = options || {};

        var rootID = rootID || this.rootID,
            models = this.parentCollection.models;

        // Limit to specific root ID
        return this.parentCollection.filter(function(m, i) {
            return this.isChildOf(m, rootID)
        }, this);
    },

    getFinalStructure: function(focusID, filterValue, sortOrder) {
        return this.getStructure(focusID, null, filterValue, sortOrder);
    },

    getStructure: function(baseID, parentID, filterValue, sortOrder, result) {
        var result = result || {};

        if (baseID in result) {
            return result;
        }

        var neighbours = this.getNeighbours(baseID),
            transformedNeighbours = this.transform(neighbours, baseID, filterValue, sortOrder);

        result[baseID] = transformedNeighbours;

        _.each(transformedNeighbours, function(neighbourID) {
            if (neighbourID == parentID) {
                return;
            }

            this.getStructure(neighbourID, baseID, filterValue, sortOrder, result);
        }, this);

        return result;
    },

    getNeighbours: function(contextID) {
        var context = this.get(contextID);
        if (!context) {
            return [];
        }

        return context.getNeighbours();
    },

    transform: function(neighbours, baseID, filterValue, sortOrder) {
        var hS = this.hostsScore,
            filteredNeighbours = _.filter(neighbours, function(neighbourID) {
                return hS(neighbourID, filterValue);
            });

        return this.sortFunc(filteredNeighbours, baseID, sortOrder);
    },

    sortFunc: function(contextIDs, baseID, sortOrder) { 
        var childSortOrder = sortOrder[baseID] || {};
        var result = _.sortBy(contextIDs, function(contextID) {
            return childSortOrder[contextID] || 0;
        });

        return result;
    },

    hostsScore: function(contextID, filterValue) {
        var context = this.get(contextID);
        if (!context || !_.isNumber(context.getDistanceScore())) {
            return;
        }

        var downAssoc = context.getAssoc('down');
        if (context.getDistanceScore() >= filterValue && downAssoc.length == 0) {
            return true;
        }

        var hS = this.hostsScore;
        return _.find(downAssoc, function(neighbourID) {
            return hS(neighbourID, filterValue);
        });
    },

    traverseGraph: function(currentID, previousID, traverseState, result) {
        var currentContext = this.get(currentID),
            result = result || [];

        if (!currentContext) {
            return result;
        }

        var isFocus = !previousID,
            traverseState = traverseState || {
                'FocusDistance': 0,
                'FocusDescendant': false,
                'FocusID': currentID
            };

        var children = currentContext.getAssoc('down').slice(),
            parents = currentContext.getAssoc('up').slice(),
            neighbours = children.concat(parents),
            score = 0;

        if ((Date.now() / 1000) - currentContext.getNS('Timestamp') < this.newContextBumpTime) {
            score = 1.0;
        }
        else {
            score = currentContext.metaData.get('CurrentScore') || 0;
        }

        var scoreState = {
            'PrevID': previousID,
            'Children': children,
            'Parents': parents,
            'Neighbours': neighbours,

            'IsImportant': false,
            'IsIdea': false,
            'IsInitial': false,
            'Score': score,

            'FocusDistance': traverseState.FocusDistance
        };

        var sum = this.G.sum;

        function computeScore(state) {
            var scores = {
                Importance: state.IsImportant ? 1 : 0,
                Score: state.Score
            }

            var score = sum(_.values(scores));

            if (state.FocusDistance) {
                return score / state.FocusDistance;
            }

            return score;
        }

        var distanceScore = computeScore(scoreState);
        result.push(currentContext);
        currentContext.setDistanceScore(distanceScore);
        
        traverseState = _.extend({}, traverseState);
        traverseState.FocusDistance += 1;

        _.each(neighbours, function(neighbourID) {
            if (neighbourID == previousID) {
                return;
            }

            var nextContext = this.get(neighbourID);
            if (!nextContext) {
                //console.log(('Neighbour not in contexts: ' + neighbourID));
                return;
            }
            this.traverseGraph(neighbourID, currentID, traverseState, result);
        }, this);

        if (isFocus) {
            this.G.trigger('ClusterScoresUpdated', this);
        }

        return result;
    },

    updateScores: function() {
        this.each(function(context) {
            context.updateScore();
        });
    },

    getBaseContext: function(contextID) {
        var context = this.get(contextID),
            baseContextID = contextID,
            parentID;

        while (context) {
            parentID = context.getParentID();

            if (parentID == this.rootID) {
                baseContextID = context.id;
                break;
            }

            context = this.get(parentID);
        }

        return baseContextID;
    },

    getAssociation: function(assocName, sourceContextID, destContextID) {
        if (!this.associations) {
            return null;
        }
        var assocID = assocName;
        if (sourceContextID && destContextID) {
            assocID = sourceContextID + '|' + assocName + '|' + destContextID;
        }
        return this.associations.get(assocID);
    },

    addAssoc: function(assocName, sourceContextID, destContextID, options) {
        return this.associations.addAssoc(assocName, sourceContextID, destContextID, options);
    },

    removeAssoc: function(assocName, sourceContextID, destContextID) {
        return this.associations.removeAssoc(assocName, sourceContextID, destContextID);
    },

    getContextPoints: function(contextID, minAge) {
        return this.points.getContextPoints(contextID, minAge);
    }
});

module.exports = {
    'Context': Context,
    'Contexts': Contexts,
    'Point': Point,
    'Points': Points,
    'Association': Association,
    'Associations': Associations
}
