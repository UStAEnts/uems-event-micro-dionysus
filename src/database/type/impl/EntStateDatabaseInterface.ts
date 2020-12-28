import { Db } from 'mongodb';
import { DefaultInterface } from './DefaultInterface';

const ENT_STATE_DETAILS_COLLECTION = 'details';
const ENT_STATE_CHANGELOG_COLLECTION = 'changelog';

export type EntStateQuery = {
    id?: string,
    name?: string,
    start_date?: number,
    end_date?: number,
    venue?: string[],
};

export type EntState = {
    id: string,
    name: string,
    start_date: number,
    end_date: number,
    venue: string[],
};

export class EntStateDatabaseInterface extends DefaultInterface<EntStateQuery, EntState> {

    constructor(db: Db) {
        super(db, ENT_STATE_DETAILS_COLLECTION, ENT_STATE_CHANGELOG_COLLECTION);
    }
}
