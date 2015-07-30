var assert = require("assert"),
    _ = require("lodash"),
    async = require("async");

//TODO: second style (pass db and indexes from multiple collections)

var toIgnoreInArray = ["background", "dropUps"],
    toIgnoreInDatabase = ["v", "ns"],
    toIgnoreIfUndefined = ["name"];

var cleanIndexes = function(indexesToClean, dirty) {
    return _.map(indexesToClean, function(indexToClean) {
        return _.omit(indexToClean, dirty);
    });
};

var dropIndexes = function(indexesToDrop, collection, callback) {

    var tasks = [];

    _.map(indexesToDrop, function(indexToDrop) {

        tasks.push(function(_callback) {

            console.log("Dropping index " + JSON.stringify(indexToDrop.key) + "... ");

            collection.dropIndex(indexToDrop.key, function(err) {
                if(err) {
                    console.log("Error: " + err.message);
                }
                else {
                    console.log("Done.");
                }

                _callback(err);
            });
        })
    });

    async.series(
        tasks,
        function(err) {
            assert.equal(err);
            callback(err);
        }
    );
};

var createIndexes = function(indexesToCreate, collection, callback) {

    var tasks = [];

    _.map(indexesToCreate, function(indexToCreate) {
        tasks.push(function(_callback) {

            console.log("Creating index " + JSON.stringify(indexToCreate.key) + "... ");

            collection.createIndex(indexToCreate.key, function(err, indexName) {

                if(err) {
                    console.log("Error: " + err.message);
                }
                else {
                    console.log("Done. Name is " + indexName);
                }

                _callback(err);
            });
        });
    });

    async.series(
        tasks,
        function(err) {
            assert.equal(err);
            callback(err);
        }
    );
};

var isEqual = function(cleanIndexCollection, cleanIndexArray) {

    var toIgnore = _.chain(toIgnoreIfUndefined)
        .map(function(_toIgnoreIfUndefined) {
            if(cleanIndexArray[_toIgnoreIfUndefined] === undefined) return _toIgnoreIfUndefined;
        })
        .compact()
        .value();

    cleanIndexCollection = _.omit(cleanIndexCollection, toIgnore);

    return _.isEqual(cleanIndexCollection, cleanIndexArray);
};

var differences = function(cleanIndexesCollection, cleanIndexesArray) {

    return {
        toDrop: function() {
            return _.chain(cleanIndexesCollection)
                .map(function(cleanIndexCollection) {

                    var presentInArray = false;
                    _.map(cleanIndexesArray, function(cleanIndexArray) {
                        if(isEqual(cleanIndexCollection, cleanIndexArray)) presentInArray = true;
                    });

                    if(!presentInArray) return cleanIndexCollection;
                })
                .compact()
                .value();
        },

        toCreate: function() {
            return _.chain(cleanIndexesArray)
                .map(function(cleanIndexArray) {

                    var presentInCollection = false;
                    _.map(cleanIndexesCollection, function(cleanIndexCollection) {
                        if(isEqual(cleanIndexCollection, cleanIndexArray)) presentInCollection = true;
                    });
                    if(!presentInCollection) return cleanIndexArray;
                })
                .compact()
                .value();
        }
    }
};

var syncIndexes = function(indexesArray, collection, options, callback) {

    collection.indexes(function(err, indexesCollection) {
        if(err) callback(err);

        var cleanIndexesCollection = cleanIndexes(indexesCollection, toIgnoreInDatabase),
            cleanIndexesArray = cleanIndexes(indexesArray, toIgnoreInArray);

        var diff = differences(cleanIndexesCollection, cleanIndexesArray);

        var indexesToDrop = diff.toDrop(),
            indexesToCreate = diff.toCreate();

        async.series(
            [
                function(_callback) {
                    dropIndexes(indexesToDrop, collection, _callback);
                },
                function(_callback) {
                    createIndexes(indexesToCreate, collection, _callback);
                }
            ],
            function(err) {
                //Close connection even if there's an error
                db.close();
                if(err) {
                    console.log("Error: " + err.message);
                    callback(err);
                }
            }
        );

        return callback();
    });

};

module.exports = syncIndexes;
