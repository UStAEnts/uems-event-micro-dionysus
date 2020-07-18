import * as MongoClient from 'mongodb';

// The collection within the event database which contains the event details.
const EVENT_DETAILS_COLLECTION = 'details';

// The database used for storing events.
const EVENT_DB = 'events';

export namespace Database {

    // Represents a UemsEvent that has been retrieved from the database.
    export type UemsEvent = {
        id: string,
        name: string,
        start_date: number,
        end_date: number,
        venue: string[]
    };

    // Represents a query to the database for information.
    // If all fields are undefined it indicates that all data should be returned.
    export type UemsQuery = {
        id?: string,
        name?: string,
        start_date?: number,
        end_date?: number,
        venue?: string[]
    };

    // The result of an insert event request.
    export type InsertEventResult = {
        event_id?: string, // Event ID of the inserted event, only populated if ok.
        err_msg?: string // Error message, only populated if err.
    };

    // Represents the database connection to mongoDB and handles requests to the database.
    export class DatabaseConnector {
        constructor(private db: MongoClient.Db) {
            this.db = db;
        }

        // Retrieves data from the database matching the given query.
        async retrieveQuery(query: UemsQuery): Promise<Database.UemsEvent[]> {
            const collection = this.db.collection(EVENT_DETAILS_COLLECTION);
            const res: UemsEvent[] = await collection.find(query).toArray();
            return res;
        }

        // Inserts the given event into the database.
        // Note that the ID of the event will be ignored as a new ID is generated on insertion.
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

        // Modifies the event with the given eventId to match the new values in newEvent.
        // Returns true if successful, false if not.
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

        // Removes an event from the database.
        // Returns true if successful, false if not.
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

    // Connects the datebase connect to the mongoDB database at the given uri.
    export async function connect(uri: string): Promise<DatabaseConnector> {
        try {
            const client = await MongoClient.connect(uri, {
                useNewUrlParser: true,
                useUnifiedTopology: true,
            });

            return new DatabaseConnector(client.db(EVENT_DB));
        } catch (e) {
            console.log('failed to connect to the database', e);
            throw e;
        }
    }
}
