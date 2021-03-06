'use strict';
const child_process = require('child_process'),
	Promisie = require('promisie'),
	map = Promisie.promisify(require('async').mapLimit),
	http = require('http'),
	express = require('express'),
	merge = require('util-extend'),
	path = require('path'),
	fs = Promisie.promisifyAll(require('fs')),
	sockets = require('socket.io'),
	Stream = require('stream'),
	REPL = require('repl');

require('shelljs/global');

var install = function (cmd) {
	return new Promise((resolve, reject) => {
		child_process.exec(cmd, {
			cwd: (this && typeof this === 'object' && this.cwd) ? this.cwd : path.join(__dirname, '../')
		}, (err, stdout, stderr) => {
			if (stdout) resolve(stdout);
			else reject(err || stderr);
		});
	});
};

var installModule = function (mod, cb) {
	try {
		if (typeof mod === 'object') {
			if (mod.type === 'internal') {
				let filePath = path.join(__dirname, mod.name);
				fs.statAsync(filePath)
					.then(() => {
						this.context[path.basename(filePath, '.js')] = require(filePath);
						cb(null, `${ mod.name } installed`);
					}, () => {
						cb(null, 'ERROR: FP-001');
					});
			}
			else if (mod.type === 'external') {
				if (mod.name === 'shelljs') {
					this.context.exec = exec;
					cb(null, 'shelljs installed'); 
				}
				else {
					let cleanedName = (/.+\..+/g.test(mod.name)) ? mod.name.substring(mod.name.indexOf('.')) : mod.name;
					try {
						let install = require(mod.name);
						this.context[cleanedName] = install;
						cb(null, `${ mod.name } installed`);
					}
					catch (e) {
						try {
							var installString = 'npm i ' + mod.name.toLowerCase();
							install(installString)
								.then(() => {
									let installed = require(mod.name);
									this.context[mod.name] = installed;			
									cb(null, `${ mod.name } installed`);
								});
						}
						catch (err) {
							cb(null, 'ERROR: MOD-001');
						}
					}
				}
			}
			else {
				cb(null, 'ERROR: FMT-002');
			}
		}
		else {
			cb(null, 'ERROR: FMT-001');
		}
	}
	catch (e) {
		console.log('ERR', e);
		cb(e);
	}
};

var configureModules = function (socket) {
	return map(this.modules, 5, installModule.bind(this))
		.then(results => {
			console.log('results', results);
			if (!socket || this._getStream()) this._setREPL();
			else {
				this._setStream(socket);
				this._setREPL();
			}
			return this;
		}, e => {
			console.log('ERROR', e.stack);
			return e;
		});
};

var configureConnection = function (socket, cb) {
	console.log('configureConnection');
	socket.on('disconnect', () => {
		this.disconnect()
			.then(() => {
				console.log('restarted');
			});
	});
	socket.on('end', () => {
		this.disconnect()
			.then(() => {
				console.log('restarted');
			});
	});
	socket.on('close', () => {
		this.disconnect()
			.then(() => {
				console.log('restarted');
			});
	});
	if (typeof this.replConnectionCallback === 'function') this.replConnectionCallback(socket);
	if (this.child_process || this.active) {
		this._setStream(socket);
		cb(null, this);
	}
	else {
		configureModules.call(this, socket)
			.then(_this => {
				if (_this instanceof Error) cb(_this);
				else cb(null, _this);
			});
	}
};

