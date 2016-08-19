var $ = require('jquery'),
    Backbone = require('backbone'),
    _ = require('underscore'),
    moment = require('app/lib/moment');

var SurfaceView = require('app/cluster/SurfaceView'),
    AttributeModeView = require('app/cluster/AttributeModeView');

var ClusterContainer_View = AttributeModeView.extend({
    className: 'cluster-container-mode-view',
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

var ClusterContainer_Edit = AttributeModeView.extend({
    className: 'cluster-container-mode-edit',
    name: 'Edit',

    initialize: function(options) {
        this.G = this.G || options.G || require('app/Global')();
        _.bindAll(this, 'onClusterChange');
        AttributeModeView.prototype.initialize.call(this, options);

        this.$el.css({
            'pointer-events': 'auto'
        });
    },

    render: function(options, clusterDef) {
        AttributeModeView.prototype.render.call(this, options);

        if (!this.clusterRendered) {
            this.renderCluster(clusterDef);
            this.clusterRendered = true;
        }

        return this;
    },

    renderCluster: function(clusterDef) {
        clusterDef = clusterDef || this.surfaceView.contextModel.get('Def');
        var clusterValues = this.surfaceView.contextModel.get('Value');

        // Ensure the cluster ends up attached here
        clusterDef.Container = this.$el;
        clusterDef.Render = true;
        clusterDef.Value = clusterValues;
        clusterDef.ParentCluster = this.surfaceView.baseView.cluster;

        // Pass in the currently computed dimensions
        clusterDef.Options.containerWidth = this.regionWidth;
        clusterDef.Options.containerHeight = this.regionHeight;
        clusterDef.Options.radiusScaleFactor = 0.65;

        // Also attach to or override appropriate events
        clusterDef.EventHandlers.onValueChange = this.onClusterChange;

        this.cluster = this.G.renderStructure(clusterDef);
        this.surfaceView.cluster = this.cluster;
    },

    onClusterChange: function() {
        var newValue = this.cluster.getValues();
        this.trigger('ValueChanged', newValue);
    }
});

var ClusterContainer = SurfaceView.extend({
    tagName: 'div',
    className: 'cluster-container-view',

    events: {
        //'click': ''
    },

    modeClasses: {
        'View': ClusterContainer_View,
        'Edit': ClusterContainer_Edit
    },

    initialize: function(options) {
        SurfaceView.prototype.initialize.call(this, options);
    },

    getValue: function() {
        if (!_.isNull(this.newValue) && !_.isUndefined(this.newValue)) {
            return this.newValue;
        }
        else {
            return this.contextModel.get('Value');
        }
    }
});

module.exports = ClusterContainer;
