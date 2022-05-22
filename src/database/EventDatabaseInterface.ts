import {
    Collection, Db, FilterQuery, ObjectID, UpdateQuery,
} from 'mongodb';
import { EventMessage, EventResponse } from '@uems/uemscommlib';
import ShallowInternalEvent = EventResponse.ShallowInternalEvent;
import ReadEventMessage = EventMessage.ReadEventMessage;
import CreateEventMessage = EventMessage.CreateEventMessage;
import DeleteEventMessage = EventMessage.DeleteEventMessage;
import UpdateEventMessage = EventMessage.UpdateEventMessage;
import { ClientFacingError, genericCreate, genericDelete, GenericMongoDatabase, MongoDBConfiguration } from "@uems/micro-builder/build/src";
import { _byFile } from "../logging/Log";
import log from "@uems/micro-builder/build/src/logging/Log";

const _ = log.auto;
const _l = _byFile(__filename);
// TODO: move to uems comms library
export type Changelog = {
    id: string,
    occurred: number,
    change: string,
    user?: string,
};

export type InDatabaseEvent = {
    _id: ObjectID,
    name: string,
    start: number,
    end: number,
    venues: string[],
    attendance: number,
    ents?: string,
    state?: string,
    author: string,
    reserved?: boolean,
};

export type CreateInDatabaseEvent = Omit<InDatabaseEvent, '_id'>;

const dbToIn = (db: InDatabaseEvent): ShallowInternalEvent => ({
    state: db.state === null ? undefined : db.state,
    ents: db.ents === null ? undefined : db.ents,
    venues: db.venues,
    attendance: db.attendance,
    end: db.end,
    id: db._id.toHexString(),
    name: db.name,
    start: db.start,
    author: db.author,
    reserved: db.reserved,
});

const createToDB = (create: CreateEventMessage): CreateInDatabaseEvent => ({
    start: create.start,
    name: create.name,
    attendance: create.attendance,
    venues: create.venueIDs,
    end: create.end,
    ents: create.entsID === null ? undefined : create.entsID,
    state: create.stateID === null ? undefined : create.stateID,
    author: create.userID,
    reserved: create.reserved,
});

export class EventDatabase extends GenericMongoDatabase<ReadEventMessage, CreateEventMessage, DeleteEventMessage, UpdateEventMessage, ShallowInternalEvent> {

