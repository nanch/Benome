var $ = require('jquery'),
    Backbone = require('backbone'),
    _ = require('underscore'),
    moment = require('app/lib/moment');

var SurfaceView = require('app/cluster/SurfaceView'),
    AttributeModeView = require('app/cluster/AttributeModeView');

// TestView
var TestView_View = AttributeModeView.extend({
    tagName: 'div',
    className: 'test-mode-view',

    events: {
        //'click': ''
    },

    name: 'View',

    initialize: function(options) {
        AttributeModeView.prototype.initialize.call(this, options);
    },

    render: function(options) {
        AttributeModeView.prototype.render.call(this, options);
        this.surfaceView.baseView.$el.removeClass('exclusive');
        return this;
    }
});

var TestView_Edit = AttributeModeView.extend({
    tagName: 'div',
    className: 'test-mode-edit',

    events: {
        //'click': ''
    },

    name: 'Edit',

    initialize: function(options) {
        AttributeModeView.prototype.initialize.call(this, options);
    },

    render: function(options) {
        AttributeModeView.prototype.render.call(this, options);
        this.surfaceView.baseView.$el.removeClass('exclusive');
        return this;
    },

    getValue: function() {
    }
});


var TestView_Exclusive = AttributeModeView.extend({
    tagName: 'div',
    className: 'test-mode-exclusive',

    events: {
        //'click': ''
    },

    name: 'Exclusive',

    initialize: function(options) {
        AttributeModeView.prototype.initialize.call(this, options);

        /*//this.$el.css({
        
        css({
            'background-color': 'black',
            'border': '0.1em solid red'
        });*/
    },

    render: function(options) {
        AttributeModeView.prototype.render.call(this, options);
        this.surfaceView.baseView.$el.addClass('exclusive');
        return this;
    },

    getValue: function() {
    }
});

var TestView = SurfaceView.extend({
    tagName: 'div',
    className: 'test-view',

    events: {
        //'click': ''
    },

    modeClasses: {
        'View': TestView_View,
        'Edit': TestView_Edit,
        'Exclusive': TestView_Exclusive
    },

    initialize: function(options) {
        SurfaceView.prototype.initialize.call(this, options);
    },

    getValue: function() {
        if (this.newValue) {
            return this.newValue;
        }
        else {
            return {
            }
        }
    }
});

module.exports = TestView;
