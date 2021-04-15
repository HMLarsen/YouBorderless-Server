const { TranslationServiceClient } = require('@google-cloud/translate');
const translate = require('google-translate-open-api').default;
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
async function translateTextCharge(liveOptions, text) {
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

function translateTextFree(liveOptions, text) {
	return translate(text, {
		client: 'dict-chrome-ex',
		to: liveOptions.liveToLanguage.code
	});
}

exports.translateTextCharge = translateTextCharge;
exports.translateTextFree = translateTextFree;