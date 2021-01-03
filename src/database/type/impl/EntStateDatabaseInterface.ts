import { Db } from 'mongodb';
import { DefaultInterface } from './DefaultInterface';
import { EntStateResponse } from '@uems/uemscommlib';
import InternalEntState = EntStateResponse.InternalEntState;

const ENT_STATE_DETAILS_COLLECTION = 'details';
const ENT_STATE_CHANGELOG_COLLECTION = 'changelog';

export type EntStateQuery = {
    id?: string,
    name?: string,
    icon?: string,
    color?: string,
};

export type EntState = InternalEntState;

export class EntStateDatabaseInterface extends DefaultInterface<EntStateQuery, EntState> {

    constructor(db: Db) {
        super(db, ENT_STATE_DETAILS_COLLECTION, ENT_STATE_CHANGELOG_COLLECTION);
    }
}
