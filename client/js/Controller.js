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

var _ = require('backbone/node_modules/underscore');

var Data = require('app/models/Data');

function Controller(clusterController, G) {
    this.G = this.G || G || require('app/Global')();
    this.clusterController = clusterController;
    this.bindEvents();
}

_.extend(Controller.prototype, {
    bindEvents: function() {
        var _this = this;
        _.bindAll(this, 'modelErrorCallback', 'showPointDetail', 'showAddFeedback', 'addPoint', 
                    'updatePoint', 'onCreateContext', 'renameContext', 'reparentContext',
                    'deleteContext', 'deletePoint', 'adjustContext', 'clusterClicked',
                    'showAdmin', 'logoutUser', 'changePassword', 'onShowContextRename',
                    'updateContext', 'addContext', 'beforeFocusChanged');

        // ************************
        // App-level
        // ************************

        var G = this.G;

        G.on('ShowPointDetail', this.showPointDetail);
        G.on('BeforeFocusChanged', this.beforeFocusChanged);
        G.on('GlobalClusterClicked', this.clusterClicked);
        G.on('ShowAdmin', this.showAdmin);
        G.on('LogoutUser', this.logoutUser);
        G.on('ChangePassword', this.changePassword);
        G.on('ShowContextRename', this.onShowContextRename);

        G.on('DragBegin', function() {
            //G.trigger('ClearUIElements')
            G.updateLastActivity();
            G.contextRename.setPointerTransparent();
            G.setAddFeedbackPointerTransparent();
        });

        G.on('DragEnd', function() {
            //G.trigger('UnClearUIElements')
            G.updateLastActivity();
            G.contextRename.restorePointer();
            G.restoreAddFeedbackPointer();
        });

        G.on('SetExclusive', function(cluster) {
            G.timelineView && G.timelineView.hide();
        });

        G.on('AuthLost', function(contextID, userID) {
            console.log('AuthLost');
        });

        // ************************
        // Cluster-level
        // ************************

        G.on('ContextCreated', this.onCreateContext);
        G.on('AddContext', this.addContext);
        G.on('RenameContext', this.renameContext);
        G.on('ReparentContext', this.reparentContext);
        G.on('DeleteContext', this.deleteContext);
        G.on('UpdateContext', this.updateContext);

        G.on('AdjustContext', this.adjustContext);

        G.on('AddPoint', this.addPoint);
        G.on('UpdatePoint', this.updatePoint);
        G.on('DeletePoint', this.deletePoint);
        G.on('PointAdded', this.showAddFeedback);

        G.on('FilterLevelChanged', function(filterLevel) {
            G.updateLastActivity();
            G.localSet('LastFilterLevel', filterLevel);
        });

        G.on('AddLinkedContext', function(destViewID, srcViewID, destClusterID, srcClusterID) {
            console.log('AddLinkedContext');
        });
    },

    deleteContext: function(contextID, clusterID, noFocus, successCallback) {
        var G = this.G;
        var cluster = G.getCluster(clusterID);
        var context = cluster.contexts.get(contextID),
            parentContextID = context && context.getParentID();

        if (!parentContextID) {
            return;
        }

        G.setWorking();

        var points = cluster.contexts.getContextPoints(contextID, null);

        var s = _.bind(function(response, textStatus, jqXHR) {
            // Remove links to parent
            var cluster = G.getCluster(clusterID);

            cluster.contexts.removeAssoc('down', parentContextID, contextID);
            cluster.contexts.removeAssoc('up', contextID, parentContextID);

            // TODO: Remove links to any children (and children too?)

            // And all points
            _.each(points, function(point) {
                point.destroy();
            });

            if (!noFocus && clusterID) {
                // Shift focus to parent if the deleted context was the focus
                var cluster = G.getCluster(clusterID);
                //if (cluster.focusID == contextID) {
                cluster.setFocus(parentContextID, true);
                //}
            }

            if (successCallback) {
                successCallback();
            }
            G.unsetWorking();

        }, this);

        var context = cluster.contexts.get(contextID);
        context.destroy({ success: s, error: this.modelErrorCallback});
    },

    reparentContext: function(contextID, oldParentID, newParentID, clusterID) {
        var G = this.G;
        if (!contextID || !oldParentID || !newParentID || !clusterID) {
            return;
        }

        var cluster = G.getCluster(clusterID),
            contexts = cluster.contexts;

        G.setWorking();

        var s = _.bind(_.after(4, function(response, textStatus, jqXHR) {
            var context = contexts.get(contextID);
            context.set('ContextPositionChanged', Date.now());
            G.unsetWorking();
        }), this);

        var assoc1 = contexts.getAssociation('up', contextID, oldParentID);
        assoc1.destroy({ success: s, error: this.modelErrorCallback});

        var assoc2 = contexts.getAssociation('down', oldParentID, contextID);
        assoc2.destroy({ success: s, error: this.modelErrorCallback});

        var assoc3 = contexts.addAssoc('up', contextID, newParentID);
        assoc3.save({}, {success: s, error: this.modelErrorCallback});

        var assoc4 = contexts.addAssoc('down', newParentID, contextID);
        assoc4.save({}, {success: s, error: this.modelErrorCallback});
    },

    renameContext: function(contextID, clusterID, newLabel) {
        var G = this.G;
        var cluster = G.getCluster(clusterID);
        var contextModel = cluster.contexts.get(contextID);
        if (contextModel.isLink()) {
            return;
        }
        G.setWorking();

        var _this = this;
        var s = function(context, response, callOptions) {
            G.unsetWorking();
        }

        contextModel.save({'1__Label': newLabel}, {
            success: s,
            error: this.modelErrorCallback
        });
    },

    addContext: function(parentContextID, clusterID, attributes, loadCallback) {
        var G = this.G;
        var cluster = G.getCluster(clusterID);
        if (!cluster) {
            console.log('Invalid cluster ID to addContext(): ' + clusterID);
            return;
        }

        G.setWorking();

        var associationCollection = cluster.controller.contextCollection.associations;

        var s = _.bind(function(context, response, callOptions) {
            if (response && response.Error) {
                G.unsetWorking();
                return;
            }
            var contextID = context.id;

            associationCollection.addAssoc('up', contextID, parentContextID, {save: false});
            associationCollection.addAssoc('down', parentContextID, contextID, {save: false});

            // Have to wait until the associations are added
            cluster.contexts.trigger('add', context);

            G.unsetWorking();
            if (loadCallback) {
                loadCallback(context, parentContextID, clusterID);
            }
        }, this);

        var saveAttrs = {
            'ParentID': parentContextID,
            'ID': G.nextID()
        };
        if ('Label' in attributes) {
            this.addNamespacedAttr(saveAttrs, 1, {
                'Label': attributes.Label || ''
            });
        }

        if ('TargetFrequency' in attributes) {
            this.addNamespacedAttr(saveAttrs, 1, {
                'TargetFrequency': attributes.TargetFrequency
            });
        }

        var behaveAppID = G.getAppID('Behave');
        var bonusAttrs = _.pick(attributes, 'Label', 'GlobalMultiplier', 'MultiplierValue', 'Text', 'BaseValue');
        this.addNamespacedAttr(saveAttrs, behaveAppID, bonusAttrs);

        var createOptions = {
            type: 'post',
            silent: true,
            wait: true,
            success: s,
            error: this.modelErrorCallback
        }
        cluster.contexts.create(saveAttrs, createOptions);
    },

    updateContext: function(contextID, updatedAttributes, loadCallback, loadCallbackOptions) {
        var G = this.G;
        G.setWorking();

        var _this = this;
        var s = function(response, textStatus, jqXHR) {
            if (loadCallback) {
                loadCallback(loadCallbackOptions);
            }
            G.unsetWorking();
        }

        var saveAttrs = {};
        if ('Label' in updatedAttributes) {
            this.addNamespacedAttr(saveAttrs, 1, {
                'Label': updatedAttributes.Label || ''
            });
        }

        if ('TargetFrequency' in updatedAttributes) {
            this.addNamespacedAttr(saveAttrs, 1, {
                'TargetFrequency': updatedAttributes.TargetFrequency
            });
        }

        var behaveAppID = G.getAppID('Behave');
        var bonusAttrs = _.pick(updatedAttributes, 'Label', 'GlobalMultiplier', 'MultiplierValue', 'Text', 'BaseValue');
        this.addNamespacedAttr(saveAttrs, behaveAppID, bonusAttrs);

        var context = G.globalCollection.get(contextID);
        if (context) {
            context.save(saveAttrs, {
                success: s,
                error: this.modelErrorCallback
            });
        }
        else {
            console.log('Could not update context ' + contextID + ', not found');
            G.unsetWorking();
        }
    },

    adjustContext: function(contextID, adjustDir, clusterID) {
        var G = this.G;
        var cluster = G.getCluster(clusterID);
        var contextModel = cluster.contexts.get(contextID);

        G.setWorking();

        var s = _.bind(function(context, response, callOptions) {
            var newAdjustDelta = 0,
                adjustDir = context.get('adjustDir');

            if (adjustDir) {
                // When there's no server
                var scoreDetails = context.calcContextScore(),
                    currentDelta = context.getNS('AdjustDelta') || 0,
                    recentInterval = scoreDetails['RecentInterval_5'],
                    timeSince = scoreDetails['TimeSince'],
                    timeSinceAdjusted = scoreDetails['TimeSinceAdjusted'];

                if (!recentInterval || !timeSince) {
                    return currentDelta;
                }

                if (adjustDir == 'forward') {
                    newAdjustDelta = currentDelta + (recentInterval * 0.66);
                }
                else {
                    newAdjustDelta = currentDelta - (timeSinceAdjusted * 0.66);
                }

                context.set('1__AdjustDelta', newAdjustDelta + 0.1);
                context.save();
            }
            else {
                newAdjustDelta = context.getNS('AdjustDelta') || 0;
                context.set('1__AdjustDelta', newAdjustDelta + 0.1);
            }

            G.unsetWorking();
        }, this);

        contextModel.save({'adjustDir': adjustDir}, {success: s, error: this.modelErrorCallback});
    },

    deletePoint: function(pointID, parentContextID, successCallback) {
        var G = this.G;
        var parentContextID = parentContextID || G.getParentContextID(pointID);
        if (!parentContextID) {
            return;
        }

        G.setWorking();

        var s = _.bind(function(response, textStatus, jqXHR) {
            if (successCallback) {
                successCallback();
            }
            G.unsetWorking();
        }, this);

        var point = this.clusterController.cluster.contexts.points.get(pointID);
        point.destroy({ success: s, error: this.modelErrorCallback});
    },

    addPoint: function(contextID, clusterID, details, loadCallback, options) {
        var G = this.G;
        details = details || {};
        options = options || {};
        var cluster = G.getCluster(clusterID);
        var updatedAttributes = details.UpdatedAttributes || {};

        G.setWorking();

        var s = _.bind(function(point, response, callOptions) {
            if (response && response.Error) {
                G.unsetWorking();

                if (loadCallback) {
                    loadCallback(false);
                }
                return;
            }
            
            var pointID = point.id,
                context = cluster.contexts.get(contextID),
                contextLabel = context.getNS('Label'),
                color = cluster.getColor(contextID);

            context.set({
                '1__AdjustDelta': 0
            }, {
                silent: true
            });

            G.trigger('PointAdded', contextID, pointID, contextLabel, color, {
                underCursor: options.feedbackUnderCursor,
                showDelay: 200,
                feedbackRequested: options.showAddFeedback,
                options: options.options,
                point: point,
                cluster: cluster
            });

            if (cluster && options.toParent) {
                if (options.toParent && !cluster) {
                    cluster = G.getCluster('Root');
                }

                // If already focused, shift focus to its parent
                if (contextID == cluster.focusID) {
                    cluster.focusParent(contextID);
                }
            }

            if (options.showDetail) {
                G.trigger('ShowPointDetail', pointID, contextID);
            }

            cluster.contexts.points.add(point);
            G.unsetWorking();

            if (loadCallback) {
                loadCallback(true, point);
            }
        }, this);

        var beginTime = updatedAttributes.Timing ? updatedAttributes.Timing.Time || null : Date.now() / 1000;

        var createAttrs = {
            'ID': G.nextID()
        };
        
        this.addNamespacedAttr(createAttrs, 1, {
            // Global/universal attributes
            'ContextID': contextID,
            'Time': beginTime,
            'TimeOffset': G.getTimeOffset(),

            // Core app attributes    
            'Duration': updatedAttributes.Timing ? parseInt(updatedAttributes.Timing.Duration) || null : null,
            'Text': updatedAttributes.Text || '',
            'Color': details.Color || null
        });

        if ('Open' in updatedAttributes) {
            this.addNamespacedAttr(createAttrs, 1, {
                'Open': updatedAttributes.Open || false
            });
        }

        if ('Bonuses' in updatedAttributes) {
            // Other app attributes (hard-code hack for now)
            var behaveAppID = G.getAppID('Behave');
            this.addNamespacedAttr(createAttrs, behaveAppID, {
                'Bonuses': updatedAttributes.Bonuses || {}
            });
        }

        var point = cluster.contexts.points.create(createAttrs, {
            type: 'post',
            wait: true,
            success: s,
            error: this.modelErrorCallback
        });
    },

    updatePoint: function(clusterID, point, updatedAttributes, loadCallback, loadCallbackOptions) {
        var G = this.G;
        G.setWorking();

        var _this = this;
        var s = function(response, textStatus, jqXHR) {
            if (loadCallback) {
                loadCallback(loadCallbackOptions);
            }
            G.unsetWorking();
        }

        var saveAttrs = {}
        if ('Timing' in updatedAttributes) {
            if ('Time' in updatedAttributes.Timing) {
                this.addNamespacedAttr(saveAttrs, 1, {
                    'Time': updatedAttributes.Timing.Time || null
                });
            }
            if ('Duration' in updatedAttributes.Timing) {
                this.addNamespacedAttr(saveAttrs, 1, {
                    'Duration': parseInt(updatedAttributes.Timing.Duration) || 0
                });
            }
        }
        if ('Open' in updatedAttributes) {
            this.addNamespacedAttr(saveAttrs, 1, {
                'Open': updatedAttributes.Open || false
            });
        }
        if ('Text' in updatedAttributes) {
            this.addNamespacedAttr(saveAttrs, 1, {
                'Text': updatedAttributes.Text || ''
            });
        }
        if ('Bonuses' in updatedAttributes) {
            // Other app attributes (hard-code hack for now)
            var behaveAppID = G.getAppID('Behave');
            this.addNamespacedAttr(saveAttrs, behaveAppID, {
                'Bonuses': updatedAttributes.Bonuses || {}
            });
        }

        point.save(saveAttrs, {
            success: s,
            error: this.modelErrorCallback
        });
    },

    showAddFeedback: function(contextID, pointID, pointLabel, backgroundColor, options) {
        if (!options.feedbackRequested) {
            return;
        }
        var G = this.G;
        var creatorView = G.creatorView;

        if (!G.$addFeedback || !creatorView) {
            return;
        }
        options = options || {};
        var underCursor = options.underCursor !== false ? true : false;
        var showDelay = options.showDelay || 0;

        if (this.overlayVisible && !options.force) {
            return;
        }

        var textColor = G.getTextContrastColor(backgroundColor),
            x = G.DD.currentCursorX - G.$el.offset().left,
            y = G.DD.currentCursorY - G.$el.offset().top;

        if (!underCursor) {
            x = creatorView.$el.offset().left + (creatorView.$el.width() / 2);
            y = creatorView.$el.offset().top + (creatorView.$el.height() / 2);
        }

        var $addFeedback = G.$addFeedback;

        $addFeedback
            .hide()
            .css({
                'background-color': backgroundColor,
                'color': textColor,
                'opacity': 0,
                'left': (x - ($addFeedback.width() / 2)) + 'px',
                'top': (y - ($addFeedback.height() / 2)) + 'px'
            })
            .off('click')
            .on('click', function(e) {
                var pos = {
                    x: x,
                    y: y
                }

                G.trigger('ShowPointDetail', pointID, contextID, null, pos);
                return false;
            })
            .text(pointLabel);

        _.delay(function() {
            $addFeedback
                .show()
                .animate({
                        opacity: 1
                    },
                    {
                        duration: 150
                    });
        }, showDelay);

        this.lastShowID = Math.round(Math.random() * 10000000);
        var _this = this;

        _.delay(function(showID) {
            return function() {
                if (showID != _this.lastShowID) {
                    return;
                }
                $addFeedback.animate({
                        opacity: 0
                    },
                    {
                        duration: 150,
                        complete: function() {
                            $(this).hide();
                        }
                    });
            }
        }(this.lastShowID), 2000);
    },

    showPointDetail: function(pointID, contextID, changeCallback, refPos) {
        this.G.updateLastActivity();

        if (this.clusterController) {
            this.clusterController.trigger('ShowPointEdit', pointID, contextID, changeCallback, refPos);
        }
    },

    modelErrorCallback: function(model, jqXHR, options) {
        var G = this.G;
        if (jqXHR && jqXHR.responseJSON && jqXHR.responseJSON.Type == 'Authentication Error') {
            G.trigger('AuthLost');
        }
        else {
            console.log('Model error', model, jqXHR, options);
        }
        
        G.unsetWorking();
    },

    clusterClicked: function(e, view) {
        var G = this.G;
        G.updateLastActivity();
        if (!view) {
            return;
        }

        if (G.autoActionView) {
            if (view.cluster.focusID == view.viewID && view.model.isLeaf()) {
                G.autoActionView.trigger('FocusAction', view.viewID, view.cluster);
            }
        }

        G.updateLastActivity();
    },

    beforeFocusChanged: function(cluster, focusID) {
        var G = this.G;
        G.updateLastActivity();

        if (this.G.isGlobalCluster(cluster)) {
            G.localSet('LastFocus', focusID);
        }

        if (G.autoActionView) {
            G.autoActionView.trigger('ClusterFocusChanged', cluster, focusID);
        }
    },

    showAdmin: function() {
        var G = this.G;
        G.updateLastActivity();

        if (G.adminView) {
            G.adminView.show();
        }
    },

    authLost: function() {
        this.rootContextID = null;

        this.hideDetails();
        this.globalPoints.reset([]);
        this.globalCollection.reset([]);

        this.render({
            newLogin: true
        });

        _.delay(this.G.hideClusters, 250);
    },

    logoutUser: function(successCallback) {
        var G = this.G;
        var data = {};
        G.setWorking();

        var s = _.bind(function(response, textStatus, jqXHR) {
            G.unsetWorking();

            if (response && response.Success) {
                G.trigger('UserLoggedOut');

                if (successCallback) {
                    successCallback();
                }
            }
        }, this);


        G.ajaxGet('/user/logout', data, s);
    },

    userLoggedOut: function() {
        this.authLost();
    },

    changePassword: function(oldPassword, newPassword, successCallback) {
        var G = this.G;
        var data = {
            'OldPassword': oldPassword,
            'NewPassword': newPassword
        }

        G.setWorking();

        var s = _.bind(function(response, textStatus, jqXHR) {
            G.unsetWorking();

            if (response && response.Success) {
                if (successCallback) {
                    successCallback();
                }
            }
        }, this);

        G.ajaxPost('/user/change_password', data, s);
    },

    onCreateContext: function(contextID, parentView) {
        this.G.updateLastActivity();

        this.G.trigger('ShowContextRename', parentView, {
            autoFocus: true,
            autoHide: 5000,
            renameContextID: contextID
        });
    },

    onShowContextRename: function(view, options) {
        this.G.contextRename.show(view, options);
    },

    addNamespacedAttr: function(attrBase, namespaceID, newAttrs) {
        namespaceID = namespaceID || 1;
        _.each(newAttrs, function(val, key) {
            attrBase[namespaceID + '__' + key] = val;
        });
    }
});

module.exports = Controller;