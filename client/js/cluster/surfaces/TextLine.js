var $ = require('jquery'),
    Backbone = require('backbone'),
    _ = require('underscore'),
    moment = require('moment');

var SurfaceView = require('app/cluster/SurfaceView'),
    AttributeModeView = require('app/cluster/AttributeModeView');

var TextLine_View = AttributeModeView.extend({
    tagName: 'div',
    className: 'attribute-textline-mode-view',

    events: {
        //'click': ''
    },

    name: 'View',

    initialize: function(options) {
        AttributeModeView.prototype.initialize.call(this, options);
    },

    render: function(options) {
        AttributeModeView.prototype.render.call(this, options);

        var value = this.surfaceView.getValue() || this.surfaceView.getLabel();
        this.$el.html('<br>' + value);
        return this;
    }
});

var TextLine_Edit = AttributeModeView.extend({
    tagName: 'div',
    className: 'attribute-textline-mode-edit',

    events: {
        //'click': ''
    },

    name: 'Edit',

    initialize: function(options) {
        AttributeModeView.prototype.initialize.call(this, options);
        _.bindAll(this, 'textChanged', 'onKeydown');

        this.lastVal = this.surfaceView.getValue();
        this.originalVal = this.lastVal;

        this.$textInput = $('<input type="text">')
                .addClass('attribute-text-input')
                .on('change', this.textChanged)
                .bind('keydown', this.onKeydown)
                .appendTo(this.$el);
    },

    onKeydown: function(e) {
        if (e.keyCode == 13 || e.keyCode == 27) {
            if (e.keyCode == 13) {
                this.surfaceView.valueChanged(this.$textInput.val());
            }
            else if (e.keyCode == 27) {
                this.$textInput.val(this.lastVal);
            }

            this.surfaceView.clusterController.cluster.focusParent(null, true);
        }
    },

    textChanged: function(e) {
        this.lastVal = this.$textInput.val();
        this.surfaceView.valueChanged(this.lastVal);
    },

    render: function(options) {
        AttributeModeView.prototype.render.call(this, options);

        var val = this.surfaceView.getValue();
        this.$textInput.val(val);

        var _this = this;
        _.delay(function() {
            _this.$textInput.focus();
        }, 200);
        return this;
    },

    getValue: function() {
        return this.$textInput.val();
    }
});

var TextLine = SurfaceView.extend({
    className: 'attribute-view-textline',

    modeClasses: {
        'View': TextLine_View,
        'Edit': TextLine_Edit
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

module.exports = TextLine;