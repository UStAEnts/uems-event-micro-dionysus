import express = require('express');
import cookieParser = require('cookie-parser');
import logger = require('morgan');

import * as fs from 'fs';
import { RequestHandler} from "express";

import { Database } from "./EventDetailsConnector";
import { Messaging } from "./messaging";

// The topic used for messages destined to microservices of this type.
const EVENT_DETAILS_SERVICE_TOPIC: string = "events.details.*";

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


async function reqReceived(content: JSON): Promise<string | null> {
    // TODO: checks for message integrity.
    
    console.log("Request received: " + content);
    console.log("Handling request...");

    if (content == null || eventsDb == null) {
        // Blank (null content) messages are ignored.
        // If the eventsDb connector is null then the microservice isn't ready and the message is dropped.

        console.log("Message content null or DB not ready!, message dropped");
        return null;
    }

    console.log("Message content");

    const data = await eventsDb.retrieveQuery(content);

    console.log("Response got");

    return JSON.stringify(data);
}


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
            messenger = await Messaging.Messenger.setup("rabbit-mq-config.json", reqReceived, [EVENT_DETAILS_SERVICE_TOPIC]);
            break;
        } catch(err) {
            console.log("Attempting to reconnect to RabbitMQ....");
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    app.listen(process.env.PORT, function () {
        console.log("Event micro dionysus started successfully");
    });
}

console.log("Starting event micro dionysus...");

export const app = express();

app.set('port', process.env.PORT || 15550);

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({
    extended: false,
}));
app.use(cookieParser());

// Setup some listeners
app.get('/test_get_events', asyncErrorCatcher(async (req, res, next) => {
    if (eventsDb === null) {
        console.error('failed to get events because database was null');
        throw new Error('eventsDB was null');
    }

    eventsDb.retrieveAllEvents().then(function (data) {
        console.log(data);
        res.json(data);
    });
}))


app.post('/', (req, res) => {
    return res.send("Test Path, Post Req Received")
});

// Start of the mongoDB connection.
// The connection info (including username / password) is read from configuration file.
fs.readFile("database.json", { encoding: "utf-8" }, function (err, data) {
    if (err) {
        console.error("Failed to read database.json file... database connection failed...");
        return;
    }

    console.log("Database.json file opened successfully...");

    const db_info = JSON.parse(data);

    Database.connect(db_info.uri).then(databaseConnectionReady).catch((err) => {
        console.error("Event details microservice failed to connect to database... exiting");
        console.error(err.message);
        process.exit(1);
    });
});
