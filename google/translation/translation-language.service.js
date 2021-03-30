const fs = require('fs');
const { Translate } = require('@google-cloud/translate').v2;

const translate = new Translate();

async function fetchData() {
	const [languages] = await translate.getLanguages('pt-BR'); //TODO code language by front-end parameter
	return languages;
}

async function getAvailableLanguages() {
	// default number for cache the languages (in months)
	const EXPIRED_CACHE = 5;
	// name of the "cache" file for the languages
	const languagesJsonFileName = 'google/translation/translation-languages.json';

	let languagesFile = fs.readFileSync(languagesJsonFileName);
	let languagesJson = JSON.parse(languagesFile);

	try {
		if (!languagesJson.expireDate || languagesJson.expireDate <= Date.now()) {
			const languagesArray = await fetchData();
			const date = new Date();
			date.setMonth(date.getMonth() + EXPIRED_CACHE);
			const jsonData = {
				expireDate: date.getTime(),
				languages: languagesArray
			};
			fs.writeFileSync(languagesJsonFileName, JSON.stringify(jsonData, null, 2));
			return jsonData.languages;
		}
		return languagesJson.languages;
	} catch (err) {
		console.error(err);
		return languagesJson.languages;
	}
}

exports.getAvailableLanguages = getAvailableLanguages;