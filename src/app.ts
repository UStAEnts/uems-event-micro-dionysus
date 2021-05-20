import { Database } from './DatabaseConnector';
import { Messaging } from './MessageConnector';
import morgan from 'morgan';
import { EventDatabase } from './database/type/impl/EventDatabaseInterface';
import { CommentResponse, MsgStatus, SignupResponse, BaseSchema, EventResponse } from '@uems/uemscommlib';
import { SignupDatabase } from './database/type/impl/SignupDatabaseInterface';
import { _byFile } from './logging/Log';
import express = require('express');
import cookieParser = require('cookie-parser');
import DatabaseConnections = Database.DatabaseConnections;
import MessageResponses = Messaging.MessageResponses;
import ShallowInternalComment = CommentResponse.ShallowInternalComment;
import ShallowInternalSignup = SignupResponse.ShallowInternalSignup;
import Intentions = BaseSchema.Intentions;
import ShallowInternalEvent = EventResponse.ShallowInternalEvent;
import { ClientFacingError, GenericCommentDatabase } from '@uems/micro-builder/build/src';

const fs = require('fs').promises;

const _l = _byFile(__filename);

// The topic used for messages destined to microservices of this type.
const EVENT_DETAILS_SERVICE_TOPIC: string = 'events.details.*';
const EVENT_COMMENTS_SERVICE_TOPIC: string = 'events.comment.*';
const EVENT_SIGNUPS_SERVICE_TOPIC: string = 'events.signups.*';

// The path to the rabbitMQ config which is used to connect to the messaging system.
const RABBIT_MQ_CONFIG_PATH: string = 'rabbit-mq-config.json';

export const app = express();

let eventDatabase: EventDatabase;
let commentDatabase: GenericCommentDatabase;
let signupDatabase: SignupDatabase;

const handleSignup = (
    content: any,
    signup: SignupDatabase,
): Promise<string[] | ShallowInternalSignup[]> => new Promise((resolve, reject) => {
    _l.debug(`received signup message for ${content.msg_intention}`);
    switch (content.msg_intention) {
        case 'CREATE':
            resolve(signup.create(content));
            break;
        case 'DELETE':
            resolve(signup.delete(content));
            break;
        case 'READ':
            resolve(signup.query(content));
            break;
        case 'UPDATE':
            resolve(signup.update(content));
            break;
        default:
            reject(new ClientFacingError(`invalid message intention: + ${content.msg_intention}`));
    }
});

const handleComment = (
    content: any,
    comment: GenericCommentDatabase,
): Promise<string[] | ShallowInternalComment[]> => new Promise((resolve, reject) => {
    _l.debug(`received comment message for ${content.msg_intention}`);
    switch (content.msg_intention) {
        case 'CREATE':
            resolve(comment.create(content));
            break;
        case 'DELETE':
            resolve(comment.delete(content));
            break;
        case 'READ':
            resolve(comment.query(content));
            break;
        case 'UPDATE':
            resolve(comment.update(content));
            break;
        default:
            reject(new ClientFacingError(`invalid message intention: + ${content.msg_intention}`));
    }
});

const handleEvent = async (content: any, event: EventDatabase): Promise<string[] | ShallowInternalEvent[]> => {
    _l.debug(`received comment message for ${content.msg_intention}`);
    switch (content.msg_intention) {
        case 'CREATE':
            return event.create(content);
        case 'DELETE':
            return event.delete(content);
        case 'READ':
            return event.query(content);
        case 'UPDATE':
            return event.update(content);
        default:
            throw new ClientFacingError(`invalid message intention: + ${content.msg_intention}`);
    }
};

