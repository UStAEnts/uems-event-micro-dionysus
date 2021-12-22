import { CommentMessage, CommentResponse } from '@uems/uemscommlib';
import { _ml } from '../logging/Log';
import { constants } from 'http2';
import { GenericCommentDatabase } from '@uems/micro-builder/build/src';

const _b = _ml(__filename, 'comment-binding');

async function create(
    message: CommentMessage.CreateCommentMessage,
    database: GenericCommentDatabase,
): Promise<(CommentResponse.CommentResponseMessage)> {
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
    message: CommentMessage.UpdateCommentMessage,
    database: GenericCommentDatabase,
): Promise<(CommentResponse.CommentResponseMessage)> {
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
    message: CommentMessage.DeleteCommentMessage,
    database: GenericCommentDatabase,
): Promise<(CommentResponse.CommentResponseMessage)> {
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
    message: CommentMessage.ReadCommentMessage,
    database: GenericCommentDatabase,
): Promise<(CommentResponse.CommentServiceReadResponseMessage)> {
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
    message: CommentMessage.CommentMessage,
    database: GenericCommentDatabase | undefined,
    send: (res: CommentResponse.CommentResponseMessage | CommentResponse.CommentServiceReadResponseMessage) => void,
    routingKey: string,
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

export const handleCommentMessage = handleMessage;
