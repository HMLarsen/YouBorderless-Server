const path = require('path');
const ytdl = require('ytdl-core');
const YoutubeDlWrap = require('youtube-dl-wrap');
const { YTDL_BINARY_NAME } = require('../config');

const youtubeDlPath = path.resolve('live/binaries/' + YTDL_BINARY_NAME); // '2021.03.14', 'win32'
const youtubeDlWrap = new YoutubeDlWrap(youtubeDlPath);

const ytdlConfig = {
	// filter: 'audioonly', // this is not possible due throttling by youtube
	quality: 'highestaudio',
	// liveBuffer: 20000,
	// highWaterMark: 512
	// dlChunkSize: 1000
};

function newOldStreamDownload(liveId) {
	return ytdl(liveId, ytdlConfig);
}

function newStreamDownload(liveId) {
	const pathToFfmpeg = require('ffmpeg-static');
	return youtubeDlWrap.execStream(['https://www.youtube.com/watch?v=' + liveId,
		'-f', 'best', '--hls-use-mpegts', '--ffmpeg-location', pathToFfmpeg]);
}

exports.newStreamDownload = newStreamDownload;
exports.newOldStreamDownload = newOldStreamDownload;