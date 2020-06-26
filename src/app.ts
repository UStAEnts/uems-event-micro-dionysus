import express = require('express');
import cookieParser = require('cookie-parser');
import logger = require('morgan');

import * as fs from 'fs';
import { RequestHandler } from "express";

import { Database } from "./EventDetailsConnector";
import { Db } from "mongodb";


let eventsDb: Database.EventDetailsConnector | null = null;

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
function databaseConnectionReady(eventsConnection: Database.EventDetailsConnector | null) {
    console.log('database connection is ready');

    eventsDb = eventsConnection;
    app.listen(app.get('port'));

    console.log('started event micro dionysus');
}

console.log('starting event micro dionysus');

export const app = express();
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({
    extended: false,
}));
app.use(cookieParser());

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
