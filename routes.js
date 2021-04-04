const routeCache = require('route-cache');
const axios = require('axios');
const { getTranscribeSupportedLanguages, getTranslationSupportedLanguages, getVideoAvailableForLive, isVideoAvailableToLive } = require('./live/live.service');

const DEFAULT_CACHE_SECONDS = 7889400; // three months
const cacheConfig = routeCache.cacheSeconds(DEFAULT_CACHE_SECONDS);

function configureRoutes(app) {
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
						const video = { id, title, description, thumbnailUrl };
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