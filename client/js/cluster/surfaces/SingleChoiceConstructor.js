var $ = require('jquery'),
    Backbone = require('backbone'),
    _ = require('underscore'),
    moment = require('app/lib/moment');

var SurfaceView = require('app/cluster/SurfaceView'),
    AttributeModeView = require('app/cluster/AttributeModeView');

var SingleChoiceConstructor_View = AttributeModeView.extend({
    tagName: 'div',
    className: 'attribute-singlechoice-constructor-mode-view',

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

var SingleChoiceConstructor_Edit = AttributeModeView.extend({
    tagName: 'div',
    className: 'attribute-singlechoice-constructor-mode-edit',

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
            this.showConstructorCluster(this.$el);
            this.clusterRendered = true;
        }

        return this;
    },

    showConstructorCluster: function($container) {
        var ConstructorCluster = require('app/cluster/ConstructorCluster');
        this.choiceCluster = new ConstructorCluster($container, {
                radiusScaleFactor: 1.55,
                moveDisabled: true,
                dragDisabled: true,
                containerWidth: this.regionWidth,
                containerHeight: this.regionHeight
            },
            {
                'nodeType': 'AttributeOptions',
                'label': 'Option details',
                //'choiceValue': null,
                //'choiceID': 'AttributeChoice',
                'Type': 'SingleChoice',
                'Choices': [
                    {
                        'ID': 'Name',
                        'Value': '',
                        'Label': 'Name'
                    },
                    {
                        'ID': 'ID',
                        'Value': '',
                        'Label': 'ID'
                    },
                    {
                        'ID': 'Value',
                        'Value': '',
                        'Label': 'Value'
                    }
                ]
            });
        this.choiceCluster.render();
    },

    getValue: function() {
        return this.newValue;
    }
});

var SingleChoiceConstructor = SurfaceView.extend({
    tagName: 'div',
    className: 'attribute-view-singlechoice-constructor',

    events: {
        //'click': ''
    },

    modeClasses: {
        'View': SingleChoiceConstructor_View,
        'Edit': SingleChoiceConstructor_Edit
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

module.exports = SingleChoiceConstructor;
