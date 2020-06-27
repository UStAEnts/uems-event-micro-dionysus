import {Channel, connect as amqpConnect, Connection, ConsumeMessage, Message} from "amqplib/callback_api";

import * as fs from "fs/promises";

// Represents the RabbitMQ config file in memory.
type MqConfig = {
    uri: String
}

// The queue of requests being received by this microservice.
const RCV_INBOX_QUEUE_NAME: string = "inbox";

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

        // Configure the connection ready for usage by the microservice.
        // Retuns a setup Messager.
        // The given callback is assigned as the callback for receiving a request to this service.
        static async configureConnection(conn: Connection, req_recv_callback: (content: Buffer | null) => any, topics: [string]) {
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
            
                        rcv_ch.assertQueue(RCV_INBOX_QUEUE_NAME, {exclusive:true}, function (err3: Error, queue) {
                            if (err3) {
                                reject(err3);
                            }

                            topics.forEach(function(topic) {
                                rcv_ch.bindQueue(queue.queue, GATEWAY_EXCHANGE, topic);
                            });

                            rcv_ch.consume(queue.queue, 
                                function(msg) {
                                    if (msg == null) {
                                        req_recv_callback(null);
                                    } else {
                                        req_recv_callback(msg.content);
                                    }
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
        static setup(configPath: string, req_recv_callback: (content: Buffer | null) => any, topics: [string]) {
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
