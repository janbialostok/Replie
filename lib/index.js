'use strict';
const spawn = require('child_process').spawn,
	path = require('path'),
	REPLIE_STANDARD = require('./replie');

var replieType;

var runProcess = function (argv) {
	let stream = this._getStream();
	this.child = spawn(`node ${ path.join(process.cwd(), './scripts/process.js') }`, argv, {
		cwd: process.cwd(),
		stdio: [stream, stream, stream]
	});
	return this;
};

class REPLIE extends REPLIE_STANDARD {
	start (options) {
		this.child_process = (options && typeof options.child_process === 'boolean') ? options.child_process : this.child_process;
		return super.start()
			.then(_this => {
				return runProcess.call(_this, ['--data', JSON.stringify({
					data: this.modules
				})]);
			});
	}
}

module.exports = function (type) {
	replieType = type;
	return REPLIE;
};