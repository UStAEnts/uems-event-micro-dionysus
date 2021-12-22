import { EventMessage, EventResponse } from '@uems/uemscommlib';
import { EventDatabase } from '../database/EventDatabaseInterface';
import { _ml } from '../logging/Log';
import { constants } from 'http2';

const _b = _ml(__filename, 'event-binding');

async function create(
    message: EventMessage.CreateEventMessage,
    database: EventDatabase,
): Promise<(EventResponse.EventResponseMessage)> {
    const result = await database.create(message);
    return {
        msg_id: message.msg_id,
        userID: message.userID,
        msg_intention: message.msg_intention,
        status: constants.HTTP_STATUS_OK,
        result,
    };
}

async function update(
    message: EventMessage.UpdateEventMessage,
    database: EventDatabase,
): Promise<(EventResponse.EventResponseMessage)> {
    const result = await database.update(message);
    return {
        msg_id: message.msg_id,
        userID: message.userID,
        msg_intention: message.msg_intention,
        status: constants.HTTP_STATUS_OK,
        result,
    };
}

async function remove(
    message: EventMessage.DeleteEventMessage,
    database: EventDatabase,
): Promise<(EventResponse.EventResponseMessage)> {
    const result = await database.delete(message);
    return {
        msg_id: message.msg_id,
        userID: message.userID,
        msg_intention: message.msg_intention,
        status: constants.HTTP_STATUS_OK,
        result,
    };
}

async function query(
    message: EventMessage.ReadEventMessage,
    database: EventDatabase,
): Promise<(EventResponse.EventServiceReadResponseMessage)> {
    const result = await database.query(message);
    return {
        msg_id: message.msg_id,
        userID: message.userID,
        msg_intention: message.msg_intention,
        status: constants.HTTP_STATUS_OK,
        result,
    };
}

async function handleMessage(
    message: EventMessage.EventMessage,
    database: EventDatabase | undefined,
    send: (res: EventResponse.EventResponseMessage | EventResponse.EventServiceReadResponseMessage) => void,
): Promise<void> {
    // TODO request tracking

    if (!database) {
        _b.warn('query was received without a valid database connection');
        // requestTracker.save('fail');
        throw new Error('uninitialised database connection');
    }

    try {
        switch (message.msg_intention) {
            case 'CREATE':
                send(await create(message, database));
                break;
            case 'READ':
                send(await query(message, database));
                break;
            case 'DELETE':
                send(await remove(message, database));
                break;
            case 'UPDATE':
                send(await update(message, database));
                break;
            default:
                throw new Error('invalid message intention');
        }
    } catch (e) {
        send({
            msg_id: message.msg_id,
            userID: message.userID,
            msg_intention: message.msg_intention,
            status: 405,
            result: [e.message],
        });
    }

}

export const handleEventMessage = handleMessage;
