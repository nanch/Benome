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

var ActivityInput = Backbone.View.extend({
    tagName: 'div',
    className: 'activity-input',

    events: {
        'submit #activity-form': 'formSubmit'
    },

    initialize: function(options) {
        options = options || {};
        _.bindAll(this, 'save', 'labelKeydown', 'inputKeydown', 'formSubmit');

        this.$label = $('#activity-name', this.$el);
        this.$label.bind('keydown', this.labelKeydown);

        this.$el.bind('keydown', this.inputKeydown);
    },

    formSubmit: function(e) {
        this.save();
        return false;
    },

    inputKeydown: function(e) {
        if (e.keyCode == 27) {
            this.clear();
        }
    },

    clear: function() {
        this.$label.val('');
    },

    labelKeydown: function(e) {
        if (e.keyCode == 13) {
            this.save();
        }
        else if (e.keyCode == 27) {
            this.clear();
        }
    },

    render: function(options) {
        options = options || {};

        return this;
    },

    save: function() {
        var label = this.$label.val();
        if (label) {
            this.clear();
            this.B.createContext(label);
        }
    },

    show: function() {
        this.clear();
        this.$el.show();
        this.$label.focus();
    },

    hide: function() {
        this.$el.hide();
    }
});

module.exports = ActivityInput;