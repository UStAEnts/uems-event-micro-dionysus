export type SuccessfulInsert = {id: string, err_msg: undefined};

export type FailedInsert = {id: undefined, err_msg: string};

export type InsertResult = SuccessfulInsert | FailedInsert;

export interface DatabaseInterface<QUERY, OBJECT> {

    retrieve(query: QUERY): Promise<OBJECT[]>;

    insert(data: OBJECT): Promise<InsertResult>;

    modify(id: string, updated: Partial<OBJECT>): Promise<boolean>;

    remove(id: string): Promise<boolean>;

}
