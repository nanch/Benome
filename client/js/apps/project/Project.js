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
    Backbone = require('backbone');

// Inherit from general App class
// Encapsulate custom UI and logic to be applied when necessary

function ProjectApp(appID, options) {
	options = options || {};
	this.G = this.G || options.G || require('app/Global')();
	this.name = 'Project';
	this.appID = appID;

	// Define set of attributes
	this.initPointAttributes();
}
_.extend(ProjectApp.prototype, {
	postInit: function() {

	},
	
	initPointAttributes: function() {
		this.pointAttributes = {};

		this.contextAttributes = {
	        'Scale': {
	            AttrID: 'Scale',
	            Label: 'Scale',
	            Type: 'Numeric',
	            Def: {}
	        },
	        'Completed': {
	            AttrID: 'Completed',
	            Label: 'Completed',
	            Type: 'Numeric',
	            Def: {}
	        }
		};
	},

	getPointAttributeDefs: function() {
		var attributeDefs = [];
		_.each(this.pointAttributes, function(attrDef, attrID) {
			var attrDef = $.extend(true, {}, attrDef);
			attributeDefs.push(attrDef);
		}, this);

		return attributeDefs;
	},

	getContextAttributeDefs: function() {
		var attributeDefs = [];
		_.each(this.contextAttributes, function(attrDef, attrID) {
			var attrDef = $.extend(true, {}, attrDef);
			attributeDefs.push(attrDef);
		}, this);

		return attributeDefs;
	},

	getPointEventHandlers: function() {
		return {};
	},

	getContextEventHandlers: function() {
		return {};
	},

	surfaceRender: function(cluster, clusterMode, surfaceView, surfaceModeView, options) {
		return;
	}
});

module.exports = ProjectApp;