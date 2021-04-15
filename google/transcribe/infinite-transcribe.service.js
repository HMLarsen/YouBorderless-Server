const speech = require('@google-cloud/speech').v1p1beta1;
const { Writable } = require('stream');
const { spawn } = require('child_process');

const pathToFfmpeg = require('ffmpeg-static');
const { streamDownload } = require('../../live/youtube.service.js');
const { configureRequestToRecognize } = require('./transcribe-language.service.js');

const streamingLimit = 290000;
const client = new speech.SpeechClient();

function newBufferedLive(liveOptions, liveStartTime, consumer, refreshDataConsumer) {
	let recognizeStream = null;
	let ytdlStream = null;
	let restartCounter = 0;
	let audioInput = [];
	let lastAudioInput = [];
	let resultEndTime = 0;
	let isFinalEndTime = 0;
	let finalRequestEndTime = 0;
	let newStream = true;
	let bridgingOffset = 0;
	let lastTranscriptWasFinal = false;

	function startStream() {
		const audioInputStreamTransform = new Writable({
			write(chunk, encoding, next) {
				writeChunks(chunk, next)
			},
			final() {
				if (recognizeStream) {
					recognizeStream.end();
				}
			}
		});

		audioInput = [];
		const request = configureRequestToRecognize(liveOptions);

		// youtube download data
		// convert to flac audio for best performance in google transcribe
		const ffmpeg = spawn(pathToFfmpeg, ['-i', 'pipe:0', '-f', 'flac', '-ac', '1', '-af', 'aformat=s32:44100', 'pipe:1']);
		ffmpeg.stdout.on('data', chunk => writeChunks(chunk));

		ytdlStream = streamDownload(liveOptions.liveId, liveStartTime);
		ytdlStream.ffmpeg = ffmpeg;
		ytdlStream
			//.on('youtubeDlEvent', (eventType, eventData) => console.log('[youtubeDlEvent] - ' + eventType, eventData))
			.on('error', err => {
				const data = { recognizeStream, ytdlStream };
				destroyBufferedLive(data);
				console.error('destruiu por erro - ' + err);
			})
			.on('close', () => {
				const data = { recognizeStream, ytdlStream };
				destroyBufferedLive(data);
				console.log('end da stream do youtube');
			})
			.pipe(ffmpeg.stdin);
		request.config.encoding = 'FLAC';
		request.config.sampleRateHertz = 44100;

		// const recorder = require('node-record-lpcm16');
		// recorder
		// 	.record({
		// 		sampleRateHertz: 48000,
		// 		threshold: 0, // Silence threshold
		// 		silence: 1000,
		// 		keepSilence: true,
		// 		recordProgram: 'rec', // Try also "arecord" or "sox"
		// 	})
		// 	.stream()
		// 	.on('error', err => {
		// 		console.error('Audio recording error ' + err);
		// 	})
		// 	.pipe(audioInputStreamTransform);
		// request.config.encoding = 'LINEAR16';
		// request.config.sampleRateHertz = 16000;

		// Initiate (Reinitiate) a recognize stream
		recognizeStream = client
			.streamingRecognize(request)
			.on('error', err => {
				if (err.code === 11) {
					// restartStream();
				} else {
					const data = { recognizeStream, ytdlStream };
					destroyBufferedLive(data);
					console.error('API request error ' + err);
				}
			})
			.on('data', speechCallback);

		// // Restart stream when streamingLimit expires
		// setTimeout(restartStream, streamingLimit);
	}

	function writeChunks(chunk, next) {
		if (newStream && lastAudioInput.length !== 0) {
			// Approximate math to calculate time of chunks
			const chunkTime = streamingLimit / lastAudioInput.length;
			if (chunkTime !== 0) {
				if (bridgingOffset < 0) {
					bridgingOffset = 0;
				}
				if (bridgingOffset > finalRequestEndTime) {
					bridgingOffset = finalRequestEndTime;
				}
				const chunksFromMS = Math.floor(
					(finalRequestEndTime - bridgingOffset) / chunkTime
				);
				bridgingOffset = Math.floor(
					(lastAudioInput.length - chunksFromMS) * chunkTime
				);

				for (let i = chunksFromMS; i < lastAudioInput.length; i++) {
					if (recognizeStream && !recognizeStream.destroyed) {
						recognizeStream.write(lastAudioInput[i]);
					}
				}
			}
			newStream = false;
		}

		audioInput.push(chunk);

		if (recognizeStream && !recognizeStream.destroyed) {
			recognizeStream.write(chunk);
		}
		console.log('[buffer] - ' + chunk.length);
		if (next) next();
	}

	let concatenedOutput;
	let timer;
	const speechCallback = stream => {
		if (timer) clearTimeout(timer);

		// Convert API result end time from seconds + nanoseconds to milliseconds
		resultEndTime =
			stream.results[0].resultEndTime.seconds * 1000 +
			Math.round(stream.results[0].resultEndTime.nanos / 1000000);

		// Calculate correct time based on offset from audio sent twice
		const correctedTime = resultEndTime - bridgingOffset + streamingLimit * restartCounter;

		let stdoutText = '';
		if (stream.results[0] && stream.results[0].alternatives[0]) {
			stdoutText = stream.results[0].alternatives[0].transcript;
		}

		const isFinal = stream.results[0].isFinal;

		// stream.results.forEach(result => {
		// 	console.log(`Transcription: ${result.alternatives[0].transcript}`);
		// 	result.alternatives[0].words.forEach(wordInfo => {
		// 		// NOTE: If you have a time offset exceeding 2^32 seconds, use the
		// 		// wordInfo.{x}Time.seconds.high to calculate seconds.
		// 		const startSecs =
		// 			`${wordInfo.startTime.seconds}` +
		// 			'.' +
		// 			wordInfo.startTime.nanos / 100000000;
		// 		const endSecs =
		// 			`${wordInfo.endTime.seconds}` +
		// 			'.' +
		// 			wordInfo.endTime.nanos / 100000000;
		// 		console.log(`Word: ${wordInfo.word}`);
		// 		console.log(`\t ${startSecs} secs - ${endSecs} secs`);
		// 	});
		// });

		concatenedOutput = stdoutText;
		console.log('[' + isFinal + '] - ' + concatenedOutput);

		if (isFinal) {
			consumer({
				time: correctedTime,
				text: concatenedOutput,
				isFinal
			});
		} else {
			timer = setTimeout(() => {
				consumer({
					time: correctedTime,
					text: concatenedOutput,
					isFinal
				});
			}, 70);
		}

		if (isFinal) {
			isFinalEndTime = resultEndTime;
			lastTranscriptWasFinal = true;
		} else {
			lastTranscriptWasFinal = false;
		}
	};

	function restartStream() {
		if (!recognizeStream || !ytdlStream) {
			return;
		}
		// if the stream had destroyed by external call, like socket
		if (recognizeStream.destroyed || ytdlStream.destroyed) {
			return;
		}
		const data = { recognizeStream, ytdlStream };
		destroyBufferedLive(data);

		if (resultEndTime > 0) {
			finalRequestEndTime = isFinalEndTime;
		}
		resultEndTime = 0;

		lastAudioInput = [];
		lastAudioInput = audioInput;
		restartCounter++;

		if (!lastTranscriptWasFinal) {
			process.stdout.write('\n');
		}
		console.log(`${streamingLimit * restartCounter}: RESTARTING REQUEST\n`);

		newStream = true;
		startStream();
		refreshDataConsumer({ recognizeStream, ytdlStream });
	}

	startStream();
	return { recognizeStream, ytdlStream };
}

