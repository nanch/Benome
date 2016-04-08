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
    jQueryMouseWheel = require('jquery.mousewheel')($),
    jQueryColor = require('app/lib/jquery.color'),
    jQueryTransit = require('app/lib/jquery.transit'),
    Backbone = require('backbone'),
    moment = require('app/lib/moment'),
    Hammer = require('hammerjs'),
    _ = require('backbone/node_modules/underscore'),
    BackboneDualStorage = require('app/lib/backbone.dualstorage.amd');

window.$ = window.jQuery = $;
Backbone.$ = $;

// App
var LayoutView = require('app/views/LayoutView'),
    HistoryView = require('app/views/HistoryView'),
    CreatorView = require('app/views/CreatorView'),
    StreamGraphView = require('app/views/StreamGraphView'),
    TimelineView = require('app/views/TimelineView'),
    AutoActionView = require('app/views/AutoActionView'),
    QuickContextActions = require('app/views/QuickContextActions'),
    PointActions = require('app/views/PointActions'),
    AdminView = require('app/views/AdminView'),
    PressIndicator = require('app/views/PressIndicator'),
    DetailSpectrum = require('app/views/DetailSpectrum');

// Mixins
var ColorsMixin = require('app/mixins/Colors'),
    //IntervalsMixin = require('app/mixins/Intervals'),
    DragDropMixin = require('app/mixins/DragDrop'),
    ServerInterfaceMixin = require('app/mixins/ServerInterface'),
    UtilsMixin = require('app/mixins/Utils'),
    DataMixin = require('app/mixins/Data'),
    UIMixin = require('app/mixins/UI');

// -------------

