const translate = require('google-translate-open-api').default;

function translateTextFree(liveOptions, text) {
	return translate(text, {
		client: 'dict-chrome-ex',
		to: liveOptions.liveToLanguage.code
	});
}

exports.translateTextFree = translateTextFree;