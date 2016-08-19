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
    _ = require('underscore');

var ActivityIntervalView = require('app/views/ActivityIntervalView');

var ActivityPath = function ActivityPath(options) {
    options = options || {};
    this.G = this.G || options.G || require('app/Global')();

    _.bindAll(this, 'render', 'extendActivity', 'refresh', 'pointChanged', 'pointRemoved');

    this.dragHandler = options.dragHandler || null;

    this.setPointsCollection(options.points);
    this.visible = !!options.visible;
    this.$el = this.$container = options.el || null;
    this.$el.addClass('activity-path-container');

    this.minimumDuration = options.minimumDuration || 2;
    this.refreshInterval = options.refreshInterval || 3.0;
    this.displayInterval = options.displayInterval || (3 * 60); // last 30 min

    this.debug = true;

    var _this = this;

    this.G.on('PointAdded', this.render);
    this.G.on('BeforeFocusChanged', function(cluster, contextID) {
        if (cluster.clusterID != _this.clusterController.cluster.clusterID) {
            return;
        }

        _this.extendActivity(contextID);
    });
    
    this.G.on('FocusAction', function(contextID, cluster) {
        if (cluster.clusterID != _this.clusterController.cluster.clusterID) {
            return;
        }
        _this.extendActivity(contextID);
    });

    this.G.on('GlobalClusterRendered', function(globalCluster) {
       _this.extendActivity(globalCluster.cluster.focusID, true, true);
   }); 

    _.delay(this.refresh, this.refreshInterval * 1000);
}
_.extend(ActivityPath.prototype, {
    refresh: function() {
        if (this.visible) {
            this.render();
        }

        _.delay(this.refresh, this.refreshInterval * 1000);
    },

    setPointsCollection: function(pointsCollection) {
        if (pointsCollection) {
            this.points = pointsCollection;
            this.rootContextID = this.points.contexts.rootID;

            this.HM = new HistoryManager(this.G, this.points, this.clusterController, this.rootContextID, this.minimumDuration, this.debug);

            this.HM.on('PointAdded', this.render);
            this.points.on('change', this.pointChanged);
            this.points.on('remove', this.pointRemoved);
            this.render();
        }
    },

    pointChanged: function(point) {
        this.HM.updateActivity(point);
        this.render();
    },

    pointRemoved: function(point) {
        this.HM.removeActivityByPointID(point.id);
        this.render();
    },

    extendActivity: function(contextID, isOpen, continueSame) {
        isOpen = isOpen || true;

        var now = Date.now() / 1000,
            pointID = pointID || this.G.nextID();

        this.HM.addRaw(contextID, pointID, {
            isOpen: !!isOpen,
            continueSame: continueSame
        });
    },

    render: function() {
        /*
        Principles:

        There's no value in auto-displaying casual navigation
            Though there's value in tracking it as meta-activity
                organizational, analytical, or observational time

        There's little value in showing lineage details for quick actions
            not worth the space or the visual complexity

        With actual activity, there may be enough vertical space to put ancestor labels
            May be oriented horizontally if there was general time spend
            Otherwise oriented vertically in the margin if the interior time is long enough
                biasing toward near-action contexts, as that's the most informative
        */

        this.$container
            .empty();

        if (!this.HM || !this.points || !this.clusterController) {
            return;
        }

        this.HM.refresh();

        var _this = this,
            G = this.G,
            $base = this.$container,
            displayInterval = this.displayInterval,
            availHeight = G.globalSize().height, //$base.height(),
            pixelsPerSecond = availHeight / displayInterval,
            totalHeight = 0,
            topAdjust = 0;

        var fontSize = this.G.fontSize,
            depth = 1,
            baseZIndex = 10000,
            contexts = this.points.contexts,
            cluster = this.clusterController.cluster,
            singularPoints = this.points.filter(function(point) {
                return !point.get('Duration') && !point.get('Open')
            });

        this.activityIntervalViews = [];

        _.each(this.HM.continuousHistory.slice().reverse(), function(activity, i, history) {
            var contextID = activity.ContextID,
                context = contexts.get(contextID);

            if (!context) {
                //console.log('Missing context', contextID);
                return;
            }

            var unit = fontSize / 10,
                secondsPerUnit = 2,
                begin = activity.Timestamp,
                end = activity.Timestamp + (activity.Duration || 0),
                duration = activity.Duration,
                currentWidth = 6 * fontSize,
                minWidth = currentWidth,
                childHeight = 0,
                minHeight = fontSize * 1.1,
                depth = context ? context.getDepth() : 1,
                label = context ? context.getNS('Label') : contextID,
                currentHeight,
                top = totalHeight,
                timeSinceLast = 0,
                topDistance,
                age = ((Date.now() / 1000) - end),
                ageTop = age * pixelsPerSecond;

            // Fill in 
            if (i == 0) {
                if (activity.Continuous && !duration) {
                    duration = 0;
                }
            }
            /*else {
                // Get the most recent previous activity that isn't interpolated
                var j = i + 1,  // list is newest to oldest
                    prevActivity = history[j];
                while (prevActivity && prevActivity.Interpolated && j < history.length - 1) {
                    prevActivity = history[j++];
                }

                if (prevActivity) {
                    timeSinceLast = begin - (prevActivity.Timestamp + (prevActivity.Duration || 0));
                }
            }

            topDistance = timeSinceLast * pixelsPerSecond;
            top += topDistance;*/

            // No need to add items outside of the viewport
            if (top > availHeight) {
                return;
            }

            var intervalSingularPoints = _.chain(singularPoints)
                                            .filter(function(point) {
                                                var t = point.get('Time');
                                                return t >= begin && t <= end;
                                            })
                                            .sortBy(function(point) {
                                                return -point.get('Time');
                                            })
                                        .value();

            var singularPointsHeight = intervalSingularPoints.length * minHeight;
            var adjustedMinHeight = minHeight * (activity.Interpolated ? 0.2 : 1.0);
            var activityHeight = Math.max(adjustedMinHeight, (duration * pixelsPerSecond) || 0) + singularPointsHeight;
            totalHeight += activityHeight;

            // Limit height to maximum available
            currentHeight = Math.min(availHeight + singularPointsHeight, activityHeight);
            currentWidth += ((depth - 1) * 12);

            var _this = this;

            function addBox(point, context, depth, height, top, nonDeletable) {
                var backgroundColor = cluster.getColor(context.id, null, 0.2 * (depth / 10)),
                    textColor = G.getTextContrastColor(backgroundColor);

                /*var $box = $('<div>')
                                .addClass('test-action')
                                .addClass('test-action-' + 'right')
                                .css(css)
                                .appendTo(_this.$container);*/

                /*if (context) {
                    var $label = $('<div>')
                                    .addClass('label')
                                    .text(context.getNS('Label'))
                                    .appendTo($box);
                }*/

                var activityIntervalView = new ActivityIntervalView({
                                                    G: _this.G,
                                                    model: point,
                                                    hideLabel: _this.hideLabels,
                                                    clusterController: _this.clusterController,
                                                    dragHandler: _this.dragHandler,
                                                    nonDeletable: nonDeletable
                                                    /*dropHandler: _this.activityDropHandler*/
                                                });
                _this.activityIntervalViews.push(activityIntervalView);
                var $aiEl = activityIntervalView.render().$el;
                $aiEl
                    .css({
                        'background-color': backgroundColor,
                        'color': textColor,
                        'z-index': baseZIndex + ((depth * 20) - i),
                        'height': height,
                        'width': currentWidth,
                        'top': top
                    })
                    .addClass('activity-interval-view-right');
                _this.$container.append($aiEl);
            }

            var point = this.points.get(activity.PointID);
            addBox(point, context, depth, currentHeight, top, activity.Open);

            var singularRange = currentHeight - minHeight,
                singularBottom = top + currentHeight - minHeight;

            _.each(intervalSingularPoints, function(point, i) {
                // Get the position within the active interval
                var timeAfter = point.get('Time') - begin,
                    propTime = timeAfter / duration,
                    sPosition = (propTime * singularRange) - (i * minHeight);

                addBox(point, point.getContext(), depth, minHeight, singularBottom - sPosition);
            });
        }, this);
    },

    toggleVisible: function(force, quick) {
        if (!this.visible || force === true) {
            this.show(!quick);
        }
        else if (this.visible || force === false) {
            this.hide(!quick);
        }
    },

    hide: function(anim) {
        this.visible = false;
        if (!anim) {
            this.$el.hide();
        }
        else {
            this.$el
                .animate({
                        'opacity': 0
                    }, {
                        duration: 150,
                        complete: function() {
                            $(this).hide();
                        }
                    });
        }

    },

    show: function(anim) {
        this.visible = true;
        if (!anim) {
            this.$el
                .css({
                        opacity: 1
                    })
                .show()
        }
        else {
            this.$el
                .css({
                    opacity: 0
                })
                .show()
                .animate({
                    'opacity': 1
                }, {duration: 300});
        }
    }
});

