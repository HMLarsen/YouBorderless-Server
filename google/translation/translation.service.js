const translate = require('google-translate-open-api').default;

function translateText(liveOptions, text) {
	return translate(text, {
		client: 'dict-chrome-ex',
		to: liveOptions.liveToLanguage.code,
		config: {
			timeout: 1000 * 5, // wait for 5 seconds
		}
	});
}

exports.translateText = translateText;