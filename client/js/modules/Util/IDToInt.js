function idToInt(idStr) {
    var base;
    if (idStr.indexOf('-') >= 0) {
        // It's an offline UUID
        base = '0123456789abcdef';
        idStr = idStr.replace(/-/g, '');
    }
    else {
        base = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    }

    var length = base.length,
        result = 0;

    for (var i = 0; i < idStr.length; i++) {
        var c = idStr[idStr.length - i - 1];
        result += Math.pow(length, i) * base.indexOf(c);
    }

    return result;
}

module.exports = idToInt;