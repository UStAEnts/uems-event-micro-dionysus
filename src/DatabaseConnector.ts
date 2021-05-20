import * as zod from 'zod';
import * as MongoClient from 'mongodb';
import { EventDatabase } from './database/type/impl/EventDatabaseInterface';
import { SignupDatabase } from './database/type/impl/SignupDatabaseInterface';
import { _byFile } from './logging/Log';
import { GenericCommentDatabase } from '@uems/micro-builder/build/src';

const _l = _byFile(__filename);

export namespace Database {

    const CONFIG_VALIDATOR = zod.object({
        uri: zod.string(),
        auth: zod.object({
            user: zod.string(),
            password: zod.string(),
        }),
        mapping: zod.object({
            event: zod.string(),
            comment: zod.string(),
            signup: zod.string(),
        }),
        options: zod.any()
            .optional(),
    })
        .nonstrict();

    export type DatabaseConnections = {
        event: EventDatabase,
        comment: GenericCommentDatabase,
        signup: SignupDatabase,
        terminate: () => Promise<void>,
    };

    // Connects the datebase connect to the mongoDB database at the given uri.
    export async function connect(config: any): Promise<DatabaseConnections> {
        const validate = CONFIG_VALIDATOR.safeParse(config);
        if (!validate.success) {
            throw new Error(`Failed to validate config: ${JSON.stringify(validate.error.flatten())}`);
        }
        _l.info('database configuration was valid');
        const configuration = validate.data;

        try {
            const client = await MongoClient.connect(configuration.uri, {
                useNewUrlParser: true,
                useUnifiedTopology: true,
                auth: configuration.auth,
                ...configuration.options,
            });

            _l.debug('mongo connection created, spawning databases');

            return {
                event: new EventDatabase(client.db(configuration.mapping.event), {
                    changelog: 'changelog',
                    details: 'details',
                }),
                comment: new GenericCommentDatabase(['event'], client.db(configuration.mapping.comment), {
                    changelog: 'changes',
                    details: 'comments',
                }),
                signup: new SignupDatabase(client.db(configuration.mapping.signup), {
                    changelog: 'changelog',
                    details: 'details',
                }),
                terminate: () => client.close(),
            };
        } catch (e) {
            _l.error('failed to connect to the database', e);
            throw e;
        }
    }
}
