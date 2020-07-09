const assert = require('assert');
import 'mocha';
import {Messaging} from "../messaging"

// The topic used for messages destined to microservices of this type.
const EVENT_DETAILS_SERVICE_TOPIC: string = 'events.details.*';

// A path to the .json file which describes valid message schema.
const MESSAGE_SCHEMA_PATH: string = 'schema/event_schema.json';

// The path to the rabbitMQ config which is used to connect to the messaging system.
const RABBIT_MQ_CONFIG_PATH: string = 'rabbit-mq-config.json';

const fs = require('fs').promises;

const VALID_CREATE_MSG = {
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

const INVALID_CREATE_MISSING_ATTENDANCE_MSG = {
	"msg_id": "1",
    "status": 200,
    "msg_intention": "CREATE",
    "event_id": "evId",
    "event_name": "evName",
    "event_start_date": 100000,
    "event_end_date": 100002,
    "venue_ids": ["1", "2"]
};

const INVALID_STATUS_WRONG_TYPE_MSG = {
	"msg_id": "1",
    "status": "hello",
    "msg_intention": "CREATE",
    "event_id": "evId",
    "event_name": "evName",
    "event_start_date": 100000,
    "event_end_date": 100002,
    "venue_ids": ["1", "2"],
    "attendance": 140
};

let schema: object;

before(async() => {
    schema = JSON.parse((await fs.readFile(MESSAGE_SCHEMA_PATH)).toString());
})

describe('Valid Schema Test', () => {
    it('Should process the message as expected', () => {
        let validator = new Messaging.MessageValidator(schema);
        assert(validator.validate(VALID_CREATE_MSG));
    });
    it('Should reject message as attendance missing', () => {
        let validator = new Messaging.MessageValidator(schema);
        assert(!validator.validate(INVALID_CREATE_MISSING_ATTENDANCE_MSG));
    });
    // it('Should reject message as status is not a number', () => {
    //     let validator = new Messaging.MessageValidator(schema);
    //     assert(!validator.validate(INVALID_STATUS_WRONG_TYPE_MSG));
    // });
});