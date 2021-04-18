const routeCache = require('route-cache');
const { getTranscribeSupportedLanguages, getTranslationSupportedLanguages } = require('./live/live.service');
const { getVideoAvailableForLive, searchVideos, videosFromChannels } = require('./live/youtube.service');

const DEFAULT_CACHE_SECONDS = 7889400; // three months
const cacheConfig = routeCache.cacheSeconds(DEFAULT_CACHE_SECONDS);

function configureRoutes(app) {
	// languages
	app.get('/supported-transcribe-languages/:code', cacheConfig, async (req, res) => {
		try {
			const languageCode = req.params.code;
			const languages = await getTranscribeSupportedLanguages(languageCode);
			res.json(languages || []);
		} catch (err) {
			res.status(500).send(err);
		}
	});
	app.get('/supported-translation-languages/:code', cacheConfig, async (req, res) => {
		try {
			const languageCode = req.params.code;
			const languages = await getTranslationSupportedLanguages(languageCode);
			res.json(languages || []);
		} catch (err) {
			res.status(500).send(err);
		}
	});

	// video for living
	app.get('/live-available/:liveId', async (req, res) => {
		try {
			const videoAvailable = await getVideoAvailableForLive(req.params.liveId);
			if (videoAvailable) {
				res.status(200).send({ status: 'OK' });
				return;
			}
			res.sendStatus(404);
		} catch (err) {
			console.log('[error "/live-available/:liveId"] - ' + err);
			res.status(err.statusCode || 500).send(err);
		}
	});

	// searching
	app.post('/search-lives', async (req, res) => {
		try {
			const term = req.body.term;
			const maxResults = req.body.maxResults;
			const locale = req.body.locale;
			const videos = await searchVideos(term, maxResults, locale);
			res.json(videos);
		} catch (err) {
			console.log('[error "/search-lives"] - ' + err);
			res.status(err.status_code || 500).send(err);
		}
	});

	// live videos from subscriptions
	app.post('/live-video-by-channels', async (req, res) => {
		try {
			const channelsId = req.body.channelsId;
			const videos = await videosFromChannels(channelsId);
			res.json(videos);
		} catch (err) {
			console.log('[error "/live-video-by-channels"] - ' + err);
			res.status(err.status_code || 500).send(err);
		}
	});
}

exports.configureRoutes = configureRoutes;