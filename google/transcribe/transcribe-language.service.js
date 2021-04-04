const fs = require('fs');
const cheerio = require('cheerio');
const axios = require('axios');

async function fetchData() {
	// default language "pt" for the page, the reason is getting correctly the models parsed from page
	// TODO language code by front-end... it will be necessary to change the code below... to retrieve models
	const languagesUrl = 'https://cloud.google.com/speech-to-text/docs/languages?hl=pt';
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

				// se a linguagem existe no mapa significa que existe outro model para ela
				// mais de uma linha pro mesmo bcp = mais de um model
				let language = languages.get(bcp);
				if (!language) {
					languages.set(bcp, {
						name,
						bcp,
						models: [],
						punctuation: !!punctuation,
						diarization: !!diarization,
						boost: !!boost,
						confidence: !!confidence,
						profanityFilter: !!profanityFilter
					});
					language = languages.get(bcp);
				}
				// modelos
				switch (model) {
					case 'Vídeo':
						language.models.push('video');
						break;

					case 'Vídeo aprimorado':
						language.models.push('enhanced_video');
						break;

					case 'Chamada telefônica':
					case 'Chamada telefônica (Beta)':
						language.models.push('phone_call');
						break;

					case 'Chamada telefônica aprimorada':
					case 'Chamada telefônica aprimorada (Beta)':
						language.models.push('enhanced_phone_call');
						break;

					case 'Comando e pesquisa':
						language.models.push('command_and_search');
						break;

					default:
						language.models.push('default');
						break;
				}
			});
			return Array.from(languages.values());
		});
}

async function getAvailableLanguages() {
	// default number for cache the languages (in months)
	const EXPIRED_CACHE = 5;
	// name of the "cache" file for the languages
	const languagesJsonFileName = 'google/transcribe/transcribe-languages.json';

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