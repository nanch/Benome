var $ = require('jquery'),
    Backbone = require('backbone'),
    _ = require('underscore'),
    moment = require('app/lib/moment');

var SurfaceView = require('app/cluster/SurfaceView'),
    AttributeModeView = require('app/cluster/AttributeModeView');

var SingleChoice_View = AttributeModeView.extend({
    tagName: 'div',
    className: 'attribute-singlechoice-mode-view',

    events: {
        //'click': ''
    },

    name: 'View',

    initialize: function(options) {
        AttributeModeView.prototype.initialize.call(this, options);

        var label = this.surfaceView.contextModel.get('Label');
        this.$layout = $('<div><br><span class="label">' + label + '<span class="separator">: </span></span><span class="value"></span></div>').appendTo(this.$el);
        this.$value = $('.value', this.$layout);
        this.$label = $('.label', this.$layout);
        this.$separator = $('.separator', this.$layout);
    },

    render: function(options) {
        AttributeModeView.prototype.render.call(this, options);

        var value = this.surfaceView.getValue();
        this.$value.text(value || '');

        if (value && this.surfaceView.contextModel.get('HideLabelIfSet')) {
            this.$label.hide();
            this.$separator.hide();
        }
        else {
            this.$label.show();

            if (value) {
                this.$separator.show();
            }
            else {
                this.$separator.hide();
            }
        }
        return this;
    }
});

var SingleChoice_Edit = AttributeModeView.extend({
    tagName: 'div',
    className: 'attribute-singlechoice-mode-edit',

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
            this.showChoiceCluster(this.$el);
            this.clusterRendered = true;
        }

        /*$('div', this.$el).css({
            'pointer-events': 'auto'
        });*/

        return this;
    },

    showChoiceCluster: function($container) {
        var initialValue = this.sourceData['Value'],
            choices = this.surfaceView.contextModel.get('Choices'),
            SingleChoiceCluster = require('app/cluster/SingleChoiceCluster');

        this.choiceCluster = new SingleChoiceCluster($container, choices, {
            width: this.regionWidth,
            height: this.regionHeight
        });

        var focusChoiceDef = _.find(choices, function(choiceDef) {
            return choiceDef.Value == initialValue;
        });

        var focusChoiceID = null,
            focusID = null;

        if (focusChoiceDef) {
            focusChoiceID = focusChoiceDef.ID;

            var choiceContext = this.choiceCluster.cluster.contexts.find(function(context) {
                return context.get('choiceID') == focusChoiceID;
            });

            if (choiceContext) {
                focusID = choiceContext.id;
            }
        }

        var _this = this;
        this.choiceCluster.cluster.on('BeforeFocusChanged', function(cluster, focusID) {
            var newValue = cluster.contexts.get(focusID).get('choiceValue') || null;

            _this.newValue = newValue;
            _this.surfaceView.valueChanged(newValue);
        });

        this.choiceCluster.render();

        if (focusID) {
            // FIXME: Setting focus before rendering leads to duplicate ZIndexes
            this.choiceCluster.cluster.setFocus(focusID)
            this.choiceCluster.cluster.render({noAnim: true})
        }
    },

    getValue: function() {
        // value associated with current focus, if any

        // Focus of the choice cluster
        /*var choiceFocusID = this.choiceCluster.cluster.focusID,
            choiceFocusContext = this.choiceCluster.cluster.contexts.get(choiceFocusID);

        debugger;*/


        /*this.surfaceView.baseView.model
        contextModel

        this.baseView = options.baseView;
        this.contextModel = options.contextModel;*/

        return this.newValue;
    }
});

var SingleChoice = SurfaceView.extend({
    tagName: 'div',
    className: 'attribute-view-singlechoice',

    events: {
        //'click': ''
    },

    modeClasses: {
        'View': SingleChoice_View,
        'Edit': SingleChoice_Edit
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

module.exports = SingleChoice;
