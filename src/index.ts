import * as socketio from 'socket.io';
import * as rword from 'rword';
import * as Constants from './Constants';
import * as Types from './Types';
import * as uuid from 'uuid';
const TrieSearch = require('trie-search');

/**
 * Important Notes:
 *
 * UserID is the Socket ID on connection.
 * This socket id changes on page refreshes and reconnects from React service.
 */

// States

const displayNames: Types.UserDisplayMap = {};
const userRooms: Types.UserRoomMap = {};
const rooms: Types.RoomMap = {};
let usersTrie = new TrieSearch('displayName');

// Helper functions

/**
 * Logs message with non-error coloring. Also includes timestamp.
 *
 * @param info - message to log
 */
function logInfo(info: string): void {
    console.log('\x1b[33m%s\x1b[0m', `[${new Date().toLocaleString()}]: ${info}`);
}

/**
 * Logs message with error coloring. Also includes timestamp.
 *
 * @param info - error to log
 */
function logError(error: string): void {
    console.log('\x1b[31m%s\x1b[0m', `[${new Date().toLocaleString()}]: ${error}`);
}

/**
 * Returns random hex color
 */
function generateRandomColor(): string {
    let colors = ['#FBE8A6']; // choose set of colors that fit with the color scheme
    return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Sends socket message with data to everyone in the room
 * If senderid is specified, only sender will not receive message.
 *
 * @param roomid - room to send socket message to
 * @param msg - socket message to send
 * @param data - data to send
 * @param senderid - if value is included, doesn't send to sender.
 */
function sendSocketMsgToRoom(roomid: string, msg: string, data: any, senderid: string) {
    const room = rooms[roomid];
    let invitedUserIds = Object.keys(room.invited);
    invitedUserIds.forEach(socketid => {
        if (senderid !== socketid && room.invited[socketid].accepted) {
            io.to(socketid).emit(msg, data);
        }
    });
}

function handleLeaveRoom(roomid: string, userid: string) {
    if (rooms[roomid]) {
        const room = rooms[roomid];
        // Remove from room
        delete room.invited[userid];
        logInfo(`${displayNames[userid]} disconnected from room ${roomid}`);

        // Update users in current room or delete room if empty.
        let invitedUserIds = Object.keys(room.invited);
        if (invitedUserIds.length === 1) {
            io.to(invitedUserIds[0]).emit(Constants.LEAVE_ROOM, { roomid: roomid });
            delete rooms[roomid];
            logInfo(`Everyone left room ${roomid} and it has been closed.`);
        } else {
            invitedUserIds.forEach(socketid => {
                if (room.invited[socketid].accepted) {
                    io.to(socketid).emit(Constants.ROOM_STATUS, {
                        type: Constants.USER_DISCONNECT,
                        roomid: roomid,
                        invited: room.invited,
                        full: invitedUserIds.every(userid => {
                            return room.invited[userid].accepted;
                        }),
                        owner: room.owner,
                        userid: userid,
                    });
                }
            });
        }
    }
}

// Socket Connection

const io = socketio();
io.on('connection', client => {
    /**
     * Received when client logs in as guest and sends display name and color
     */
    client.on(Constants.LOGIN, () => {
        let displayName: string = (rword.rword.generate(2, { length: '2 - 6' }) as string[]).join('');
        displayNames[client.id] = { userid: client.id, displayName, color: generateRandomColor() };
        usersTrie = new TrieSearch('displayName');
        usersTrie.addAll(Object.values(displayNames));

        // Update clients about new user
        client.emit(Constants.DISPLAY_NAME, displayNames[client.id]);
        io.emit(Constants.USERS, displayNames);
    });

    /**
     * Received when client searches for another user
     */
    client.on(Constants.SEARCH_USERS, (searchTerm: string) => {
        client.emit(Constants.SEARCH_USERS, usersTrie.get(searchTerm));
    });

    /**
     * Received when client clicks on another user and presses connect.
     */
    client.on(Constants.CREATE_ROOM, (data: Types.CreateRoom) => {
        const roomid = uuid.v1(); // Generate random time-based id
        const newRoom = {
            roomid: roomid,
            owner: client.id,
            requestSent: false,
            invited: data.invited,
        };
        newRoom.invited[client.id].accepted = true;

        rooms[roomid] = newRoom;
        client.emit(Constants.CREATE_ROOM_SUCCESS, { roomid });
        logInfo(`${client.id} has created room with id ${roomid}`);
    });

    /**
     * Called when user goes directly to room link or right after owner has created room.
     */
    client.on(Constants.CONNECT_TO_ROOM, (data: Types.ConnectRoom) => {
        // Connect to room
        userRooms[client.id] ? userRooms[client.id].push(data.roomid) : (userRooms[client.id] = [data.roomid]);

        // Update room
        const room = rooms[data.roomid];
        room.invited[client.id].accepted = true;
        logInfo(`${displayNames[client.id]} connected to room ${data.roomid}`);
        let invitedUserIds = Object.keys(room.invited);
        invitedUserIds.forEach(socketid => {
            if (room.invited[socketid].accepted) {
                io.to(socketid).emit(Constants.ROOM_STATUS, {
                    type: Constants.USER_CONNECT,
                    roomid: data.roomid,
                    full: invitedUserIds.every(userid => {
                        return room.invited[userid].accepted;
                    }),
                    owner: room.owner,
                    userid: client.id,
                });
            }
        });
        return;
    });

    /**
     * Called when user leaves room
     */
    client.on(Constants.LEAVE_ROOM, (data: Types.LeaveRoom) => {
        handleLeaveRoom(data.roomid, client.id);
    });

    client.on(Constants.SEND_ROOM_INVITES, (roomInvite: Types.RoomInvite) => {
        Object.keys(rooms[roomInvite.roomid].invited).forEach(userid => {
            if (userid !== client.id) {
                io.to(userid).emit(Constants.SEND_ROOM_INVITES, {
                    sender: displayNames[client.id],
                    roomid: roomInvite.roomid,
                });
            }
        });
    });

    client.on(Constants.REJECT_TRANSFER_REQUEST, (data: Types.RoomInviteResponse) => {
        const room = rooms[data.roomid];
        let invitedUserIds = Object.keys(room.invited);
        invitedUserIds.forEach(socketid => {
            if (room.invited[socketid].accepted) {
                io.to(socketid).emit(Constants.ROOM_STATUS, {
                    type: Constants.USER_DISCONNECT,
                    roomid: data.roomid,
                    invited: room.invited,
                    full: invitedUserIds.every(userid => {
                        return room.invited[userid].accepted;
                    }),
                    owner: room.owner,
                    userid: client.id,
                });
            }
        });
    });

    client.on(Constants.ACCEPT_TRANSFER_REQUEST, (data: Types.RoomInviteResponse) => {
        const room = rooms[data.roomid];
        room.invited[client.id].accepted = true;
        let invitedUserIds = Object.keys(room.invited);
        invitedUserIds.forEach(socketid => {
            if (room.invited[socketid].accepted) {
                io.to(socketid).emit(Constants.ROOM_STATUS, {
                    type: Constants.USER_CONNECT,
                    roomid: data.roomid,
                    invited: room.invited,
                    full: invitedUserIds.every(userid => {
                        return room.invited[userid].accepted;
                    }),
                    owner: room.owner,
                    userid: client.id,
                });
            }
        });
    });

    client.on(Constants.SEND_FILE_REQUEST, (data: { sender: Types.UserDisplay; roomid: string; fileSize: number }) => {
        sendSocketMsgToRoom(data.roomid, Constants.SEND_FILE_REQUEST, data, client.id);
    });

    client.on(Constants.FILE_ACCEPT, (data: { sender: Types.UserDisplay; roomid: string; fileid: string }) => {
        io.to(data.sender.userid).emit(Constants.FILE_ACCEPT, { roomid: data.roomid, fileid: data.fileid });
    });

    client.on(Constants.FILE_REJECT, (data: { sender: Types.UserDisplay; roomid: string; fileid: string }) => {
        io.to(data.sender.userid).emit(Constants.FILE_REJECT, { roomid: data.roomid, fileid: data.fileid });
    });

    /**
     * Receives SDP and sends to other users in the room.
     */
    client.on(Constants.RTC_DESCRIPTION_OFFER, (data: Types.SDP) => {
        logInfo(`Received SDP from ${client.id}`);
        sendSocketMsgToRoom(data.roomid, Constants.RTC_DESCRIPTION_OFFER, data, client.id);
    });

    /**
     * Receives reply SDP and sends to other users in the room.
     */
    client.on(Constants.RTC_DESCRIPTION_ANSWER, (data: Types.SDP) => {
        logInfo(`Received reply SDP from ${client.id}`);
        sendSocketMsgToRoom(data.roomid, Constants.RTC_DESCRIPTION_ANSWER, data, client.id);
    });

    /**
     * Receives ICE Candidate and sends to other users in the room.
     */
    client.on(Constants.ICE_CANDIDATE, (data: Types.IceCandidate) => {
        logInfo(`Received ICE candidate ${data.candidate} from ${client.id}`);
        sendSocketMsgToRoom(data.roomid, Constants.ICE_CANDIDATE, data, client.id);
    });

    /**
     * Called when user leaves Main Home page or refreshes browser.
     * Important note: a new socketid will be generated the next time user tries to join/create room.
     */
    client.on('disconnect', () => {
        // Remove user from connected rooms and update users in those rooms
        if (userRooms[client.id]) {
            userRooms[client.id].forEach(roomid => {
                handleLeaveRoom(roomid, client.id);
            });
        }

        logInfo(`${displayNames[client.id]} disconnected from Jump`);
        delete displayNames[client.id];
        usersTrie = new TrieSearch('displayName');
        usersTrie.addAll(Object.values(displayNames));
        io.emit(Constants.USERS, displayNames);
    });
});

io.listen(process.env.SOCKET_IO_PORT || Constants.SOCKET_PORT);
logInfo(`socket.io server listening on ${process.env.SOCKET_IO_PORT || Constants.SOCKET_PORT}`);