var HistoryManager = function(G, points, clusterController, rootContextID, minimumDuration, debug) {
    this.G = G;
    this.points = points;
    this.clusterController = clusterController;
    this.rootContextID = rootContextID;
    this.actionIdx = {};
    this.lastActionID = 0;
    this.minimumDuration = minimumDuration || 0;
    this.debug = debug;

    // Complete unfiltered activity
    this.rawHistory = [];

    // Complete filtered activity
    this.recordedHistory = this.points.chain()
                                    .filter(function(point) {
                                        return point.get('Duration') > 0 || point.get('Open');
                                    })
                                    .map(function(point) {
                                        return this.createAction(point.get('ContextID'), point.id, {
                                            'timeStamp': point.get('Time'),
                                            'duration': point.get('Duration'),
                                            'isOpen': point.get('Open')
                                        });
                                    }, this)
                                    .sortBy(function(activity) { return activity.Timestamp; })
                                .value();

    this.openActivity = this.getLastOpen(this.recordedHistory);
    if (this.openActivity) {
        if (this.debug) {
            console.log('Last activity', this.openActivity.PointID, this.openActivity);
            console.log('Extending duration of open last activity', this.openActivity);
        }
        this.openActivity.Duration = (Date.now() / 1000) - this.openActivity.Timestamp;
    }
    else {
        if (this.debug) {
            console.log('No open activity')
        }
    }

    this.generateContinuous();
}
_.extend(HistoryManager.prototype, {
    getLastOpen: function(activityList) {
        var lastOpenIndex = _.findLastIndex(activityList, {
            'Open': true
        });

        if (lastOpenIndex >= 0) {
            return activityList[lastOpenIndex];
        }
    },

    addRaw: function(contextID, pointID, options) {
        if (this.openActivity && options.continueSame && contextID == this.openActivity.ContextID) {
            return;
        }

        var newAction = this.createAction(contextID, pointID, options);
        this.rawHistory.push(newAction);

        if (this.recordedHistory.length == 0) {
            this.recordedHistory.push(newAction);
        }

        this.updateContinuous(newAction);
        return newAction;
    },

    updateContinuous: function(newAction) {
        var prevAction = this.openActivity,
            clusterID = this.clusterController.cluster.clusterID,
            actionRecorded = false;

        if (this.openActivity && this.rawHistory.length) {
            var timeSinceLast = (Date.now() / 1000) - _.last(this.rawHistory).Timestamp;

            // Close the open activity
            if (timeSinceLast >= this.minimumDuration) {
                actionRecorded = true;
                this.closeOpenActivity();
            }
            else {
                this.lastRandNum = Math.round(Math.random() * 1000000);

                var interval = (this.minimumDuration - timeSinceLast) * 1000;
                _.delay(_.bind(this.delayedCloseActivity, this), interval, newAction, this.lastRandNum);
            }
        }

        if (actionRecorded || !this.openActivity) {
            this.saveActivity(newAction);
        }
    },

    delayedCloseActivity: function(newAction, randNum) {
        if (randNum != this.lastRandNum) {
            console.log('Cancel delayed activity close')
            return;
        }

        this.closeOpenActivity();
        this.saveActivity(newAction);
    },

    closeOpenActivity: function() {
        var duration = (Date.now() / 1000) - this.openActivity.Timestamp;
        this.openActivity.Open = false;
        this.openActivity.Duration = duration;

        // Persist the change
        var point = this.points.get(this.openActivity.PointID);
        if (point) {
            if (this.debug) {
                console.log('Closing point ' + point.id + ' with duration ' + duration);
            }
            var updatedAttributes = {
                'Timing': {
                    'Duration': duration
                },
                'Open': false
            }

            var clusterID = this.clusterController.cluster.clusterID;
            this.G.trigger('UpdatePoint', clusterID, point, updatedAttributes);
        }
    },

    saveActivity: function(newAction) {
        if (this.debug) {
            console.log('Opening point (? ' + newAction.PointID + ') with duration ' + newAction.duration);
        }

        var successCallback = _.bind(function(success, point) {
            if (success) {
                if (this.debug) {
                    console.log('Successfully added point prev=' + newAction.PointID, ' curr=' + point.id, point.attributes);
                }
                newAction.PointID = point.id;

                // Set the new action to the open action
                this.openActivity = newAction;
                this.extendContinuous(newAction);

                this.trigger('PointAdded', point);
            }
        }, this);

        // Add the new action
        var clusterID = this.clusterController.cluster.clusterID;
        this.G.trigger('AddPoint', newAction.ContextID, clusterID, {
            'UpdatedAttributes': {
                'Timing': {
                    'Time': newAction.Timestamp,
                    'Duration': newAction.Duration,
                },
                'Text': '',
                'Open': newAction.Open
            }
        }, successCallback, {options: { 'ActivityPathAdd': true }});
    },

    // Updates the duration of the open activity
    refresh: function() {
        if (this.openActivity) {
            var duration = (Date.now() / 1000) - this.openActivity.Timestamp;
            this.openActivity.Duration = duration;
        }
    },

    extendContinuous: function(prevAction) {
        var prevContinuousAction = _.last(this.continuousHistory);
        var interpolatedHistory = this.interpolateActivity(prevAction, prevContinuousAction);
        this.continuousHistory = this.continuousHistory.concat(interpolatedHistory);
    },

    interpolateActivity: function(activity, prevActivity) {
        var result = [];

        var contextID = activity.ContextID,
            prevContextID = prevActivity ? prevActivity.ContextID : this.rootContextID;

        // Get the lineage of both contexts
        var currentLineage = this.getLineage(contextID),
            prevLineage = this.getLineage(prevContextID),

            commonLineage = _.intersection(currentLineage, prevLineage),
            commonAncestor = _.last(commonLineage),

            prevExtension = _.difference(prevLineage, commonLineage),
            currentExtension = _.difference(currentLineage, commonLineage),

            distance;

        //distance = currentLineage.length - prevLineage.length,

        _.each(_.initial(prevExtension).reverse(), function(contextID, i) {
            var a = this.createAction(contextID, false, {
                'timeStamp': activity.Timestamp,
                'duration': 0,
                'isInterpolated': true
            });
            result.push(a);
        }, this);

        if (commonAncestor != contextID && commonAncestor != prevContextID) {
            var a = this.createAction(commonAncestor, false, {
                'timeStamp': activity.Timestamp,
                'duration': 0,
                'isInterpolated': true
            });
            result.push(a);
        }

        _.each(_.initial(currentExtension), function(contextID, i) {
            var a = this.createAction(contextID, false, {
                'timeStamp': activity.Timestamp,
                'duration': 0,
                'isInterpolated': true
            });
            result.push(a);
        }, this);

        result.push(activity);
        return result;
    },

    // Root context ends up being first
    getLineage: function(contextID) {
        var lineage = [];
        var context = this.points.contexts.get(contextID);
        while (context) {
            lineage.unshift(context.id);
            context = context.getParent();
        }

        return lineage;
    },

    createAction: function(contextID, pointID, options) {
        options = options || {};
        var now = Date.now() / 1000,
            actionID = this.getNextActionID();

        if (pointID !== false) {
            pointID = pointID || this.G.nextID();
        }

        var action = {
            'ActionID': actionID,
            'ContextID': contextID,
            'PointID': pointID,
            'Timestamp': options.timeStamp || now,
            'Duration': _.isNumber(options.duration) ? options.duration : null,
            'Open': !!options.isOpen,
            'Interpolated': !!options.isInterpolated
        }
        this.actionIdx[actionID] = action;
        return action;
    },

    getNextActionID: function() {
        this.lastActionID += 1;
        return this.lastActionID;
    },

    updateActivity: function(point) {
        var activity = _.findWhere(this.recordedHistory, function(activity) {
            return activity.PointID == point.id;
        });

        if (activity) {
            activity.Duration = point.get('Duration');
            activity.Timestamp = point.get('Time');
        }
    },

    removeActivityByPointID: function(pointID) {
        // Remove from rawHistory
        this.rawHistory = _.filter(this.rawHistory, function(action) {
            return action.PointID != pointID;
        });

        // Remove from recorded History
        this.recordedHistory = _.filter(this.recordedHistory, function(action) {
            return action.PointID != pointID;
        });

        // Full regeneration removes hanging interpolations
        this.generateContinuous();

        // Re-add currently open activity if necessary
        if (this.openActivity) {
            var lastContinuous = _.last(this.continuousHistory);
            if (!lastContinuous || (lastContinuous && lastContinuous.PointID != this.openActivity.PointID)) {
                this.extendContinuous(this.openActivity);
            }
        }

        // Remove from actionIdx
        this.actionIdx = _.filter(this.actionIdx, function(action) {
            if (action) {
                return action.PointID != pointID;
            }
        });
    },

    generateContinuous: function() {
        // Complete interpolated activity
        var continuousHistory = [];

        // Now interpolate the recorded history so it can be extended by further activity
        _.each(this.recordedHistory, function(action) {
            var prevContinuousAction = _.last(continuousHistory);
            var interpolatedHistory = this.interpolateActivity(action, prevContinuousAction);
            continuousHistory = continuousHistory.concat(interpolatedHistory);
        }, this);

        this.continuousHistory = continuousHistory;
    }

    /*updateContinuous: function(prevAction) {
        prevAction = prevAction || _.last(this.rawHistory);
        var actionRecorded = false,
            clusterID = this.clusterController.cluster.clusterID;

        // Grab the time since the previous activity
        if (prevAction) {
            var timeSince = (Date.now() / 1000) - prevAction.Timestamp;
            if (prevAction.Duration === null) {
                // Update the previous activity's duration now that there's a next point
                if (timeSince >= this.minimumDuration) {
                    prevAction.Duration = timeSince;
                    actionRecorded = true;

                    var prevPrevAction = this.getLastOpen(this.recordedHistory);
                    if (prevPrevAction) {
                        var point = this.points.get(prevPrevAction.PointID);
                        if (point) {
                            var duration = (Date.now() / 1000) - prevPrevAction.Timestamp;
                            if (this.debug) {
                                console.log('Closing point ' + point.id + ' with duration ' + duration);
                            }
                            var updatedAttributes = {
                                'Timing': {
                                    'Duration': duration
                                },
                                'Open': false
                            }
                            this.G.trigger('UpdatePoint', clusterID, point, updatedAttributes);
                        }
                    }

                    // Add new activity to recorded history
                    this.recordedHistory.push(prevAction);
                }
            }
            else {
                // Update the duration of the still-open action
                prevAction.Duration = timeSince;
            }

            // Extend the continuous history
            if (actionRecorded) {
                if (this.debug) {
                    console.log('Opening point (? ' + prevAction.PointID + ') with duration ' + prevAction.duration);
                }

                var successCallback = _.bind(function(success, point) {
                    if (success) {
                        if (this.debug) {
                            console.log('Successfully added point prev=' + prevAction.PointID, ' curr=' + point.id, point.attributes);
                        }
                        prevAction.PointID = point.id;

                        this.extendContinuous(prevAction);
                    }
                }, this);

                this.G.trigger('AddPoint', prevAction.ContextID, clusterID, {
                    'UpdatedAttributes': {
                        'Timing': {
                            'Time': prevAction.Timestamp,
                            'Duration': prevAction.Duration,
                        },
                        'Text': '',
                        'Open': prevAction.Open
                    }
                }, successCallback, {options: { 'ActivityPathAdd': true }});
            }
        }
    },*/

    /*generateContinuous: function(minimumDuration) {
        this.rootContextID = this.rootContextID || this.G.rootContextID || this.G.globalCollection.rootID;

        // Start with the root?
        if (false && !this.recordedHistory) {
            this.recordedHistory = [{
                'ContextID': this.rootContextID,
                'PointID': this.G.nextID(),
                'Timestamp': Date.now() / 1000,
                'Duration': null,
                'Continuous': true,
                'Anchor': true
            }];
        }

        // Filter the raw history to remove navigation noise
        var filteredHistory = _.filter(this.newHistory, function(activity) {
            console.log(activity.Duration, minimumDuration, activity.Duration);
            return activity.Duration === null || activity.Duration > minimumDuration;
        });

        if (filteredHistory && filteredHistory.length) {
            // Stack the newly filtered history atop the accumulated record
            // 
            var lastRecord = _.last(this.recordedHistory);
            if (lastRecord && !lastRecord.Duration) {
                lastRecord.Duration = lastRecord.Timestamp - _.first(filteredHistory).Timestamp;
            }
            this.recordedHistory = this.recordedHistory.concat(filteredHistory);
        }

        this.rawHistory = this.rawHistory.concat(this.newHistory);
        this.newHistory = [];

        // Fill in the intermediate contexts
        var newContinuousHistory = [];
        var lastActivity = _.last(this.continuousHistory);

        _.each(this.recordedHistory, function(activity) {
            var interpolatedHistory = this.interpolateActivity(activity, lastActivity);
            newContinuousHistory = newContinuousHistory.concat(interpolatedHistory);
            lastActivity = activity;
        }, this);

        this.continuousHistory = newContinuousHistory;

        return newContinuousHistory;
    },*/
});
_.extend(HistoryManager.prototype, Backbone.Events);

module.exports = ActivityPath;