function destroyBufferedLive(data) {
	if (data.ytdlStream) {
		// destroy ffmpeg spawn listening to download stream output
		if (data.ytdlStream.ffmpeg) {
			data.ytdlStream.ffmpeg.stdin.destroy();
			data.ytdlStream.ffmpeg.stdout.destroy();
			data.ytdlStream.ffmpeg.stderr.destroy();
			data.ytdlStream.ffmpeg.kill();
			data.ytdlStream.ffmpeg = null;
		}
		// destroy its stream
		if (!data.ytdlStream.destroyed) {
			data.ytdlStream.removeAllListeners('close'); // to not call this method again when spawn is killed (lib implementation)
			data.ytdlStream.destroy();
		}
		// destroy spawn process created from lib related to download stream
		if (data.ytdlStream.youtubeDlProcess) {
			data.ytdlStream.youtubeDlProcess.stdin.destroy();
			data.ytdlStream.youtubeDlProcess.stdout.destroy();
			data.ytdlStream.youtubeDlProcess.stderr.destroy();
			data.ytdlStream.youtubeDlProcess.kill();
			data.ytdlStream.youtubeDlProcess = null;
		}
		data.ytdlStream = null;
		console.log('destroyed ytdl');
	}
	if (data.recognizeStream) {
		if (!data.recognizeStream.destroyed) {
			data.recognizeStream.destroy();
		}
		data.recognizeStream = null;
		console.log('destroyed speech');
	}
}

exports.newBufferedLive = newBufferedLive;
exports.destroyBufferedLive = destroyBufferedLive;