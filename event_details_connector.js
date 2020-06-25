var MongoClient = require('mongodb').MongoClient;

const mongoose = require('mongoose');

const EVENT_DETAILS_COLLECTION = "details"

async function connect(uri) {
    console.log("Connecting to database uri: " + uri);

    try {
        client = await MongoClient.connect(uri, {useNewUrlParser: true});
        let db = client.db("events");
        console.log("Connected to database");
        return EventDetailsConnector(db);
    } catch (err) {
        console.error(err);
    }

    // this.db = MongoClient.connect(uri, function(err, db) {
    //     if (err) {
    //         throw err;
    //     }

    //     return db;
    // });

    // mongoose.connect(uri, {useNewUrlParser: true});
}

class EventDetailsConnector {
    constructor(db) {
        this.db = db
    }

    retrieve_all_events() {
        var queryPromise = () => {
            return new Promise((resolve, reject) => {
                this.db.collection(EVENT_DETAILS_COLLECTION)
                    .toArray(function(err, data) {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(data);
                        }
                    });
            });
        }

        return queryPromise;
    }
}

exports.EventDetailsConnector = EventDetailsConnector;
exports.connect = connect;