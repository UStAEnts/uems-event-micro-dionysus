import { Database } from './DatabaseConnector';
import { Messaging } from './MessageConnector';
import morgan from 'morgan';
import express = require('express');
import cookieParser = require('cookie-parser');

const fs = require('fs').promises;

import { EventRes, EventMsg } from '@uems/uemscommlib';

// The topic used for messages destined to microservices of this type.
const EVENT_DETAILS_SERVICE_TOPIC: string = 'events.details.*';

// The path to the rabbitMQ config which is used to connect to the messaging system.
const RABBIT_MQ_CONFIG_PATH: string = 'rabbit-mq-config.json';

export const app = express();

let eventsDb: Database.DatabaseConnector | null = null;

// /**
//  * Handles errors raised by the given function (wrapped in a promise) which will handle it by passing it to the next
//  * function provided by express. Returns a handler function which can be passed to express
//  * @param fn the request handler for this function
//  * @return a handler which can be passed to express
//  */
// const asyncErrorCatcher = (fn: RequestHandler): RequestHandler => ((req, res, next) => {
//     Promise.resolve(fn(req, res, next)).catch(next);
// });

// TODO, remove :any usage.
function generateQuery(content: EventMsg.ReadEventMsg): Database.UemsQuery {
    const query = {};

    // There is probably a better way to do this - maybe a content.map(|v| if (v.isEmpty()){remove(v)}) type thing.
    if (content.event_name !== undefined) {
        Object.assign(query, { name: content.event_name });
    }

    if (content.event_start_date_range_begin !== undefined) {
        Object.assign(query, { start_date_before: content.event_start_date_range_begin });
    }

    if (content.event_start_date_range_end !== undefined) {
        Object.assign(query, { start_date_after: content.event_start_date_range_end });
    }

    if (content.event_end_date_range_begin !== undefined) {
        Object.assign(query, { end_date_before: content.event_end_date_range_begin });
    }

    if (content.event_end_date_range_end !== undefined) {
        Object.assign(query, { end_date_after: content.event_end_date_range_end });
    }

    return query;
}

async function handleUnsupportedOp(content: any): Promise<EventRes.RequestResponseMsg | null> {
    console.error('Unsupported operation: ');
    console.error(content.msg_intention);
    return null;
}

async function handleAddReq(
    db: Database.DatabaseConnector,
    content: EventMsg.CreateEventMsg,
): Promise<EventRes.RequestResponseMsg | null> {
    const event: Database.UemsEvent = {
        id: '0', // Placeholder.
        name: content.event_name,
        start_date: content.event_start_date,
        end_date: content.event_end_date,
        venue: content.venue_ids,
    };

    // TODO, proper event checks.
    if (event == null) { return null; }

    const result: Database.InsertEventResult = await db.insertEvent(event);

    if (result.event_id !== undefined) {
        return {
            msg_id: content.msg_id,
            status: EventRes.MsgStatus.SUCCESS,
            msg_intention: content.msg_intention,
            result: [result.event_id],
        };
    }

    return {
        msg_id: content.msg_id,
        status: EventRes.MsgStatus.FAIL,
        msg_intention: content.msg_intention,
        result: [result.err_msg === undefined ? '' : result.err_msg],
    };
}

async function handleQueryReq(
    db: Database.DatabaseConnector,
    content: EventMsg.ReadEventMsg,
): Promise<EventRes.ReadRequestResponseMsg | null> {
    const query = generateQuery(content);

    const data: Database.UemsEvent[] = await db.retrieveQuery(query);

    const resultData: EventRes.InternalEvent[] = data.map((e: Database.UemsEvent) => ({
        event_id: e.id,
        event_name: e.name,
        event_start_date: e.start_date,
        event_end_date: e.end_date,
        venue_ids: JSON.stringify(['0']),
        attendance: 0,
    }));

    const msg: EventRes.ReadRequestResponseMsg = {
        msg_id: content.msg_id,
        status: EventRes.MsgStatus.SUCCESS,
        msg_intention: content.msg_intention,
        result: resultData,
    };

    return msg;
}

