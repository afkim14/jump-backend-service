export type CreateRoom = { 
    invited: ConnectedUserMap
}; // data sent by frontend on room creation information
export type ConnectRoom = { roomid: string }; // data sent by frontend to connect to specific room
export type LeaveRoom = { roomid: string };
export type UserDisplayMap = { [userid: string]: UserDisplay }; // Map from userid to display name
export type UserDisplay = {
    // user information
    userid: string;
    displayName: string;
    color: string;
};

export type UserRoomMap = { [userid: string]: string[] }; // Map from userid to all connected roomids
export type ConnectedUserMap = { [userid: string]: { accepted: boolean; displayName: UserDisplay } };
export type RoomMap = { [roomid: string]: Room }; // All open rooms and relevant information
export type Room = {
    roomid: string;
    owner: string;
    requestSent: boolean;
    invited: ConnectedUserMap;
};
export type RoomInvite = {
    roomid: string;
}
export type RoomInviteResponse = {
    invitedBy: UserDisplay;
    respondedBy: UserDisplay;
    roomid: string;
}
export type Message = {
    sender: UserDisplay;
    text: string;
}

export type File = {
    id: string;
    sender: UserDisplay;
    name: string;
    size: number;
    anchorDownloadHref: string;
    anchorDownloadFileName: string;
    accepted: boolean;
    completed: boolean;
}

// RTC STUFF
export type SDP = {
    sdp: RTCSessionDescription;
    roomid: string;
}

export type IceCandidate = {
    candidate: RTCIceCandidate;
    roomid: string;
}