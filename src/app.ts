import { Database } from './DatabaseConnector';
import { Messaging } from './MessageConnector';
import morgan from 'morgan';
import { EventInterface } from './database/interface/EventInterface';
import { EventDatabaseInterface } from './database/type/impl/EventDatabaseInterface';
import express = require('express');
import cookieParser = require('cookie-parser');
import DatabaseConnections = Database.DatabaseConnections;
import MessageResponses = Messaging.MessageResponses;
import { CommentResponse, EventResponse, MsgStatus, SignupResponse } from '@uems/uemscommlib';
import EventResponseMessage = EventResponse.EventResponseMessage;
import { GenericCommentDatabase } from "@uems/micro-builder/build/database/GenericCommentDatabase";
import { constants } from "http2";
import { ConsumeMessage } from "amqplib";
import ShallowInternalComment = CommentResponse.ShallowInternalComment;
import CommentResponseMessage = CommentResponse.CommentResponseMessage;
import CommentReadResponseMessage = CommentResponse.CommentReadResponseMessage;
import InternalComment = CommentResponse.InternalComment;
import CommentServiceReadResponseMessage = CommentResponse.CommentServiceReadResponseMessage;
import { SignupDatabaseInterface } from "./database/type/impl/SignupDatabaseInterface";
import ShallowInternalSignup = SignupResponse.ShallowInternalSignup;
import { SignupInterface } from "./database/interface/SignupInterface";
import SignupResponseMessage = SignupResponse.SignupResponseMessage;
import SignupServiceReadResponseMessage = SignupResponse.SignupServiceReadResponseMessage;

const fs = require('fs').promises;

// The topic used for messages destined to microservices of this type.
const EVENT_DETAILS_SERVICE_TOPIC: string = 'events.details.*';
const EVENT_COMMENTS_SERVICE_TOPIC: string = 'events.comment.*';

// The path to the rabbitMQ config which is used to connect to the messaging system.
const RABBIT_MQ_CONFIG_PATH: string = 'rabbit-mq-config.json';

export const app = express();

let eventDB: EventDatabaseInterface | null = null;
let commentDB: GenericCommentDatabase | null = null;
let signupDB: SignupDatabaseInterface | null = null;

let eventInterface: EventInterface | null = null;
let signupInterface: SignupInterface | null = null;

async function handleUnsupportedOp(content: any): Promise<EventResponseMessage | null> {
    console.error('Unsupported operation: ');
    console.error(content.msg_intention);
    return null;
}

const handleSignup = (content: any, signup: SignupInterface): Promise<SignupResponseMessage | SignupServiceReadResponseMessage> =>
    new Promise((resolve, reject) => {
        switch (content.msg_intention) {
            case 'CREATE':
                resolve(signup.create(content));
                break;
            case 'DELETE':
                resolve(signup.delete(content));
                break;
            case 'READ':
                resolve(signup.read(content));
                break;
            case 'UPDATE':
                resolve(signup.modify(content));
                break;
            default:
                reject(new Error(`invalid message intention: + ${content.msg_intention}`));
        }
    });

const handleComment = (content: any, comment: GenericCommentDatabase): Promise<string[] | ShallowInternalComment[]> =>
    new Promise((resolve, reject) => {
        console.log('handling comment request');
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
                reject(new Error(`invalid message intention: + ${content.msg_intention}`));
        }
    });

async function reqReceived(
    routingKey: string,
    content: any,
): Promise<MessageResponses | null> {
    try {
        // TODO: checks for message integrity.
        console.log('got message with routing key', routingKey, content);

        if (content == null || eventDB == null || eventInterface == null || commentDB == null
            || signupDB == null || signupInterface == null) {
            // Blank (null content) messages are ignored.
            // If the eventsDb connector is null then the microservice isn't ready and the message is dropped.

            console.log('Message content null or DB not ready!, message dropped');
            return null;
        }

        console.log('trying to handle:', content.msg_intention);

        if (routingKey.startsWith('events.signup')) {
            return await handleSignup(content, signupInterface);
        }

        if (routingKey.startsWith('events.comment')) {
            const result = await handleComment(content, commentDB);
            console.log('comment response', result);
            return {
                status: 200,
                result: result as any,
                msg_id: content.msg_id,
                msg_intention: content.msg_intention,
                userID: content.userID,
            };
        }

        switch (content.msg_intention) {
            case 'READ':
                return await eventInterface.read(content);
            case 'CREATE':
                return await eventInterface.create(content);
            case 'UPDATE':
                return await eventInterface.modify(content);
            case 'DELETE':
                return await eventInterface.delete(content);
            default:
                return handleUnsupportedOp(content);
        }

    } catch (err) {
        console.error('something went wrong');
        console.error(err);
        return {
            msg_intention: content.msg_intention,
            msg_id: content.msg_id,
            status: MsgStatus.FAIL,
            result: [],
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
    console.log('database connection is ready');

    eventDB = eventsConnection.event;
    commentDB = eventsConnection.comment;
    signupDB = eventsConnection.signup;
    eventInterface = new EventInterface(eventDB);
    signupInterface = new SignupInterface(signupDB);

    await Messaging.Messenger.setup(
        RABBIT_MQ_CONFIG_PATH,
        reqReceived,
        [EVENT_DETAILS_SERVICE_TOPIC, EVENT_COMMENTS_SERVICE_TOPIC],
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
