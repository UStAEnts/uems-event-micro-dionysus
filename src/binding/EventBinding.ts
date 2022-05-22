import { DiscoveryMessage, DiscoveryResponse, EventMessage, EventResponse, MsgStatus } from '@uems/uemscommlib';
import { EventDatabase } from '../database/EventDatabaseInterface';
import { _ml } from '../logging/Log';
import { constants } from 'http2';
import log from '@uems/micro-builder/build/src/logging/Log';

const _b = _ml(__filename, 'event-binding');
const _ = log.auto;

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
        requestID: message.requestID,
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
        requestID: message.requestID,
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
        requestID: message.requestID,
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
        requestID: message.requestID,
        result,
    };
}

async function discover(
    message: DiscoveryMessage.DiscoverMessage,
    database: EventDatabase,
): Promise<DiscoveryResponse.DiscoverResponse> {
    // Events contain:
    //   - venues
    //   - ents states
    //   - states
    const dependents: (typeof message.assetType)[] = ['venue', 'ent', 'state', 'event'];
    if (!dependents.includes(message.assetType)) {
        _b.debug(`Received discovery request for ${message.assetType} which is not matching so sending 0,0`);
        return {
            userID: message.userID,
            status: MsgStatus.SUCCESS,
            msg_id: message.msg_id,
            msg_intention: message.msg_intention,
            modify: 0,
            restrict: 0,
            requestID: message.requestID,
        };
    }

    const result: DiscoveryResponse.DiscoverResponse = {
        userID: message.userID,
        status: MsgStatus.SUCCESS,
        msg_id: message.msg_id,
        msg_intention: 'READ',
        restrict: 0,
        modify: 0,
        requestID: message.requestID,
    };

    if (message.assetType === 'venue') {
        result.restrict = (await database.query({
            msg_id: message.msg_id,
            userID: 'anonymous',
            status: 0,
            msg_intention: 'READ',
            anyVenues: [message.assetID],
            requestID: message.requestID,
        })).length;
        _b.debug(`Discovery of venue returned restrict.${result.restrict} records`);
        return result;
    }

    if (message.assetType === 'ent') {
        result.modify = (await database.query({
            msg_id: message.msg_id,
            userID: 'anonymous',
            status: 0,
            msg_intention: 'READ',
            entsID: message.assetID,
            requestID: message.requestID,
        })).length;
        _b.debug(`Discovery of ent state returned modify.${result.modify} records`);
        return result;
    }

    if (message.assetType === 'state') {
        result.modify = (await database.query({
            msg_id: message.msg_id,
            userID: 'anonymous',
            status: 0,
            msg_intention: 'READ',
            stateID: message.assetID,
            requestID: message.requestID,
        })).length;
        _b.debug(`Discovery of state returned modify.${result.modify} records`);
        return result;
    }

    if (message.assetType === 'event') {
        result.modify = (await database.query({
            msg_id: message.msg_id,
            userID: 'anonymous',
            status: 0,
            msg_intention: 'READ',
            id: message.assetID,
            requestID: message.requestID,
        })).length;
        _b.debug(`Discovery of event returned modify.${result.modify} records`);
        return result;
    }

    return result;
}

