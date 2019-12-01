export const SOCKET_PORT = 8000;

// SOCKET MESSAGES
export const CONNECTION = 'connection';
export const LOGIN = 'LOGIN';
export const SEARCH_USERS = 'SEARCH_USERS';
export const DISPLAY_NAME = 'DISPLAY_NAME';
export const GET_USERS = 'GET_USERS';
export const USERS = 'USERS';
export const CREATE_ROOM = 'CREATE_ROOM';
export const CREATE_ROOM_SUCCESS = 'CREATE_ROOM_SUCCESS';
export const CONNECT_TO_ROOM = 'CONNECT_TO_ROOM';
export const LEAVE_ROOM = 'LEAVE_ROOM';
export const ROOM_STATUS = 'ROOM_STATUS';
export const SEND_ROOM_INVITES = 'SEND_ROOM_INVITES';
export const REJECT_TRANSFER_REQUEST = 'REJECT_TRANSFER_REQUEST';
export const ACCEPT_TRANSFER_REQUEST = 'ACCEPT_TRANSFER_REQUEST';
export const SEND_FILE_REQUEST = 'SEND_FILE_REQUEST';
export const FILE_ACCEPT = 'FILE_ACCEPT';
export const FILE_REJECT = 'FILE_REJECT';

// SOCKET MESSAGES DATA
export const USER_CONNECT = 'USER_CONNECT';
export const USER_DISCONNECT = 'USER_DISCONNECT';

// RTC SOCKET MESSAGES
export const ICE_CANDIDATE = 'ICE_CANDIDATE';
export const RTC_DESCRIPTION_OFFER = 'RTC_DESCRIPTION_OFFER';
export const RTC_DESCRIPTION_ANSWER = 'RTC_DESCRIPTION_ANSWER';
