'use strict';
var repl = require('repl'),
	http = require('http'),
	express = require('express'),
	Bluebird = require('bluebird'),
	merge = require('util-extend'),
	path = require('path'),
	fs = require('fs'),
	sockets = require('socket.io'),
	Stream = require('stream'),
	path = require('path'),
	app;

require('shelljs/global');

var configureConnection = function (socket) {
	var self = this;
	socket.emit('stdout', 'hello');
	Bluebird.map(self.modules, function (nodeModule) {
		return new Bluebird(function (resolve, reject) {
			if (typeof nodeModule === 'object') {
				if (nodeModule.type === 'internal') {
					var path = path.resolve(__dirname, nodeModule.name);
					fs.open(path, function (err) {
						if (err) {
							resolve();
						}
						else {
							self.context[path.basename(nodeModule.name, '.js')] = require(path);
							resolve();
						}
					});
				}
				else if (nodeModule.type === 'external') {
					if (nodeModule.name === 'shelljs') {
						self.context.exec = exec;
						resolve();
					}
					else {
						var contextName = (nodeModule.name.split('.').length > 1) ? nodeModule.name.split('.')[1] : nodeModule.name.split('.')[0];
						try {
							var mod = require(nodeModule.name);
							self.context[contextName] = mod;
							resolve();
						}
						catch (e) {
							var installString = 'npm i ' + nodeModule.name.toLowerCase();
							exec(installString);
							var installed = require(nodeModule.name);
							self.context[contextName] = installed;
							resolve();
						}
					}
				}
				else {
					resolve();
				}
			}
			else {
				resolve();
			}
		});
	}).then(function () {
		self._setStream(socket);
		self._setREPL();
	});
};

var REPLIE = function (options) {
	var rp,
		stream;
	this.prompt = options.prompt;
	this.server = options.server;
	this.port = options.port || 5000;
	this.modules = options.modules || [];
	this.context = {};
	this.namespace = options.namespace;
	this.namespaces = {};
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
	this._getREPL = function () {
		if (rp) {
			return rp;
		}
	};
	this._setREPL = function () {
		if (stream) {
			rp = repl.start({
				prompt: (this.prompt) ? this.prompt + '> ' : '> ',
				input: stream,
				output: stream,
			});
			rp.context = merge(rp.context, this.context);
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
	if (typeof this.namespace === 'string') {
		this.namespaces[this.namespace] = this.io.of('/' + this.namespace);
		this.namespaces[this.namespace].on('connection', function (socket) {
			configureConnection.call(self, socket);
		});
		this.namespaces[this.namespace].on('error', function (err) {
			console.log('Error with io connection', err);
		});
	}
	else {
		this.io.on('connection', function (socket) {
			configureConnection.call(self, socket);
		});
		this.io.on('error', function (err) {
			console.log('Error with io connection', err);
		});
	}
};

module.exports = REPLIE;