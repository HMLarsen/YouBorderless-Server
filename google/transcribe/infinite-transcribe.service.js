const speech = require('@google-cloud/speech').v1p1beta1;
const { spawn } = require('child_process');

const pathToFfmpeg = require('ffmpeg-static');
const { streamDownload } = require('../../live/youtube.service.js');
const { configureRequestToRecognize } = require('./transcribe-language.service.js');

// maximum streaming limit should be 1/2 of SpeechAPI Streaming Limit.
const STREAMING_LIMIT = 210000; // ~3 minutes and half.
const FAST_MODE_INTERVAL = 200;
const SLOW_MODE_INTERVAL = 5000;
const client = new speech.SpeechClient();

function newBufferedLive(liveOptions, consumer, refreshDataConsumer) {
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
	let fastMode = false;

	function startStream() {
		audioInput = [];
		fastMode = liveOptions.fastMode;

		// convert to flac audio for best performance in google transcribe
		const _ = require('highland');

		// ffmpeg converter youtube video to FLAC 24-bits 48khz
		const ffmpeg = spawn(pathToFfmpeg, ['-i', 'pipe:0', '-f', 'flac', '-ac', '1', '-af', 'aformat=s32:48000', 'pipe:1']);
		_(ffmpeg.stdout)
			.ratelimit(1, 250) // limit the chunks for best results
			.on('data', chunk => writeChunks(chunk));

		// youtube download data (binary video) to ffmpeg converter
		ytdlStream = streamDownload(liveOptions.liveId);
		ytdlStream.ffmpeg = ffmpeg;
		_(ytdlStream)
			.ratelimit(1, 40) // limit the download rate
			.on('error', err => {
				const data = { recognizeStream, ytdlStream };
				destroyBufferedLive(data);
				console.error('destruiu por erro - ' + err);
			})
			.on('close', () => {
				const data = { recognizeStream, ytdlStream };
				destroyBufferedLive(data);
				console.log('transmissão do Youtube finalizada');
			})
			.pipe(ffmpeg.stdin);

		// Initiate (Reinitiate) a recognize stream
		const request = configureRequestToRecognize(liveOptions);
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

		// restart stream when streamingLimit expires
		setTimeout(restartStream, STREAMING_LIMIT);
	}

	function writeChunks(chunk) {
		if (newStream && lastAudioInput.length !== 0) {
			// Approximate math to calculate time of chunks
			const chunkTime = STREAMING_LIMIT / lastAudioInput.length;
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
			console.log('[buffer] - ' + chunk.length);
		}
	}

	let concatenedOutput;
	let slowModeTimer = {};
	let resultsTimer;
	const speechCallback = stream => {
		if (resultsTimer) clearTimeout(resultsTimer);

		// Convert API result end time from seconds + nanoseconds to milliseconds
		resultEndTime =
			stream.results[0].resultEndTime.seconds * 1000 +
			Math.round(stream.results[0].resultEndTime.nanos / 1000000);

		// Calculate correct time based on offset from audio sent twice
		const correctedTime = resultEndTime - bridgingOffset + STREAMING_LIMIT * restartCounter;

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

		if (isFinal) {
			if (slowModeTimer.timer) {
				clearTimeout(slowModeTimer.timer);
				slowModeTimer.timer = null;
			}
			consumer({
				time: correctedTime,
				text: concatenedOutput,
				isFinal
			});
		} else if (fastMode) {
			resultsTimer = setTimeout(() => {
				consumer({
					time: correctedTime,
					text: concatenedOutput,
					isFinal
				});
			}, FAST_MODE_INTERVAL);
		} else {
			if (!slowModeTimer.timer) {
				slowModeTimer.timer = setTimeout(() => {
					consumer({
						time: slowModeTimer.correctedTime,
						text: slowModeTimer.concatenedOutput,
						isFinal: slowModeTimer.isFinal
					});
					slowModeTimer.timer = null;
				}, SLOW_MODE_INTERVAL);
			}
			slowModeTimer.correctedTime = correctedTime;
			slowModeTimer.concatenedOutput = concatenedOutput;
			slowModeTimer.isFinal = isFinal;
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
		console.log(`${STREAMING_LIMIT * restartCounter}: RESTARTING REQUEST\n`);

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
	}
	if (data.recognizeStream) {
		if (!data.recognizeStream.destroyed) {
			data.recognizeStream.destroy();
		}
		data.recognizeStream = null;
	}
}

exports.newBufferedLive = newBufferedLive;
exports.destroyBufferedLive = destroyBufferedLive;