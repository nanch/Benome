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
    _ = require('backbone/node_modules/underscore'),
    Backbone = require('backbone');

var ButtonTimelineView = require('app/modules/Views/ButtonTimelineView'),
    getColor = require('app/modules/Util/GetColor2');

// -------------

var MultiButtonTimeline = Backbone.View.extend({
    tagName: 'div',
    className: 'multibutton-timeline-view',

    events: {
    },

    initialize: function(options) {
        options = options || {};
        _.bindAll(this, 'render');

        this.$el.addClass(this.className);

        this.buttonActionDefs = options.buttonDefs;
        this.probabilityLabel = options.probabilityLabel || '';
        this.interval = options.interval || 10;
        this.buttonActions = [];

        this.timelineHeight = options.timelineHeight || 0.5;
        this.minIntervals = options.minIntervals || 1;
        this.maxIntervals = options.maxIntervals || 5;
        this.stddevFactor = options.stddevFactor || 2;
        this.showWave = !!options.showWave;
    },

    render: function(options) {
        var $container = this.$el,
            containerWidth = $container.width(),
            containerHeight = $container.height(),
            buttonActionWidth = containerWidth / 2.7,
            buttonActionHeight = buttonActionWidth / 2;

        _.each(this.buttonActionDefs, function(buttonActionDef, i) {
            var buttonTimelineView = this.buttonActions[i],
                xPos = buttonActionDef.x,
                yPos = buttonActionDef.y,
                leftPos = (containerWidth * xPos) - (buttonActionWidth / 2),
                topPos = (containerHeight * yPos) - (buttonActionHeight / 2);

            var sizePos = {
                width: buttonActionWidth + 'px',
                height: buttonActionHeight + 'px',
                left: leftPos + 'px',
                top: topPos + 'px'  
            }

            if (!buttonTimelineView) {
                // Initialize
                var $el = $('<div>')
                            .attr('id', 'button-action-' + i)
                            .css(sizePos)
                            .appendTo($container);

                buttonTimelineView = new ButtonTimelineView({
                    el: $el,
                    color: getColor(i),
                    showWave: this.showWave,
                    intervalWidth: this.interval,
                    label: buttonActionDef.label,
                    probabilityLabel: this.probabilityLabel,
                    minIntervals: this.minIntervals,
                    maxIntervals: this.maxIntervals,
                    stddevFactor: this.stddevFactor,
                    timelineHeight: this.timelineHeight
                });

                this.buttonActions[i] = buttonTimelineView;
            }
            else {
                buttonTimelineView.$el.css(sizePos);
            }

            buttonTimelineView.render();
        }, this);

        return this;
    }
});
_.extend(MultiButtonTimeline.prototype, Backbone.Events);

module.exports = MultiButtonTimeline;