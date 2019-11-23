import io from './utils/SocketContext';
import * as Constants from './utils/Constants';
import * as Types from './utils/Types';

import { RoomService } from './services/RoomService';
import { Logger } from './services/Logger';
import { UserService } from './services/UserService';
const roomService = new RoomService();
const logger = new Logger('server');
const userService = new UserService();

/**
 * Important Notes:
 *
 * UserID is the Socket ID on connection.
 * This socket id changes on page refreshes and reconnects from React service.
 */

// States

const userRooms: Types.UserRoomMap = {};

/**
 * Sends socket message with data to everyone in the room
 * If senderId is specified, only sender will not receive message.
 *
 * @param roomId - room to send socket message to
 * @param msg - socket message to send
 * @param data - data to send
 * @param senderId - if value is included, doesn't send to sender.
 */
function sendSocketMsgToRoom(roomId: string, msg: string, data: any, senderId: string) {
    const room = roomService.getRoom(roomId);
    let invitedUserIds = Object.keys(room.invited);
    invitedUserIds.forEach(socketId => {
        if (senderId !== socketId && room.invited[socketId].accepted) {
            io.to(socketId).emit(msg, data);
        }
    });
}

// Socket Connection

io.on('connection', (client: any) => {
    /**
     * Received when client logs in as guest and sends display name and color
     */
    client.on(Constants.LOGIN, () => {
        let newUser = userService.createNewUser(client.id);

        // Update clients about new user
        client.emit(Constants.DISPLAY_NAME, newUser);
        io.emit(Constants.USERS, userService.getRandomUsers());
    });

    /**
     * Received when client searches for another user
     */
    client.on(Constants.SEARCH_USERS, (searchTerm: string) => {
        client.emit(Constants.SEARCH_USERS, userService.searchUsers(searchTerm));
    });

    /**
     * Received when client clicks on another user and presses connect.
     */
    client.on(Constants.CREATE_ROOM, (data: Types.CreateRoom) => {
        let newRoomId = roomService.createRoom(client.id, data.invited);
        client.emit(Constants.CREATE_ROOM_SUCCESS, { roomId: newRoomId });
    });

    /**
     * Called when user goes directly to room link or right after owner has created room.
     */
    client.on(Constants.CONNECT_TO_ROOM, (data: Types.ConnectRoom) => {
        roomService.connectToRoom(client.id, data.roomId)
        // Add room to user's list of connected rooms
        userRooms[client.id] ? userRooms[client.id].push(data.roomId) : (userRooms[client.id] = [data.roomId]);
    });

    /**
     * Called when user leaves room
     */
    client.on(Constants.LEAVE_ROOM, (data: Types.LeaveRoom) => {
        roomService.handleLeaveRoom(data.roomId, client.id);
    });

    client.on(Constants.SEND_ROOM_INVITES, (roomInvite: Types.RoomInvite) => {
        roomService.sendInvites(roomInvite.roomId, userService.getUser(client.id));
    });

    client.on(Constants.REJECT_TRANSFER_REQUEST, (data: Types.RoomInviteResponse) => {
        roomService.rejectTransferRequest(data.roomId, client.id);
    });

    client.on(Constants.ACCEPT_TRANSFER_REQUEST, (data: Types.RoomInviteResponse) => {
        roomService.acceptTransferRequest(data.roomId, client.id);
    });

    client.on(
        Constants.SEND_FILE_REQUEST,
        (data: { sender: Types.UserDisplay; roomId: string; fileSize: number; fileName: string }) => {
            sendSocketMsgToRoom(data.roomId, Constants.SEND_FILE_REQUEST, data, client.id);
        },
    );

    client.on(Constants.FILE_ACCEPT, (data: { sender: Types.UserDisplay; roomId: string; fileId: string }) => {
        io.to(data.sender.userId).emit(Constants.FILE_ACCEPT, { roomId: data.roomId, fileId: data.fileId });
    });

    client.on(Constants.FILE_REJECT, (data: { sender: Types.UserDisplay; roomId: string; fileId: string }) => {
        io.to(data.sender.userId).emit(Constants.FILE_REJECT, { roomId: data.roomId, fileId: data.fileId });
    });

    /**
     * Receives SDP and sends to other users in the room.
     */
    client.on(Constants.RTC_DESCRIPTION_OFFER, (data: Types.SDP) => {
        logger.logInfo(`Received SDP from ${client.id}`);
        sendSocketMsgToRoom(data.roomId, Constants.RTC_DESCRIPTION_OFFER, data, client.id);
    });

    /**
     * Receives reply SDP and sends to other users in the room.
     */
    client.on(Constants.RTC_DESCRIPTION_ANSWER, (data: Types.SDP) => {
        logger.logInfo(`Received reply SDP from ${client.id}`);
        sendSocketMsgToRoom(data.roomId, Constants.RTC_DESCRIPTION_ANSWER, data, client.id);
    });

    /**
     * Receives ICE Candidate and sends to other users in the room.
     */
    client.on(Constants.ICE_CANDIDATE, (data: Types.IceCandidate) => {
        logger.logInfo(`Received ICE candidate ${data.candidate} from ${client.id}`);
        sendSocketMsgToRoom(data.roomId, Constants.ICE_CANDIDATE, data, client.id);
    });

    /**
     * Called when user leaves Main Home page or refreshes browser.
     * Important note: a new socketid will be generated the next time user tries to join/create room.
     */
    client.on('disconnect', () => {
        // Remove user from connected rooms and update users in those rooms
        if (userRooms[client.id]) {
            userRooms[client.id].forEach(roomId => {
                roomService.handleLeaveRoom(roomId, client.id);
            });
        }

        userService.disconnectUser(client.id);
    });
});

logger.logInfo(`socket.io server listening on ${process.env.SOCKET_IO_PORT || Constants.SOCKET_PORT}`);
