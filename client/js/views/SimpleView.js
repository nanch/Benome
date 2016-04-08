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

var ElementView = require('app/views/ElementView'),
    ConcentricCircle = require('app/ConcentricCircle');

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

        _.bindAll(this, 'onTap', 'onPress', 'onPressUp', 'render', 'dragHandler', 'dropHandler',
                'currentlyPressing', 'onPressIndicatorCancelled');

        this.on('PressIndicatorCancelled', this.onPressIndicatorCancelled);

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

        this.dragDisabled = options.dragDisabled || false;
        this.dropDisabled = options.dropDisabled || false;
        this.moveDisabled = options.moveDisabled || false;

        this.heightProportion = options.heightProportion || this.heightProportion;

        this.color = options.color;
        this.visualQuality = options.visualQuality || 0;
        this.data = options.data;
        this.isRoot = options.isRoot;
        this.isGlobalRoot = options.isGlobalRoot;
        this.hideLabel = options.hideLabel || false;
        this.borderEnabled = options.borderEnabled || false;
        this.labelIDOnly = options.labelIDOnly || false;

        this.cluster = options.cluster;
        this.clusterID = options.clusterID;

        var mc = new Hammer(this.$el.get()[0], {}),
            singleTap = new Hammer.Tap({ threshold: this.G.tapThreshold}),
            press = new Hammer.Press({ time: 300, threshold: this.G.pressThreshold});

        mc.add([press, singleTap]);

        mc.on('tap', this.onTap);
        mc.on('press', this.onPress);
        mc.on('pressup', this.onPressUp);

        this.updateData(this.data);
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

    dropHandler: function(dropView, dragView, dragDetails, dropDetails) {
        if (dragDetails.dragButton != 0) {
            return;
        }

        // Creator to context
        if (dragView.className == 'creator-view') {
            if (this.cluster) {
                this.cluster.trigger('CreatorDrop', dropView, dragView, dragDetails, dropDetails);
            }
            return;
        }
        else if (dragView.className == 'destroyer-view') {
            if (this.cluster) {
                this.cluster.trigger('DestroyerDrop', dropView, dragView, dragDetails, dropDetails);
            }
        }

        // Everything else is context-to-context
        if (dragView.className != 'simple-view') {
            return;
        }

        var dragViewID = dragView.viewID,
            dragModel = dragView.model,
            dragParentID = dragModel.getParentID(),
            dragClusterID = dragView.clusterID,
            dragCluster = this.G.getCluster(dragClusterID),
            dragFocusID = dragCluster.focusID,
            dragIsFocus = dragViewID == dragFocusID,

            dropViewID = dropView.viewID,
            dropClusterID = dropView.clusterID,
            dropCluster = this.G.getCluster(dropClusterID),
            dropFocusID = dropCluster.focusID,
            dropIsFocus = dropFocusID ? dropViewID == dropFocusID : false,
            dropModel = dropView.model,
            dropParentID = dropModel.getParentID();

        // If an interior drag target is dropped onto an interior drop target on a different 
        // cluster, then link the actions together.
        /*
        if (dropModel && dragClusterID != dropClusterID && !dragIsFocus && !dropIsFocus) {
            // Create secondary action (the drag)
            // Create primary action (the drop) with an association to the secondary action

            this.G.trigger('AddLinkedContext', dropViewID, dragViewID, dropClusterID, dragClusterID);
        }
        */
        if (dragIsFocus) {
            if (this.G.FEATURE('MovableFocus') && !this.moveDisabled) {
                // If the focus is dropped then move the cluster
                var x = dragDetails.dragProxyX + (dragDetails.dragProxyWidth / 2),
                    y = dragDetails.dragProxyY + (dragDetails.dragProxyHeight / 2);

                dragCluster.setPosition(x, y);
                dragCluster.render();
            }
        }
        else if (!dragIsFocus && dragClusterID == dropClusterID) {
            if (dragModel.isLeaf() && dropViewID == dragViewID) {
                if (this.G.FEATURE('ActivityPullForward')) {
                    this.G.trigger('AdjustContext', dragViewID, 'forward', dragClusterID);
                }
            }
            else if (dragModel.isLeaf() && dropViewID == dragParentID) {
                if (this.G.FEATURE('ActivityPushBack')) {
                    this.G.trigger('AdjustContext', dragViewID, 'back', dragClusterID);
                }
            }
            else if (dropViewID != dragViewID) {
                // If an interior drag target is dropped elsewhere in the same cluster, and the drop target
                // is not an ancestor, make the drop target its new parent.
                // Cancel if the destination is a linked context.

                // Ensure that destination is not a linked context
                if (dropModel.isLink()) {
                    return false;
                }

                // Ensure that target does not have origin as a parent
                var tmpParentID = dropModel.getParentID(),
                    isAncestor = false;

                while (tmpParentID) {
                    if (tmpParentID == dragViewID) {
                        isAncestor = true;
                        break;
                    }

                    tmpParentID = this.cluster.contexts.get(tmpParentID).getParentID();
                }

                if (!isAncestor && dropViewID && dragParentID && dropViewID != dragParentID) {
                    var dragView = dragCluster.getView(dragViewID);
                    dragView.color = null;
                    this.G.trigger('ReparentContext', dragViewID, dragParentID, dropViewID, dragClusterID);
                }
            }
        }

        /*
        else if (dragDetails.dragButton == 1) {

            // Anything goes as long as the drop target isn't a link
            if (dropModel && !dropModel.isLink()) {
                this.G.trigger('AddLinkedContext', dropViewID, dragViewID, dropClusterID, dragClusterID);
            }
        }
        */
    },

    updateData: function(rangeScores) {
        if (!rangeScores) {
            return;
        }
        
        /*this.$el.css({
            'background': this.concentricCircle.getRadialGradient(rangeScores)
        });*/

        if (this.borderEnabled) {
            this.$el.css({
                'border': '0.3em solid ' + this.concentricCircle.getCurrentColor(rangeScores)
            });
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

    onPress: function(e) {
        var $target = $(e.target);
        if ($target.hasClass('simple-view') || $target.hasClass('focus-container')) {
            this.G.trigger('ViewPressShow', this.$el, this);
            this.currentlyPressing(null, e);
        }
    },

    onPressIndicatorCancelled: function() {
        this.pressActive = false;
    },

    currentlyPressing: function(pressID, e) {
        if (!pressID) {
            this.pressActive = true;
            this.numPressIntervals = 1;
            pressID = 100000 + (Math.random() * 1000000);
            this.pressID = pressID;
            this.pressBeginX = this.G.DD.currentCursorX;
            this.pressBeginY = this.G.DD.currentCursorY;
        }
        else {
            this.numPressIntervals += 1;
        }

        if (this.pressActive) {
            var deltaX = this.pressBeginX - this.G.DD.currentCursorX,
                deltaY = this.pressBeginY - this.G.DD.currentCursorY;

            this.G.trigger('ViewPressUpdate', this.numPressIntervals / 7, deltaX, deltaY);
            //this.G.debugMsg('press active: ' + this.numPressIntervals);

            if (this.numPressIntervals >= 7) {
                this.clearPress();
                this.execPress(e);
            }
            else {
                _.delay(this.currentlyPressing, 100, pressID, e);
            }
        }
    },

    clearPress: function() {
        this.pressActive = false;
        this.G.trigger('ViewPressHide');
    },

    execPress: function(e) {
        var $target = $(e.target),
            targetView = $target.data('ViewRef');

        if (targetView === this && ($target.hasClass('simple-view') || $target.hasClass('focus-container'))) {
            if (this.numPressIntervals >= 7) {
                this.G.trigger('ActivityPressed', e, this);
                this.cluster.trigger('ActivityPressed', e, this);
            }
            else {
                if (this.G.FEATURE('PointShortPress')) {
                    this.G.trigger('ActivityShortPressed', e, this);
                    this.cluster.trigger('ActivityShortPressed', e, this);
                }
            }
            
            return false;
        }
    },

    onPressUp: function(e) {
        if (this.pressActive) {
            this.clearPress();
            this.execPress(e);
        }
    },

    getPosition: function() {
        return {
            x: this.x - this.radius,
            y: this.y - (this.radius * SimpleView.prototype.heightProportion)
        }
    },

    /*getInitialPosition: function() {
        var initialRadius = _.isNumber(this.initialRadius) ? this.initialRadius : this.radius;

        if (!_.isNumber(this.initialX) || !_.isNumber(this.initialY) ||
            _.isNaN(this.initialX) || _.isNaN(this.initialY)) {
            return {
                x: null,
                y: null
            }
        }

        return {
            x: this.initialX - initialRadius,
            y: this.initialY - initialRadius
        }
    },*/

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

    render: function(options) {
        options = options || {};

        this.renderColor(options.color, options.forceColor);
        this.rendered = true;

        /*var fontSize = this.calcFontSize(this.$button);
        this.$el.css({
            'font-size': fontSize + 'px'
        });*/

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

        /*
        if (this.cssPrefix == '-webkit-') {
            this.$button.css({
                background: '-webkit-gradient( linear, left top, left bottom, color-stop(0.05, ' + this.baseColor.toRgbaString() + '), color-stop(1, ' + this.highlightColor.toRgbaString() + ') )'
            });
        }
        else {
            this.$button.css({
                background: '-moz-linear-gradient( center top, ' + this.baseColor.toRgbaString() + ' 5%, ' + this.highlightColor.toRgbaString() + ' 100% )'
            });
        }
        */

        /*if (this.borderEnabled) {
            var frequencyScore = this.model.metaData.get('CurrentScore');
            if (frequencyScore >= 0.5) {
                var c2 = this.baseColor.toRgbaString(),
                    d2 = darkColor2.toRgbaString(),
                    pos = 1 - (0.05 + (0.45 * (frequencyScore - 0.5)));

                this.$el.css({
                    'background': this.concentricCircle.getRadialGradient(null, [c2, d2], [0, pos, 1.0], c2)
                });
            }
            else {
                this.$el.css({
                    //'border': '0.4em solid ' + this.baseColor.toRgbaString(),
                    'background': '',
                    'background-color': this.baseColor.toRgbaString()
                });
            }
        }*/

        var baseColorRGBA = this.baseColor.toRgbaString(),
            contrastColor = this.G.getTextContrastColor(c);

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