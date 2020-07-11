import * as fs from 'fs';
import { RequestHandler } from 'express';
import { Database } from './EventDetailsConnector';
import { Messaging } from './messaging';
import morgan from 'morgan';
import express = require('express');
import cookieParser = require('cookie-parser');

import {RequestResponseMsg, MsgStatus, ReadRequestResponseMsg, ReadRequestResponseResult} from './schema/types/event_response_schema';

import * as MongoClient from 'mongodb';

// The topic used for messages destined to microservices of this type.
const EVENT_DETAILS_SERVICE_TOPIC: string = 'events.details.*';

// A path to the .json file which describes valid message schema.
const MESSAGE_SCHEMA_PATH: string = 'schema/event_schema.json';

// The path to the rabbitMQ config which is used to connect to the messaging system.
const RABBIT_MQ_CONFIG_PATH: string = 'rabbit-mq-config.json';

let eventsDb: Database.EventDetailsConnector | null = null;
let messenger: Messaging.Messenger;

/**
 * Handles errors raised by the given function (wrapped in a promise) which will handle it by passing it to the next
 * function provided by express. Returns a handler function which can be passed to express
 * @param fn the request handler for this function
 * @return a handler which can be passed to express
 */
const asyncErrorCatcher = (fn: RequestHandler): RequestHandler => ((req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
});

// TODO, remove :any usage.
function generate_query(content: any): any {
    let query = {};

    // There is probably a better way to do this - maybe a content.map(|v| if (v.isEmpty()){remove(v)}) type thing. 
    if (content.name !== undefined) {
        Object.assign(query, {name: content.name});
    }

    if (content.start_date_before !== undefined) {
        Object.assign(query, {start_date_before: content.start_date_before});
    }

    if (content.start_date_after !== undefined) {
        Object.assign(query, {start_date_after: content.start_date_after});
    }

    if (content.end_date_before !== undefined) {
        Object.assign(query, {end_date_before: content.end_date_before});
    }
    
    if (content.end_date_after !== undefined) {
        Object.assign(query, {end_date_after: content.end_date_after});
    }

    return query;
}

async function handleUnsupportedOp(content: any): Promise<RequestResponseMsg | null>  {
    console.error("Unsupported operation: ");
    console.error(content.msg_intention);
    return null;
}


// Extracts the event out of an event message. 
function extractEvent(content: any) {
    if (content.name == undefined || content.start_date == undefined || 
        content.end_date == undefined || content.venue == undefined) {
        // TODO, verification that the event doesn't already exist, that the event is valid.
        // This is far from real 'verification'.
        // TODO, checking venue exists.
        console.error("Event to insert missing required parts - dropped");
        console.log(content);
        return null;
    }

    return {
        name: content.name,
        // Date timestamp is set in milliseconds but communicated in seconds.
        start_date: new Date(parseFloat(content.start_date) * 1000), 
        end_date: new Date(parseFloat(content.end_date) * 1000),
        venue: content.venue
    };
}

async function handleAddReq(db: Database.EventDetailsConnector, content: any): Promise<RequestResponseMsg | null>  {
    const event = extractEvent(content);

    // TODO, proper event rejection.
    if (event == null) { return null; }

    const result = await db.insertEvent(event);

    let msg: RequestResponseMsg = {
        msg_id: content.msg_id,
        status: (result ? MsgStatus.SUCCESS: MsgStatus.FAIL),
        msg_intention: content.msg_intention,
        result: [content.event_id]
    };

    return msg;
}

async function handleQueryReq(db: Database.EventDetailsConnector, content: any): Promise<ReadRequestResponseMsg | null> {
    const query = generate_query(content);

    let data: Database.UemsEvent[] = await db.retrieveQuery(query);

    console.log("Query data");
    console.log(data);

    let result_data: ReadRequestResponseResult[] = data.map((e: Database.UemsEvent) => {
        return {
            event_id: e._id,
            event_name: e.name,
            event_start_date: e.start_date,
            event_end_date: e.end_date,
            venue_ids: JSON.stringify(["0"]),
            attendance: 0
        }
    });

    let msg: ReadRequestResponseMsg = {
        msg_id: content.msg_id,
        status: MsgStatus.SUCCESS,
        msg_intention: content.msg_intention,
        result: result_data
    };

    return msg;
}

