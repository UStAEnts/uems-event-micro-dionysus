import { Database } from './DatabaseConnector';
import { Messaging } from './MessageConnector';
import morgan from 'morgan';
import express = require('express');
import cookieParser = require('cookie-parser');

const fs = require('fs').promises;

import { EventRes } from '@uems/uemscommlib';
import { EventInterface } from './database/interface/EventInterface';
import { EventDatabaseInterface } from './database/type/impl/EventDatabaseInterface';
import { EntStateDatabaseInterface } from './database/type/impl/EntStateDatabaseInterface';
import DatabaseConnections = Database.DatabaseConnections;
import MessageResponses = Messaging.MessageResponses;
import { EntStateInterface } from './database/interface/EntStateInterface';

// The topic used for messages destined to microservices of this type.
const EVENT_DETAILS_SERVICE_TOPIC: string = 'events.details.*';
const ENT_STATE_DETAILS_SERVICE_TOPIC: string = 'ents.details.*';

// The path to the rabbitMQ config which is used to connect to the messaging system.
const RABBIT_MQ_CONFIG_PATH: string = 'rabbit-mq-config.json';

export const app = express();

let eventDB: EventDatabaseInterface | null = null;
let stateDB: EntStateDatabaseInterface | null = null;

let eventInterface: EventInterface | null = null;
let stateInterface: EntStateInterface | null = null;

async function handleUnsupportedOp(content: any): Promise<EventRes.RequestResponseMsg | null> {
    console.error('Unsupported operation: ');
    console.error(content.msg_intention);
    return null;
}

async function reqReceived(
    routingKey: string,
    content: any,
): Promise<MessageResponses | null> {
    // TODO: checks for message integrity.

    if (routingKey && routingKey.startsWith('event.')) {
        if (content == null || eventDB == null || eventInterface == null) {
            // Blank (null content) messages are ignored.
            // If the eventsDb connector is null then the microservice isn't ready and the message is dropped.

            console.log('Message content null or DB not ready!, message dropped');
            return null;
        }

        switch (content.msg_intention) {
            case 'READ':
                return eventInterface.read(content);
            case 'CREATE':
                return eventInterface.create(content);
            case 'UPDATE':
                return eventInterface.modify(content);
            case 'DELETE':
                return eventInterface.delete(content);
            default:
                return handleUnsupportedOp(content);
        }
    }

    if (routingKey && routingKey.startsWith('ent.')) {
        if (content == null || stateDB == null || stateInterface == null) {
            // Blank (null content) messages are ignored.
            // If the eventsDb connector is null then the microservice isn't ready and the message is dropped.

            console.log('Message content null or DB not ready!, message dropped');
            return null;
        }

        switch (content.msg_intention) {
            case 'READ':
                return stateInterface.read(content);
            case 'CREATE':
                return stateInterface.create(content);
            case 'UPDATE':
                return stateInterface.modify(content);
            case 'DELETE':
                return stateInterface.delete(content);
            default:
                return handleUnsupportedOp(content);
        }
    }

    return null;
}

/**
 * Callback for the database being prepared. Will set events db instance and make the app listen on the port defined in
 * the express app
 * @param eventsConnection the resolved database object
 */
async function databaseConnectionReady(eventsConnection: DatabaseConnections) {
    console.log('database connection is ready');

    eventDB = eventsConnection.event;
    stateDB = eventsConnection.ent;
    eventInterface = new EventInterface(eventDB);
    stateInterface = new EntStateInterface(stateDB);

    await Messaging.Messenger.setup(
        RABBIT_MQ_CONFIG_PATH,
        reqReceived,
        [EVENT_DETAILS_SERVICE_TOPIC, ENT_STATE_DETAILS_SERVICE_TOPIC],
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

    Database.connect(dbInfo)
        .then(databaseConnectionReady)
        .catch((e) => {
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
