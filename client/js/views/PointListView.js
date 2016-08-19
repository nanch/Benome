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
    Hammer = require('hammerjs');
Backbone.$ = $;

// -------------

var PointListView = Backbone.View.extend({
    tagName: 'div',
    className: 'point-list-view',

    events: {
    },

    initialize: function(options) {
        options = options || {};
        this.G = this.G || options.G || require('app/Global')();
        _.bindAll(this, 'render');

        this.clusterController = options.clusterController;
        this.dragHandler = options.dragHandler || null;
        this.dropHandler = options.dropHandler || null;
        this.el.setAttribute('BDragSource', '1');
        this.el.setAttribute('BDropTarget', '1');
        this.$el.data('ViewRef', this);

        this.addCallback = options.addCallback;
        this.showCallback = options.showCallback;

        this.hideLabel = options.hideLabel;

        // Bind to label changes on context
        this.model.getContext().on('change:Label', this.render);
        this.model.getContext().on('change:1__Label', this.render);

        // Recalculate color when parent or position in structure changes
        // TODO

        // Setup
        var G = this.G,
            point = this.model,
            contextID = point.get('ContextID'),
            pointID = point.id,
            _this = this;

        var $el = this.$el.data('ContextID', contextID);

        var mc = new Hammer($el.get()[0]);
        mc.on('tap', function(e) {
            G.trigger('ShowPointDetail', pointID, contextID, _this.showCallback, e.center);
            return false;
        });
        mc.on('press', function() {
            var clusterID = _this.clusterController.cluster.clusterID;
            G.trigger('AddPoint', contextID, clusterID, {}, _this.addCallback, {});
            return false;
        });
        mc.on('swipeleft', function(e) {
            //_this.B.setFocus(_this.B.getParentContextID(contextID));
            return false;
        });

        if (!this.hideLabel) {
            this.$label = $('<div>')
                            .addClass('label')
                            .appendTo($el);
        }
        /*var $time = $('<div>')
                        .addClass('time')
                        .text('')
                        .appendTo($el);*/
    },

    setColor: function() {
        var contextID = this.model.get('ContextID'),
            //backgroundColor = this.model.get('Color'),
            backgroundColor = this.clusterController.cluster.getColor(contextID),
            textColor;
        
        textColor = this.G.getTextContrastColor(backgroundColor);

        this.$el.css({
            'background-color': backgroundColor,
            'color': textColor
        });
    },

    render: function() {
        if (this.$label) {
            this.$label.text(this.model.getLabel());
        }

        if (this.G.isMobile) {
            this.$el.addClass('point-list-view-mobile');
        }

        this.setColor();

        return this.$el;
    }
});

module.exports = PointListView;