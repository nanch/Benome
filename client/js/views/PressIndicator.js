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
    _ = require('underscore'),
    Hammer = require('hammerjs');
Backbone.$ = $;

// -------------

var PressIndicator = Backbone.View.extend({
    className: 'press-indicator-view',

    events: {
    },

    initialize: function(options) {
        options = options || {};
        this.G = this.G || options.G || require('app/Global')();
        _.bindAll(this, 'cancelPressIndicator', 'updatePressIndicator', 'hidePressIndicator', 
                        'showPressIndicator');

        var G = this.G
        G.on('ViewPressUpdate', this.updatePressIndicator);
        G.on('ViewPressHide', this.hidePressIndicator);
        G.on('ViewPressShow', this.showPressIndicator);

        this.$pressIndicator = $('<div></div>')
                                    .addClass('press-indicator')
                                    .click(this.cancelPressIndicator)
                                    .appendTo(G.$el);
    },

    cancelPressIndicator: function() {
        this.hidePressIndicator();
        if (this.pressIndicatorSrcView) {
            this.pressIndicatorSrcView.trigger('PressIndicatorCancelled');
        }
    },

    hidePressIndicator: function($refEl) {
        this.$pressIndicator.hide();
        this.indicatorActive = false;
    },

    showPressIndicator: function($refEl, srcView) {
        if (this.indicatorActive) {
            return;
        }
        this.indicatorActive = true;

        this.G.centerOn($refEl, this.$pressIndicator);
        this.pressIndicatorState = 0;
        this.pressIndicatorSrcView = srcView;

        var amt = 4;

        this.$pressIndicator
            .css({
                /*'box-shadow': '0px 0px ' + amt + 'em ' + amt + 'em #779'*/
                opacity: 0
            })
            .show();
    },

    updatePressIndicator: function(distance, deltaX, deltaY) {
        if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) > 20) {
            this.cancelPressIndicator();
            return;
        }

        distance = Math.min(1.0, Math.max(0, distance))
        this.pressIndicatorState = distance;

        //var amt = 4 * (1 - distance)
        this.$pressIndicator
            .css({
                /*'box-shadow': '0px 0px ' + amt + 'em 4em #779'*/
                opacity: distance
            });
    }
});

module.exports = PressIndicator;