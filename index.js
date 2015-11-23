'use strict';

var REPLIE = require('./lib/replie'),
	repl = new REPLIE({
		prompt: 'Hello World',
		startServer: true
	});