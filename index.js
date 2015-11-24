'use strict';

var REPLIE = require('./lib/replie'),
	repl = new REPLIE({
		prompt: 'REPLIE',
		startServer: true,
		modules: [
			{
				name: 'shelljs',
				type: 'external'
			}
			// {
			// 	name: 'async',
			// 	type: 'external'
			// },
			// {
			// 	name: 'lodash.clone',
			// 	type: 'external'
			// }
		],
		namespace: 'test'
	});