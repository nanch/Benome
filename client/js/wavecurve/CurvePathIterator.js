/*
Copyright 2016 Steve Hazel

This file is part of Benome.

Benome is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License version 3
as published by the Free Software Foundation.

Benome is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with Benome. If not, see http://www.gnu.org/licenses/.
*/

// Libs
var _ = require('underscore');

// -------------

var CurvePathIterator = function(curvePath, options) {
    options = options || {};
    this.reverse = options.reverse;

    this.curvePath = curvePath;
    this.beginPosition = curvePath.getBeginPosition();
    this.endPosition = curvePath.getEndPosition();

    this.beginIndex = 0;
    this.endIndex = curvePath.getNumSegments() - 1;
    //this.currentIndex = this.beginIndex;

    this.called = false;
    this.cycled = false;
    this.endNext = false;
};

_.extend(CurvePathIterator.prototype, {
    next: function() {
        var i = 0;
        if (this.endNext) return null;

        if (!this.called) {
            this.called = true;

            i = this.beginIndex;
        }
        else {
            // compute the next value, cycling if necessary
            // return null if next is same as begin

            i = this.currentIndex + 1;
            if (i >= this.curvePath.getCurveData().length) {
                i = 0;
            }

            if (i == this.beginIndex) {
                return null;
            }
            else if (i == this.endIndex) {
                this.endNext = true;
            }
        }

        this.currentIndex = i;

        i = this.reverse ? this.endIndex - i : i;
        return this.curvePath.getCurveData()[i];
    }
});

module.exports = CurvePathIterator;