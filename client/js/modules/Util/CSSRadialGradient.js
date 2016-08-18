function cssRadialGradient(colors, gradientStops, baseColor, cssPrefix) {
    var cssStops = [],
        stopDistances = _.map(gradientStops, function(v) { return v * 0.71 }), // 0.71 adjusts to circle's radius instead of square's
        numStops = stopDistances.length;

    _.each(stopDistances, function(stopDistance, i) {
        if (numStops - i > colors.length) {
            color = baseColor || 'rgba(0,0,0,0)';
        }
        else {
            color = colors[i - (numStops - colors.length)];
        }

        if (i == 0) {
            color + ' ' + (stopDistance * 100) + '%'
        }
        cssStops.push(color + ' ' + Math.round(stopDistance * 100) + '%');
    });

    var background = 'radial-gradient(' + cssStops.join(', ') + ')';
    if (cssPrefix == '-webkit-') {
        background = '-webkit-' + background;
    }

    return background;
}

module.exports = cssRadialGradient;