var $ = require('jquery'),
    Backbone = require('backbone'),
    _ = require('underscore'),
    moment = require('app/lib/moment');

var SurfaceView = require('app/cluster/SurfaceView'),
    AttributeModeView = require('app/cluster/AttributeModeView'),
    NumericInput = require('app/views/NumericInput');

var Numeric_View = AttributeModeView.extend({
    tagName: 'div',
    className: 'attribute-numeric-mode-view',

    events: {
        //'click': ''
    },

    name: 'View',

    initialize: function(options) {
        AttributeModeView.prototype.initialize.call(this, options);

        this.$layout = $('<div><br><span class="label"></span><br><span class="num-value"></span></div>')
                            .appendTo(this.$el);
        this.$numVal = $('.num-value', this.$layout);
        this.$label = $('.label', this.$layout);
    },

    render: function(options) {
        AttributeModeView.prototype.render.call(this, options);

        this.$label.text(this.surfaceView.contextModel.get('Label') || '');
        this.$numVal.text(this.surfaceView.getValue() || 0);
        return this;
    }
});

var Numeric_Edit = AttributeModeView.extend({
    tagName: 'div',
    className: 'attribute-numeric-mode-edit',

    events: {
        //'click': ''
    },

    name: 'Edit',

    initialize: function(options) {
        AttributeModeView.prototype.initialize.call(this, options);

        this.numericInput = new NumericInput({
            value: this.surfaceView.getValue(),
            valueToHistory: true, // ensures the focus
            minValue: 1,
            points: [
                 {
                    val: 10,
                    ts: Date.now() / 1000
                },
                {
                    val: 20,
                    ts: Date.now() / 1000
                }
            ]
        });
        this.numericInput.on('ValueChanged', this.surfaceView.valueChanged);
        this.numericInput.$el.appendTo(this.$el);
    },

    render: function(options) {
        AttributeModeView.prototype.render.call(this, options);

        this.numericInput.render({
            width: this.regionWidth,
            height: this.regionHeight,
            widthPct: 1.0,
            scrollWidth: this.G.fontSize,
            focusValue: this.surfaceView.getValue()
        });
        return this;
    }
});

var Numeric = SurfaceView.extend({
    tagName: 'div',
    className: 'attribute-view-numeric',

    events: {
        //'click': ''
    },

    modeClasses: {
        'View': Numeric_View,
        'Edit': Numeric_Edit
    },

    initialize: function(options) {
        SurfaceView.prototype.initialize.call(this, options);
    },

    getValue: function() {
        if (_.isNumber(this.newValue)) {
            return this.newValue;
        }
        else {
            return this.contextModel.get('Value');
        }
    }
});

module.exports = Numeric;
