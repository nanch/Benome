var $ = require('jquery'),
    Backbone = require('backbone'),
    _ = require('backbone/node_modules/underscore'),
    moment = require('app/lib/moment');

var SurfaceView = require('app/cluster/SurfaceView'),
    AttributeModeView = require('app/cluster/AttributeModeView'),
    IntervalHandles = require('app/views/IntervalHandles');

var Interval_View = AttributeModeView.extend({
    tagName: 'div',
    className: 'attribute-interval-mode-view',

    events: {
        //'click': ''
    },

    name: 'View',

    initialize: function(options) {
        AttributeModeView.prototype.initialize.call(this, options);

        this.$el.append('<div><br><span class="timeval"></span></div>');
        this.$timeVal = $('.timeval', this.$el);
    },

    render: function(options) {
        AttributeModeView.prototype.render.call(this, options);

        var currentValue = this.surfaceView.getValue(),
            timeText = 'Time';

        if (currentValue) {
            timeText = moment(currentValue['Time'] * 1000).format('MMM D h:mma');
        }

        this.$timeVal.text(timeText);
        return this;
    }
});

var Interval_Edit = AttributeModeView.extend({
    tagName: 'div',
    className: 'attribute-interval-mode-edit',

    events: {
        //'click': ''
    },

    name: 'Edit',

    initialize: function(options) {
        AttributeModeView.prototype.initialize.call(this, options);

        var value = this.surfaceView.getValue();
        this.intervalInput = new IntervalHandles({
            G: this.G,
            beginTime: value['Time'],
            duration: value['Duration']
        });
        this.intervalInput.on('ValueChanged', this.surfaceView.valueChanged);
        this.$el.append(this.intervalInput.$el);
    },

    render: function(options) {
        AttributeModeView.prototype.render.call(this, options);

        this.intervalInput.render({
            width: this.regionWidth,
            height: this.regionHeight
        });
        return this;
    },

    getValue: function() {
        return this.intervalInput.getValue();
    }
});

var Interval = SurfaceView.extend({
    tagName: 'div',
    className: 'attribute-view-interval',

    events: {
        //'click': ''
    },

    modeClasses: {
        'View': Interval_View,
        'Edit': Interval_Edit
    },

    initialize: function(options) {
        SurfaceView.prototype.initialize.call(this, options);
    },

    getValue: function() {
        if (this.newValue) {
            return this.newValue;
        }
        else {
            var value = this.contextModel.get('Value') || {};
            return {
                'Time': value['Time'],
                'Duration': value['Duration']
            }
        }
    }
});

module.exports = Interval;