import { Messaging } from "../src/MessageConnector";
import Messenger = Messaging.Messenger;
import tmp from "tmp";
import * as fs from "fs";
import { Connection, ConsumeMessage } from "amqplib";

const promiseTimeout = (time: number) => new Promise((resolve) => setTimeout(resolve, time));

const makeMessage = (routingKey: string, message: Buffer): ConsumeMessage => ({
    fields: {
        routingKey,
        deliveryTag: 0,
        exchange: 'exchange',
        redelivered: false,
    },
    content: message,
    properties: {
        appId: undefined,
        clusterId: undefined,
        contentEncoding: undefined,
        contentType: undefined,
        correlationId: undefined,
        deliveryMode: undefined,
        expiration: undefined,
        headers: {},
        messageId: undefined,
        priority: undefined,
        replyTo: undefined,
        timestamp: undefined,
        type: undefined,
        userId: undefined,
    },
});

describe('MessageConnector.ts', () => {

    it('should reject if the config files does not exist', async () => {
        try {
            await Messenger.setup(
                'invalid-file.txt',
                () => Promise.reject(),
                ['a'],
                () => Promise.reject(),
            );
            expect(false)
                .toBeTruthy();
        } catch (e) {
            expect(e)
                .toHaveProperty('message');
            expect(e.message)
                .toContain('file');
        }
    });

    it('should retry if the connection fails', async () => {
        let counter = -1;
        const mock = jest.fn()
            .mockImplementation(() => {
                counter++;

                if (counter === 0) {
                    return Promise.reject();
                }

                if (counter === 1) {
                    return Promise.resolve(undefined);
                }

                return Promise.reject();
            });

        const file = tmp.fileSync();
        fs.writeSync(file.fd, JSON.stringify({ uri: '' }));

        await Messenger.setup(
            file.name,
            () => Promise.reject(),
            [],
            mock,
        );

        expect(mock)
            .toHaveBeenCalledTimes(2);
    });

    it('should run each message through validators, and publishes on a valid result', async () => {
        let callCount = 0;
        const publish = jest.fn();
        const messengers: ((m: ConsumeMessage | null) => Promise<void>)[] = [];
        const connection = {
            on: () => true,
            createChannel: () => ({
                assertExchange: () => true,
                assertQueue: () => true,
                bindQueue: () => true,
                publish,
                consume: (queue: any, handler: (message: ConsumeMessage | null) => Promise<void>) => {
                    console.log('received consume');
                    messengers.push(handler);
                    callCount++;
                },
            }),
        } as unknown as Connection;

        const file = tmp.fileSync();
        fs.writeSync(file.fd, JSON.stringify({ uri: '' }));

        const handler = jest.fn()
            .mockReturnValue(Promise.resolve(null));

        await Messenger.setup(
            file.name,
            handler,
            [],
            () => Promise.resolve(connection),
        );

        await promiseTimeout(1000);

        expect(callCount)
            .toEqual(1);
        expect(handler)
            .not
            .toHaveBeenCalled();

        messengers.forEach((e) => e(null));
        // Emit an invalid message
        messengers.forEach((e) => e(makeMessage('', Buffer.from('some invalid data'))));
        messengers.forEach((e) => e(makeMessage('', Buffer.from('{}'))));
        // Emit one valid one
        messengers.forEach((e) => e(makeMessage('', Buffer.from(JSON.stringify({
            msg_id: 0,
            msg_intention: 'READ',
            userID: 'anonymous',
            status: 0,
        })))));

        await promiseTimeout(1000);

        // Then check how many times the callback was called
        expect(handler)
            .toHaveBeenCalledTimes(1);

        // Then we want to check that messages are published when it is valid
        handler.mockReturnValue({ it: 'worked' });
        messengers.forEach((e) => e(makeMessage('', Buffer.from(JSON.stringify({
            msg_id: 0,
            msg_intention: 'READ',
            userID: 'anonymous',
            status: 0,
        })))));

        await promiseTimeout(500);
        expect(publish)
            .toHaveBeenCalledTimes(1);
    });

});
