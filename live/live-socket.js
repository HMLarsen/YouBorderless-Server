const { errorCodes } = require('../model/error-codes.model.js');
const { startLive: liveServiceStartLive, stopLive: liveServiceStopLive } = require('./live.service');

// key: socket.id
// value: lives array initialized by socket
const socketStartedLives = new Map();

function startLive(socket, liveOptions, liveStartTime) {
	// invalid parameters
	if (!liveOptions || !liveOptions.id || !liveOptions.liveId) {
		emitError(socket, liveOptions.id, errorCodes.INVALID_INIT_LIVE_PARAMS);
		return;
	}
	// live already init
	let socketLives = socketStartedLives.get(socket.id);
	if (socketLives) {
		const currentLive = socketLives.find(live => live.id === liveOptions.id);
		if (currentLive) {
			emitError(socket, liveOptions.id, errorCodes.LIVE_ALREADY_INIT);
			return;
		}
	}

	// init live data
	const data = liveServiceStartLive(liveOptions, liveStartTime,
		data => socket.emit('live-captions', { id: liveOptions.id, data }),
		refreshData => {
			let socketLives = socketStartedLives.get(socket.id);
			socketLives = socketLives.filter(currentLive => currentLive.id !== liveOptions.id);
			liveOptions.data = refreshData;
			socketLives.push(liveOptions);
			socketStartedLives.set(socket.id, socketLives);
		});

	// add as init live in map
	if (!socketLives) {
		socketLives = [];
	}
	liveOptions.data = data;
	socketLives.push(liveOptions);
	socketStartedLives.set(socket.id, socketLives);
	console.log('[iniciada] live ' + liveOptions.id + ' para o socket ' + socket.id);
}

function stopLive(socket, id) {
	let socketLives = socketStartedLives.get(socket.id);
	if (!socketLives) {
		emitError(socket, id, errorCodes.SOCKET_NO_LIVES);
		return;
	}
	const bufferingLive = socketLives.find(live => live.id === id);
	if (!bufferingLive) {
		emitError(socket, id, errorCodes.LIVE_NOT_EXISTS);
		return;
	}
	liveServiceStopLive(bufferingLive.data);
	// remove from list and update current key in map
	socketLives = socketLives.filter(currentLive => currentLive.id !== id);
	socketStartedLives.set(socket.id, socketLives);
	console.log('[finalizada] live ' + id + ' para o socket ' + socket.id);
}

function stopAllLives(socket) {
	const socketLives = socketStartedLives.get(socket.id);
	if (socketLives) {
		socketLives.forEach(live => stopLive(socket, live.id));
	}
}

function emitError(socket, liveId, message) {
	socket.emit('live-error', { id: liveId, error: message });
	console.error('[erro] "' + message + '" - live ' + liveId + ' para o socket ' + socket.id);
}

function configureLiveSockets(socketIo) {
	socketIo.on('connection', socket => {
		socket.on('disconnect', () => {
			stopAllLives(socket);
			socketStartedLives.delete(socket.id);
		});

		socket.on('init-live', ({ liveOptions, liveStartTime }) => startLive(socket, liveOptions, liveStartTime));
		socket.on('stop-live', liveId => stopLive(socket, liveId));
	});
}

exports.configureLiveSockets = configureLiveSockets;