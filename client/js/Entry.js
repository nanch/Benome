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
    _ = require('backbone/node_modules/underscore'),
    Backbone = require('backbone'),
    moment = require('app/lib/moment'),
    BackboneDualStorage = require('app/lib/backbone.dualstorage.amd');

window._ = _;
window.$ = window.jQuery = $;

// -------------
var BenomeView = require('app/Benome');

$(function() {

(function(window, document) {

var BenomeEntry = function() {};

_.extend(BenomeEntry.prototype, {
    isMobile: ('ontouchstart' in document.documentElement),
    isAndroid: (/android/i.test(navigator.userAgent)),
    isApple: (/iphone|ipod|ipad/i.test(navigator.userAgent)),
    isMac: (/Macintosh/.test(navigator.userAgent)),
    isTablet: (/ipad/i.test(navigator.userAgent) || ((/android/i.test(navigator.userAgent)) && !(/mobile/i.test(navigator.userAgent)))),

    init: function(options) {
        options = options || {};

        var $container = options.container ? $(options.container) : $('body');
        $container.addClass('benome-container');
        this.$container = $container

        var instanceID = options.instanceID || parseInt((Math.random() * 1000000) + 100000).toString();

        var hideLabels = options.hideLabels,
            labelIDsOnly = this.QueryString.i === '1',
            clusterOnly = options.clusterOnly,
            autoActionDelay = parseInt(this.QueryString.aa) || null,
            visualQuality = 1,
            backgroundColor = 'light',
            globalAppOnly = options.globalAppOnly,
            clusterFilterShift = null;

        // QueryString overrides passed parameters
        // The underlying data must be scrubbed for actual privacy
        if (this.QueryString.gao) {
            globalAppOnly = this.QueryString.gao === '1';
        }

        if (this.QueryString.vq) {
            visualQuality = parseInt(this.QueryString.vq) || 0;
        }

        if (this.QueryString.bg) {
            if (this.QueryString.bg in {'dark': 1, 'white': 1}) {
                backgroundColor = this.QueryString.bg;
            }
        }

        if (this.QueryString.c) {
            clusterOnly = this.QueryString.c === '1';
        }

        if (this.QueryString.p) {
            hideLabels = this.QueryString.p === '1';
        }

        if (this.QueryString.cfs) {
            clusterFilterShift = this.QueryString.cfs === '1';
        }

        var defaultFilter = 0;
        if (parseInt(this.QueryString.d) >= 1) {
            defaultFilter = Math.min(10, parseInt(this.QueryString.d)) - 1;
        }

        var viewOptions = _.extend(options, {
            container: this.$container,
            defaultFilter: defaultFilter,
            autoActionDelay: autoActionDelay,
            visualQuality: visualQuality,
            bgColor: backgroundColor,
            globalAppOnly: globalAppOnly,
            instanceID: instanceID,
            localOnly: options.localOnly,
            clusterOnly: clusterOnly,
            hideLabels: hideLabels,
            enabledApps: options.enabledApps,
            continuousTiming: options.continuousTiming,
            clusterFilterShift: clusterFilterShift
        });
        
        var benomeBase = new BenomeView(viewOptions);
        $container.append(benomeBase.$el);
        benomeBase.postAttach();

        this.base = benomeBase;
        this.base.load();
    },

    QueryString: function() {
        var queryString = {};
        var query = window.location.search.substring(1);
        var vars = query.split('&');

        for (var i = 0; i < vars.length; i++) {
            var pair = vars[i].split('='),
                first = pair[0],
                second = pair[1];

            if (typeof queryString[first] === 'undefined') {
                queryString[first] = second;
            }
            else if (typeof queryString[first] === 'string') {
                queryString[first] = [queryString[first], second];
            }
            else {
                queryString[first].push(second);
            }
        } 
        return queryString;
    }()
});

window.BENOME = BenomeEntry;

}(window, document));

});