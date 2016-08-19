var $ = require('jquery'),
    Backbone = require('backbone'),
    _ = require('underscore'),
    moment = require('app/lib/moment');

var SurfaceView = require('app/cluster/SurfaceView'),
    AttributeModeView = require('app/cluster/AttributeModeView');

var BooleanView_View = AttributeModeView.extend({
    className: 'boolean-mode-view',
    name: 'View',

    initialize: function(options) {
        AttributeModeView.prototype.initialize.call(this, options);
 
        this.$layout = $('<div><br><span class="label"></span></div>')
                            .appendTo(this.$el);
        this.$label = $('.label', this.$layout);
    },

    render: function(options) {
        AttributeModeView.prototype.render.call(this, options);

        var label = this.surfaceView.contextModel.get('Label');
        this.$label.text(label);

        /*if (this.surfaceView.getValue() === true) {
            this.$el.css({
                'border': '0.2em solid #888',
                'border-style': 'outset'
            });
        }
        else {
            this.$el.css({
                'border': '0.2em solid #888',
                'border-style': 'inset'
            });
        }*/

        return this;
    }
});


var BooleanView = SurfaceView.extend({
    className: 'boolean-view',

    modeClasses: {
        'View': BooleanView_View,
    },

    initialize: function(options) {
        options.displayMode = 'View';
        SurfaceView.prototype.initialize.call(this, options);
    },

    toggleValue: function() {
        this.newValue = !this.getValue();
        this.render();

        return this.newValue;
    },

    getValue: function() {
        if (!_.isUndefined(this.newValue)) {
            return this.newValue;
        }
        else {
            return this.contextModel.get('Value');
        }
    }
});

module.exports = BooleanView;