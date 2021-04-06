const { newBufferedLive, destroyBufferedLive } = require('../google/transcribe/infinite-transcribe.service');
const { getAvailableLanguages: getTranscribeAvbLang } = require('../google/transcribe/transcribe-language.service');
const { getAvailableLanguages: getTranslationAvbLang } = require('../google/translation/translation-language.service');
const { translateText, translateFree } = require('../google/translation/translation.service');

function startLive(liveOptions, consumer, translateConsumer, refreshDataConsumer) {
	return newBufferedLive(liveOptions, data => {
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

function getTranscribeSupportedLanguages() {
	return getTranscribeAvbLang();
}

function getTranslationSupportedLanguages() {
	return getTranslationAvbLang();
}

exports.startLive = startLive;
exports.stopLive = stopLive;
exports.getTranscribeSupportedLanguages = getTranscribeSupportedLanguages;
exports.getTranslationSupportedLanguages = getTranslationSupportedLanguages;