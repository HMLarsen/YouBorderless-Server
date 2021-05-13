const translate = require('google-translate-open-api').default;

function translateTextFree(liveOptions, text) {
	return translate(text, {
		client: 'dict-chrome-ex',
		to: liveOptions.liveToLanguage.code,
		config: {
			timeout: 1000 * 5, // wait for 5 seconds
		}
	});
}

exports.translateTextFree = translateTextFree;