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

var $ = require('jquery'),
    _ = require('backbone/node_modules/underscore'),
    Backbone = require('backbone');

var AttributeModeView = Backbone.View.extend({
    tagName: 'div',
    className: 'attribute-mode-view',

    events: {
        //'click': ''
    },

    initialize: function(options) {
        options = options || {};

        this.surfaceView = options.surfaceView;
        this.name = options.name || this.name;
        this.sourceData = options.sourceData;
    },

    render: function(options) {
        options = options || {};

        this.maxWidth = this.surfaceView.viewState.radius * 2;
        this.maxHeight = this.maxWidth;

        this.widthPct = 0.7;
        this.heightPct = 0.7;
        this.leftPct = (1 - this.widthPct) / 2;
        this.topPct = (1 - this.heightPct) / 2;

        this.regionWidth = this.maxWidth * this.widthPct;
        this.regionHeight = this.maxHeight * this.heightPct;
        this.regionLeft = this.maxWidth * this.leftPct;
        this.regionTop = this.maxHeight * this.topPct;

        this.$el.css({
            'position': 'absolute',
/*            'top': this.regionTop + 'px',
            'left': this.regionLeft + 'px',
            'width': this.regionWidth + 'px',
            'height': this.regionHeight + 'px'
*/
            'top': (100 * this.topPct) + '%',
            'left': (100 * this.leftPct) + '%',
            'width': (100 * this.widthPct) + '%',
            'height': (100 * this.heightPct) + '%'
        });

        return this;
    },

    show: function() {
        this.$el.show();
    },

    hide: function() {
        this.$el.hide();
    },

    getValue: function() {
        return null;
    }
});

module.exports = AttributeModeView;