var _ = require('underscore');
var createPoint = require('app/modules/Util/CreatePoint'),
    randomPointStream = require('app/modules/Util/RandomPointStream2'),
    initCollections = require('app/modules/Util/InitCollections');

function initDemoClusterData(DC, rootContextID, options) {
    options = options || {};

    DC.add('');

    var nextID = DC.add('', rootContextID),
        nextIDs = DC.addMulti(3, nextID);
    DC.addMulti(3, nextIDs[2]);

    var nextID = DC.add('', rootContextID),
        nextIDs = DC.addMulti(5, nextID);
    //
    DC.addMulti(3, nextIDs[1]);

    var nextID = DC.add('', rootContextID),
        nextIDs = DC.addMulti(4, nextID);
    DC.addMulti(3, nextIDs[2]);
    
    var nextID = DC.add('', rootContextID),
        nextIDs = DC.addMulti(6, nextID);
    //
    DC.addMulti(3, nextIDs[1]);

    var nextID = DC.add('', rootContextID),
        nextIDs = DC.addMulti(4, nextID);
    DC.addMulti(3, nextIDs[1]);
    DC.addMulti(2, nextIDs[3]);

    var contexts = initCollections(rootContextID, DC.getData());

    var anchorTime = options.anchorTime || Date.now() / 1000,
        graphWindow = options.graphWindow || 86400,
        numGraphSegments = options.numGraphSegments || 24,
        
        pointWindow = graphWindow * 2,
        numRandomPoints = 10;

    _.each(DC.contexts, function(contextDef) {
        var contextID = contextDef.ID,
            context = contexts.get(contextID);

        if (!context.isLeaf()) {
            return;
        }

        var targetInterval = (graphWindow / 4) + (Math.random() * graphWindow),
            numPoints = 1 + parseInt(4 * Math.random());

        context.set('1__TargetFrequency', targetInterval);

        var minAge = Math.random() * targetInterval,
            rawPoints = randomPointStream({
                numPoints: numPoints,
                farTime: anchorTime - pointWindow,
                nearTime: anchorTime,
                minDistance: minAge,
                variance: Math.random()
            });

        var points = _.map(rawPoints, function(pointTime) {
            return createPoint(DC.nextID(), contextID, {
                UpdatedAttributes: {
                    Timing: {
                        Time: pointTime,
                        Duration: 0
                    }
                }
            });
        }, this);

        contexts.points.add(points, {
            silent: true
        });
    }, this);

    return contexts;
}

module.exports = initDemoClusterData;