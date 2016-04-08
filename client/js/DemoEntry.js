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
    jQueryTransit = null,
    //jQueryTransit = require('app/lib/jquery.transit'),
    _ = require('backbone/node_modules/underscore'),
    Backbone = require('backbone'),
    moment = require('app/lib/moment'),
    BackboneDualStorage = require('app/lib/backbone.dualstorage.amd'),
    SimpleView = require('app/views/SimpleView');

window._ = _;
window.$ = window.jQuery = $;

// -------------
var BenomeView = require('app/Benome');

$(function() {

(function(window, document) {

var BenomeEntry = function() {};

_.extend(BenomeEntry.prototype, {
    isMobile: ('ontouchstart' in document.documentElement),
    isAndroid: (/android/i.test(navigator.userAgent)),
    isApple: (/iphone|ipod|ipad/i.test(navigator.userAgent)),
    isMac: (/Macintosh/.test(navigator.userAgent)),
    isTablet: (/ipad/i.test(navigator.userAgent) || ((/android/i.test(navigator.userAgent)) && !(/mobile/i.test(navigator.userAgent)))),

    init: function(options) {
        options = options || {};
        _.bindAll(this, 'refreshScores', 'pointAddLoop', 'drawLines');

        var $container = options.container ? $(options.container) : $('body');
        $container.addClass('benome-container');
        this.$container = $container

        var instanceID = options.instanceID || parseInt((Math.random() * 1000000) + 100000).toString();

        var hideLabels = options.hideLabels,
            labelIDsOnly = this.QueryString.i === '1',
            clusterOnly = options.clusterOnly,
            autoActionDelay = parseInt(this.QueryString.aa) || null,
            visualQuality = null,
            backgroundColor = null,
            globalAppOnly = options.globalAppOnly,
            clusterFilterShift = false,
            clusterRefreshInterval = 5000;

        // QueryString overrides passed parameters
        // The underlying data must be scrubbed for actual privacy
        if (this.QueryString.gao) {
            globalAppOnly = this.QueryString.gao === '1';
        }

        if (this.QueryString.vq) {
            visualQuality = parseInt(this.QueryString.vq) || 0;
        }

        if (this.QueryString.bg) {
            backgroundColor = 'light';
            if (this.QueryString.bg in {'dark': 1, 'white': 1}) {
                backgroundColor = this.QueryString.bg;
            }
        }

        if (this.QueryString.c) {
            clusterOnly = this.QueryString.c === '1';
        }

        if (this.QueryString.p) {
            hideLabels = this.QueryString.p === '1';
        }

        if (this.QueryString.cfs) {
            clusterFilterShift = this.QueryString.cfs === '1';
        }

        var defaultFilter = 0;
        if (parseInt(this.QueryString.d) >= 1) {
            defaultFilter = Math.min(10, parseInt(this.QueryString.d)) - 1;
        }

        SimpleView.prototype.heightProportion = 0.6;

        var viewOptions = _.extend(options, {
            container: this.$container,
            defaultFilter: defaultFilter,
            autoActionDelay: autoActionDelay,
            visualQuality: visualQuality,
            bgColor: backgroundColor,
            globalAppOnly: globalAppOnly,
            instanceID: instanceID,
            localOnly: options.localOnly,
            clusterOnly: clusterOnly,
            hideLabels: hideLabels,
            enabledApps: options.enabledApps,
            continuousTiming: options.continuousTiming,
            clusterFilterShift: clusterFilterShift,
            clusterRefreshInterval: clusterRefreshInterval,
            idleWait: true,
            idleThreshold: 10000,

            globalClusterOptions: {
                setBackgroundFilterLevel: true
            },

            timelineDisabled: true,

            darkText: 'black',
            lightText: 'black',
            
            nodeAppearance: {
                applyCSS: function($el) {
                    $($el).css({
                        'border': '4px solid black'
                    })
                }
            }
        });

        var benomeBase = new BenomeView(viewOptions);
        $container.append(benomeBase.$el);
        benomeBase.postAttach();

        this.base = benomeBase;

        var _this = this;
        this.base.G.on('ClusterScoresUpdated', function(clusterContexts) {
            var scores = clusterContexts.map(function(context) {
                return [context, context.getDistanceScore(), context.metaData.get('RecentInterval_5'), context.metaData.get('TimeSince'), context.metaData.get('TimeSinceAdjusted')];
            });
            scores.sort(function (a, b) { return b[1] - a[1]; });
            _this.scoreView.update(scores);
        });

        this.base.G.on('ClusterFilterValueChanged', function(cluster, filterValue) {
            _this.scoreView.updateFilterValue(filterValue);
        });

        /*this.base.G.on('AfterClusterRender', function(cluster) {
        });*/

        this.base.G.on('AfterClusterAnim', function(cluster) {
            _this.viewStateShiftEnabled = true;
        });

        this.scoreView = new ScoreView({G: this.base.G});
        this.$container.append(this.scoreView.render().$el);

        this.base.load();

        var viewStateClasses = [
            FlatOvalOutline,
            FocusOvalOutline,
            FocusCircleOutline,
            FocusCircleCluster,
            FocusCircleClusterColored,
            FocusCircleClusterColoredHQ,
            //FocusCircleClusterColoredHQExtras
        ];
        this.viewStateIdx = null;
        this.viewStateInstances = _.map(viewStateClasses, function(ViewStateClass) {
            var viewStateInstance = new ViewStateClass(this);
            viewStateInstance.init();
            return viewStateInstance;
        }, this);

        $('body').keydown(function(e) {
            if (!_this.viewStateShiftEnabled) {
                return;
            }

            var viewStateIdx = _this.viewStateIdx;
            viewStateIdx = viewStateIdx || 0;
            if (e.which == 33) {
                viewStateIdx += 1
                _this.setViewState(viewStateIdx);
            }
            else if (e.which == 34) {
                viewStateIdx -= 1
                _this.setViewState(viewStateIdx);
            }
        });

        this.addPointsEnabled = false;
        this.scoreRefreshInterval = 1000;
        _.delay(this.refreshScores, this.scoreRefreshInterval);

        $('<div>')
            .css({
                'background-color': '#ccc',
                'color': 'black',
                'border-radius': '4px',
                'width': '5em',
                'height': '1.25em',
                'border': '1px solid black',
                'position': 'absolute',
                'z-index': '999999999999',
                'left': '2em',
                'bottom': '0.05em',
                'overflow': 'hidden',
                'text-align': 'center',
                'cursor': 'pointer',
                'font-family': 'sans-serif',
                'user-select': 'none'
            })
            .text('Add Points')
            .click(function() {
                _this.addPointsEnabled = !_this.addPointsEnabled;
                $(this).css({
                    'background-color': _this.addPointsEnabled ? '#888' : '#ccc'
                });
            })
            .appendTo(this.$container);

        $('<div>')
            .css({
                'background-color': '#ccc',
                'color': 'black',
                'border-radius': '4px',
                'width': '8em',
                'height': '1.25em',
                'border': '1px solid black',
                'position': 'absolute',
                'z-index': '999999999999',
                'right': '2em',
                'bottom': '0.05em',
                'overflow': 'hidden',
                'text-align': 'center',
                'cursor': 'pointer',
                'font-family': 'sans-serif',
                'user-select': 'none'
            })
            .text('Auto Filter')
            .click(function() {
                _this.base.clusterFilterShift = !_this.base.clusterFilterShift;
                $(this).css({
                    'background-color': _this.base.clusterFilterShift ? '#888' : '#ccc'
                });
            })
            .appendTo(this.$container);

        $('<div>')
            .css({
                'background-color': '#ccc',
                'color': 'black',
                'border-radius': '4px',
                'width': '5em',
                'height': '1.25em',
                'border': '1px solid black',
                'position': 'absolute',
                'z-index': '999999999999',
                'left': '8em',
                'bottom': '0.05em',
                'overflow': 'hidden',
                'text-align': 'center',
                'cursor': 'pointer',
                'font-family': 'sans-serif',
                'user-select': 'none'
            })
            .text('Play')
            .click(function() {
                _.each(_this.viewStateInstances, function(viewStateInstance, i, l) {
                    _.delay(function(i) {
                        return function() {
                            _this.setViewState(i);
                        }
                    }(i), i * 1500);
                });
            })
            .appendTo(this.$container);

        _.each(_.range(0, this.viewStateInstances.length), function(i) {
            $('<div>')
                .css({
                    'background-color': '#ccc',
                    'color': 'black',
                    'border-radius': '4px',
                    'width': '3em',
                    'height': '1.25em',
                    'border': '1px solid black',
                    'position': 'absolute',
                    'z-index': '999999999999',
                    'left': (14 + (4 * i)) + 'em',
                    'bottom': '0.05em',
                    'overflow': 'hidden',
                    'text-align': 'center',
                    'cursor': 'pointer',
                    'font-family': 'sans-serif',
                    'user-select': 'none'
                })
                .attr('id', 'viewstate-' + i)
                .addClass('viewstate')
                .text(i)
                .click(function() {
                    _this.setViewState(i);
                })
                .appendTo(this.$container);
        }, this);

        _.delay(this.pointAddLoop, 3000);
    },

    injectPoints: function(pointDistribution, numSegments, segmentLength) {
        var ts = Date.now() / 1000;

        _.each(_.range(0, numSegments), function(i) {
            var t = ts - (i * segmentLength),
                contextID = null;

            while (!contextID) {
                var z = _.sample(pointDistribution);
                if (Math.random() < z[1]) {
                    contextID = z[0];
                }
            }

            this.base.G.trigger('AddPoint', contextID, this.base.globalCluster.cluster.clusterID, {
                    UpdatedAttributes: {
                        Timing: {
                            Time: t,
                            Duration: 0
                        }
                    }
                }, null, {
                    showHistory: false,
                    showAddFeedback: false,
                    toParent: false,
                    showDetail: false
                });
        }, this);
    },

    setViewState: function(newViewStateIdx, force) {
        if (!force && !this.viewStateShiftEnabled) {
            return;
        }

        newViewStateIdx = Math.max(0, Math.min(this.viewStateInstances.length - 1, newViewStateIdx));
        var prevViewStateIdx = this.viewStateIdx;

        if (!force && newViewStateIdx != prevViewStateIdx) {
            $('.viewstate').css({
                'background-color': '#ccc'
            });
            $('#viewstate-' + newViewStateIdx).css({
                'background-color': '#888'
            });

            this.viewStateIdx = newViewStateIdx;
            this.viewStateShiftEnabled = false;
            var viewStateInstance = this.viewStateInstances[newViewStateIdx];
            viewStateInstance.exec();
        }
    },

    pointAddLoop: function() {
        // This assumes scores are being regularly updated

        if (this.addPointsEnabled) {
            // Choose the context in a pseudo-random fashion
            var cluster = this.base.globalCluster.cluster,
                rootContext = cluster.contexts.getRoot(),
                leafContexts = [];

            rootContext.traverseDown(function(context) {
                if (context.isLeaf()) {
                    leafContexts.push(context);
                }
            });

            // Pick from the top half
            var pickedContext = _.chain(leafContexts)
                                    .sortBy(function (c) {
                                        return -c.metaData.get('CurrentScore');
                                    })
                                    .first(Math.max(1, Math.floor(leafContexts.length / 2)))
                                    .shuffle()
                                    .find(function(context) {
                                        score = context.metaData.get('CurrentScore');
                                        if (score > 0.45 && Math.random() < score) {
                                            return true;
                                        }
                                    })
                                .value();

            if (pickedContext) {
                this.addPoint(pickedContext);
            }
        }
        _.delay(this.pointAddLoop, 3000);
    },

    addPoint: function(context) {
        var _this = this;
        function add() {
            _this.base.G.trigger('AddPoint', context.id, _this.base.globalCluster.cluster.clusterID, {
                    UpdatedAttributes: {
                        Timing: {
                            Time: Date.now() / 1000,
                            Duration: 0
                        }
                    }
                }, null, {
                    showHistory: false,
                    showAddFeedback: false,
                    toParent: false,
                    showDetail: false
                });
        }

        // Animate a thing

        // Add the point
        var destView = this.base.globalCluster.cluster.getView(context.id),
            pointSize = 30;
        
        var $el = $('<div>')
                        .css({
                            'border-radius': '50px',
                            'width': pointSize + 'px',
                            'height': pointSize + 'px',
                            'border': '4px solid black',
                            'background-color': 'white',
                            'position': 'absolute',
                            'z-index': '999999999999',
                            'left': (destView.x - (pointSize / 2)) + 'px',
                            'top': (destView.y - (pointSize / 2)) + 'px'
                        })
                        .appendTo(this.$container);


        $el.animate({
                'left': (this.$container.width() - 50) + 'px',
                'top': '-50px'
            }, 
            {
                duration: 500,
                complete: function() {
                    $(this).animate({
                        'opacity': 0
                    }, {
                        duration: 250,
                        complete: function() {
                            $(this).remove();
                            $el = null;

                            add();
                        }
                    })
                }
            });
    },

    refreshScores: function() {
        var contexts = this.base.globalCluster.cluster.contexts;
        contexts.updateScores();
        contexts.traverseGraph(this.base.globalCluster.cluster.focusID);
        console.log('Scores updated');

        _.delay(this.refreshScores, this.scoreRefreshInterval);
    },

    getActiveViewState: function() {
        return this.viewStateInstances[this.viewStateIdx];
    },

    drawLines: function(currentView, viewDetails, viewState, layoutData) {
        var context = currentView.model;
        if (context.isLeaf()) {
            return;
        }

        if (!viewState['LineElements']) {
            viewState['LineElements'] = {};
        }

        _.each(context.getAssoc('down'), function(childContextID) {
            var childViewState = layoutData[childContextID],
                $lineEl = viewState['LineElements'][childContextID];

            if (!childViewState || !childViewState.visible || !this.getActiveViewState().config.linesEnabled) {
                $lineEl && $lineEl.hide();
                return;
            }

            var animate = true;
            if (!$lineEl) {
                $lineEl = $('<div>')
                                .addClass('connector-line')
                                .css({
                                    'display': 'block',
                                    'height': '3.5px',
                                    'position': 'absolute',
                                    'background-color': 'black',
                                    'transform-origin': 'top left',
                                    'transform': 'rotate(0deg)',
                                });

                this.$container.append($lineEl);
                viewState['LineElements'][childContextID] = $lineEl;
                animate = false;
            }
            else {
                $lineEl.show();
            }

            this.drawLine($lineEl, viewDetails, viewState, childViewState, animate);
        }, this);
    },

    calcRotation: function(newDegrees, viewState, childID, parentID) {
        if (!viewState['LineDegrees']) {
            viewState['LineDegrees'] = {};
        }
        var prevDegrees = viewState['LineDegrees'][childID] || 0,
            aR = prevDegrees % 360;

        if (aR < 0) {
            aR += 360;
        }
        if (aR < 180 && (newDegrees > (aR + 180))) {
            prevDegrees -= 360;
        }
        if (aR >= 180 && (newDegrees <= (aR - 180))) {
            prevDegrees += 360;
        }
        prevDegrees += (newDegrees - aR);

        if (Math.abs(prevDegrees) > 360) {
            //debugger;
        }

        viewState['LineDegrees'][childID] = prevDegrees % 360;
        return prevDegrees;
    },

    drawLine: function($lineEl, beginViewDetails, beginViewState, endViewDetails, animate) {
        var diffX = endViewDetails.x - beginViewDetails.x,
            diffY = endViewDetails.y - beginViewDetails.y;

        var newDegrees = Math.atan2(diffY, diffX) * (180 / Math.PI),
            length = Math.pow((diffY * diffY) + (diffX * diffX), 0.5),
            degrees = this.calcRotation(newDegrees, beginViewState, endViewDetails.id);

        if (animate) {
            if (!jQueryTransit) {
                $lineEl.css({
                    'transform': 'rotate(' + Math.round(degrees) + 'deg)',
                });
                $lineEl.animate({
                    'width': length + 'px',
                    'left': beginViewDetails.x + 'px',
                    'top': beginViewDetails.y + 'px'
                }, { duration: 420, easing: 'linear'});
            }
            else {
                // set start pos if needed
                //console.log(parentView.viewID, parentView.model.getNS('Label'), endViewDetails.id, degrees);
                $lineEl.transition({
                    'transform': 'rotate(' + Math.round(degrees) + 'deg)',
                    'width': length + 'px',
                    'left': beginViewDetails.x + 'px',
                    'top': beginViewDetails.y + 'px'
                }, 500, 'linear');
            }
        }
        else {
            $lineEl.css({
                'transform': 'rotate(' + Math.round(degrees) + 'deg)',
                'width': length + 'px',
                'left': beginViewDetails.x + 'px',
                'top': beginViewDetails.y + 'px'
            });
        }
    },

    QueryString: function() {
        var queryString = {};
        var query = window.location.search.substring(1);
        var vars = query.split('&');

        for (var i = 0; i < vars.length; i++) {
            var pair = vars[i].split('='),
                first = pair[0],
                second = pair[1];

            if (typeof queryString[first] === 'undefined') {
                queryString[first] = second;
            }
            else if (typeof queryString[first] === 'string') {
                queryString[first] = [queryString[first], second];
            }
            else {
                queryString[first].push(second);
            }
        } 
        return queryString;
    }()
});

var ScoreView = Backbone.View.extend({
    tagName: 'div',
    className: 'scores',

    events: {
    },

    initialize: function(options) {
        options = options || {};
        this.G = options.G;
        this.filterValue = options.filterValue || 0;

        this.$el.css({
            'position': 'absolute',
            'left': '0.25%',
            'top': '10em',
            'width': '23em',
            'padding': '0.45em',
            'font-family': 'sans-serif',
            'line-height': '1.25em',
            'border': '2px solid black',
            'color': 'black',
            'z-index': '9999999999',
            'border-radius': '1em',
            'font-size': '15px',
            'overflow': 'hidden',
            'background-color': 'white',
            'box-sizing': 'border-box'
        });
    },

    update: function(sortedScores) {
        this.scores = sortedScores;
        this.render();
    },

    updateFilterValue: function(filterValue) {
        this.filterValue = filterValue;
        this.render();
    },

    render: function() {
        this.$el.empty();

        var _this = this;
        function addFilterIndicator() {
            $filterIndicator = $('<div>')
                                    .css({
                                        'width': '120%',
                                        'margin-left': '-10%',
                                        'height': '0.30em',
                                        'background-color': 'black',
                                        'border-radius': '0.25em',
                                        'margin-top': '0.15em',
                                        'margin-bottom': '0.15em',
                                        'display': 'inline-block',
                                        'box-sizing': 'border-box'
                                    });

            _this.$el.append($filterIndicator);
        }

        var filterIndicatorRendered = false;
        _.each(this.scores, function(score) {
            var context = score[0],
                color = context.getColor(),
                scoreVal = score[1],
                freq = score[2] || 0,
                timeSince = score[3] || 0,
                timeSinceAdjusted = score[4] || 0,
                timeAdjust = timeSinceAdjusted - timeSince,
                $line;

            if (scoreVal < this.filterValue && !filterIndicatorRendered) {
                addFilterIndicator();
                filterIndicatorRendered = true;
            }

            if (context.isLeaf()) {
                if (filterIndicatorRendered) {
                    color = '#ccc';
                }
                $line = $('<div>')
                                .css({
                                    'width': '100%',
                                    'background-color': color,
                                    /*'border': '1px solid black',*/
                                    'padding': '0.1em',
                                    'display': 'inline-block',
                                    'box-sizing': 'border-box'
                                });

                $label = $('<span>')
                                .css({
                                    'width': '45%',
                                    'height': '100%',
                                    'float': 'left'
                                })
                                .text(context.getNS('Label'));
                
                $score = $('<span>')
                                .css({
                                    'width': '10%',
                                    'height': '100%',
                                    'float': 'right',
                                    'text-align': 'right'
                                })
                                .text(scoreVal.toFixed(2));

                $freq = $('<span>')
                                .css({
                                    'width': '15%',
                                    'height': '100%',
                                    'float': 'right',
                                    'text-align': 'right'
                                })
                                .text(parseInt(freq));

                $ts = $('<span>')
                                .css({
                                    'width': '15%',
                                    'height': '100%',
                                    'float': 'right',
                                    'text-align': 'right'
                                })
                                .text(parseInt(timeSince));

                $ta = $('<span>')
                                .css({
                                    'width': '15%',
                                    'height': '100%',
                                    'float': 'right',
                                    'text-align': 'right'
                                })
                                .text(parseInt(timeAdjust));

                $line.append($label);

                $line.append($ta);
                $line.append($ts);
                $line.append($freq);
                $line.append($score);
                this.$el.append($line);
            }
        }, this);

        if (!filterIndicatorRendered) {
            addFilterIndicator();
        }

        return this;
    },

    hide: function() {
        this.$el.hide();
    },

    show: function() {
        this.$el.show();
    }
});

function ViewStateBase(controller) {
    _.bindAll(this, 'exec');
    this.controller = controller;

    this.config = {};
    this.clusterConfig = {};
    this.nodeAppearance = {};
    this.position = {};
};
_.extend(ViewStateBase.prototype, {
    init: function() {
        var config = {
            heightProportion: 1.0
        }

        var clusterConfig = {
            // defaults
            forceRender: true
        };

        var nodeAppearance = _.extend({}, this.controller.base.globalCluster.cluster.defaultNodeAppearance);
        var position = {
            y: this.controller.$container.height() / 2,
            x: this.controller.$container.width() / 2
        }

        this.merge(config, clusterConfig, nodeAppearance, position);
    },

    merge: function(config, clusterConfig, nodeAppearance, position) {
        _.extend(this.config, config);
        _.extend(this.clusterConfig, clusterConfig);
        _.extend(this.nodeAppearance, nodeAppearance);
        _.extend(this.position, position);
    },

    exec: function() {
        this.config.scoreListEnabled ? this.controller.scoreView.show() : this.controller.scoreView.hide();
        this.config.destroyerEnabled ? this.controller.base.showDestroyerView() : this.controller.base.hideDestroyerView();
        this.config.creatorEnabled ? this.controller.base.showCreatorView() : this.controller.base.hideCreatorView();

        // FIXME: horrible hack
        SimpleView.prototype.heightProportion = this.config.heightProportion;

        var clusterController = this.controller.base.globalCluster,
            cluster = clusterController.cluster,
            _this = this;

        cluster.setAppearance(this.nodeAppearance);
        cluster.setRadius(clusterController.getClusterSize() * this.clusterConfig.radiusScaleFactor);

        cluster.setPosition(this.position.x, this.position.y);
        cluster.setConfig(this.clusterConfig);
        cluster.render({
            forceRender: this.clusterConfig.forceRender
        });
    }
});

function FlatOvalOutline(controller) {
    ViewStateBase.call(this, controller);
    this.name = 'FlatOvalOutline';
}
_.extend(FlatOvalOutline.prototype, ViewStateBase.prototype, {
    init: function() {
        ViewStateBase.prototype.init.call(this);

        var config = {
            heightProportion: 0.6,
            linesEnabled: true,
            creatorEnabled: false,
            destroyerEnabled: false,
            scoreListEnabled: false
        }

        var clusterConfig = {
            scaleFactor: 0.85,
            spaceFactor: 1.35,
            fontFraction: 0.25,
            childAngleArc: 200,
            setBackgroundFilterLevel: true,
            visualQuality: 0,
            showDetailIndicator: false,
            animateDuration: 800,
            radiusScaleFactor: 0.55
        }

        var nodeAppearance = {
            getColor: function() {
                return 'white';
            },

            applyCSS: function($el, isFocus) {
                $el.css({
                    'background-color': isFocus ? 'orange': 'white',
                    'border': '4px solid black'
                });
            },

            extraExec: this.controller.drawLines
        }

        var position = {
            y: this.controller.$container.height() / 2,
            x: (this.controller.$container.width() / 2) // * 1.1
        }

        this.merge(config, clusterConfig, nodeAppearance, position);
    }
});

function FocusOvalOutline(controller) {
    FlatOvalOutline.call(this, controller);
    this.name = 'FocusOvalOutline';
}
_.extend(FocusOvalOutline.prototype, ViewStateBase.prototype, FlatOvalOutline.prototype, {
    init: function() {
        FlatOvalOutline.prototype.init.call(this);

        var config = {};
        var clusterConfig = {
            scaleFactor: 0.6,
            spaceFactor: 1.1,
            radiusScaleFactor: 0.9
        };
        var nodeAppearance = {};
        var position = {};

        this.merge(config, clusterConfig, nodeAppearance, position);
    }
});

function FocusCircleOutline(controller) {
    FocusOvalOutline.call(this, controller);
    this.name = 'FocusCircleOutline';
}

_.extend(FocusCircleOutline.prototype, ViewStateBase.prototype, FlatOvalOutline.prototype, FocusOvalOutline.prototype, {
    init: function() {
        FocusOvalOutline.prototype.init.call(this);

        var config = {
            heightProportion: 1.0
        }
        var clusterConfig = {
            radiusScaleFactor: 0.75,
            spaceFactor: 1.28
        };
        var nodeAppearance = {};
        var position = {};

        this.merge(config, clusterConfig, nodeAppearance, position);
    }
});

function FocusCircleCluster(controller) {
    FocusCircleOutline.call(this, controller);
    this.name = 'FocusCircleCluster';
}
_.extend(FocusCircleCluster.prototype, ViewStateBase.prototype, FlatOvalOutline.prototype, FocusOvalOutline.prototype, FocusCircleOutline.prototype, {
    init: function() {
        FocusCircleOutline.prototype.init.call(this);

        var config = {
            linesEnabled: false
        }
        var clusterConfig = {
            scaleFactor: 0.6,
            spaceFactor: 0.7,
            radiusScaleFactor: 0.9,
            childAngleArc: 210,
            forceNodeColor: true
        };
        var nodeAppearance = {};
        var position = {};

        this.merge(config, clusterConfig, nodeAppearance, position);
    }
});

function FocusCircleClusterColored(controller) {
    FocusCircleCluster.call(this, controller);
    this.name = 'FocusCircleClusterColored';
}
_.extend(FocusCircleClusterColored.prototype, ViewStateBase.prototype, FlatOvalOutline.prototype, FocusOvalOutline.prototype, FocusCircleOutline.prototype, FocusCircleCluster.prototype, {
    init: function() {
        FocusCircleCluster.prototype.init.call(this);

        var config = {
            linesEnabled: false
        }
        var clusterConfig = {
            radiusScaleFactor: 0.9,
            fadeFactor: 0
        };
        var nodeAppearance = {
            getColor: this.controller.base.globalCluster.cluster.defaultNodeAppearance.getColor,
            applyCSS: function($el) {
                $el.css({
                    'border': '3px solid black'
                });
            }
        };
        var position = {};

        this.merge(config, clusterConfig, nodeAppearance, position);
    }
});
// (Math.random() * 0.01) + 0.01,

function FocusCircleClusterColoredHQ(controller) {
    FocusCircleClusterColored.call(this, controller);
    this.name = 'FocusCircleClusterColoredHQ';
}
_.extend(FocusCircleClusterColoredHQ.prototype, ViewStateBase.prototype, FlatOvalOutline.prototype, FocusOvalOutline.prototype, FocusCircleOutline.prototype, FocusCircleCluster.prototype, FocusCircleClusterColored.prototype, {
    init: function() {
        FocusCircleClusterColored.prototype.init.call(this);

        var config = {
            linesEnabled: false
        }
        var clusterConfig = {
            visualQuality: 1
        };
        var nodeAppearance = {
            applyCSS: function($el) {
                $el.css({
                    'border': 'none'
                });
            }
        };
        var position = {};
        this.merge(config, clusterConfig, nodeAppearance, position);
    }
});

function FocusCircleClusterColoredHQExtras(controller) {
    FocusCircleClusterColoredHQ.call(this, controller);
    this.name = 'FocusCircleClusterColoredHQExtras';
}
_.extend(FocusCircleClusterColoredHQExtras.prototype, ViewStateBase.prototype, FlatOvalOutline.prototype, FocusOvalOutline.prototype, FocusCircleOutline.prototype, FocusCircleCluster.prototype, FocusCircleClusterColored.prototype, FocusCircleClusterColoredHQ.prototype, {
    init: function() {
        FocusCircleClusterColoredHQ.prototype.init.call(this);

        var config = {
            creatorEnabled: true,
            destroyerEnabled: true,
            scoreListEnabled: false
        }
        var clusterConfig = {
            visualQuality: 1
        };
        var nodeAppearance = {
            applyCSS: function($el) {
                $el.css({
                    'border': 'none'
                });
            }
        };
        var position = {
            y: this.controller.$container.height() / 2,
            x: (this.controller.$container.width() / 2)
        }
        this.merge(config, clusterConfig, nodeAppearance, position);
    }
});

window.BENOME = BenomeEntry;

}(window, document));

});