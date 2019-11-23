import * as socketio from 'socket.io';
import * as Constants from './Constants';
const io = socketio();

io.listen(process.env.SOCKET_IO_PORT || Constants.SOCKET_PORT);

export default io;
