import { Db, FilterQuery, ObjectID } from 'mongodb';
import { DefaultInterface } from './DefaultInterface';
import { SignupValidators } from '@uems/uemscommlib/build/signup/SignupValidators';
import ShallowSignupRepresentation = SignupValidators.ShallowSignupRepresentation;

const EVENT_DETAILS_COLLECTION = 'details';
const EVENT_CHANGELOG_COLLECTION = 'changelog';

export class SignupDatabaseInterface extends DefaultInterface<FilterQuery<ShallowSignupRepresentation>, ShallowSignupRepresentation> {

    constructor(db: Db) {
        super(db, EVENT_DETAILS_COLLECTION, EVENT_CHANGELOG_COLLECTION);
    }

    async insert(data: Omit<SignupValidators.ShallowSignupRepresentation, 'id'>) {
        // @ts-ignore
        return super.insert(data);
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
    };
}
