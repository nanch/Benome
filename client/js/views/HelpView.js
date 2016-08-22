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
    _ = require('underscore');
Backbone.$ = $;

// -------------

var HelpView = Backbone.View.extend({
    tagName: 'div',
    className: 'help-view',

    events: {
    },

    initialize: function(options) {
        options = options || {};
        this.G = this.G || options.G || require('app/Global')();
        _.bindAll(this, 'hide');

        this.$overlay = options.$overlay;
        this.$overlay.click(this.hide);

        this.$close = $('.close-help', this.$el)
                        .click(this.hide);
    },

    render: function(options) {
        options = options || {};

        return this;
    },

    show: function(options) {
        options = options || {};

        if (!this.loaded) {
            $('iframe', this.$el).attr('src', 'https://benome.ca/howtouse-basic.html');
            this.loaded = true;
        }

        this.$overlay.show();
        this.$el.show();
    },

    hide: function() {
        this.$overlay.hide();
        this.$el.hide();
    }
});

module.exports = HelpView; 