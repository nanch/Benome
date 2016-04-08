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

var DetailSpectrum = Backbone.View.extend({
    className: 'detail-spectrum-view',

    events: {
    },

    initialize: function(options) {
        options = options || {};
        this.G = this.G || options.G || require('app/Global')();
        _.bindAll(this, 'doneClusterDetail', 'showClusterDetail', 'updateClusterDetail', 'filterLevelChanged');

        this.numDetailLevels = options.numDetailLevels;
        this.greyScaleStep = options.greyScaleStep || 12;
    },

    render: function() {
        var G = this.G;
        if (!this.eventsBound) {
            G.on('UpdateClusterDetail', this.updateClusterDetail);
            G.on('ShowClusterDetail', this.showClusterDetail);
            G.on('DoneClusterDetail', this.doneClusterDetail);
            G.on('FilterLevelChanged', this.filterLevelChanged);

            this.eventsBound = true;
        }

        this.detailSpectrumWidth = G.globalSize().width * 0.7;
        this.$el.css({
            width: this.detailSpectrumWidth + 'px'
        });

        var levelWidth = Math.floor(this.detailSpectrumWidth /  this.numDetailLevels);

        _.each(_.range(this.numDetailLevels), function(i) {
            var greyScale = this.greyScaleStep * i,
                $detailLevel = $('<div>')
                                    .addClass('detail-level')
                                    .addClass('detail-level-' + i)
                                    .css({
                                        'background-color': 'rgb(' + greyScale + ', ' + greyScale + ', ' + greyScale + ')',
                                        'width': levelWidth + 'px'
                                    })
                                    .appendTo(this.$el);
        }, this);

        return this;
    },

    filterLevelChanged: function(filterLevel) {
        $('.detail-level', this.$el)
            .removeClass('detail-level-active');

        $('.detail-level-' + filterLevel, this.$el)
            .addClass('detail-level-active');
    },

    showClusterDetail: function(cluster) {
        this.showDetailFeedback(cluster);
    },

    updateClusterDetail: function(cluster, e) {
        var currentX = e.pageX,
            currentY = e.pageY;

        if (e.center) {
            currentX = e.center.x;
            currentY = e.center.y;
        }

        if (!this.originCDX) {
            this.originCDX = currentX;
            this.originFilterLevel = cluster.filterLevel;
        }

        var incr = (this.G.globalSize().width * 0.45) / this.numDetailLevels,
            detailLevel = this.originFilterLevel - Math.floor((this.originCDX - currentX) / incr);

        this.showDetailSpectrum(cluster);

        cluster.setFilterLevel(detailLevel, { relative: false, noRender: true});
        cluster.debounceRender();
    },

    showDetailFeedback: function(cluster, x, y) {
        if (this.detailFeedbackVisible) {
            return;
        }
        else {
            this.detailFeedbackVisible = true;
            this.showDetailSpectrum(cluster);
        }
    },

    doneClusterDetail: function(cluster) {
        this.detailFeedbackVisible = false;
        this.originCDX = null;
        this.hideDetailSpectrum();
    },

    showDetailSpectrum: function(cluster, filterLevel) {
        this.detailCluster = cluster;

        if (!_.isNumber(filterLevel)) {
            filterLevel = cluster.filterLevel;
        }

        var levelWidth = this.detailSpectrumWidth / this.numDetailLevels,
            x = cluster.x,
            y = cluster.y,
            left = x - (levelWidth * filterLevel) - (levelWidth / 2),
            top = y - (this.$el.height() / 2);

        this.$el
            .css({
                'left': left + 'px',
                'top': top + 'px'
            })
            .show();
    },

    hideDetailSpectrum: function() {
        this.$el.hide();
    }

});

module.exports = DetailSpectrum;
