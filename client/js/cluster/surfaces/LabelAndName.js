var $ = require('jquery'),
    Backbone = require('backbone'),
    _ = require('underscore'),
    moment = require('moment');

var SurfaceView = require('app/cluster/SurfaceView'),
    AttributeModeView = require('app/cluster/AttributeModeView');

var LabelAndName_View = AttributeModeView.extend({
    tagName: 'div',
    className: 'label-name-mode-view',

    events: {
        //'click': ''
    },

    name: 'View',

    initialize: function(options) {
        AttributeModeView.prototype.initialize.call(this, options);
 
        var label = this.surfaceView.contextModel.get('Label');
        this.$layout = $('<div><br><span class="label">' + label + '</span><br><br><input type="text" placeholder="Name"></input></div>').appendTo(this.$el);
        this.$nameInput = $('input', this.$layout)
                            .css({
                                'pointer-events': 'auto'
                            });
    },

    render: function(options) {
        AttributeModeView.prototype.render.call(this, options);
        this.surfaceView.baseView.$el.removeClass('exclusive');
        return this;
    },

    getValue: function() {
        return this.$nameInput.val();
    }
});


var LabelAndName = SurfaceView.extend({
    tagName: 'div',
    className: 'label-name-view',

    events: {
        //'click': ''
    },

    modeClasses: {
        'View': LabelAndName_View,
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

module.exports = LabelAndName;