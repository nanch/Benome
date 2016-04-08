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

// Libs
var $ = require('jquery'),
    Backbone = require('backbone'),
    _ = require('backbone/node_modules/underscore'),
    Hammer = require('hammerjs');
Backbone.$ = $;



// -------------

var LayoutView = Backbone.View.extend({
    className: 'layout-view',

    events: {
    },

    initialize: function(options) {
        options = options || {};
        _.bindAll(this, 'dropHandler');
        this.el.setAttribute('BDropTarget', '1');
        this.el.setAttribute('DropHighlightDisabled', '1');
        this.$el.data('ViewRef', this);
    },

    dropHandler: function(dropView, dragView, dragDetails, dropDetails) {
        if (dragView.className != 'simple-view') {
            return;
        }

        var dragViewID = dragView.viewID,
            dragClusterID = dragView.clusterID,
            dragCluster = B.getCluster(dragClusterID),
            dragFocusID = dragCluster.focusID,
            dragIsFocus = dragViewID == dragFocusID;

        if (!dragIsFocus) {
            return;
        }

        // If a cluster focus is dropped onto space then move the cluster
        var x = dragDetails.dragProxyX + (dragDetails.dragProxyWidth / 2),
            y = dragDetails.dragProxyY + (dragDetails.dragProxyHeight / 2);

        dragCluster.setPosition(x, y);

        // If moved to the left edge then simplify it
        /*
        var globalSize = B.globalSize()
        if (x <= globalSize.width * 0.1) {
            if (!dragCluster.isMinimized) {
                dragCluster.setRadius(B.getDefaultClusterSize() / 2);
                dragCluster.lastMaxDepth = dragCluster.maxDepth;
                dragCluster.maxDepth = 1;
                dragCluster.isMinimized = true;
            }
        }
        // If moved to the top right corner, and not the root cluster, then delete it
        else if (dragViewID != B.rootContextID && x >= globalSize.width * 0.8 && y <= globalSize.height * 0.2) {
            dragCluster.setRadius(0);
            dragCluster.maxDepth = null;
        }
        else {
            dragCluster.setRadius(B.getDefaultClusterSize());
            dragCluster.maxDepth = dragCluster.lastMaxDepth || null;
            dragCluster.isMinimized = false;
        }
        */

        // If not the focus and dropped over space, then create a new cluster there
        /*
        else if (!dragIsFocus && !dropModel) {
            // Prevent more than one root cluster
            if (dragViewID == B.rootContextID) {
                return false;
            }

            B.lastClusterID = B.lastClusterID || 0;
            B.lastClusterID += 1;

            var clusterID = 'Cluster-' + B.lastClusterID,
                newCollection = B.globalCollection.collectionFromRoot(dragViewID),
                newCluster = new Cluster(clusterID, SimpleView, newCollection, B.getClusterOptions());
            
            B.clusters[clusterID] = newCluster;

            newCluster.setPosition(dragDetails.dragProxyX + (dragDetails.dragProxyWidth / 2), dragDetails.dragProxyY + (dragDetails.dragProxyHeight / 2));
            newCluster.setRadius(B.getDefaultClusterSize());
            newCluster.setFocus(dragViewID);
            newCluster.filterValue = 0;
            newCluster.render();
        }
        */

        dragCluster.render();
    }
});

module.exports = LayoutView;