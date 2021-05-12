module.exports = {
	NODE_ENV: process.env.NODE_ENV || 'development',
	PORT: process.env.PORT || 3000,
	CORS_ORIGIN: '*',
	YTDL_BINARY_NAME: process.env.NODE_ENV === undefined ? 'youtube-dl.bin' : 'youtube-dl-linux.bin',
}