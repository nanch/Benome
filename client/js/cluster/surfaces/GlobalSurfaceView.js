var $ = require('jquery'),
    Backbone = require('backbone'),
    _ = require('underscore'),
    Hammer = require('hammerjs');

var HistoryView = require('app/views/HistoryView'),
    SurfaceView = require('app/cluster/SurfaceView'),
    AttributeModeView = require('app/cluster/AttributeModeView'),
    SurfaceModeView = AttributeModeView;

var GlobalSurface_View = SurfaceModeView.extend({
    tagName: 'div',
    className: 'global-mode-view',

    events: {
        //'click': ''
    },

    name: 'View',

    initialize: function(options) {
        _.bindAll(this, 'updateLabel', 'onDetailMove', 'onDetailEnd');
        SurfaceModeView.prototype.initialize.call(this, options);
        this.surfaceView.on('LabelChanged', this.updateLabel);

        this.$el
            .css({
                'text-align': 'center'
            })
            .html('<br><span class="label"></span><br><span class="extra" style="text-align: center;"></span><div class="detail-indicator"></div>');

        this.$backgroundImage = $('<div>')
                                    .css({
                                        'position': 'absolute',
                                        'z-index': '-5',
                                        'width': '100%',
                                        'height': '100%',
                                        'opacity': '0.55',
                                        'top': 0,
                                        'left': 0
                                    })
                                    .appendTo(this.$el);

        this.$label = $('.label', this.$el);
        this.$detailIndicator = $('.detail-indicator', this.$el);
    },

    render: function(options) {
        SurfaceModeView.prototype.render.call(this, options);

        this.updateLabel();

        var cluster = this.surfaceView.clusterController.cluster;
        if (this.surfaceView.contextModel.id == cluster.rootID) {
            this.$backgroundImage.css({
                'opacity': '0.3'
            });
        }
        else {
            this.$backgroundImage.css({
                'opacity': '0.7'
            });
        }

        if (cluster.config.showDetailIndicator && _.isNull(this.surfaceView.viewState.parentID)) {
            this.initDetailIndicator();
            this.$detailIndicator.show();
        }
        else {
            this.$detailIndicator.hide();
        }
        this.setExtra(this.extra);

        var cluster = this.surfaceView.clusterController;
        this.G.renderAppSurface(cluster, cluster.clusterMode, this.surfaceView, this, options);

        return this;
    },

    updateLabel: function() {
        var label = '';
        if (!this.G.hideLabels) {
            label = this.surfaceView.contextModel.getNS('Label');
        }
        this.$label.html(label);
    },

    initDetailIndicator: function() {
        if (this.detailIndicatorInitialized) {
            return;
        }

        if (!this.G.FEATURE('DetailLevels')) {
            this.$detailIndicator.hide();
            this.detailIndicatorInitialized = true;
            return;
        }

        var width = (25 * (this.G.isMobile ? 1.75 : 1));
        this.$detailIndicator
            .data('noDrag', true)
            .attr('BDragSource', '0')
            .css({
                width: width + '%',
                height: (20 * (this.G.isMobile ? 1.75 : 1)) + '%',
                left: ((100 - width) / 2) + '%'
            });

        var mc = new Hammer(this.$detailIndicator.get()[0]);
        mc.get('pan').set({
            direction: Hammer.DIRECTION_ALL,
            threshold: 0
        });

        mc.on('panmove', this.onDetailMove);
        mc.on('pancancel panend', this.onDetailEnd);

        this.detailIndicatorInitialized = true;
    },

    onDetailMove: function(e) {
        this.G.trigger('UpdateClusterDetail', this.surfaceView.baseView.cluster, e);
    },

    onDetailEnd: function(e) {
        this.G.trigger('DoneClusterDetail', this.surfaceView.baseView.cluster);
    },

    setExtra: function(extra) {
        if (_.isNumber(extra)) {
            extra = extra + '';
        }
        else {
            extra = extra || '';
        }
        
        this.extra = extra
        $('.extra', this.$el)
            .html(this.extra);
    },

    dataReactive: function() {
        // FIXME: Should be handled by the app
        var cluster = this.surfaceView.clusterController.cluster;
        return this.surfaceView.contextModel.id == cluster.focusID;
    }
});

