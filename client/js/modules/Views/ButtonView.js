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
    _ = require('underscore'),
    Backbone = require('backbone');

// -------------

var cssRadialGradient = require('app/modules/Util/CSSRadialGradient');

var ButtonView = Backbone.View.extend({
    tagName: 'div',
    className: 'button-view',

    events: {
        'click': 'addPoint'
    },

    initialize: function(options) {
        options = options || {};
        _.bindAll(this, 'addPoint');

        this.$el.addClass(this.className);

        this.$container = options.$container;
        this.label = options.label;
        this.color = options.color;

        this.isMobile = ('ontouchstart' in document.documentElement);
        if ('webkitAnimation' in document.body.style) {
            this.cssPrefix = '-webkit-';
        }
        else if ('MozAnimation' in document.body.style) {
            this.cssPrefix = '-moz-';
        }

        this.$label = $('<div>')
                            .addClass('label')
                            .appendTo(this.$el);

        var _this = this;
        if (this.isMobile) {
            this.$el
                .on('touchstart', function() { $(this).addClass('touchactive') })
                .on('touchend', function() { $(this).removeClass('touchactive') });
        }
        else {
            this.$el
                .on('mousedown', function() {
                    $(this).addClass('touchactive');
                    _this.renderInsetColor();
                })
                .on('mouseup', function() {
                    $(this).removeClass('touchactive');
                    _this.renderColor();
                });
        }
    },

    render: function(options) {
        // Set color etc

        var size = this.getSize();
        this.$el.css({
            'font-size': (((size.h + size.w) / 2) * 0.15) + 'px'
        });

        if (this.label) {
            this.setLabel(this.label);
        }
        this.renderColor();
        return this;
    },

    renderColor: function(baseColor) {
        baseColor = baseColor || this.color;

        var c = $.Color(baseColor),
            darkColor = $.Color()
                                .lightness(c.lightness() * 0.7)
                                .saturation(c.saturation() * 1.3)
                                .hue(c.hue());

/*                        highlightColor = $.Color()
                                .lightness(c.lightness() * 1.35)
                                .saturation(c.saturation())
                                .hue(c.hue()),
*/

        this.applyColor(c, darkColor);
    },

    renderInsetColor: function(baseColor) {
        baseColor = baseColor || this.color;

        var c = $.Color(baseColor),
            darkColor0 = $.Color()
                                .lightness(c.lightness() * 0.92)
                                .saturation(c.saturation() * 1.0)
                                .hue(c.hue()),
            darkColor2 = $.Color()
                                .lightness(c.lightness() * 0.6)
                                .saturation(c.saturation() * 1.6)
                                .hue(c.hue());

        this.applyColor(darkColor0, darkColor2);
    },

    applyColor: function(c1, c2, pos) {
        var first = c1.toRgbaString(),
            second = c2.toRgbaString(),
            pos = pos || 0.775;

        this.$el.css({
            'background': cssRadialGradient([first, second], [0, pos, 1.0], first)
        });
    },

    getSize: function() {
        return {
            w: this.$el.width(),
            h: this.$el.height(),
        }
    },

    setLabel: function(label) {
        this.$label.text(label);
    },

    addPoint: function() {
        var pointTime = Date.now();
        this.trigger('PointAdded', pointTime)
    },

    triggerGroupEffect: function(activityID, updateID) {
        // Figure out a color
        var color = $.Color(this.utils.getColor(activityID)),
            buttonColor = $.Color(this.$el.css('background-color')),
            _this = this;

        _.each(_.range(0, 11), function(i) {
            _.delay(function() {
                if (updateID == _this.lastUpdateID) {
                    _this.$container.css({
                        'background-color': buttonColor.transition(color, i / 10).toHexString()
                    });
                }
            }, i * 50)
        });
    },

    removeGroupEffect: function(updateID) {
        var buttonColor = $.Color(this.$el.css('background-color')),
            targetBackgroundColor = $.Color('#000'),
            targetButtonColor = $.Color('#444'),
            _this = this;

        _.each(_.range(0, 11), function(i) {
            _.delay(function() {
                if (updateID == _this.lastUpdateID) {
                    _this.$container.css({
                        'background-color': buttonColor.transition(targetButtonColor, i / 10).toHexString()
                    });
                }
            }, i * 50)
        });   
    }
});
_.extend(ButtonView.prototype, Backbone.Events);

module.exports = ButtonView;