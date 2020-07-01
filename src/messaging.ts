import {Channel, connect as amqpConnect, Connection, ConsumeMessage, Message} from "amqplib/callback_api";

const fs = require('fs').promises;

// Represents the RabbitMQ config file in memory.
type MqConfig = {
    uri: String
}

// The queue of requests being received by this microservice.
const RCV_INBOX_QUEUE_NAME: string = "dionysus_inbox";

// The exchange used for sending messages back to the gateway(s).
const GATEWAY_EXCHANGE: string = "gateway";

// The exchange used for receiving requests to microservices.
const REQUEST_EXCHANGE: string = "request";

export namespace Messaging {
    export class Messenger {
        // Connection to the RabbitMQ messaging system.
        conn: Connection;

        // Channel for sending messages out to the microservices and receiving them back as a response.
        send_ch: Channel;
        rcv_ch: Channel;

        private constructor(conn: Connection, send_ch: Channel, rcv_ch: Channel) {
            this.conn = conn;
            this.send_ch = send_ch;
            this.rcv_ch = rcv_ch;
        }

        // Once a request has been handled and the response returned this method takes that request message and the response message
        // content to generate and send the response message.
        static async sendResponse(msg_content: any, res: string, send_ch: Channel) {
            if (msg_content.ID == undefined || msg_content.ID == null) {
                // Without knowing the sender ID cannot send a response.
                // Message dropped.
                console.error("Received message without ID, reply cannot be sent - message dropped!");
                return;
            }

            const response_msg = {
                ID: msg_content.ID,
                payload: res
            };

            console.log("Response sent");
            send_ch.publish(GATEWAY_EXCHANGE, '', Buffer.from(JSON.stringify(response_msg)));
        }

        // Configure the connection ready for usage by the microservice.
        // Retuns a setup Messager.
        // The given callback is assigned as the callback for receiving a request to this service.
        // If the callback resolves to null then no response is sent.
        static async configureConnection(conn: Connection, req_recv_callback: (content: JSON) => Promise<string | null>, topics: [string]) {
            conn.on("error", function(err: Error) {
                if (err.message !== "Connection closing") {
                    console.error("[AMQP] conn error", err.message);
                }
            });
            conn.on("close", function() {
                console.error("[AMQP] connection closed");
            });
            console.log("[AMQP] connected");

            return new Promise<Messenger>(function (resolve, reject) {
                conn.createChannel(function (err1: Error, send_ch: Channel) {
                    if (err1) {
                        reject(err1);
                    }
                    send_ch.assertExchange(GATEWAY_EXCHANGE, 'direct');

                    conn.createChannel(function (err2: Error, rcv_ch: Channel) {
                        if (err2) {
                            reject(err2);
                        }
            
                        rcv_ch.assertExchange(REQUEST_EXCHANGE, 'topic', {
                            durable: false
                        });
            
                        rcv_ch.assertQueue(RCV_INBOX_QUEUE_NAME, {
                            exclusive:false // Exclusive false as there may be multiple instances of this microservice sharing the queue.
                        }, function (err3: Error, queue) {
                            if (err3) {
                                reject(err3);
                            }

                            topics.forEach(function(topic) {
                                rcv_ch.bindQueue(queue.queue, REQUEST_EXCHANGE, topic);
                            });

                            rcv_ch.consume(queue.queue, 
                                async function(msg) {
                                    if (msg == null) {
                                        return;
                                    }

                                    const content_json = JSON.parse(msg.content.toString());

                                    const res: string | null = await req_recv_callback(content_json);
                                    
                                    if (res == null) {
                                        // A null response indicates no response.
                                        return;
                                    }

                                    Messaging.Messenger.sendResponse(content_json, res, send_ch);
                                }, {noAck: true});
    
                            resolve(new Messaging.Messenger(conn, send_ch, rcv_ch));
                        });
                    });
                });
            });
        }

        // Creates a new Messager to be used by the microservice for communication including receiving requests and sending responses.
        // Uses the config at the given path to configure the connection to rabbitMQ.
        // The given req_recv_callback is called if a message is received with the argument being the message content as an object.
        static setup(configPath: string, req_recv_callback: (content: JSON) => Promise<string | null>, topics: [string]) {
            return new Promise<Messenger>(async function (resolve, reject) {
                console.log('Connecting to rabbitmq...');
                const data = await fs.readFile(configPath);
                const config_json: MqConfig = JSON.parse(data.toString());
                amqpConnect(config_json.uri + "?heartbeat=60", async function(err: Error, conn: Connection) {
                    if (err) {
                        console.error("[AMQP]", err.message);
                        reject(err);
                        return;
                    }
                    resolve(await Messenger.configureConnection(conn, req_recv_callback, topics));
                });
            });
        }
    }
}
