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
	if (typeof self.replConnectionCallback === 'function') {
		self.replConnectionCallback(socket);	
	}
	Bluebird.map(self.modules, function (nodeModule) {
		return new Bluebird(function (resolve, reject) {
			if (typeof nodeModule === 'object') {
				if (nodeModule.type === 'internal') {
					var path = path.resolve(__dirname, nodeModule.name);
					fs.open(path, function (err) {
						if (err) {
							self.logger('Requested module does not exist or file path is incorrect. Please ensure that ' + path + ' is correct', err);
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
							try {
								var installString = 'npm i ' + nodeModule.name.toLowerCase();
								exec(installString);
								var installed = require(nodeModule.name);
								self.context[contextName] = installed;
								resolve();
							}
							catch (err) {
								self.logger('Requested module could not be installed because it does not exist on npm')
							}
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
	this.logger = options.logger || console.log;
	this.errHandler = options.onError;
	this.connectionUrl = options.connectionUrl || '/';
	this.templatePath = options.templatePath || path.resolve(__dirname, '../views/example.html');
	this.connectionMessage = options.connectionMessage;
	var self = this;
	this.replConnectionCallback = options.replConnectionCallback || function (socket) {
		if (self.connectionMessage) {
			socket.emit('stdout', self.connectionMessage);
		}
		else {
			socket.emit('stdout', 'Hello World');
		}
	};
	this.serverConnectionCallback = (typeof options.serverConnectionCallback === 'function') ? options.serverConnectionCallback : function (req, res) {
		res.sendFile(self.templatePath);
	};
	if (this.server && !options.startServer) {
		this.io = sockets(this.server);
	}
	else {
		app = express();
		this.server = http.Server(app);
		this.io = sockets(this.server);
		this.server.listen(this.port);
		app.get(self.connectionUrl, self.serverConnectionCallback);
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
			stream.emit('data', data + '\r\n');
		});
	};
	this._getStream = function () {
		return stream;
	};
	if (typeof this.namespace === 'string') {
		this.namespaces[this.namespace] = this.io.of('/' + this.namespace);
		this.namespaces[this.namespace].on('connection', function (socket) {
			socket.on('disconnect', function () {
				self.disconnect();
			});
			socket.on('end', function () {
				self.disconnect();
			});
			socket.on('close', function () {
				self.disconnect();
			});
			configureConnection.call(self, socket);
		});
		this.namespaces[this.namespace].on('error', function (err) {
			if (self.errHandler && typeof self.errHandler === 'function') {
				self.errHandler(err);
			}
			else {
				self.logger('Error with io connection', err);
			}
		});
	}
	else {
		this.io.on('connection', function (socket) {
			configureConnection.call(self, socket);
			socket.on('disconnect', function () {
				self.disconnect();
			});
			socket.on('end', function () {
				self.disconnect();
			});
			socket.on('close', function () {
				self.disconnect();
			});
		});
		this.io.on('error', function (err) {
			if (self.errHandler && typeof self.errHandler === 'function') {
				self.errHandler(err);
			}
			else {
				self.logger('Error with io connection', err);
			}
		});
	}
};

REPLIE.prototype.disconnect = function () {
	this.logger('User Disconnected');
	var self = this,
		rp = self._getREPL();
	if (rp) {
		self._getStream().emit('data', '.exit\r\n');
	}
	return self;
};

REPLIE.prototype.extendContext = function (options, callback) {
	var self = this,
		context = self._getREPL().context,
		extend = function (nodeModule) {
			return new Bluebird(function (resolve) {
				if (typeof nodeModule === 'object') {
					if (nodeModule.type === 'internal') {
						var path = path.resolve(__dirname, nodeModule.name);
						fs.open(path, function (err) {
							if (err) {
								self.logger('Requested module does not exist or file path is incorrect. Please ensure that ' + path + ' is correct', err);
								resolve();
							}
							else {
								context[path.basename(nodeModule.name, '.js')] = require(path);
								resolve();
							}
						});
					}
					else if (nodeModule.type === 'external') {
						if (nodeModule.name === 'shelljs') {
							context.exec = exec;
							resolve();
						}
						else {
							var contextName = (nodeModule.name.split('.').length > 1) ? nodeModule.name.split('.')[1] : nodeModule.name.split('.')[0];
							try {
								var mod = require(nodeModule.name);
								context[contextName] = mod;
								resolve();
							}
							catch (e) {
								try {
									var installString = 'npm i ' + nodeModule.name.toLowerCase();
									exec(installString);
									var installed = require(nodeModule.name);
									context[contextName] = installed;
									resolve();
								}
								catch (err) {
									self.logger('Requested module could not be installed because it does not exist on npm')
								}
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
		}; 
	if (options && Array.isArray(options)) {
		if (typeof callback === 'function') {
			Bluebird.map(options, extend)
				.then(function () {
					callback(null, 'Modules added');
				})
				.catch(function (err) {
					callback(err);
				});
		}
		else {
			return new Bluebird(function (resolve, reject) {
				Bluebird.map(options, extend)
					.then(function () {
						resolve();
					})
					.catch(function (err) {
						reject(err);
					});
			});
		}
	}
	else {
		if (typeof callback === 'function') {
			extend(options)
				.then(function () {
					callback(null, 'Module added');
				})
				.catch(function (err) {
					callback(err);
				});
		}
		else {
			return new Bluebird(function (resolve, reject) {
				extend(options)
					.then(function () {
						resolve();
					})
					.catch(function (err) {
						reject(err);
					});
			});
		}
	}
};

module.exports = REPLIE;