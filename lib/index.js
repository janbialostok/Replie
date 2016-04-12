'use strict';
const spawn = require('child_process').spawn,
	path = require('path'),
	Stream = require('stream'),
	REPLIE_STANDARD = require('./replie');

var runProcess = function (argv) {
	let stream = this._getStream();
	argv.unshift(path.join(__dirname, '../scripts/process.js'));
	this.child = spawn('node', argv, {
		stdio: ['pipe', 'pipe', 'pipe']
	});
	stream.pipe(this.child.stdin);
	this.child.stdout.on('data', function (d) {
		d = d.toString();
		stream.write(d);
	});
	this.child.stderr.on('data', function (e) {
		e = e.string();
		stream.write(e);
	});
	return this;
};

class REPLIE extends REPLIE_STANDARD {
	start (options) {
		this.child_process = (options && typeof options.child_process === 'boolean') ? options.child_process : this.child_process;
		return super.start()
			.then(_this => {
				return runProcess.call(_this, ['--data', JSON.stringify({
					modules: this.modules
				})]);
			});
	}
}

module.exports = REPLIE;