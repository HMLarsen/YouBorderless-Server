const express = require('express');
const cors = require('cors');
const socketIO = require('socket.io');

const config = require('./config.js');
const { configureLiveSockets } = require('./live/live-socket.js');
const { configureRoutes } = require('./routes.js');

const app = express();
app.use(cors({ origin: config.CORS_ORIGIN }));

console.log(`NODE_ENV=${config.NODE_ENV}`);
console.log(`CORS_ORIGIN=${config.CORS_ORIGIN}`);

// application routes
app.use(express.json());
configureRoutes(app);

const server = app.listen(config.PORT);

// sockets configuration
const socketIo = socketIO(server, {
	cors: { origin: config.CORS_ORIGIN },
	allowEIO3: true
});
configureLiveSockets(socketIo);

// const { startLive } = require('./live/live.service');
// startLive({ liveId: 'fgfbbC4cJ4M', liveLanguage: { bcp: 'en-US' }, liveToLanguage: { code: 'pt'}, punctuation: false, profanityFilter: true }, 3333, () => { }, () => { });