/* eslint-disable @typescript-eslint/dot-notation */
import { DataHandlerInterface } from './DataHandlerInterface';
import { EventDatabaseInterface } from '../type/impl/EventDatabaseInterface';
import { FilterQuery, MatchKeysAndValues, ObjectID, UpdateQuery } from 'mongodb';
import { EventMessage, EventResponse, MsgStatus } from '@uems/uemscommlib';
import ReadEventMessage = EventMessage.ReadEventMessage;
import CreateEventMessage = EventMessage.CreateEventMessage;
import UpdateEventMessage = EventMessage.UpdateEventMessage;
import DeleteEventMessage = EventMessage.DeleteEventMessage;
import EventResponseMessage = EventResponse.EventResponseMessage;
import InternalEvent = EventResponse.InternalEvent;
import ShallowInternalEvent = EventResponse.ShallowInternalEvent;
import EventServiceReadResponseMessage = EventResponse.EventServiceReadResponseMessage;
import { _byFile } from "../../logging/Log";

const _l = _byFile(__filename);

export class EventInterface implements DataHandlerInterface<ReadEventMessage,
    CreateEventMessage,
    UpdateEventMessage,
    DeleteEventMessage,
    EventResponseMessage,
    EventServiceReadResponseMessage> {

    protected _db: EventDatabaseInterface;

    constructor(db: EventDatabaseInterface) {
        this._db = db;
    }

    private static convertReadRequestToDatabaseQuery(request: ReadEventMessage) {
        const query: FilterQuery<ShallowInternalEvent> = {};

        if (request.id !== undefined) {
            if (ObjectID.isValid(request.id)) {
                query._id = new ObjectID(request.id);
            } else {
                throw new Error('Invalid ID');
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

        return query;
    }

    async create(request: CreateEventMessage): Promise<EventResponseMessage> {
        // @ts-ignore
        const event: ShallowInternalEvent = {
            name: request.name,
            start: request.start,
            end: request.end,
            venues: request.venueIDs,
            ents: request.entsID,
            state: request.stateID,
            attendance: request.attendance,
        };

        try {
            _l.debug('performing a create request for events', { event });

            const result = await this._db.insert(event);

            if (result.id) {
                return {
                    msg_id: request.msg_id,
                    msg_intention: 'CREATE',
                    result: [result.id],
                    status: MsgStatus.SUCCESS,
                    userID: request.userID,
                };
            }

            _l.warn('create request failed because id was not provided', { result });

            return {
                msg_id: request.msg_id,
                msg_intention: 'CREATE',
                result: [result.err_msg === undefined ? '' : result.err_msg],
                status: MsgStatus.FAIL,
                userID: request.userID,
            };
        } catch (e) {
            _l.warn('create request failed due to a raised error', { e });
            return {
                msg_id: request.msg_id,
                msg_intention: 'CREATE',
                result: ['Failed to create the evenn the backing store'],
                status: MsgStatus.FAIL,
                userID: request.userID,
            };
        }
    }

    async delete(request: DeleteEventMessage): Promise<EventResponseMessage> {
        _l.debug(`performing an events delete request for id: ${request.id}`);

        const result = await this._db.remove(request.id);

        if (!result) {
            _l.warn('delete request for events failed as result as falsy', { result });
        }

        return {
            msg_id: request.msg_id,
            msg_intention: 'DELETE',
            result: [request.id],
            status: (result ? MsgStatus.SUCCESS : MsgStatus.FAIL),
            userID: request.userID,
        };
    }

    async modify(request: UpdateEventMessage): Promise<EventResponseMessage> {
        const update: UpdateQuery<InternalEvent> = {};
        update.$set = {} as MatchKeysAndValues<InternalEvent>;

        // TODO: figure out why this is a dumpster fire of ts-ignores.

        if (request.name) {
            // @ts-ignore
            update.$set['name'] = request.name;
        }
        if (request.start) {
            // @ts-ignore
            update.$set['start'] = request.start;
        }
        if (request.end) {
            // @ts-ignore
            update.$set['end'] = request.end;
        }
        if (request.attendance) {
            // @ts-ignore
            update.$set['attendance'] = request.attendance;
        }
        if (request.venueIDs) {
            // @ts-ignore
            update.$set['venues'] = request.venueIDs;
        }
        if (request.entsID) {
            // @ts-ignore
            update.$set['ents'] = request.entsID;
        }
        if (request.stateID) {
            // @ts-ignore
            update.$set['state'] = request.stateID;
        }

        _l.debug('performing an events modify request with', { update });

        // Update database
        const result = await (this._db as EventDatabaseInterface).modify(request.id, update);

        if (!result) {
            _l.warn('update request failed because result was falsy', { result });
        }

        // Return updated result
        return {
            msg_id: request.msg_id,
            msg_intention: 'UPDATE',
            result: [request.id],
            status: (result ? MsgStatus.SUCCESS : MsgStatus.FAIL),
            userID: request.userID,
        };
    }

    async read(request: ReadEventMessage): Promise<EventServiceReadResponseMessage> {
        const query = EventInterface.convertReadRequestToDatabaseQuery(request);

        _l.debug('performing a query for events values:', { query });

        const data: ShallowInternalEvent[] = await this._db.retrieve(query);

        // Removed undefined/null values
        // source: https://stackoverflow.com/a/38340374
        data.forEach((obj) => Object.keys(obj)
            // @ts-ignore
            // eslint-disable-next-line no-param-reassign
            .forEach((key) => (obj[key] === null || obj[key] === undefined) && delete obj[key]));

        return {
            msg_id: request.msg_id,
            msg_intention: 'READ',
            result: data,
            status: MsgStatus.SUCCESS,
            userID: request.userID,
        };
    }

}
