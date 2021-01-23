import { Db, MongoClient } from 'mongodb';
import { defaultAfterAll, defaultAfterEach, defaultBeforeAll, defaultBeforeEach, demoEventData, empty, } from '../../utilities/setup';
import { EventDatabase } from '../../../src/database/type/impl/EventDatabaseInterface';

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

    it('should support querying by ID', async () => {
        const query = await eventDB.query({
            ...empty('READ'),
            id: '6001f0d62712ee177867dcbb',
        });

        expect(query)
            .toHaveLength(1);
        expect(query[0])
            .toHaveProperty('name', 'convention attack');
        expect(query[0])
            .toHaveProperty('state', 'explain proposal');
    });

    it('should support querying by substring of names', async () => {
        const query = await eventDB.query({
            ...empty('READ'),
            name: 'convention',
        });

        expect(query)
            .toHaveLength(1);
        expect(query[0])
            .toHaveProperty('name', 'convention attack');
        expect(query[0])
            .toHaveProperty('state', 'explain proposal');
    });

    it('should support querying by assorted properties', async () => {
        const query = await eventDB.query({
            ...empty('READ'),
            stateID: 'teacher inside',
            entsID: 'embox dorm',
            start: 1612686824,
            end: 1612751249,
            attendance: 185,
        });

        expect(query)
            .toHaveLength(1);
        expect(query[0])
            .toHaveProperty('name', 'recommendation migration');
        expect(query[0])
            .toHaveProperty('state', 'teacher inside');
    });

    it('should support querying by an exact set of venues', async () => {
        const query = await eventDB.query({
            ...empty('READ'),
            venueIDs: ['dominant weave', 'doll price'],
        });

        expect(query)
            .toHaveLength(1);
        expect(query[0])
            .toHaveProperty('name', 'recommendation migration');
        expect(query[0])
            .toHaveProperty('state', 'teacher inside');
    });

    it('should support querying by a start and end range of dates', async () => {
        const query = await eventDB.query({
            ...empty('READ'),
            startRangeBegin: 1611537344,
            startRangeEnd: 1611561728,
            endRangeBegin: 1611561518,
            endRangeEnd: 1611561538,
        });

        expect(query)
            .toHaveLength(1);
        expect(query[0])
            .toHaveProperty('name', 'venus garlic');
        expect(query[0])
            .toHaveProperty('state', 'agency adoption');
    });

    it('should support querying by an attendance range of data', async () => {
        const query = await eventDB.query({
            ...empty('READ'),
            attendanceRangeBegin: 150,
            attendanceRangeEnd: 350,
        });

        expect(query)
            .toHaveLength(2);
        const names = query.map((e) => e.name);
        expect(names)
            .toContain('recommendation migration');
        expect(names)
            .toContain('venus garlic');
    });

    it('should support querying by all venues', async () => {
        const query = await eventDB.query({
            ...empty('READ'),
            allVenues: ['rubbish response', 'fraction fold'],
        });

        expect(query)
            .toHaveLength(1);
        expect(query[0])
            .toHaveProperty('name', 'venus garlic');
        expect(query[0])
            .toHaveProperty('state', 'agency adoption');
    });

    it('should support querying by any venues', async () => {
        const query = await eventDB.query({
            ...empty('READ'),
            anyVenues: ['rubbish response', 'fraction fold'],
        });

        expect(query)
            .toHaveLength(2);
        const names = query.map((e) => e.name);
        expect(names)
            .toContain('convention attack');
        expect(names)
            .toContain('venus garlic');
    });

});
