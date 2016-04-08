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
    moment = require('app/lib/moment');

window.$ = window.jQuery = $;

var NumericInput = require('app/views/NumericInput');
// -------------

$(function() {

(function(window, document) {

var BenomeEntry = function() {

};

_.extend(BenomeEntry.prototype, {
    isMobile: ('ontouchstart' in document.documentElement),
    isAndroid: (/android/i.test(navigator.userAgent)),
    isApple: (/iphone|ipod|ipad/i.test(navigator.userAgent)),
    isMac: (/Macintosh/.test(navigator.userAgent)),
    isTablet: (/ipad/i.test(navigator.userAgent) || ((/android/i.test(navigator.userAgent)) && !(/mobile/i.test(navigator.userAgent)))),

    init: function(options) {
        options = options || {};
        //_.bindAll(this, 'getData');

        this.$container = $('body');
        window.E = this;

		//this.$container.click(this.handleClick);
		//this.$container.mousemove(this.handleMouseMove);
		
		/*this.$container.mousedown(this.handleMouseDown);
		this.$container.mouseup(this.handleMouseUp);*/

		// Delay resize until there is a pause
	    /*this.handleResize = _.debounce(this.handleResize, 100);
	    $(window).bind('resize', this.handleResize);*/

		var numericInput = new NumericInput({
			el: $('#numeric-input')
		});
		numericInput.render();

		/*$('.save-button').click(numericInput.handleSave);
		$('.clear-button').click(numericInput.handleClear);*/

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

var benomeEntry = new BenomeEntry();
benomeEntry.init();

}(window, document));

});