var REPLIE = class REPLIE {
	constructor (options) {
		let rp,
			stream = options.stream,
			app,
			connectedSocket;
		this.room = options.room;
		this.active = false;
		this.server = options.server;
		this.port = options.port || 5000;
		this.namespace = options.namespace;
		this.logger = options.logger || console.log;
		this.prompt = options.prompt;
		this.modules = options.modules || [];
		this.context = {};
		this.namespaces = {};
		this.sloppyMode = options.sloppyMode;
		this.errHandler = options.onError;
		this.child_process = options.child_process;
		this.connectionUrl = options.connectionUrl || '/';
		this.templatePath = options.templatePath || path.resolve(__dirname, '../views/example.html');
		this.connectionMessage = options.connectionMessage;
		this.replConnectionCallback = (typeof this.replConnectionCallback === 'function') ? this.replConnectionCallback : (socket) => {
			if (!this.room) {
				if (this.namespace) this.namespaces[this.namespace].emit('stdout', this.connectionMessage || 'Hello World');
				else this.io.emit('stdout', this.connectionMessage || 'Hello World');
			}
			else {
				if (this.namespace) this.namespaces[this.namespace].to(this.room).emit('stdout', this.connectionMessage || 'Hello World');
				else this.io.to(this.room).emit('stdout', this.connectionMessage || 'Hello World');
			}	
		};
		this.serverConnectionCallback = (typeof options.serverConnectionCallback === 'function') ? options.serverConnectionCallback : (req, res) => {
			res.sendFile(this.templatePath);
		};
		if (!options.stream) {
			if (options.io_server) this.io = options.io_server;
			else if (this.server && !options.startServer) this.io = sockets(this.server);
			else {
				app = express();
				this.server = http.Server(app);
				this.io = sockets(this.server);
				this.server.listen(this.port);
				app.get(this.connectionUrl, this.serverConnectionCallback);
			}
		}
		this._getREPL = () => {
			if (rp) return rp;
		};
		this._getSocket = () => {
			if (connectedSocket) return connectedSocket;
		};
		this._setSocket = (socket) => {
			connectedSocket = socket;
		};
		this._setREPL = function () {
			if (stream) {
				rp = REPL.start({
					prompt: (this.prompt) ? this.prompt + '> ' : '> ',
					input: stream,
					output: stream,
					replMode: (this.sloppyMode) ? REPL.REPL_MODE_SLOPPY : REPL.REPL_MODE_STRICT
				});
				rp.context = merge(rp.context, this.context);
			}
			this.active = true;
		};
		this._setStream = function (socket) {
			stream = new Stream();
			stream.readable = true;
			stream.write = (data) => {
				if (this.room) {
					if (this.namespace) this.namespaces[this.namespace].to(this.room).emit('stdout', data);
					else this.io.to(this.room).emit('stdout', data);
				}
				else {
					if (this.namespace) this.namespaces[this.namespace].emit('stdout', data);
					else this.io.emit('stdout', data);
				}
			};
			stream.resume = function () {};
			stream.pause = function () {};
			stream.destroy = function () {};
			stream.end = function () {};
			socket.on('stdin', function (data) {
				stream.emit('data', `${ data }\r\n`);
			});
			this.active = true;
		};
		this._getStream = function () {
			return stream;
		};
		return this;
	}
	start () {
		return new Promise((resolve, reject) => {
			if (this._getStream() && !this.child_process) {
				configureModules.call(this, null)
					.then(_this => {
						if (_this instanceof Error) reject(_this);
						else resolve(_this);
					});
			}
			else {
				if (typeof this.namespace === 'string') {
					this.namespaces[this.namespace] = this.io.of(`/${ this.namespace }`);
					this.namespaces[this.namespace].on('connection', socket => {
						if (this.room) socket.join(this.room);
						this._setSocket(socket);
						configureConnection.call(this, this._getSocket(), function (err, rp) {
							if (err) reject(err);
							else resolve(rp);
						});
					});
					this.namespaces[this.namespace].on('error', err => {
						if (this.errHandler && typeof this.errHandler === 'function') this.errHandler(err);
						else this.logger('Error with io connection', err);
					});
				}
				else {
					this.io.on('connection', socket => {
						if (this.room) socket.join(this.room);
						this._setSocket(socket);
						configureConnection.call(this, this._getSocket(), function (err, rp) {
							if (err) reject(err);
							else resolve(rp);
						});
					});
					this.io.on('error', e => {
						if (e) console.log('ERROR', e.stack);
					});
				}		
			}
		});		
	}
	disconnect () {
		this.logger('User Disconnected');
		let rp = this._getREPL();
		if (rp) {
			this._getStream().emit('data', '.clear\r\n');
		}
		return this.start();
	}
	extend (mod, cb) {
		if (typeof cb === 'function') {
			installModule.call(this, mod, cb);
		} 
		else return Promisie.promisify(installModule, this)(mod);
	}
	define (options) {
		let rp = this._getREPL();
		try {
			rp.defineCommand(`#${ options.command }`, {
				help: options.help || `type #${ options.command }`,
				action: options.action
			});
		}
		catch (e) {
			console.log('Command could not be defined', e);
		}
		return this;
	}
};

module.exports = REPLIE;