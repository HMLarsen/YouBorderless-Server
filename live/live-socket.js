const { errorCodes } = require('../model/error-codes.model.js');
const { startLive: liveServiceStartLive, stopLive: liveServiceStopLive } = require('./live.service');

// key: socket.id
// value: lives array initialized by socket
const socketStartedLives = new Map();

function startLive(socket, liveOptions) {
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
	const data = liveServiceStartLive(liveOptions,
		data => socket.emit('live-captions', { id: liveOptions.id, data }),
		refreshData => {
			let socketLives = socketStartedLives.get(socket.id);
			socketLives = socketLives.filter(currentLive => currentLive.id !== liveOptions.id);
			liveOptions.data = refreshData;
			socketLives.push(liveOptions);
			socketStartedLives.set(socket.id, socketLives);
			callGc();
		});

	// add as init live in map
	if (!socketLives) {
		socketLives = [];
	}
	liveOptions.data = data;
	socketLives.push(liveOptions);
	socketStartedLives.set(socket.id, socketLives);
	console.log('[início] transmissão ' + liveOptions.id + ' para o socket ' + socket.id);
}

function stopLive(socket, id, isCallGc) {
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

	// destroy
	liveServiceStopLive(bufferingLive.data);
	bufferingLive.data.recognizeStream = null;
	bufferingLive.data.ytdlStream = null;
	bufferingLive.data = null;
	if (isCallGc) callGc();

	// remove from list and update current key in map
	socketLives = socketLives.filter(currentLive => currentLive.id !== id);
	socketStartedLives.set(socket.id, socketLives);
	console.log('[fim] transmissão ' + id + ' para o socket ' + socket.id);
}

function stopAllLives(socket) {
	let result = false;
	const socketLives = socketStartedLives.get(socket.id);
	if (socketLives) {
		socketLives.forEach(live => {
			stopLive(socket, live.id, false);
			result = true;
		});
	}
	return result;
}

function emitError(socket, liveId, message) {
	socket.emit('live-error', { id: liveId, error: message });
	console.error('[erro] "' + message + '" - live ' + liveId + ' para o socket ' + socket.id);
}

function configureLiveSockets(socketIo) {
	socketIo.on('connection', socket => {
		socket.on('disconnect', () => {
			const isCallGc = stopAllLives(socket);
			socketStartedLives.delete(socket.id);
			if (isCallGc) callGc();
		});

		socket.on('init-live', (liveOptions) => startLive(socket, liveOptions));
		socket.on('stop-live', liveId => stopLive(socket, liveId, true));
	});
}

function callGc() {
	try {
		if (global.gc) global.gc();
	} catch (e) {
		console.error(e);
		process.exit();
	}
}

exports.configureLiveSockets = configureLiveSockets;