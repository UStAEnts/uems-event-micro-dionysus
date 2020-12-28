export interface DataHandlerInterface<READ, ADD, EDIT, DELETE, RESPONSE, READ_RESPONSE> {

    read(request: READ): Promise<READ_RESPONSE>;

    create(request: ADD): Promise<RESPONSE>;

    modify(request: EDIT): Promise<RESPONSE>;

    delete(request: DELETE): Promise<RESPONSE>;

}
