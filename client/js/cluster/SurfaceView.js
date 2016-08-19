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


var SurfaceView = Backbone.View.extend({
    tagName: 'div',
    className: 'surface-view',

    events: {
        //'click': ''
    },

    modeClasses: {},

    initialize: function(options) {
        options = options || {};
        this.G = this.G || options.G || require('app/Global')();
        _.bindAll(this, 'valueChanged');

        this.setState(options.viewState)
        this.baseView = options.baseView;
        this.contextModel = options.contextModel;
        this.clusterController = options.clusterController;
        this.modeParams = options.modeParams || {};
        this.modeParams.surfaceView = this;
        this.sourceData = this.modeParams.sourceData;

        this.displayMode = null;
        this.setDisplayMode(options.displayMode);
        this.lastDisplayMode = null;
        this.modeView = {};

        this.$el.css({
            'width': '100%',
            'height': '100%',
            'pointer-events': 'none'
        });
    },

    setState: function(viewState) {
        this.viewState = viewState || {};
    },

    setDisplayMode: function(displayMode) {
        if (displayMode && displayMode != this.displayMode) {
            this.lastDisplayMode = this.displayMode;
            this.displayMode = displayMode;
        }
    },

    dataReactive: function(contextID) {
        return false;
    },

    getModeView: function(displayMode) {
        displayMode = displayMode || this.displayMode;
        return this.modeView[displayMode];
    },

    render: function(options) {
        options = options || {};

        if (options.displayMode) {
            this.setDisplayMode(options.displayMode);
        }
        var displayMode = this.displayMode;
        if (this.lastDisplayMode && this.lastDisplayMode != displayMode) {
            var lastModeView = this.modeView[this.lastDisplayMode]
            if (lastModeView) {
                lastModeView.hide();
            }
        }

        var modeView = this.modeView[displayMode];
        if (!modeView) {
            var modeClass = this.modeClasses[displayMode];
            if (modeClass) {
                _.extend(this.modeParams, {
                    G: this.G
                });
                modeView = new modeClass(this.modeParams);
                this.listenTo(modeView, 'ValueChanged', this.valueChanged);

                this.modeView[displayMode] = modeView;
                this.$el.append(modeView.$el);
            }
        }

        if (modeView) {
            modeView.render().show();
        }
        return this;
    },

    valueChanged: function(newValue) {
        this.newValue = newValue;
        this.trigger('ValueChanged', newValue);
    },

    getValue: function() {
        return this.newValue;
    }
});
_.extend(SurfaceView.prototype, Backbone.Events);

module.exports = SurfaceView;