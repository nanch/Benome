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
var _ = require('backbone/node_modules/underscore'),
    Backbone = require('backbone');

// -------------

var Context = require('app/modules/Data/Context.js'),
    sum = require('app/modules/Util/Sum.js');

var Contexts = Backbone.Collection.extend({
    model: Context,

    initialize: function(models, options) {
        options = options || {};
        _.bindAll(this, 'contextAddedToParent', 'contextRemovedFromParent', 'contextChangedOnParent', 
                    'parentReset', 'contextAddedToChild', 'contextRemovedFromChild', 'hostsScore');

        this.parentCollection = options.parentCollection || this;
        this.rootID = options.rootID || null;
        this.newContextBumpTime = _.isNumber(options.newContextBumpTime) ? options.newContextBumpTime : 60 * 10; // 10 minutes

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
            rootID: rootID
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
            this.trigger('ClusterScoresUpdated', this);
        }

        return result;
    },

    updateScores: function(anchorTime) {
        this.each(function(context) {
            context.updateScore(anchorTime);
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
    },

    export: function(noJSON) {
        var contextCollection = this;

        // Yes, there is contextCollection.toJSON, but there's likely to be attribute cleanup later on
        var contexts = contextCollection.map(function(contextModel) {
                return contextModel.toJSON();
            }),
            associations = contextCollection.associations.map(function(associationModel) {
                return associationModel.toJSON();
            }),
            points = contextCollection.points.map(function(pointModel) {
                return pointModel.toJSON();
            });

        var exportStruct = {
            'RootID': contextCollection.rootID,
            'Contexts': contexts,
            'Associations': associations,
            'Points': points
        }

        if (!noJSON) {
            return JSON.stringify(exportStruct, null, 4);
        }
        else {
            return exportStruct;
        }
    }
});

module.exports = Contexts;