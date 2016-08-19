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
    jQueryColor = require('app/lib/jquery.color'),
    _ = require('underscore'),
    Backbone = require('backbone'),
    moment = require('app/lib/moment');

// -------------

var Colors = require('app/modules/Util/Colors'),
    SimpleView = require('app/modules/Views/SimpleView'),
    GraphSurfaceView = require('app/modules/GraphSurfaceView');

function Cluster(clusterID, contexts, options, config) {
    this.clusterID = clusterID;

    _.bindAll(this, 'dataChanged', 'dataAdded', 'dataCleared', 'render');
    this.dataChanged = _.debounce(this.dataChanged, 50);

    this.initCollection(contexts);

    this.defaultConfig = {
        scaleFactor: 0.7,
        spaceFactor: 0.7,
        minDepth: 2,
        maxDepth: null,
        layoutChange: true,
        hideLabels: false,
        labelIDsOnly: false,
        hideChildren: false,
        childAngleArc: 180,
        focusAngleArc: 360,
        focusStartAngle: 30,
        focusFontSize: 1.3,
        fadeDepth: 3,
        fadeFactor: 0.25,
        fadeTarget: options.baseBGColor || '#fff',
        fontFraction: 0.22,
        fontSizeProportion: 0.05,
        hideSmallText: true,
        baseZIndex: 20000,
        numDetailLevels: 5,
        animateDuration: 400,
        hideDuration: 325,
        noCompress: false,
        labelFunc: null,
        forceFocusStartAngle: false,
        childLimit: null,
        newContextBumpTime: 10 * 60,  // 10 minutes
        dropDisabled: false,
        dragDisabled: false,
        moveDisabled: false,
        showDetailIndicator: true,
        setBackgroundFilterLevel: true,
        visualQuality: options.visualQuality || 0, // 0 to 1
        allowRootOnly: false,
        filterType: 'cutoff',
        filterOptions: {
            cutoffValue: 0.2
        }
    }

    this.state = {};
    this.viewCache = {};
    this.focusData = {};
    this.viewStates = {};

    this.setConfig(config);

    this.listeners = options.listeners || {};
    this.$container = options.$el;
    this.filterLevel = options.filterLevel || 0;
    this.minLightness = options.minLightness;
    this.baseBGColor = options.baseBGColor || '#fff';
    this.fontSize = options.fontSize;
    this.globalRootContextID = options.globalRootContextID;
    this.debounceRender = _.debounce(this.render, 250);

    var rootID = this.contexts.rootID,
        focusID = options.focusID || rootID;

    this.colors = new Colors(this.contexts, {
        rootContextID: rootID,
        minLightness: this.minLightness
    });

    this.defaultNodeAppearance = {
        getColor: _.bind(this.colors.getColor, this.colors)
    };
    this.nodeAppearance = this.defaultNodeAppearance;

    this.init(rootID, focusID);
}
_.extend(Cluster.prototype, {
    setConfig: function(config, options) {
        config = config || {};
        options = options || {};
        this.config = _.extend({}, this.defaultConfig, config);

        if (options.render) {
            this.render(options);
        }
        return this.config;
    },

    setAppearance: function(appearance, options) {
        appearance = appearance || this.defaultNodeAppearance;
        options = options || {};
        this.nodeAppearance = appearance;

        if (options.render) {
            this.render(options);
        }
        return this.nodeAppearance;
    },

    initCollection: function(contexts) {
        if (this.contexts) {
            this.contexts.off('change add remove', this.dataChanged);
            this.contexts.off('add', this.dataAdded);
            this.contexts.off('reset', this.dataCleared);
        }
        this.contexts = contexts;
        this.contexts.on('change add remove', this.dataChanged);
        this.contexts.on('add', this.dataAdded);
        this.contexts.on('reset', this.dataCleared);

        this.rootID = this.contexts.rootID;
    },

    init: function(rootID, focusID) {
        this.rootID = rootID;
        this.focusID = focusID || rootID;

        _.bindAll(this, 'activityClicked', 'activityPressed', 'activityShortPressed', 
                    'creatorDrop');

        this.on('ActivityClicked', this.activityClicked);
        this.on('ActivityShortPressed', this.activityShortPressed);
        this.on('ActivityPressed', this.activityPressed);
        this.on('CreatorDrop', this.creatorDrop);
    },

    creatorDrop: function(dropView, dragView, dragDetails, dropDetails) {
        //console.log('creatordrop', dropView, dragView, dragDetails, dropDetails);
    },

    getColor: function(contextID, fresh, baseLightnessAdjust, noCache) {
        return this.nodeAppearance.getColor(contextID, fresh, baseLightnessAdjust, noCache);
    },

    getFontSize: function() {
        // TODO: per-cluster sizing with global reference or default
        return this.fontSize;
    },

    setFontSize: function(fontSize) {
        this.fontSize = fontSize
    },

    setZIndex: function(zIndex) {
        this.currentZIndex = zIndex;
    },

    setFocus: function(newFocusID, render) {
        newFocusID = newFocusID || this.focusID;

        if (this.renderedOnce && newFocusID != this.focusID) {
            this.trigger('BeforeFocusChanged', this, newFocusID, this.contexts.get(newFocusID), this.focusID, this.contexts.get(this.focusID));
        }

        this.lastFocusID = this.focusID || this.rootID;
        this.focusID = newFocusID;

        if (render) {
            this.render();
        }

        return this.focusID;
    },

    focusParent: function(contextID, render) {
        contextID = contextID || this.focusID;
        var parentID = this.contexts.get(contextID).getParentID();
        if (parentID) {
            this.setFocus(parentID, render);
        }
    },

    setPosition: function(x, y) {
        if (_.isObject(x)) {
            this.x = x.x;
            this.y = x.y;
        }
        else {
            this.x = x;
            this.y = y;
        }
    },

    setRadius: function(radius) {
        if (radius < 10) {
            this.focusRadius *= radius;
        }
        else {
            this.focusRadius = radius;
        }
    },

    getSurfaceView: function(neighbourID, neighbourState) {
        var neighbourView = this.getView(neighbourID),
            neighbourContext = this.contexts.get(neighbourID);

        var surfaceView = this.surfaceViewFunc(neighbourID, neighbourState, neighbourView, neighbourContext);
        surfaceView.setDisplayMode('View');

        return surfaceView;
    },

    getSurfaceViewClass: function(contextModel) {
        return GraphSurfaceView;
    },

    surfaceViewFunc: function(viewID, viewState, baseView, contextModel) {
        this.surfaceViewCache = this.surfaceViewCache || {};

        var view = this.surfaceViewCache[viewID];
        if (!view) {
            var SurfaceViewCls = this.getSurfaceViewClass(contextModel);
            view = new SurfaceViewCls({
                //G: this.G,
                viewState: viewState,
                baseView: baseView,
                contextModel: contextModel,
                //clusterController: this,
                //modeParams: this.getModeParams(contextModel)
            });
            //this.listenTo(view, 'ValueChanged', this.onValueChange);
        }
        else {
            view.setState(viewState);
        }

        this.surfaceViewCache[viewID] = view;
        return view;
    },

    checkAnimEnabled: function(numElements) {
        return true;
    },

    normalizeAngle: function(angle) {
        // Normalize to between 0 and 360
        while (angle >= 360) {
            angle -= 360;
        }

        while (angle < 0) {
           angle += 360;
        }

        return angle;
    },

    execListener: function(listenerID, args) {
        if (!_.isFunction(this.listeners[listenerID])) {
            return true;
        }

        return this.listeners[listenerID].apply(this, args);
    },

    addListener: function(listenerID, func) {
        this.listeners[listenerID] = func;
    },

    activityClicked: function(e, view) {
        if (!view || !this.config.layoutChange || this.activityClickOverridden) {
            return;
        }

        if (this.execListener('BeforeActivityClicked', [e, view]) === false) {
            return;
        }

        if (this.focusID != view.viewID) {
            this.setFocus(view.viewID);
            this.render();
        }

        if (this.execListener('AfterActivityClicked', [e, view]) === false) {
            return;
        }
    },

    activityShortPressed: function(e, view) {
        if (!view) {
            return;
        }

        e.preventDefault();

        /*if (this.focusID != view.viewID && this.config.layoutChange) {
            _.defer(_.bind(function() {
                // Set focus to pressed view
                this.setFocus(view.viewID);
                this.render({});
            }, this));
        }*/
    },

    activityPressed: function(e, view) {
        if (!view) {
            return;
        }
    },

    getFocusRadius: function() {
        return this.focusRadius;
    },

    getElementView: function(contextID, isRoot, isGlobalRoot, options) {
        if (this.elementViewFunc) {
            return this.elementViewFunc(contextID, isRoot, isGlobalRoot, options);
        }

        return SimpleView;
    },

    getView: function(contextID, isRoot, isGlobalRoot, options, renderOptions) {
        contextID = contextID - 0;
        
        options = options || {};
        renderOptions = renderOptions || {};

        var view = this.viewCache[contextID];
        if (!view && !options.noCreate) {
            var ElementCls = this.getElementView(contextID, isRoot, isGlobalRoot, options),
                viewState = this.getViewState(contextID),
                dropDisabled = this.config.dropDisabled,
                dragDisabled = this.config.dragDisabled;

            if ('dropDisabled' in viewState) {
                dropDisabled = viewState.dropDisabled || false;
            }

            if ('dragDisabled' in viewState) {
                dragDisabled = viewState.dragDisabled || false;
            }

            var color;
            if (isRoot && this.config.rootColor) {
                color = this.config.rootColor;
            }
            else {
                color = this.getColor(contextID);
            }
            
            view = new ElementCls({
                model: this.contexts.get(contextID),
                viewID: contextID,
                isRoot: isRoot,
                isGlobalRoot: isGlobalRoot,
                cluster: this,
                clusterID: this.clusterID,
                hideLabel: this.config.hideLabels,
                labelIDOnly: this.config.labelIDsOnly,
                color: color,
                visualQuality: this.config.visualQuality,
                dropDisabled: dropDisabled,
                dragDisabled: dragDisabled,
                moveDisabled: this.config.moveDisabled
            });
            this.viewCache[contextID] = view;

            if (renderOptions.initialPos) {
                view.$el.css({
                    'left': renderOptions.initialPos.x + 'px',
                    'top': renderOptions.initialPos.y + 'px'
                });
            }
            this.$container.append(view.$el);
        }

        return view;
    },

    dataAdded: function(model) {
        this.render();
    },

    dataChanged: function(model) {
        if ('ContextPositionChanged' in model.changed) {
            // Recalculate colors
            var _this = this;
            function traverseDown(model) {
                var view = _this.getView(model.id);
                if (view) {
                    view.setColor();
                }
                _.each(model.getAssocModels('down'), function(model) {
                    traverseDown(model);
                });
            }

            traverseDown(model);            
        }

        // Do not recalculate sort order, even though that might seem like the right thing to do
        //  Changing the sort order causes all sorts of unwanted node-shifting at bad times.
        //  A gradual shift is necessary, although jumps could work when nodes are hidden
        //  Otherwise only while idle while other stuff is happening too

        this.render({
            keepZIndex: true
        });
    },

    computeSortOrder: function() {
        this.sortOrder = {};

        var contexts = this.contexts;

        // Traverse 
        contexts.each(function(context) {
            var parentContextID = context.id,
                childSortOrder = {};

            var children = context.getAssoc('down');
            children = _.sortBy(children, function(childContextID) {
                return childContextID;
            });

            var children =_.sortBy(children, function(childContextID) {
                var context = contexts.get(childContextID);
                if (context) {
                    var numChildren = context.getAssoc('down').length;
                    return -numChildren;
                }
                else {
                    //debugger;
                    return 0;
                }
            });

            var mid = Math.floor((children.length + 1) / 2);
            var children =_.sortBy(children, function(childContextID, idx) {
                var dir = idx % 2 == 1 ? 1 : -1,
                    sortPos = mid + (idx * dir);
                return sortPos;
            });

            childSortOrder[parentContextID] = 0;
            _.each(children, function(childContextID, idx) {
                childSortOrder[childContextID] = idx + 1;
            });
            
            this.sortOrder[parentContextID] = childSortOrder;
        }, this);
    },

    dataCleared: function() {
        this.render({
            noAnimate: true
        });
    },

    setFilterLevel: function(filterLevel, options) {
        options = options || {};
        var isRelative = options.relative || false,
            newFilterLevel;

        if (isRelative) {
            newFilterLevel = this.filterLevel + filterLevel;
        }
        else {
            newFilterLevel = filterLevel;
        }
        newFilterLevel = Math.max(0, Math.min(this.config.numDetailLevels - 1, newFilterLevel));

        if (newFilterLevel != this.filterLevel) {
            this.lastFilterLevel = this.filterLevel;
            this.filterLevel = newFilterLevel;

            this.trigger('FilterLevelChanged', newFilterLevel);

            if (!options.noRender) {
                this.render(options);
            }
        }
    },

    calcDetailLevels: function(options) {
        options = options || {};

        var focusID = options.focusID || this.focusID || this.rootID,
            numLevels = options.numLevels || this.config.numDetailLevels,
            filterType = this.config.filterType,
            filterOptions = this.config.filterOptions,
            lowestLevelSize = options.lowestLevelSize || 5,
            levelBounds = [0];

        if (!options.noCalc) {
            // Get the latest scores
            this.contexts.traverseGraph(focusID);
        }

        var scores = this.contexts.chain()
                                        .filter(function(context) {
                                            return context.isLeaf();
                                        })
                                        .map(function(context) {
                                            return context.getDistanceScore();
                                        })
                                    .values();

        scores.sort(function (a, b) { return a - b; });

        if (filterType == 'intervals') {
            // Detail levels based on score intervals
            var lowestDetailScore = _.max(_.last(scores, lowestLevelSize)), // Larger
                highestDetailScore = _.min(scores), // Smaller
                scoreRange = lowestDetailScore - highestDetailScore,
                boundIncr = scoreRange / (numLevels - 1);

            levelBounds = _.map(_.range(0, numLevels - 1), function(level) {
                return highestDetailScore + (boundIncr * level);
            });
            levelBounds.push(lowestDetailScore);
        }
        else if (filterType == 'distribution') {
            // Detail levels based on a functional distribution
            //  Linear to start with

            // Add insignificant random digits to ensure no scores are the same
            // Filter out non-scores
            var tScores = _.chain(scores)
                                .filter(function(score) {
                                    return score > 0;
                                })
                                .map(function(score) {
                                    return score + (Math.random() / 1000);
                                })
                            .value();

            var numScores = tScores.length,
                numFunctionalScores = numScores - lowestLevelSize,
                incr = numFunctionalScores / (numLevels - 1),
                lastIdx = 0;

            levelBounds = _.map(_.range(1, numLevels - 1), function(level) {
                var idx = Math.floor(level * incr),
                    levelBound = tScores[idx];

                lastIdx = idx;
                return levelBound;
            });

            levelBounds.unshift(0);
            levelBounds.push(tScores[Math.floor(lastIdx + incr)]);
        }
        else if (filterType == 'cutoff') {
            var cutoffValue = filterOptions.cutoffValue || 0.2;
            levelBounds = _.map(_.range(0, numLevels - 1), function(level) {
                return cutoffValue;
            });
            levelBounds.unshift(0);
        }

        return levelBounds;
    },

    hideAll: function() {
        _.each(this.viewCache, function(view) {
            view.hide();
        });
    },

    destroyViews: function() {
        _.each(this.viewCache, function(view) {
            view.$el.hide();
            view.$el.remove();
        });

        this.viewCache = {};
    },

    render: function(options) {
        options = options || {};
        var beginTime = Date.now();

        _.isNumber(options.filterLevel) && this.setFilterLevel(options.filterLevel, {noRender: true});
        options.radius && this.setRadius(options.radius);
        options.initialZIndex && this.setZIndex(options.initialZIndex);
        options.position && this.setPosition(options.position.x, options.position.y);
        options.fontSize && this.setFontSize(options.fontSize);
        options.config && this.setConfig(options.config);

        if (!this.sortOrder) {
            this.computeSortOrder();
        }

        //options.noAnimate = true;

        var focusID = options.focusID || this.focusID || this.rootID;
        this.contexts.traverseGraph(focusID);

        var levelBounds = this.calcDetailLevels({
                                                    focusID: focusID,
                                                    noCalc: true,
                                                    filterType: options.filterType,
                                                    filterOptions: options.filterOptions,
                                                    lowestLevelSize: 5
                                                }),
            filterValue = levelBounds[this.filterLevel];

        if (this.lastFilterValue != filterValue || this.filterLevel != this.lastFilterLevel) {
            this.trigger('ClusterFilterValueChanged', this, filterValue);
            this.lastFilterValue = filterValue;
        }
        
        var filteredData = this.contexts.getFinalStructure(focusID, filterValue, this.sortOrder);

        if (!this.layoutState) {
            this.layoutState = {};
        }

        var zIndex = this.currentZIndex;
        options.zIndex = zIndex;

        var layoutData = this.computeLayoutData(filteredData, focusID, options, this.lastLayoutData),
            layoutIDs = _.map(_.keys(layoutData.data), function(x) { return x -= 0; });

        if (layoutIDs.length == 1 && !this.config.hideChildren && !this.config.allowRootOnly) {
            var nextOptions = _.extend({}, options);
            delete nextOptions.filterLevel;
            if (layoutIDs[0] != this.rootID) {
                var focusContext = this.contexts.get(layoutIDs[0]);
                if (focusContext) {
                    nextOptions.focusID = focusContext.getParentID();
                    this.render(nextOptions);
                }
                return;
            }
            else if (this.filterLevel > 0) {
                this.setFilterLevel(-1, { relative: true, noRender: true });
                this.render(nextOptions);
                return;
            }
        }

        this.focusID = layoutData.focusID;
        this.trigger('FocusChanged', this, this.focusID, this.contexts.get(this.focusID), this.lastFocusID, this.contexts.get(this.lastFocusID));
        this.lastLayoutData = layoutData;

        if (this.lastData) {
            // This doesn't hide everything, as renderViews() applies additional visual limits (maxDepth) that may cutoff traversal
            var removed = _.difference(_.map(_.keys(this.lastData), function(x) { return x -= 0; }), layoutIDs);
            _.each(removed, function(viewID) {
                // Skip the root though
                if (viewID == this.rootID && this.focusID != this.rootID) {
                    return;
                }

                var view = this.getView(viewID, null, null, { noCreate: true}, options);
                if (view) {
                    var hideDuration = _.isNumber(options.hideDuration) ? options.hideDuration : this.config.hideDuration;
                    view.hide({
                        hideDuration: hideDuration
                    });
                    if (view.viewID in layoutData.data) {
                        layoutData.data[view.viewID].visible = false;
                    }
                }
            }, this);
        }

        var parentID = this.focusID,
            rootTrace = [];

        while (parentID) {
            var context = this.contexts.get(parentID);
            if (!context) {
                break;
            }

            parentID = context.getParentID();
            if (parentID) {
                rootTrace.push(parentID);
            }
        }

        if (options.noAnimate !== false && options.noAnimate !== true) {
            options.noAnimate = !this.checkAnimEnabled(layoutIDs.length);
        }

        //console.log('Cluster compute', Date.now() - beginTime);

        var renderedViewIDs = [];
        if (this.contexts.get(this.rootID)) {
            var beginTime = Date.now();
            this.renderViews(layoutData, options, rootTrace, renderedViewIDs);
            //console.log('Cluster render', Date.now() - beginTime);
        }

        // Hide anything left over
        var removed = _.difference(layoutIDs, renderedViewIDs);
        _.each(removed, function(viewID) {
            // Skip the root though
            if (viewID == this.rootID && this.focusID != this.rootID) {
                return;
            }
            var view = this.getView(viewID, null, null, { noCreate: true});
            if (view) {
                var hideDuration = _.isNumber(options.hideDuration) ? options.hideDuration : this.config.hideDuration;
                view.hide({
                    hideDuration: hideDuration
                });

                if (view.viewID in layoutData.data) {
                    layoutData.data[view.viewID].visible = false;
                }
            }
        }, this);

        if (this.contexts.get(this.rootID) && this.focusID != this.rootID) {
            var rootView = this.getView(this.rootID, true);
            if (this.lastVisibleTraceID && this.lastVisibleTraceID != this.rootID) {
                var traceState = layoutData.data[this.lastVisibleTraceID],
                    radius = this.getFontSize() * 1.3,
                    distance = traceState.radius + radius,
                    p = this.computeChildPosition(distance, traceState.startAngle, 
                                                    traceState.x, traceState.y);

                rootView.show();
                rootView.setSize(radius, true);
                rootView.setPosition(p.x, p.y, true, true);
                rootView.setFontSize(radius / 4, 'px', true);
                rootView.exec(options.noAnimate, options.animateDuration || this.config.animateDuration);

                /*$('<div>')
                    .css({
                        'position': 'absolute',
                        'left': p.x + 'px',
                        'top': p.y + 'px',
                        'background-color': 'orange',
                        'z-index': 999999999
                    })
                    .html(Math.round(this.lastVisibleTraceID))
                    .appendTo(this.$container);*/
            }

            // Only set zIndex if the root is not a neighbour of the focus
            var focusNeighbours = this.contexts.getNeighbours(this.focusID);
            if (!_.contains(focusNeighbours, this.rootID)) {
                rootView.setZIndex(layoutData.data[this.focusID].zIndex - 1);
            }
        }

        this.lastVisibleTraceID = null;
        this.lastData = filteredData;
        this.lastRenderedFocusID = this.focusID;
        this.lastRenderedFilterLevel = this.filterLevel;
        this.focusData[this.focusID] = this.lastLayoutData.data[focusID];

        //options.postRender && options.postRender();

        this.renderedOnce = true;

        this.trigger('AfterClusterRender', this);

        if (options.noAnimate) {
            this.trigger('AfterClusterAnim', this);
        }
        else {
            var _this = this;
            _.delay(function() {
                _this.trigger('AfterClusterAnim', _this);
            }, (options.animateDuration || this.config.animateDuration) + 20);
        }

        this.trigger('AfterRender');
    },

    /*
        Begin with the focus and setup the calls to the surrounding nodes.
    */
    computeLayoutData: function(data, focusID, options) {
        options = options || {};

        var config = this.config,
            prevState = options.prevState || this.lastLayoutData || null,
            startAngle = _.isNumber(options.startAngle) ? options.startAngle : config.focusStartAngle,
            isRoot = focusID == this.rootID,

            neighbours = _.isArray(data[focusID]) ? data[focusID].slice() : [],
            focusRadius = options.focusRadius || this.getFocusRadius(),
            angleArc = options.focusAngleArc || config.focusAngleArc,
            zIndex = options.zIndex || this.focusZIndex,
            prevBaseState = prevState ? prevState.data[focusID] : {},
            baseState,
            currentState = {
                data: {},
                focusID: focusID
            },

            angleStep = angleArc / neighbours.length;

        // Traced root may not be in the previous data set
        prevBaseState = prevBaseState || {};

        if (config.forceFocusStartAngle) {
            startAngle = config.focusStartAngle;
        }
        else {
            if (_.isNumber(prevBaseState.startAngle)) {
                // Set start angle to inverse of the previous angle
                if (!prevState || prevState.focusID != focusID) {
                    startAngle = prevBaseState.startAngle - 180;
                }
                else {
                    startAngle = prevBaseState.startAngle;
                }
            }
            startAngle = this.normalizeAngle(startAngle);
        }

        var parentFontSize = focusRadius * config.fontFraction;

        baseState = {
            id: focusID,
            radius: Math.round(focusRadius),
            x: Math.round(this.x),
            y: Math.round(this.y),
            baseX: Math.round(this.x),
            baseY: Math.round(this.y),
            fontSize: [parentFontSize, 'px'],
            depth: 1,
            zIndex: zIndex,
            visible: !(config.hideRoot && isRoot),
            parentID: null,
            startAngle: startAngle,
            allNeighbours: neighbours,
            neighbours: neighbours,
            orderedNeighbours: null
        };
        currentState.data[focusID] = baseState;

        if (!config.hideChildren && (!_.isNumber(config.maxDepth) || config.maxDepth > 1)) {
            var childRadius = baseState.radius * config.scaleFactor,
                orderedNeighbours;

            if (prevBaseState) {
                if (!prevBaseState.orderedNeighbours || prevBaseState.orderedNeighbours.length != neighbours.length) {
                    orderedNeighbours = this.reorderNeighbours(neighbours, prevBaseState.parentID);
                }
                else {
                    orderedNeighbours = prevBaseState.orderedNeighbours;
                }
            }
            baseState.orderedNeighbours = orderedNeighbours;

            childRadius = this.calcChildRadius(focusRadius, childRadius, angleArc, neighbours.length, config.spaceFactor);

            var scaleFactor = childRadius / focusRadius,
                spaceFactor;

            // Now the neighbour nodes, laid out around the previous parent (if any)
            _.each(orderedNeighbours, function(neighbourID, neighbourCtr) {
                var currentChildRadius = childRadius,
                    currentScaleFactor = scaleFactor;

                spaceFactor = config.spaceFactor;

                var neighbourModel = this.contexts.get(neighbourID),
                    neighbourViewState = this.getViewState(neighbourID),
                    noCompress = false;

                if (config.noCompress) {
                    noCompress = true;
                }
                else if ((Date.now() / 1000) - neighbourModel.getNS('Timestamp') < config.newContextBumpTime) {
                    noCompress = true;
                }

                // Compress nodes with only one child
                var nextNeighbours = _.isArray(data[neighbourID]) ? data[neighbourID].slice() : [];
                nextNeighbours = _.without(nextNeighbours, focusID);
                if (!noCompress && nextNeighbours.length == 1) {
                    spaceFactor = neighbourID != this.rootID ? -0.75 : -0.5;
                    currentScaleFactor = 0.9;
                    currentChildRadius = focusRadius * currentScaleFactor;
                }

                if (config.compressRoot && neighbourID == this.rootID) {
                    spaceFactor = -0.75;
                    currentScaleFactor = 1.0;
                    currentChildRadius = focusRadius * currentScaleFactor;
                }

                spaceFactor *= neighbourViewState.spaceAdjust || 1;

                var currentAngle = startAngle + (angleStep * neighbourCtr),
                    neighbourState = this.calcDetails(neighbourID, focusID, baseState.x, baseState.y,
                                            currentChildRadius, focusRadius, 2, currentAngle, baseState.zIndex - 30, 
                                            baseState.zIndex - neighbourCtr - 1, parentFontSize, currentScaleFactor, spaceFactor, prevBaseState);

                currentState.data[neighbourID] = neighbourState;
                this.computeLayoutData_Outside(data, neighbourID, prevState, currentState);
            }, this);
        }

        return currentState;
    },

    setViewState: function(viewID, state) {
        state = state || {};

        var viewState = this.viewStates[viewID];
        if (!viewState) {
            viewState = {};
        }

        _.extend(viewState, state);
        this.viewStates[viewID] = viewState;
    },

    getViewState: function(viewID) {
        if (!(viewID in this.viewStates)) {
            this.viewStates[viewID] = {};
        }
        return this.viewStates[viewID];
    },

    calcChildRadius: function(baseRadius, targetRadius, arcAngle, numNeighbours, spaceFactor) {
        spaceFactor = spaceFactor || this.config.spaceFactor;

        var spacingRadius = this.calcChildDistance(baseRadius, targetRadius, spaceFactor),
            circumference = (2 * Math.PI * spacingRadius) * (arcAngle / 360),
            childRadius = ((circumference * 1.1) / numNeighbours) / 2;

        // No larger than target
        return Math.min(targetRadius * 1.15, childRadius);
    },

    calcChildDistance: function(parentRadius, childRadius, spaceFactor) {
        spaceFactor = spaceFactor || this.config.spaceFactor;
        return parentRadius + (childRadius * spaceFactor);
    },

    /*
        Render the outer nodes separately.
    */
    computeLayoutData_Outside: function(data, focusID, prevState, currentState) {
        var config = this.config,
            baseState = currentState.data[focusID],
            parentID = baseState.parentID,
            depth = baseState.depth,
            startAngle = baseState.startAngle,
            isRoot = focusID == this.rootID,
            neighbours = _.isArray(data[focusID]) ? data[focusID].slice() : [],
            angleArc = config.childAngleArc,
            baseRadius = baseState.radius,
            childRadius = baseRadius * config.scaleFactor,
            prevBaseState = prevState ? prevState.data[focusID] : null;

        if (neighbours.length == 0) {
            return;
        }

        var childRadius = this.calcChildRadius(baseRadius, childRadius, angleArc, neighbours.length, config.spaceFactor);
        var scaleFactor = childRadius / baseRadius;

        var parentFontSize = baseState.fontSize[0];

        if (config.hideSmallText && baseState.depth > config.minDepth) {
            if ((parentFontSize * scaleFactor) / this.getFocusRadius() < config.fontSizeProportion) {
                return;
            }
        }

        if (_.isNumber(config.maxDepth) && baseState.depth + 1 >= config.maxDepth) {
            return;
        }

        var angleStep = angleArc / neighbours.length;
        startAngle -= (angleArc / 2);

        baseState.allNeighbours = neighbours; 
        // Also used by the rendering stage
        baseState.neighbours = _.without(neighbours, parentID);

        var skipParent = false;
        if (_.indexOf(neighbours, parentID) >= 0) {
            skipParent = true;
        }
        else if (prevBaseState) {
            if (_.indexOf(prevBaseState.allNeighbours, parentID) >= 0) {
                skipParent = true;
            }
        }

        var orderedNeighbours = this.reorderNeighbours(neighbours, parentID, skipParent),
            numSiblings = orderedNeighbours.length - 1;

        _.each(orderedNeighbours, function(neighbourID, neighbourCtr) {
            var currentChildRadius = childRadius,
                currentScaleFactor = scaleFactor,
                spaceFactor = config.spaceFactor,
                nextNeighbours = _.isArray(data[neighbourID]) ? data[neighbourID].slice() : [];

            var neighbourModel = this.contexts.get(neighbourID),
                noCompress = false;

            if (config.noCompress) {
                noCompress = true;
            }
            else if ((Date.now() / 1000) - neighbourModel.getNS('Timestamp') < config.newContextBumpTime) {
                noCompress = true;
            }

            nextNeighbours = _.without(nextNeighbours, focusID);

            if (!noCompress) {
                if (nextNeighbours.length == 1) {
                    spaceFactor = neighbourID != this.rootID ? -0.75 : -0.5;
                    currentScaleFactor = 0.9;
                    currentChildRadius = baseRadius * currentScaleFactor;
                }
                /*else if ((nextNeighbours.length == 0) && (numSiblings == 0)) {
                    currentScaleFactor = 0.7;
                    currentChildRadius = baseRadius * currentScaleFactor;
                }*/
            }

            var currentAngle = startAngle + (angleStep * (neighbourCtr + 1)),
                neighbourState = this.calcDetails(neighbourID, focusID, baseState.x, baseState.y,
                                        currentChildRadius, baseRadius, depth + 1, currentAngle, baseState.zIndex - 30, 
                                        baseState.zIndex - neighbourCtr - 1, parentFontSize, currentScaleFactor, spaceFactor, prevBaseState);

            currentState.data[neighbourID] = neighbourState;
            this.computeLayoutData_Outside(data, neighbourID, prevState, currentState);
        }, this);
    },

    reorderNeighbours: function(neighbours, originID, skipParent) {
        var parentIdx = _.indexOf(neighbours, originID),
            orderedNeighbours = neighbours;

        if (parentIdx >= 0) {
            if (skipParent) {
                orderedNeighbours = _.rest(neighbours, parentIdx + 1).concat(_.initial(neighbours, neighbours.length - parentIdx));
            }
            else {
                orderedNeighbours = _.rest(neighbours, parentIdx).concat(_.initial(neighbours, neighbours.length - parentIdx));
            }
        }

        return orderedNeighbours;
    },

    normalizeAngle: function(angle) {
        angle = angle || 0;
        angle = angle % 360;

        if (angle < 0) {
            angle += 360;
        }

        return angle;
    },

    computeChildPosition: function(distance, currentAngle, baseX, baseY) {
        return {
            x: baseX + (distance * Math.cos((currentAngle / 180) * Math.PI)),
            y: baseY + (distance * Math.sin((currentAngle / 180) * Math.PI))
        }
    },

    computeChildFontSize: function(parentFontSize, scaleFactor) {
        scaleFactor = scaleFactor || this.config.scaleFactor;
        return parentFontSize * scaleFactor;
    },

    calcDetails: function(pointID, parentID, baseX, baseY, radius, parentRadius, depth, currentAngle, parentZIndex, zIndex, parentFontSize, scaleFactor, spaceFactor, prevBaseState) {
        spaceFactor = spaceFactor || this.config.spaceFactor;

        var fontSize = this.computeChildFontSize(parentFontSize, scaleFactor),
            distance = this.calcChildDistance(parentRadius, radius, spaceFactor),
            childPosition = this.computeChildPosition(distance, currentAngle, baseX, baseY),
            result = {},
            initialX = baseX,
            initialY = baseY;

        if (prevBaseState) {
            initialX = prevBaseState.baseX;
            initialY = prevBaseState.baseY;
        }

        _.extend(result, {
            id: pointID,
            radius: Math.round(radius),
            x: Math.round(childPosition.x),
            y: Math.round(childPosition.y),
            fontSize: [fontSize, 'px'],

            baseX: baseX,
            baseY: baseY,

            initialX: initialX,
            initialY: initialY,
            
            depth: depth,
            scaleFactor: scaleFactor,
            parentZIndex: parentZIndex,
            parentID: parentID,
            zIndex: zIndex,
            startAngle: currentAngle,
            inverseAngle: (currentAngle - 180) % 360
        });

        if (radius != 0) {
            _.extend(result, {
                visible: true
            });
        }
        else {
            _.extend(result, {
                visible: false,
                x: 0,
                y: 0
            });
        }

        return result;
    },

    renderViews: function(layoutData, options, rootTrace, renderedViewIDs) {
        options = options || {};

        var config = this.config,
            currentID = options.currentID || layoutData.focusID,
            noAnimate = options.noAnimate || false,
            data = layoutData.data,
            currentState = data[currentID],
            neighbours = currentState.neighbours,
            isFocus = currentID == layoutData.focusID,
            isRoot = currentID == this.rootID,
            isGlobalRoot = currentID == this.globalRootContextID,
            baseView = this.getView(currentID, isRoot, isGlobalRoot, null, options);

        if (!currentState.visible) { 
            baseView.hide();
        }

        if (currentState.visible && isFocus) { 
            baseView.$el.removeClass('simple-view-trace-root');
            baseView.show();

            if (!options.forceRender && currentState.x == baseView.x
                    && currentState.y == baseView.y
                    && baseView.radius == currentState.radius
                    && !baseView.surfaceView.dataReactive(currentID)) {

                // Simplify
                if (currentState.zIndex != baseView.zIndex) {
                    baseView.setZIndex(currentState.zIndex);
                }
            }
            else {
                baseView.setSize(currentState.radius, true, null, options.forceRender);
                baseView.setPosition(currentState.x, currentState.y, true, true);
                baseView.setZIndex(currentState.zIndex);
                baseView.setFontSize(currentState.fontSize[0], currentState.fontSize[1], true);
                baseView.setVisualQuality(config.visualQuality);

                var surfaceView = this.getSurfaceView(currentID, currentState);
                baseView.addSurfaceView('test', surfaceView);
                baseView.setActiveSurfaceView('test', {
                    render: false
                });

                baseView.render({
                    graphWidth: (this.getFocusRadius() / Math.pow(2, 0.5)) * 2 * 0.8,
                    graphHeight: (this.getFocusRadius() / Math.pow(2, 0.5)) * 2 * 0.5,
                    renderSurface: options.renderSurfaces,
                    forceColor: config.forceNodeColor
                });

                if (this.nodeAppearance.applyCSS) {
                    this.nodeAppearance.applyCSS(baseView.$el, true);
                }

                if (this.nodeAppearance.extraRender) {
                    this.nodeAppearance.extraRender(baseView, currentState, data);
                }

                baseView.exec(noAnimate, options.animateDuration || config.animateDuration);
                if (this.nodeAppearance.extraExec) {
                    this.nodeAppearance.extraExec(baseView, currentState, this.getViewState(currentID), data);
                }
            }

            renderedViewIDs.push(currentID);
        }

        _.each(neighbours, function(neighbourID, i) {
            var neighbourState = data[neighbourID];
            if (!neighbourState) {
                return;
            }

            if (neighbourID == currentID || neighbourID == layoutData.focusID || neighbourID == neighbourState.parentID) {
                return;
            }

            var neighbourView = this.getView(neighbourID, null, null, null, options),
                neighbourViewState = this.getViewState(neighbourID);

            if (neighbourState.visible) {
                if (!config.hideLabels && config.showLabelFunc) {
                    neighbourView.hideLabel = !config.showLabelFunc(neighbourState.depth);
                }

                if (!options.noAnimate && !neighbourView.visible) {
                    neighbourView.setSize(0, false);
                    neighbourView.setPosition(neighbourState.initialX, neighbourState.initialY, false, true);
                    neighbourView.exec(true, options.animateDuration || config.animateDuration);
                }

                neighbourView.show();

                if (!options.forceRender && neighbourState.x == neighbourView.x
                        && neighbourState.y == neighbourView.y
                        && neighbourView.radius == neighbourState.radius
                        && !baseView.surfaceView.dataReactive(neighbourID)) {
                    // Simplify
                    if (neighbourState.zIndex != neighbourView.zIndex) {
                        neighbourView.setZIndex(neighbourState.zIndex);
                    }

                    neighbourView.setVisualQuality(config.visualQuality);
                    if (config.forceNodeColor) {
                        neighbourView.renderColor(null, true);
                    }

                    if (this.nodeAppearance.applyCSS) {
                        this.nodeAppearance.applyCSS(neighbourView.$el);
                    }
                }
                else {
                    neighbourView.setSize(neighbourState.radius, true, null, options.forceRender);
                    neighbourView.setPosition(neighbourState.x, neighbourState.y, true, true);
                    neighbourView.setZIndex(neighbourState.zIndex);
                    neighbourView.setFontSize(neighbourState.fontSize[0], neighbourState.fontSize[1], true);
                    neighbourView.setVisualQuality(config.visualQuality);

                    var colorTransition = null,
                        fadeTarget = $.Color(config.fadeTarget);

                    if (neighbourState.depth >= config.fadeDepth) {
                        var fadeAmount = (((neighbourState.depth - config.fadeDepth) + 1) * config.fadeFactor);
                        colorTransition = {
                            target: fadeTarget,
                            distance: Math.min(0.85, fadeAmount)
                        }
                    }

                    var surfaceView = this.getSurfaceView(neighbourID, neighbourState);
                    neighbourView.addSurfaceView('test', surfaceView);
                    neighbourView.setActiveSurfaceView('test', {
                        render: false
                    });

                    if (neighbourViewState.colorFade) {
                        colorTransition = {
                            target: fadeTarget,
                            distance: neighbourViewState.colorFade
                        }
                    }

                    neighbourView.render({
                        colorTransition: colorTransition,
                        graphWidth: (this.getFocusRadius() / Math.pow(2, 0.5) * 2) * 0.8,
                        graphHeight: (this.getFocusRadius() / Math.pow(2, 0.5) * 2) * 0.5,
                        renderSurface: options.renderSurfaces,
                        forceColor: config.forceNodeColor
                    });
                    if (this.nodeAppearance.applyCSS) {
                        this.nodeAppearance.applyCSS(neighbourView.$el);
                    }
                    if (this.nodeAppearance.extraRender) {
                        this.nodeAppearance.extraRender(neighbourView, neighbourState, data);
                    }
                    neighbourView.exec(noAnimate, options.animateDuration || config.animateDuration);
                    if (this.nodeAppearance.extraExec) {
                        this.nodeAppearance.extraExec(neighbourView, neighbourState, neighbourViewState, data);
                    }
                }
                renderedViewIDs.push(neighbourID);

                if (rootTrace) {
                    if (_.indexOf(rootTrace, neighbourID) >= 0) {
                        neighbourView.$el.addClass('simple-view-trace-root');
                        this.lastVisibleTraceID = neighbourID;
                    }
                    else {
                        neighbourView.$el.removeClass('simple-view-trace-root');
                    }
                }

                var nextOptions = _.extend({}, options, {
                    currentID: neighbourID
                });
                this.renderViews(layoutData, nextOptions, rootTrace, renderedViewIDs);
            }
            else {
                neighbourView.hide();
            }
        }, this);
    }
});

_.extend(Cluster.prototype, Backbone.Events);
module.exports = Cluster;
