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

var ContextActions = Backbone.View.extend({
    tagName: 'div',
    className: 'context-actions',

    events: {
        'click .rename': 'rename',
        /*'click .good': 'good',
        'click .more': 'more',
        'click .less': 'less',*/
        'click .delete': 'delete',
        'click .close': 'hide'
    },

    initialize: function(options) {
        options = options || {};
        _.bindAll(this, 'hide');

        this.$overlay = options.$overlay;
        this.$overlay.click(this.hide)
        this.defaultTargetInterval = 86400;
    },

    rename: function() {
        var oldLabel = this.B.globalCollection.get(this.contextID).get('label'),
            newLabel = $('input', this.$el).val();

        if (newLabel && newLabel != oldLabel) {
            this.B.renameContext(this.contextID, this.clusterID, newLabel);
            this.hide();
        }
    },

    /*good: function() {
        var context = this.B.structure[this.contextID],
            targetInterval = context.CurrentInterval || null;

        if (!targetInterval && this.defaultTargetInterval) {
            targetInterval = this.defaultTargetInterval;
        }

        if (targetInterval) {
            this.B.addFeedback(this.contextID, targetInterval);
            this.hide();
        }
    },

    more: function() {
        var context = this.B.structure[this.contextID],
            targetInterval = context.TargetInterval || context.CurrentInterval;

        if (targetInterval) {
            targetInterval = this.B.incrementInterval(targetInterval);
        }
        else if (this.defaultTargetInterval) {
            targetInterval = this.defaultTargetInterval;
        }

        if (targetInterval) {
            context.TargetInterval = targetInterval;
            this.showIntervals(context);
            this.B.addFeedback(this.contextID, targetInterval);
            //this.hide();
        }
    },

    less: function() {
        var context = this.B.structure[this.contextID],
            targetInterval = context.TargetInterval || context.CurrentInterval;

        if (targetInterval) {
            targetInterval = this.B.decrementInterval(targetInterval);
        }
        else if (this.defaultTargetInterval) {
            targetInterval = this.defaultTargetInterval;
        }

        if (targetInterval) {
            context.TargetInterval = targetInterval;
            this.showIntervals(context);
            this.B.addFeedback(this.contextID, targetInterval);
            //this.hide();
        }
    },*/

    delete: function() {
        this.B.deletePoint(this.contextID, null, this.clusterID);
        this.hide();
    },

    render: function(options) {
        options = options || {};
        return this;
    },

    show: function($refEl, contextID, clusterID) {
        this.contextID = contextID;
        this.clusterID = clusterID;

        if ($refEl) {
            this.centerOn($refEl);
        }

        this.$overlay.show();

        var contextModel = this.B.globalCollection.get(this.contextID);

        $('input', this.$el).val(contextModel.get('label'));

        //this.showIntervals(context);
        this.$el.show();
    },

    showIntervals: function(context) {
        var friendlyCurrentInterval = '',
            friendlyTargetInterval = '';

        if (context.TargetInterval) {
            friendlyTargetInterval = this.B.intervalToFriendly(context.TargetInterval);
            friendlyCurrentInterval = this.B.intervalToFriendly(context.CurrentInterval);
        }
        else if (context.CurrentInterval) {
            friendlyCurrentInterval = this.B.intervalToFriendly(context.CurrentInterval);
        }
        $('.friendly-target-interval').text('T: ' + friendlyTargetInterval);
        $('.friendly-current-interval').text('C: ' + friendlyCurrentInterval);
    },

    hide: function() {
        this.$overlay.hide();
        this.$el.hide();
    },

    centerOn: function($refEl) {
        var yMid = $refEl.offset().left + ($refEl.width() / 2),
            xMid = $refEl.offset().top + ($refEl.height() / 2),
            height = this.$el.height(),
            width = this.$el.width(),
            top = (xMid - (height / 2)),
            left = (yMid - (width / 2)),
            size = this.B.globalSize();

        if (top + height > size.height) {
            top = size.height - height;
        }
        else if (top < 0) {
            top = 0;
        }

        if (left + width > size.width) {
            left = size.width - width;
        }
        else if (left < 0) {
            left = 0;
        }

        this.$el.css({
            top:  top + 'px',
            left: left + 'px'
        });
    }
});

module.exports = ContextActions;