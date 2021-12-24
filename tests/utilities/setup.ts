import winston from 'winston';
import { Db, MongoClient, ObjectId } from 'mongodb';
import MongoUnit from 'mongo-unit';
import { InDatabaseEvent } from '../../src/database/EventDatabaseInterface';
import { BaseSchema } from '@uems/uemscommlib';
import { InDatabaseSignup } from '../../src/database/SignupDatabaseInterface';
import Intentions = BaseSchema.Intentions;

winston.add(new winston.transports.Console());

export const demoSignupData: InDatabaseSignup[] = [
    {
        _id: new ObjectId('6001f0d62712ee177867dcbb'),
        role: 'witch straight',
        date: 13040230,
        event: 'throat machinery',
        user: 'asylum movement',
    },
    {
        _id: new ObjectId('6001f0d62712ee177867dcbc'),
        role: 'comprehensive insist',
        date: 122456432,
        event: 'throat machinery',
        user: 'asylum movement',
    },
    {
        _id: new ObjectId('6001f0d62712ee177867dcbd'),
        role: 'net can',
        date: 1224354231,
        event: 'breathe agency',
        user: 'throughful earthquake',
    },
];

export const demoEventData: InDatabaseEvent[] = [
    {
        _id: new ObjectId('6001f0d62712ee177867dcbb'),
        name: 'convention attack',
        state: 'explain proposal',
        ents: 'sweet deer',
        end: 1611763873,
        start: 1612686824,
        venues: ['doll price', 'fraction fold'],
        attendance: 140,
        author: 'throughful earthquake',
    },
    {
        _id: new ObjectId('6001f0d62712ee177867dcbc'),
        name: 'recommendation migration',
        state: 'teacher inside',
        ents: 'embox dorm',
        end: 1612751249,
        start: 1612686824,
        venues: ['dominant weave', 'doll price'],
        attendance: 185,
        author: 'throughful earthquake',
    },
    {
        _id: new ObjectId('6001f0d62712ee177867dcbd'),
        name: 'venus garlic',
        state: 'agency adoption',
        ents: 'blow glare',
        end: 1611561528,
        start: 1611537944,
        venues: ['rubbish response', 'fraction fold'],
        attendance: 300,
        author: 'throughful earthquake',
    },
];

export function haveNoAdditionalKeys(object: any, allowed: string[]) {
    for (const key of Object.keys(object)) {
        expect(allowed)
            .toContain(key);
    }
}

export async function defaultBeforeAll(): Promise<{ client: MongoClient, db: Db }> {
    // Setup the in memory mongo db database
    await MongoUnit.start();

    // Create the database connection and connect to the one we just created in memory
    const client = new MongoClient(MongoUnit.getUrl(), {
        useUnifiedTopology: true,
    });
    await client.connect();

    // Then create a user database around this
    const db = client.db('testing');

    return {
        client,
        db,
    };
}

export async function defaultAfterAll(client: MongoClient, db: Db) {
    // Shutdown our connection to the database
    await client.close();

    // Then stop the in memory database
    await MongoUnit.stop();
}

export async function defaultBeforeEach(initialData: any[], client: MongoClient, db: Db, collection: string = 'details') {
    if (initialData.length > 0) {
        await db.collection(collection)
            .insertMany(initialData);
    }
}

export async function defaultAfterEach(client: MongoClient, db: Db, collections: string = 'details') {
    await db.collection(collections)
        .deleteMany({});
    await MongoUnit.drop();
}

export const empty = <T extends Intentions>(intention: T): { msg_intention: T, msg_id: 0, status: 0, userID: string } => ({
    msg_intention: intention,
    msg_id: 0,
    status: 0,
    userID: 'user',
});
