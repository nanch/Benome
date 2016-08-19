// Libs
var $ = require('jquery'),
    _ = require('underscore'),
    Backbone = require('backbone');

var SurfaceView = require('app/cluster/SurfaceView');

var SimpleSurfaceView = SurfaceView.extend({
    className: 'simple-surface-view',

    initialize: function(options) {
        options = options || {};
        SurfaceView.prototype.initialize.call(this, options);

        var label = this.contextModel.get('Label');

        this.$el
            .css({
                'text-align': 'center'
            })
            .html('<br><br>' + label);
    },

    setExtra: function(extra) {
        this.extra = extra || '';
        this.extra += '';

        if (!this.$extra) {
            this.$extra = $('<br><span class="extra" style="text-align: center;"></span>').appendTo(this.$el);
        }

        var $x = $('.extra', this.$el);
        $x.html(extra);
    }
});

module.exports = SimpleSurfaceView;