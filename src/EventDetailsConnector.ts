import * as MongoClient from 'mongodb';

// The collection within the event database which contains the event details.
const EVENT_DETAILS_COLLECTION = 'details';

// The database used for storing events.
const EVENT_DB = 'events';

export namespace Database {

    export type UemsEvent = {
        id: string,
        name: string,
        start_date: Number, // dates in seconds since epoch
        end_date: Number
    };

    export class EventDetailsConnector {
        constructor(private db: MongoClient.Db) {
        }

        async retrieveQuery(query: {}): Promise<Database.UemsEvent[]> {
            const collection = this.db.collection(EVENT_DETAILS_COLLECTION);
            const res: UemsEvent[] = await collection.find(query).toArray();
            return res;
        }

        async insertEvent(content: any): Promise<boolean> {
            const collection = this.db.collection(EVENT_DETAILS_COLLECTION);
            const res = await collection.insertOne(content);

            return (res.result.ok !== undefined);
        }

        async findAndModifyEvent(eventId: number, newEvent: any): Promise<boolean> {
            // TODO, setup the database so changes are timestamped in a reversable way.
            const collection = this.db.collection(EVENT_DETAILS_COLLECTION);

            const res = await collection.replaceOne(
                {
                    _id: new MongoClient.ObjectID(eventId),
                },
                newEvent,
            );

            return (res.result.ok !== undefined);
        }

        // Return true if successful.
        async removeEvent(eventId: number): Promise<boolean> {
            // TODO, setup the database so changes are timestamped in a reversable way.
            const collection = this.db.collection(EVENT_DETAILS_COLLECTION);
            const res: MongoClient.DeleteWriteOpResultObject = await collection.deleteOne(
                {
                    _id: new MongoClient.ObjectID(eventId),
                },
            );

            return (res.result.ok !== undefined);
        }
    }

    export async function connect(uri: string): Promise<EventDetailsConnector> {
        try {
            const client = await MongoClient.connect(uri, {
                useNewUrlParser: true,
                useUnifiedTopology: true,
            });

            return new EventDetailsConnector(client.db(EVENT_DB));
        } catch (e) {
            console.log('failed to connect to the database', e);
            throw e;
        }
    }
}
