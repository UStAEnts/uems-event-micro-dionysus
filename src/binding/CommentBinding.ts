import { CommentMessage, CommentResponse, MsgStatus } from '@uems/uemscommlib';
import { _ml } from '../logging/Log';
import { constants } from 'http2';
import { GenericCommentDatabase } from '@uems/micro-builder/build/src';
import { EventDatabase } from "../database/EventDatabaseInterface";

const _b = _ml(__filename, 'comment-binding');

async function doesAssetBelongToUser(assetID: string, userID: string, eventDatabase: EventDatabase): Promise<boolean> {
    // Need to query the asset and make sure that it belongs to them
    const result = await eventDatabase.query({
        localOnly: true,
        userID,
        msg_intention: 'READ',
        msg_id: 0,
        status: 0,
        id: assetID,
    });

    // If no results are returned then the asset identified by assetID does not belong to the user identified by
    // userID so this needs to be rejected as they cannot read
    return result.length !== 0;
}

async function create(
    message: CommentMessage.CreateCommentMessage,
    database: GenericCommentDatabase,
    eventDatabase: EventDatabase,
): Promise<(CommentResponse.CommentResponseMessage)> {
    // If its local only we need to query the event from the database to figure out if the operation should continue
    if (message.localAssetOnly) {
        if (message.assetID) {
            if (!(await doesAssetBelongToUser(message.assetID, message.userID, eventDatabase))) {
                return {
                    msg_id: message.msg_id,
                    userID: message.userID,
                    msg_intention: message.msg_intention,
                    status: MsgStatus.FAIL,
                    result: ['No valid asset found'],
                    requestID: message.requestID,
                };
            }
        } else {
            return {
                msg_id: message.msg_id,
                userID: message.userID,
                msg_intention: message.msg_intention,
                status: MsgStatus.FAIL,
                result: ['Cannot create local without assetID'],
                requestID: message.requestID,
            };
        }
    }

    const result = await database.create(message);
    return {
        msg_id: message.msg_id,
        userID: message.userID,
        msg_intention: message.msg_intention,
        status: constants.HTTP_STATUS_OK,
        result,
        requestID: message.requestID,
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
        requestID: message.requestID,
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
        requestID: message.requestID,
    };
}

async function query(
    message: CommentMessage.ReadCommentMessage,
    database: GenericCommentDatabase,
    eventDatabase: EventDatabase,
): Promise<(CommentResponse.CommentServiceReadResponseMessage | CommentResponse.CommentResponseMessage)> {
    // If its local only we need to query the event from the database to figure out if the operation should continue
    if (message.localAssetOnly) {
        if (message.assetID) {
            if (!(await doesAssetBelongToUser(message.assetID, message.userID, eventDatabase))) {
                return {
                    msg_id: message.msg_id,
                    userID: message.userID,
                    msg_intention: message.msg_intention,
                    status: MsgStatus.FAIL,
                    result: ['No valid asset found'],
                    requestID: message.requestID,
                };
            }
        } else {
            return {
                msg_id: message.msg_id,
                userID: message.userID,
                msg_intention: message.msg_intention,
                status: MsgStatus.FAIL,
                result: ['Cannot query local without assetID'],
                requestID: message.requestID,
            };
        }
    }

    const result = await database.query(message);
    return {
        msg_id: message.msg_id,
        userID: message.userID,
        msg_intention: message.msg_intention,
        status: constants.HTTP_STATUS_OK,
        result,
        requestID: message.requestID,
    };
}

async function handleMessage(
    message: CommentMessage.CommentMessage,
    database: GenericCommentDatabase | undefined,
    eventDatabase: EventDatabase | undefined,
    send: (res: CommentResponse.CommentResponseMessage | CommentResponse.CommentServiceReadResponseMessage) => void,
    routingKey: string,
): Promise<void> {
    // TODO request tracking

    if (!database || !eventDatabase) {
        _b.warn('query was received without a valid database connection');
        // requestTracker.save('fail');
        throw new Error('uninitialised database connection');
    }

    try {
        switch (message.msg_intention) {
            case 'CREATE':
                send(await create(message, database, eventDatabase));
                break;
            case 'READ':
                send(await query(message, database, eventDatabase));
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
            requestID: message.requestID,
        });
    }

}

export const handleCommentMessage = handleMessage;
