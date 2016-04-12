'use strict';
const Stream = require('stream'),
	path = require('path'),
	REPLIE = require(path.join(__dirname, '../lib/replie'));

(function (argv) {
	let stream = new Stream();
	try {
		let parseArguments = function (a) {
			try {
				let index = 0;
				while (!/--data/.test(a[index]) && a[index]) {
					a.shift();
				}
				if (!a.length) return [];
				return JSON.parse(a[1]);
			}
			catch (e) {
				console.log('There were no arguments returned', e);
				return [];
			}
		};
		let options = parseArguments(argv);
		stream.readable = true;
		process.stdin.on('data', function (d) {
			d = new Buffer(d).toString();
			stream.emit('data', d);
		});
		process.stdin.write = function (d) {
			process.stdin.emit('data', d);
		};
		stream.write = function (d) {
			if (d instanceof Buffer) {
				d = d.toString();
			}
			else if (d && typeof d === 'object') {
				d = JSON.stringify(d);
			}
			process.stdout.write(d);
		};
		stream.resume = function () {};
		stream.pause = function () {};
		stream.destroy = function () {};
		stream.end = function () {};
		options.stream = stream;
		let repl = new REPLIE(options);
		repl.start()
			.then(() => {
				stream.write({
					result: 'success',
					data: {
						message: 'Process started successfully'
					}
				});
			}, e => {
				stream.write({
					result: 'error',
					data: {
						error: e
					}
				});
			});
	}
	catch (e) {
		if (stream) {
			stream.write({
				result: 'error',
				data: {
					error: e
				}
			});
		}
		else {
			console.log(e);
		}
		process.exit(0);
	}
})(process.argv);