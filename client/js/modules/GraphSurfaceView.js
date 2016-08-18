var $ = require('jquery'),
    Backbone = require('backbone'),
    _ = require('backbone/node_modules/underscore'),
    Hammer = require('hammerjs');

// Classes
var SurfaceView = require('app/modules/SurfaceView'),
    AttributeModeView = require('app/modules/AttributeModeView'),
    SurfaceModeView = AttributeModeView,
    StreamGraphD3_Class = require('app/modules/StreamGraphD3');

var GraphSurface_View = SurfaceModeView.extend({
    tagName: 'div',
    className: 'graph-mode-view',

    events: {},

    name: 'View',

    initialize: function(options) {
        _.bindAll(this, 'updateLabel');
        SurfaceModeView.prototype.initialize.call(this, options);
        this.surfaceView.on('LabelChanged', this.updateLabel);

        this.$el
            .html('<span class="label"></span>');

        this.$backgroundImage = $('<canvas>')
                                    .css({
                                        'position': 'absolute',
                                        'z-index': '-5',
                                        'width': '100%',
                                        'height': '50%',
                                        'top': '25%',
                                        'left': 0
                                    })
                                    .appendTo(this.$el);

        this.$label = $('.label', this.$el);
        this.streamGraph = new StreamGraphD3_Class();
    },

    render: function(options) {
        options = options || {};
        SurfaceModeView.prototype.render.call(this, options);
        this.updateLabel();

        var surfaceModeView = this,
            regionWidth = surfaceModeView.regionWidth,
            regionHeight = surfaceModeView.regionHeight,

            graphWidth = options.graphWidth || regionWidth,
            graphHeight = options.graphHeight || regionHeight;

        var $graphEl = this.$backgroundImage;

        if (this.surfaceView.viewState.depth <= 2) {
            var data = this.getData();
            if (data) {
                $graphEl.show();

                this.streamGraph.render({
                    data: data,
                    outputType: 'Canvas',
                    destEl: $graphEl.get()[0],
                    width: graphWidth, //$backgroundImage.width(),
                    height: graphHeight, //$backgroundImage.height(),
                    antiAlias: true,
                }, function(canvas, yMax, yTotal) {});
            }
            else {
                $graphEl.hide();
            }
        }
        else {
            $graphEl.hide();
        }

        return this;
    },

    getData: function() {
        var context = this.surfaceView.contextModel,
            downAssocModels = context.getAssocModels('down');

        if (downAssocModels.length == 0) {
            downAssocModels = [
                context
            ];
        }

        var layers = _.map(downAssocModels, function(assocModel) {
            var data = assocModel.aggregateGraphData;
            if (data && data.length) {
                return {
                    'Data': assocModel.aggregateGraphData,
                    'Color': this.surfaceView.baseView.cluster.getColor(assocModel.id, true, 0.65, true)
                }
            }
        }, this);

        return layers;
    },

    updateLabel: function() {
        var label = '';
        if (!this.hideLabels) {
            label = this.surfaceView.contextModel.getNS('Label');
        }
        this.$label.html(label);
    },

    dataReactive: function() {
        return true;
    }
});

var GraphSurface = SurfaceView.extend({
    tagName: 'div',
    className: 'graph-surface',

    events: {
        //'click': ''
    },

    modeClasses: {
        'View': GraphSurface_View
    },

    initialize: function(options) {
        SurfaceView.prototype.initialize.call(this, options);

        var _this = this;
        function onLabelChange() {
            _this.trigger('LabelChanged');
        }
        this.contextModel.on('change:1__Label', onLabelChange);
    },

    dataReactive: function() {
        return this.getModeView().dataReactive();
    },

    getValue: function() {
        if (_.isNumber(this.newValue)) {
            return this.newValue;
        }
        else {
            return this.contextModel.get('Value') || 0;
        }
    },

    setExtra: function(extra) {}
});

module.exports = GraphSurface;
