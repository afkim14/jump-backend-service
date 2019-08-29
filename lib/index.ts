import * as socketio from 'socket.io';
import * as Constants from './Constants';
import * as uuid from 'uuid';

/**
 * Important Notes:
 *
 * UserID is the Socket ID on connection.
 * This socket id changes on page refreshes and reconnects from React service.
 */

// Types

type CreateRoomData = { size: number }; // data sent by frontend on room creation information
type ConnectRoomData = { roomid: string }; // data sent by frontend to connect to specific room
type Users = { [userid: string]: string }; // Map from userid to roomid (needed to handle disconnects)
type Rooms = { [roomid: string]: RoomInfo }; // All open rooms and relevant information
type RoomInfo = {
    // room information; connected is an array of userids.
    owner: string;
    size: number;
    connected: Array<string>;
};

// States

const users: Users = {};
const rooms: Rooms = {};

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

// Socket Connection

const io = socketio();
io.on('connection', client => {
    /**
     * Received when client presses 'Create Room' button with relevant information.
     */
    client.on(Constants.CREATE_ROOM, (data: CreateRoomData) => {
        let roomId = uuid.v1(); // Generate random time-based id
        // In case id already exists (highly unlikely in theory)
        while (roomId in rooms) {
            roomId = uuid.v1();
        }
        rooms[roomId] = {
            owner: client.id,
            size: data.size,
            connected: [],
        };

        client.emit(Constants.CREATE_ROOM_SUCCESS, { roomid: roomId });
        logInfo(`${client.id} has created room with id ${roomId}`);
    });

    /**
     * Called when user goes directly to room link or right after owner has created room.
     */
    client.on(Constants.CONNECT_TO_ROOM, (data: ConnectRoomData) => {
        /**
         * Right now, since userid = socketid, a user can still technically open multiple rooms,
         * each with a different socketid (multiple tabs).
         * But a socketid should only be associated with one room.
         */
        if (users[client.id]) {
            logError(
                `${client.id} is already connected to room ${users[client.id]} but tried to access room ${data.roomid}`,
            );
            return;
        }

        // FIXME: I don't know the better way to do this if statement in .ts (if obj, get obj.props)
        if (rooms[data.roomid]) {
            const room = rooms[data.roomid];
            if (room.connected.length < room.size) {
                room.connected.push(client.id); // Update user in rooms object
                users[client.id] = data.roomid; // Also update user in users object
                logInfo(`${client.id} connected to room ${data.roomid}`);
                room.connected.forEach(socketid => {
                    // Update all the other users in the room
                    io.to(socketid).emit(Constants.USERS_CONNECTED, { users: room.connected });
                    if (room.connected.length === room.size) {
                        // TODO: have not setup P2P stuff yet, but this would be where we send the needed data
                        io.to(socketid).emit(Constants.ROOM_FULLY_CONNECTED, 'data to begin p2p from frontend');
                    }
                });
                return;
            }

            client.emit(Constants.CONNECT_TO_ROOM_FAIL, { error: Constants.FULL_ROOM_MSG });
            logError(`${client.id} tried to connect to full room ${data.roomid}`);
            return;
        }

        client.emit(Constants.CONNECT_TO_ROOM_FAIL, { error: Constants.INVALID_ROOM });
        logError(`${client.id} tried to connect to inexistent room: ${data.roomid}`);
    });

    /**
     * Called when user leaves Main Home page or refreshes browser.
     * Important note: a new socketid will be generated the next time user tries to join/create room.
     */
    client.on('disconnect', () => {
        // FIXME: I don't know the better way to do this if statement in .ts (if obj, get obj.props)
        if (users[client.id]) {
            let roomid = users[client.id];
            if (rooms[roomid]) {
                const room = rooms[roomid];
                // Remove from room
                room.connected = room.connected.filter(userid => {
                    return userid !== client.id;
                });
                // Remove from connected users list
                delete users[client.id];
                logInfo(`${client.id} disconnected from room ${roomid}`);

                // Update users in current room or delete room if empty.
                if (room.connected.length > 0) {
                    room.connected.forEach(userid => {
                        io.to(userid).emit(Constants.USERS_CONNECTED, { users: room.connected });
                    });
                } else {
                    logInfo(`Everyone left room ${roomid} and it has been closed.`);
                    delete rooms[roomid];
                }
            }
        }
    });
});

io.listen(process.env.SOCKET_IO_PORT || Constants.SOCKET_PORT);
logInfo(`socket.io server listening on ${process.env.SOCKET_IO_PORT || Constants.SOCKET_PORT}`);
