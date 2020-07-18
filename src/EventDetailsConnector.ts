import * as MongoClient from 'mongodb';

// The collection within the event database which contains the event details.
const EVENT_DETAILS_COLLECTION = 'details';

// The database used for storing events.
const EVENT_DB = 'events';

export namespace Database {

    export type UemsEvent = { // Represents a UemsEvent being taken from the database.
        id: string,
        name: string,
        start_date: number,
        end_date: number,
        venue: string[]
    };

    export type UemsQuery = {
        id?: string,
        name?: string,
        start_date?: number,
        end_date?: number,
        venue?: string[]
    };

    export type InsertEventResult = {
        event_id?: string, // Event ID of the inserted event, only populated if ok.
        err_msg?: string // Error message, only populated if err.
    };

    export class EventDetailsConnector {
        constructor(private db: MongoClient.Db) {
            this.db = db;
        }

        async retrieveQuery(query: UemsQuery): Promise<Database.UemsEvent[]> {
            console.log('Retrieve query: ');
            console.log(query);
            const collection = this.db.collection(EVENT_DETAILS_COLLECTION);
            const res: UemsEvent[] = await collection.find(query).toArray();
            return res;
        }

        /// Inserts the given event into the database.
        /// Note that the ID of the event will be ignored as a new ID is generated on insertion.
        async insertEvent(content: UemsEvent): Promise<InsertEventResult> {
            const collection = this.db.collection(EVENT_DETAILS_COLLECTION);
            const res = await collection.insertOne(content);

            let ret: InsertEventResult;

            if (res.result !== undefined) {
                ret = {
                    event_id: res.insertedId,
                };
            } else {
                ret = {
                    err_msg: 'Database failed to insert event',
                };
            }

            return ret;
        }

        async findAndModifyEvent(eventId: string, newEvent: any): Promise<boolean> {
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
        async removeEvent(eventId: string): Promise<boolean> {
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
