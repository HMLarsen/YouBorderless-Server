const { TranslationServiceClient } = require('@google-cloud/translate');
// const translatte = require('translatte');
// const { translate } = require('bing-translate-api');
const tr = require("googletrans").default;
const config = require('../../config.js');

const translationClient = new TranslationServiceClient();
const projectId = config.GOOGLE_PROJECT_ID;
const location = 'global';

/**
 * Parameters to configure the request can be found at:
 * https://cloud.google.com/translate/docs/reference/rest/v3/projects/translateText
 *
 * @param liveOptions options to translate
 * @param text words to translate
 * @returns
 */
async function translateText(liveOptions, text) {
	const request = {
		parent: `projects/${projectId}/locations/${location}`,
		contents: [text],
		mimeType: 'text/plain',
		sourceLanguageCode: liveOptions.liveLanguage.bcp,
		targetLanguageCode: liveOptions.liveToLanguage.code
	};

	const [response] = await translationClient.translateText(request);
	return response.translations[0].translatedText;
}

function translateFree(liveOptions, text) {
	// return translatte(text, { to: liveOptions.liveToLanguage.code });
	// return translate(text, null, liveOptions.liveToLanguage.code);
	return tr(text, liveOptions.liveToLanguage.code);
}

exports.translateText = translateText;
exports.translateFree = translateFree;