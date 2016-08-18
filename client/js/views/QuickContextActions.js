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

// -------------

var QuickContextActions = Backbone.View.extend({
    tagName: 'div',
    className: 'quick-context-actions',

    events: {
        'click': 'click',
        'click .rename': 'save'
    },

    initialize: function(options) {
        options = options || {};
        this.G = this.G || options.G || require('app/Global')();
        _.bindAll(this, 'hide', 'hide2', 'labelKeydown');

        this.$overlay = options.$overlay;
        this.$overlay.click(this.hide);
        this.$label = $('input', this.$el);
        this.$label.bind('keydown', this.labelKeydown);

        this.G.on('GlobalClusterClicked', this.hide);
    },

    labelKeydown: function(e) {
        this.isActive = true;

        if (e.keyCode == 13) {
            this.save();
        }
        else if (e.keyCode == 27) {
            this.hide(true);
        }
    },

    save: function() {
        var clusterID = this.clusterID,
            cluster = this.G.getCluster(clusterID);

        var oldLabel = cluster.contexts.get(this.contextID).getNS('Label'),
            newLabel = this.$label.val();

        if (newLabel && newLabel != oldLabel) {
            this.G.trigger('RenameContext', this.contextID, this.clusterID, newLabel);
        }
        this.hide();
        return false;
    },

    click: function() {
        this.isActive = true;

        if (this.isPartial) {
            this.isPartial = false;
            this.showOverlay();
        }
    },

    showOverlay: function() {
        this.$el.css('opacity', 1.0);
        this.randNum = Math.round(Math.random() * 1000000);
        this.$overlay.show();
    },

    render: function(options) {
        options = options || {};
        return this;
    },

    show: function(refView, options) {
        options = options || {};

        this.isActive = false;
        var lastVisible = this.isVisible;
        this.isVisible = true;

        var $refEl = refView.$el,
            clusterID = refView.clusterID,
            cluster = this.G.getCluster(clusterID),
            renameContextID = options.renameContextID || refView.viewID;

        this.contextID = renameContextID;
        this.clusterID = clusterID;
        this.randNum = Math.round(Math.random() * 1000000);

        if ($refEl) {
            this.G.centerOn($refEl, this.$el);
        }

        var contextModel = cluster.contexts.get(this.contextID);
        this.$label.val(contextModel.getNS('Label'));

        if (options.autoFocus) {
            this.showOverlay();
            
            var _this = this;
            _.delay(function() {
                _this.$label.focus();
            }, 200);
        }
        else {
            this.isPartial = true;
        }

        if (options.autoHide) {
            _.delay(this.hide2, options.autoHide, this.randNum);
        }

        this.lastPointerEventsVal = null;
        if (!lastVisible) {
            this.$el
                .css({
                    opacity: 0,
                    'pointer-events': 'auto'
                })
                .show()
                .animate({
                    opacity: 0.9
                }, {duration: 150});
        }
        else {
            this.$el
                .css({
                    opacity: 1,
                    'pointer-events': 'auto'
                });
        }
    },

    hide2: function(randNum) {
        if (randNum != this.randNum || this.isActive) {
            return;
        }

        this.hide();
    },

    hide: function(quick) {
        this.$overlay.hide();

        if (quick) {
            this.$el.hide();
            this.isVisible = false;
        }
        else {
            var _this = this;
            this.$el
                .animate({
                    opacity: 0
                }, {
                    duration: 300,
                    complete: function() {
                        $(this).hide();
                        _this.isVisible = false;
                    }
                });
        }
    },

    setPointerTransparent: function() {
        this.lastPointerEventsVal = null;

        if (this.isVisible) {
            this.lastPointerEventsVal = this.$el.css('pointer-events') || 'auto';
            this.lastOpacityVal = this.$el.css('opacity') || 1;
            this.$el.css({
                'pointer-events': 'none',
                'opacity': 0.2
            });
        }
    },

    restorePointer: function(force) {
        if (this.lastPointerEventsVal) {
            this.$el.css({
                'pointer-events': this.lastPointerEventsVal,
                'opacity': this.lastOpacityVal
            });
        }
    }
});

module.exports = QuickContextActions; 