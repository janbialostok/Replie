'use strict';
const Stream = require('stream'),
	REPLIE = require('./replie');

(function (argv) {
	let parseArguments = function (a) {
		try {
			let index = 0;
			while (!/--data/.test(a[index]) && a[index]) {
				a.shift();
			}
			if (!a.length) return [];
			return JSON.parse(a[1]).data;
		}
		catch (e) {
			console.log('There were no arguments returned', e);
			return [];
		}
	};
	let stream = new Stream();
	stream.readable = true;
	stream.resume = function () {};
	stream.pause = function () {};
	stream.on('data', function (data) {
		stream.emit('data', `${ data }\r\n`);
	});
	process.stdin.pipe(stream);
	stream.pipe(process.stdout);
	let options = parseArguments(argv);
	options.stream = stream;
	let repl = new REPLIE(options);
	repl.start()
		.then(() => {
			process.stdout.emit('data', {
				result: 'success',
				data: {
					message: 'Process started successfully'
				}
			});
		}, e => {
			process.stdout.emit('data', {
				result: 'error',
				data: {
					error: e
				}
			});
		});
})(process.argv);