'use strict';

var REPLIE = require('./lib/replie');
module.exports = REPLIE;
/*
REPLIE Options
{
	prompt: {String} Repl Command Line Prompt,
	server: {Object} Express server instance, leave undefined and pass options.startSever to have replie create a server instance,
	port: {Number} Port for express server to listen on, will default to 5000 if not specified (this is only used if you are passing options.startServer),
	modules: {Array} Array of internal and external modules for replie to load into its context, see example below,
	namespace: {String} Optional namespacing for web socket,
	logger: {Function} Optional logger function, defaults to console.log,
	onError: {Function} Error handling function,
	connectionUrl: {String} Optional connection path if replie is starting server,
	templatePath: {String} File path for html if replie is starting server,
	connectionMessage: {String} Message for socket emitter on connection,
	replConnectionCallback: {Function} Optional socket connection callback function defaults to emitting connectionMessage,
	serverConnectionCallback: {Function} Optional server connection callback if replie is starting server, defaults to sendFile using templatePath
}
 */
// Example
var repl = new REPLIE({
		prompt: 'REPLIE',
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
		],
		namespace: 'test'
	});