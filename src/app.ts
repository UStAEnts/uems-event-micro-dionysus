import * as fs from 'fs';
import { RequestHandler } from 'express';
import { Database } from './EventDetailsConnector';
import { Messaging } from './messaging';
import morgan from 'morgan';
import express = require('express');
import cookieParser = require('cookie-parser');

import * as MongoClient from 'mongodb';

// The topic used for messages destined to microservices of this type.
const EVENT_DETAILS_SERVICE_TOPIC: string = 'events.details.*';

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
    if (content.name != '') {
        Object.assign(query, {name: content.name});
    }

    if (content.start_date_before != '') {
        Object.assign(query, {start_date_before: content.start_date_before});
    }

    if (content.start_date_after != '') {
        Object.assign(query, {start_date_after: content.start_date_after});
    }

    if (content.end_date_before != '') {
        Object.assign(query, {end_date_before: content.end_date_before});
    }
    
    if (content.end_date_after != '') {
        Object.assign(query, {end_date_after: content.end_date_after});
    }

    return query;
}

async function handleUnsupportedOp(content: any): Promise<string | null> {
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

async function handleAddReq(db: Database.EventDetailsConnector, content: any): Promise<string | null> {
    const event = extractEvent(content);

    // TODO, proper event rejection.
    if (event == null) { return null; }

    const result = await db.insertEvent(event);

    return JSON.stringify(result);
}

async function handleQueryReq(db: Database.EventDetailsConnector, content: any): Promise<string | null> {
    const query = generate_query(content);

    const data = await db.retrieveQuery(query);

    

    return JSON.stringify(data);
}

async function handleModifyReq(db: Database.EventDetailsConnector, content: any): Promise<string | null> {
    // TODO find and update only part of the event.
    // TODO, treating events as immutable with version controlled/timestamped modifications.
    // TODO, some check for mutual exclusion / checking an event isn't modified in such a way that 2 clients
    //          have an inconsistent view of teh event.

    if (content.event_id == undefined) {
        // TODO, real verification.
        return null;
    }

    const new_event = extractEvent(content);

    console.log("New event start date: " + new_event?.start_date);

    const event_id = content.event_id;

    const result = await db.findAndModifyEvent(event_id, new_event);

    // TODO, processing response result beyond just returning the result.

    return JSON.stringify(result);
}

async function reqReceived(content: any): Promise<string | null> {
    // TODO: checks for message integrity.

    if (content == null || eventsDb == null) {
        // Blank (null content) messages are ignored.
        // If the eventsDb connector is null then the microservice isn't ready and the message is dropped.

        console.log('Message content null or DB not ready!, message dropped');
        return null;
    }

    switch (content.type) {
        case 'query':
            return handleQueryReq(eventsDb, content);
        case 'add':
            return handleAddReq(eventsDb, content);
        case 'modify':
            return handleModifyReq(eventsDb, content);
        default:
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
                'rabbit-mq-config.json',
                reqReceived,
                [EVENT_DETAILS_SERVICE_TOPIC],
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
