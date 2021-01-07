import * as zod from 'zod';
import * as MongoClient from 'mongodb';
import { EventDatabaseInterface } from './database/type/impl/EventDatabaseInterface';
import { GenericCommentDatabase } from '@uems/micro-builder/build/database/GenericCommentDatabase';

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
        }),
        options: zod.any().optional(),
    })
        .nonstrict();

    export type DatabaseConnections = {
        event: EventDatabaseInterface,
        comment: GenericCommentDatabase,
    };

    // Connects the datebase connect to the mongoDB database at the given uri.
    export async function connect(config: any): Promise<DatabaseConnections> {
        const validate = CONFIG_VALIDATOR.safeParse(config);
        if (!validate.success) {
            throw new Error(`Failed to validate config: ${JSON.stringify(validate.error.flatten())}`);
        }
        const configuration = validate.data;

        try {
            const client = await MongoClient.connect(configuration.uri, {
                useNewUrlParser: true,
                useUnifiedTopology: true,
                auth: configuration.auth,
                ...configuration.options,
            });

            return {
                event: new EventDatabaseInterface(client.db(configuration.mapping.event)),
                comment: new GenericCommentDatabase(['event'], client.db(configuration.mapping.comment), {
                    changelog: 'changes',
                    details: 'comments',
                }),
            };
        } catch (e) {
            console.log('failed to connect to the database', e);
            throw e;
        }
    }
}
