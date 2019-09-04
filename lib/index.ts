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
    return (
        '#' +
        Math.random()
            .toString(16)
            .slice(2, 8)
    );
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
     * Received when client presses 'Create Room' button with relevant information.
     */
    client.on(Constants.CREATE_ROOM, (data: Types.CreateRoom) => {
        let roomid = uuid.v1(); // Generate random time-based id
        // In case id already exists (highly unlikely in theory)
        while (roomid in rooms) {
            roomid = uuid.v1();
        }
        rooms[roomid] = {
            owner: client.id,
            size: data.size,
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

        // FIXME: I don't know the better way to do this if statement in .ts (if obj, get obj.props)
        if (rooms[data.roomid]) {
            const room = rooms[data.roomid];
            if (Object.keys(room.connected).length < room.size) {
                room.connected[client.id] = displayNames[client.id]; // Update user in rooms object
                userRooms[client.id] = data.roomid; // Also update user in users object (redundant)
                logInfo(`${displayNames[client.id]} connected to room ${data.roomid}`);
                Object.keys(room.connected).forEach(socketid => {
                    // Update all the other users in the room
                    io.to(socketid).emit(Constants.USERS_CONNECTED, room.connected);
                    if (Object.keys(room.connected).length === room.size) {
                        // TODO: have not setup P2P stuff yet, but this would be where we send the needed data
                        io.to(socketid).emit(Constants.ROOM_FULLY_CONNECTED, 'data to begin p2p from frontend');
                    }
                });
                return;
            }

            client.emit(Constants.CONNECT_TO_ROOM_FAIL, Constants.FULL_ROOM_MSG);
            logError(`${displayNames[client.id]} tried to connect to full room ${data.roomid}`);
            return;
        }

        client.emit(Constants.CONNECT_TO_ROOM_FAIL, Constants.INVALID_ROOM);
        logError(`${displayNames[client.id]} tried to connect to inexistent room: ${data.roomid}`);
    });

    /**
     * Called when user leaves Main Home page or refreshes browser.
     * Important note: a new socketid will be generated the next time user tries to join/create room.
     */
    client.on('disconnect', () => {
        // If user is connected to room, remove him from room and update everyone in room
        // FIXME: I don't know the better way to do this if statement in .ts (if obj, get obj.props)
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
                    connectedUserIds.forEach(userid => {
                        io.to(userid).emit(Constants.USERS_CONNECTED, room.connected);
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