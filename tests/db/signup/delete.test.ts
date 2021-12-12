import { Db, MongoClient } from 'mongodb';
import { defaultAfterAll, defaultAfterEach, defaultBeforeAll, defaultBeforeEach, demoSignupData, empty } from '../../utilities/setup';
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

    it('should support basic deletion', async () => {
        await expect(signupDB.delete({
            ...empty('DELETE'),
            id: '6001f0d62712ee177867dcbb',
        }))
            .resolves
            .toEqual(['6001f0d62712ee177867dcbb']);
    });

    it('should reject non-existent IDs', async () => {
        await expect(signupDB.delete({
            ...empty('DELETE'),
            id: '6001f0d62712ee177867dcba',
        }))
            .rejects
            .toThrowError('invalid entity ID');
    });

    it('should reject signup ids that are not of the right format', async () => {
        await expect(signupDB.delete({
            ...empty('DELETE'),
            id: 'invalid identifier Z',
        }))
            .rejects
            .toThrowError('invalid entity format');
    });

});
