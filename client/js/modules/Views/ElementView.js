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
    _ = require('underscore');
    //animate = require('app/lib/velocity')($);

Backbone.$ = $;

// -------------

var ElementView = Backbone.View.extend({
    tagName: 'div',
    className: 'element-view',

    events: {
    },

    initialize: function(options) {
        options = options || {};
        
        this.viewID = options.viewID;
        this.animationsEnabled = options.animationsEnabled;

        _.bindAll(this, 'hide');

        this.zIndex = null;
        this.visible = false;
        this.hide();

        this.$el.data('viewID', this.viewID);
    },

    setVisible: function() {
        this.visible = true;
    },

    setInvisible: function() {
        this.visible = false;
    },

    getDetails: function() {
        return {};
    },

    getPosition: function() {
        return {
            x: this.x,
            y: this.y
        }
    },

    getInitialPosition: function() {
        return {
            x: this.initialX,
            y: this.initialY
        }
    },

    setPosition: function(x, y, wait, force, iX, iY) {
        if (!force && x == this.x && y == this.y) {
            return;
        }

        this.x = x;
        this.y = y;

        this.initialX = null;
        this.initialY = null;

        if (_.isNumber(iX) && _.isNumber(iY) &&
            !_.isNaN(iX) && !_.isNaN(iY)) {
            this.initialX = iX;
            this.initialY = iY;
        }

        var position = this.getPosition();

        var animateCss = {
                top: position.y + 'px',
                left: position.x + 'px'
            },
            css = {};

        this.applyCSS(wait, css, animateCss);
    },

    setSize: function(width, height, wait, iW, iH) {
        if (_.isBoolean(height)) {
            wait = height;
            height = width;
        }

        this.width = width;
        this.height = height;

        this.initialWidth = null;
        this.initialHeight = null;

        if (_.isNumber(iW) && _.isNumber(iH) &&
            !_.isNaN(iW) && !_.isNaN(iH)) {
            this.initialWidth = iW;
            this.initialHeight = iH;
        }

        var animateCss = {
                width: width + 'px',
                height: height + 'px'
            },
            css = {};

        this.applyCSS(wait, css, animateCss);
    },

    setFontSize: function(fontSize, unit, wait) {
        unit = unit || this.fontUnit || 'em';

        this.fontUnit = unit;
        this.fontSize = fontSize;

        var animateCss = {
                'font-size': fontSize + unit
            },
            css = {};

        this.applyCSS(wait, css, animateCss);
    },

    setOpacity: function(opacity, wait) {
        this.opacity = opacity;

        var animateCss = {
                'opacity': opacity
            },
            css = {};

        this.applyCSS(wait, css, animateCss);
    },

    setZIndex: function(zIndex) {
        if (this.zIndex == zIndex) {
            return;
        }

        this.zIndex = zIndex;

        this.$el.css({
            'z-index': zIndex
        });
    },

    applyCSS: function(wait, css, animateCss) {
        if (!wait) {
            this.$el.css(_.extend({}, css, animateCss));
        }
        else {
            this.p = this.p || {};
            _.extend(this.p, animateCss);

            this.p2 = this.p2 || {};
            _.extend(this.p2, css);
        }
    },

    exec: function(noAnimate, animateDuration, hideAfter) {
        noAnimate = noAnimate || this.animationsEnabled;
        animateDuration = animateDuration || null;

        this.show();

        if (this.p2) {
            this.$el.css(this.p2);
        }

        if (this.p) {
            if (!noAnimate) {
                var initialPosition = this.getInitialPosition(),
                    initialWidth = this.initialWidth,
                    initialHeight = this.initialHeight,
                    initialCSS = {};

                if (_.isNumber(initialPosition.x) && _.isNumber(initialPosition.y) &&
                    !_.isNaN(initialPosition.x) && !_.isNaN(initialPosition.y)) {
                    initialCSS.left = initialPosition.x + 'px';
                    initialCSS.top = initialPosition.y + 'px';
                }

                if (_.isNumber(initialWidth) && _.isNumber(initialHeight) &&
                    !_.isNaN(initialWidth) && !_.isNaN(initialHeight)) {
                    initialCSS.width = initialWidth + 'px';
                    initialCSS.height = initialHeight + 'px';
                }

                if (_.values(initialCSS).length) {
                    /*console.log(initialCSS);
                    this.$el.css(initialCSS);*/

                    this.initialWidth = null;
                    this.initialHeight = null;
                    this.initialX = null;
                    this.initialY = null;
                }

                var postFunc = hideAfter ? this.hide : null;
                this.$el.animate(this.p, {duration: animateDuration, easing: 'linear', complete: postFunc});
            }
            else {
                this.$el.css(this.p);
            }
        }

        this.p = null;
        this.p2 = null;
    },

    show: function() {
        this.setVisible();
        this.$el
            .css({
                opacity: 1.0
            })
            .show();
    },

    hide: function(options) {
        options = options || {};
        this.setInvisible();

        if (options.hideDuration) {
            var _this = this,
                originalOpacity = this.$el.css('opacity');

            this.$el
                .animate({
                    opacity: 0
                }, {
                    duration: options.hideDuration,
                    complete: function() {
                        $(this)
                            .css({
                                'opacity': originalOpacity
                            })
                            .hide();
                    }
                });
        }
        else {
            this.$el.hide();
        }
    },

    calcFontSize: function($el, text, scale) {
        var baselineChars = 30,
            maxChars = 60,
            text = text || $el.text(),
            scale = scale || 1.1,
            fitChars = Math.min(maxChars, Math.max(baselineChars, text.length)),
            fontSize = Math.sqrt(($el.width() * $el.height()) / fitChars) * scale;

        return fontSize;
    }
});

module.exports = ElementView;