async function wrapPromise<T>(
    id: number,
    intention: Intentions,
    userID: string,
    data: Promise<T>,
): Promise<{
    status: MsgStatus.SUCCESS | MsgStatus.FAIL | 500,
    msg_id: number,
    msg_intention: Intentions,
    userID: string,
    result: T | string[],
}> {
    try {
        const result = await data;
        return {
            msg_id: id,
            msg_intention: intention,
            status: MsgStatus.SUCCESS,
            userID,
            result,
        };
    } catch (e) {
        if (e instanceof ClientFacingError) {
            return {
                msg_id: id,
                msg_intention: intention,
                status: MsgStatus.FAIL,
                userID,
                result: [e.message],
            };
        }

        return {
            msg_id: id,
            msg_intention: intention,
            status: 500,
            userID,
            result: ['internal server error'],
        };
    }
}

async function reqReceived(
    routingKey: string,
    content: any,
): Promise<MessageResponses | null> {
    try {
        if (content === null) {
            _l.error('Recevied a content object that was null');
            return null;
        }

        // ----
        // -- HANDLE EVENT SIGNUPS
        // ----
        if (routingKey.startsWith('events.signups')) {
            if (signupDatabase === undefined) {
                _l.error('Signup database was not defined on request');
                return null;
            }

            // TODO :: fix typing
            return await wrapPromise(
                content.msg_id,
                content.msg_intention,
                content.userID,
                handleSignup(content, signupDatabase),
            ) as any;
        }

        // ----
        // -- HANDLE EVENT COMMENTS
        // ----
        if (routingKey.startsWith('events.comment')) {
            if (commentDatabase === undefined) {
                _l.error('Comment database was not defined on request');
                return null;
            }

            // TODO :: fix typing
            return await wrapPromise(
                content.msg_id,
                content.msg_intention,
                content.userID,
                handleComment(content, commentDatabase),
            ) as any;
        }

        // ----
        // -- HANDLE EVENTS
        // ----
        if (eventDatabase === undefined) {
            _l.error('Event database was not defined on request');
            return null;
        }

        _l.debug(`got an event message with intention ${content.msg_intention}`);

        // TODO :: fix typing
        return await wrapPromise(
            content.msg_id,
            content.msg_intention,
            content.userID,
            handleEvent(content, eventDatabase),
        ) as any;

    } catch (err) {
        _l.error('an error was raised processing incoming message', { err });
        return {
            msg_intention: content.msg_intention,
            msg_id: content.msg_id,
            status: MsgStatus.FAIL,
            result: ['internal server error'],
            userID: content.userID,
        };
    }
}

/**
 * Callback for the database being prepared. Will set events db instance and make the app listen on the port defined in
 * the express app
 * @param eventsConnection the resolved database object
 */
async function databaseConnectionReady(eventsConnection: DatabaseConnections) {

    _l.info('database connections are setup correctly', { keys: Object.keys(eventsConnection) });

    eventDatabase = eventsConnection.event;
    commentDatabase = eventsConnection.comment;
    signupDatabase = eventsConnection.signup;

    await Messaging.Messenger.setup(
        RABBIT_MQ_CONFIG_PATH,
        reqReceived,
        [EVENT_DETAILS_SERVICE_TOPIC, EVENT_COMMENTS_SERVICE_TOPIC, EVENT_SIGNUPS_SERVICE_TOPIC],
    );

    app.listen(process.env.PORT, () => {
        _l.info('Event micro dionysus started successfully');
    });
}

async function setup() {
    // Start of the mongoDB connection.
    // The connection info (including username / password) is read from configuration file.
    const data = await fs.readFile('database.json', { encoding: 'utf-8' });

    _l.debug('Database.json file opened successfully...');

    const dbInfo = JSON.parse(data);

    Database.connect(dbInfo)
        .then(databaseConnectionReady)
        .catch((e) => {
            _l.error('Event details microservice failed to connect to database... exiting');
            _l.error(e.message);
            process.exit(1);
        });
}

_l.info('Starting event micro dionysus...');

app.set('port', process.env.PORT || 15550);

app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({
    extended: false,
}));
app.use(cookieParser());

setup();
