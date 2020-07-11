export enum MsgIntention {
    CREATE = "CREATE", READ = "READ", UPDATE = "UPDATE", DELETE = "DELETE"
}

export enum MsgStatus {
    SUCCESS = 200,
    FAIL = 405
}

export type ReadRequestResponseResult = {
    event_id: String,
    event_name: String,
    event_start_date: Number,
    event_end_date: Number,
    venue_ids: String,
    attendance: Number
}

export type ReadRequestResponseMsg = {
    msg_id: String,
    status: Number,
    msg_intention: MsgIntention,
    result: ReadRequestResponseResult[]
}

export type RequestResponseMsg = {
    msg_id: String,
    status: Number,
    msg_intention: MsgIntention,
    event_id: String
}