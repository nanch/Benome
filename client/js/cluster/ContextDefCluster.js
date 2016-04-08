/*
Copyright 2016 Steve Hazel

This file is part of Benome.

Benome is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License version 3
as published by the Free Software Foundation.

Benome is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with Benome. If not, see http://www.gnu.org/licenses/.
*/

var $ = require('jquery'),
    Backbone = require('backbone'),
    _ = require('backbone/node_modules/underscore');

var SurfaceView = require('app/cluster/SurfaceView'),
    BaseClusterController = require('app/cluster/BaseClusterController');


function ContextDefCluster(struct, contextCollection, options) {
    struct = struct || {};
    this.G = this.G || options.G || require('app/Global')();

    // Setup and render the cluster
    var defaultClusterOptions = {
        hideRoot: false,
        layoutChange: false,
        hideLabels: false,
        labelIDsOnly: false,
        noCompress: true,

        radiusScaleFactor: 0.4,
        scaleFactor: !this.G.isTablet && this.G.isMobile ? 0.6 : 0.6,
        spaceFactor: 0.7,
        focusAngleArc: 360,
        focusStartAngle: 30,
        childAngleArc: 210,
        maxDepth: null,
        numDetailLevels: 6
    };
    struct.Options = _.extend({}, defaultClusterOptions, struct.Options || {});

    // Call the base constructor
    BaseClusterController.call(this, struct, contextCollection);

    var cluster = this.cluster;

    this.contextCollection.each(function(model) {
        var viewID = model.id;
        if (model.get('Type') == 'ContextDefRoot') {
            // Enable drop only on the root (better to disable on all leaves)
            cluster.setViewState(viewID, {
                dropDisabled: false
            });
        }
    }, this);

    cluster.setFocus(this.rootContextID);
    cluster.setFilterLevel(0, {noRender: true});
    cluster.setRadius(this.getClusterSize());
    this.setPosition();
}

_.extend(ContextDefCluster.prototype, BaseClusterController.prototype, {
    onClusterShortPress: function(e, view) {
        
    },

    onClusterLongPress: function(e, view) {
        //this.trigger('LongPress', e, view);
        BaseClusterController.prototype.onClusterLongPress.call(this, e, view);
    },

    onBeforeClusterClicked: function(e, view) {
    },

    getSurfaceViewClass: function(contextModel) {
        var AttributeSurfaces = require('app/cluster/AttributeSurfaces'),
            attributeType = contextModel.get('Type'),
            attributeType = 'SimpleSurfaceView',
            SurfaceViewCls = AttributeSurfaces[attributeType] || SurfaceView;

        return SurfaceViewCls;
    },

    getValues: function() {
        var values = {};
        this.contextCollection.each(function(model) {
            var viewID = model.id;
            var bonusDef = _.pick(model.attributes, 'Label', 'GlobalMultiplier', 'MultiplierValue', 'Text');
            var bonusID = model.get('OriginalContextID') || model.get('AttrID');
            values[bonusID] = bonusDef;
        }, this);

        return values;
    }
});

module.exports = ContextDefCluster;