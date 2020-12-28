import { DatabaseInterface, InsertResult } from '../DatabaseInterface';
import { Collection, Db, ObjectID } from 'mongodb';

export class DefaultInterface<QUERY, OBJECT> implements DatabaseInterface<QUERY, OBJECT> {

    private _db: Db;

    private _objects: Collection;

    private _changelog: Collection;

    constructor(db: Db, objectsCollection: string, changelogCollection: string) {
        this._db = db;
        this._objects = db.collection(objectsCollection);
        this._changelog = db.collection(changelogCollection);
    }

    async insert(data: OBJECT): Promise<InsertResult> {
        const result = await this._objects.insertOne(data);

        if (result.result !== undefined) {
            await this.log(result.insertedId, 'inserted');

            return {
                id: result.insertedId,
                err_msg: undefined,
            };
        }

        console.log(result);
        return {
            id: undefined,
            err_msg: 'Database failed to insert',
        };
    }

    async modify(id: string, updated: Partial<OBJECT>): Promise<boolean> {
        const result = await this._objects.updateOne({
            _id: new ObjectID(id),
        }, updated);

        if (result && result.matchedCount === 1) {
            await this.log(result.upsertedId._id.toHexString(), 'updated', { changes: updated });

            return true;
        }

        console.error(false);
        return false;
    }

    async remove(id: string): Promise<boolean> {
        const result = await this._objects.deleteOne({
            _id: new ObjectID(id),
        });

        if (result.deletedCount && result.deletedCount === 1) {
            await this.log(id, 'delete');

            return true;
        }
        return Promise.resolve(false);
    }

    retrieve(query: QUERY): Promise<OBJECT[]> {
        return this._objects.find(query)
            .toArray();
    }

    private async log(id: string, action: string, additional: Record<string, any> = {}) {
        try {
            await this._changelog.insertOne({
                ...additional,
                id,
                action,
                timestamp: Date.now(),
            });
        } catch (e) {
            console.warn('Failed to save changelog');
        }
    }

}
