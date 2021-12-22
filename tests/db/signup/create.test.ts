import { Db, MongoClient, ObjectId } from 'mongodb';
import { defaultAfterAll, defaultAfterEach, defaultBeforeAll, defaultBeforeEach, empty, haveNoAdditionalKeys } from '../../utilities/setup';
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
    beforeEach(() => defaultBeforeEach([], client, db));
    afterEach(() => defaultAfterEach(client, db));

    it('should support basic creation', async () => {
        const create = await signupDB.create({
            ...empty('CREATE'),
            role: 'role creation',
            userID: 'role user',
            eventID: 'event ID',
        });

        expect(create)
            .toHaveLength(1);
        expect(ObjectId.isValid(create[0]))
            .toBeTruthy();

        const query = await signupDB.query({
            ...empty('READ'),
            id: create[0],
        });

        expect(query)
            .toHaveLength(1);
        expect(query[0])
            .toHaveProperty('role', 'role creation');
        expect(query[0])
            .toHaveProperty('user', 'role user');
        expect(query[0])
            .toHaveProperty('event', 'event ID');
    });

    it('should reject duplicate signups', async () => {
        const first = await signupDB.create({
            ...empty('CREATE'),
            role: 'role creation',
            userID: 'role user',
            eventID: 'event ID',
        });

        expect(first)
            .toHaveLength(1);
        expect(ObjectId.isValid(first[0]))
            .toBeTruthy();

        await expect(signupDB.create({
            ...empty('CREATE'),
            role: 'role creation',
            userID: 'role user',
            eventID: 'event ID',
        }))
            .rejects
            .toThrowError('cannot create duplicate signup');
    });

    it('should not create additional properties on objects', async () => {
        const create = await signupDB.create({
            ...empty('CREATE'),
            role: 'role creation',
            userID: 'role user',
            eventID: 'event ID',
            // @ts-ignore
            invalidOne: 'one',
            invalidTwo: 'two',
        });

        expect(create)
            .toHaveLength(1);
        expect(ObjectId.isValid(create[0]))
            .toBeTruthy();

        const query = await signupDB.query({
            ...empty('READ'),
            id: create[0],
        });

        expect(query)
            .toHaveLength(1);
        expect(query[0])
            .toHaveProperty('role', 'role creation');
        expect(query[0])
            .toHaveProperty('user', 'role user');
        expect(query[0])
            .toHaveProperty('event', 'event ID');
        expect(haveNoAdditionalKeys(query[0], ['id', 'role', 'user', 'event', 'date']));
    });

});
