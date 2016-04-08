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
    Backbone = require('backbone'),
    _ = require('backbone/node_modules/underscore');

Backbone.$ = $;

var SimpleWaveView = require('app/views/SimpleWaveView');


var StreamGraphView = Backbone.View.extend({
    tagName: 'div',
    className: 'viz',

    events: {
        'click': 'sendBack'
    },

    initialize: function(options) {
        options = options || {};

        _.bindAll(this, 'loadCallback');

        this.SourceData = [];

        this.baseUrl = options.baseUrl || '/viz/data_feedback/';
        this.includeColorKey = options.includeColorKey === false ? false : true;
        this.numSegments = options.numSegments || 80;
        this.maxDisplayDepth = options.maxDisplayDepth || 0;
        this.clearAfterLoad = !!options.clearAfterLoad;
        this.defaultWindowSize = options.defaultWindowSize || 86400 * 7;

        this.$colorKey = $('<div>').addClass('color-key').appendTo(this.$el);
        this.$score = $('<div>').addClass('score').appendTo(this.$el);

        this.$changeWindow = $('<div>').addClass('window-size-container').appendTo(this.$el);
        var windows = {
            'Day': 86400,
            'Week': 86400 * 7,
            'Month': 86400 * 30.5,
            '2 Months': 86400 * 61,
            '3 Months': 86400 * 91.5,
        }
        _.each(windows, function(windowSize, name) {
            var _this = this;
            var $c = $('<div>')
                            .addClass('window-size')
                            .text(name)
                            .click(function() {
                                _this.render({
                                    'window': windowSize,
                                    'keepContextID': true
                                });
                                return false;
                            });
            this.$changeWindow.append($c);
        }, this);

        if (!options.noDepth) {
            this.$changeDepth = $('<div>').addClass('graph-depth-container').appendTo(this.$el);
            var depths = [1,2,3];
            _.each(depths, function(depth) {
                var _this = this;
                var $c = $('<div>')
                                .addClass('graph-depth')
                                .text(depth)
                                .click(function() {
                                    _this.render({
                                        'maxDisplayDepth': depth,
                                        'keepContextID': true
                                    });
                                    return false;
                                });
                this.$changeDepth.append($c);
            }, this);
        }
    },

    paramsChanged: function(contextID, maxDisplayDepth, w) {
        return this.lastContextID != contextID || this.lastMaxDisplayDepth != maxDisplayDepth || this.lastWindow != w;
    },

    render: function(options) {
        options = options || {};

        var contextID = options.contextID || this.B.getActiveContextID(),
            targetDisplayDepth = options.maxDisplayDepth || this.prevMaxDisplayDepth || 1;

        if (!contextID) {
            return;
        }

        this.prevMaxDisplayDepth = targetDisplayDepth;

        if (options.keepContextID && this.lastContextID) {
            contextID = this.lastContextID;
        }

        this.baseDepth = this.B.getContextDepth(contextID);    
        this.maxDisplayDepth = targetDisplayDepth + this.baseDepth;
        this.window = options.window || this.window || this.defaultWindowSize;

        if (!options.force && !this.paramsChanged(contextID, this.maxDisplayDepth, this.window)) {
            return;
        }

        this.lastContextID = contextID;
        this.lastMaxDisplayDepth = this.maxDisplayDepth;
        this.lastWindow = this.window;

        var _this = this,
            data = {
                'Window': this.window,
                'NumSegments': options.numSegments || null
            };

        this.$colorKey.empty();
        this.$score.text('');
        this.clearGraph();

        this.B.jsonGet(this.baseUrl + contextID + '?callback=?', data, this.loadCallback);
        return this;
    },

    clearGraph: function() {
        if (!this.vizGraph) {
            return;
        }

        this.vizGraph.clear();
    },

    loadCallback: function(response, textStatus, jqXHR) {
        if (!response || !response.Success) {
            return;
        }
        if (!response.Data || !response.Data.Contexts) {
            return;
        }
        var data = response.Data,
            contexts = data.Contexts,
            points = [];

        _.each(contexts, function(context, contextID) {
            points = points.concat(context.Points);
        })
        this.SourceData = points;
        
        this.contextWeights = {};

        this.CurrentScore = data.CurrentScore;
        this.MaxScore = data.MaxScore || this.MaxScore;

        this.TargetInterval = data.TargetInterval || this.TargetInterval;
        this.CurrentInterval = data.CurrentInterval || this.CurrentInterval;

        if (data.NumSegments) {
            this.numSegments = data.NumSegments;
        }

        // Create model for each context. Leak here.
        this.contextIDs = [];
        this.contextColors = {};
        this.contextScores = {};

        _.each(contexts, function(contextDetails, origContextID) {
            var contextID = origContextID;

            if (this.maxDisplayDepth) {
                contextID = this.B.toDepth(origContextID, this.maxDisplayDepth)
            }
            this.contextIDs.push(contextID);

            if (this.includeColorKey) {
                this.contextScores[contextID] = this.contextScores[contextID] || {
                    'TotalScore': 0,
                    'MaxScore': 0
                };

                this.contextScores[contextID].TotalScore += contexts[origContextID].CurrentScore
                this.contextScores[contextID].MaxScore += contexts[origContextID].MaxScore;
            }

            if (this.contextWeights) {
                this.contextWeights[contextID] = contexts[origContextID].Weight;
            }

            this.contextColors[contextID] = this.getColor(contextID);
        }, this);

        this.contextIDs = _.sortBy(_.uniq(this.contextIDs), function(contextID) {
            if (this.lastMaxDisplayDepth == 1) {
                return -this.contextWeights[contextID];
            }
            else {
                return this.B.getBaseContext(contextID);
            }
        });

        this.initCurve();
        this._render();
    },

    currentSize: function() {
        return {
            width: this.$el.width(),
            height: this.$el.height()
        }
    },

    initCurve: function() {
        var customContextSplit = null;
        if (this.maxDisplayDepth) {
            customContextSplit = function(maxDisplayDepth) {
                return function(contexts) {
                    return _.uniq(_.map(contexts, function(contextID) {
                        return this.B.toDepth(contextID, maxDisplayDepth);
                    }));
                }
            }(this.maxDisplayDepth);
        }

        var pointWindow = this.window * 1000,
            anchorTime = new Date().getTime(),
            beginDate = anchorTime,
            endDate = beginDate - pointWindow;

        if (this.vizGraph) {
            this.vizGraph.beginDate = beginDate;
            this.vizGraph.endDate = endDate;
            this.vizGraph.data = this.SourceData;
            this.vizGraph.numSegments = this.numSegments;
            this.vizGraph.customContextSplit = customContextSplit;
        }
        else {
            this.vizGraph = new SimpleWaveView({
                el: this.$el,
                customContextSplit: customContextSplit,
                waveColor: $.Color('#444'),
                widthFraction: 1.0,
                leftFraction: 0,
                numSegments: this.numSegments,

                beginDate: beginDate,
                endDate: endDate,
                data: this.SourceData
            });
        }
    },

    getColor: function(contextID) {
        return this.B.getColor(contextID);
    },

    _render: function(options) {
        options = options || {};

        if (!this.vizGraph) {
            return;
        }

        this.vizGraph.maxDensity = this.MaxScore;

        if (this.MaxScore) {
            var currentScore = this.CurrentScore || 0;
            this.$score.text(Math.round(100 * currentScore / this.MaxScore) + '%');
        }
        var _this = this;

        if (this.includeColorKey) {
            this.renderColorKey();
        }

        this.vizGraph.render({
            contexts: this.contextIDs,
            numSegments: this.numSegments,
            contextColors: this.contextColors
        });

        this.trigger('render');
    },

    renderColorKey: function() {
        var _this = this;
        _.chain(this.contextColors)
            .map(function(v, k) {
                    return [k, v];
                })
            .sortBy(function(a) {
                    if (_this.lastMaxDisplayDepth == 1) {
                        return -_this.contextWeights[a[0]];
                    }
                    else {
                        return this.B.getBaseContext(a[0]);
                    }
                })
            .each(function(a) {
                    var contextID = a[0],
                        color = a[1],
                        contextModel = this.B.globalCollectionl.get(contextID);
                    
                    if (!contextModel) {
                        return;
                    }
                    var score = this.contextScores[contextID].TotalScore / this.contextScores[contextID].MaxScore,
                        contextName = contextModel.get('label');

                    $('<div>')
                        .addClass('context-color')
                        .text(contextName)
                        .css({
                            'background-color': color
                            //'border-bottom': this.B.computeBorderScore(score, 3, 8, '#444')
                        })
                        .click(function() {
                            this.B.showStreamGraph(contextID, _this.window, _this.lastMaxDisplayDepth);
                            return false;
                        })
                        .appendTo(this.$colorKey);
                }, this);
    },

    show: function() {
        this.$el.show();
    },

    hide: function() {
        this.$el.hide();
    }
});

module.exports = StreamGraphView;