    constructor(_configuration: MongoDBConfiguration);
    constructor(_configurationOrDB: MongoDBConfiguration | Db, collections?: MongoDBConfiguration['collections']);
    constructor(database: Db, collections: MongoDBConfiguration['collections']);
    constructor(configurationOrDB: MongoDBConfiguration | Db, collections?: MongoDBConfiguration['collections']) {
        super(configurationOrDB, collections);

        const register = (details: Collection) => {
            details.createIndex({ name: 'text' });
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

    private static convertReadRequestToDatabaseQuery(request: ReadEventMessage) {
        const query: FilterQuery<ShallowInternalEvent> = {};

        if (request.requestID) {
            _(request.requestID)
                .trace('got request', request);
        }
        if (request.id !== undefined) {
            if (typeof (request.id) === 'string') {
                if (ObjectID.isValid(request.id)) {
                    query._id = new ObjectID(request.id);
                } else {
                    throw new Error('Invalid ID');
                }
            } else {
                if (request.id.some((e) => !ObjectID.isValid(e))) throw new Error('Invalid ID');
                query._id = {
                    $in: request.id.map((e) => new ObjectID(e)),
                };
            }
        }

        // There is probably a better way to do this - maybe a content.map(|v| if (v.isEmpty()){remove(v)}) type thing.
        if (request.name !== undefined) {
            query.$text = {
                $search: request.name,
            };
        }

        if (request.start) {
            query.start = request.start;
        }

        if (request.end) {
            query.end = request.end;
        }

        if (request.attendance) {
            query.attendance = request.attendance;
        }

        if (request.venueIDs) {
            query.venues = {
                $size: request.venueIDs.length,
                $all: request.venueIDs,
            };
        }

        if (request.entsID) {
            // @ts-ignore
            query.ents = request.entsID;
        }

        if (request.stateID) {
            // @ts-ignore
            query.state = request.stateID;
        }

        if (request.startRangeBegin !== undefined) {
            if (query.start) {
                if (typeof (query.start) === 'object') {
                    query.start.$gt = request.startRangeBegin;
                } else {
                    throw new Error('Invalid configured start search, should not happen?');
                }
            } else {
                query.start = {
                    $gt: request.startRangeBegin,
                };
            }
        }

        if (request.startRangeEnd !== undefined) {
            if (query.start) {
                if (typeof (query.start) === 'object') {
                    query.start.$lt = request.startRangeEnd;
                } else {
                    throw new Error('Invalid configured start search, should not happen?');
                }
            } else {
                query.start = {
                    $lt: request.startRangeEnd,
                };
            }
        }

        if (request.endRangeBegin !== undefined) {
            if (query.end) {
                if (typeof (query.end) === 'object') {
                    query.end.$gt = request.endRangeBegin;
                } else {
                    throw new Error('Invalid configured end search, should not happen?');
                }
            } else {
                query.end = {
                    $gt: request.endRangeBegin,
                };
            }
        }

        if (request.endRangeEnd !== undefined) {
            if (query.end) {
                if (typeof (query.end) === 'object') {
                    query.end.$lt = request.endRangeEnd;
                } else {
                    throw new Error('Invalid configured end search, should not happen?');
                }
            } else {
                query.end = {
                    $lt: request.endRangeEnd,
                };
            }
        }

        if (request.attendanceRangeBegin !== undefined) {
            if (query.attendance) {
                if (typeof (query.attendance) === 'object') {
                    query.attendance.$gt = request.attendanceRangeBegin;
                } else {
                    throw new Error('Invalid configured attendance search, should not happen?');
                }
            } else {
                query.attendance = {
                    $gt: request.attendanceRangeBegin,
                };
            }
        }

        if (request.attendanceRangeEnd !== undefined) {
            if (query.attendance) {
                if (typeof (query.attendance) === 'object') {
                    query.attendance.$lt = request.attendanceRangeEnd;
                } else {
                    throw new Error('Invalid configured attendance search, should not happen?');
                }
            } else {
                query.attendance = {
                    $lt: request.attendanceRangeEnd,
                };
            }
        }

        if (request.allVenues) {
            query.venues = {
                $all: request.allVenues,
            };
        }

        if (request.anyVenues) {
            query.venues = {
                $in: request.anyVenues,
            };
        }

        if (request.localOnly) {
            query.author = request.userID;
        }

        if (request.stateIn) {
            query.state = {
                $in: request.stateIn,
            };
        }

        if (request.reserved !== undefined) {
            query.reserved = request.reserved;
        }

        if (request.requestID) {
            _(request.requestID)
                .debug('Executed request:', query);
        }

        return query;
    }

    protected createImpl(create: EventMessage.CreateEventMessage, details: Collection): Promise<string[]> {
        return genericCreate(create, createToDB, details, undefined, this.log.bind(this));
    }

    protected deleteImpl(create: EventMessage.DeleteEventMessage, details: Collection): Promise<string[]> {
        if (!ObjectID.isValid(create.id)) throw new Error('invalid entity format');
        return genericDelete({ _id: new ObjectID(create.id) }, create.id, details, this.log.bind(this));
    }

    protected async queryImpl(
        create: EventMessage.ReadEventMessage,
        details: Collection,
    ): Promise<EventResponse.ShallowInternalEvent[]> {
        return (await details.find(EventDatabase.convertReadRequestToDatabaseQuery(create))
            .toArray())
            .map(dbToIn);
    }

    protected async updateImpl(request: EventMessage.UpdateEventMessage, details: Collection): Promise<string[]> {
        if (!ObjectID.isValid(request.id)) throw new Error('invalid entity format');
        const update: UpdateQuery<ShallowInternalEvent> = {
            $set: {
                ...(request.name === undefined ? undefined : { name: request.name }),
                ...(request.start === undefined ? undefined : { start: request.start }),
                ...(request.end === undefined ? undefined : { end: request.end }),
                ...(request.attendance === undefined ? undefined : { attendance: request.attendance }),
                ...(request.entsID === undefined ? undefined : {
                    ents: request.entsID === null ? undefined : request.entsID,
                }),
                ...(request.stateID === undefined ? undefined : {
                    state: request.stateID === null ? undefined : request.stateID,
                }),
                ...(request.reserved === undefined ? undefined : {
                    reserved: request.reserved,
                }),
            },
        };

        // @ts-ignore
        if (Object.keys(update.$set).length === 0) delete update.$set;

        if (request.addVenues) {
            update.$addToSet = {
                venues: {
                    $each: request.addVenues,
                },
            };
        }

        if (request.removeVenues) {
            update.$pull = {
                venues: {
                    $in: request.removeVenues,
                },
            };
        }

        if (Object.keys(update.$set ?? {}).length === 0 && request.removeVenues === undefined && request.addVenues === undefined) {
            throw new ClientFacingError('no operations provided');
        }

        let result;
        try {
            const userIDFilter = request.localOnly ? { author: request.userID } : {};

            if (request.requestID) {
                _(request.requestID)
                    .trace('executing query with filter', update, userIDFilter);
            }

            result = await details.updateOne({ _id: new ObjectID(request.id), ...userIDFilter }, update);
        } catch (e) {
            if (request.requestID) {
                _(request.requestID)
                    .debug('received error', e);
            }

            if (e.code === 11000) {
                throw new ClientFacingError('duplicate entity provided');
            }

            throw e;
        }

        if (request.requestID) {
            _(request.requestID)
                .trace('got result', result);
        }

        if (result.matchedCount === 0) {
            throw new ClientFacingError('invalid entity ID');
        }

        if (result.result.ok !== 1) {
            throw new Error('failed to update');
        }

        return [request.id];
    }

    async retrieveChangelog(eventID: string): Promise<Changelog[]> {
        if (this._changelog === undefined) throw new Error('changelog was not initialised');

        return (await this._changelog.find({
            id: eventID,
        })
            .toArray()).map((value) => ({
            change: value.action,
            id: value._id,
            occurred: value.timestamp,
        }));
    }

}
