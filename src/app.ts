import express = require('express');
import cookieParser = require('cookie-parser');
import logger = require('morgan');

import { createServer } from 'http';
import * as fs from 'fs';
import { RequestHandler } from "express";

import { Database } from "./EventDetailsConnector";


let eventsDb: Database.EventDetailsConnector | null = null;
let httpServer;

/**
 * Handles errors raised by the given function (wrapped in a promise) which will handle it by passing it to the next
 * function provided by express. Returns a handler function which can be passed to express
 * @param fn the request handler for this function
 * @return a handler which can be passed to express
 */
const asyncErrorCatcher = (fn: RequestHandler): RequestHandler => ((req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
});

/**
 * Callback for the database being prepared. Will set events db instance and make the app listen on the port defined in
 * the express app
 * @param eventsConnection the resolved database object
 */
function databaseConnectionReady(eventsConnection: Database.EventDetailsConnector) {
    console.log('database connection is ready');

    eventsDb = eventsConnection;

    httpServer = createServer(app);

    httpServer.on('error',
        /**
         * On error, handles listen errors from the http server (specifically EACCES and EADDRINUSE) and will rethrow
         * the error if not handled.
         * @param error the error provided by the http server
         */
        (error) => {
            if (error.syscall !== 'listen') {
                throw error;
            }

            let bind = typeof app.get('port') === 'string'
                ? 'Pipe ' + app.get('port')
                : 'Port ' + app.get('port');

            // handle specific listen errors with friendly messages
            switch (error.code) {
                case 'EACCES':
                    console.error(bind + ' requires elevated privileges');
                    process.exit(1);
                    break;
                case 'EADDRINUSE':
                    console.error(bind + ' is already in use');
                    process.exit(1);
                    break;
                default:
                    throw error;
            }
        }
    );
    httpServer.on('listening',
        /**
         * On listening handler which will print out the port the server is listening on
         */
        () => {
            let addr = httpServer.address();

            let bind;

            if (addr === null) {
                bind = 'null value';
            } else if (typeof (addr) === "string") {
                bind = `pipe ${addr}`;
            } else {
                bind = `port ${addr.port}`;
            }

            console.log(`started event micro dionysus on :${bind}`);
        }
    );

    httpServer.listen(app);
}

console.log('starting event micro dionysus');

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
