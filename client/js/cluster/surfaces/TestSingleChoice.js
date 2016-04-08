var $ = require('jquery'),
    Backbone = require('backbone'),
    _ = require('backbone/node_modules/underscore'),
    moment = require('app/lib/moment');

var BenomeGlobal = require('app/Global'),
    SurfaceView = require('app/cluster/SurfaceView'),
    AttributeModeView = require('app/cluster/AttributeModeView'),
    SingleChoice = require('app/cluster/surfaces/SingleChoice'),
    SingleChoice_Edit = SingleChoice.prototype.modeClasses['Edit'];

var TestSingleChoice_Edit = SingleChoice_Edit.extend({
    initialize: function(options) {
        SingleChoice_Edit.prototype.initialize.call(this, options);
        _.bindAll(this, 'onViewClick', 'layerReady', 'onClusterLongPress');
    },

    showChoiceCluster: function($container) {
        SingleChoice_Edit.prototype.showChoiceCluster.call(this, $container);

        this.choiceCluster.cluster.on('ActivityClicked', this.onViewClick);
    },

    onViewClick: function(e, view) {
        BenomeGlobal.trigger('PushLayer', this.surfaceView.baseView.cluster.currentZIndex + 1, this.layerReady);
    },

    layerReady: function($layer) {
        this.$detailLayer = $layer;
        var clusterAttributes = [],
            attributeChoice = this.getValue();

        if (attributeChoice == 'SingleChoice') {
            clusterAttributes = [
                {
                    'ID': 'SingleChoiceConstructor1',
                    'Label': 'Choices',
                    'Type': 'SingleChoiceConstructor'
                }
            ];
        }
        else if (attributeChoice == 'Text') {
            clusterAttributes = [
                {
                    'ID': 'DefaultText',
                    'Label': 'Default text',
                    'Type': 'Text'
                },
                {
                    'ID': 'MaxLength',
                    'Label': 'Maximum text length',
                    'Type': 'Numeric'
                }
            ];
        }
        else if (attributeChoice == 'Numeric') {
            clusterAttributes = [
                {
                    'ID': 'DefaultValue',
                    'Label': 'Default value',
                    'Type': 'Numeric'
                },
                {
                    'ID': 'MaxValue',
                    'Label': 'Max value',
                    'Type': 'Numeric'
                },
                {
                    'ID': 'MinValue',
                    'Label': 'Min value',
                    'Type': 'Numeric'
                },
                {
                    'ID': 'Increment',
                    'Label': 'Increment',
                    'Type': 'Numeric'
                }
            ];
        }

        var sourceData = {
            'Time': Date.now() / 1000,
            'Duration': 1500,
            'Points': 50,
            'Text': 'Some text here',
            'Choice': 66
        };

        var AttributeCluster = require('app/cluster/AttributeCluster');
        this.detailCluster = new AttributeCluster($layer, clusterAttributes, sourceData, {}, attributeChoice);
        this.detailCluster.render();

        this.detailCluster.on('LongPress', this.onClusterLongPress);
    },

    onClusterLongPress: function(e, view) {
        BenomeGlobal.trigger('PopLayer');
    }
});

var TestSingleChoice = SingleChoice.extend({
    initialize: function(options) {
        SingleChoice.prototype.initialize.call(this, options);
        this.modeClasses['Edit'] = TestSingleChoice_Edit;
    }
});

module.exports = TestSingleChoice;