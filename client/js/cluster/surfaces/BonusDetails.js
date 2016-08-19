var $ = require('jquery'),
    Backbone = require('backbone'),
    _ = require('underscore'),
    moment = require('app/lib/moment');

var SurfaceView = require('app/cluster/SurfaceView'),
    AttributeModeView = require('app/cluster/AttributeModeView');

var BonusDetails_View = AttributeModeView.extend({
    tagName: 'div',
    className: 'bonus-details-mode-view',

    events: {
        //'click': ''
    },

    name: 'View',

    initialize: function(options) {
        AttributeModeView.prototype.initialize.call(this, options);

        var label = this.surfaceView.contextModel.get('Label');
        this.$layout = $('<div><br><span class="label">' + label + '</span></div>')
                            .appendTo(this.$el);
        this.$label = $('.label', this.$layout);
    },

    render: function(options) {
        AttributeModeView.prototype.render.call(this, options);
        return this;
    }
});

var BonusDetails_Edit = AttributeModeView.extend({
    tagName: 'div',
    className: 'bonus-details-mode-edit',

    events: {
        //'click': ''
    },

    name: 'Edit',

    initialize: function(options) {
        AttributeModeView.prototype.initialize.call(this, options);

        this.$el.css({
            'pointer-events': 'auto'
        });
    },

    render: function(options) {
        AttributeModeView.prototype.render.call(this, options);

        if (!this.clusterRendered) {
            this.showAttributeCluster(this.$el);
            this.clusterRendered = true;
        }

        return this;
    },

    showAttributeCluster: function($container) {
        var AttributeCluster = require('app/cluster/AttributeCluster');
        var attributes = [
            {
                'ID': 'Multiplier',
                'Label': 'Multiplier',
                'Type': 'Numeric'
            },
            {
                'ID': 'MultiplySum',
                'Label': 'Apply to sum',
                'Type': 'Boolean'
            },
            {
                'ID': 'BonusName',
                'Label': 'Name',
                'Type': 'Text'
            },
            {
                'ID': 'BonusText',
                'Label': 'Details',
                'Type': 'Text'
            }
        ];
        this.attributeCluster = new AttributeCluster($container, attributes, {}, {
                moveDisabled: true,
                dragDisabled: true,
                containerWidth: this.regionWidth,
                containerHeight: this.regionHeight
            }, 'Bonus details');
        this.attributeCluster.render();
    },

    getValue: function() {
        return this.newValue;
    }
});

var BonusDetails = SurfaceView.extend({
    tagName: 'div',
    className: 'bonus-details',

    events: {
        //'click': ''
    },

    modeClasses: {
        'View': BonusDetails_View,
        'Edit': BonusDetails_Edit
    },

    initialize: function(options) {
        SurfaceView.prototype.initialize.call(this, options);
    },

    getValue: function() {
        if (!_.isNull(this.newValue) && !_.isUndefined(this.newValue)) {
            return this.newValue;
        }
        else {
            return this.sourceData['Value'];
        }
    }
});

module.exports = BonusDetails;
