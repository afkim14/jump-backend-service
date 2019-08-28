"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const socketio = require("socket.io");
const Constants = require("./Constants");
const uuid = require("uuid");
// States
const rooms = {};
// Helper functions
function logInfo(info) {
    console.log('\x1b[33m%s\x1b[0m', `[${new Date().toLocaleString()}]: ${info}`);
}
function logError(error) {
    console.log('\x1b[31m%s\x1b[0m', `[${new Date().toLocaleString()}]: ${error}`);
}
// Socket Connection
const io = socketio();
io.on('connection', client => {
    client.on('login', () => { });
    client.on('CREATE_ROOM', (data) => {
        let roomId = uuid.v1(); // generate random time-based id
        while (roomId in rooms) {
            // in case id already exists (highly unlikely in theory)
            roomId = uuid.v1();
        }
        rooms[roomId] = {
            owner: client.id,
            size: data.size,
            connected: [],
        };
        client.emit('CREATE_ROOM_SUCCESS', { roomid: roomId });
        logInfo(`${client.id} has created room with id ${roomId}`);
    });
    client.on('CONNECT_TO_ROOM', (data) => {
        if (rooms[data.roomid]) {
            const room = rooms[data.roomid];
            if (room.connected.length < room.size) {
                room.connected.push(client.id);
                logInfo(`${client.id} connected to room ${data.roomid}`);
                room.connected.forEach(socketid => {
                    io.to(socketid).emit('USER_CONNECTED', { users: room.connected });
                    if (room.connected.length === room.size) {
                        io.to(socketid).emit('ROOM_FULLY_CONNECTED', 'data to begin p2p from frontend');
                    }
                });
                return;
            }
            client.emit('CONNECT_TO_ROOM_FAIL', { error: Constants.FULL_ROOM_MSG });
            logError(`${client.id} tried to connect to full room ${data.roomid}`);
            return;
        }
        client.emit('CONNECT_TO_ROOM_FAIL', { error: Constants.INVALID_ROOM });
        logError(`${client.id} tried to connect to inexistent room: ${data.roomid}`);
    });
    client.on('DISCONNECT_FROM_ROOM', (data) => {
        if (rooms[data.roomid]) {
            const room = rooms[data.roomid];
            room.connected.filter(socketid => {
                return socketid !== client.id;
            });
            logInfo(`${client.id} disconnected from room ${data.roomid}`);
        }
    });
});
io.listen(process.env.SOCKET_IO_PORT || Constants.SOCKET_PORT);
logInfo(`socket.io server listening on ${process.env.SOCKET_IO_PORT || Constants.SOCKET_PORT}`);
