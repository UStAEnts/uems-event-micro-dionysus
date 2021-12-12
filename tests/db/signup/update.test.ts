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

    it('should support basic updates', async () => {
        const update = await signupDB.update({
            ...empty('UPDATE'),
            id: '6001f0d62712ee177867dcbb',
            role: 'new role assignment',
        });

        expect(update)
            .toHaveLength(1);
        expect(update[0])
            .toEqual('6001f0d62712ee177867dcbb');

        const query = await signupDB.query({
            ...empty('READ'),
            id: '6001f0d62712ee177867dcbb',
        });

        expect(query)
            .toHaveLength(1);
        expect(query[0])
            .toHaveProperty('role', 'new role assignment');
    });

    it('should reject making a new duplicate via update', async () => {
        await expect(signupDB.update({
            ...empty('UPDATE'),
            id: '6001f0d62712ee177867dcbb',
            role: 'comprehensive insist',
        }))
            .rejects
            .toThrowError('signup already exists');
    });

    it('should prevent adding additional properties via update', async () => {
        const update = await signupDB.update({
            ...empty('UPDATE'),
            id: '6001f0d62712ee177867dcbb',
            role: 'new role assignment',
            // @ts-ignore
            someInvalidProperty: 'something',
        });

        expect(update)
            .toHaveLength(1);
        expect(update[0])
            .toEqual('6001f0d62712ee177867dcbb');

        const query = await signupDB.query({
            ...empty('READ'),
            id: '6001f0d62712ee177867dcbb',
        });

        expect(haveNoAdditionalKeys(query[0], ['id', 'role', 'user', 'event', 'date']));
    });

    it('should reject when a non-existent ID is provided', async () => {
        await expect(signupDB.update({
            ...empty('UPDATE'),
            id: '6001f0d62712ee177867dcba',
            role: 'won\'t work',
        }))
            .rejects
            .toThrowError('invalid entity ID');
    });

    it('should reject when an ID of the wrong format is provided', async () => {
        await expect(signupDB.update({
            ...empty('UPDATE'),
            id: 'wrong format ID',
            role: 'won\'t work',
        }))
            .rejects
            .toThrowError('invalid entity format');
    });

    it('should reject when there is no updates', async () => {
        await expect(signupDB.update({
            ...empty('UPDATE'),
            id: '6001f0d62712ee177867dcbb',
        }))
            .rejects
            .toThrowError('no operations provided');
    });

});
