const assert = require('assert');
import 'mocha';
import {Messaging} from "../messaging"

// A path to the .json file which describes valid message schema.
const MESSAGE_SCHEMA_PATH: string = 'schema/event_schema.json';

const fs = require('fs').promises;

const VALID_CREATE_MSG = {
	"msg_id": "1",
    "status": 200,
    "msg_intention": "CREATE",
    "event_name": "evName",
    "event_start_date": 100000,
    "event_end_date": 100002,
    "venue_ids": ["1", "2"],
    "predicted_attendance": 140
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
    "predicted_attendance": 140
};


const VALID_MINIMAL_GET_MSG = {
	"msg_id": "1",
    "status": 200,
    "msg_intention": "READ"
};

const INVALID_STATUS_MISSING_MSG = {
	"msg_id": "1",
    "msg_intention": "READ"
};

let validator: Messaging.MessageValidator;

before(async() => {
    let schema = JSON.parse((await fs.readFile(MESSAGE_SCHEMA_PATH)).toString());
    validator = new Messaging.MessageValidator(schema);
})

describe('Valid Schema Test', () => {
    
    it('Should process the message as expected', async () => {
        let result = await validator.validate(VALID_CREATE_MSG);
        assert(result);
    });
    it('Should reject message as attendance missing', async () => {
        let result = await validator.validate(INVALID_CREATE_MISSING_ATTENDANCE_MSG);
        assert(!result);
    });
    it('Should accept message as this is the minimum valid get message (get all)', async () => {
        let result = await validator.validate(VALID_MINIMAL_GET_MSG);
        assert(result);
    });
    it('Should reject message as status is not a number', async () => {
        let result = await validator.validate(INVALID_STATUS_WRONG_TYPE_MSG);
        assert(!result);
    });
    it('Should reject message as status is missing', async () => {
        let result = await validator.validate(INVALID_STATUS_MISSING_MSG);
        assert(!result);
    });
});