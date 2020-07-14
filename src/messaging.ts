import {
    Channel, connect as amqpConnect, Connection, Message,
} from 'amqplib/callback_api';

import { MessageValidator, EventRes } from '@uems/uemscommlib';

const fs = require('fs').promises;

// Represents the RabbitMQ config file in memory.
type MqConfig = {
    uri: String
};

// The queue of requests being received by this microservice.
const RCV_INBOX_QUEUE_NAME: string = 'dionysus_inbox';

// The exchange used for sending messages back to the gateway(s).
const GATEWAY_EXCHANGE: string = 'gateway';

// The exchange used for receiving requests to microservices.
const REQUEST_EXCHANGE: string = 'request';

export namespace Messaging {
    export class Messenger {
        // Connection to the RabbitMQ messaging system.
        conn: Connection;

        // Channel for sending messages out to the microservices and receiving them back as a response.
        send_ch: Channel;

        rcv_ch: Channel;

        msg_validator: MessageValidator.MessageValidator;

        msg_callback: Function;

        private constructor(
            conn: Connection,
            sendCh: Channel,
            rcvCh: Channel,
            msgValidator: MessageValidator.MessageValidator,
            msgCallback: Function,
        ) {
            this.conn = conn;
            this.send_ch = sendCh;
            this.rcv_ch = rcvCh;
            this.msg_validator = msgValidator;
            this.msg_callback = msgCallback;
        }

        async handleMsg(msg: Message | null) {
            if (msg == null) {
                return;
            }

            const contentJson = JSON.parse(JSON.parse(msg.content.toString()));

            if (!(await this.msg_validator.validate(contentJson))) {
                // Messages not compliant with the schema are dropped.
                console.log('Message Dropped: Not Schema Compliant');
                return;
            }

            const res: EventRes.ReadRequestResponseMsg |
            EventRes.RequestResponseMsg |
            null = await this.msg_callback(contentJson);

            if (res == null) {
                // A null response indicates no response.
                return;
            }

            Messaging.Messenger.sendResponse(res, this.send_ch);
        }

        // Once a request has been handled and the response returned this method takes that request message and the
        // response message content to generate and send the response message.
        static async sendResponse(res: EventRes.RequestResponseMsg | EventRes.ReadRequestResponseMsg, sendCh: Channel) {
            sendCh.publish(GATEWAY_EXCHANGE, '', Buffer.from(JSON.stringify(res)));
        }

        // Configure the connection ready for usage by the microservice.
        // Retuns a setup Messager.
        // The given callback is assigned as the callback for receiving a request to this service.
        // If the callback resolves to null then no response is sent.
        static async configureConnection(
            conn: Connection,
            msgCallback: Function,
            topics: [string],
            msgValidator: MessageValidator.MessageValidator,
        ) {
            conn.on('error', (err: Error) => {
                if (err.message !== 'Connection closing') {
                    console.error('[AMQP] conn error', err.message);
                }
            });
            conn.on('close', () => {
                console.error('[AMQP] connection closed');
            });
            console.log('[AMQP] connected');

            return new Promise<Messenger>(((resolve, reject) => {
                conn.createChannel((err1: Error, sendCh: Channel) => {
                    if (err1) {
                        reject(err1);
                    }
                    sendCh.assertExchange(GATEWAY_EXCHANGE, 'direct');

                    conn.createChannel((err2: Error, rcvCh: Channel) => {
                        if (err2) {
                            reject(err2);
                        }

                        rcvCh.assertExchange(REQUEST_EXCHANGE, 'topic', {
                            durable: false,
                        });

                        rcvCh.assertQueue(RCV_INBOX_QUEUE_NAME, {
                            // Exclusive false as there may be multiple instances of this microservice sharing the queue
                            exclusive: false,
                        }, (err3: Error, queue) => {
                            if (err3) {
                                reject(err3);
                            }

                            topics.forEach((topic) => {
                                rcvCh.bindQueue(queue.queue, REQUEST_EXCHANGE, topic);
                            });

                            const messenger = new Messaging.Messenger(conn, sendCh, rcvCh, msgValidator, msgCallback);

                            rcvCh.consume(queue.queue, async (msg) => {
                                await messenger.handleMsg(msg);
                            }, { noAck: true });

                            resolve(messenger);
                        });
                    });
                });
            }));
        }

        // Creates a new Messager to be used by the microservice for communication including receiving requests and
        // sending responses. Uses the config at the given path to configure the connection to rabbitMQ. The given
        // req_recv_callback is called if a message is received with the argument being the message content as an
        // object.
        static async setup(
            configPath: string,
            reqRecvCallback: Function,
            topics: [string],
            schemaPath: string,
        ) {
            const schema = JSON.parse((await fs.readFile(schemaPath)).toString());
            const msgValidator = new MessageValidator.MessageValidator(schema);
            console.log('Connecting to rabbitmq...');
            fs.readFile(configPath).then((data: Buffer) => {
                const configJson: MqConfig = JSON.parse(data.toString());
                amqpConnect(`${configJson.uri}?heartbeat=60`, async (err: Error, conn: Connection) => {
                    if (err) {
                        console.error('[AMQP]', err.message);
                        return err;
                    }
                    return Messenger.configureConnection(conn, reqRecvCallback, topics, msgValidator);
                });
            });
        }
    }
}
