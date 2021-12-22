import { Database } from './DatabaseConnector';
import morgan from 'morgan';
import { EventDatabase } from './database/EventDatabaseInterface';
import {
    CommentMessage, CommentResponse, DiscoveryMessage, DiscoveryResponse, EventMessage, EventResponse, has, SignupMessage, SignupResponse,
} from '@uems/uemscommlib';
import { SignupDatabase } from './database/SignupDatabaseInterface';
import { _byFile, setupGlobalLogger } from './logging/Log';
import {
    GenericCommentDatabase, launchCheck, MessagingConfiguration, RabbitNetworkHandler, tryApplyTrait,
} from '@uems/micro-builder/build/src';
import { handleSignupMessage } from './binding/SignupBinding';
import { handleEventMessage } from './binding/EventBinding';
import { handleCommentMessage } from './binding/CommentBinding';
import * as zod from 'zod';
import { Options } from 'amqplib';
import { EventValidators } from '@uems/uemscommlib/build/event/EventValidators';
import { SignupValidators } from '@uems/uemscommlib/build/signup/SignupValidators';
import { CommentValidators } from '@uems/uemscommlib/build/comment/CommentValidators';
import express = require('express');
import cookieParser = require('cookie-parser');
import DatabaseConnections = Database.DatabaseConnections;
import DiscoverMessage = DiscoveryMessage.DiscoverMessage;
import { DiscoveryValidators } from "@uems/uemscommlib/build/discovery/DiscoveryValidators";
import DiscoveryMessageValidator = DiscoveryValidators.DiscoveryMessageValidator;
import DiscoveryResponseValidator = DiscoveryValidators.DiscoveryResponseValidator;

setupGlobalLogger();

// @ts-ignore
const requestTracker: ('success' | 'fail')[] & { save: (d: 'success' | 'fail') => void } = [];
requestTracker.save = function save(d) {
    if (requestTracker.length >= 50) requestTracker.shift();
    requestTracker.push(d);
    tryApplyTrait('successful', requestTracker.filter((e) => e === 'success').length);
    tryApplyTrait('fail', requestTracker.filter((e) => e === 'fail').length);
};

launchCheck(['successful', 'errored', 'rabbitmq', 'database'], (traits: Record<string, any>) => {
    if (has(traits, 'rabbitmq') && traits.rabbitmq !== '_undefined' && !traits.rabbitmq) return 'unhealthy';
    if (has(traits, 'database') && traits.database !== '_undefined' && !traits.database) return 'unhealthy';

    // If 75% of results fail then we return false
    if (has(traits, 'successful') && has(traits, 'errored')) {
        const errorPercentage = traits.errored / (traits.successful + traits.errored);
        if (errorPercentage > 0.05) return 'unhealthy-serving';
    }

    return 'healthy';
});

const fs = require('fs').promises;

const _l = _byFile(__filename);

type GenericMessageTypes =
    CommentMessage.CommentMessage
    | EventMessage.EventMessage
    | SignupMessage.SignupMessage
    | DiscoveryMessage.DiscoveryDeleteMessage;
type CreateMessageTypes =
    CommentMessage.CreateCommentMessage
    | EventMessage.CreateEventMessage
    | SignupMessage.CreateSignupMessage;
type DeleteMessageTypes =
    CommentMessage.DeleteCommentMessage
    | EventMessage.DeleteEventMessage
    | SignupMessage.DeleteSignupMessage;
type UpdateMessageTypes =
    CommentMessage.UpdateCommentMessage
    | EventMessage.UpdateEventMessage
    | SignupMessage.UpdateSignupMessage;
type ReadMessageTypes =
    CommentMessage.ReadCommentMessage
    | EventMessage.ReadEventMessage
    | SignupMessage.ReadSignupMessage
    | DiscoveryMessage.DiscoveryDeleteMessage;
type ResponseMessageTypes =
    CommentResponse.CommentResponseMessage
    | EventResponse.EventResponseMessage
    | SignupResponse.SignupResponseMessage
    | DiscoveryResponse.DiscoveryDeleteResponse;
