import { Db } from 'mongodb';
import { DefaultInterface } from './DefaultInterface';
import { EntStateValidators } from "@uems/uemscommlib/build/ent/EntStateValidators";
import EntStateCreationSchema = EntStateValidators.EntStateCreationSchema;
import EntStateRepresentation = EntStateValidators.EntStateRepresentation;

const ENT_STATE_DETAILS_COLLECTION = 'details';
const ENT_STATE_CHANGELOG_COLLECTION = 'changelog';

export type EntStateQuery = {
    id?: string,
    name?: string,
    icon?: string,
    color?: string,
};

export type EntState = EntStateRepresentation;

export class EntStateDatabaseInterface extends DefaultInterface<EntStateQuery, EntState> {

    constructor(db: Db) {
        super(db, ENT_STATE_DETAILS_COLLECTION, ENT_STATE_CHANGELOG_COLLECTION);
    }
}
