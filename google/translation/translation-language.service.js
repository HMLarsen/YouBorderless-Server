const fs = require('fs');

async function fetchData(languageCode) {
	switch (languageCode) {
		case 'pt':
			languageCode = 'pt-BR';
			break;

		default:
			break;
	}
	const { Translate } = require('@google-cloud/translate').v2;
	const translate = new Translate();
	const [languages] = await translate.getLanguages(languageCode);
	return languages;
}

async function getAvailableLanguages(languageCode) {
	// default number for cache the languages (in months)
	const EXPIRED_CACHE = 5;
	// name of the "cache" file for the languages
	const languagesJsonFileName = 'google/translation/languages/' + languageCode + '.json';

	let languagesFile = fs.readFileSync(languagesJsonFileName);
	let languagesJson = JSON.parse(languagesFile);

	try {
		/**
		 * get only languages supported by google-translate-open-api
		 */

		// if (!languagesJson.expireDate || languagesJson.expireDate <= Date.now()) {
		// 	const languagesArray = await fetchData(languageCode);
		// 	const date = new Date();
		// 	date.setMonth(date.getMonth() + EXPIRED_CACHE);
		// 	const jsonData = {
		// 		expireDate: date.getTime(),
		// 		languages: languagesArray
		// 	};
		// 	fs.writeFileSync(languagesJsonFileName, JSON.stringify(jsonData, null, 2));
		// 	return jsonData.languages;
		// }
		return languagesJson.languages;
	} catch (err) {
		console.error(err);
		return languagesJson.languages;
	}
}

exports.getAvailableLanguages = getAvailableLanguages;