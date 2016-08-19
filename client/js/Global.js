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

var Backbone = require('backbone'),
	_ = require('underscore'),
    QuickContextActions = require('app/views/QuickContextActions'),
    DragDrop = require('app/DragDrop'),
    Intervals = require('app/Intervals'),
    UtilsMixin = require('app/mixins/Utils');

var globalMap = {};

function Global(instanceID) {
    this.instanceID = instanceID;
}

_.extend(Global.prototype, UtilsMixin);
_.extend(Global.prototype, {
	isMobile: ('ontouchstart' in document.documentElement),
    isAndroid: (/android/i.test(navigator.userAgent)),
    isApple: (/iphone|ipod|ipad/i.test(navigator.userAgent)),
    isMac: (/Macintosh/.test(navigator.userAgent)),
    isTablet: (/ipad/i.test(navigator.userAgent) || ((/android/i.test(navigator.userAgent)) && !(/mobile/i.test(navigator.userAgent)))),

    featureState: {
        'PointDetail': true,
        'LeafFocusToggleTimer': true,
        'LeafFocusAutoAdd': true,
        'Admin': true,
        'DetailLevels': true,
        'MovableFocus': true,
        'PointShortPress': true,
        'PointLongPress': true,
        'ActivityPullForward': true,
        'ActivityPushBack': true,
        'ActionHistory': true,
        'ActionTimeline': true,
        'ClusteredEdit': true,
        'AddFeedbackInteractive': true
    },

    pointAttributeClusterDef: {
        Type: 'Cluster',
        ClusterType: 'Attribute',
        RootType: 'SimpleSurfaceView',
        Render: true,
        RenderOptions: {},
        Options: {
            clusterSize: 'Expanded',
            dragDisabled: true,
            dropDisabled: true
        },
        EventHandlers: {},
        Nodes: []
    },

    clusterAttributeClusterDef: {
        Type: 'Cluster',
        ClusterType: 'Attribute',
        RootType: 'SimpleSurfaceView',
        Render: true,
        RenderOptions: {},
        Options: {
            clusterSize: 'Expanded',
            dragDisabled: true,
            dropDisabled: true,
            visibleUIElements: ['Creator']
        },
        EventHandlers: {},
        Nodes: []
    },

    idRangeSize: 1000,
    localOnlyInitialID: 999,

	init: function(options) {
		options = options || {};
		_.extend(this, options);

		_.bindAll(this, 'hideClusters');

        this.globalCluster = null;
		this.clusters = {};
		this.DD = new DragDrop(this.$el, {
            dragThreshold: this.dragThreshold
        });

        this.Intervals = new Intervals();
        
        this.$addFeedback = $('.point-add-feedback', options.$el);
        this.$qca = $('.quick-context-actions', options.$el);
        this.$workingOverlay = $('.working-overlay', options.$el);
        this.$overlay = $('.overlay-backing', options.$el);
        this.$overlay2 = $('.ovzerlay-backing2', options.$el);

        if (options.features) {
            this.setFeatures(options.features);
        }

        if (this.bgColor == 'dark') {
            this.bgColor = '#000';
        }
        else if (this.bgColor == 'light') {
            this.bgColor = '#fff';
        }

        if (this.visualQuality >= 0.7) {
            if (options.bgColor == 'dark') {
                this.$el.addClass('benome-container-bg-dark');
            }
            else if (options.bgColor == 'light') {
                this.$el.addClass('benome-container-bg-light');
            }
        }
        else {
            this.bgColor = this.bgColor || '#000';

        }

        this.setBackgroundColor(this.bgColor)

        this.contextRename = new QuickContextActions({
            el: this.$qca,
            $overlay: this.$overlay2
        });
        this.contextRename.render();

        this.updateFontSize();

        this.apps = {};
        return this;
	},

    isGlobalCluster: function(cluster) {
        return !this.globalCluster || this.globalCluster.cluster.clusterID == cluster.clusterID;
    },

    getID: function() {
        return this.instanceID;
    },

    hideAddPointFeedback: function() {
        this.$addFeedback.hide();
        this.addFeedbackVisible = false;
    },

    setAddFeedbackPointerTransparent: function() {
        this.lastAddFeedbackPointerEventsVal = null;

        this.lastAddFeedbackPointerEventsVal = this.$addFeedback.css('pointer-events') || 'auto';
        this.$addFeedback.css({
            'pointer-events': 'none'
        });
    },

    restoreAddFeedbackPointer: function() {
        if (this.lastAddFeedbackPointerEventsVal) {
            this.$addFeedback.css({
                'pointer-events': this.lastAddFeedbackPointerEventsVal
            });
            this.lastAddFeedbackPointerEventsVal = null;
        }
    },

    initApps: function() {
        // This map is here to ensure this global class is already initialized and available
        var appClsMap = {
            'Global': require('app/apps/global/Global.js')
        }

        if (!this.globalAppOnly) {
            // Require paths are static strings so browserify can work
            if (!_.isArray(this.enabledApps)) {
                _.extend(appClsMap, {
                    'Behave': require('app/apps/behave/Behave.js'),
                    'Project': require('app/apps/project/Project.js')
                });
            }
            else {
                if (_.indexOf(this.enabledApps, 'Behave') > -1) {
                    appClsMap['Behave'] = require('app/apps/behave/Behave.js')
                }

                if (_.indexOf(this.enabledApps, 'Project') > -1) {
                    appClsMap['Project'] = require('app/apps/project/Project.js')
                }
            }
        };

        _.each(this.getAppNames(), function(appName) {
            var appCls = appClsMap[appName];
            if (appCls) {
                this.apps[appName] = new appCls(this.getAppID(appName), {
                    G: this
                });
            }
        }, this);
    },

    postInitApps: function(globalCluster) {
        _.each(this.apps, function(app, appName) {
            app.postInit(globalCluster);
        });
    },

    getApp: function(appName) {
        return this.apps[appName];
    },

    getAppNames: function() {
        var apps = this.globalCollection.get(1003).getAssocModels('down');

        var appNames = _.map(apps, function(appModel) {
            return appModel.getNS('Label');
        });

        if (_.indexOf(appNames, 'Project') == -1 && _.indexOf(this.enabledApps, 'Project') > -1) {
            appNames.push('Project');
        }

        return appNames;
    },

    getAppID: function(appName) {
        if (!this.appIDCache) {
            var appIDCache = {},
                contexts = this.globalCollection;

            _.each(contexts.getNeighbours(1003), function(appID) {
                appIDCache[contexts.get(appID).getNS('Label')] = appID;
            });

            this.appIDCache = appIDCache;
        }

        return this.appIDCache[appName];
    },

    renderAppSurface: function(cluster, clusterMode, surfaceView, surfaceModeView, options) {
        var _this = this,
            sortedApps = _.sortBy(_.values(this.apps), function(app) {
                return app.name == 'Global' ? 0 : 1;
            });

        var featuresRendered = {};
        _.each(sortedApps, function(app, appName) {
            if (app.surfaceRender) {
                var newFeaturesRendered = app.surfaceRender(cluster, clusterMode, surfaceView, surfaceModeView, options, featuresRendered);
                _.extend(featuresRendered, newFeaturesRendered || {});
            }
        }, this);
    },

    setBackgroundColor: function(bgColor) {
        this.$el.css({
            'background-color': bgColor
        });
    },

	setFeatures: function(features) {
        _.extend(this.featureState, features);
        return this.featureState;
    },

    FEATURE: function(feautureID) {
        return this.featureState[feautureID] !== false;
    },

	checkAnimEnabled: function(numViews) {
        if (this.animDisabled) {
            return false;
        }

        if (this.isTablet) {
            return numViews < 30;
        }
        else if (this.isMobile) {
            return numViews < 20;
        }
        else {
            return numViews < 60;
        }
    },

    commonPointDragHandler: function(dragView, dragDetails) {
        return {
            '$dragProxyEl': dragView.$el,
            'proxyClass': 'drag-proxy-point'
        }
    },

    updateFontSize: function() {
        var scaleFactor = this.isMobile ? 30 : 40;
        this.fontSize = Math.max(10, ((this.$el.width() + this.$el.height()) / 2) / scaleFactor);
        this.$el.css('font-size', this.fontSize + 'px');
    },

	addCluster: function(cluster) {
		this.clusters[cluster.clusterID] = cluster;
	},

	getCluster: function(clusterID) {
        return this.clusters[clusterID];
    },

    hideClusters: function() {
        _.each(this.clusters, function(cluster) {
            cluster.hideAll();
        });
    },

	getClusterZIndex: function(clusterID) {
        var lastClusterZIndex = this.lastClusterZIndex || 20000;
        if (clusterID != this.lastClusterID) {
            lastClusterZIndex += 1000;
            this.lastClusterZIndex = lastClusterZIndex;
        }
        return lastClusterZIndex;
    },

    setLastClusterMode: function(displayMode) {
        this.localSet('LastGlobalClusterDisplayMode', displayMode);
    },

    getNow: function() {
        return Date.now() + (this.getTimeOffset() * 1000);
    },

    getTimeOffset: function() {
        return -this.timeOffset
    },

    globalSize: function() {
        return {
            width: this.$el.width(),
            height: this.$el.height()
        }
    },

    contrastColor: function(c, darkColor, lightColor) {
        if (_.isString(c)) {
            c = $.Color(c);
        }

        // method taken from https://gist.github.com/960189
        var r = c._rgba[0],
            g = c._rgba[1],
            b = c._rgba[2];

        return (((r*299)+(g*587)+(b*144))/1000) >= 131.5 ? darkColor : lightColor;
    },

    getTextContrastColor: function(c) {
        return this.contrastColor(c, this.darkText, this.lightText);
    },

    transformNode: function(targetType, nodeDef) {
        nodeDef = nodeDef || {};

        if (targetType == 'BooleanOption') {
            var outDef = _.extend({}, nodeDef);
            if (!nodeDef.Type || nodeDef.Type == targetType) {
                outDef.Type = targetType;
                outDef.Label = outDef.Label || '';
            }
            else {
                // add support for other node types later on
                return null;
            }

            return outDef;
        }
        else {
            return nodeDef;
        }
    },

    renderStructure: function(struct, clusterCollection) {
        struct = struct || {};
        if (!struct.Type || !struct.Container) {
            return null;
        }

        var base = null,
            _this = this;

        if (struct.Type == 'Cluster') {
            if (struct.ClusterType == 'Global') {
                var GlobalCluster = require('app/cluster/GlobalCluster'),
                    clusterOptions = {
                        label: struct.Name
                    };

                struct.Options = struct.Options || {};
                _.extend(struct.Options, clusterOptions);

                var lastFocusID = parseInt(this.localGet('LastFocus')),
                    lastFilterLevel = parseInt(this.localGet('LastFilterLevel')) || 0,
                    lastGlobalClusterDisplayMode = this.localGet('LastGlobalClusterDisplayMode');

                base = new GlobalCluster(struct, clusterCollection, {
                    G: this,
                    clusterMode: lastGlobalClusterDisplayMode,
                    filterLevel: lastFilterLevel,
                    focusID: lastFocusID
                });

                if (lastFilterLevel) {
                    base.cluster.setFilterLevel(lastFilterLevel, {
                        noRender: true
                    });
                }
                if (lastFocusID) {
                    base.cluster.setFocus(lastFocusID, false);
                }
            }
            else if (struct.ClusterType == 'Boolean') {
                if (!clusterCollection) {
                    var nodes = _.compact(_.map(struct.Nodes, function(nodeDef) {
                        return _this.transformNode('BooleanOption', nodeDef);
                    }));
                    struct.Nodes = nodes;
                }

                var BooleanCluster = require('app/cluster/BooleanCluster'),
                    clusterOptions = {
                        moveDisabled: true,
                        label: struct.Name
                    };

                struct.Options = struct.Options || {};
                _.extend(struct.Options, clusterOptions);
                base = new BooleanCluster(struct, clusterCollection, {G: this});
            }
            else if (struct.ClusterType == 'Attribute') {
                var validTypes = {
                    'Text': 1,
                    'TextLine': 1,
                    'Interval': 1,
                    'Numeric': 1,
                    'Group': 1,
                    'Boolean': 1,
                    'ClusterContainer': 1,
                    'Frequency': 1
                }

                if (!clusterCollection) {
                    var nodes = _.compact(_.map(struct.Nodes, function(nodeDef) {
                        if (!(nodeDef.Type in validTypes)) {
                            console.log('Invalid type for Attribute cluster: ' + nodeDef.Type);
                            return null;
                        }

                        var outDef = _.extend({}, nodeDef);
                        outDef.Label = outDef.Label || '';
                        outDef.Value = outDef.Value || null;

                        return outDef;
                    }));
                    struct.Nodes = nodes;
                }

                var AttributeCluster = require('app/cluster/AttributeCluster'),
                    clusterOptions = {
                        moveDisabled: true,
                        dragDisabled: true,
                        dropDisabled: true,
                        label: struct.Name
                    };

                struct.Options = struct.Options || {};
                _.extend(struct.Options, clusterOptions);
                _.extend(struct.Options, struct.OptionOverrides || {});
                
                base = new AttributeCluster(struct, clusterCollection, {G: this});
            }
            else if (struct.ClusterType == 'ContextDef') {
                var validTypes = {
                    'ContextDef': 1
                }

                if (!clusterCollection) {
                    var nodes = _.compact(_.map(struct.Nodes, function(nodeDef) {
                        /*if (!(nodeDef.Type in validTypes)) {
                            console.log('Invalid type for ContextDef cluster: ' + nodeDef.Type);
                            return null;
                        }*/

                        var outDef = _.extend({}, nodeDef);
                        outDef.Label = outDef.Label || '';
                        return outDef;
                    }));
                    struct.Nodes = nodes;
                }

                var ContextDefCluster = require('app/cluster/ContextDefCluster'),
                    clusterOptions = {
                        moveDisabled: true,
                        dragDisabled: true,
                        dropDisabled: true,
                        label: struct.Name
                    };

                struct.Options = struct.Options || {};
                _.extend(struct.Options, clusterOptions);
                _.extend(struct.Options, struct.OptionOverrides || {});
                
                base = new ContextDefCluster(struct, clusterCollection, {G: this});
            }
        }

        if (struct.Render && base) {
            base.render(struct.RenderOptions);
        }
        
        return base;
    },

    generatePointAttributeCluster: function(contextModel) {
        // Deep copy
        var clusterDef = $.extend(true, {}, this.pointAttributeClusterDef);
        clusterDef.Name = contextModel.getNS('Label');

        // Iterate all active apps to pull in all of their attribute defs
        var appAttributes = _.object(_.compact(_.map(this.apps, function(app, appID) {
            // TODO/FIXME: Support duplicate handlers from multiple apps, with some kind of
            // sequencing or prioritization
            var appEventHandlers = app.getPointEventHandlers() || {};
            _.extend(clusterDef.EventHandlers, appEventHandlers);

            var a = app.getPointAttributeDefs();
            if (a && a.length > 0) {
                return [appID, a];
            }
        })));

        // If there's more than one app, put the attributes under a group node
        // Otherwise put the attributes around the root

        _.each(appAttributes, function(appAttributes, appID) {
            _.each(appAttributes, function(attrDef) {
                clusterDef.Nodes.push(attrDef);
            });
        });

        return clusterDef;
    },

    generateContextAttributeCluster: function(contextModel) {
        // Deep copy
        var clusterDef = $.extend(true, {}, this.clusterAttributeClusterDef);
        clusterDef.Name = contextModel.getNS('Label');

        // Iterate all active apps to pull in all of their attribute defs
        var appAttributes = _.object(_.compact(_.map(this.apps, function(app, appID) {
            // TODO/FIXME: Support duplicate handlers from multiple apps, with some kind of
            // sequencing or prioritization
            var appEventHandlers = app.getContextEventHandlers(contextModel) || {};
            _.extend(clusterDef.EventHandlers, appEventHandlers);

            var a = app.getContextAttributeDefs(contextModel);
            if (a && a.length > 0) {
                return [appID, a];
            }
        })));

        // If there's more than one app, put the attributes under a group node
        // Otherwise put the attributes around the root

        _.each(appAttributes, function(appAttributes, appID) {
            _.each(appAttributes, function(attrDef) {
                clusterDef.Nodes.push(attrDef);
            });
        });

        return clusterDef;
    },

    getActiveContextID: function() {
        return this.getCluster('Root').focusID;
    },

    setWorking: function(text) {
        this.updateLastActivity();

        if (this.localOnly || !this.$workingOverlay) {
            return;
        }

        //console.log('setWorking', text);

        text = text || 'Working...'
        $('.text', this.$workingOverlay).text(text);
        
        var randNum = Math.round(Math.random() * 1000000);
        this.lastWorkingRandNum = randNum;

        var _this = this;
        this.workingOverlayTimer = setTimeout(function() {
            if (_this.lastWorkingRandNum == randNum) {
                _this.$workingOverlay.show();
            }
        }, 200);
    },

    unsetWorking: function() {
        if (!this.$workingOverlay) {
            return;
        }
        
        this.lastWorkingRandNum = null;
        clearTimeout(this.workingOverlayTimer);
        this.$workingOverlay.hide();
    },

    historyEmpty: function() {
        this.hideDetails();
    },

    hideDetails: function() {
        this.streamGraphView && this.streamGraphView.hide();
        this.historyView && this.historyView.hide();
        $('.overlay-backing3', this.$el).hide();
    },

    showDetails: function(contextID) {
        var _this = this;
        $('.overlay-backing3', this.$el)
            .off('click')
            .click(this.hideDetails)
            .show();

        this.historyView.render({
            contextID: contextID
        });
        this.historyView.show();
        this.showStreamGraph(contextID);
    },

    showStreamGraph: function(contextID, windowSize, maxDisplayDepth, bringForward) {
        if (!this.streamGraphView) {
            return;
        }

        maxDisplayDepth = maxDisplayDepth || 1;

        this.streamGraphView.render({
            force: true,
            contextID: contextID,
            maxDisplayDepth: maxDisplayDepth,
            window: windowSize
        });
        this.streamGraphView.show();
    },

    updateStreamGraph: function(force) {
        if (!this.streamGraphView) {
            return;
        }
        this.streamGraphView.render({
            force: force
        });
    },

    toggleOverlay: function(force, quick) {
        this.updateLastActivity();

        var lastValue = this.overlayVisible;
        if (force === true) {
            this.overlayVisible = true;
        }
        else if (force === false) {
            this.overlayVisible = false;
        }
        else {
            this.overlayVisible = !this.overlayVisible;
        }

        var width = $('body').width(),
            height = $('body').height();

        if (this.overlayVisible) {
            //$('.overlay-backing').show();
            if (quick) {
                $('.timeline-container', this.$el)
                    .css({
                            opacity: 1
                        })
                    .show()
            }
            else {
                $('.timeline-container', this.$el)
                    .css({
                        opacity: 0
                    })
                    .show()
                    .animate({
                        'opacity': 1
                    }, {duration: 300});
            }
        }
        else {
            if (quick) {
                $('.timeline-container', this.$el).hide();
            }
            else {
                $('.timeline-container', this.$el)
                    .animate({
                            'opacity': 0
                        }, {
                            duration: 150,
                            complete: function() {
                                $(this).hide();
                            }
                        });
            }
        }
    },

    containerHost: window.location.protocol + '//' + window.location.hostname + ':' + window.location.port + '/app',

    loginUser: function(userName, password, callback) {
        var data = {
            'Username': userName,
            'Password': password
        }

        this.setWorking();

        var s = _.bind(function(response, textStatus, jqXHR) {
            this.unsetWorking();
            response = response || {};
            var success = false;

            if (response.UserID) {
                success = true;
                this.isAuthenticated = true;
                this.trigger('UserLoggedIn', response);
            }

            if (callback) {
                callback(success, response);
            }
        }, this);

        var e = _.bind(function() {
            this.unsetWorking();

            if (callback) {
                callback(false);
            }
        });

        this.ajaxPost('/user/login', data, s, e);
    },

    addLinkedContext: function(contextID, linkContextID, clusterID, linkClusterID) {
        this.updateLastActivity();

        var linkCluster = this.getCluster(linkClusterID),
            linkModel = linkCluster.contexts.get(linkContextID),
            label = 'link-' + linkModel.id;

        var data = {
            'Label': label
        }

        this.setWorking();

        var _this = this;
        var s = function(response, textStatus, jqXHR) {
            if (response && response.Success) {
                _this.loadData(null, true);
            }
            else {
                _this.unsetWorking();
            }
        }

        this.ajaxGet('/data/context/' + contextID + '/create', data, s);
    },

    addLinkedPoint: function(contextID, linkContextID, clusterID, linkClusterID) {
        var data = {
                'ParentContextID': contextID,
                'LinkContextID': linkContextID
            };

        this.updateLastActivity();

        var s = _.bind(function(response, textStatus, jqXHR) {
            if (response && response.Success) {
                this.toggleOverlay(true);

                var cluster = this.getCluster(clusterID),
                    linkCluster = this.getCluster(linkClusterID);

                // FIXME?
                var contextModel = cluster.contexts.get(contextID);
                contextModel.metaData.set('CurrentScore', 0);

                var linkContextModel = linkCluster.contexts.get(linkContextID);
                linkContextModel.metaData.set('CurrentScore', 0);

                // Refresh current focus
                // TODO: All affected clusters need to be updated
                cluster.render();

                linkCluster.render();
            }
        }, this);

        this.jsonGet('/data/context/' + contextID + '/add_point?callback=?', data, s);
    },

    addFeedback: function(contextID, val) {
        val = val || 0;

        var data = {
            'ParentContextID': contextID,
            'FeedbackVal': val
        }

        var s = function(response, textStatus, jqXHR) {
            if (response && response.Success) {
            }

        }

        this.jsonGet('/data/point/add2?callback=?', data, s);
    },

    ajaxGet: function(url, data, success, error, complete, timeout) {
        data = data || {};
        error = error || this.defaultErrorCallback;
        success = success || this.defaultSuccessCallback;
        timeout = timeout || 10000;

        data.SessionID = this.sessionID;

        $.ajax(this.containerHost + url, {
            data: data,
            //contentType : 'application/json',
            type: 'GET',
            //dataType: 'json',
            success: success,
            error: error,
            complete: complete,
            timeout: timeout
        });
    },

    ajaxPost: function(url, data, success, error, complete, timeout) {
        data = data || {};
        error = error || this.defaultErrorCallback;
        success = success || this.defaultSuccessCallback;
        timeout = timeout || 10000;

        data.SessionID = this.sessionID;

        $.ajax(this.containerHost + url, {
            data: data,
            type: 'POST',
            success: success,
            error: error,
            complete: complete,
            timeout: timeout
        });
    },

    jsonGet: function(url, data, success, error, complete, timeout) {
        data = data || {};
        error = error || this.defaultErrorCallback;
        success = success || this.defaultSuccessCallback;
        timeout = timeout || 10000;

        data.SessionID = this.sessionID;

        $.ajax(this.containerHost + url, {
            data: {
                'Params': JSON.stringify(data)
            },
            contentType : 'application/json',
            type: 'GET',
            dataType: 'json',
            success: success,
            error: error,
            complete: complete,
            timeout: timeout
        });
    },

    defaultSuccessCallback: function(response, textStatus, jqXHR) {
        console.log('success', response);
        this.unsetWorking();
    },

    defaultErrorCallback: function(jqXHR, textStatus, errorThrown) {
        console.log('error', textStatus);
        this.unsetWorking();
    },

    modelErrorCallback: function(model, jqXHR, options) {
        if (jqXHR && jqXHR.responseJSON && jqXHR.responseJSON.Type == 'Authentication Error') {
            this.trigger('AuthLost');
        }
        else {
            console.log('Model error', model, jqXHR, options);
        }
        
        this.unsetWorking();
    },

    checkOnlineState: function() {
        this.isAuthenticated = false;
        var s = _.bind(function(response, textStatus, jqXHR) {
            if (jqXHR.status == 403) {
                console.log('User not yet authorized');
                this.trigger('UserNotAuthenticated');
            }
            else if (jqXHR.status === 200) {
                this.isAuthenticated = true;
                this.trigger('UserAuthenticated', response);
            }
        }, this);

        var e = _.bind(function(response, textStatus, jqXHR) {
            if (response.status == 403) {
                console.log('User not yet authorized');
                this.trigger('UserNotAuthenticated');
            }
            else {
                // Proceed to offline init
                console.log('Server is inaccessible: ' + textStatus);
                this.localInit();
            }
        }, this);

        this.ajaxGet('/test', {}, s, e);
    },

    remoteInit: function(contextID, serverLastID) {
        // Proceed to online init
        console.log('Remote data is accessible');
        this.localSet('RootContextID', contextID);
        this.initCollections(contextID);

        var _this = this;
        _.bindAll(this, 'fetchData');

        // Initialize IDs
        this.initRemoteIDs(serverLastID, function() {
            // Fetch data locally
            _this.fetchData({
                success: function() {
                    console.log('local fetch success', Date.now());
                    // Sync any local changes back to server
                    _this.syncDirty(
                        // Load remote data afresh
                        _this.fetchData
                    );
                }, 
                localOnly: true
            });
        });
    },

    localOnlyInit: function(rootContextID, initialData) {
        this.initCollections(rootContextID);

        this.globalCollection.__proto__.local = true;
        this.globalCollection.model.prototype.local = true;
        this.globalPoints.__proto__.local = true;
        this.globalPoints.model.prototype.local = true;
        this.globalAssociations.__proto__.local = true;
        this.globalAssociations.model.prototype.local = true;

        this.fetchData({
            localOnly: true,
            initialData: initialData
        });
    },

    localInit: function(rootContextID) {
        rootContextID = rootContextID || this.localGet('RootContextID');
        this.initCollections(rootContextID);

        this.fetchData({
            localOnly: true
        });
    },

    initCollections: function(rootContextID) {
        this.rootContextID = rootContextID;

        var Data = require('app/models/Data');

        if (!this.globalPoints) {
            this.globalPoints = new Data.Points([], {rootID: rootContextID, G: this});
            this.globalPoints.storeName = 'BenomeStore-' + this.instanceID + '-Points';
        }
        this.globalPoints.url = '/app/data/points/' + rootContextID;

        if (!this.globalAssociations) {
            this.globalAssociations = new Data.Associations([], {G: this});
            this.globalAssociations.storeName = 'BenomeStore-' + this.instanceID + '-Associations';
        }
        this.globalAssociations.url = '/app/data/associations/' + rootContextID;

        if (!this.globalCollection) {
            this.globalCollection = new Data.Contexts([], {
                rootID: rootContextID,
                associations: this.globalAssociations,
                points: this.globalPoints,
                G: this
            });
            this.globalCollection.storeName = 'BenomeStore-' + this.instanceID + '-Contexts';
        }
        this.globalCollection.url = '/app/data/contexts/' + rootContextID;

        this.dataCollections = {
            'Points': this.globalPoints,
            'Contexts': this.globalCollection,
            'Associations': this.globalAssociations
        }
    },

    syncDirty: function(successCallback) {
        this.setWorking('Synchronizing offline changes');

        var dirtyCollections = _.filter(this.dataCollections, function(col) {
            return col.dirtyModels().length > 0 || col.destroyedModelIds().length > 0;
        });

        var numDirtyCollections = _.values(dirtyCollections).length;
        if (!numDirtyCollections) {
            console.log('No dirty collections to sync');
            successCallback();
            return;
        }

        var colSyncFinished = _.after(numDirtyCollections, function() {
            console.log(numDirtyCollections + ' dirty collections syncd');
            successCallback();
        });

        _.each(dirtyCollections, function(col) {
            var numCalls = col.dirtyModels().length + col.destroyedModelIds().length;

            var dirtyModelSuccess = _.after(numCalls, function(model, response, options) {
                console.log('dirtyModelSuccess');
                colSyncFinished();
            });

            col.syncDirtyAndDestroyed({
                success: dirtyModelSuccess
            });
        }, this);
    },

    fetchData: function(options) {
        options = options || {};

        var successCallback = options.success || null,
            localOnly = options.localOnly || false,
            initialData = options.initialData || null;

        if (!localOnly) {
            this.setWorking('Loading data');
        }
        _.bindAll(this, 'loadFinished');

        successCallback = successCallback || this.loadFinished;

        var colFetchBeginTimes = {};
        var fetchDataBeginTime = Date.now();

        var numCollections = _.values(this.dataCollections).length;
        var fetchSuccess = _.after(numCollections, _.bind(function(collection, textStatus, jqXHR) {
            successCallback(initialData);
        }, this));

        _.each(this.dataCollections, function(col, colName) {
            colFetchBeginTimes[col.url] = Date.now();
            var options = {
                success: function x(collection) {
                    console.log('Fetch ' + collection.url, Date.now() - colFetchBeginTimes[collection.url]);
                    fetchSuccess(collection);
                }
            };

            if (localOnly) {
                options.remote = false;
            }
            col.fetch(options);
        });

        console.log('Data fetch', Date.now() - fetchDataBeginTime);
    },

    loadFinished: function(initialData) {
        this.setWorking('Rendering');

        if (initialData) {
            _.each(initialData, function(initialData, collectionID) {
                var col = this.dataCollections[collectionID],
                    models = col.add(initialData);

                _.each(models, function(model) {
                    model.save({}, {
                        'silent': true
                    });
                })
            }, this);
        }

        this.globalPoints.on('change add remove', function(pointModel, response) {
            var pointContext = pointModel.getContext();
            if (pointContext) {
                pointContext.trigger('PointChanged', pointModel);
            }
        });

        var rootCollection = this.globalCollection;

        /*var userRootContext = this.globalCollection.find(function(model) {
            return model.get('Type') == 'UserRoot'
        });
        */
        var userRootContextID = 1004;
        rootCollection = this.globalCollection.collectionFromRoot(userRootContextID);
        rootCollection.storeName = 'BenomeStore-' + this.instanceID + '-Contexts';

        this.trigger('LoadFinished', this.globalCollection, rootCollection);
    },

    initRemoteIDs: function(serverLastID, successCallback) {
        // Get a new block range if none is set or nearing the end
        var lastID = parseInt(this.localGet('LastID')),
            beginIDRange = parseInt(this.localGet('CurrentBeginIDRange')),
            endIDRange = parseInt(this.localGet('CurrentEndIDRange')),
            nextRangeBegin = parseInt(this.localGet('NextBeginIDRange')),

            nextRangeReady = !!nextRangeBegin,
            rangeNearlyExhausted = ((lastID - beginIDRange) / (endIDRange - beginIDRange)) >= 0.7;

        this.lastID = lastID;
        this.beginIDRange = beginIDRange;
        this.endIDRange = endIDRange;

        console.log('Current lastID is ' + this.lastID + ', endRange is ' + this.endIDRange);
        if (lastID > 0 && lastID >= serverLastID && (nextRangeReady || !rangeNearlyExhausted)) {
            console.log('Using current IDs');
            successCallback();
            return;
        }

        console.log('Getting next range from server');
        var s = _.bind(function(response, textStatus, jqXHR) {
            if (jqXHR.status === 200 && response) {
                var blockBegin = response.Begin,
                    blockEnd = response.End;

                if (rangeNearlyExhausted) {
                    // Only do this once per block
                    this.localSet('NextBeginIDRange', blockBegin);
                    this.localSet('NextEndIDRange', blockEnd);
                }
                else {
                    // The initial ID-block load
                    lastID = blockBegin;
                    this.localSet('LastID', lastID);
                    this.localSet('CurrentBeginIDRange', blockBegin);
                    this.localSet('CurrentEndIDRange', blockEnd);

                    this.beginIDRange = blockBegin;
                    this.endIDRange = blockEnd;
                }

                this.lastID = lastID;
                console.log('New lastID is ' + this.lastID + ', endRange is ' + this.endIDRange);
                successCallback();
            }
            else if (jqXHR.status == 403) {
                this.debugMsg('User not yet authorized');
            }
        }, this);

        var e = _.bind(function(response, textStatus, jqXHR) {
            this.debugMsg('Failed to get ID block');
        }, this);

        this.ajaxGet('/get_id_block/' + this.idRangeSize, {}, s, e);
    },

    initLocalIDs: function() {
        var rangeSize = this.idRangeSize,
            lastID = parseInt(this.localGet('LastID')),
            beginIDRange = parseInt(this.localGet('CurrentBeginIDRange')),
            endIDRange = parseInt(this.localGet('CurrentEndIDRange'));

        if (!lastID) {
            beginIDRange = this.localOnlyInitialID;
            endIDRange = beginIDRange + rangeSize;
            lastID = beginIDRange;

            this.localSet('LastID', lastID);
            this.localSet('CurrentBeginIDRange', beginIDRange);
            this.localSet('CurrentEndIDRange', endIDRange);

            this.localSet('NextBeginIDRange', endIDRange + 1);
            this.localSet('NextEndIDRange', endIDRange + rangeSize);
        }

        this.lastID = lastID;
        this.beginIDRange = beginIDRange;
        this.endIDRange = endIDRange;

        var newSession = false,
            currentRootContextID = parseInt(this.localGet('LocalRootContextID')) || null;

        if (!currentRootContextID) {
            currentRootContextID = this.nextID();
            this.localSet('LocalRootContextID', currentRootContextID);
            newSession = true;
        }
        
        return {
            rootContextID: currentRootContextID, 
            newSession: newSession
        }
    },

    setUILayers: function(refZIndex, above) {
        above = above || [];

        this.layerZIndexStacks = this.layerZIndexStacks || {
            'Timeline': [],
            //'History': [],
            'Creator': [],
            'Destroyer': []
        }

        var aboveZIndex = refZIndex + 100000,
            belowZIndex = refZIndex - 1;

        _.each(this.layerZIndexStacks, function(stack, elementID) {
            var zIndex = _.contains(above, elementID) ? aboveZIndex : belowZIndex;

            if (elementID == 'Timeline') {
                if (this.timelineView) {
                    this.layerZIndexStacks['Timeline'].push(this.timelineView.$el.css('z-index'));
                    this.timelineView.$el.css({
                        'z-index': zIndex
                    });
                }
            }
            else if (elementID == 'Creator') {
                if (this.creatorView) {
                    this.layerZIndexStacks['Creator'].push(this.creatorView.$el.css('z-index'));
                    this.creatorView.$el.css({
                        'z-index': zIndex
                    });
                }
            }
            else if (elementID == 'Destroyer') {
                if (this.destroyerView) {
                    this.layerZIndexStacks['Destroyer'].push(this.destroyerView.$el.css('z-index'));
                    this.destroyerView.$el.css({
                        'z-index': zIndex
                    });
                }
            }
        }, this);
    },

    unsetUILayers: function() {
        _.each(this.layerZIndexStacks, function(stack, elementID) {
            if (stack.length == 0) {
                return;
            }

            var prevZIndex = stack.pop();
            if (elementID == 'Timeline') {
                if (this.timelineView) {
                    this.timelineView.$el.css({
                        'z-index': prevZIndex
                    });
                }
            }
            else if (elementID == 'Creator') {
                if (this.creatorView) {
                    this.creatorView.$el.css({
                        'z-index': prevZIndex
                    });
                }
            }
        }, this);
    },

    exportData: function(contextCollection, noJSON) {
        contextCollection = contextCollection || this.globalCollection;

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
            'Contexts': contexts,
            'Associations': associations,
            'Points': points
        }

        if (!noJSON) {
            return JSON.stringify(exportStruct);
        }
        else {
            return exportStruct;
        }
    },

    updateLastActivity: function() {
        this.lastActivity = Date.now();
    }
});
_.extend(Global.prototype, Backbone.Events);

function GlobalFactory(instanceID) {
    var f = GlobalFactory,
        instanceID = instanceID || null,
        x = 0;

    if (!instanceID) {
        try {
            while (f.caller && x < 50) {
                if (f.arguments.length && f.arguments[0] && f.arguments[0].instanceID) {
                    instanceID = f.arguments[0].instanceID;
                    break;
                }
                
                f = f.caller;
                x += 1;
            }
        }
        catch (e) {
            
        }
    }

    if (!instanceID) {
        console.log('InstanceID not found');
        console.trace();
    }

    if (!(instanceID in globalMap)) {
        //console.log('New instance found', instanceID)
        globalMap[instanceID] = new Global(instanceID);
    }
    else {
        //console.log('Existing instanceID', instanceID);
    }
    return globalMap[instanceID];
}

module.exports = GlobalFactory;