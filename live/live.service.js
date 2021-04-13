const { newBufferedLive, destroyBufferedLive } = require('../google/transcribe/infinite-transcribe.service');
const { getAvailableLanguages: getTranscribeAvbLang } = require('../google/transcribe/transcribe-language.service');
const { getAvailableLanguages: getTranslationAvbLang } = require('../google/translation/translation-language.service');
const { translateText, translateFree } = require('../google/translation/translation.service');

function startLive(liveOptions, liveStartTime, consumer, refreshDataConsumer) {
	return newBufferedLive(liveOptions, liveStartTime, data => {
		console.log('[transcrição] - ' + data.text);
		consumer(data);
		// translateFree(liveOptions, data.text)
		// 	.then(res => {
		// 		data.text = res.text;
		// 		translateConsumer(data);
		// 	})
		// 	.catch(err => {
		// 		data.text = err;
		// 		translateConsumer(data);
		// 		console.error('[ERROR]: ' + err);
		// 	});

	}, refreshDataConsumer);
}

function stopLive(data) {
	destroyBufferedLive(data);
}

function getTranscribeSupportedLanguages(languageCode) {
	return getTranscribeAvbLang(languageCode);
}

function getTranslationSupportedLanguages(languageCode) {
	return getTranslationAvbLang(languageCode);
}

exports.startLive = startLive;
exports.stopLive = stopLive;
exports.getTranscribeSupportedLanguages = getTranscribeSupportedLanguages;
exports.getTranslationSupportedLanguages = getTranslationSupportedLanguages;