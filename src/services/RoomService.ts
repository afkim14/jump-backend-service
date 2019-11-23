import io from '../utils/SocketContext';
import * as Constants from '../utils/Constants';
import * as Types from '../utils/Types';
import * as uuid from 'uuid';
import { Logger } from './Logger';
const logger = new Logger('room-service');

export class RoomService {
    rooms: Types.RoomMap;

    constructor() {
        this.rooms = {};
    }

    /**
     * Gets room object with room id
     *
     * @param roomId - room id
     */
    getRoom(roomId: string) {
        return this.rooms[roomId];
    }

    /**
     * Creates room and returns room id
     *
     * @param ownerId - user id of room creator
     * @param invited - invited list of users
     */
    createRoom(ownerId: string, invited: Types.ConnectedUserMap) {
        const roomId = uuid.v1(); // Generate random time-based id
        const newRoom: Types.Room = {
            roomId: roomId,
            owner: ownerId,
            requestSent: false,
            invited: invited,
        };

        newRoom.invited[ownerId].accepted = true;
        this.rooms[roomId] = newRoom;
        logger.logInfo(`${ownerId} has created room with id ${roomId}`);
        return roomId;
    }

    /**
     * Connects user to room
     *
     * @param userId - user id connecting to room
     * @param roomId - room id user is connecting to
     */
    connectToRoom(userId: string, roomId: string) {
        const room = this.getRoom(roomId);
        room.invited[userId].accepted = true;
        logger.logInfo(`${userId} connected to room ${roomId}`);
        let invitedUserIds = Object.keys(room.invited);
        invitedUserIds.forEach(socketId => {
            if (room.invited[socketId].accepted) {
                io.to(socketId).emit(Constants.ROOM_STATUS, {
                    type: Constants.USER_CONNECT,
                    roomId: roomId,
                    full: invitedUserIds.every(invitedUserId => {
                        return room.invited[invitedUserId].accepted;
                    }),
                    owner: room.owner,
                    userId: userId,
                });
            }
        });
    }

    /**
     * Deletes room
     *
     * @param roomId - room id
     */
    deleteRoom(roomId: string) {
        delete this.rooms[roomId];
    }

    /**
     * Handles when a user leaves a room
     *
     * @param roomId - room id
     * @param userId - user id
     */
    handleLeaveRoom(roomId: string, userId: string) {
        if (this.rooms[roomId]) {
            const room = this.rooms[roomId];
            // Remove from room
            delete room.invited[userId];
            logger.logInfo(`${userId} disconnected from room ${roomId}`);
    
            // Update users in current room or delete room if empty.
            let invitedUserIds = Object.keys(room.invited);
            if (invitedUserIds.length === 1) {
                io.to(invitedUserIds[0]).emit(Constants.LEAVE_ROOM, { roomId: roomId });
                this.deleteRoom(roomId);
                logger.logInfo(`Everyone left room ${roomId} and it has been closed.`);
            } else {
                invitedUserIds.forEach(socketId => {
                    if (room.invited[socketId].accepted) {
                        io.to(socketId).emit(Constants.ROOM_STATUS, {
                            type: Constants.USER_DISCONNECT,
                            roomId: roomId,
                            invited: room.invited,
                            full: invitedUserIds.every(invitedUserId => {
                                return room.invited[invitedUserId].accepted;
                            }),
                            owner: room.owner,
                            userId: userId,
                        });
                    }
                });
            }
        }
    }

    /**
     * Sends invites to everyone in room except owner
     * @param roomId - room to send invites to
     * @param owner - owner of room
     */
    sendInvites(roomId: string, owner: Types.UserDisplay) {
        Object.keys(this.rooms[roomId].invited).forEach(userId => {
            if (userId !== owner.userId) {
                io.to(userId).emit(Constants.SEND_ROOM_INVITES, {
                    sender: owner,
                    roomId: roomId,
                });
            }
        });
    }

    /**
     * Rejects tranfer request
     *
     * @param roomId - room to reject request from
     * @param ownerId - rejecter
     */
    rejectTransferRequest(roomId: string, ownerId: string) {
        const room = this.getRoom(roomId);
        let invitedUserIds = Object.keys(room.invited);
        invitedUserIds.forEach(socketId => {
            if (room.invited[socketId].accepted) {
                io.to(socketId).emit(Constants.ROOM_STATUS, {
                    type: Constants.USER_DISCONNECT,
                    roomId: roomId,
                    invited: room.invited,
                    full: invitedUserIds.every(invitedUserId => {
                        return room.invited[invitedUserId].accepted;
                    }),
                    owner: room.owner,
                    userId: ownerId,
                });
            }
        });
    }

    /**
     * Accepts tranfer request
     *
     * @param roomId - room to accept request from
     * @param ownerId - accepting user
     */
    acceptTransferRequest(roomId: string, ownerId: string) {
        const room = this.getRoom(roomId);
        room.invited[ownerId].accepted = true;
        let invitedUserIds = Object.keys(room.invited);
        invitedUserIds.forEach(socketid => {
            if (room.invited[socketid].accepted) {
                io.to(socketid).emit(Constants.ROOM_STATUS, {
                    type: Constants.USER_CONNECT,
                    roomId: roomId,
                    invited: room.invited,
                    full: invitedUserIds.every(invitedUserId => {
                        return room.invited[invitedUserId].accepted;
                    }),
                    owner: room.owner,
                    userId: ownerId,
                });
            }
        });
    }
}