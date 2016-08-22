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

var GetHelpView = Backbone.View.extend({
    tagName: 'div',
    className: 'gethelp-view',

    events: {
    },

    initialize: function(options) {
        _.bindAll(this, 'onClick');
        this.$el.text('?');

        var mc = new Hammer(this.el);
        mc.on('tap', this.onClick);
    },

    onClick: function(e) {
        this.trigger('Click');
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
_.extend(GetHelpView.prototype, Backbone.Events)

module.exports = GetHelpView;