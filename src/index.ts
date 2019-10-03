import * as socketio from 'socket.io';
import * as rword from 'rword';
import * as Constants from './Constants';
import * as Types from './Types';
import * as uuid from 'uuid';

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
    let connectedUserIds = Object.keys(room.connected);
    connectedUserIds.forEach(socketid => {
        if (senderid !== socketid) {
            io.to(socketid).emit(msg, data);
        }
    });
}

// Socket Connection

const io = socketio();
io.on('connection', client => {
    /**
     * Received when client logs in as guest and sends display name and color
     */
    client.on(Constants.GET_DISPLAY_NAME, () => {
        let displayName: string = (rword.rword.generate(2, { length: '2 - 6' }) as string[]).join('');
        displayNames[client.id] = { userid: client.id, displayName, color: generateRandomColor() };
        client.emit(Constants.DISPLAY_NAME, displayNames[client.id]);
        io.emit(Constants.USERS, displayNames);
    });

    /**
     * Received when client clicks on another user.
     */
    client.on(Constants.CREATE_ROOM, (data: Types.CreateRoom) => {
        let roomid = uuid.v1(); // Generate random time-based id
        rooms[roomid] = {
            owner: client.id,
            size: Object.keys(data.invited).length,
            connected: {},
        };

        client.emit(Constants.CREATE_ROOM_SUCCESS, { roomid });
        logInfo(`${client.id} has created room with id ${roomid}`);
    });

    /**
     * Called when user goes directly to room link or right after owner has created room.
     */
    client.on(Constants.CONNECT_TO_ROOM, (data: Types.ConnectRoom) => {
        /**
         * Right now, since userid = socketid, a user can still technically open multiple rooms,
         * each with a different socketid (multiple tabs).
         * But a socketid should only be associated with one room.
         */
        if (userRooms[client.id]) {
            logError(
                `${displayNames[client.id]} is already connected to room ${
                    userRooms[client.id]
                } but tried to access room ${data.roomid}`,
            );
            return;
        }

        const room = rooms[data.roomid] ? rooms[data.roomid] : null;

        // Inexistent Room
        if (!room) {
            client.emit(Constants.CONNECT_TO_ROOM_FAIL, Constants.INVALID_ROOM_MSG);
            logError(`${displayNames[client.id]} tried to connect to inexistent room: ${data.roomid}`);
            return;
        }

        // Full Room
        if (Object.keys(room.connected).length >= room.size) {
            client.emit(Constants.CONNECT_TO_ROOM_FAIL, Constants.FULL_ROOM_MSG);
            logError(`${displayNames[client.id]} tried to connect to full room ${data.roomid}`);
            return;
        }

        // Connect to room
        room.connected[client.id] = displayNames[client.id]; // Update user in rooms object
        userRooms[client.id] = data.roomid; // Also update user in users object (redundant)
        logInfo(`${displayNames[client.id]} connected to room ${data.roomid}`);
        let connectedUserIds = Object.keys(room.connected);
        connectedUserIds.forEach(socketid => {
            io.to(socketid).emit(Constants.USERS_CONNECTED, room.connected);
            if (connectedUserIds.length === room.size) {
                io.to(socketid).emit(Constants.ROOM_STATUS, { full: true, owner: room.owner });
            }
        });
        return;
    });

    client.on(Constants.SEND_ROOM_INVITES, (roomInvite: Types.RoomInvite) => {
        Object.keys(roomInvite.invited).forEach(userid => {
            if (userid !== client.id) {
                io.to(userid).emit(Constants.SEND_ROOM_INVITES, { 
                    sender: displayNames[client.id], 
                    roomid: roomInvite.roomid, 
                    initialMessage: roomInvite.initialMessage,
                    initialFile: roomInvite.initialFile
                });
            }
        });
    });

    client.on(Constants.REJECT_TRANSFER_REQUEST, (data: Types.RoomInviteResponse) => {
        io.to(data.invitedBy.userid).emit(Constants.REJECT_TRANSFER_REQUEST, data);
    });

    client.on(Constants.ACCEPT_TRANSFER_REQUEST, (data: Types.RoomInviteResponse) => {
        io.to(data.invitedBy.userid).emit(Constants.ACCEPT_TRANSFER_REQUEST, data);
    });

    /**
     * Receives SDP and sends to other users in the room.
     */
    client.on(Constants.RTC_DESCRIPTION_OFFER, (data: Types.SDP) => {
        logInfo(`Received SDP from ${client.id}`);
        sendSocketMsgToRoom(userRooms[client.id], Constants.RTC_DESCRIPTION_OFFER, data, client.id);
    });

    /**
     * Receives reply SDP and sends to other users in the room.
     */
    client.on(Constants.RTC_DESCRIPTION_ANSWER, (data: Types.SDP) => {
        logInfo(`Received reply SDP from ${client.id}`);
        sendSocketMsgToRoom(userRooms[client.id], Constants.RTC_DESCRIPTION_ANSWER, data, client.id);
    });

    /**
     * Receives ICE Candidate and sends to other users in the room.
     */
    client.on(Constants.ICE_CANDIDATE, (data: RTCIceCandidate) => {
        logInfo(`Received ICE candidate ${data.candidate} from ${client.id}`);
        sendSocketMsgToRoom(userRooms[client.id], Constants.ICE_CANDIDATE, data, client.id);
    })

    /**
     * Called when user leaves Main Home page or refreshes browser.
     * Important note: a new socketid will be generated the next time user tries to join/create room.
     */
    client.on('disconnect', () => {
        // If user is connected to room, remove him from room and update everyone in room
        if (userRooms[client.id]) {
            let roomid = userRooms[client.id];
            if (rooms[roomid]) {
                const room = rooms[roomid];
                // Remove from room
                delete room.connected[client.id];
                // Remove from connected users list
                delete userRooms[client.id];
                logInfo(`${displayNames[client.id]} disconnected from room ${roomid}`);

                // Update users in current room or delete room if empty.
                let connectedUserIds = Object.keys(room.connected);
                if (connectedUserIds.length > 0) {
                    room.owner = connectedUserIds[0];
                    connectedUserIds.forEach(userid => {
                        io.to(userid).emit(Constants.USERS_CONNECTED, room.connected);
                        io.to(userid).emit(Constants.ROOM_STATUS, { full: false, owner: room.owner });
                    });
                } else {
                    delete rooms[roomid];
                    logInfo(`Everyone left room ${roomid} and it has been closed.`);
                }
            }
        }

        logInfo(`${displayNames[client.id]} disconnected from Jump`);
        delete displayNames[client.id];
        io.emit(Constants.USERS, displayNames);
    });
});

io.listen(process.env.SOCKET_IO_PORT || Constants.SOCKET_PORT);
logInfo(`socket.io server listening on ${process.env.SOCKET_IO_PORT || Constants.SOCKET_PORT}`);