async function handleModifyReq(
    db: Database.DatabaseConnector,
    content: EventMsg.UpdateEventMsg,
): Promise<EventRes.RequestResponseMsg | null> {
    // TODO, treating events as immutable with version controlled/timestamped modifications.
    // TODO, some check for mutual exclusion / checking an event isn't modified in such a way that 2 clients
    //          have an inconsistent view of the event.

    if (content.event_id === undefined) {
        // TODO, real verification.
        return null;
    }

    const newEvent = {
        id: content.event_id, // Placeholder.
        name: content.event_name,
        start_date: content.event_start_date,
        end_date: content.event_end_date,
        venue: content.venue_ids,
    };

    const result = await db.findAndModifyEvent(content.event_id, newEvent);

    const msg: EventRes.RequestResponseMsg = {
        msg_id: content.msg_id,
        status: (result ? EventRes.MsgStatus.SUCCESS : EventRes.MsgStatus.FAIL),
        msg_intention: content.msg_intention,
        result: [content.event_id],
    };

    return msg;
}

async function handleDeleteReq(
    db: Database.DatabaseConnector,
    content: EventMsg.DeleteEventMsg,
): Promise<EventRes.RequestResponseMsg | null> {
    // TODO, treating events as immutable with version controlled/timestamped modifications.
    // TODO, some check for mutual exclusion / checking an event isn't modified in such a way that 2 clients
    //          have an inconsistent view of the event.

    if (content.event_id === undefined) {
        // TODO, real verification.
        return null;
    }

    // TODO, check remove event successful.
    const result = await db.removeEvent(content.event_id);

    const msg: EventRes.RequestResponseMsg = {
        msg_id: content.msg_id,
        status: (result ? EventRes.MsgStatus.SUCCESS : EventRes.MsgStatus.FAIL),
        msg_intention: content.msg_intention,
        result: [content.event_id],
    };

    return msg;
}

async function reqReceived(
    content: any,
): Promise<EventRes.RequestResponseMsg | EventRes.ReadRequestResponseMsg | null> {
    // TODO: checks for message integrity.

    if (content == null || eventsDb == null) {
        // Blank (null content) messages are ignored.
        // If the eventsDb connector is null then the microservice isn't ready and the message is dropped.

        console.log('Message content null or DB not ready!, message dropped');
        return null;
    }

    switch (content.msg_intention) {
        case 'READ': return handleQueryReq(eventsDb, content);
        case 'CREATE': return handleAddReq(eventsDb, content);
        case 'UPDATE': return handleModifyReq(eventsDb, content);
        case 'DELETE': return handleDeleteReq(eventsDb, content);
        default: return handleUnsupportedOp(content);
    }
}

/**
 * Callback for the database being prepared. Will set events db instance and make the app listen on the port defined in
 * the express app
 * @param eventsConnection the resolved database object
 */
async function databaseConnectionReady(eventsConnection: Database.DatabaseConnector) {
    console.log('database connection is ready');

    eventsDb = eventsConnection;

    await Messaging.Messenger.setup(
        RABBIT_MQ_CONFIG_PATH,
        reqReceived,
        [EVENT_DETAILS_SERVICE_TOPIC],
    );

    app.listen(process.env.PORT, () => {
        console.log('Event micro dionysus started successfully');
    });
}

async function setup() {
    // Start of the mongoDB connection.
    // The connection info (including username / password) is read from configuration file.
    const data = await fs.readFile('database.json', { encoding: 'utf-8' });

    console.log('Database.json file opened successfully...');

    const dbInfo = JSON.parse(data);

    Database.connect(dbInfo.uri).then(databaseConnectionReady).catch((e) => {
        console.error('Event details microservice failed to connect to database... exiting');
        console.error(e.message);
        process.exit(1);
    });
}

console.log('Starting event micro dionysus...');

app.set('port', process.env.PORT || 15550);

app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({
    extended: false,
}));
app.use(cookieParser());

setup();
