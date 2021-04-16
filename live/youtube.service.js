const axios = require('axios');
const path = require('path');
const pathToFfmpeg = require('ffmpeg-static');
const ytdl = require('ytdl-core');
const ytsr = require('ytsr');
const YoutubeDlWrap = require('youtube-dl-wrap');

const { YTDL_BINARY_NAME } = require('../config');
const youtubeDlPath = path.resolve('live/binaries/' + YTDL_BINARY_NAME);
const youtubeDlWrap = new YoutubeDlWrap(youtubeDlPath);
const YOUTUBE_VIDEO_URL = 'https://www.youtube.com/watch?v=';

function streamDownload(liveId, liveStartTime) {
	return youtubeDlWrap.execStream([YOUTUBE_VIDEO_URL + liveId,
		'-f', 'best',
		'--hls-use-mpegts',
		'--ffmpeg-location', pathToFfmpeg]);
}

function getVideoAvailableForLive(liveId) {
	return new Promise((resolve, reject) => {
		function resolvePromise(video) {
			if (isVideoAvailableToLive(video.videoDetails)) {
				resolve(video);
				return;
			}
			resolve(undefined);
		}
		ytdl.getInfo(liveId)
			.then(video => resolvePromise(video), err => {
				console.error('[error ytdl.getInfo] - ' + JSON.stringify(err));
				if (err.statusCode === 429) {
					const cookie = 'GPS=1; YSC=frW1qTZ3Rlg; VISITOR_INFO1_LIVE=m2tDID6akN4; PREF=tz=America.Sao_Paulo';
					ytdl.getInfo(liveId, { requestOptions: { Cookie: cookie } })
						.then(video => resolvePromise(video), err => {
							console.error('[error ytdl.getInfo (cookies)] - ' + JSON.stringify(err));
							reject(err);
						});
					return;
				}
				reject(err);
			});
	});
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

async function searchVideos(term, maxResults, locale) {
	const filters = await ytsr.getFilters(term);
	const filter = filters.get('Features').get('Live'); // default en-US locale for get the filters

	const options = { limit: maxResults };
	if (locale) {
		const splitLocale = locale.split('-');
		options.hl = splitLocale[0]; // language code example "en"
		if (splitLocale.length > 1) options.gl = splitLocale[1]; // country code example "US"
	}

	const searchResults = await ytsr(filter.url, options);
	const videos = [];
	searchResults.items
		// .filter(item => !item.isUpcoming && item.isLive) // disabled because locale
		.forEach(item => {
			const id = item.id;
			const title = item.title;
			const description = item.description;
			const thumbnailUrl = item.bestThumbnail.url;
			const channel = { name: item.author?.name, avatarUrl: item.author?.bestAvatar?.url };
			const views = item.views;
			const video = { id, title, description, thumbnailUrl, channel, views };
			videos.push(video);
		});
	return videos;
}

function videosFromChannels(channelsId) {
	return new Promise((resolve, reject) => {
		const fetches = channelsId.map(channelId => axios.get(`https://www.youtube.com/channel/${channelId}/live`, {
			timeout: 1000 * 5, // Wait for 5 seconds
		}));
		const promisesResolved = fetches.map(promise => promise.catch(error => ({ error })))

		function checkFailed(then) {
			return function (responses) {
				const someFailed = responses.some(response => response.error);
				if (someFailed) throw responses;
				return then(responses);
			}
		}

		axios.all(promisesResolved)
			.then(checkFailed(axios.spread((...responses) => {
				const videos = [];
				responses.forEach(response => {
					const ytInitialPlayerResponse = response.data.split('var ytInitialPlayerResponse = ')[1];

					// if has the player variable in the html response
					if (!ytInitialPlayerResponse) {
						return;
					}
					const jsonData = JSON.parse(ytInitialPlayerResponse.split('};')[0] + '}');
					const playabilityStatus = jsonData.playabilityStatus;
					const videoDetails = jsonData.videoDetails;
					const annotations = jsonData.annotations;

					// validations for live videos only
					if (playabilityStatus.status !== 'OK' || !playabilityStatus.playableInEmbed) {
						return;
					}
					const playabilityStatusVideoId = playabilityStatus.liveStreamability.liveStreamabilityRenderer.videoId;
					// verify if videoDetails has the same video id that is living
					if (playabilityStatusVideoId !== videoDetails.videoId) {
						return;
					}
					const available = isVideoAvailableToLive(videoDetails);
					if (!available) {
						return;
					}
					const id = videoDetails.videoId;
					const title = videoDetails.title;
					const description = videoDetails.shortDescription;
					const thumbnailUrl = videoDetails.thumbnail.thumbnails[videoDetails.thumbnail.thumbnails.length - 1].url;
					const views = videoDetails.viewCount;
					const video = { id, title, description, thumbnailUrl, views };

					if (annotations && annotations[0]) {
						// first type to get channel
						const channelName = annotations[0].playerAnnotationsExpandedRenderer?.featuredChannel?.channelName;
						const channelAvatarUrl = annotations[0].playerAnnotationsExpandedRenderer?.featuredChannel?.watermark?.thumbnails[0]?.url;
						const channel = { name: channelName, avatarUrl: channelAvatarUrl };
						video.channel = channel;
					} else {
						// second type to get channel
						const ytInitialData = response.data.split('var ytInitialData = ')[1];
						if (ytInitialData) {
							const jsonInitialData = JSON.parse(ytInitialData.split('};')[0] + '}');
							const contents = jsonInitialData.contents.twoColumnWatchNextResults.results.results.contents;
							if (contents) {
								contents.forEach(content => {
									if (!content.videoSecondaryInfoRenderer) {
										return;
									}
									const videoOwnerRenderer = content.videoSecondaryInfoRenderer.owner?.videoOwnerRenderer;
									const runs = videoOwnerRenderer?.title?.runs;
									// if the runs result is the same channel as the true author from video
									if (runs && runs[0] && runs[0].text === videoDetails.author) {
										const channelName = videoDetails.author;
										const thumbnails = videoOwnerRenderer?.thumbnail?.thumbnails;
										const channelAvatarUrl = thumbnails[thumbnails.length - 1]?.url;
										const channel = { name: channelName, avatarUrl: channelAvatarUrl };
										video.channel = channel;
									}
								});
							}
						}
					}
					videos.push(video);
				});
				resolve(videos);
			})))
			.catch(err => reject(err));
	});
}

exports.streamDownload = streamDownload;
exports.getVideoAvailableForLive = getVideoAvailableForLive;
exports.isVideoAvailableToLive = isVideoAvailableToLive;
exports.searchVideos = searchVideos;
exports.videosFromChannels = videosFromChannels;