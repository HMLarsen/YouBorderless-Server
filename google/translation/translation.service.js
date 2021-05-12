const translate = require('google-translate-open-api').default;

function translateTextFree(liveOptions, text) {
	return translate(text, {
		client: 'dict-chrome-ex',
		to: liveOptions.liveToLanguage.code,
		config: {
			timeout: 1000 * 3, // wait for 3 seconds
		}
	});
}

exports.translateTextFree = translateTextFree;