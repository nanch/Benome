function StreamToFrequencyTarget(points, graphWindow, numSegments, options) {
    options = options || {};

    points.sort();
    graphWindow = graphWindow || 86400 * 14;
    numSegments = numSegments || 100;

    var decreaseImmed = !!options.decreaseImmed,
        includeEmpty = !!options.includeEmpty,
        targetInterval = options.targetInterval,
        anchorTime = options.anchorTime || (Date.now() / 1000);
    
    function initArray(size, value) {
        var arr = [];
        while (size--) {
            arr.push(value);
        }
        return arr;
    }

    var increment = graphWindow / numSegments,
        maxScore = 100,
        segments = initArray(numSegments, 0),
        hasScore = false;

    if (points.length == 0) {
        if (includeEmpty) {
            return segments;
        }
        return null;
    }

    _.each(points, function(pointTime, i) {
        // Now cascade the scores.
        // Scores from older points get overridden by scores from newer points.

        var segmentIdx = parseInt(Math.ceil((anchorTime - pointTime) / increment));

        if (segmentIdx >= numSegments) {
            segmentIdx = numSegments - 1;
        }

        var score = maxScore;
        while (segmentIdx >= 0 && score >= 0) {
            if (segmentIdx >= numSegments) {
                segmentIdx -= 1;
                continue;
            }
            var segmentAge = anchorTime - (segmentIdx * increment) - pointTime;

            if (!decreaseImmed) {
                segmentAge -= targetInterval;
            }

            score = Math.max(0, targetInterval - segmentAge) / targetInterval;
            score = Math.min(maxScore, Math.round(score * maxScore));

            if (score > 0 && score >= segments[segmentIdx]) {
                segments[segmentIdx] = score;
                hasScore = true;
            }

            segmentIdx -= 1;
        }
    });

    if (!hasScore && options.nullIfEmpty) {
        return null;
    }
    return segments;
}

module.exports = StreamToFrequencyTarget;