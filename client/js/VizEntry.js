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
    _ = require('backbone/node_modules/underscore');
window.$ = window.jQuery = $;

// App
var BenomeView = require('app/Benome');

// -------------

$(function() {

if (window.BENOME_MANUAL_ENTRY) {
    return;
}

(function(window, document) {
var VizEntry = function() {
};

_.extend(VizEntry.prototype, {
    isMobile: ('ontouchstart' in document.documentElement),
    isAndroid: (/android/i.test(navigator.userAgent)),
    isApple: (/iphone|ipod|ipad/i.test(navigator.userAgent)),
    isMac: (/Macintosh/.test(navigator.userAgent)),
    isTablet: (/ipad/i.test(navigator.userAgent) || ((/android/i.test(navigator.userAgent)) && !(/mobile/i.test(navigator.userAgent)))),

    init: function(options) {
        options = options || {};
        this.defaultMaxDepth = null;

        var showLabels = this.QueryString.p !== '1',
            labelIDsOnly = this.QueryString.i === '1',
            autoActionDelay = parseInt(this.QueryString.aa) || null;

        var defaultFilter = 0;
        if (parseInt(this.QueryString.d) >= 1) {
            defaultFilter = Math.min(10, parseInt(this.QueryString.d)) - 1;
        }

        var $container = $('body'),
            rootClusterOptions = {
                hideRoot: false,
                layoutChange: true,
                hideLabels: !showLabels,
                labelIDsOnly: labelIDsOnly,

                radiusScaleFactor: 0.3,
                scaleFactor: 0.75,
                spaceFactor: 0.8,
                focusAngleArc: 360,
                focusStartAngle: 30,
                childAngleArc: 180,
                fadeFactor: 0.1,
                maxDepth: 8,
                numDetailLevels: 6,
                hideSmallText: false,
                noCompress: true,
                position: function(globalSize) {
                    return {
                        x: globalSize.width / 2,
                        y: globalSize.height / 2
                    }
                },
                labelFunc: function(distance) {
                    return distance <= 2;
                }
            }

        var options = {
            container: $container,
            defaultFilter: defaultFilter,
            autoActionDelay: autoActionDelay,
            rootClusterOptions: rootClusterOptions
        }
        
        var instanceID = 'ABCDEF';
        var benomeBase = new BenomeView(_.extend(options, {instanceID: instanceID}));
        benomeBase.$el.attr('id', instanceID);
        $container.append(benomeBase.$el);
        // Various data sources and scenarios
        this.base = benomeBase;
        window.E = this;

        benomeBase.featureState.LeafFocusToggleTimer = false;
        benomeBase.featureState.LeafFocusAutoAdd = false;

        benomeBase.initCollections('rI');
        benomeBase.loadFinished();

        this.loadDayData = _.bind(this.loadDayData, this)
        this.renderDays = _.bind(this.renderDays, this)

        window.LDD = this.loadDayData;

        var _this = this;

        this.$dayNumber = $('<div>')
                            .addClass('day-number')
                            .appendTo($('body'));

        this.base.creatorView.$el.hide();
        _.delay(_this.loadDayData, 1000, 0, true);
    },

    renderDays: function() {
        var delay = 1000;

        _.each(_.range(0, window.AllData.length), function(i) {
            _.delay(this.loadDayData, i * delay, i);
        }, this);
    },

    loadDayData: function(dayIdx, iterate) {
        var beginRender = Date.now();
        $('.simple-view').removeClass('highlight');

        this.base.colorCache = {};

        var data = window.AllData[dayIdx];
        if (!data) {
            return;
        }

        this.$dayNumber.text('Day ' + (14 + (dayIdx + 1)));

        var benome = this.base,
            cluster = benome.getCluster('Root');

        /*if (dayIdx == 25 || dayIdx == 75 || dayIdx == 125 || dayIdx == 180 || dayIdx == 230) {
            cluster.setFocus('rI');  // root
        }

        if (dayIdx == 20) {
            cluster.setFocus('mM');  // Household
        }

        if (dayIdx == 70) {
            cluster.setFocus('mZ');  // Eat food
        }

        if (dayIdx == 120) {
            cluster.setFocus('ot');  // Buy food
        }

        if (dayIdx == 175) {
            cluster.setFocus('1zR');  // Personal
        }
            
        if (dayIdx == 225) {
            cluster.setFocus('mz');  // Activities
        }*/

        if (data.Structure) {
            var assoc = [];
            var contexts = _.map(data.Structure, function(c) {
                // Extract associations
                _.each(c.d, function(downID) {
                    assoc.push({
                        'SourceID': c.i,
                        'Name': 'down',
                        'DestID': downID
                    });
                });

                _.each(c.u, function(upID) {
                    assoc.push({
                        'SourceID': c.i,
                        'Name': 'up',
                        'DestID': upID
                    });
                });

                // Properly format each Context
                return {
                    label: c.l,
                    timeStamp: c.t,
                    sid: c.i
                }
            });

            var points = data.Points;

            // Re-populate the structures
            benome.globalCollection.reset(contexts, {silent: true});
            benome.globalAssociations.reset(assoc, {silent: true});
            benome.globalPoints.reset(points, {silent: true});

            var rootCollection = benome.globalCollection.collectionFromRoot('rI');
            cluster.initCollection(rootCollection);
            cluster.render();
        }

        var endRender = Date.now();

        if (data.Points) {
            _.each(data.Points, function(p) {
                var contextID = p.upAssociations[0];
                if (benome.globalCollection.get(contextID)) {
                    var view = cluster.getView(contextID);
                    if (view) {
                        view.$el.addClass('highlight');
                    }
                }
            });
        }

        var renderTime = endRender - beginRender;
        if (iterate) {
            _.delay(this.loadDayData, 1000 - renderTime, dayIdx + 1, true);
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

var vizEntry = new VizEntry();
vizEntry.init();

}(window, document));

});
