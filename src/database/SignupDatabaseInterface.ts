import {
    Collection, Db, FilterQuery, ObjectID,
} from 'mongodb';
import { SignupMessage, SignupResponse } from '@uems/uemscommlib';
import { _byFile } from '../logging/Log';
import CreateSignupMessage = SignupMessage.CreateSignupMessage;
import ReadSignupMessage = SignupMessage.ReadSignupMessage;
import DeleteSignupMessage = SignupMessage.DeleteSignupMessage;
import UpdateSignupMessage = SignupMessage.UpdateSignupMessage;
import ShallowInternalSignup = SignupResponse.ShallowInternalSignup;
import {
    genericCreate, genericDelete, GenericMongoDatabase, genericUpdate, MongoDBConfiguration,
} from '@uems/micro-builder/build/src';

const _l = _byFile(__filename);

export type InDatabaseSignup = {
    _id: ObjectID,
    user: string,
    event: string,
    role: string,
    date: number,
};

export type CreateInDatabaseSignup = Omit<InDatabaseSignup, '_id'>;

const dbToIn = (db: InDatabaseSignup): ShallowInternalSignup => ({
    role: db.role,
    id: db._id.toHexString(),
    date: db.date,
    event: db.event,
    user: db.user,
});

const createToDB = (create: CreateSignupMessage): CreateInDatabaseSignup => ({
    user: create.signupUser ?? create.userID,
    event: create.eventID,
    date: Date.now(),
    role: create.role,
});

export class SignupDatabase extends GenericMongoDatabase<ReadSignupMessage, CreateSignupMessage, DeleteSignupMessage, UpdateSignupMessage, ShallowInternalSignup> {

    constructor(_configuration: MongoDBConfiguration);
    constructor(_configurationOrDB: MongoDBConfiguration | Db, collections?: MongoDBConfiguration['collections']);
    constructor(database: Db, collections: MongoDBConfiguration['collections']);
    constructor(configurationOrDB: MongoDBConfiguration | Db, collections?: MongoDBConfiguration['collections']) {
        super(configurationOrDB, collections);

        const register = (details: Collection) => {
            details.createIndex({
                role: 1,
                user: 1,
                event: 1,
            }, { unique: true });
        };

        if (this._details) {
            register(this._details);
        } else {
            this.once('ready', () => {
                if (!this._details) throw new Error('Details db was not initialised on ready');
                register(this._details);
            });
        }
    }

    private static convertReadRequestToDatabaseQuery(request: ReadSignupMessage) {
        const query: FilterQuery<ShallowInternalSignup> = {};

        if (request.id !== undefined) {
            if (ObjectID.isValid(request.id)) {
                query._id = new ObjectID(request.id);
            } else {
                throw new Error('Invalid ID');
            }
        }

        if (request.signupUser) {
            query.user = request.signupUser;
        }

        if (request.eventID) {
            query.event = request.eventID;
        }

        if (request.role) {
            query.role = request.role;
        }

        if (request.date) {
            query.date = request.date;
        }

        if (request.dateRangeBegin !== undefined) {
            if (query.date) {
                if (typeof (query.date) === 'object') {
                    query.date.$gt = request.dateRangeBegin;
                } else {
                    throw new Error('Invalid configured date search, should not happen?');
                }
            } else {
                query.date = {
                    $gt: request.dateRangeBegin,
                };
            }
        }

        if (request.dateRangeEnd !== undefined) {
            if (query.date) {
                if (typeof (query.date) === 'object') {
                    query.date.$lt = request.dateRangeEnd;
                } else {
                    throw new Error('Invalid configured date search, should not happen?');
                }
            } else {
                query.date = {
                    $lt: request.dateRangeEnd,
                };
            }
        }

        _l.debug('performing a query for signup values:', { query });

        return query;
    }

    protected createImpl(create: SignupMessage.CreateSignupMessage, details: Collection): Promise<string[]> {
        return genericCreate(create, createToDB, details, () => {
            throw new Error('cannot create duplicate signup');
        }, this.log.bind(this));
    }

    protected deleteImpl(create: SignupMessage.DeleteSignupMessage, details: Collection): Promise<string[]> {
        if (!ObjectID.isValid(create.id)) throw new Error('invalid entity format');
        return genericDelete({ _id: new ObjectID(create.id) }, create.id, details, this.log.bind(this));
    }

    protected async queryImpl(
        create: SignupMessage.ReadSignupMessage,
        details: Collection,
    ): Promise<ShallowInternalSignup[]> {
        const query = SignupDatabase.convertReadRequestToDatabaseQuery(create);
        return (await details.find(query)
            .toArray()).map(dbToIn);
    }

    protected updateImpl(create: SignupMessage.UpdateSignupMessage, details: Collection): Promise<string[]> {
        if (!ObjectID.isValid(create.id)) throw new Error('invalid entity format');
        return genericUpdate(create, ['role'], details, {}, () => {
            throw new Error('signup already exists');
        });
    }

}
