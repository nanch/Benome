var $ = require('jquery'),
    jQueryColor = require('app/lib/jquery.color');
    
var idToInt = require('app/modules/IDToInt');

function seedRandom(s) {
    return function() {
        s = Math.sin(s) * 10000; return s - Math.floor(s);
    }
}

function getColor(id) {
    var random = seedRandom(idToInt(id)),
        numHues = 16,
        hue = (360 / numHues) * (random() * numHues),
        saturation = 0.5,
        lightness = 0.6,
        color = $.Color()
                    .hue(hue)
                    .saturation(saturation)
                    .lightness(lightness)
                    .alpha(1),
        hexColor = color.toHexString();

    return hexColor;
}

module.exports = getColor;