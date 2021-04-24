module.exports = {
	NODE_ENV: process.env.NODE_ENV || 'development',
	PORT: process.env.PORT || 3000,
	CORS_ORIGIN: process.env.NODE_ENV === undefined ? '*' : 'https://youborderless-42519.web.app',
	YTDL_BINARY_NAME: process.env.NODE_ENV === undefined ? 'youtube-dl.bin' : 'youtube-dl-linux.bin',
}