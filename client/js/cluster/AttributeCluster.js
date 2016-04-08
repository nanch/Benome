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


function AttributeCluster(struct, contextCollection, options) {
    options = options || {};
    this.G = this.G || options.G || require('app/Global')();
    struct = struct || {};

    // Setup and render the cluster
    var defaultClusterOptions = {
        hideRoot: false,
        layoutChange: true,
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
    cluster.setFocus(this.rootContextID);
    cluster.setFilterLevel(0, {noRender: true});
    cluster.setRadius(this.getClusterSize());
    this.setPosition();

    if (this.clusterConfig.clusterSize == 'Expanded') {
        this.setClusterExpanded({render: false});
    }
    else {
        this.setClusterCompact({render: false});
    }
}

_.extend(AttributeCluster.prototype, BaseClusterController.prototype, {
    onClusterShortPress: function(e, view) {
        if (this.clusterMode == 'Expanded') {
            this.setClusterCompact({render: true});
        }
        else if (this.clusterMode == 'Compact') {
            this.setClusterExpanded({render: true});
        }
    },

    onClusterLongPress: function(e, view) {
        this.trigger('LongPress', e, view);
    },

    onBeforeClusterClicked: function(e, view) {
        if (view.model.get('Type') == 'Boolean') {
            var value = view.surfaceView.toggleValue(),
                viewID = view.viewID;

            if (value === true) {
                this.cluster.setViewState(viewID, {
                    colorFade: 0.05,
                    spaceAdjust: 1.85
                });
            }
            else {
                this.cluster.setViewState(viewID, {
                    colorFade: 0.8,
                    spaceAdjust: 1
                });
            }

            this.cluster.render();
            return false;
        }
    },

    getSurfaceViewClass: function(contextModel) {
        var AttributeSurfaces = require('app/cluster/AttributeSurfaces'),
            attributeType = contextModel.get('Type'),
            SurfaceViewCls = AttributeSurfaces[attributeType] || SurfaceView;

        return SurfaceViewCls;
    },

    getSurfaceView: function(viewID, viewState, baseView, contextModel) {
        var surfaceView = BaseClusterController.prototype.getSurfaceView.call(this, viewID, viewState, baseView, contextModel);

        if (this.clusterMode == 'Expanded' && !viewState.parentID) {
            surfaceView.setDisplayMode('Edit');
        }
        else {
            surfaceView.setDisplayMode('View');
        }

        if (contextModel.get('Type') == 'Boolean') {
            var value = surfaceView.getValue()
            if (value === true) {
                this.cluster.setViewState(viewID, {
                    colorFade: 0.05,
                    spaceAdjust: 1.85
                });
            }
            else {
                this.cluster.setViewState(viewID, {
                    colorFade: 0.8,
                    spaceAdjust: 1
                });
            }
        }

        return surfaceView;
    },
    
    setClusterCompact: function(options) {
        options = options || {};
        this.clusterMode = 'Compact';

        var cluster = this.cluster;
        cluster.setRadius(this.getClusterSize());
        cluster.setConfig(_.extend({}, this.clusterConfig, {
            scaleFactor: 0.6,
            spaceFactor: 0.7
        }));

        if (options.render) {
            cluster.render();
        }
    },

    setClusterExpanded: function(options) {
        options = options || {};
        this.clusterMode = 'Expanded';

        var cluster = this.cluster;
        cluster.setRadius(this.getClusterSize() * 1.6);
        cluster.setConfig(_.extend({}, this.clusterConfig, {
            scaleFactor: 0.35,
            spaceFactor: 0.45
        }));

        if (options.render) {
            cluster.render();
        }
    }
});

module.exports = AttributeCluster;