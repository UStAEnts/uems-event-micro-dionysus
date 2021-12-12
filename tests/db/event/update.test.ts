import { Db, MongoClient } from 'mongodb';
import { defaultAfterAll, defaultAfterEach, defaultBeforeAll, defaultBeforeEach, demoEventData, empty, } from '../../utilities/setup';
import { EventDatabase } from '../../../src/database/EventDatabaseInterface';

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
    beforeEach(() => defaultBeforeEach(demoEventData, client, db));
    afterEach(() => defaultAfterEach(client, db));

    it('should support basic updates', async () => {
        const update = await eventDB.update({
            ...empty('UPDATE'),
            id: '6001f0d62712ee177867dcbb',
            name: 'updated name',
            stateID: 'updated state',
        });

        expect(update)
            .toEqual(['6001f0d62712ee177867dcbb']);

        const query = await eventDB.query({
            ...empty('READ'),
            id: '6001f0d62712ee177867dcbb',
        });

        expect(query)
            .toHaveLength(1);
        expect(query[0])
            .toHaveProperty('name', 'updated name');
        expect(query[0])
            .toHaveProperty('state', 'updated state');
    });

    it('should support adding venues to the set', async () => {
        const update = await eventDB.update({
            ...empty('UPDATE'),
            id: '6001f0d62712ee177867dcbb',
            addVenues: ['a', 'b', 'c'],
        });

        expect(update)
            .toEqual(['6001f0d62712ee177867dcbb']);

        const query = await eventDB.query({
            ...empty('READ'),
            id: '6001f0d62712ee177867dcbb',
        });

        expect(query)
            .toHaveLength(1);
        expect(query[0])
            .toHaveProperty('venues');
        expect(query[0].venues)
            .toHaveLength(5);
        expect(query[0].venues)
            .toContain('a');
        expect(query[0].venues)
            .toContain('b');
        expect(query[0].venues)
            .toContain('c');
        expect(query[0].venues)
            .toContain('doll price');
        expect(query[0].venues)
            .toContain('fraction fold');
    });

    it('should support adding removing venues from the set', async () => {
        const update = await eventDB.update({
            ...empty('UPDATE'),
            id: '6001f0d62712ee177867dcbb',
            removeVenues: ['fraction fold'],
        });

        expect(update)
            .toEqual(['6001f0d62712ee177867dcbb']);

        const query = await eventDB.query({
            ...empty('READ'),
            id: '6001f0d62712ee177867dcbb',
        });

        expect(query)
            .toHaveLength(1);
        expect(query[0])
            .toHaveProperty('venues');
        expect(query[0].venues)
            .toHaveLength(1);
        expect(query[0].venues)
            .toContain('doll price');
    });

    it('should reject when there are no updates', async () => {
        await expect(eventDB.update({
            ...empty('UPDATE'),
            id: '6001f0d62712ee177867dcbb',
        }))
            .rejects
            .toThrowError('no operations provided');
    });

    it('should reject when a non-existent ID is provided', async () => {
        await expect(eventDB.update({
            ...empty('UPDATE'),
            id: '6001f0d62712ee177867dcba',
            name: 'won\'t work',
        }))
            .rejects
            .toThrowError('invalid entity ID');
    });

    it('should reject when an invalid ID format is provided', async () => {
        await expect(eventDB.update({
            ...empty('UPDATE'),
            id: 'wrong format ID',
            name: 'won\'t work',
        }))
            .rejects
            .toThrowError('invalid entity format');
    });

});
