var MongoClient = require('mongodb').MongoClient;

const EVENT_DETAILS_COLLECTION = "details"

class EventDetailsConnector {
    constructor(uri) {
        MongoClient.connect(uri, function(err, db) {
            if (err) {
                throw err;
            }

            this.db = db;
        });
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