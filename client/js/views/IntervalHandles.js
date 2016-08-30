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
    moment = require('moment');
Backbone.$ = $;

// -------------

var IntervalHandles = Backbone.View.extend({
    tagName: 'div',
    className: 'interval-handles',

    initialize: function(options) {
        options = options || {};
        this.G = this.G || options.G || require('app/Global')();
        _.bindAll(this, 'dragHandler', 'dragMoveHandler', 'dragEndHandler');

        this.setValue(options.beginTime, options.duration);

        this.$el.append('' + 
            '<div class="interval-modify-line"></div>' +
            '<div class="interval-modify-handle begin-handle"></div>' +
            '<div class="interval-modify-handle duration-handle"></div>' +
            '<div class="interval-modify-handle end-handle"></div>'
        );

        this.$beginHandle = $('.begin-handle', this.$el).data('handleID', 1);
        this.$beginHandle.attr('BDragSource', '1');
        this.$beginHandle.data('ViewRef', this);

        this.$durationHandle = $('.duration-handle', this.$el).data('handleID', 2);
        this.$durationHandle.attr('BDragSource', '1');
        this.$durationHandle.data('ViewRef', this);

        this.$endHandle = $('.end-handle', this.$el).data('handleID', 3);
        this.$endHandle.attr('BDragSource', '1');
        this.$endHandle.data('ViewRef', this);
      
        this.$line = $('.interval-modify-line', this.$el);
    },

    dragHandler: function(dragView, dragDetails) {
        var $ot = $(dragDetails.originalTarget);
        dragDetails.dragProxyStartX = parseInt($ot.css('left'));
        dragDetails.dragProxyStartY = parseInt($ot.css('top'));

        return {
            'dragMoveHandler': this.dragMoveHandler,
            'dragEndHandler': this.dragEndHandler
        }
    },

    getHandleID: function($el) {
        if ($el.hasClass('begin-handle')) {
            return 1;
        }
        else if ($el.hasClass('end-handle')) {
            return 3;
        }
        else if ($el.hasClass('duration-handle')) {
            return 2;
        }
    },

    dragMoveHandler: function(dragDetails, moveDetails) {
        var $ot = $(dragDetails.originalTarget),
            posX = moveDetails.newX,
            handleID = this.getHandleID($ot);

        this.handleMoved(handleID, posX);
        this.updateHandles(true, false);
    },

    dragEndHandler: function(dragDetails, moveDetails) {
        this.updateHandles(false, true);

        this.trigger('ValueChanged', this.getValue());
    },

    calcTimeFromPos: function(pos) {
        pos += this.$beginHandle.width() / 2;
        pos -= this.lineBeginX;
        pos = Math.max(0, pos);
        pos = Math.min(this.lineLength, pos);

        var posProportion = 0;
        if (pos > 0) {
            posProportion = pos / this.lineLength;
        }

        var posTime = this.beginRange + (this.interval * posProportion);
        return posTime;
    },

    handleMoved: function(handleID, pos) {
        var posTime = this.calcTimeFromPos(pos);

        if (handleID == 1) {
            this.beginTime = Math.min(posTime, this.endTime);
            this.updateBeginTime();
            this.updateDuration();
        } 
        else if (handleID == 2) {
            var duration = this.endTime - this.beginTime;
            this.beginTime = posTime;
            this.endTime = posTime + duration;

            this.updateBeginTime();
            this.updateEndTime();
        }
        else if (handleID == 3) {
            this.endTime = Math.max(posTime, this.beginTime);
            this.updateDuration();
            this.updateEndTime();
        }
    },

    updateBeginTime: function(beginTime) {
        beginTime = beginTime || this.beginTime;

        var formattedTime = moment(beginTime * 1000).format('HH:mm');
        this.$beginHandle.text(formattedTime);
    },

    updateEndTime: function(endTime) {
        endTime = endTime || this.endTime;

        var formattedTime = moment(endTime * 1000).format('HH:mm');
        this.$endHandle.text(formattedTime);
    },

    updateDuration: function(duration) {
        var duration = this.endTime - this.beginTime,
            formattedDuration = this.G.formatDuration(duration, true);

        this.$durationHandle.text(formattedDuration);
    },

    setValue: function(beginTime, duration) {
        this.beginTime = beginTime || Date.now();
        this.duration = duration || this.duration || 0;
        this.endTime = this.beginTime + this.duration;
    },

    getValue: function() {
        return {
            'Time': this.beginTime,
            'Duration': ((this.endTime || 0) - this.beginTime)
        }
    },

    render: function(options, changeCallback) {
        options = options || {};
        this.changeCallback = changeCallback;
        this.changed = false;

        var containerWidth = options.width,
            containerHeight = options.height,
            handleHeight = this.G.fontSize * 1.5, // this.$beginHandle.height(),
            handleFontSize = handleHeight * 0.9,
            lineHeight = containerHeight * 0.01,
            lineY = containerHeight / 2;

        this.lineLength = containerWidth * 1.0;
        this.lineBeginX = containerWidth * 0;

        this.$line.css({
            left: this.lineBeginX + 'px',
            top: lineY + 'px',
            width: this.lineLength + 'px',
            height: lineHeight + 'px',
        });

        this.$beginHandle.css({
            top: (lineY - (handleHeight / 2) - handleHeight) + 'px',
            height: handleHeight + 'px',
            'font-size': handleFontSize + 'px'
        });

        this.$durationHandle.css({
            top: (lineY - (handleHeight / 2) + (lineHeight / 2)) + 'px',
            height: handleHeight + 'px',
            'font-size': handleFontSize + 'px'
        });

        this.$endHandle.css({
            top: (lineY + lineHeight + (handleHeight / 2)) + 'px',
            height: handleHeight + 'px',
            'font-size': handleFontSize + 'px'
        });

        this.updateHandles(false, true);
        this.updateBeginTime();
        this.updateDuration();
        this.updateEndTime();

        this.$el.show();
    },

    initState: function() {
        var duration = this.endTime - this.beginTime;
        this.beginRange = this.beginTime - (3600 * 4);
        this.endRange = this.beginTime + duration + (3600 * 4);
        this.interval = this.endRange - this.beginRange;
    },

    updateHandles: function(noAnim, initState) {
        var endTime = this.endTime,
            duration = this.endTime - this.beginTime;

        if (initState) {
            this.initState();
        }

        // Begin handle
        var timeProportionBegin = (this.beginTime - this.beginRange) / this.interval,
            linePositionBegin = this.lineLength * timeProportionBegin,
            beginHandleLeft = (this.lineBeginX + linePositionBegin) - (this.$beginHandle.width() / 2);

        // Duration/combined handle
        var linePositionEnd = linePositionBegin,
            durationLength = this.$beginHandle.width();

        if (duration) {
            var timeProportionEnd = (endTime - this.beginRange) / this.interval;
            linePositionEnd = this.lineLength * timeProportionEnd;
            durationLength = this.lineLength * (timeProportionEnd - timeProportionBegin) + this.$beginHandle.width();
        }

        // Begin handle
        var fn = noAnim ? this.$beginHandle.css : this.$beginHandle.animate;            
        fn.call(this.$beginHandle.clearQueue(), {
            left: beginHandleLeft + 'px'
        });

        // Duration/combined handle
        var fn = noAnim ? this.$durationHandle.css : this.$durationHandle.animate;
        fn.call(this.$durationHandle.clearQueue(), {
            left: beginHandleLeft + 'px',
            width: Math.max(this.$beginHandle.width(), durationLength) + 'px'
        });

        // End handle
        var fn = noAnim ? this.$endHandle.css : this.$endHandle.animate;
        fn.call(this.$endHandle.clearQueue(), {
            left: ((this.lineBeginX + linePositionEnd) - (this.$endHandle.width() / 2)) + 'px'
        });

        return this.$el;
    }
});
_.extend(IntervalHandles.prototype, Backbone.Events);

module.exports = IntervalHandles;