import { Db, MongoClient } from "mongodb";
import { defaultAfterAll, defaultAfterEach, defaultBeforeAll, defaultBeforeEach, demoEventData } from "../utilities/setup";
import { BaseSchema } from "@uems/uemscommlib/build/BaseSchema";
import Intentions = BaseSchema.Intentions;
import { EventDatabase } from "../../src/database/type/impl/EventDatabaseInterface";

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
            db: newDb
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

    it('should support basic deletion', async () => {
        const remove = await eventDB.delete({
            ...empty('DELETE'),
            id: '6001f0d62712ee177867dcbc',
        });

        expect(remove)
            .toHaveLength(1);
        expect(remove[0])
            .toEqual('6001f0d62712ee177867dcbc');
    });

    it('should reject non-existent IDs', async () => {
        const remove = eventDB.delete({
            ...empty('DELETE'),
            id: '6001f0d62712ee177867dcba',
        });

        await expect(remove)
            .rejects
            .toThrowError('invalid entity ID');
    });

    it('should reject event IDs that are not of the right format', async () => {
        const remove = eventDB.delete({
            ...empty('DELETE'),
            id: 'not a valid 123 identifier',
        });

        await expect(remove)
            .rejects
            .toThrowError('invalid entity format');
    });

});
