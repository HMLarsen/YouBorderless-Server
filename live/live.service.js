const { newBufferedLive, destroyBufferedLive } = require('../google/transcribe/infinite-transcribe.service');
const { getAvailableLanguages: getTranscribeAvbLang } = require('../google/transcribe/transcribe-language.service');
const { getAvailableLanguages: getTranslationAvbLang } = require('../google/translation/translation-language.service');
const { translateTextFree } = require('../google/translation/translation.service');

const TRANSLATION_INTERVAL = 230;

function startLive(liveOptions, consumer, refreshDataConsumer) {
	let timer;

	return newBufferedLive(liveOptions, transcription => {
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => {
			translateTextFree(liveOptions, transcription.text)
				.then(translation => {
					transcription.text = '';
					translation.data.sentences.forEach(sentence => {
						transcription.text += sentence.trans || '';
					});
					consumer(transcription);
				})
				.catch(err => console.error('[tradução error]: ' + err));
		}, TRANSLATION_INTERVAL);
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