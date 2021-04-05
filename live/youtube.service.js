const path = require('path');
const pathToFfmpeg = require('ffmpeg-static');
const ytdl = require('ytdl-core');
const YoutubeDlWrap = require('youtube-dl-wrap');

const { YTDL_BINARY_NAME } = require('../config');
const youtubeDlPath = path.resolve('live/binaries/' + YTDL_BINARY_NAME);
const youtubeDlWrap = new YoutubeDlWrap(youtubeDlPath);
const YOUTUBE_VIDEO_URL = 'https://www.youtube.com/watch?v=';

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
	return youtubeDlWrap.execStream([YOUTUBE_VIDEO_URL + liveId,
		'-f', 'best', '--hls-use-mpegts', '--ffmpeg-location', pathToFfmpeg]);
}

async function getVideoAvailableForLive(liveId) {
	const videoInfo = await ytdl.getInfo(liveId);
	if (videoInfo) {
		if (isVideoAvailableToLive(videoInfo.videoDetails)) {
			return videoInfo;
		}
	}
	return null;
}

function isVideoAvailableToLive(videoDetails) {
	if (videoDetails
		&& videoDetails.isLive
		&& videoDetails.isLiveContent
		&& videoDetails.isCrawlable
		&& !videoDetails.isPrivate) {
		return true;
	}
	return false;
}

exports.newStreamDownload = newStreamDownload;
exports.newOldStreamDownload = newOldStreamDownload;
exports.getVideoAvailableForLive = getVideoAvailableForLive;
exports.isVideoAvailableToLive = isVideoAvailableToLive;