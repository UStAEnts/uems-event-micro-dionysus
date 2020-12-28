import { Db } from 'mongodb';
import { DefaultInterface } from './DefaultInterface';

const EVENT_DETAILS_COLLECTION = 'details';
const EVENT_CHANGELOG_COLLECTION = 'changelog';

export type EventQuery = {
    id?: string,
    name?: string,
    start_date?: number,
    end_date?: number,
    venue?: string[],
};

export type Event = {
    id: string,
    name: string,
    start_date: number,
    end_date: number,
    venue: string[],
};

export class EventDatabaseInterface extends DefaultInterface<EventQuery, Event> {

    constructor(db: Db) {
        super(db, EVENT_DETAILS_COLLECTION, EVENT_CHANGELOG_COLLECTION);
    }
}
