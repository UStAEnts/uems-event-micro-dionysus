import { Db, MongoClient } from 'mongodb';
import { defaultAfterAll, defaultAfterEach, defaultBeforeAll, defaultBeforeEach, haveNoAdditionalKeys, } from '../../utilities/setup';
import { BaseSchema } from '@uems/uemscommlib';
import { EventDatabase } from '../../../src/database/EventDatabaseInterface';
import Intentions = BaseSchema.Intentions;

const empty = <T extends Intentions>(intention: T): { msg_intention: T, msg_id: 0, status: 0, userID: string } => ({
    msg_intention: intention,
    msg_id: 0,
    status: 0,
    userID: 'user',
});

describe('create messages of states', () => {
    let client!: MongoClient;
    let db!: Db;
    let eventDB: EventDatabase;

    beforeAll(async () => {
        const {
            client: newClient,
            db: newDb,
        } = await defaultBeforeAll();
        client = newClient;
        db = newDb;

        eventDB = new EventDatabase(db, {
            details: 'details',
            changelog: 'changelog',
        });
    });

    afterAll(() => defaultAfterAll(client, db));
    beforeEach(() => defaultBeforeEach([], client, db));
    afterEach(() => defaultAfterEach(client, db));

    it('should support basic creation', async () => {
        const create = await eventDB.create({
            ...empty('CREATE'),
            name: 'something',
            stateID: 'something else',
            entsID: 'ent state',
            end: 1200,
            start: 1565,
            venueIDs: ['a', 'b'],
            attendance: 1245,
        });

        expect(create)
            .toHaveLength(1);

        const query = await eventDB.query({
            ...empty('READ'),
            id: create[0],
        });

        expect(query)
            .toHaveLength(1);
        expect(query[0])
            .toHaveProperty('name', 'something');
        expect(query[0])
            .toHaveProperty('state', 'something else');
        expect(query[0])
            .toHaveProperty('ents', 'ent state');
        expect(query[0])
            .toHaveProperty('end', 1200);
        expect(query[0])
            .toHaveProperty('start', 1565);
        expect(query[0])
            .toHaveProperty('venues', ['a', 'b']);
        expect(query[0])
            .toHaveProperty('attendance', 1245);
        expect(haveNoAdditionalKeys(query[0], ['id', 'name', 'state', 'ents', 'end', 'start', 'venues', 'attendance', 'author']));
    });

    it('should not add additional properties on create objects', async () => {
        const create = await eventDB.create({
            ...empty('CREATE'),
            name: 'something',
            stateID: 'something else',
            entsID: 'ent state',
            end: 1200,
            start: 1565,
            venueIDs: ['a', 'b'],
            attendance: 1245,
            // @ts-ignore
            invalidKey: 'a',
            invalidKeyB: 'b',
        });

        expect(create)
            .toHaveLength(1);

        const query = await eventDB.query({
            ...empty('READ'),
            id: create[0],
        });

        expect(query)
            .toHaveLength(1);
        expect(query[0])
            .toHaveProperty('name', 'something');
        expect(query[0])
            .toHaveProperty('state', 'something else');
        expect(query[0])
            .toHaveProperty('ents', 'ent state');
        expect(query[0])
            .toHaveProperty('end', 1200);
        expect(query[0])
            .toHaveProperty('start', 1565);
        expect(query[0])
            .toHaveProperty('venues', ['a', 'b']);
        expect(query[0])
            .toHaveProperty('attendance', 1245);
        expect(haveNoAdditionalKeys(query[0], ['id', 'name', 'state', 'ents', 'end', 'start', 'venues', 'attendance', 'author']));
    });
});