async function handleModifyReq(db: Database.EventDetailsConnector, content: any): Promise<RequestResponseMsg | null> {
    // TODO find and update only part of the event.
    // TODO, treating events as immutable with version controlled/timestamped modifications.
    // TODO, some check for mutual exclusion / checking an event isn't modified in such a way that 2 clients
    //          have an inconsistent view of the event.

    if (content.event_id == undefined) {
        // TODO, real verification.
        return null;
    }

    const new_event = extractEvent(content);

    console.log("New event start date: " + new_event?.start_date);

    const result = await db.findAndModifyEvent(content.event_id, new_event);

    let msg: RequestResponseMsg = {
        msg_id: content.msg_id,
        status: (result ? MsgStatus.SUCCESS: MsgStatus.FAIL),
        msg_intention: content.msg_intention,
        result: [content.event_id]
    };

    return msg;
}

async function handleDeleteReq(db: Database.EventDetailsConnector, content: any): Promise<RequestResponseMsg | null> {
    // TODO, treating events as immutable with version controlled/timestamped modifications.
    // TODO, some check for mutual exclusion / checking an event isn't modified in such a way that 2 clients
    //          have an inconsistent view of the event.
    
    if (content.event_id == undefined) {
        // TODO, real verification.
        return null;
    }

    // TODO, check remove event successful.
    const result = await db.removeEvent(content.event_id);

    let msg: RequestResponseMsg = {
        msg_id: content.msg_id,
        status: (result ? MsgStatus.SUCCESS: MsgStatus.FAIL),
        msg_intention: content.msg_intention,
        result: [content.event_id]
    };

    return msg;
}

async function reqReceived(content: any): Promise<RequestResponseMsg | ReadRequestResponseMsg | null> {
    // TODO: checks for message integrity.

    if (content == null || eventsDb == null) {
        // Blank (null content) messages are ignored.
        // If the eventsDb connector is null then the microservice isn't ready and the message is dropped.

        console.log('Message content null or DB not ready!, message dropped');
        return null;
    }

    switch (content.msg_intention) {
        case 'READ':
            return handleQueryReq(eventsDb, content);
        case 'CREATE':
            return handleAddReq(eventsDb, content);
        case 'UPDATE':
            return handleModifyReq(eventsDb, content);
        case 'DELETE':
            return handleDeleteReq(eventsDb, content);
        default:
            console.log(content);
            return handleUnsupportedOp(content);
    }
}

console.log('Starting event micro dionysus...');

export const app = express();

app.set('port', process.env.PORT || 15550);

app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({
    extended: false,
}));
app.use(cookieParser());

/**
 * Callback for the database being prepared. Will set events db instance and make the app listen on the port defined in
 * the express app
 * @param eventsConnection the resolved database object
 */
async function databaseConnectionReady(eventsConnection: Database.EventDetailsConnector) {
    console.log('database connection is ready');

    eventsDb = eventsConnection;

    // Repeatedly attempt to connect to RabbitMQ messaging system.
    while (true) {
        try {
            // no-await-in-loop: used to retry an action, ignored as per https://eslint.org/docs/rules/no-await-in-loop
            // @typescript-eslint/no-unused-vars: kept to retain code, TODO: is usage required?
            // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-await-in-loop
            messenger = await Messaging.Messenger.setup(
                RABBIT_MQ_CONFIG_PATH,
                reqReceived,
                [EVENT_DETAILS_SERVICE_TOPIC],
                MESSAGE_SCHEMA_PATH
            );
            break;
        } catch (err) {
            console.log('Attempting to reconnect to RabbitMQ....');

            // no-await-in-loop: used to retry an action, ignored as per https://eslint.org/docs/rules/no-await-in-loop
            // eslint-disable-next-line no-await-in-loop
            await new Promise((resolve) => setTimeout(resolve, 2000));
        }
    }

    app.listen(process.env.PORT, () => {
        console.log('Event micro dionysus started successfully');
    });
}

// Start of the mongoDB connection.
// The connection info (including username / password) is read from configuration file.
fs.readFile('database.json', { encoding: 'utf-8' }, (err, data) => {
    if (err) {
        console.error('Failed to read database.json file... database connection failed...');
        return;
    }

    console.log('Database.json file opened successfully...');

    const dbInfo = JSON.parse(data);

    Database.connect(dbInfo.uri).then(databaseConnectionReady).catch((e) => {
        console.error('Event details microservice failed to connect to database... exiting');
        console.error(e.message);
        process.exit(1);
    });
});
