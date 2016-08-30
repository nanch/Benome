var _ = require('underscore');

var DataConstructor = require('app/modules/Util/DataConstructor');

function importJSONStruct(data, rootContextID) {
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

module.exports = importJSONStruct;