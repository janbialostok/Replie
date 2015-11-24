'use strict';

var REPLIE = require('./lib/replie'),
	repl = new REPLIE({
		prompt: 'Hello World',
		startServer: true,
		modules: [
			{
				name: 'shelljs',
				type: 'external'
			},
			{
				name: 'async',
				type: 'external'
			},
			{
				name: 'lodash.clone',
				type: 'external'
			}
		]
	});