export declare type CreateRoom = {
    size: number;
};
export declare type ConnectRoom = {
    roomid: string;
};
export declare type UserDisplayMap = {
    [userid: string]: UserDisplay;
};
export declare type UserDisplay = {
    userid: string;
    displayName: string;
    color: string;
};
export declare type UserRoomMap = {
    [userid: string]: string;
};
export declare type RoomMap = {
    [roomid: string]: Room;
};
export declare type Room = {
    owner: string;
    size: number;
    connected: UserDisplayMap;
};
