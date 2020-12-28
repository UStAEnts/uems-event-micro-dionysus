import { ReadRequestResponseMsg, RequestResponseMsg } from "@uems/uemscommlib/build/messaging/types/event_response_schema";

export interface DataHandlerInterface<READ, ADD, EDIT, DELETE> {

    read(request: READ): Promise<ReadRequestResponseMsg>;

    create(request: ADD): Promise<RequestResponseMsg>;

    modify(request: EDIT): Promise<RequestResponseMsg>;

    delete(request: DELETE): Promise<RequestResponseMsg>;

}
