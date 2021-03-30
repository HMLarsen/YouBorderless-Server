const difflib = require('difflib');

const { newBufferedLive, destroyBufferedLive } = require('../google/transcribe/infinite-transcribe.service');
const { getAvailableLanguages: getTranscribeAvbLang } = require('../google/transcribe/transcribe-language.service');
const { getAvailableLanguages: getTranslationAvbLang } = require('../google/translation/translation-language.service');
const { translateText } = require('../google/translation/translation.service');

let i = 0;
let i2 = 0;
let auxText = '';
function startLive(liveOptions, consumer, translateConsumer, refreshDataConsumer) {
	return newBufferedLive(liveOptions, async data => {
		consumer(data);
		// console.log(i++);

		const s = new difflib.SequenceMatcher(null, data.text, auxText);
		const ratio = s.ratio();
		const ratioCompare = 0.98;

		if (ratio >= ratioCompare) {
			// console.log(ratio + ' maior igual a ' + ratioCompare + ' - ' + i2++);
		} else {
			auxText = data.text;
			//translateConsumer(text);
			//translateConsumer(await translateText(liveOptions, text));
		}

		//translateConsumer(await translateText(liveOptions, text));
	}, refreshDataConsumer);
}

function stopLive(data) {
	destroyBufferedLive(data);
}

async function getTranscribeSupportedLanguages() {
	return await getTranscribeAvbLang();
}

async function getTranslationSupportedLanguages() {
	return await getTranslationAvbLang();
}

exports.startLive = startLive;
exports.stopLive = stopLive;
exports.getTranscribeSupportedLanguages = getTranscribeSupportedLanguages;
exports.getTranslationSupportedLanguages = getTranslationSupportedLanguages;