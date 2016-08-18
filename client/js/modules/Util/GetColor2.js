var $ = require('jquery'),
    jQueryColor = require('app/lib/jquery.color');

function getColor(idx, numHues) {
    var numHues = numHues || 16;
    idx = Math.max(0, Math.min(numHues, idx));

    var hue = (360 / numHues) * idx,
        saturation = 0.55,
        lightness = 0.55,
        color = $.Color()
                    .hue(hue)
                    .saturation(saturation)
                    .lightness(lightness)
                    .alpha(1),
        hexColor = color.toHexString();

    return hexColor;
}

module.exports = getColor;