var GlobalSurface_Edit = SurfaceModeView.extend({
    tagName: 'div',
    className: 'global-mode-edit',

    events: {
        //'click': ''
    },

    name: 'Edit',

    initialize: function(options) {
        options = options || {};
        _.bindAll(this, 'updateLabel');
        SurfaceModeView.prototype.initialize.call(this, options);
        this.numDays = options.numDays || null;

        this.$backgroundImage = $('<div>')
                                    .css({
                                        'position': 'absolute',
                                        'z-index': '-5',
                                        'width': '100%',
                                        'height': '100%',
                                        'opacity': '0.55'
                                    })
                                    .appendTo(this.$el);

        if (!this.$label) {
            this.$label = $('<div>')
                                .css({
                                    'text-align': 'center',
                                    'z-index': '0',
                                })
                                .appendTo(this.$el);
        }

        this.surfaceView.on('LabelChanged', this.updateLabel);
    },

    updateLabel: function() {
        var label = '';
        if (!this.G.hideLabels) {
            label = this.surfaceView.contextModel.getNS('Label');
        }
        this.$label.html(label);
    },

    render: function(options) {
        options = options || {};
        SurfaceModeView.prototype.render.call(this, options);

        var cluster = this.surfaceView.clusterController;
        this.G.renderAppSurface(cluster, cluster.clusterMode, this.surfaceView, this, options);
        this.updateLabel();
        return this;
    },

    dataReactive: function() {
        return true;
    }
});

var GlobalSurface_Exclusive = SurfaceModeView.extend({
    tagName: 'div',
    className: 'global-mode-exclusive',

    events: {
        //'click': ''
    },

    name: 'Exclusive',

    initialize: function(options) {
        options = options || {};
        _.bindAll(this, 'updateLabel');
        SurfaceModeView.prototype.initialize.call(this, options);

        var fontSize = this.G.fontSize * 0.6;

        this.$label = $('<div>')
                            .css({
                                'position': 'absolute',
                                'top': '0',
                                'left': '15%',
                                'width': '70%',
                                'height': '1.3em',
                                'text-align': 'center',
                                'font-size': (fontSize * 1.5) + 'px',
                                'z-index': '2',
                            })
                            .appendTo(this.$el);

        this.historyView = new HistoryView({
            G: this.G,
            container: this.$el,
            hideLabels: this.G.hideLabels,
            dragHandler: this.G.commonPointDragHandler
        });
        this.historyView.$el.appendTo(this.$el);

        var _this = this;
        this.historyView.on('Pressed', function() {
            if (_this.surfaceView.clusterController) {
                _this.surfaceView.clusterController.unsetExclusive();
            }
        });

        this.historyView.$el.css({
            'position': 'absolute',
            'top': (fontSize * 2) + 'px',
            'font-size': fontSize + 'px'
        });

        this.$backgroundImage = $('<div>')
                                    .css({
                                        'position': 'absolute',
                                        'z-index': '-5',
                                        'width': '90%',
                                        'left': '5%',
                                        'top': '15%',
                                        'height': '70%',
                                        'opacity': '0.55'
                                    })
                                    .appendTo(this.$el);

        this.surfaceView.on('LabelChanged', this.updateLabel);
    },

    updateLabel: function() {
        var label = '';
        if (!this.G.hideLabels) {
            label = this.surfaceView.contextModel.getNS('Label');
        }
        this.$label.html(label);
    },

    render: function(options) {
        options = options || {};
        SurfaceModeView.prototype.render.call(this, options);

        this.updateLabel();

        var contextID = this.surfaceView.baseView.viewID;
        this.historyView.render({
            contextID: contextID,
            keepScrollPos: true
        });

        var cluster = this.surfaceView.clusterController;
        this.G.renderAppSurface(cluster, cluster.clusterMode, this.surfaceView, this, options);

        return this;
    },

    dataReactive: function() {
        return true;
    }
});

var GlobalSurface = SurfaceView.extend({
    tagName: 'div',
    className: 'global',

    events: {
        //'click': ''
    },

    modeClasses: {
        'View': GlobalSurface_View,
        'Edit': GlobalSurface_Edit,
        'Exclusive': GlobalSurface_Exclusive
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

    setExtra: function(extra) {
        var viewMode = this.getModeView('View');
        if (viewMode) {
            viewMode.setExtra(extra);
        }
    }
});

module.exports = GlobalSurface;
