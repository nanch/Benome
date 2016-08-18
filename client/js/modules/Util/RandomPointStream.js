function randomPointStream(numPoints, farTime, nearTime) {
    nearTime = nearTime || Date.now() / 1000;
    var timeRange = nearTime - farTime;

    return _.map(_.range(0, numPoints), function() {
        return farTime + (Math.random() * timeRange);
    });
}

module.exports = randomPointStream;