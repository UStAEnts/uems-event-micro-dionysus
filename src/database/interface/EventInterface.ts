import { DataHandlerInterface } from './DataHandlerInterface';
import { CreateEventMsg, DeleteEventMsg, ReadEventMsg, UpdateEventMsg, } from '@uems/uemscommlib/build/messaging/types/event_message_schema';
import { InternalEvent, MsgIntention, MsgStatus, ReadRequestResponseMsg, RequestResponseMsg, } from '@uems/uemscommlib/build/messaging/types/event_response_schema';
import { Event, EventDatabaseInterface, EventQuery } from '../type/impl/EventDatabaseInterface';
import { ObjectID } from "mongodb";

export class EventInterface implements DataHandlerInterface<ReadEventMsg,
    CreateEventMsg,
    UpdateEventMsg,
    DeleteEventMsg,
    RequestResponseMsg,
    ReadRequestResponseMsg> {

    protected _db: EventDatabaseInterface;

    constructor(db: EventDatabaseInterface) {
        this._db = db;
    }

    private static convertReadRequestToDatabaseQuery(request: ReadEventMsg): EventQuery {
        const query = {};

        if (request.event_id !== undefined) {
            Object.assign(query, { _id: new ObjectID(request.event_id) });
        }

        // There is probably a better way to do this - maybe a content.map(|v| if (v.isEmpty()){remove(v)}) type thing.
        if (request.event_name !== undefined) {
            Object.assign(query, { name: request.event_name });
        }

        if (request.event_start_date_range_begin !== undefined) {
            Object.assign(query, { start_date_before: request.event_start_date_range_begin });
        }

        if (request.event_start_date_range_end !== undefined) {
            Object.assign(query, { start_date_after: request.event_start_date_range_end });
        }

        if (request.event_end_date_range_begin !== undefined) {
            Object.assign(query, { end_date_before: request.event_end_date_range_begin });
        }

        if (request.event_end_date_range_end !== undefined) {
            Object.assign(query, { end_date_after: request.event_end_date_range_end });
        }

        return query;
    }

    async create(request: CreateEventMsg): Promise<RequestResponseMsg> {
        const event: Event = {
            id: '0', // Placeholder.
            name: request.event_name,
            start_date: request.event_start_date,
            end_date: request.event_end_date,
            venue: request.venue_ids,
            // Get rid of this as soon as possible, move to request
            attendance:request.predicted_attendance,
        };

        // TODO, proper event checks.
        if (event === null) {
            return {
                msg_id: request.msg_id,
                msg_intention: MsgIntention.CREATE,
                result: ['Invalid event'],
                status: MsgStatus.FAIL,
            };
        }

        try {
            const result = await this._db.insert(event);

            if (result.id) {
                return {
                    msg_id: request.msg_id,
                    msg_intention: MsgIntention.CREATE,
                    result: [result.id],
                    status: MsgStatus.SUCCESS,
                };
            }

            return {
                msg_id: request.msg_id,
                msg_intention: MsgIntention.CREATE,
                result: [result.err_msg === undefined ? '' : result.err_msg],
                status: MsgStatus.FAIL,
            };
        } catch (e) {
            return {
                msg_id: request.msg_id,
                msg_intention: MsgIntention.CREATE,
                result: ['Failed to create the evenn the backing store'],
                status: MsgStatus.FAIL,
            };
        }
    }

    async delete(request: DeleteEventMsg): Promise<RequestResponseMsg> {
        if (request.event_id === undefined) {
            return {
                msg_id: request.msg_id,
                msg_intention: MsgIntention.DELETE,
                result: ['Invalid request, event_id was not specified'],
                status: MsgStatus.FAIL,
            };
        }

        const result = await this._db.remove(request.event_id);

        return {
            msg_id: request.msg_id,
            msg_intention: MsgIntention.DELETE,
            result: [request.event_id],
            status: (result ? MsgStatus.SUCCESS : MsgStatus.FAIL),
        };
    }

    async modify(request: UpdateEventMsg): Promise<RequestResponseMsg> {
        const required: (keyof UpdateEventMsg)[] = [
            'event_id',
            'event_name',
            'event_start_date',
            'event_end_date',
            'venue_ids',
        ];

        // Validate properties
        for (const key of required) {
            if (request[key] === undefined) {
                return {
                    msg_id: request.msg_id,
                    msg_intention: MsgIntention.UPDATE,
                    result: [`Invalid request, '${key}' was not specified`],
                    status: MsgStatus.FAIL,
                };
            }
        }

        const event: Event = {
            id: request.event_id,
            name: request.event_name as string,
            start_date: request.event_start_date as number,
            end_date: request.event_end_date as number,
            venue: request.venue_ids as string[],
            // TODO: convert this to an actual parameter?
            attendance: 0,
        };

        // Update database
        const result = await this._db.modify(request.event_id, event);

        // Return updated result
        return {
            msg_id: request.msg_id,
            msg_intention: MsgIntention.UPDATE,
            result: [request.event_id],
            status: (result ? MsgStatus.SUCCESS : MsgStatus.FAIL),
        };
    }

    async read(request: ReadEventMsg): Promise<ReadRequestResponseMsg> {
        const query = EventInterface.convertReadRequestToDatabaseQuery(request);
        const data: Event[] = await this._db.retrieve(query);

        const converted: InternalEvent[] = data.map((event) => ({
            event_id: event.id,
            event_name: event.name,
            event_start_date: event.start_date,
            event_end_date: event.end_date,
            venue_ids: JSON.stringify(event.venue),
            // TODO: migrate to database
            attendance: event.attendance,
            ents: event.ents,
            state: event.state,
        }));

        return {
            msg_id: request.msg_id,
            msg_intention: MsgIntention.READ,
            result: converted,
            status: MsgStatus.SUCCESS,
        };
    }

}
