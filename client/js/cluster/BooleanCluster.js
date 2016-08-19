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
    _ = require('underscore');

var SimpleSurfaceView = require('app/cluster/surfaces/SimpleSurfaceView');
    BaseClusterController = require('app/cluster/BaseClusterController');
    

function BooleanCluster(struct, contextCollection, options) {
    struct = struct || {};

    // Setup and render the cluster
    var defaultClusterOptions = {
        hideRoot: false,
        layoutChange: false,
        noCompress: true,
        moveDisabled: false,
        dragDisabled: true,
        dropDisabled: true,

        hideLabels: false,
        labelIDsOnly: false,

        radiusScaleFactor: 0.5,
        scaleFactor: 0.6,
        spaceFactor: 0.4,
        focusAngleArc: 360,
        focusStartAngle: 30,
        childAngleArc: 210,
        maxDepth: null,
        numDetailLevels: 6
    };
    struct.Options = _.extend({}, defaultClusterOptions, struct.Options || {});

    this.defaultConstructDef = {
        AttrID: 'NewBoolean',
        Label: null,
        Value: false
    };
    this.defaultConstructType = 'BooleanOption';

    // Call the base constructor
    BaseClusterController.call(this, struct, contextCollection, options);

    var cluster = this.cluster;

    this.contextCollection.each(function(model) {
        var viewID = model.id;
        if (model.get('Type') == 'BooleanOption') {
            var initialValue = model.get('Value');
            if (_.isUndefined(initialValue) || _.isNull(initialValue)) {
                if (this.struct.Value) {
                    initialValue = !!this.struct.Value[model.get('OriginalContextID')];
                    model.set({
                        'Value': initialValue
                    }, {silent: true});
                }                
            }
            this.setViewState(viewID, initialValue);
        }
        else {
            // Disable drop on all other nodes
            this.cluster.setViewState(viewID, {
                dropDisabled: false
            });
        }
    }, this);

    cluster.setFocus(this.rootContextID);
    cluster.setFilterLevel(0, {noRender: true});
    cluster.setRadius(this.getClusterSize());
    this.setPosition();
}

_.extend(BooleanCluster.prototype, BaseClusterController.prototype, {
    setViewState: function(viewID, value) {
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
    },

    onClusterClicked: function(e, view) {
        if (view && view.surfaceView) {
            var surfaceView = view.surfaceView;
            var surfaceType = surfaceView.contextModel.get('Type');
            if (surfaceType == 'BooleanOption') {
                var currentValue = surfaceView.toggleValue();
                this.setViewState(view.viewID, currentValue);
                view.cluster.render();

                if (this.eventHandlers.onValueChange) {
                    this.eventHandlers.onValueChange();
                }
            }
            else if (surfaceType == 'BooleanRoot') {
                _.each(this.surfaceViewCache, function(surfaceView, viewID) {
                    var surfaceType = surfaceView.contextModel.get('Type');
                    if (surfaceType != 'BooleanOption') {
                        return;
                    }

                    var currentValue = surfaceView.toggleValue();
                    this.setViewState(viewID, currentValue);
                }, this);

                view.cluster.render();

                if (this.eventHandlers.onValueChange) {
                    this.eventHandlers.onValueChange();
                }
            }
        }
    },

    getSurfaceViewClass: function(contextModel) {
        var AttributeSurfaces = require('app/cluster/AttributeSurfaces');
        if (contextModel.get('Type') == 'BooleanOption') {
            return AttributeSurfaces['Boolean'];
        }
        else {
            return SimpleSurfaceView;
        }
    },

    getValues: function() {
        return _.object(_.compact(_.map(this.surfaceViewCache, function(surfaceView, viewID) {
            var nodeDefID = surfaceView.contextModel.get('OriginalContextID');
            if (!nodeDefID) {
                return;
            }

            if (_.isUndefined(surfaceView.newValue)) {
                return [nodeDefID, surfaceView.getValue()];
            }
            else {
                return [nodeDefID, surfaceView.newValue];
            }
        })));
    },
});

module.exports = BooleanCluster;