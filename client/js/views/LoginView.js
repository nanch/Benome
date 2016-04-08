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

var LoginView = Backbone.View.extend({
    tagName: 'div',
    className: 'login-view',

    events: {
    },

    initialize: function(options) {
        options = options || {};
        this.G = this.G || options.G || require('app/Global')();
        _.bindAll(this, 'execLogin', 'passwordKeydown', 'loginError');

        this.el.setAttribute('BDragSource', '0');
        this.el.setAttribute('BDropTarget', '0');
        this.el.setAttribute('BDragHoldTarget', '0');

        var _this = this;
        this.$message = $('.message', this.$el);
        $('.login', this.$el).click(this.execLogin);

        this.$passwordInput = $('.password > input', this.$el);
        this.$usernameInput = $('.username > input', this.$el);

        this.$passwordInput.bind('keydown', this.passwordKeydown);
    },

    passwordKeydown: function(e) {
        if (e.keyCode == 13) {
            this.execLogin();
        }
        else if (e.keyCode == 27) {
            this.$passwordInput.val('');
        }
    },

    render: function() {
        return this;
    },

    execLogin: function() {
        var username = this.$usernameInput.val(),
            password = this.$passwordInput.val();

        this.G.trigger('AuthenticateCredentials', username, password, this.loginError);
    },

    loginError: function(message) {
        this.$message.text('Login error');
        console.log('Login error: ' + message);
    },

    show: function(options) {
        options = options || {};
        var username = options.username || null;

        this.$el.show();
        this.$passwordInput.val('');

        if (username) {
            this.$usernameInput
                .val(username)
                .attr('disabled', '1');
        }
    },

    hide: function() {
        this.$el.hide();
    }
});
_.extend(LoginView.prototype, Backbone.Events)

module.exports = LoginView;