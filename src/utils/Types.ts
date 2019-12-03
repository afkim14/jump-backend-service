export type CreateRoom = { 
    invited: ConnectedUserMap
}; // data sent by frontend on room creation information
export type ConnectRoom = { roomId: string }; // data sent by frontend to connect to specific room
export type LeaveRoom = { roomId: string };
export type UserDisplayMap = { [userId: string]: UserDisplay }; // Map from userid to display name
export type UserDisplay = {
    // user information
    userId: string;
    displayName: string;
    color: string;
};

export type UserRoomMap = { [userId: string]: string[] }; // Map from userid to all connected roomids
export type ConnectedUserMap = { [userId: string]: { accepted: boolean; displayName: UserDisplay } };
export type RoomMap = { [roomId: string]: Room }; // All open rooms and relevant information
export type Room = {
    roomId: string;
    owner: string;
    requestSent: boolean;
    invited: ConnectedUserMap;
};
export type RoomInvite = {
    roomId: string;
}
export type RoomInviteResponse = {
    invitedBy: UserDisplay;
    respondedBy: UserDisplay;
    roomId: string;
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
    roomId: string;
}

export type IceCandidate = {
    candidate: RTCIceCandidate;
    roomId: string;
}