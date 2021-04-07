const fs = require('fs');
const cheerio = require('cheerio');
const axios = require('axios');

async function fetchData(languageCode) {
	const languagesUrl = 'https://cloud.google.com/speech-to-text/docs/languages?hl=' + languageCode;
	return await axios(languagesUrl)
		.then(res => {
			const html = res.data;
			const $ = cheerio.load(html);
			const languages = new Map();
			$('#lang-table-container table tbody tr').each((index, row) => {
				let i = 0;
				const name = $($(row).children('td')[i++]).text();
				const bcp = $($(row).children('td')[i++]).text();
				const model = $($(row).children('td')[i++]).text();
				const punctuation = $($(row).children('td')[i++]).text();
				const diarization = $($(row).children('td')[i++]).text();
				const boost = $($(row).children('td')[i++]).text();
				const confidence = $($(row).children('td')[i++]).text();
				const profanityFilter = $($(row).children('td')[i++]).text();

				// if the language exists on the map it means that there is another model for it
				// more than one line for the same bcp = more than one model
				let language = languages.get(bcp);
				if (!language) {
					languages.set(bcp, {
						name,
						bcp,
						punctuation: !!punctuation,
						diarization: !!diarization,
						boost: !!boost,
						confidence: !!confidence,
						profanityFilter: !!profanityFilter
					});
					language = languages.get(bcp);
				}
			});
			return Array.from(languages.values());
		});
}

async function getAvailableLanguages(languageCode) {
	// default number for cache the languages (in months)
	const EXPIRED_CACHE = 5;
	// name of the "cache" file for the languages
	const languagesJsonFileName = 'google/transcribe/languages/' + languageCode + '.json';

	let languagesFile = fs.readFileSync(languagesJsonFileName);
	let languagesJson = JSON.parse(languagesFile);

	try {
		if (!languagesJson.expireDate || languagesJson.expireDate <= Date.now()) {
			const languagesArray = await fetchData(languageCode);
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

/**
 * Parameters to configure the request can be found at:
 * https://cloud.google.com/speech-to-text/docs/reference/rest/v1p1beta1/RecognitionConfig
 *
 * @param liveOptions options for recognition
 * @returns a request to stream recognize
 */
function configureRequestToRecognize(liveOptions) {
	const request = {
		config: {
			encoding: 'FLAC',
			sampleRateHertz: 44100,
			languageCode: liveOptions.liveLanguage.bcp,
			useEnhanced: true, // if true and the model does not support api changes to standard version of the specified model
			enableAutomaticPunctuation: !!liveOptions.punctuation,
			profanityFilter: !!liveOptions.profanityFilter,
			//enableWordTimeOffsets: true
		},
		interimResults: true
	};
	return request;
}

exports.getAvailableLanguages = getAvailableLanguages;
exports.configureRequestToRecognize = configureRequestToRecognize;