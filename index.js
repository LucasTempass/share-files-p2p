const http = require('http').createServer();
const {v4: uuid} = require('uuid');

const io = require('socket.io')(http, {
	cors: {origin: "*"}
});

const SOCKET_EVENT = {
	CONNECTED: "connected",
	DISCONNECTED: "disconnect",
	DOWNLOAD_SEND_REQUEST: "download",
	DOWNLOAD_ACCEPT_REQUEST: "accept_request",
	DOWNLOAD_REJECT_REQUEST: "reject_request",
	DOWNLOAD_REQUEST_RECEIVED: "request_sent",
	DOWNLOAD_REQUEST_ACCEPTED: "request_accepted",
	DOWNLOAD_REQUEST_REJECTED: "request_rejected",
	FILE_ADDED: "file_added",
	UPDATED_FILES: "files_updated",
	USER_DISCONNECTED: "user_disconnected",
	SAVE: "save",
	DELETE: "delete"
};

const users = {};

let files = [];

function findOwnerById(itemId) {
	return files.find(f => f.fileId === itemId)?.owner;
}

io.on('connection', (socket) => {

	io.to(socket.id).emit(SOCKET_EVENT.UPDATED_FILES, files)

	socket.on(SOCKET_EVENT.SAVE, item => {
		const file = {
			filename: item,
			owner: socket.id,
			fileId: uuid()
		}
		files.push(file);
		io.emit(SOCKET_EVENT.UPDATED_FILES, files)
	})

	socket.on(SOCKET_EVENT.DELETE, () => {
		files = files.filter(item => item.owner !== socket.id);
		io.sockets.emit(SOCKET_EVENT.UPDATED_FILES, files);
	})

	socket.on(SOCKET_EVENT.DOWNLOAD_SEND_REQUEST, ({senderId, signal, itemId}) => {
		const owner = findOwnerById(itemId);
		if (!owner)
			return;
		io.to(owner).emit(SOCKET_EVENT.DOWNLOAD_REQUEST_RECEIVED, {
			signal,
			senderId
		});
	})

	socket.on(SOCKET_EVENT.DOWNLOAD_ACCEPT_REQUEST, ({signal, to}) => {
		io.to(users[to]).emit(SOCKET_EVENT.DOWNLOAD_REQUEST_ACCEPTED, {signal});
	});

	socket.on(SOCKET_EVENT.DOWNLOAD_REJECT_REQUEST, ({to, msg}) => {
		io.to(users[to]).emit(SOCKET_EVENT.DOWNLOAD_REQUEST_REJECTED, msg);
	});

	const username = socket.id;

	if (!users[username]) {
		users[username] = socket.id;
	}

	socket.emit(SOCKET_EVENT.CONNECTED, username);

	socket.on(SOCKET_EVENT.DISCONNECTED, () => {
		io.sockets.emit(SOCKET_EVENT.USER_DISCONNECTED, users[username]);
		delete users[username];
		files = files.filter(f => f.owner !== socket.id)
		io.sockets.emit(SOCKET_EVENT.UPDATED_FILES, files);
	});

});

http.listen(8082);
