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

var AutoActionView = Backbone.View.extend({
    tagName: 'div',
    className: 'auto-action-view',

    events: {
        'click .cancel': 'cancel',
        'click .more': 'toggleExpand',
        'click .done1': 'save',
        'click .done2': 'save',
        'click .add': 'saveMulti'
    },

    initialize: function(options) {
        options = options || {};
        this.G = this.G || options.G || require('app/Global')();
        _.bindAll(this, 'updateTimer', 'onClusterFocusChanged', 'onFocusAction', 'showLater');

        this.delay = options.delay;

        this.$overlay = $('.auto-action-overlay', this.$el);
        this.$details = $('.auto-action-overlay-details', this.$el);

        this.on('ClusterFocusChanged', this.onClusterFocusChanged);
        this.on('FocusAction', this.onFocusAction);
    },

    onClusterFocusChanged: function(cluster, contextID) {
        if (cluster !== this.G.globalCluster.cluster) {
            return;
        }
        //this.G.toggleOverlay(false, true);
        this.G.contextRename.hide(true);

        if (this.visible) {
            // The overlay is already open, so save it first
            this.save(this.focusID);
        }

        this.focusID = contextID;
        this.focusCluster = cluster;

        if (cluster.contexts.get(contextID).isLeaf()) {
            this.beginTime = new Date().getTime();

            var randNum = 100000 + (Math.random() * 1000000);
            this.lastRandNum = randNum;

            _.delay(this.showLater, this.delay * 1000, randNum);
        }
    },

    onFocusAction: function(newFocusID) {
        if (!this.focusID || this.focusID != newFocusID) {
            return;
        }

        if (this.visible) {
            this.hide();
        }
        else {
            this.showNow();
        }
    },

    showLater: function(randNum) {
        // Return if there was a subsequent call
        if (randNum != this.lastRandNum || !this.focusID) {
            return;
        }

        var context = this.focusCluster.contexts.get(this.focusID);
        if (!context || !context.isLeaf()) {
            return;
        }

        // Otherwise show the overlay
        this.show();
    },

    showNow: function(focusID) {
        this.focusID = focusID || this.focusID;
        this.beginTime = null;

        this.show();
    },

    toggleExpand: function(force) {
        if (force === true || force === false) {
            this.expanded = force;
        }
        else {
            this.expanded = !this.expanded;
        }

        if (this.expanded) {
            var overlayWidth = this.$overlay.width();

            this.$details
                .css({
                    'left': overlayWidth + 'px',
                    'width': ((this.G.globalSize().width * 0.9) - overlayWidth) + 'px'
                })
                .show();

            if (!this.G.isMobile) {
                var $textarea = $('textarea', this.$details),
                    textareaEl = $textarea.get()[0];

                _.delay(function() {
                    textareaEl.focus();
                }, 300);
            }
        }
        else {
            this.$details.hide();
        }
    },

    show: function() {
        this.$el.show();
        this.visible = true;

        var $textarea = $('textarea', this.$details)
                            .val('');

        this.initTimer();
    },

    hide: function() {
        this.$el.hide();
        this.toggleExpand(false);

        this.visible = false;
        this.cancelTimer();
    },

    cancel: function() {
        this.cancelTimer();
        this.hide();
    },

    saveMulti: function() {
        this.save(this.focusID, true);
        
        this.beginTime = new Date().getTime();
        this.updateTimer();

        var $textarea = $('textarea', this.$details)
                            .val('');

        if (!this.G.isMobile) {
            var textareaEl = $textarea.get()[0];
            _.delay(function() {
                textareaEl.focus();
            }, 300);
        }

    },

    save: function(focusID, stayOpen, showHistory) {
        if (!_.isString(focusID)) {
            focusID = this.focusID;
        }

        if (!stayOpen) {
            this.hide();
        }

        var duration = this.getFocusDuration();
        this.G.trigger('AddPoint', this.focusID, this.focusCluster.clusterID, {
                'UpdatedAttributes': {
                    'Timing': {
                        Time: parseInt(Date.now() / 1000) - duration,
                        Duration: duration
                    },
                    'Text': $('textarea', this.$details).val() || null
                }
            }, null, {
                showHistory: !!showHistory,
                showAddFeedback: true,
                toParent: false,
                showDetail: false,
                feedbackUnderCursor: false
            });
    },

    initTimer: function() {
        if (!this.beginTime) {
            this.beginTime = new Date().getTime();
        }
        this.updateTimer();
    },

    updateTimer: function() {
        var elapsed = this.getFocusDuration();

        if (this.visible) {
            var elapsedStr = this.formatDuration(elapsed);
            $('.elapsed', this.$overlay).text(elapsedStr);
            _.delay(this.updateTimer, (elapsed / 60) >= 2 ? 60000 : 1000);
        }
    },

    cancelTimer: function() {},

    getFocusDuration: function() {
        var duration = new Date().getTime() - this.beginTime;
        return Math.round(duration / 1000);
    },

    formatDuration: function(duration, noSeconds) {
        return this.G.formatDuration(duration, noSeconds);
    }
});

module.exports = AutoActionView;