(function(window, document) {
var _Benome = function(config) {
    this.config = config || {};

    this.Mixins = {};
    this.Classes = {};
    this.Views = {};
    this.Collections = {};
    this.Models = {};

    this.localOnly = true;

    this.userName = config.userName;
    this.sessionID = config.sessionID;

    this.initialID = 124;
    this.idRangeSize = 1000;

    this.rootContextID = config.rootID;
    this.points = config.points;
    this.contexts = config.contexts;
    this.qualityData = config.qualityData;

    this.clusters = {};

    this.animDisabled = false;
    this.minLightness = 0.15;
    this.numDetailLevels = 6;
    this.autoActionDelay = 25;

    this.featureState = {
        'PointDetail': true,
        'LeafFocusToggleTimer': true,
        'LeafFocusAutoAdd': true,
        'Admin': true,
        'DetailLevels': true
    }

    this.darkText = '#555';
    this.lightText = '#aaa';
};

_.extend(_Benome.prototype, {
    isMobile: ('ontouchstart' in document.documentElement),
    isAndroid: (/android/i.test(navigator.userAgent)),
    isApple: (/iphone|ipod|ipad/i.test(navigator.userAgent)),
    isMac: (/Macintosh/.test(navigator.userAgent)),
    isTablet: (/ipad/i.test(navigator.userAgent) || ((/android/i.test(navigator.userAgent)) && !(/mobile/i.test(navigator.userAgent)))),

    FEATURE: function(feautureID) {
        return this.featureState[feautureID] !== false;
    },

    init: function(config) {
        config = config || {};
        _.extend(this.config, config);
        _.bindAll(this, 'handleResize', 'toggleOverlay', 
            'getContext', 'activityClicked', 'activityPressed', 'dataRefresh', 'mouseWheel', 
            'clusterIdle', 'beforeFocusChanged', 'historyEmpty', 'hideDetails',
            'commonPointDragHandler', 'onCreateContext', 'onCreateContextSuccess',
            'defaultErrorCallback', 'defaultSuccessCallback', 'modelErrorCallback',
            'fetchData', 'loadFinished');

        this._ = _;
        this.moment = moment;

        this.layoutView = new LayoutView({
            el: $('body')
        });

        this.clusterLayouts = {
            '1': {
                radiusScaleFactor: !this.isTablet && this.isMobile ? 0.5 : 0.43,
                scaleFactor: !this.isTablet && this.isMobile ? 0.6 : 0.6,
                spaceFactor: 0.7,
                focusAngleArc: 360,
                focusStartAngle: 30,
                childAngleArc: 210,
                maxDepth: !this.isTablet && this.isMobile ? 3 : 4,
                numDetailLevels: this.numDetailLevels,
                position: function(globalSize) {
                    return {
                        x: globalSize.width / 2,
                        y: globalSize.height / 2
                    }
                }
            },
            '2': {
                radiusScaleFactor: 0.4,
                scaleFactor: 0.7,
                spaceFactor: 0.7,
                focusAngleArc: 90,
                forceFocusStartAngle: true,
                focusStartAngle: -5,
                childAngleArc: 120,
                numDetailLevels: this.numDetailLevels,
                position: function(globalSize) {
                    return {
                        x: globalSize.width / 6,
                        y: globalSize.height / 6
                    }
                }
            },
            '3': {
                radiusScaleFactor: 0.15,
                scaleFactor: 0.95,
                spaceFactor: 0.7,
                focusAngleArc: 180,
                forceFocusStartAngle: true,
                focusStartAngle: 90,
                childAngleArc: 1,
                childLimit: 2,
                numDetailLevels: this.numDetailLevels,
                position: function(globalSize) {
                    return {
                        x: globalSize.width * 0.1,
                        y: globalSize.height * 0.1
                    }
                }
            }
        }

        this.defaultMaxDepth = null;
        this.defaultFilter = 0;

        this.showLabels = this.QueryString.p !== '1';
        this.labelIDsOnly = this.QueryString.i === '1';
        this.autoActionDelay = parseInt(this.QueryString.aa) || this.autoActionDelay;

        if (parseInt(this.QueryString.d) >= 1) {
            this.defaultFilter = Math.min(10, parseInt(this.QueryString.d)) - 1;
        }

        this.clusterLayoutID = this.QueryString.l;
        if (!(this.clusterLayoutID in this.clusterLayouts)) {
            this.clusterLayoutID = '1';
        }

        this.sessionID = config.sessionID;
        this.contextID = config.contextID || null;

        this.mobileFont = !this.isTablet && this.isMobile;
        this.fontSize = 25;
        if (this.mobileFont) {
            this.fontSize = 12;
        }
        $('body').css('font-size', this.fontSize + 'px');

        this.initEvents();

        this.overlayVisible = false;
        this.toggleOverlay(this.overlayVisible);

        this.$workingOverlay = $('#working-overlay');
        this.$addFeedback = $('#point-add-feedback');

        var _this = this;
        $('#overlay-backing').click(function() {
            _this.toggleOverlay(false);
        });

        var mc = new Hammer($('body').get()[0]);
        mc.on('tap', _.bind(function(e) {
            if (e.target.nodeName == 'BODY') {
                this.toggleOverlay(false);
            }
        }, this));

        /*this.streamGraphView = new StreamGraphView({
            el: $('#viz-container'),
            includeColorKey: false,
            includeBackButton: false,
            noDepth: true,
            defaultWindowSize: 86400 * 7
        });*/

        // Delay resize until there is a pause
        this.handleResize = _.debounce(this.handleResize, 400);
        $(window).bind('resize', this.handleResize);

        this.defaultClusterOptions = {
            el: $('body'),
            hideRoot: false,
            layoutChange: true,
            
            hideLabels: !this.showLabels,
            labelIDsOnly: this.labelIDsOnly
        };

        this.creatorView = new CreatorView({
            el: $('#creator-view')
        });
        this.creatorView.render();

        this.pressIndicator = new PressIndicator();

        /*this.dataRefreshInterval = 10 * 60 * 1000;
        _.delay(this.dataRefresh, this.dataRefreshInterval);*/

        this.lastActivity = Date.now();

        this.newIdle = true;

        // After one minute of idle time, transition to low detail over the next two minutes.
        this.targetDataFilter = 8; // This will be dynamic
        this.idleThreshold = 60 * 1000; 
        this.idleMax = 180 * 1000;
        this.filterInterval = 5 * 1000;

        //_.delay(this.clusterIdle, this.filterInterval);

        if (this.localOnly) {
            var rangeSize = this.idRangeSize,
                lastID = parseInt(localStorage.getItem('LastID')),
                beginIDRange = parseInt(localStorage.getItem('CurrentBeginIDRange')),
                endIDRange = parseInt(localStorage.getItem('CurrentEndIDRange'));

            if (!lastID) {
                beginIDRange = this.initialID;
                endIDRange = beginIDRange + rangeSize;
                lastID = beginIDRange;

                localStorage.setItem('LastID', lastID);
                localStorage.setItem('CurrentBeginIDRange', beginIDRange);
                localStorage.setItem('CurrentEndIDRange', endIDRange);

                localStorage.setItem('NextBeginIDRange', endIDRange + 1);
                localStorage.setItem('NextEndIDRange', endIDRange + rangeSize);
            }

            this.lastID = lastID;
            this.beginIDRange = beginIDRange;
            this.endIDRange = endIDRange;

            var newSession = false,
                currentRootContextID = localStorage.getItem('LocalRootContextID') || null;

            if (!currentRootContextID) {
                currentRootContextID = this.nextID();
                localStorage.setItem('LocalRootContextID', currentRootContextID);
                newSession = true;
            }

            this.rootContextID = currentRootContextID;

            var initialData = null;
            if (newSession) {
                initialData = {
                    Contexts: [
                        {
                            'sid': currentRootContextID,
                            'label': '',

                            'recordType': 'Point',
                            'timeStamp': Date.now() / 1000,
                            'scoreAdjust': 0,
                            'attributes': {},
                            'Properties': {},
                            'MetaData': {
                                'TimeSince': null,
                                'RecentInterval_10': null,
                                'RecentInterval_5': null,
                                'Weight': 1.0,
                                'CurrentScore': 0
                            }
                        }
                    ]
                }
            }
            this.localOnlyInit(this.rootContextID, initialData);
        }
        else {
            this.checkOnlineState();
        }

        /*if (this.getCookie('remember_token') || this.getCookie('session')) {
            this.loadData(null, this.onDataLoaded);
        }
        else {
            this.render();
        }*/
    },

    initEvents: function() {
        this.initDragDrop();

        this.on('ActivityClicked', this.activityClicked);
        this.on('ActivityPressed', this.activityPressed);
        this.on('BeforeFocusChanged', this.beforeFocusChanged);
        this.on('HistoryEmpty', this.historyEmpty);
        this.on('ShowPointDetail', _.bind(this.showPointDetail, this));
        this.on('CreateContext', this.onCreateContext);
        this.on('ShowAdmin', _.bind(this.showAdmin, this));
        
        
        if (B.FEATURE('DetailLevels')) {
            // Disable scrolling for multi-touch mouse. Need a better way to detect it.
            if (!this.isMac) {
                $('body').mousewheel(this.mouseWheel);
            }

            this.detailSpectrum = new DetailSpectrum({
                el: $('#detail-spectrum'),
                numDetailLevels: this.numDetailLevels
            });
            this.detailSpectrum.render();
        }
    },

    initUI: function() {
        this.contextRename = new QuickContextActions({
            el: $('#quick-context-actions'),
            $overlay: $('#overlay-backing2')
        });
        this.contextRename.render();

        if (B.FEATURE('Admin')) {
            this.adminView = new AdminView({
                el: $('#admin-view'),
                $overlay: $('#overlay-backing2')
            });
            this.adminView.render();
        }

        if (B.FEATURE('PointDetail')) {
            this.pointActions = new PointActions({
                el: $('#point-actions'),
                $container: $('#point-action-container'),
                $overlay: $('#overlay-backing4')
            });
            this.pointActions.render().appendTo($('#point-action-container'));
        }

        this.historyView = new HistoryView({
            el: $('#history-container'),
            hideLabels: !this.showLabels,
            dragHandler: this.commonPointDragHandler
        });

        if (B.FEATURE('LeafFocusAutoAdd')) {
            this.autoActionView = new AutoActionView({
                el: $('#auto-action-container'),
                delay: this.autoActionDelay
            });
            this.autoActionView.render();
        }

        this.timelineView = new TimelineView({
            el: $('#timeline-container'),
            hideLabels: !this.showLabels,
            dragHandler: this.commonPointDragHandler
        });
        this.timelineView.render(this.globalPoints);
    },

    render: function(options) {
        options = options || {};

        var globalSize = this.globalSize(),
            d = (globalSize.height + globalSize.width) / 2;

        if (this.rootContextID) {
            var css = {
                'right': (d * 0.01) + 'px',
                'top': (d * 0.01) + 'px',
                'width': (d * 0.15) + 'px',
                'height': (d * 0.15) + 'px'
            }

            if (options.newLogin) {
                this.creatorView.$el.animate(css);
            }
            else {
                this.creatorView.$el.css(css);
            }

            this.$addFeedback.css({
                'right': (d * 0.01) + 'px',
                'top': (d * 0.15) + 'px'
            });

            var timelineWidth = this.fontSize * 8;
            $('#timeline-container')
                .css({
                    'left': (globalSize.width - timelineWidth) + 'px',
                    'width': timelineWidth + 'px'
                });
        }
        else {
            this.$addFeedback.hide();
            $('#timeline-container').hide();

            var w = (d * 0.25),
                h = (d * 0.25);

            var css = {
                'right': ((globalSize.width / 2) - (w / 2)) + 'px',
                'top': ((globalSize.height / 2) - (h / 2)) + 'px',
                'width': w + 'px',
                'height': h + 'px'
            }

            this.creatorView.showLogin({
                userName: this.userName
            });

            if (options.newLogin) {
                this.creatorView.$el.animate(css);
            }
            else {
                this.creatorView.$el.css(css);
            }
        }

        var rootCluster = this.getCluster('Root');
        if (rootCluster) {
            rootCluster.setRadius(this.getDefaultClusterSize())

            var clusterLayout = this.getClusterLayout();
            rootCluster.setPosition(clusterLayout.position(globalSize));
            rootCluster.render({
                noAnimate: true
            });
        }
    },

    clusterIdle: function() {
        var idleTime = Date.now() - this.lastActivity;
        if (idleTime > this.idleThreshold) {
            if (this.newIdle) {
                this.initialFilterLevel = this.currentFilterLevel;
            }
            this.newIdle = false;

            idleTime = Math.min(this.idleMax, idleTime);

            var idleFactor = (idleTime - this.idleThreshold) / (this.idleMax - this.idleThreshold);
            var filterAdjust = (this.targetDataFilter - this.initialFilterLevel) * idleFactor;
            var filterValue = parseInt(Math.round(this.initialFilterLevel + filterAdjust));
            //console.log(idleTime, idleFactor, this.initialFilterLevel, filterAdjust, filterValue);
            this.setTransform(filterValue);
        }
        else {
            this.newIdle = true;
        }

        _.delay(this.clusterIdle, this.filterInterval);
    },

    dataRefresh: function() {
        //this.loadData();
        _.delay(this.dataRefresh, this.dataRefreshInterval);
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

    getClusterZIndex: function(clusterID) {
        var lastClusterZIndex = this.lastClusterZIndex || 20000;
        if (clusterID != this.lastClusterID) {
            lastClusterZIndex += 1000;
            this.lastClusterZIndex = lastClusterZIndex;
        }
        return lastClusterZIndex;
    },

    getContext: function(contextID) {
        return this.globalCollection.get(contextID);
    },

    getPoint: function(pointID) {
        return this.globalPoints.get(pointID);
    },

    getAssociation: function(assocName, sourceContextID, destContextID) {
        var assocID = assocName;
        if (sourceContextID && destContextID) {
            assocID = sourceContextID + '|' + assocName + '|' + destContextID;
        }
        return this.globalAssociations.get(assocID);
    },

    setFocus: function(contextID) {
        var rootCluster = this.getCluster('Root');
        rootCluster.setFocus(contextID, true);
    },

    handleResize: function() {
        if (this.resizeDisabled) {
            return;
        }
        this.toggleOverlay(false);
        this.render();
    },

    mouseWheel: function(e, delta, deltaX, deltaY) {
        this.lastActivity = Date.now();

        var origEv = e.originalEvent,
            adjust = deltaY < 0 ? -0.1 : 0.1;

        if (origEv.ctrlKey) {
            /*scaleFactor += adjust;
            scaleFactor = Math.min(2.0, Math.max(0.0, scaleFactor));*/
        }
        else if (origEv.altKey) {
            /*spaceFactor += adjust;
            spaceFactor = Math.min(5.0, Math.max(0.0, spaceFactor));*/
        }
        else if (origEv.shiftKey) {
            /*radiusScaleFactor += adjust;
            radiusScaleFactor = Math.min(2.0, Math.max(0.0, radiusScaleFactor));*/
        }
        else {
            var deltaLevel = 0;
            if (deltaY < 0) {
                // Reduce detail level
                deltaLevel = 1;
            }
            else if (deltaY > 0) {
                // Increase detail level
                deltaLevel = -1;
            }

            if (deltaLevel != 0) {
                this.clearDebug();
                var rootCluster = this.getCluster('Root');
                rootCluster.setFilterLevel(deltaLevel, { relative: true, noRender: true});
                rootCluster.debounceRender();
            }
        }

        e.preventDefault();
        return false;
    }
});
_.extend(_Benome.prototype, Backbone.Events);
_.extend(_Benome.prototype, UIMixin);
_.extend(_Benome.prototype, UtilsMixin);
_.extend(_Benome.prototype, DataMixin);
_.extend(_Benome.prototype, ColorsMixin);
//_.extend(_Benome.prototype, IntervalsMixin);
_.extend(_Benome.prototype, DragDropMixin);
_.extend(_Benome.prototype, ServerInterfaceMixin);

window.Benome = window.B = new _Benome({
    sessionID: window.BENOME_SESSION_ID,
    userName: window.BENOME_USERNAME,
    rootID: window.rootID,
    qualityData: window.qualityData,
    contexts: window.contexts,
    points: window.points
});
}(window, document));

$(function() {
    B.init({
        code: window.BENOME_SESSION_CODE
    });
});
