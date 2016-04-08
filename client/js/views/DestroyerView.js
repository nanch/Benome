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
    _ = require('backbone/node_modules/underscore'),
    Hammer = require('hammerjs');
Backbone.$ = $;

// -------------

var DestroyerView = Backbone.View.extend({
    tagName: 'div',
    className: 'destroyer-view',

    events: {
    },

    initialize: function(options) {
        _.bindAll(this, 'dragHandler', 'dropHandler');

        this.el.setAttribute('BDragSource', '1');
        this.el.setAttribute('BDropTarget', '1');
        this.el.setAttribute('BDragHoldTarget', '0');
        this.$el.data('ViewRef', this);
    },

    dragHandler: function(dragView, dragDetails) {
        return {
            '$dragProxyEl': dragView.$el,
            'proxyClass': 'drag-proxy-destroyer'
        }
    },

    dropHandler: function(dropView, dragView, dragDetails, dropDetails) {
        var controller = dragView.cluster && dragView.cluster.controller;
        controller = controller || dragView.clusterController;

        if (controller) {
            controller.trigger('DestroyerIncomingDrop', dragView, dragDetails, dropDetails, function(result) {
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

    hide: function() {
        this.$el.hide();
    },

    show: function() {
        this.$el.show();
    }
});
_.extend(DestroyerView.prototype, Backbone.Events)

module.exports = DestroyerView;