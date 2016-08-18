function randomPointStream(options) {
	options = options || {};

    var numPoints = options.numPoints,
    	farTime = options.farTime,
    	nearTime = options.nearTime || Date.now() / 1000,
    	minDistance = options.minDistance || 0;
    	variance = options.variance || 0;

    nearTime -= minDistance;
    farTime -= minDistance;

    var timeRange = nearTime - farTime,
    	interval = timeRange / numPoints;

    return _.map(_.range(0, numPoints), function(i) {
    	var pos = (interval / 2) + (i * interval),
    		maxVariance = interval * variance,
    		actualVariance = maxVariance * Math.random();

    	pos -= maxVariance / 2;
    	pos += actualVariance;
        return farTime + pos;
    });
}

module.exports = randomPointStream;