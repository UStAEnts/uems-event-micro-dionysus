import { Database } from '../../src/DatabaseConnector';
import MongoUnit from 'mongo-unit';

jest.setTimeout(20000);

describe('testing database connector', () => {

    it('rejects invalid configurations', async () => {
        try {
            await Database.connect({});
            // Shouldn't be reached
            expect(false)
                .toBeTruthy();
        } catch (e) {
            expect(e)
                .toHaveProperty('message');
            expect(e.message)
                .toContain('validate config');
        }
    });

    it('fails when database connection is invalid', async () => {
        try {
            await Database.connect({
                uri: 'mongodb://example.org:4510  ',
                auth: {
                    user: 'abc',
                    password: 'doesnt matter',
                },
                mapping: {
                    event: 'what',
                    comment: 'who',
                    signup: 'why',
                },
                options: {
                    socketTimeoutMS: 1000,
                    connectTimeoutMS: 1000,
                    serverSelectionTimeoutMS: 1000,
                },
            });
            expect(false)
                .toBeTruthy();
        } catch (e) {
            expect(e)
                .not
                .toBeUndefined();
        }
    });

    it('returns correct database instances when connection is correct', async () => {
        const result = await Database.connect({
            uri: MongoUnit.getUrl(),
            auth: {
                user: '',
                password: '',
            },
            mapping: {
                event: 'what',
                comment: 'who',
                signup: 'why',
            },
            options: {
                auth: undefined,
            },
        });

        expect(result)
            .toHaveProperty('event');
        expect(result)
            .toHaveProperty('comment');
        expect(result)
            .toHaveProperty('signup');

        await result.terminate();
    });

    beforeAll(async () => {
        await MongoUnit.start();
    });

    afterAll(async () => {
        await MongoUnit.stop();
    });

});