async function removeDiscover(
    message: DiscoveryMessage.DeleteMessage,
    database: EventDatabase,
): Promise<DiscoveryResponse.DeleteResponse> {
    const dependents: (typeof message.assetType)[] = ['ent', 'state', 'event'];
    if (!dependents.includes(message.assetType)) {
        _b.debug(`Received delete request for ${message.assetType} which is not matching so sending 0,0`);
        return {
            userID: message.userID,
            status: MsgStatus.SUCCESS,
            msg_id: message.msg_id,
            msg_intention: 'DELETE',
            modified: 0,
            restrict: 0,
            successful: true,
            requestID: message.requestID,
        };
    }

    const result: DiscoveryResponse.DeleteResponse = {
        userID: message.userID,
        status: MsgStatus.SUCCESS,
        msg_id: message.msg_id,
        msg_intention: 'DELETE',
        restrict: 0,
        modified: 0,
        successful: false,
        requestID: message.requestID,
    };

    if (message.assetType === 'ent') {
        try {
            const entsQuery = await database.query({
                msg_id: message.msg_id,
                userID: 'anonymous',
                status: 0,
                msg_intention: 'READ',
                entsID: message.assetID,
            });

            await Promise.all(entsQuery.map((e) => database.update({
                msg_id: message.msg_id,
                userID: 'anonymous',
                status: 0,
                msg_intention: 'UPDATE',
                // @ts-ignore - null equates to undefined in the new update, need to provide a better typing system to
                entsID: null,
                id: e.id,
            })));

            _b.debug(`Delete of ent modified ${entsQuery.length} records, unsetting them`);

            result.modified = entsQuery.length;
            result.successful = true;
        } catch (e) {
            _b.warn('Failed to delete entity, got error', { e });
            result.successful = false;
        }
    }

    if (message.assetType === 'state') {
        try {
            const stateQuery = await database.query({
                msg_id: message.msg_id,
                userID: 'anonymous',
                status: 0,
                msg_intention: 'READ',
                stateID: message.assetID,
            });

            await Promise.all(stateQuery.map((e) => database.update({
                msg_id: message.msg_id,
                userID: 'anonymous',
                status: 0,
                msg_intention: 'UPDATE',
                // @ts-ignore - null equates to undefined in the new update, need to provide a better typing system to
                stateID: null,
                id: e.id,
            })));

            _b.debug(`Delete of state modified ${stateQuery.length} records, unsetting them`);

            result.successful = true;
            result.modified = stateQuery.length;
        } catch (e) {
            _b.warn('Failed to delete entity, got error', { e });
            result.successful = false;
        }
    }

    if (message.assetType === 'event') {
        try {
            result.modified = (await database.delete({
                msg_id: message.msg_id,
                userID: 'anonymous',
                status: 0,
                msg_intention: 'DELETE',
                id: message.assetID,
            })).length;

            _b.debug(`Delete of event modified ${result.modified} records, deleting them`);

            result.successful = true;
        } catch (e) {
            _b.warn('Failed to delete entity, got error', { e });
            result.successful = false;
        }
    }

    return result;
}

async function handleMessage(
    message: EventMessage.EventMessage | DiscoveryMessage.DiscoveryDeleteMessage,
    database: EventDatabase | undefined,
    send: (res: EventResponse.EventResponseMessage | EventResponse.EventServiceReadResponseMessage | DiscoveryResponse.DiscoveryDeleteResponse) => void,
    routingKey: string,
): Promise<void> {
    // TODO request tracking
    const start = Date.now();
    const finish = () => (message.requestID ? _(message.requestID) : _.system)
        .trace(`request for ${message.msg_id} was resolved in events in ${Date.now() - start}ms`);

    if (!database) {
        _b.warn('query was received without a valid database connection');
        // requestTracker.save('fail');
        finish();
        throw new Error('uninitialised database connection');
    }

    _b.debug(`Received message with routing key: ${routingKey}`);
    try {
        if (routingKey.endsWith('.discover')) {
            send(await discover(message as DiscoveryMessage.DiscoverMessage, database));
            finish();
            return;
        }
        if (routingKey.endsWith('.delete')) {
            send(await removeDiscover(message as DiscoveryMessage.DeleteMessage, database));
            finish();
            return;
        }

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
        finish();
    } catch (e) {
        console.error(e);
        send({
            msg_id: message.msg_id,
            userID: message.userID,
            msg_intention: message.msg_intention,
            status: 405,
            result: [e.message],
            requestID: message.requestID,
        });
        finish();
    }

}

export const handleEventMessage = handleMessage;
