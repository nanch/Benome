var $ = require('jquery'),
    Backbone = require('backbone'),
    _ = require('underscore'),
    moment = require('app/lib/moment');

var SurfaceView = require('app/cluster/SurfaceView'),
    AttributeModeView = require('app/cluster/AttributeModeView');

var Frequency_Edit = AttributeModeView.extend({
    tagName: 'div',
    className: 'frequency-mode-edit',

    events: {
        //'click': ''
    },

    name: 'Edit',

    initialize: function(options) {
        _.bindAll(this, 'increaseFrequency', 'decreaseFrequency');

        AttributeModeView.prototype.initialize.call(this, options);
 
        this.$layout = $('<div class="frequency-modify"><div class="frequency-increase"></div><div class="current-frequency"></div><div class="frequency-decrease"></div></div>')
                            .appendTo(this.$el);
        
        $('.frequency-increase', this.$layout).click(this.increaseFrequency);
        $('.frequency-decrease', this.$layout).click(this.decreaseFrequency);

        this.$currentFrequency = $('.current-frequency', this.$layout);
        this.targetFrequency = this.surfaceView.contextModel.get('Value');
        if (!this.targetFrequency) {
            // default to daily.
            this.targetFrequency = 86400;
        }
    },

    decreaseFrequency: function() {
        this.targetFrequency = this.G.Intervals.decrementInterval(this.targetFrequency);
        this.render();
    },

    increaseFrequency: function() {
        this.targetFrequency = this.G.Intervals.incrementInterval(this.targetFrequency);
        this.render();
    },

    render: function(options) {
        this.surfaceView.newValue = this.targetFrequency;

        AttributeModeView.prototype.render.call(this, options);
        this.$currentFrequency.text(this.G.Intervals.intervalToFriendly(this.targetFrequency));

        return this;
    },

    getValue: function() {
        return this.targetFrequency;
    }
});

var Frequency_View = AttributeModeView.extend({
    tagName: 'div',
    className: 'frequency-mode-view',

    events: {
        //'click': ''
    },

    name: 'View',

    initialize: function(options) {
        _.bindAll(this, 'render');
        AttributeModeView.prototype.initialize.call(this, options);
 
        this.$layout = $('<br><br><div class="current-frequency"></div>')
                            .appendTo(this.$el);
        
        this.$currentFrequency = $('.current-frequency', this.$el);
    },

    render: function(options) {
        AttributeModeView.prototype.render.call(this, options);
        var targetFrequency = this.surfaceView.newValue || this.surfaceView.contextModel.get('Value') || 86400;
        this.$currentFrequency.text(this.G.Intervals.intervalToFriendly(targetFrequency));

        return this;
    }
});


var Frequency = SurfaceView.extend({
    tagName: 'div',
    className: 'frequency-view',

    events: {
        //'click': ''
    },

    modeClasses: {
        'View': Frequency_View,
        'Edit': Frequency_Edit
    },

    initialize: function(options) {
        SurfaceView.prototype.initialize.call(this, options);

        // this.tempValue = null;
    },

    getValue: function() {
        if (this.newValue) {
            return this.newValue;
        }
        else {
            return this.contextModel.get('Value');
        }
    }
});

module.exports = Frequency;