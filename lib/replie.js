'use strict';
var repl = require('repl'),
	http = require('http'),
	express = require('express'),
	sockets = require('socket.io'),
	Stream = require('stream'),
	path = require('path'),
	app;

var REPLIE = function (options) {
	var rp,
		stream;
	this.prompt = options.prompt;
	this.server = options.server;
	this.port = options.port || 5000;
	if (this.server && !options.startServer) {
		this.io = sockets(this.server);
	}
	else {
		app = express();
		//app.use(require('body-parser'));
		this.server = http.Server(app);
		this.io = sockets(this.server);
		this.server.listen(this.port);
		app.get('/', function (req, res) {
			res.sendFile(path.resolve(__dirname, '../views/index.html'));
		});
	}
	this._setREPL = function () {
		if (stream) {
			rp = repl.start({
				prompt: (this.prompt) ? this.prompt + '> ' : '> ',
				input: stream,
				output: stream 
			});
		}
	};
	this._setStream = function (socket) {
		stream = new Stream();
		stream.readable = true;
		stream.write = function (data) {
			socket.emit('stdout', data);
		};
		stream.resume = function () {};
		socket.on('stdin', function (data) {
			console.log('writing data to stream', data);
			stream.emit('data', data + '\r\n');
		});
	};
	var self = this;
	this.io.on('connection', function (socket) {
		socket.emit('stdout', 'hello');
		self._setStream(socket);
		self._setREPL();
	});
	this.io.on('error', function (err) {
		console.log('Error with io connection', err);
	});
};

module.exports = REPLIE;