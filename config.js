module.exports = {
	NODE_ENV: process.env.NODE_ENV || 'development',
	PORT: process.env.PORT || 3000,
	CORS_ORIGIN: process.env.NODE_ENV === undefined ? '*' : 'https://youborderless-d0a95.web.app',
	GOOGLE_PROJECT_ID: 'dulcet-pilot-307823',
	YTDL_BINARY_NAME: process.env.NODE_ENV === undefined ? 'youtube-dl.bin' : 'youtube-dl-linux.bin',
}