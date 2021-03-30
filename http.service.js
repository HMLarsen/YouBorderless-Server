const axios = require('axios');

async function fetchData(url) {
	return await axios(url);
}

exports.fetchData = fetchData;