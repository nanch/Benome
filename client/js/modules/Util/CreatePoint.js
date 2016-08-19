var _ = require('underscore');
var Point = require('app/modules/Data/Point');

function createPoint(pointID, contextID, details) {
    var updatedAttributes = details.UpdatedAttributes || {};

    var createAttrs = {
        'ID': pointID
    };

    function addNamespacedAttr(attrBase, namespaceID, newAttrs) {
        namespaceID = namespaceID || 1;
        _.each(newAttrs, function(val, key) {
            attrBase[namespaceID + '__' + key] = val;
        });
    }

    var beginTime = updatedAttributes.Timing ? updatedAttributes.Timing.Time || null : Date.now() / 1000;
    addNamespacedAttr(createAttrs, 1, {
        // Global/universal attributes
        'ContextID': contextID,
        'Time': beginTime,
        'TimeOffset': 0,

        // Core app attributes    
        'Duration': updatedAttributes.Timing ? parseInt(updatedAttributes.Timing.Duration) || null : null,
        'Text': updatedAttributes.Text || '',
        'Color': details.Color || null
    });

    var point = new Point(createAttrs, { silent: true });
    return point;
}

module.exports = createPoint;