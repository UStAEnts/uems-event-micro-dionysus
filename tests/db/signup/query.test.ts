import { Db, MongoClient } from 'mongodb';
import { defaultAfterAll, defaultAfterEach, defaultBeforeAll, defaultBeforeEach, demoSignupData, empty, haveNoAdditionalKeys } from '../../utilities/setup';
import { SignupDatabase } from '../../../src/database/SignupDatabaseInterface';

describe('create messages of states', () => {
    let client!: MongoClient;
    let db!: Db;
    let signupDB: SignupDatabase;

    beforeAll(async () => {
        const {
            client: newClient,
            db: newDb,
        } = await defaultBeforeAll();
        client = newClient;
        db = newDb;

        signupDB = new SignupDatabase(db, {
            details: 'details',
            changelog: 'changelog',
        });
    });

    afterAll(() => defaultAfterAll(client, db));
    beforeEach(() => defaultBeforeEach(demoSignupData, client, db));
    afterEach(() => defaultAfterEach(client, db));

    it('should support querying by ID', async () => {
        const query = await signupDB.query({
            ...empty('READ'),
            id: '6001f0d62712ee177867dcbb',
        });

        expect(query[0])
            .toHaveProperty('role', 'witch straight');
        expect(query[0])
            .toHaveProperty('event', 'throat machinery');
        expect(query[0])
            .toHaveProperty('user', 'asylum movement');

        expect(haveNoAdditionalKeys(query[0], ['id', 'role', 'user', 'event', 'date']));
    });

    it('should support querying by assorted properties', async () => {
        const query = await signupDB.query({
            ...empty('READ'),
            userID: 'throughful earthquake',
            eventID: 'breathe agency',
            date: 1224354231,
        });

        expect(query).toHaveLength(1);
        expect(query[0])
            .toHaveProperty('role', 'net can');
        expect(query[0])
            .toHaveProperty('event', 'breathe agency');
        expect(query[0])
            .toHaveProperty('user', 'throughful earthquake');

        expect(haveNoAdditionalKeys(query[0], ['id', 'role', 'user', 'event', 'date']));
    });

    it('should support querying by date ranges', async () => {
        const query = await signupDB.query({
            ...empty('READ'),
            dateRangeBegin: 122456332,
            dateRangeEnd: 122456532,
        });

        expect(query).toHaveLength(1);
        expect(query[0])
            .toHaveProperty('role', 'comprehensive insist');
        expect(query[0])
            .toHaveProperty('event', 'throat machinery');
        expect(query[0])
            .toHaveProperty('user', 'asylum movement');
    });

});
