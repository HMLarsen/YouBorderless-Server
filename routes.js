const routeCache = require('route-cache');
const ytdl = require('ytdl-core');
const { getTranscribeSupportedLanguages, getTranslationSupportedLanguages } = require('./live/live.service');

const DEFAULT_CACHE_SECONDS = 7889400; // three months
const cacheConfig = routeCache.cacheSeconds(DEFAULT_CACHE_SECONDS);

function configureRoutes(app) {
	app.get('/supported-transcribe-languages', cacheConfig, async (req, res) => {
		try {
			const languages = await getTranscribeSupportedLanguages();
			res.send(languages || []);
		} catch (err) {
			res.status(500);
			res.send(err.message);
		}
	});
	app.get('/supported-translation-languages', cacheConfig, async (req, res) => {
		try {
			const languages = await getTranslationSupportedLanguages();
			res.send(languages || []);
		} catch (err) {
			res.status(500);
			res.send(err.message);
		}
	});
	app.get('/live-info/:url', async (req, res) => {
		try {
			const videoInfo = await ytdl.getInfo(req.params.url);
			if (videoInfo) {
				if (videoInfo.videoDetails
					&& videoInfo.videoDetails.isLive
					&& videoInfo.videoDetails.isLiveContent
					&& videoInfo.videoDetails.isCrawlable
					&& !videoInfo.videoDetails.isPrivate) {
					res.send(videoInfo);
					return;
				}
				res.status(404).send();
			}
		} catch (err) {
			res.status(500);
			res.send(err.message);
		}
	});
}

exports.configureRoutes = configureRoutes;