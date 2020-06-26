import * as MongoClient from 'mongodb';

// The collection within the event database which contains the event details.
const EVENT_DETAILS_COLLECTION = "details"

// The database used for storing events.
const EVENT_DB = "events"

export namespace Database {

    export function setup(uri: string) {
        return connect(uri)
            .then((ed) => ed)
            .catch(async (err) => {
                console.error('error setting up database', err);
                return null;
            });
    }

    export async function connect(uri: string) {
        try {
            let client = await MongoClient.connect(uri, {
                useNewUrlParser: true,
                useUnifiedTopology: true,
            });

            return new EventDetailsConnector(client.db(EVENT_DB));
        } catch (e) {
            console.log('failed to connect to the database', e);
            throw e;
        }
    }

    export class EventDetailsConnector {

        constructor(private db: MongoClient.Db) {
        }

        retrieveAllEvents(): Promise<any> {
            const collection = this.db.collection(EVENT_DETAILS_COLLECTION);
            return collection.find({}).toArray();
        }

    }

}