type ReadResponseMessageTypes =
    CommentResponse.CommentServiceReadResponseMessage
    | EventResponse.EventServiceReadResponseMessage
    | SignupResponse.SignupServiceReadResponseMessage;
// @ts-ignore
export type RabbitBrokerType = RabbitNetworkHandler<GenericMessageTypes, CreateMessageTypes, DeleteMessageTypes, ReadMessageTypes, UpdateMessageTypes, ResponseMessageTypes | ReadResponseMessageTypes>;

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

async function loadMessengerConfiguration(): Promise<MessagingConfiguration> {
    const configValidator = zod.object({
        options: zod.any()
            .optional() as zod.ZodType<Options.Connect>,
        gateway: zod.string(),
        request: zod.string(),
        inbox: zod.string(),
        topics: zod.array(zod.string()),
    });

    const file = await fs.readFile(RABBIT_MQ_CONFIG_PATH, { encoding: 'utf8' });
    let parsed: any;
    try {
        parsed = JSON.parse(file);
    } catch (e) {
        _l.error(`Invalid configuration, JSON is not valid: ${e.message}`);
        process.exit(1);
    }

    const zParse = configValidator.safeParse(parsed);
    if (!zParse.success) {
        _l.error(`Invalid configuration, structure is not valid: ${zParse.error.message}`);
        process.exit(1);
    }

    return zParse.data;
}

function bind(broker: RabbitBrokerType) {
    const handle = async (
        message: GenericMessageTypes,
        send: (r: ResponseMessageTypes | ReadResponseMessageTypes) => void,
        routingKey: string,
    ) => {
        if (routingKey.startsWith('events.signups')) {
            await handleSignupMessage(message as SignupMessage.SignupMessage, signupDatabase, send, routingKey);
        } else if (routingKey.startsWith('events.comment')) {
            await handleCommentMessage(message as CommentMessage.CommentMessage, commentDatabase, send, routingKey);
        } else {
            await handleEventMessage(message as EventMessage.EventMessage, eventDatabase, send, routingKey);
        }
    };

    broker.on('create', handle);
    broker.on('query', handle);
    broker.on('update', handle);
    broker.on('delete', handle);
}

/**
 * Callback for the database being prepared. Will set events db instance and make the app listen on the port defined in
 * the express app
 * @param eventsConnection the resolved database object
 */
async function databaseConnectionReady(eventsConnection: DatabaseConnections) {
    tryApplyTrait('database', true);
    _l.info('database connections are setup correctly', { keys: Object.keys(eventsConnection) });

    eventDatabase = eventsConnection.event;
    commentDatabase = eventsConnection.comment;
    signupDatabase = eventsConnection.signup;

    const config = await loadMessengerConfiguration();

    const eventIncoming = new EventValidators.EventMessageValidator();
    const signupIncoming = new SignupValidators.SignupMessageValidator();
    const commentIncoming = new CommentValidators.CommentMessageValidator();

    const eventOutgoing = new EventValidators.EventResponseValidator();
    const signupOutgoing = new SignupValidators.SignupResponseValidator();
    const commentOutgoing = new CommentValidators.CommentResponseValidator();

    const jointOutgoing = async (data: any) => (await eventOutgoing.validate(data))
        || (await signupOutgoing.validate(data))
        || (await commentOutgoing.validate(data));
    const jointIncoming = async (data: any) => (await eventIncoming.validate(data))
        || (await signupIncoming.validate(data))
        || (await commentIncoming.validate(data));

    const messenger: RabbitBrokerType = new RabbitNetworkHandler(
        config,
        jointIncoming,
        jointOutgoing,
    );
    messenger.onReady(() => {
        bind(messenger);
        tryApplyTrait('rabbitmq', true);

        app.listen(process.env.PORT, () => {
            _l.info('Event micro dionysus started successfully');
        });
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
            tryApplyTrait('database', false);
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
