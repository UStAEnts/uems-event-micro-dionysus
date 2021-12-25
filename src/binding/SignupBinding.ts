import { DiscoveryMessage, DiscoveryResponse, MsgStatus, SignupMessage, SignupResponse } from '@uems/uemscommlib';
import { SignupDatabase } from '../database/SignupDatabaseInterface';
import { _ml } from '../logging/Log';
import { constants } from 'http2';

const _b = _ml(__filename, 'signup-binding');

async function create(
    message: SignupMessage.CreateSignupMessage,
    database: SignupDatabase,
): Promise<(SignupResponse.SignupResponseMessage)> {
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
    message: SignupMessage.UpdateSignupMessage,
    database: SignupDatabase,
): Promise<(SignupResponse.SignupResponseMessage)> {
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
    message: SignupMessage.DeleteSignupMessage,
    database: SignupDatabase,
): Promise<(SignupResponse.SignupResponseMessage)> {
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
    message: SignupMessage.ReadSignupMessage,
    database: SignupDatabase,
): Promise<(SignupResponse.SignupServiceReadResponseMessage)> {
    const result = await database.query(message);
    return {
        msg_id: message.msg_id,
        userID: message.userID,
        msg_intention: message.msg_intention,
        status: constants.HTTP_STATUS_OK,
        result,
    };
}

async function discover(
    message: DiscoveryMessage.DiscoverMessage,
    database: SignupDatabase,
): Promise<DiscoveryResponse.DiscoverResponse> {
    const result: DiscoveryResponse.DiscoverResponse = {
        userID: message.userID,
        status: MsgStatus.SUCCESS,
        msg_id: message.msg_id,
        msg_intention: 'READ',
        restrict: 0,
        modify: 0,
    };

    if (message.assetType === 'signup') {
        const userIDFilter = message.localAssetOnly ? { signupUser: message.userID } : {};

        result.modify = (await database.query({
            msg_id: message.msg_id,
            userID: 'anonymous',
            status: 0,
            msg_intention: 'READ',
            id: message.assetID,
            ...userIDFilter,
        })).length;
    }

    if (message.assetType === 'event') {
        result.modify = (await database.query({
            msg_id: message.msg_id,
            userID: 'anonymous',
            status: 0,
            msg_intention: 'READ',
            eventID: message.assetID,
        })).length;
    }

    if (message.assetType === 'user') {
        result.modify = (await database.query({
            msg_id: message.msg_id,
            userID: 'anonymous',
            status: 0,
            msg_intention: 'READ',
            signupUser: message.assetID,
        })).length;
    }

    return result;
}

async function removeDiscover(
    message: DiscoveryMessage.DeleteMessage,
    database: SignupDatabase,
): Promise<DiscoveryResponse.DeleteResponse> {
    const result: DiscoveryResponse.DeleteResponse = {
        userID: message.userID,
        status: MsgStatus.SUCCESS,
        msg_id: message.msg_id,
        msg_intention: 'DELETE',
        restrict: 0,
        modified: 0,
        successful: false,
    };

    if (message.assetType === 'event') {
        const entities = await database.query({
            msg_id: message.msg_id,
            userID: 'anonymous',
            status: 0,
            msg_intention: 'READ',
            eventID: message.assetID,
        });

        result.modified = (await Promise.all(entities.map((entity) => database.delete({
            msg_id: message.msg_id,
            userID: 'anonymous',
            status: 0,
            msg_intention: 'DELETE',
            id: entity.id,
        })))).length;
        result.successful = true;
    }

    if (message.assetType === 'user') {
        const entities = await database.query({
            msg_id: message.msg_id,
            userID: 'anonymous',
            status: 0,
            msg_intention: 'READ',
            signupUser: message.assetID,
        });

        result.modified = (await Promise.all(entities.map((entity) => database.delete({
            msg_id: message.msg_id,
            userID: 'anonymous',
            status: 0,
            msg_intention: 'DELETE',
            id: entity.id,
        })))).length;
        result.successful = true;
    }

    if (message.assetType === 'signup') {
        const userIDFilter = message.localAssetOnly ? { signupUser: message.userID } : {};

        const entities = await database.query({
            msg_id: message.msg_id,
            userID: 'anonymous',
            status: 0,
            msg_intention: 'READ',
            signupUser: message.assetID,
            ...userIDFilter,
        });

        result.modified = (await Promise.all(entities.map((entity) => database.delete({
            msg_id: message.msg_id,
            userID: 'anonymous',
            status: 0,
            msg_intention: 'DELETE',
            id: entity.id,
            ...userIDFilter,
        })))).length;
        result.successful = true;
    }

    return result;
}

async function handleMessage(
    message: SignupMessage.SignupMessage | DiscoveryMessage.DiscoveryDeleteMessage,
    database: SignupDatabase | undefined,
    send: (res: SignupResponse.SignupResponseMessage | SignupResponse.SignupServiceReadResponseMessage | DiscoveryResponse.DiscoveryDeleteResponse) => void,
    routingKey: string,
): Promise<void> {
    // TODO request tracking

    if (!database) {
        _b.warn('query was received without a valid database connection');
        // requestTracker.save('fail');
        throw new Error('uninitialised database connection');
    }

    if (routingKey.endsWith('.discover')) {
        send(await discover(message as DiscoveryMessage.DiscoverMessage, database));
        return;
    }
    if (routingKey.endsWith('.delete')) {
        send(await removeDiscover(message as DiscoveryMessage.DeleteMessage, database));
        return;
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

export const handleSignupMessage = handleMessage;
