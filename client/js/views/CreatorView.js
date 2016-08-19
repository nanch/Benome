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

var CreatorView = Backbone.View.extend({
    tagName: 'div',
    className: 'creator-view',

    events: {
    },

    initialize: function(options) {
        options = options || {};
        this.G = this.G || options.G || require('app/Global')();
        _.bindAll(this, 'onClick', 'onPress', 'dragHandler', 'dropHandler');

        this.el.setAttribute('BDragSource', '1');
        this.el.setAttribute('BDropTarget', '1');
        this.el.setAttribute('BDragHoldTarget', '1');
        this.$el.data('ViewRef', this);
        this.$login = $('.authenticate', this.$el);

        var mc = new Hammer(this.el);
        mc.on('press', this.onPress);
        mc.on('tap', this.onClick);
    },

    dragHandler: function(dragView, dragDetails) {
        return {
            '$dragProxyEl': dragView.$el,
            'proxyClass': 'drag-proxy-creator'
        }
    },

    dropHandler: function(dropView, dragView, dragDetails, dropDetails) {
        var controller = dragView.cluster && dragView.cluster.controller;
        if (controller) {
            controller.trigger('CreatorIncomingDrop', dragView, dragDetails, dropDetails, function(result) {
                if (result) {
                    dragDetails.$dragProxy.animate({
                        width: '0px',
                        height: '0px',
                        left: dropDetails.currentX,
                        top: dropDetails.currentY
                    }, 
                    {
                        duration: 400,
                        complete: function() {
                            $(this).remove();
                        }
                    });

                    return {
                        keepProxy: true
                    }
                }
            });
        }
    },

    render: function() {
        return this;
    },

    onClick: function(e) {
        this.trigger('Click');
        this.G.trigger('ToggleOverlay');
    },

    onPress: function(e) {
        this.G.trigger('ShowAdmin');
    },

    hide: function() {
        this.$el.hide();
    },

    show: function() {
        this.$el.show();
    }
});
_.extend(CreatorView.prototype, Backbone.Events)

module.exports = CreatorView;