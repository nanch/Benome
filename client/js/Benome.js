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
    _ = require('underscore'),
    Backbone = require('backbone'),
    moment = require('moment'),
    BackboneDualStorage = require('app/lib/backbone.dualstorage.amd');

window._ = _;
window.$ = window.jQuery = $;

// -------------
var baseHTML = require('app/BaseHTML'),
    PressIndicator = require('app/views/PressIndicator'),
    DetailSpectrum = require('app/views/DetailSpectrum'),
    AutoActionView = require('app/views/AutoActionView'),
    CreatorView = require('app/views/CreatorView'),
    DestroyerView = require('app/views/DestroyerView'),
    LoginView = require('app/views/LoginView'),
    TimelineView = require('app/views/TimelineView'),
    ActivityPath = require('app/ActivityPath'),
    AdminView = require('app/views/AdminView'),
    GetHelpView = require('app/views/GetHelpView'),
    HelpView = require('app/views/HelpView'),
    AppController = require('app/Controller'),
    KeyboardHandler = require('app/modules/Keyboard');

// -------------

var Benome = Backbone.View.extend({
    tagName: 'div',
    className: 'benome',

    events: {
    },

    hideLabels: false,
    labelIDsOnly: false,
    autoActionDelay: 25,
    idleThreshold: 2 * 60 * 1000, // 2 minutes
    appTimerInterval: 5 * 1000,

    lastClusterRefresh: Date.now(),
    clusterRefreshInterval: 5 * 60 * 1000, // every 5 minutes
    defaultBackgroundColor: '#000',

    isMobile: ('ontouchstart' in document.documentElement),
    isAndroid: (/android/i.test(navigator.userAgent)),
    isApple: (/iphone|ipod|ipad/i.test(navigator.userAgent)),
    isMac: (/Macintosh/.test(navigator.userAgent)),
    isTablet: (/ipad/i.test(navigator.userAgent) || ((/android/i.test(navigator.userAgent)) && !(/mobile/i.test(navigator.userAgent)))),

    initialize: function(options) {
        options = options || {};
        this.G = this.G || options.G || require('app/Global')();
        _.bindAll(this, 'handleResize', 'dropHandler', 'mouseWheel', 'appTimer');

        var _this = this,
            G = this.G;

        this.options = options;
        this.$container = this.$el;

        this.autoActionDelay = options.autoActionDelay || this.autoActionDelay;
        this.hideLabels = options.hideLabels !== null ? options.hideLabels : this.hideLabels;
        this.labelIDsOnly = options.labelIDsOnly !== null ? options.labelIDsOnly : this.labelIDsOnly;
        this.localOnly = !!options.localOnly;
        this.continuousTiming = !!options.continuousTiming;
        this.clusterOnly = !!options.clusterOnly;
        this.clusterFilterShift = !!options.clusterFilterShift;
        this.idleWait = options.idleWait === false ? false : true;
        this.idleThreshold = options.idleThreshold || this.idleThreshold;

        if (_.isNumber(options.clusterRefreshInterval)) {
            this.clusterRefreshInterval = options.clusterRefreshInterval;
        }

        this.instanceID = options.instanceID || ('' + parseInt(Math.random() * 100000));
        this.el.setAttribute('BDropTarget', '1');
        this.el.setAttribute('DropHighlightDisabled', '1');
        this.$el
            .data('ViewRef', this)
            .attr('id', this.instanceID)
            .css({
                'width': '100%',
                'height': '100%'
            });

        if (this.isMobile || true) {
            $('body').on({
                focus: _.bind(function() {
                    this.resizeDisabled = true;
                }, this),
                blur: _.bind(function() {
                    this.resizeDisabled = false;
                }, this)
            }, 'textarea, input[type=text]');
        }

        this.$el.append(baseHTML);

        function sendFile(uri, filename) {
            var link = document.createElement('a');
            if (typeof link.download === 'string') {
                link.href = uri;
                link.download = filename;

                //Firefox requires the link to be in the body
                document.body.appendChild(link);

                //simulate click
                link.click();

                //remove the link when done
                document.body.removeChild(link);
            }
            else {
                window.open(uri);
            }
        }

        $('.admin-view .export > .export-complete', this.$el).click(function() {
            sendFile('data:application/json;charset=US-ASCII;base64,' + btoa(G.exportData()), 'BenomeExport_' + _this.instanceID + '.json');
        });

        // Delay resize until there is a pause
        this.handleResize = _.debounce(this.handleResize, 400);
        $(window).bind('resize', this.handleResize);

        //if (_.isNumber(options.visualQuality) && options.visualQuality < 0.5)) {

        this.defaultGlobalClusterOptions = {
            dropDisabled: false,
            noCompress: false,
            newContextBumpTime: 20,
            setBackgroundFilterLevel: options.setBackgroundFilterLevel,
            radiusScaleFactor: this.isMobile ? 0.50 : 0.35,
            fontFraction: this.isMobile ? 0.27 : 0.22
        }

        this.globalClusterOptions = _.extend({}, this.defaultGlobalClusterOptions, options.globalClusterOptions || {});

        this.G.init({
            $el: this.$container,
            bgColor: options.bgColor || this.defaultBackgroundColor,
            enabledApps: options.enabledApps || null,
            features: options.features || {},
            globalAppOnly: options.globalAppOnly,
            graphEnabled: false,
            timeOffset: options.timeOffset || 0,
            dragThreshold: 11,
            tapThreshold: 8,
            pressThreshold: 10,
            hideLabels: this.hideLabels,
            animDisabled: false,
            minLightness: 0.15,
            autoActionDelay: this.autoActionDelay,
            localOnly: this.localOnly,
            visualQuality: _.isNumber(options.visualQuality) ? options.visualQuality : (this.G.isMobile ? 0.0 : 1.0),
            targetDataFilter: 8, // This will be dynamic
            idleThreshold: options.idleThreshold || this.idleThreshold,
            idleMax: 180 * 1000,
            appTimerInterval: this.appTimerInterval,

            darkText: options.darkText || '#444',
            lightText: options.lightText || '#aaa'
        });

        this.setDragTargets(!this.clusterOnly);

        this.loginView = new LoginView({
            el: $('.login-view', this.$el)
        });
        G.loginView = this.loginView;
        this.loginView.render().$el.appendTo(this.$container);

        this.adminView = new AdminView({
            el: $('.admin-view', this.$el),
            $overlay: G.$overlay
        });
        G.adminView = this.adminView;
        this.adminView.render().$el.appendTo(this.$container);

        this.helpView = new HelpView({
            el: $('.help-view', this.$el),
            $overlay: G.$overlay
        });
        G.helpView = this.helpView;
        this.helpView.render().$el.appendTo(this.$container);

        this.getHelpView = new GetHelpView({});
        this.getHelpView.render().$el.appendTo(this.$container);
        var _this = this;
        this.getHelpView.on('Click', function() {
            _this.helpView.show();
        });

        this.$timelineContainer = $('.timeline-container', this.$container);

        if (!options.timelineDisabled && this.G.FEATURE('ActionTimeline')) {
            if (!this.continuousTiming) {
                this.timelineView = new TimelineView({
                    el: this.$timelineContainer,
                    hideLabels: this.hideLabels,
                    dragHandler: G.commonPointDragHandler
                });
            }
            else {
                this.timelineView = new ActivityPath({
                    G: G,
                    el: this.$timelineContainer,
                    hideLabels: this.hideLabels,
                    dragHandler: G.commonPointDragHandler,
                    minimumDuration: 25,
                    refreshInterval: 60,
                    displayInterval: 60 * 60 * 2
                });
            }
        }

        if (this.timelineView) {
            this.timelineView.render();
            G.timelineView = this.timelineView;
        }

        window.E = this;
        this.pressIndicator = new PressIndicator();

        this.keyboardHandler = new KeyboardHandler();

        _.delay(this.appTimer, this.appTimerInterval);

        G.on('UserAuthenticated', function(userData) {
            _this.render();

            // Server is available and user is authenticated
            var rootContextID = userData.ContextID,
                serverLastID = userData.LastID;
            
            G.graphData = userData.GraphData || {};
            G.setFeatures(userData.Features);

            if (!rootContextID) {
                console.log('No rootContextID returned from server');
                return;
            }

            console.log('Server LastID is ' + serverLastID);

            G.loadBeginTime = Date.now();
            G.remoteInit(rootContextID, serverLastID);
        });

        G.on('UserNotAuthenticated', function() {
            _this.render();
        });

        G.on('AuthenticateCredentials', function(username, password, errorCallback) {
            _this.authenticateCredentials(username, password, errorCallback);
        });

        G.on('UserLoggedOut', function(contextID, userID) {
            G.isAuthenticated = false;
            window.location = window.location;
        });

        G.on('UserLoggedIn', function(contextID, userID) {
            G.isAuthenticated = true;
            console.log('UserLoggedIn');
        });

        G.on('LoadFinished', function(globalCollection, userCollection) {
            var renderBeginTime = Date.now();

            _this.globalCollection = globalCollection;
            _this.userCollection = userCollection;

            if (_this.localOnly) {
                userCollection.updateScores();
            }

            if (G.FEATURE('DetailLevels')) {
                // Disable scrolling for multi-touch mouse. Need a better way to detect it.
                if (!_this.isMac) {
                    _this.$el.mousewheel(_this.mouseWheel);
                }
            }

            var globalSize = G.globalSize();

            var globalClusterDef = {
                Type: 'Cluster',
                ClusterType: 'Global',
                ConstructType: null,
                ConstructDef: {
                    '1__Label': ''
                },
                Container: _this.$container,
                Name: '',
                NodeType: 'GlobalSurfaceView',
                Render: false, // Render happens after load finishes
                RenderOptions: {
                    initialPos: {
                        x: globalSize.width / 2,
                        y: globalSize.height / 2
                    }
                },
                Options: _this.globalClusterOptions,
                EventHandlers: {},
                Nodes: null
            };

            G.initApps();

            var globalCluster = G.renderStructure(globalClusterDef, userCollection);
            _this.globalCluster = globalCluster;
            G.globalCluster = globalCluster;
            _this.keyboardHandler.setCluster(_this.globalCluster.cluster);

            _this.appController = new AppController(globalCluster, G);

            if (_this.timelineView) {
                _this.timelineView.clusterController = globalCluster;
                _this.timelineView.setPointsCollection(userCollection.points);
            }
            
            _this.globalCollection.clusterController = globalCluster;
            _this.userCollection.clusterController = globalCluster;

            G.postInitApps(globalCluster);
            globalCluster.render(globalClusterDef.RenderOptions);

            console.log('Render', Date.now() - renderBeginTime);
            console.log('Load', Date.now() - G.loadBeginTime);
            G.trigger('GlobalClusterRendered', globalCluster);
        });

        G.on('GlobalClusterRendered', function(globalCluster) {
            G.unsetWorking();
            console.log(Date.now() - window.jsBeginTime);
        });

        var contextStack = [];

        function renderContextStack(refView, viewState) {
            $('.context-stack', _this.$container).remove();

            var refSize = viewState.radius * 2,
                x = viewState.x - viewState.radius,
                y = viewState.y - viewState.radius;

            _.each(contextStack.reverse(), function(t, i) {
                /*if (i == contextStack.length - 1) {
                    // Skip the most recent
                    return;
                }*/
                var adjustY = (i + 1) * Math.pow(G.fontSize, 1 - (i / 10)),
                    adjustX = adjustY;

                var $x = $('<div>')
                            .addClass('context-stack')
                            .css({
                                'background': t.bgColor,
                                'border-radius': '1000px',
                                'zIndex': t.zIndex - i - 1,
                                'top': y - adjustY,
                                'left': x - adjustX,
                                'position': 'absolute',
                                'width': refSize + (adjustX * 2) + 'px',
                                'height': refSize + (adjustY * 2) + 'px'
                            })
                            .appendTo(_this.$container);
            });
        }

        G.on('PopContext', function(view, viewState) {
            contextStack.pop();
            renderContextStack(view, viewState);
        });

        G.on('PushContext', function(view, viewState) {
            var zIndex = view.$el.css('z-index'),
                bg = view.getColor();

            contextStack.push({
                zIndex: zIndex,
                bgColor: bg
            });

            renderContextStack(view, viewState);
        });

        var layerStack = [];

        G.on('PopLayer', function(callback) {
            var layerDef = layerStack.pop();

            if (layerDef) {
                layerDef.$overlay.remove();
                layerDef.$container.remove();
            }

            if (callback) {
                callback();
            }
        });

        G.on('PushLayer', function(zIndex, callback, passThru) {
            var $overlay = $('<div>')
                            .addClass('layer-overlay')
                            .css({
                                'z-index': zIndex
                            })
                            .appendTo(_this.$container),
                $container = $('<div>')
                            .addClass('layer-container')
                            .css({
                                'z-index': zIndex + 1
                            })
                            .appendTo(_this.$container);

            layerStack.push({
                zIndex: zIndex,
                $overlay: $overlay,
                $container: $container
            });

            if (callback) {
                callback($container, passThru);
            }
        });
    },

    setDragTargets: function(enabled) {
        if (enabled) {
            this.showDestroyerView();
            this.showCreatorView();            
        }
        else {
            this.hideDestroyerView();
            this.hideCreatorView();
        }
    },

    showDestroyerView: function() {
        this.initDestroyerView();
        this.renderDestroyerView();
        this.destroyerView.show();
    },

    showCreatorView: function() {
        this.initCreatorView();
        this.renderCreatorView();
        this.creatorView.show();
    },

    initDestroyerView: function() {
        if (!this.destroyerView) {
            this.destroyerView = new DestroyerView({
                G: this.G
            });
            this.G.destroyerView = this.destroyerView;
            this.destroyerView.render().$el.appendTo(this.$container);
        }
    },

    initCreatorView: function() {
        if (!this.creatorView) {
            this.creatorView = new CreatorView({
                G: this.G
            });
            this.G.creatorView = this.creatorView;
            this.creatorView.render().$el.appendTo(this.$container);

            var _this = this;
            this.creatorView.on('Click', function() {
                _this.timelineView && _this.timelineView.toggleVisible();
            });
        }
    },

    renderCreatorView: function() {
        if (this.creatorView) {
            var G = this.G,
                globalSize = G.globalSize(),
                d = (globalSize.height + globalSize.width) / 2;

            this.creatorView.$el
                .show()
                .css({
                    'right': (d * 0.01) + 'px',
                    'top': (d * 0.01) + 'px',
                    'width': (d * 0.15) + 'px',
                    'height': (d * 0.15) + 'px'
                });
        }
    },

    renderDestroyerView: function() {
        if (this.destroyerView) {
            var G = this.G,
                globalSize = G.globalSize(),
                d = (globalSize.height + globalSize.width) / 2;

            this.destroyerView.$el
                .show()
                .css({
                    'left': (d * -0.125) + 'px',
                    'bottom': (d * -0.125) + 'px',
                    'width': (d * 0.30) + 'px',
                    'height': (d * 0.30) + 'px'
                });
        }
    },

    hideDestroyerView: function() {
        this.destroyerView && this.destroyerView.hide();
    },

    hideCreatorView: function() {
        this.creatorView && this.creatorView.hide();
    },

    appTimer: function() {
        var idleTime = Date.now() - this.G.lastActivity;
        if (this.clusterFilterShift && this.globalCluster && (!this.idleWait || idleTime > this.idleThreshold)) {
            
            /*if (this.newIdle) {
                this.initialFilterLevel = this.currentFilterLevel;
            }
            this.newIdle = false;

            idleTime = Math.min(this.idleMax, idleTime);

            var idleFactor = (idleTime - this.idleThreshold) / (this.idleMax - this.idleThreshold);
            var filterAdjust = (this.targetDataFilter - this.initialFilterLevel) * idleFactor;
            var filterValue = parseInt(Math.round(this.initialFilterLevel + filterAdjust));
            //console.log(idleTime, idleFactor, this.initialFilterLevel, filterAdjust, filterValue);
            this.setTransform(filterValue);*/

            var cluster = this.globalCluster.cluster;

            console.log('Update scores');
            cluster.contexts.updateScores();

            console.log('Bump filter level');
            cluster.setFilterLevel(1, {
                relative: true,
                animateDuration: 2000,
                hideDuration: 1200
            });
            this.G.updateLastActivity();
        }
        /*else {
            this.newIdle = true;
        }*/

        if (Date.now() - this.lastClusterRefresh >= this.clusterRefreshInterval) {
            if (this.timelineView && !this.continuousTiming) {
                console.log('Refresh timeline');
                this.timelineView.render();
            }

            this.lastClusterRefresh = Date.now();
        }

        _.delay(this.appTimer, this.appTimerInterval);
    },

    authenticateCredentials: function(username, password, errorCallback) {
        if (username && password) {
            username = username || _.last(_.compact(window.location.pathname.split('/'))),
            password = password || username;

            var G = this.G;
            G.loginUser(username, password, function(success, userData) {
                if (success) {
                    // Now pull the data
                    G.trigger('UserAuthenticated', userData);
                }
                else {
                    if (errorCallback) {
                        errorCallback('Auth failed');
                    }
                }
            });
        }
    },

    postAttach: function() {
        this.updateFontSize();

        if (this.G.FEATURE('DetailLevels')) {
            this.detailSpectrum = new DetailSpectrum({
                el: $('.detail-spectrum', this.$container),
                numDetailLevels: 6
            });
            this.detailSpectrum.render();
        }

        if (!this.continuousTiming && this.G.FEATURE('LeafFocusAutoAdd')) {
            this.autoActionView = new AutoActionView({
                el: $('.auto-action-container', this.$el),
                delay: this.autoActionDelay
            });
            this.autoActionView.render();
            this.G.autoActionView = this.autoActionView;
        }
    },

    load: function() {
        if (this.localOnly) {
            console.log('Local Only. InstanceID is ' + this.instanceID);

            var result = this.G.initLocalIDs();

            var rootContextID = result.rootContextID,
                initialData = null,
                G = this.G;

            if (result.newSession) {
                var uiContextID = G.nextID(),
                    prefsContextID = G.nextID(),
                    appsContextID = G.nextID(),
                    userRootContextID = G.nextID(),
                    stateContextID = G.nextID();

                initialData = {
                    Contexts: [],
                    Associations: [],
                    Points: []
                }

                function addContext(initialData, contextID, parentID, label) {
                    initialData.Contexts.push({
                        'ID': contextID,
                        '1__Label': label,
                        '1__Time': G.getNow() / 1000
                    });

                    if (parentID) {
                        initialData.Associations.push({
                            'ID': parentID + '|down|' + contextID,
                            'SourceID': parentID,
                            'Name': 'down',
                            'DestID': contextID
                        });

                        initialData.Associations.push({
                            'ID': contextID + '|up|' + parentID,
                            'SourceID': contextID,
                            'Name': 'up',
                            'DestID': parentID
                        });
                    }
                }

                addContext(initialData, rootContextID, null, 'Root');
                addContext(initialData, uiContextID, rootContextID, 'UI');
                addContext(initialData, prefsContextID, rootContextID, 'Prefs');
                addContext(initialData, appsContextID, rootContextID, 'Apps');
                addContext(initialData, userRootContextID, rootContextID, '');
                addContext(initialData, stateContextID, rootContextID, 'State');

                var globalAppID = G.nextID();
                addContext(initialData, globalAppID, appsContextID, 'Global');

                var projectAppID = G.nextID();
                addContext(initialData, projectAppID, appsContextID, 'Project');

                var behaveAppID = G.nextID(),
                    bonusContextID = G.nextID();

                addContext(initialData, behaveAppID, appsContextID, 'Behave');
                addContext(initialData, bonusContextID, behaveAppID, 'Bonuses');
            }

            if (this.serializedData) {
                var moreData;

                if (_.isString(moreData)) {
                    try {
                        moreData = JSON.parse(moreData);
                    }
                    catch (e) {
                        console.log('Error parsing data: ' + e.toString(), e);
                    }
                }
                else if (_.isObject(moreData)) {
                    if (_.isArray(moreData.Contexts)) {
                        initialData.Contexts = initialData.Contexts.concat(moreData.Contexts);
                    }

                    if (_.isArray(moreData.Associations)) {
                        initialData.Associations = initialData.Associations.concat(moreData.Associations);
                    }

                    if (_.isArray(moreData.Points)) {
                        initialData.Points = initialData.Points.concat(moreData.Points);
                    }
                }
            }

            this.G.localOnlyInit(rootContextID, initialData);
            this.render();
        }
        else {
            this.G.checkOnlineState();
        }
    },

    updateFontSize: function() {
        this.G.updateFontSize();
    },

    mouseWheel: function(e, delta, deltaX, deltaY) {
        this.G.updateLastActivity();

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
                //this.clearDebug();
                var globalCluster = this.globalCluster;
                globalCluster.cluster.setFilterLevel(deltaLevel, { relative: true, noRender: true});
                globalCluster.cluster.debounceRender();
            }
        }

        e.preventDefault();
        return false;
    },

    handleResize: function() {
        if (this.resizeDisabled) {
            return;
        }
        //this.toggleOverlay(false);
        this.render();
    },

    render: function(options) {
        options = options || {};

        this.updateFontSize();

        var G = this.G,
            globalSize = G.globalSize(),
            d = (globalSize.height + globalSize.width) / 2;

        this.getHelpView.$el
            .show()
            .css({
                'left': (d * 0.01) + 'px',
                'top': (d * 0.01) + 'px',
                'width': (d * 0.075) + 'px',
                'height': (d * 0.075) + 'px',
                'font-size': (d * 0.075 * 0.9) + 'px'
            });

        if (G.isAuthenticated || this.localOnly) {
            this.loginView.$el.hide();

            this.renderCreatorView();
            this.renderDestroyerView();

            var timelineWidth = G.fontSize * 8;
            this.$timelineContainer.css({
                'left': (globalSize.width - timelineWidth) + 'px',
                'width': timelineWidth + 'px'
            });

            var globalCluster = this.globalCluster;
            if (globalCluster) {
                globalCluster.containerWidth = globalSize.width;
                globalCluster.containerHeight = globalSize.height;
                globalCluster.cluster.setRadius(globalCluster.getClusterSize());
                globalCluster.setPosition();

                globalCluster.render({
                    noAnimate: true
                });
            }
        }
        else {
            G.hideAddPointFeedback();
            this.$timelineContainer.hide();

            this.hideCreatorView();
            this.hideDestroyerView();

            var loginSize = d * 0.4;

            this.loginView.$el
                .show()
                .css({
                    'left': ((globalSize.width - loginSize) / 2) + 'px',
                    'top': ((globalSize.height - loginSize) / 2) + 'px',
                    'width': loginSize + 'px',
                    'height': loginSize + 'px'
                });
        }

        return this;
    },

    dropHandler: function(dropView, dragView, dragDetails, dropDetails) {
        if (dragView.className != 'simple-view') {
            return;
        }

        var dragViewID = dragView.viewID,
            dragClusterID = dragView.clusterID,
            dragCluster = this.G.getCluster(dragClusterID),
            dragFocusID = dragCluster.focusID,
            dragIsFocus = dragViewID == dragFocusID;

        if (!dragIsFocus) {
            return;
        }

        if (this.G.FEATURE('MovableFocus')) {
            // If a cluster focus is dropped onto space then move the cluster
            var x = dragDetails.dragProxyX + (dragDetails.dragProxyWidth / 2),
                y = dragDetails.dragProxyY + (dragDetails.dragProxyHeight / 2);

            dragCluster.setPosition(x, y);
        }

        // If moved to the left edge then simplify it
        /*
        var globalSize = B.globalSize()
        if (x <= globalSize.width * 0.1) {
            if (!dragCluster.isMinimized) {
                dragCluster.setRadius(B.getDefaultClusterSize() / 2);
                dragCluster.lastMaxDepth = dragCluster.maxDepth;
                dragCluster.maxDepth = 1;
                dragCluster.isMinimized = true;
            }
        }
        // If moved to the top right corner, and not the root cluster, then delete it
        else if (dragViewID != B.rootContextID && x >= globalSize.width * 0.8 && y <= globalSize.height * 0.2) {
            dragCluster.setRadius(0);
            dragCluster.maxDepth = null;
        }
        else {
            dragCluster.setRadius(B.getDefaultClusterSize());
            dragCluster.maxDepth = dragCluster.lastMaxDepth || null;
            dragCluster.isMinimized = false;
        }
        */

        // If not the focus and dropped over space, then create a new cluster there
        /*
        else if (!dragIsFocus && !dropModel) {
            // Prevent more than one root cluster
            if (dragViewID == B.rootContextID) {
                return false;
            }

            B.lastClusterID = B.lastClusterID || 0;
            B.lastClusterID += 1;

            var clusterID = 'Cluster-' + B.lastClusterID,
                newCollection = B.globalCollection.collectionFromRoot(dragViewID),
                newCluster = new Cluster(clusterID, SimpleView, newCollection, B.getClusterOptions());
            
            B.clusters[clusterID] = newCluster;

            newCluster.setPosition(dragDetails.dragProxyX + (dragDetails.dragProxyWidth / 2), dragDetails.dragProxyY + (dragDetails.dragProxyHeight / 2));
            newCluster.setRadius(B.getDefaultClusterSize());
            newCluster.setFocus(dragViewID);
            newCluster.filterValue = 0;
            newCluster.render();
        }
        */

        dragCluster.render();
    }
});

_.extend(Benome.prototype, Backbone.Events);

module.exports = Benome;