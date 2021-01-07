import { Db, ObjectID } from 'mongodb';
import { DefaultInterface } from './DefaultInterface';
import { EventResponse } from "@uems/uemscommlib";
import InternalEvent = EventResponse.InternalEvent;
import ShallowInternalEvent = EventResponse.ShallowInternalEvent;

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
    attendance: number,
    ents?: string,
    state?: string,
};

// TODO: move to uems comms library
export type Changelog = {
    id: string,
    occurred: number,
    change: string,
    user?: string,
};

export class EventDatabaseInterface extends DefaultInterface<any, ShallowInternalEvent> {

    constructor(db: Db) {
        super(db, EVENT_DETAILS_COLLECTION, EVENT_CHANGELOG_COLLECTION);
    }

    // TODO: provide a better way to do this
    modify = async (id: string, updated: any): Promise<boolean> => {
        const result = await this._objects.updateOne({
            _id: new ObjectID(id),
        }, updated);

        if (result && result.matchedCount === 1) {
            await super.log(id, 'updated', { changes: updated.$set });

            return true;
        }

        return false;
    }

    async retrieveChangelog(eventID: string): Promise<Changelog[]> {
        return (await super._changelog.find({
            id: eventID,
        })
            .toArray()).map((value) => ({
            change: value.action,
            id: value._id,
            occurred: value.timestamp,
        }));
    }
}
