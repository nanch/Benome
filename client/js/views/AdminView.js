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
    screenfull = require('app/lib/screenfull.js');
Backbone.$ = $;

// -------------

var AdminView = Backbone.View.extend({
    tagName: 'div',
    className: 'admin-view',

    events: {
        'click .change': 'changePassword',
        'click .logout-session': 'logout',
        'click .toggle-fullscreen': 'onToggleFullScreen'
    },

    initialize: function(options) {
        options = options || {};
        this.G = this.G || options.G || require('app/Global')();
        _.bindAll(this, 'hide', 'newPasswordKeydown', 'onToggleFullScreen');

        this.$overlay = options.$overlay;
        this.$overlay.click(this.hide);

        this.$oldPassword = $('.old-passphrase input', this.$el);
        this.$newPassword = $('.new-passphrase input', this.$el);
        this.$newPassword2 = $('.new-passphrase2 input', this.$el);
        this.$newPassword2.bind('keydown', this.newPasswordKeydown);

        this.$close = $('.close-admin', this.$el)
                        .click(this.hide);
    },

    onToggleFullScreen: function() {
        if (screenfull.enabled) {
            screenfull.toggle();
        }
    },

    newPasswordKeydown: function(e) {
        if (e.keyCode == 13) {
            this.changePassword();
        }
        else if (e.keyCode == 27) {
            this.hide();
        }
    },

    logout: function() {
        this.G.trigger('LogoutUser', this.hide);
    },

    changePassword: function() {
        var oldPassword = this.$oldPassword.val(),
            newPassword = this.$newPassword.val(),
            newPassword2 = this.$newPassword2.val();

        if (!oldPassword || !newPassword || newPassword != newPassword2) {
            return false;
        }

        if (oldPassword !== newPassword) {
            this.G.trigger('ChangePassword', oldPassword, newPassword, this.hide);
        }
        return false;
    },

    render: function(options) {
        options = options || {};

        this.$oldPassword.val('');
        this.$newPassword.val('');

        return this;
    },

    show: function(options) {
        options = options || {};
        this.$overlay.show();

        this.$oldPassword.val('');
        this.$newPassword.val('');
        this.$newPassword2.val('');

        this.$el.show();
    },

    hide: function() {
        this.$overlay.hide();
        this.$el.hide();
    }
});

module.exports = AdminView; 