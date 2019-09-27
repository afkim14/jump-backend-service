export type CreateRoom = { receipients: Array<UserDisplay> }; // data sent by frontend on room creation information
export type ConnectRoom = { roomid: string }; // data sent by frontend to connect to specific room
export type UserDisplayMap = { [userid: string]: UserDisplay }; // Map from userid to display name
export type UserDisplay = {
    // user information
    userid: string;
    displayName: string;
    color: string;
};

export type UserRoomMap = { [userid: string]: string }; // Map from userid to roomid (needed to handle disconnects)
export type RoomMap = { [roomid: string]: Room }; // All open rooms and relevant information
export type Room = {
    // room information; connected is an array of userids.
    owner: string;
    size: number;
    connected: UserDisplayMap;
};

// RTC STUFF
export type SDP = {
    sdp: RTCSessionDescription;
}

export type RTCFileRequest = {
    name: string;
    size: number;
}

export type RTCFileReply = {
    accept: boolean;
}
