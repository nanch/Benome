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

var DataConstructor = require('app/modules/Util/DataConstructor');

/*
    Transform a JSON structure into a collection-friendly form, assigning IDs to each node
*/
function transformJSONToCollection(data, rootContextID) {
    rootContextID = rootContextID || 1
    var DC = new DataConstructor(rootContextID);

    function traverse(struct, parentID) {
        if (!parentID) {
            parentID = DC.add(struct.label)
        }

        _.each(struct.children, function(childStruct) {
            var nextParentID = DC.add(childStruct.label, parentID);
            v(childStruct, nextParentID);
        });
    }

    traverse(data);
    return DC.getData();
}

module.exports = transformJSONToCollection;