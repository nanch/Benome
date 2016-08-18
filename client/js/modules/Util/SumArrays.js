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

var _ = require('backbone/node_modules/underscore'),
	sum = require('app/modules/Util/Sum');

// All arrays must be of same length or column sum will be NaN
function sumArrays(arrayList) {
    var zipped = _.zip.apply(_, arrayList);
    return _.map(zipped, function(col) {
        return sum(col);
    });
}

module.exports = sumArrays;