var MongoClient = require('mongodb').MongoClient;

// The collection within the event database which contains the event details.
const EVENT_DETAILS_COLLECTION = "details"

// The database used for storing events.
const EVENT_DB = "events"

// Called to setup an EventDetailsConnector by connecting to the given mongoDB uri.
function setup(uri) {
    return connect(uri).then(function(edConnector) {
        return edConnector;
    }).catch(function(err) {
        console.error("Error setting up database: " + err);
        return null;
    });
}

// Handles connecting to the mongodb database.
async function connect(uri) {
    try {
        client = await MongoClient.connect(uri, {useNewUrlParser: true, useUnifiedTopology: true});
        let db = client.db(EVENT_DB);
        return new EventDetailsConnector(db);
    } catch (err) {
        console.error(err);
    }
}

// Represents a persistent database connection which is used to make various requests to the database.
class EventDetailsConnector {
    constructor(db) {
        this.db = db
    }

    async retrieve_all_events() {
        return new Promise((resolve, reject) => {
            const collection = this.db.collection(EVENT_DETAILS_COLLECTION);
            collection.find({}).toArray(function(err, data) {
                if (err) {
                    reject(err);
                } else {
                    resolve(data);
                }
            });
        });
    }
}

exports.EventDetailsConnector = EventDetailsConnector;
exports.connect = connect;
exports.setup = setup;