import { Channel, connect as amqpConnect, Connection } from 'amqplib/callback_api';

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

        private constructor(conn: Connection, sendCh: Channel, rcvCh: Channel) {
            this.conn = conn;
            this.send_ch = sendCh;
            this.rcv_ch = rcvCh;
        }

        // Once a request has been handled and the response returned this method takes that request message and the
        // response message content to generate and send the response message.
        static async sendResponse(msgContent: any, res: string, sendCh: Channel) {
            if (msgContent.ID === undefined || msgContent.ID === null) {
                // Without knowing the sender ID cannot send a response.
                // Message dropped.
                console.error('Received message without ID, reply cannot be sent - message dropped!');
                return;
            }

            const responseMsg = {
                ID: msgContent.ID,
                payload: res,
            };

            console.log('Response sent');
            sendCh.publish(GATEWAY_EXCHANGE, '', Buffer.from(JSON.stringify(responseMsg)));
        }

        // Configure the connection ready for usage by the microservice.
        // Retuns a setup Messager.
        // The given callback is assigned as the callback for receiving a request to this service.
        // If the callback resolves to null then no response is sent.
        static async configureConnection(
            conn: Connection,
            reqRecvCallback: (content: Buffer | null) => Promise<string | null>,
            topics: [string],
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

                            rcvCh.consume(queue.queue,
                                async (msg) => {
                                    if (msg == null) {
                                        return;
                                    }

                                    const contentJson = JSON.parse(msg.content.toString());

                                    const res: string | null = await reqRecvCallback(contentJson);

                                    if (res == null) {
                                        // A null response indicates no response.
                                        return;
                                    }

                                    Messaging.Messenger.sendResponse(contentJson, res, sendCh);
                                }, { noAck: true });

                            resolve(new Messaging.Messenger(conn, sendCh, rcvCh));
                        });
                    });
                });
            }));
        }

        // Creates a new Messager to be used by the microservice for communication including receiving requests and
        // sending responses. Uses the config at the given path to configure the connection to rabbitMQ. The given
        // req_recv_callback is called if a message is received with the argument being the message content as an
        // object.
        static setup(
            configPath: string,
            reqRecvCallback: (content: Buffer | null) => Promise<string | null>,
            topics: [string],
        ) {
            return new Promise<Messenger>((resolve, reject) => {
                console.log('Connecting to rabbitmq...');
                fs.readFile(configPath).then((data: Buffer) => {
                    const configJson: MqConfig = JSON.parse(data.toString());
                    amqpConnect(`${configJson.uri}?heartbeat=60`, async (err: Error, conn: Connection) => {
                        if (err) {
                            console.error('[AMQP]', err.message);
                            reject(err);
                            return;
                        }
                        resolve(await Messenger.configureConnection(conn, reqRecvCallback, topics));
                    });
                });
            });
        }
    }
}
