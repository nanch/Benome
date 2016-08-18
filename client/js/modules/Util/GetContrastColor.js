function contrastColor(c, darkColor, lightColor) {
    if (_.isString(c)) {
        c = $.Color(c);
    }

    // method taken from https://gist.github.com/960189
    var r = c._rgba[0],
        g = c._rgba[1],
        b = c._rgba[2];

    return (((r*299)+(g*587)+(b*144))/1000) >= 131.5 ? darkColor : lightColor;
}

module.exports = contrastColor;