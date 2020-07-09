import { Channel, connect as amqpConnect, Connection, Message } from 'amqplib/callback_api';
import Ajv from 'ajv';
import { Logger } from 'mongodb';

const fs = require('fs').promises;

let schema = {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "$id": "https://entscrew.net/schemas/msg_schema.json",
    "type": "object",
    "required": ["msg_id", "status", "msg_intention"],
    "anyOf": [
        {"required": ["event_name", "event_start_date", "event_end_date", "venue_ids", "attendance"]},
    ],
    "properties": {
        "items": {
            "type": "object",
            "additionalProperties": false,
            "items": {
                "msg_id": {
                    "type": "string",
                    "description": "An ID for this message which is unique within the system"
                },
                "status": {
                    "type": "number",
                    "description": "The status of the message, uses HTTP status codes, 0 value if unset"
                },
                "anyOf": [
                    {
                        "type": "object",
                        "required": ["event_name", "event_start_date", "event_end_date", "venue_ids", "attendance"],
                        "properties": {
                            "msg_intention": {
                                "type": "string",
                                "enum": [ "CREATE" ],
                                "description": "The purpose / intention of the message"
                            },
                            "event_id": {
                                "type": "string",
                                "description": "The unique ID of the event to modify"
                            },
                            "event_name": {
                                "type": "string",
                                "description": "The new human-readable non-unique name of the event"
                            },
                            "event_start_date": {
                                "type": "number",
                                "description": "The new event start_date as a UTC timestamp in seconds since epoch"
                            },
                            "event_end_date": {
                                "type": "number",
                                "description": "The new event end_date as a UTC timestamp in seconds since epoch"
                            },
                            "venue_ids": {
                                "type": "array",
                                "items": {
                                    "type": "string",
                                    "description": "The new unique venue IDs for all venues this event is occuring in"
                                }
                            },
                            "attendance": {
                                "type": "number",
                                "description": "The new attendance value for the event"
                            }
                        }
                    }
                ]
            }
        }
    }
};

let data = {
	"msg_id": "1",
    "status": 200,
    "msg_intention": "CREATE",
    "event_id": "evId",
    "event_name": "evName",
    "event_start_date": 100000,
    "event_end_date": 100002,
    "venue_ids": ["1", "2"],
    "attendance": 140
};

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
    export class MessageValidator {
        schema_validator: Ajv.ValidateFunction;

        constructor(schema: object) {
            let ajv = new Ajv();
            this.schema_validator = ajv.compile(schema);
        }

        public async validate(msg: any): Promise<boolean> {
            return await this.schema_validator(msg);
        }
    }

    export class Messenger {
        // Connection to the RabbitMQ messaging system.
        conn: Connection;

        // Channel for sending messages out to the microservices and receiving them back as a response.
        send_ch: Channel;

        rcv_ch: Channel;

        msg_validator: MessageValidator;

        msg_callback: Function;

        private constructor(conn: Connection, sendCh: Channel, rcvCh: Channel, msg_validator: MessageValidator, msg_callback: Function) {
            this.conn = conn;
            this.send_ch = sendCh;
            this.rcv_ch = rcvCh;
            this.msg_validator = msg_validator;
            this.msg_callback = msg_callback;
        }

        async handleMsg(msg: Message | null): Promise<any> {
            if (msg == null) {
                return;
            }

            const contentJson = JSON.parse(msg.content.toString());

            if (!await this.msg_validator.validate(contentJson)) {
                // Messages not compliant with the schema are dropped.
                console.log("Message Dropped: Not Schema Compliant");
                return; 
            }

            const res: string | null = await this.msg_callback(contentJson);

            if (res == null) {
                // A null response indicates no response.
                return;
            }

            return Messaging.Messenger.sendResponse(contentJson, res, this.send_ch);
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
            msg_callback: Function,
            topics: [string],
            msg_validator: MessageValidator
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

                            let messenger = new Messaging.Messenger(conn, sendCh, rcvCh, msg_validator, msg_callback);

                            rcvCh.consume(queue.queue, async(msg) => {

                                await messenger.handleMsg(msg)   
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
        static setup(
            configPath: string,
            reqRecvCallback: Function,
            topics: [string],
            schemaPath: string
        ) {
            return new Promise<Messenger>(async (resolve, reject) => {
                let schema = JSON.parse((await fs.readFile(schemaPath)).toString());
                let msg_validator = new MessageValidator(schema);
                console.log('Connecting to rabbitmq...');
                fs.readFile(configPath).then((data: Buffer) => {
                    const configJson: MqConfig = JSON.parse(data.toString());
                    amqpConnect(`${configJson.uri}?heartbeat=60`, async (err: Error, conn: Connection) => {
                        if (err) {
                            console.error('[AMQP]', err.message);
                            reject(err);
                            return;
                        }
                        resolve(await Messenger.configureConnection(conn, reqRecvCallback, topics, msg_validator));
                    });
                });
            });
        }
    }
}
