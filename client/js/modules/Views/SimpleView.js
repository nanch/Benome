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
    Backbone = require('backbone'),
    _ = require('backbone/node_modules/underscore'),
    Hammer = require('hammerjs');

var ElementView = require('app/modules/Views/ElementView'),
    ConcentricCircle = require('app/modules/Util/ConcentricCircle'),
    getContrastColor = require('app/modules/Util/GetContrastColor');

// -------------

var alpha = 0.8,
    red = $.Color('red').alpha(alpha).toRgbaString(),
    orange = $.Color('#ffa500').alpha(alpha).toRgbaString(),
    green = $.Color('green').alpha(alpha).toRgbaString(),
    grey = $.Color('grey').alpha(alpha).toRgbaString();

var SimpleView = ElementView.extend({
    tagName: 'div',
    className: 'simple-view',

    events: {
        //'click': ''
    },

    heightProportion: 1,

    initialize: function(options) {
        options = options || {};
        ElementView.prototype.initialize.call(this, options);

        options = _.extend({
            color: '#888',
            borderEnabled: true
        }, options);

        _.bindAll(this, 'onTap', 'render');
        if (!options.dragDisabled) {
            this.el.setAttribute('BDragSource', '1');
        }

        if (!options.dropDisabled) {
            this.el.setAttribute('BDropTarget', '1');
        }
        this.$el.data('ViewRef', this);

        if ('webkitAnimation' in document.body.style) {
            this.cssPrefix = '-webkit-';
        }
        else if ('MozAnimation' in document.body.style) {
            this.cssPrefix = '-moz-';
        }

        this.heightProportion = options.heightProportion || this.heightProportion;

        this.color = options.color;
        this.visualQuality = options.visualQuality || 0;
        this.isRoot = options.isRoot;
        this.isGlobalRoot = options.isGlobalRoot;
        this.hideLabel = options.hideLabel || false;
        this.borderEnabled = options.borderEnabled || false;
        this.labelIDOnly = options.labelIDOnly || false;
        this.tapThreshold = options.tapThreshold || 8;
        this.darkText = options.darkText || '#333';
        this.lightText = options.lightText || '#bbb';

        this.cluster = options.cluster;
        this.clusterID = options.clusterID;

        var mc = new Hammer(this.$el.get()[0], {}),
            singleTap = new Hammer.Tap({ threshold: this.tapThreshold});

        mc.add(singleTap);
        mc.on('tap', this.onTap);

        this.rendered = false;
        this.surfaceViews = {};
    },

    addSurfaceView: function(viewID, view, force) {
        if (viewID in this.surfaceViews && !force) {
            return;
        }

        this.surfaceViews[viewID] = view;
    },

    setActiveSurfaceView: function(viewID, options, renderOptions) {
        options = options || {};
        var view = this.surfaceViews[viewID];
        if (!view) {
            return;
        }

        renderOptions = renderOptions || {};

        if (this.surfaceView !== view) {
            this.surfaceView = view;
            this.$el.empty();
            this.surfaceView.$el.appendTo(this.$el);
        }

        if (options.render !== false) {
            this.surfaceView.render(renderOptions);
        }
    },

    getDetails: function() {
        return this.cluster.contexts.get(this.viewID);
    },

    dragHandler: function(dragView, dragDetails) {
        return {
            '$dragProxyEl': dragView.$el,
            'proxyClass': 'drag-proxy-creator',
            'clusterID': this.clusterID
        }
    },

    onTap: function(e) {
        this.pressActive = false;

        var $target = $(e.target);
        if ($target.hasClass('simple-view') || $target.hasClass('focus-container') || $target.hasClass('simple-surface-view')) {

            // If not already the focus, display visual feedback when tapped/clicked
            if (this.cluster.focusID != this.viewID) {
                $target.addClass('new-focus-feedback');
                var t = Date.now();

                _.delay(function() {
                    $target.removeClass('new-focus-feedback');
                }, 250);
            }

            _.delay(_.bind(function() {
                this.cluster.trigger('ActivityClicked', e, this);
            }, this), 150);

            return false;
        }
    },

    getPosition: function() {
        return {
            x: this.x - this.radius,
            y: this.y - (this.radius * SimpleView.prototype.heightProportion)
        }
    },

    setSize: function(radius, wait, initialRadius, force) {
        if (!force && radius == this.radius && SimpleView.prototype.heightProportion == this.lastHeightProportion) {
            return;
        }

        this.radius = radius;
        this.initialRadius = initialRadius;
        this.lastHeightProportion = SimpleView.prototype.heightProportion;

        var width = radius * 2,
            height = width * SimpleView.prototype.heightProportion;

        if (width != height) {
            // Display as an ellipse
            this.$el.css({
                'border-radius': (width / 2) + 'px /' + (height / 2) + 'px'
            });
        }
        else {
            // Prevent square-ish appearance during animation
            this.$el.css({
                'border-radius': width + 'px'
            });
        }
        ElementView.prototype.setSize.call(this, width, height, wait, initialRadius * 2, initialRadius * 2);
    },

    setColor: function(color) {
        this.color = color || this.cluster.getColor(this.viewID, true);
        return this.color;
    },

    getColor: function(recalc) {
        return this.color || this.cluster.getColor(this.viewID);
    },

    setVisualQuality: function(visualQuality) {
        this.lastVisualQuality = this.visualQuality;
        this.visualQuality = visualQuality;
    },

    setColorTransition: function(colorTransition) {
        this.lastColorTransition = this.colorTransition;
        this.colorTransition = colorTransition;
    },

    render: function(options) {
        options = options || {};

        if (options.colorTransition) {
            this.setColorTransition(options.colorTransition);
        }

        this.renderColor(options.color, options.forceColor);
        this.rendered = true;

        if (this.surfaceView && options.renderSurface !== false) {
            this.surfaceView.render(options.surfaceRenderOptions);
        }

        return this;
    },

    renderColor: function(baseColor, force) {
        baseColor = baseColor || this.getColor();

        if (!force && baseColor == this.lastBaseColor && this.lastVisualQuality == this.visualQuality) {
            return;
        }
        this.lastBaseColor = baseColor;
        this.lastVisualQuality = this.visualQuality;

        var c = $.Color(baseColor);
        if (this.colorTransition) {
            c = c.transition(this.colorTransition.target, this.colorTransition.distance);
        }

        var highlightColor = $.Color()
                                .lightness(c.lightness() * 1.35)
                                .saturation(c.saturation())
                                .hue(c.hue());

        var darkColor = $.Color()
                                .lightness(c.lightness() * 0.7)
                                .saturation(c.saturation() * 1.3)
                                .hue(c.hue());

        var darkColor2 = $.Color()
                                .lightness(c.lightness() * 0.6)
                                .saturation(c.saturation() * 1.6)
                                .hue(c.hue());

        var darkColor3 = $.Color()
                                .lightness(c.lightness() * 0.1)
                                .saturation(c.saturation() * 1.9)
                                .hue(c.hue());

        this.baseColor = c;
        this.highlightColor = highlightColor;
        this.darkColor = darkColor;
        this.darkColor2 = darkColor2;
        this.darkColor3 = darkColor3;

        var baseColorRGBA = this.baseColor.toRgbaString(),
            contrastColor = getContrastColor(c, this.darkText, this.lightText);

        if (this.visualQuality >= 1.0) {
            this.$el.addClass('simple-view-hq');

            var darkColor2RGBA = darkColor2.toRgbaString(),
                pos = 0.7;

            if (!this.concentricCircle) {
                this.concentricCircle = new ConcentricCircle({
                    gradientStops: [0, 0.5, 1],
                    scoreTransitions: [0.8, 0.93, 1.0],
                    alpha: 0.75
                });
            }

            this.$el.css({
                'color': contrastColor,
                'background': this.concentricCircle.getRadialGradient(null, [baseColorRGBA, darkColor2RGBA], [0, pos, 1.0], baseColorRGBA)
            });
        }
        else {
            this.$el.removeClass('simple-view-hq');
            this.$el.css({
                'color': contrastColor,
                'background': baseColorRGBA
            });
        }
    }
});

module.exports = SimpleView;