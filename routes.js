const routeCache = require('route-cache');
const axios = require('axios');
const ytsr = require('ytsr');
const { getTranscribeSupportedLanguages, getTranslationSupportedLanguages, getVideoAvailableForLive, isVideoAvailableToLive } = require('./live/live.service');

const DEFAULT_CACHE_SECONDS = 7889400; // three months
const cacheConfig = routeCache.cacheSeconds(DEFAULT_CACHE_SECONDS);

function configureRoutes(app) {
	// languages
	app.get('/supported-transcribe-languages', cacheConfig, async (req, res) => {
		try {
			const languages = await getTranscribeSupportedLanguages();
			res.json(languages || []);
		} catch (err) {
			res.status(500);
			res.send(err.message);
		}
	});
	app.get('/supported-translation-languages', cacheConfig, async (req, res) => {
		try {
			const languages = await getTranslationSupportedLanguages();
			res.json(languages || []);
		} catch (err) {
			res.status(500);
			res.send(err.message);
		}
	});

	// searching
	app.post('/search-lives', async (req, res) => {
		try {
			const term = req.body.term;
			const maxResults = req.body.maxResults;

			let filters = await ytsr.getFilters(term);
			const filter1 = filters.get('Type').get('Video');
			filters = await ytsr.getFilters(filter1.url);
			const filter2 = filters.get('Features').get('Live');
			const options = {
				limit: maxResults,
				requestOptions: {
					videoEmbeddable: true
				}
			}
			const searchResults = await ytsr(filter2.url, options);
			const videos = [];
			searchResults.items
				.filter(item => !item.isUpcoming && item.isLive)
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

			res.json(videos);
		} catch (err) {
			res.status(500);
			res.send(err.message);
		}
	});

	// video for living
	app.get('/live-info/:videoId', async (req, res) => {
		try {
			const videoAvailable = await getVideoAvailableForLive(req.params.videoId);
			if (videoAvailable) {
				res.json(videoAvailable);
				return;
			}
			res.status(404).send();
		} catch (err) {
			res.status(500);
			res.send(err.message);
		}
	});

	// live videos from subscriptions
	app.post('/live-video-by-channels', (req, res) => {
		try {
			const channelsId = req.body.channelsId;
			const fetches = channelsId.map(channelId => axios.get(`https://www.youtube.com/channel/${channelId}/live`));
			axios.all(fetches)
				.then(axios.spread((...responses) => {
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

						// channel
						if (annotations && annotations[0]) {
							const channelName = annotations[0].playerAnnotationsExpandedRenderer?.featuredChannel?.channelName;
							const channelAvatarUrl = annotations[0].playerAnnotationsExpandedRenderer?.featuredChannel?.watermark?.thumbnails[0]?.url;
							const channel = { name: channelName, avatarUrl: channelAvatarUrl };
							video.channel = channel;
						}
						videos.push(video);
					});
					res.json(videos);
				})).catch(errors => {
					throw errors;
				});
		} catch (err) {
			res.status(500);
			res.send(err.message);
		}
	});
}

exports.configureRoutes = configureRoutes;