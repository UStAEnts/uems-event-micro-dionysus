/* eslint-disable @typescript-eslint/dot-notation */

import { MsgStatus, SignupMessage, SignupResponse } from '@uems/uemscommlib';
import { SignupDatabaseInterface } from '../type/impl/SignupDatabaseInterface';
import {
    FilterQuery, MatchKeysAndValues, ObjectID, UpdateQuery,
} from 'mongodb';
import { DataHandlerInterface } from './DataHandlerInterface';
import UpdateSignupMessage = SignupMessage.UpdateSignupMessage;
import ReadSignupMessage = SignupMessage.ReadSignupMessage;
import SignupServiceReadResponseMessage = SignupResponse.SignupServiceReadResponseMessage;
import CreateSignupMessage = SignupMessage.CreateSignupMessage;
import DeleteSignupMessage = SignupMessage.DeleteSignupMessage;
import ShallowInternalSignup = SignupResponse.ShallowInternalSignup;
import SignupResponseMessage = SignupResponse.SignupResponseMessage;
import InternalSignup = SignupResponse.InternalSignup;

export class SignupInterface implements DataHandlerInterface<ReadSignupMessage,
    CreateSignupMessage,
    UpdateSignupMessage,
    DeleteSignupMessage,
    SignupResponseMessage,
    SignupServiceReadResponseMessage> {

    protected _db: SignupDatabaseInterface;

    constructor(db: SignupDatabaseInterface) {
        this._db = db;
    }

    private static convertReadRequestToDatabaseQuery(request: ReadSignupMessage) {
        const query: FilterQuery<ShallowInternalSignup> = {};

        if (request.id !== undefined) {
            if (ObjectID.isValid(request.id)) {
                query._id = new ObjectID(request.id);
            } else {
                throw new Error('Invalid ID');
            }
        }

        if (request.userid) {
            query.user = request.userid;
        }

        if (request.eventID) {
            query.event = request.eventID;
        }

        if (request.role) {
            query.role = request.role;
        }

        if (request.date) {
            query.date = request.date;
        }

        if (request.dateRangeBegin !== undefined) {
            if (query.date) {
                if (typeof (query.date) === 'object') {
                    query.date.$gt = request.dateRangeBegin;
                } else {
                    throw new Error('Invalid configured date search, should not happen?');
                }
            } else {
                query.date = {
                    $gt: request.dateRangeBegin,
                };
            }
        }

        if (request.dateRangeEnd !== undefined) {
            if (query.date) {
                if (typeof (query.date) === 'object') {
                    query.date.$lt = request.dateRangeEnd;
                } else {
                    throw new Error('Invalid configured date search, should not happen?');
                }
            } else {
                query.date = {
                    $lt: request.dateRangeEnd,
                };
            }
        }

        return query;
    }

    async create(request: CreateSignupMessage): Promise<SignupResponseMessage> {
        // @ts-ignore
        const signup: Omit<ShallowInternalSignup, 'id'> = {
            date: Date.now(),
            event: request.eventID,
            role: request.role,
            user: request.userid,
        };

        try {
            const result = await this._db.insert(signup);

            if (result.id) {
                return {
                    msg_id: request.msg_id,
                    msg_intention: 'CREATE',
                    result: [result.id],
                    status: MsgStatus.SUCCESS,
                    userID: request.userID,
                };
            }

            return {
                msg_id: request.msg_id,
                msg_intention: 'CREATE',
                result: [result.err_msg === undefined ? '' : result.err_msg],
                status: MsgStatus.FAIL,
                userID: request.userID,
            };
        } catch (e) {
            return {
                msg_id: request.msg_id,
                msg_intention: 'CREATE',
                result: ['Failed to create the evenn the backing store'],
                status: MsgStatus.FAIL,
                userID: request.userID,
            };
        }
    }

    async delete(request: DeleteSignupMessage): Promise<SignupResponseMessage> {
        const result = await this._db.remove(request.id);

        return {
            msg_id: request.msg_id,
            msg_intention: 'DELETE',
            result: [request.id],
            status: (result ? MsgStatus.SUCCESS : MsgStatus.FAIL),
            userID: request.userID,
        };
    }

    async modify(request: UpdateSignupMessage): Promise<SignupResponseMessage> {
        const update: UpdateQuery<InternalSignup> = {};
        update.$set = {} as MatchKeysAndValues<InternalSignup>;

        if (request.role) {
            // @ts-ignore
            update.$set['role'] = request.role;
        }

        // Update database
        const result = await this._db.modify(request.id, update);

        // Return updated result
        return {
            msg_id: request.msg_id,
            msg_intention: 'UPDATE',
            result: [request.id],
            status: (result ? MsgStatus.SUCCESS : MsgStatus.FAIL),
            userID: request.userID,
        };
    }

    async read(request: ReadSignupMessage): Promise<SignupServiceReadResponseMessage> {
        const query = SignupInterface.convertReadRequestToDatabaseQuery(request);
        const data: ShallowInternalSignup[] = await this._db.retrieve(query);

        return {
            msg_id: request.msg_id,
            msg_intention: 'READ',
            result: data,
            status: MsgStatus.SUCCESS,
            userID: request.userID,
        };
    }

}
