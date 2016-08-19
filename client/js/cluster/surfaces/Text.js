var $ = require('jquery'),
    Backbone = require('backbone'),
    _ = require('underscore'),
    moment = require('app/lib/moment');

var SurfaceView = require('app/cluster/SurfaceView'),
    AttributeModeView = require('app/cluster/AttributeModeView');

var Text_View = AttributeModeView.extend({
    tagName: 'div',
    className: 'attribute-text-mode-view',

    events: {
        //'click': ''
    },

    name: 'View',

    initialize: function(options) {
        AttributeModeView.prototype.initialize.call(this, options);
    },

    render: function(options) {
        AttributeModeView.prototype.render.call(this, options);

        this.$el.html(this.surfaceView.getValue() || ('<br>' + this.surfaceView.getLabel()));
        return this;
    }
});

var Text_Edit = AttributeModeView.extend({
    tagName: 'div',
    className: 'attribute-text-mode-edit',

    events: {
        //'click': ''
    },

    name: 'Edit',

    initialize: function(options) {
        AttributeModeView.prototype.initialize.call(this, options);
        _.bindAll(this, 'textChanged');

        this.$textArea = $('<textarea>')
                .addClass('attribute-text-textarea')
                .appendTo(this.$el);

        this.$textArea
            .val(this.getValue())
            .on('change', this.textChanged);
    },

    textChanged: function(e) {
        this.surfaceView.valueChanged(this.$textArea.val());
    },

    render: function(options) {
        AttributeModeView.prototype.render.call(this, options);

        this.$textArea.val(this.surfaceView.getValue());

        var _this = this;
        _.delay(function() {
            _this.$textArea.focus();
        }, 200);
        
        return this;
    },

    getValue: function() {
        return this.$textArea.val();
    }
});

var Text = SurfaceView.extend({
    className: 'attribute-view-text',

    modeClasses: {
        'View': Text_View,
        'Edit': Text_Edit
    },

    initialize: function(options) {
        SurfaceView.prototype.initialize.call(this, options);
    },

    getLabel: function() {
        return this.contextModel.get('Label') || '';
    },

    getValue: function() {
        if (this.newValue) {
            return this.newValue;
        }
        else {
            return this.contextModel.get('Value') || '';
        }
    }
});

module.exports = Text;