!function (e) {
    if ("object" == typeof exports && "undefined" != typeof module)
        module.exports = e();
    else if ("function" == typeof define && define.amd)
        define([], e);
    else {
        var f;
        "undefined" != typeof window ? f = window : "undefined" != typeof global ? f = global : "undefined" != typeof self && (f = self),
            f.io = e()
    }
}(function () {
    var define, module, exports;
    return function e(t, n, r) {
        function s(o, u) {
            if (!n[o]) {
                if (!t[o]) {
                    var a = typeof require == "function" && require;
                    if (!u && a)
                        return a(o, !0);
                    if (i)
                        return i(o, !0);
                    throw new Error("Cannot find module '" + o + "'")
                }
                var f = n[o] = {
                    exports: {}
                };
                t[o][0].call(f.exports, function (e) {
                    var n = t[o][1][e];
                    return s(n ? n : e)
                }, f, f.exports, e, t, n, r)
            }
            return n[o].exports
        }

        var i = typeof require == "function" && require;
        for (var o = 0; o < r.length; o++)
            s(r[o]);
        return s
    }({
        1: [function (_dereq_, module, exports) {
            module.exports = _dereq_("./lib/")
        }
            , {
                "./lib/": 2
            }],
        2: [function (_dereq_, module, exports) {
            var url = _dereq_("./url");
            var parser = _dereq_("socket.io-parser");
            var Manager = _dereq_("./manager");
            var debug = _dereq_("debug")("socket.io-client");
            module.exports = exports = lookup;
            var cache = exports.managers = {};

            function lookup(uri, opts) {
                if (typeof uri == "object") {
                    opts = uri;
                    uri = undefined
                }
                opts = opts || {};
                var parsed = url(uri);
                var source = parsed.source;
                var id = parsed.id;
                var io;
                if (opts.forceNew || opts["force new connection"] || false === opts.multiplex) {
                    debug("ignoring socket cache for %s", source);
                    io = Manager(source, opts)
                } else {
                    if (!cache[id]) {
                        debug("new io instance for %s", source);
                        cache[id] = Manager(source, opts)
                    }
                    io = cache[id]
                }
                return io.socket(parsed.path)
            }

            exports.protocol = parser.protocol;
            exports.connect = lookup;
            exports.Manager = _dereq_("./manager");
            exports.Socket = _dereq_("./socket")
        }
            , {
                "./manager": 3,
                "./socket": 5,
                "./url": 6,
                debug: 10,
                "socket.io-parser": 46
            }],
        3: [function (_dereq_, module, exports) {
            var url = _dereq_("./url");
            var eio = _dereq_("engine.io-client");
            var Socket = _dereq_("./socket");
            var Emitter = _dereq_("component-emitter");
            var parser = _dereq_("socket.io-parser");
            var on = _dereq_("./on");
            var bind = _dereq_("component-bind");
            var object = _dereq_("object-component");
            var debug = _dereq_("debug")("socket.io-client:manager");
            var indexOf = _dereq_("indexof");
            var Backoff = _dereq_("backo2");
            module.exports = Manager;

            function Manager(uri, opts) {
                if (!(this instanceof Manager))
                    return new Manager(uri, opts);
                if (uri && "object" == typeof uri) {
                    opts = uri;
                    uri = undefined
                }
                opts = opts || {};
                opts.path = opts.path || "/socket.io";
                this.nsps = {};
                this.subs = [];
                this.opts = opts;
                this.reconnection(opts.reconnection !== false);
                this.reconnectionAttempts(opts.reconnectionAttempts || Infinity);
                this.reconnectionDelay(opts.reconnectionDelay || 1e3);
                this.reconnectionDelayMax(opts.reconnectionDelayMax || 5e3);
                this.randomizationFactor(opts.randomizationFactor || .5);
                this.backoff = new Backoff({
                    min: this.reconnectionDelay(),
                    max: this.reconnectionDelayMax(),
                    jitter: this.randomizationFactor()
                });
                this.timeout(null == opts.timeout ? 2e4 : opts.timeout);
                this.readyState = "closed";
                this.uri = uri;
                this.connected = [];
                this.encoding = false;
                this.packetBuffer = [];
                this.encoder = new parser.Encoder;
                this.decoder = new parser.Decoder;
                this.autoConnect = opts.autoConnect !== false;
                if (this.autoConnect)
                    this.open()
            }

            Manager.prototype.emitAll = function () {
                this.emit.apply(this, arguments);
                for (var nsp in this.nsps) {
                    this.nsps[nsp].emit.apply(this.nsps[nsp], arguments)
                }
            }
            ;
            Manager.prototype.updateSocketIds = function () {
                for (var nsp in this.nsps) {
                    this.nsps[nsp].id = this.engine.id
                }
            }
            ;
            Emitter(Manager.prototype);
            Manager.prototype.reconnection = function (v) {
                if (!arguments.length)
                    return this._reconnection;
                this._reconnection = !!v;
                return this
            }
            ;
            Manager.prototype.reconnectionAttempts = function (v) {
                if (!arguments.length)
                    return this._reconnectionAttempts;
                this._reconnectionAttempts = v;
                return this
            }
            ;
            Manager.prototype.reconnectionDelay = function (v) {
                if (!arguments.length)
                    return this._reconnectionDelay;
                this._reconnectionDelay = v;
                this.backoff && this.backoff.setMin(v);
                return this
            }
            ;
            Manager.prototype.randomizationFactor = function (v) {
                if (!arguments.length)
                    return this._randomizationFactor;
                this._randomizationFactor = v;
                this.backoff && this.backoff.setJitter(v);
                return this
            }
            ;
            Manager.prototype.reconnectionDelayMax = function (v) {
                if (!arguments.length)
                    return this._reconnectionDelayMax;
                this._reconnectionDelayMax = v;
                this.backoff && this.backoff.setMax(v);
                return this
            }
            ;
            Manager.prototype.timeout = function (v) {
                if (!arguments.length)
                    return this._timeout;
                this._timeout = v;
                return this
            }
            ;
            Manager.prototype.maybeReconnectOnOpen = function () {
                if (!this.reconnecting && this._reconnection && this.backoff.attempts === 0) {
                    this.reconnect()
                }
            }
            ;
            Manager.prototype.open = Manager.prototype.connect = function (fn) {
                debug("readyState %s", this.readyState);
                if (~this.readyState.indexOf("open"))
                    return this;
                debug("opening %s", this.uri);
                this.engine = eio(this.uri, this.opts);
                var socket = this.engine;
                var self = this;
                this.readyState = "opening";
                this.skipReconnect = false;
                var openSub = on(socket, "open", function () {
                    self.onopen();
                    fn && fn()
                });
                var errorSub = on(socket, "error", function (data) {
                    debug("connect_error");
                    self.cleanup();
                    self.readyState = "closed";
                    self.emitAll("connect_error", data);
                    if (fn) {
                        var err = new Error("Connection error");
                        err.data = data;
                        fn(err)
                    } else {
                        self.maybeReconnectOnOpen()
                    }
                });
                if (false !== this._timeout) {
                    var timeout = this._timeout;
                    debug("connect attempt will timeout after %d", timeout);
                    var timer = setTimeout(function () {
                        debug("connect attempt timed out after %d", timeout);
                        openSub.destroy();
                        socket.close();
                        socket.emit("error", "timeout");
                        self.emitAll("connect_timeout", timeout)
                    }, timeout);
                    this.subs.push({
                        destroy: function () {
                            clearTimeout(timer)
                        }
                    })
                }
                this.subs.push(openSub);
                this.subs.push(errorSub);
                return this
            }
            ;
            Manager.prototype.onopen = function () {
                debug("open");
                this.cleanup();
                this.readyState = "open";
                this.emit("open");
                var socket = this.engine;
                this.subs.push(on(socket, "data", bind(this, "ondata")));
                this.subs.push(on(this.decoder, "decoded", bind(this, "ondecoded")));
                this.subs.push(on(socket, "error", bind(this, "onerror")));
                this.subs.push(on(socket, "close", bind(this, "onclose")))
            }
            ;
            Manager.prototype.ondata = function (data) {
                this.decoder.add(data)
            }
            ;
            Manager.prototype.ondecoded = function (packet) {
                this.emit("packet", packet)
            }
            ;
            Manager.prototype.onerror = function (err) {
                debug("error", err);
                this.emitAll("error", err)
            }
            ;
            Manager.prototype.socket = function (nsp) {
                var socket = this.nsps[nsp];
                if (!socket) {
                    socket = new Socket(this, nsp);
                    this.nsps[nsp] = socket;
                    var self = this;
                    socket.on("connect", function () {
                        socket.id = self.engine.id;
                        if (!~indexOf(self.connected, socket)) {
                            self.connected.push(socket)
                        }
                    })
                }
                return socket
            }
            ;
            Manager.prototype.destroy = function (socket) {
                var index = indexOf(this.connected, socket);
                if (~index)
                    this.connected.splice(index, 1);
                if (this.connected.length)
                    return;
                this.close()
            }
            ;
            Manager.prototype.packet = function (packet) {
                debug("writing packet %j", packet);
                var self = this;
                if (!self.encoding) {
                    self.encoding = true;
                    this.encoder.encode(packet, function (encodedPackets) {
                        for (var i = 0; i < encodedPackets.length; i++) {
                            self.engine.write(encodedPackets[i])
                        }
                        self.encoding = false;
                        self.processPacketQueue()
                    })
                } else {
                    self.packetBuffer.push(packet)
                }
            }
            ;
            Manager.prototype.processPacketQueue = function () {
                if (this.packetBuffer.length > 0 && !this.encoding) {
                    var pack = this.packetBuffer.shift();
                    this.packet(pack)
                }
            }
            ;
            Manager.prototype.cleanup = function () {
                var sub;
                while (sub = this.subs.shift())
                    sub.destroy();
                this.packetBuffer = [];
                this.encoding = false;
                this.decoder.destroy()
            }
            ;
            Manager.prototype.close = Manager.prototype.disconnect = function () {
                this.skipReconnect = true;
                this.backoff.reset();
                this.readyState = "closed";
                this.engine && this.engine.close()
            }
            ;
            Manager.prototype.onclose = function (reason) {
                debug("close");
                this.cleanup();
                this.backoff.reset();
                this.readyState = "closed";
                this.emit("close", reason);
                if (this._reconnection && !this.skipReconnect) {
                    this.reconnect()
                }
            }
            ;
            Manager.prototype.reconnect = function () {
                if (this.reconnecting || this.skipReconnect)
                    return this;
                var self = this;
                if (this.backoff.attempts >= this._reconnectionAttempts) {
                    debug("reconnect failed");
                    this.backoff.reset();
                    this.emitAll("reconnect_failed");
                    this.reconnecting = false
                } else {
                    var delay = this.backoff.duration();
                    debug("will wait %dms before reconnect attempt", delay);
                    this.reconnecting = true;
                    var timer = setTimeout(function () {
                        if (self.skipReconnect)
                            return;
                        debug("attempting reconnect");
                        self.emitAll("reconnect_attempt", self.backoff.attempts);
                        self.emitAll("reconnecting", self.backoff.attempts);
                        if (self.skipReconnect)
                            return;
                        self.open(function (err) {
                            if (err) {
                                debug("reconnect attempt error");
                                self.reconnecting = false;
                                self.reconnect();
                                self.emitAll("reconnect_error", err.data)
                            } else {
                                debug("reconnect success");
                                self.onreconnect()
                            }
                        })
                    }, delay);
                    this.subs.push({
                        destroy: function () {
                            clearTimeout(timer)
                        }
                    })
                }
            }
            ;
            Manager.prototype.onreconnect = function () {
                var attempt = this.backoff.attempts;
                this.reconnecting = false;
                this.backoff.reset();
                this.updateSocketIds();
                this.emitAll("reconnect", attempt)
            }
        }
            , {
                "./on": 4,
                "./socket": 5,
                "./url": 6,
                backo2: 7,
                "component-bind": 8,
                "component-emitter": 9,
                debug: 10,
                "engine.io-client": 11,
                indexof: 42,
                "object-component": 43,
                "socket.io-parser": 46
            }],
        4: [function (_dereq_, module, exports) {
            module.exports = on;

            function on(obj, ev, fn) {
                obj.on(ev, fn);
                return {
                    destroy: function () {
                        obj.removeListener(ev, fn)
                    }
                }
            }
        }
            , {}],
        5: [function (_dereq_, module, exports) {
            var parser = _dereq_("socket.io-parser");
            var Emitter = _dereq_("component-emitter");
            var toArray = _dereq_("to-array");
            var on = _dereq_("./on");
            var bind = _dereq_("component-bind");
            var debug = _dereq_("debug")("socket.io-client:socket");
            var hasBin = _dereq_("has-binary");
            module.exports = exports = Socket;
            var events = {
                connect: 1,
                connect_error: 1,
                connect_timeout: 1,
                disconnect: 1,
                error: 1,
                reconnect: 1,
                reconnect_attempt: 1,
                reconnect_failed: 1,
                reconnect_error: 1,
                reconnecting: 1
            };
            var emit = Emitter.prototype.emit;

            function Socket(io, nsp) {
                this.io = io;
                this.nsp = nsp;
                this.json = this;
                this.ids = 0;
                this.acks = {};
                if (this.io.autoConnect)
                    this.open();
                this.receiveBuffer = [];
                this.sendBuffer = [];
                this.connected = false;
                this.disconnected = true
            }

            Emitter(Socket.prototype);
            Socket.prototype.subEvents = function () {
                if (this.subs)
                    return;
                var io = this.io;
                this.subs = [on(io, "open", bind(this, "onopen")), on(io, "packet", bind(this, "onpacket")), on(io, "close", bind(this, "onclose"))]
            }
            ;
            Socket.prototype.open = Socket.prototype.connect = function () {
                if (this.connected)
                    return this;
                this.subEvents();
                this.io.open();
                if ("open" == this.io.readyState)
                    this.onopen();
                return this
            }
            ;
            Socket.prototype.send = function () {
                var args = toArray(arguments);
                args.unshift("message");
                this.emit.apply(this, args);
                return this
            }
            ;
            Socket.prototype.emit = function (ev) {
                if (events.hasOwnProperty(ev)) {
                    emit.apply(this, arguments);
                    return this
                }
                var args = toArray(arguments);
                var parserType = parser.EVENT;
                if (hasBin(args)) {
                    parserType = parser.BINARY_EVENT
                }
                var packet = {
                    type: parserType,
                    data: args
                };
                if ("function" == typeof args[args.length - 1]) {
                    debug("emitting packet with ack id %d", this.ids);
                    this.acks[this.ids] = args.pop();
                    packet.id = this.ids++
                }
                if (this.connected) {
                    this.packet(packet)
                } else {
                    this.sendBuffer.push(packet)
                }
                return this
            }
            ;
            Socket.prototype.packet = function (packet) {
                packet.nsp = this.nsp;
                this.io.packet(packet)
            }
            ;
            Socket.prototype.onopen = function () {
                debug("transport is open - connecting");
                if ("/" != this.nsp) {
                    this.packet({
                        type: parser.CONNECT
                    })
                }
            }
            ;
            Socket.prototype.onclose = function (reason) {
                debug("close (%s)", reason);
                this.connected = false;
                this.disconnected = true;
                delete this.id;
                this.emit("disconnect", reason)
            }
            ;
            Socket.prototype.onpacket = function (packet) {
                if (packet.nsp != this.nsp)
                    return;
                switch (packet.type) {
                    case parser.CONNECT:
                        this.onconnect();
                        break;
                    case parser.EVENT:
                        this.onevent(packet);
                        break;
                    case parser.BINARY_EVENT:
                        this.onevent(packet);
                        break;
                    case parser.ACK:
                        this.onack(packet);
                        break;
                    case parser.BINARY_ACK:
                        this.onack(packet);
                        break;
                    case parser.DISCONNECT:
                        this.ondisconnect();
                        break;
                    case parser.ERROR:
                        this.emit("error", packet.data);
                        break
                }
            }
            ;
            Socket.prototype.onevent = function (packet) {
                var args = packet.data || [];
                debug("emitting event %j", args);
                if (null != packet.id) {
                    debug("attaching ack callback to event");
                    args.push(this.ack(packet.id))
                }
                if (this.connected) {
                    emit.apply(this, args)
                } else {
                    this.receiveBuffer.push(args)
                }
            }
            ;
            Socket.prototype.ack = function (id) {
                var self = this;
                var sent = false;
                return function () {
                    if (sent)
                        return;
                    sent = true;
                    var args = toArray(arguments);
                    debug("sending ack %j", args);
                    var type = hasBin(args) ? parser.BINARY_ACK : parser.ACK;
                    self.packet({
                        type: type,
                        id: id,
                        data: args
                    })
                }
            }
            ;
            Socket.prototype.onack = function (packet) {
                debug("calling ack %s with %j", packet.id, packet.data);
                var fn = this.acks[packet.id];
                fn.apply(this, packet.data);
                delete this.acks[packet.id]
            }
            ;
            Socket.prototype.onconnect = function () {
                this.connected = true;
                this.disconnected = false;
                this.emit("connect");
                this.emitBuffered()
            }
            ;
            Socket.prototype.emitBuffered = function () {
                var i;
                for (i = 0; i < this.receiveBuffer.length; i++) {
                    emit.apply(this, this.receiveBuffer[i])
                }
                this.receiveBuffer = [];
                for (i = 0; i < this.sendBuffer.length; i++) {
                    this.packet(this.sendBuffer[i])
                }
                this.sendBuffer = []
            }
            ;
            Socket.prototype.ondisconnect = function () {
                debug("server disconnect (%s)", this.nsp);
                this.destroy();
                this.onclose("io server disconnect")
            }
            ;
            Socket.prototype.destroy = function () {
                if (this.subs) {
                    for (var i = 0; i < this.subs.length; i++) {
                        this.subs[i].destroy()
                    }
                    this.subs = null
                }
                this.io.destroy(this)
            }
            ;
            Socket.prototype.close = Socket.prototype.disconnect = function () {
                if (this.connected) {
                    debug("performing disconnect (%s)", this.nsp);
                    this.packet({
                        type: parser.DISCONNECT
                    })
                }
                this.destroy();
                if (this.connected) {
                    this.onclose("io client disconnect")
                }
                return this
            }
        }
            , {
                "./on": 4,
                "component-bind": 8,
                "component-emitter": 9,
                debug: 10,
                "has-binary": 38,
                "socket.io-parser": 46,
                "to-array": 50
            }],
        6: [function (_dereq_, module, exports) {
            (function (global) {
                    var parseuri = _dereq_("parseuri");
                    var debug = _dereq_("debug")("socket.io-client:url");
                    module.exports = url;

                    function url(uri, loc) {
                        var obj = uri;
                        var loc = loc || global.location;
                        if (null == uri)
                            uri = loc.protocol + "//" + loc.host;
                        if ("string" == typeof uri) {
                            if ("/" == uri.charAt(0)) {
                                if ("/" == uri.charAt(1)) {
                                    uri = loc.protocol + uri
                                } else {
                                    uri = loc.hostname + uri
                                }
                            }
                            if (!/^(https?|wss?):\/\//.test(uri)) {
                                debug("protocol-less url %s", uri);
                                if ("undefined" != typeof loc) {
                                    uri = loc.protocol + "//" + uri
                                } else {
                                    uri = "https://" + uri
                                }
                            }
                            debug("parse %s", uri);
                            obj = parseuri(uri)
                        }
                        if (!obj.port) {
                            if (/^(http|ws)$/.test(obj.protocol)) {
                                obj.port = "80"
                            } else if (/^(http|ws)s$/.test(obj.protocol)) {
                                obj.port = "443"
                            }
                        }
                        obj.path = obj.path || "/";
                        obj.id = obj.protocol + "://" + obj.host + ":" + obj.port;
                        obj.href = obj.protocol + "://" + obj.host + (loc && loc.port == obj.port ? "" : ":" + obj.port);
                        return obj
                    }
                }
            ).call(this, typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
        }
            , {
                debug: 10,
                parseuri: 44
            }],
        7: [function (_dereq_, module, exports) {
            module.exports = Backoff;

            function Backoff(opts) {
                opts = opts || {};
                this.ms = opts.min || 100;
                this.max = opts.max || 1e4;
                this.factor = opts.factor || 2;
                this.jitter = opts.jitter > 0 && opts.jitter <= 1 ? opts.jitter : 0;
                this.attempts = 0
            }

            Backoff.prototype.duration = function () {
                var ms = this.ms * Math.pow(this.factor, this.attempts++);
                if (this.jitter) {
                    var rand = Math.random();
                    var deviation = Math.floor(rand * this.jitter * ms);
                    ms = (Math.floor(rand * 10) & 1) == 0 ? ms - deviation : ms + deviation
                }
                return Math.min(ms, this.max) | 0
            }
            ;
            Backoff.prototype.reset = function () {
                this.attempts = 0
            }
            ;
            Backoff.prototype.setMin = function (min) {
                this.ms = min
            }
            ;
            Backoff.prototype.setMax = function (max) {
                this.max = max
            }
            ;
            Backoff.prototype.setJitter = function (jitter) {
                this.jitter = jitter
            }
        }
            , {}],
        8: [function (_dereq_, module, exports) {
            var slice = [].slice;
            module.exports = function (obj, fn) {
                if ("string" == typeof fn)
                    fn = obj[fn];
                if ("function" != typeof fn)
                    throw new Error("bind() requires a function");
                var args = slice.call(arguments, 2);
                return function () {
                    return fn.apply(obj, args.concat(slice.call(arguments)))
                }
            }
        }
            , {}],
        9: [function (_dereq_, module, exports) {
            module.exports = Emitter;

            function Emitter(obj) {
                if (obj)
                    return mixin(obj)
            }

            function mixin(obj) {
                for (var key in Emitter.prototype) {
                    obj[key] = Emitter.prototype[key]
                }
                return obj
            }

            Emitter.prototype.on = Emitter.prototype.addEventListener = function (event, fn) {
                this._callbacks = this._callbacks || {};
                (this._callbacks[event] = this._callbacks[event] || []).push(fn);
                return this
            }
            ;
            Emitter.prototype.once = function (event, fn) {
                var self = this;
                this._callbacks = this._callbacks || {};

                function on() {
                    self.off(event, on);
                    fn.apply(this, arguments)
                }

                on.fn = fn;
                this.on(event, on);
                return this
            }
            ;
            Emitter.prototype.off = Emitter.prototype.removeListener = Emitter.prototype.removeAllListeners = Emitter.prototype.removeEventListener = function (event, fn) {
                this._callbacks = this._callbacks || {};
                if (0 == arguments.length) {
                    this._callbacks = {};
                    return this
                }
                var callbacks = this._callbacks[event];
                if (!callbacks)
                    return this;
                if (1 == arguments.length) {
                    delete this._callbacks[event];
                    return this
                }
                var cb;
                for (var i = 0; i < callbacks.length; i++) {
                    cb = callbacks[i];
                    if (cb === fn || cb.fn === fn) {
                        callbacks.splice(i, 1);
                        break
                    }
                }
                return this
            }
            ;
            Emitter.prototype.emit = function (event) {
                this._callbacks = this._callbacks || {};
                var args = [].slice.call(arguments, 1)
                    , callbacks = this._callbacks[event];
                if (callbacks) {
                    callbacks = callbacks.slice(0);
                    for (var i = 0, len = callbacks.length; i < len; ++i) {
                        callbacks[i].apply(this, args)
                    }
                }
                return this
            }
            ;
            Emitter.prototype.listeners = function (event) {
                this._callbacks = this._callbacks || {};
                return this._callbacks[event] || []
            }
            ;
            Emitter.prototype.hasListeners = function (event) {
                return !!this.listeners(event).length
            }
        }
            , {}],
        10: [function (_dereq_, module, exports) {
            module.exports = debug;

            function debug(name) {
                if (!debug.enabled(name))
                    return function () {
                    }
                        ;
                return function (fmt) {
                    fmt = coerce(fmt);
                    var curr = new Date;
                    var ms = curr - (debug[name] || curr);
                    debug[name] = curr;
                    fmt = name + " " + fmt + " +" + debug.humanize(ms);
                    window.console && console.log && Function.prototype.apply.call(console.log, console, arguments)
                }
            }

            debug.names = [];
            debug.skips = [];
            debug.enable = function (name) {
                try {
                    localStorage.debug = name
                } catch (e) {
                }
                var split = (name || "").split(/[\s,]+/)
                    , len = split.length;
                for (var i = 0; i < len; i++) {
                    name = split[i].replace("*", ".*?");
                    if (name[0] === "-") {
                        debug.skips.push(new RegExp("^" + name.substr(1) + "$"))
                    } else {
                        debug.names.push(new RegExp("^" + name + "$"))
                    }
                }
            }
            ;
            debug.disable = function () {
                debug.enable("")
            }
            ;
            debug.humanize = function (ms) {
                var sec = 1e3
                    , min = 60 * 1e3
                    , hour = 60 * min;
                if (ms >= hour)
                    return (ms / hour).toFixed(1) + "h";
                if (ms >= min)
                    return (ms / min).toFixed(1) + "m";
                if (ms >= sec)
                    return (ms / sec | 0) + "s";
                return ms + "ms"
            }
            ;
            debug.enabled = function (name) {
                for (var i = 0, len = debug.skips.length; i < len; i++) {
                    if (debug.skips[i].test(name)) {
                        return false
                    }
                }
                for (var i = 0, len = debug.names.length; i < len; i++) {
                    if (debug.names[i].test(name)) {
                        return true
                    }
                }
                return false
            }
            ;

            function coerce(val) {
                if (val instanceof Error)
                    return val.stack || val.message;
                return val
            }

            try {
                if (window.localStorage)
                    debug.enable(localStorage.debug)
            } catch (e) {
            }
        }
            , {}],
        11: [function (_dereq_, module, exports) {
            module.exports = _dereq_("./lib/")
        }
            , {
                "./lib/": 12
            }],
        12: [function (_dereq_, module, exports) {
            module.exports = _dereq_("./socket");
            module.exports.parser = _dereq_("engine.io-parser")
        }
            , {
                "./socket": 13,
                "engine.io-parser": 25
            }],
        13: [function (_dereq_, module, exports) {
            (function (global) {
                    var transports = _dereq_("./transports");
                    var Emitter = _dereq_("component-emitter");
                    var debug = _dereq_("debug")("engine.io-client:socket");
                    var index = _dereq_("indexof");
                    var parser = _dereq_("engine.io-parser");
                    var parseuri = _dereq_("parseuri");
                    var parsejson = _dereq_("parsejson");
                    var parseqs = _dereq_("parseqs");
                    module.exports = Socket;

                    function noop() {
                    }

                    function Socket(uri, opts) {
                        if (!(this instanceof Socket))
                            return new Socket(uri, opts);
                        opts = opts || {};
                        if (uri && "object" == typeof uri) {
                            opts = uri;
                            uri = null
                        }
                        if (uri) {
                            uri = parseuri(uri);
                            opts.host = uri.host;
                            opts.secure = uri.protocol == "https" || uri.protocol == "wss";
                            opts.port = uri.port;
                            if (uri.query)
                                opts.query = uri.query
                        }
                        this.secure = null != opts.secure ? opts.secure : global.location && "https:" == location.protocol;
                        if (opts.host) {
                            var pieces = opts.host.split(":");
                            opts.hostname = pieces.shift();
                            if (pieces.length) {
                                opts.port = pieces.pop()
                            } else if (!opts.port) {
                                opts.port = this.secure ? "443" : "80"
                            }
                        }
                        this.agent = opts.agent || false;
                        this.hostname = opts.hostname || (global.location ? location.hostname : "localhost");
                        this.port = opts.port || (global.location && location.port ? location.port : this.secure ? 443 : 80);
                        this.query = opts.query || {};
                        if ("string" == typeof this.query)
                            this.query = parseqs.decode(this.query);
                        this.upgrade = false !== opts.upgrade;
                        this.path = (opts.path || "/engine.io").replace(/\/$/, "") + "/";
                        this.forceJSONP = !!opts.forceJSONP;
                        this.jsonp = false !== opts.jsonp;
                        this.forceBase64 = !!opts.forceBase64;
                        this.enablesXDR = !!opts.enablesXDR;
                        this.timestampParam = opts.timestampParam || "t";
                        this.timestampRequests = opts.timestampRequests;
                        this.transports = opts.transports || ["polling", "websocket"];
                        this.readyState = "";
                        this.writeBuffer = [];
                        this.callbackBuffer = [];
                        this.policyPort = opts.policyPort || 843;
                        this.rememberUpgrade = opts.rememberUpgrade || false;
                        this.binaryType = null;
                        this.onlyBinaryUpgrades = opts.onlyBinaryUpgrades;
                        this.pfx = opts.pfx || null;
                        this.key = opts.key || null;
                        this.passphrase = opts.passphrase || null;
                        this.cert = opts.cert || null;
                        this.ca = opts.ca || null;
                        this.ciphers = opts.ciphers || null;
                        this.rejectUnauthorized = opts.rejectUnauthorized || null;
                        this.open()
                    }

                    Socket.priorWebsocketSuccess = false;
                    Emitter(Socket.prototype);
                    Socket.protocol = parser.protocol;
                    Socket.Socket = Socket;
                    Socket.Transport = _dereq_("./transport");
                    Socket.transports = _dereq_("./transports");
                    Socket.parser = _dereq_("engine.io-parser");
                    Socket.prototype.createTransport = function (name) {
                        debug('creating transport "%s"', name);
                        var query = clone(this.query);
                        query.EIO = parser.protocol;
                        query.transport = name;
                        if (this.id)
                            query.sid = this.id;
                        var transport = new transports[name]({
                            agent: this.agent,
                            hostname: this.hostname,
                            port: this.port,
                            secure: this.secure,
                            path: this.path,
                            query: query,
                            forceJSONP: this.forceJSONP,
                            jsonp: this.jsonp,
                            forceBase64: this.forceBase64,
                            enablesXDR: this.enablesXDR,
                            timestampRequests: this.timestampRequests,
                            timestampParam: this.timestampParam,
                            policyPort: this.policyPort,
                            socket: this,
                            pfx: this.pfx,
                            key: this.key,
                            passphrase: this.passphrase,
                            cert: this.cert,
                            ca: this.ca,
                            ciphers: this.ciphers,
                            rejectUnauthorized: this.rejectUnauthorized
                        });
                        return transport
                    }
                    ;

                    function clone(obj) {
                        var o = {};
                        for (var i in obj) {
                            if (obj.hasOwnProperty(i)) {
                                o[i] = obj[i]
                            }
                        }
                        return o
                    }

                    Socket.prototype.open = function () {
                        var transport;
                        if (this.rememberUpgrade && Socket.priorWebsocketSuccess && this.transports.indexOf("websocket") != -1) {
                            transport = "websocket"
                        } else if (0 == this.transports.length) {
                            var self = this;
                            setTimeout(function () {
                                self.emit("error", "No transports available")
                            }, 0);
                            return
                        } else {
                            transport = this.transports[0]
                        }
                        this.readyState = "opening";
                        var transport;
                        try {
                            transport = this.createTransport(transport)
                        } catch (e) {
                            this.transports.shift();
                            this.open();
                            return
                        }
                        transport.open();
                        this.setTransport(transport)
                    }
                    ;
                    Socket.prototype.setTransport = function (transport) {
                        debug("setting transport %s", transport.name);
                        var self = this;
                        if (this.transport) {
                            debug("clearing existing transport %s", this.transport.name);
                            this.transport.removeAllListeners()
                        }
                        this.transport = transport;
                        transport.on("drain", function () {
                            self.onDrain()
                        }).on("packet", function (packet) {
                            self.onPacket(packet)
                        }).on("error", function (e) {
                            self.onError(e)
                        }).on("close", function () {
                            self.onClose("transport close")
                        })
                    }
                    ;
                    Socket.prototype.probe = function (name) {
                        debug('probing transport "%s"', name);
                        var transport = this.createTransport(name, {
                            probe: 1
                        })
                            , failed = false
                            , self = this;
                        Socket.priorWebsocketSuccess = false;

                        function onTransportOpen() {
                            if (self.onlyBinaryUpgrades) {
                                var upgradeLosesBinary = !this.supportsBinary && self.transport.supportsBinary;
                                failed = failed || upgradeLosesBinary
                            }
                            if (failed)
                                return;
                            debug('probe transport "%s" opened', name);
                            transport.send([{
                                type: "ping",
                                data: "probe"
                            }]);
                            transport.once("packet", function (msg) {
                                if (failed)
                                    return;
                                if ("pong" == msg.type && "probe" == msg.data) {
                                    debug('probe transport "%s" pong', name);
                                    self.upgrading = true;
                                    self.emit("upgrading", transport);
                                    if (!transport)
                                        return;
                                    Socket.priorWebsocketSuccess = "websocket" == transport.name;
                                    debug('pausing current transport "%s"', self.transport.name);
                                    self.transport.pause(function () {
                                        if (failed)
                                            return;
                                        if ("closed" == self.readyState)
                                            return;
                                        debug("changing transport and sending upgrade packet");
                                        cleanup();
                                        self.setTransport(transport);
                                        transport.send([{
                                            type: "upgrade"
                                        }]);
                                        self.emit("upgrade", transport);
                                        transport = null;
                                        self.upgrading = false;
                                        self.flush()
                                    })
                                } else {
                                    debug('probe transport "%s" failed', name);
                                    var err = new Error("probe error");
                                    err.transport = transport.name;
                                    self.emit("upgradeError", err)
                                }
                            })
                        }

                        function freezeTransport() {
                            if (failed)
                                return;
                            failed = true;
                            cleanup();
                            transport.close();
                            transport = null
                        }

                        function onerror(err) {
                            var error = new Error("probe error: " + err);
                            error.transport = transport.name;
                            freezeTransport();
                            debug('probe transport "%s" failed because of error: %s', name, err);
                            self.emit("upgradeError", error)
                        }

                        function onTransportClose() {
                            onerror("transport closed")
                        }

                        function onclose() {
                            onerror("socket closed")
                        }

                        function onupgrade(to) {
                            if (transport && to.name != transport.name) {
                                debug('"%s" works - aborting "%s"', to.name, transport.name);
                                freezeTransport()
                            }
                        }

                        function cleanup() {
                            transport.removeListener("open", onTransportOpen);
                            transport.removeListener("error", onerror);
                            transport.removeListener("close", onTransportClose);
                            self.removeListener("close", onclose);
                            self.removeListener("upgrading", onupgrade)
                        }

                        transport.once("open", onTransportOpen);
                        transport.once("error", onerror);
                        transport.once("close", onTransportClose);
                        this.once("close", onclose);
                        this.once("upgrading", onupgrade);
                        transport.open()
                    }
                    ;
                    Socket.prototype.onOpen = function () {
                        debug("socket open");
                        this.readyState = "open";
                        Socket.priorWebsocketSuccess = "websocket" == this.transport.name;
                        this.emit("open");
                        this.flush();
                        if ("open" == this.readyState && this.upgrade && this.transport.pause) {
                            debug("starting upgrade probes");
                            for (var i = 0, l = this.upgrades.length; i < l; i++) {
                                this.probe(this.upgrades[i])
                            }
                        }
                    }
                    ;
                    Socket.prototype.onPacket = function (packet) {
                        if ("opening" == this.readyState || "open" == this.readyState) {
                            debug('socket receive: type "%s", data "%s"', packet.type, packet.data);
                            this.emit("packet", packet);
                            this.emit("heartbeat");
                            switch (packet.type) {
                                case "open":
                                    this.onHandshake(parsejson(packet.data));
                                    break;
                                case "pong":
                                    this.setPing();
                                    break;
                                case "error":
                                    var err = new Error("server error");
                                    err.code = packet.data;
                                    this.emit("error", err);
                                    break;
                                case "message":
                                    this.emit("data", packet.data);
                                    this.emit("message", packet.data);
                                    break
                            }
                        } else {
                            debug('packet received with socket readyState "%s"', this.readyState)
                        }
                    }
                    ;
                    Socket.prototype.onHandshake = function (data) {
                        this.emit("handshake", data);
                        this.id = data.sid;
                        this.transport.query.sid = data.sid;
                        this.upgrades = this.filterUpgrades(data.upgrades);
                        this.pingInterval = data.pingInterval;
                        this.pingTimeout = data.pingTimeout;
                        this.onOpen();
                        if ("closed" == this.readyState)
                            return;
                        this.setPing();
                        this.removeListener("heartbeat", this.onHeartbeat);
                        this.on("heartbeat", this.onHeartbeat)
                    }
                    ;
                    Socket.prototype.onHeartbeat = function (timeout) {
                        clearTimeout(this.pingTimeoutTimer);
                        var self = this;
                        self.pingTimeoutTimer = setTimeout(function () {
                            if ("closed" == self.readyState)
                                return;
                            self.onClose("ping timeout")
                        }, timeout || self.pingInterval + self.pingTimeout)
                    }
                    ;
                    Socket.prototype.setPing = function () {
                        var self = this;
                        clearTimeout(self.pingIntervalTimer);
                        self.pingIntervalTimer = setTimeout(function () {
                            debug("writing ping packet - expecting pong within %sms", self.pingTimeout);
                            self.ping();
                            self.onHeartbeat(self.pingTimeout)
                        }, self.pingInterval)
                    }
                    ;
                    Socket.prototype.ping = function () {
                        this.sendPacket("ping")
                    }
                    ;
                    Socket.prototype.onDrain = function () {
                        for (var i = 0; i < this.prevBufferLen; i++) {
                            if (this.callbackBuffer[i]) {
                                this.callbackBuffer[i]()
                            }
                        }
                        this.writeBuffer.splice(0, this.prevBufferLen);
                        this.callbackBuffer.splice(0, this.prevBufferLen);
                        this.prevBufferLen = 0;
                        if (this.writeBuffer.length == 0) {
                            this.emit("drain")
                        } else {
                            this.flush()
                        }
                    }
                    ;
                    Socket.prototype.flush = function () {
                        if ("closed" != this.readyState && this.transport.writable && !this.upgrading && this.writeBuffer.length) {
                            debug("flushing %d packets in socket", this.writeBuffer.length);
                            this.transport.send(this.writeBuffer);
                            this.prevBufferLen = this.writeBuffer.length;
                            this.emit("flush")
                        }
                    }
                    ;
                    Socket.prototype.write = Socket.prototype.send = function (msg, fn) {
                        this.sendPacket("message", msg, fn);
                        return this
                    }
                    ;
                    Socket.prototype.sendPacket = function (type, data, fn) {
                        if ("closing" == this.readyState || "closed" == this.readyState) {
                            return
                        }
                        var packet = {
                            type: type,
                            data: data
                        };
                        this.emit("packetCreate", packet);
                        this.writeBuffer.push(packet);
                        this.callbackBuffer.push(fn);
                        this.flush()
                    }
                    ;
                    Socket.prototype.close = function () {
                        if ("opening" == this.readyState || "open" == this.readyState) {
                            this.readyState = "closing";
                            var self = this;

                            function close() {
                                self.onClose("forced close");
                                debug("socket closing - telling transport to close");
                                self.transport.close()
                            }

                            function cleanupAndClose() {
                                self.removeListener("upgrade", cleanupAndClose);
                                self.removeListener("upgradeError", cleanupAndClose);
                                close()
                            }

                            function waitForUpgrade() {
                                self.once("upgrade", cleanupAndClose);
                                self.once("upgradeError", cleanupAndClose)
                            }

                            if (this.writeBuffer.length) {
                                this.once("drain", function () {
                                    if (this.upgrading) {
                                        waitForUpgrade()
                                    } else {
                                        close()
                                    }
                                })
                            } else if (this.upgrading) {
                                waitForUpgrade()
                            } else {
                                close()
                            }
                        }
                        return this
                    }
                    ;
                    Socket.prototype.onError = function (err) {
                        debug("socket error %j", err);
                        Socket.priorWebsocketSuccess = false;
                        this.emit("error", err);
                        this.onClose("transport error", err)
                    }
                    ;
                    Socket.prototype.onClose = function (reason, desc) {
                        if ("opening" == this.readyState || "open" == this.readyState || "closing" == this.readyState) {
                            debug('socket close with reason: "%s"', reason);
                            var self = this;
                            clearTimeout(this.pingIntervalTimer);
                            clearTimeout(this.pingTimeoutTimer);
                            setTimeout(function () {
                                self.writeBuffer = [];
                                self.callbackBuffer = [];
                                self.prevBufferLen = 0
                            }, 0);
                            this.transport.removeAllListeners("close");
                            this.transport.close();
                            this.transport.removeAllListeners();
                            this.readyState = "closed";
                            this.id = null;
                            this.emit("close", reason, desc)
                        }
                    }
                    ;
                    Socket.prototype.filterUpgrades = function (upgrades) {
                        var filteredUpgrades = [];
                        for (var i = 0, j = upgrades.length; i < j; i++) {
                            if (~index(this.transports, upgrades[i]))
                                filteredUpgrades.push(upgrades[i])
                        }
                        return filteredUpgrades
                    }
                }
            ).call(this, typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
        }
            , {
                "./transport": 14,
                "./transports": 15,
                "component-emitter": 9,
                debug: 22,
                "engine.io-parser": 25,
                indexof: 42,
                parsejson: 34,
                parseqs: 35,
                parseuri: 36
            }],
        14: [function (_dereq_, module, exports) {
            var parser = _dereq_("engine.io-parser");
            var Emitter = _dereq_("component-emitter");
            module.exports = Transport;

            function Transport(opts) {
                this.path = opts.path;
                this.hostname = opts.hostname;
                this.port = opts.port;
                this.secure = opts.secure;
                this.query = opts.query;
                this.timestampParam = opts.timestampParam;
                this.timestampRequests = opts.timestampRequests;
                this.readyState = "";
                this.agent = opts.agent || false;
                this.socket = opts.socket;
                this.enablesXDR = opts.enablesXDR;
                this.pfx = opts.pfx;
                this.key = opts.key;
                this.passphrase = opts.passphrase;
                this.cert = opts.cert;
                this.ca = opts.ca;
                this.ciphers = opts.ciphers;
                this.rejectUnauthorized = opts.rejectUnauthorized
            }

            Emitter(Transport.prototype);
            Transport.timestamps = 0;
            Transport.prototype.onError = function (msg, desc) {
                var err = new Error(msg);
                err.type = "TransportError";
                err.description = desc;
                this.emit("error", err);
                return this
            }
            ;
            Transport.prototype.open = function () {
                if ("closed" == this.readyState || "" == this.readyState) {
                    this.readyState = "opening";
                    this.doOpen()
                }
                return this
            }
            ;
            Transport.prototype.close = function () {
                if ("opening" == this.readyState || "open" == this.readyState) {
                    this.doClose();
                    this.onClose()
                }
                return this
            }
            ;
            Transport.prototype.send = function (packets) {
                if ("open" == this.readyState) {
                    this.write(packets)
                } else {
                    throw new Error("Transport not open")
                }
            }
            ;
            Transport.prototype.onOpen = function () {
                this.readyState = "open";
                this.writable = true;
                this.emit("open")
            }
            ;
            Transport.prototype.onData = function (data) {
                var packet = parser.decodePacket(data, this.socket.binaryType);
                this.onPacket(packet)
            }
            ;
            Transport.prototype.onPacket = function (packet) {
                this.emit("packet", packet)
            }
            ;
            Transport.prototype.onClose = function () {
                this.readyState = "closed";
                this.emit("close")
            }
        }
            , {
                "component-emitter": 9,
                "engine.io-parser": 25
            }],
        15: [function (_dereq_, module, exports) {
            (function (global) {
                    var XMLHttpRequest = _dereq_("xmlhttprequest");
                    var XHR = _dereq_("./polling-xhr");
                    var JSONP = _dereq_("./polling-jsonp");
                    var websocket = _dereq_("./websocket");
                    exports.polling = polling;
                    exports.websocket = websocket;

                    function polling(opts) {
                        var xhr;
                        var xd = false;
                        var xs = false;
                        var jsonp = false !== opts.jsonp;
                        if (global.location) {
                            var isSSL = "https:" == location.protocol;
                            var port = location.port;
                            if (!port) {
                                port = isSSL ? 443 : 80
                            }
                            xd = opts.hostname != location.hostname || port != opts.port;
                            xs = opts.secure != isSSL
                        }
                        opts.xdomain = xd;
                        opts.xscheme = xs;
                        xhr = new XMLHttpRequest(opts);
                        if ("open" in xhr && !opts.forceJSONP) {
                            return new XHR(opts)
                        } else {
                            if (!jsonp)
                                throw new Error("JSONP disabled");
                            return new JSONP(opts)
                        }
                    }
                }
            ).call(this, typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
        }
            , {
                "./polling-jsonp": 16,
                "./polling-xhr": 17,
                "./websocket": 19,
                xmlhttprequest: 20
            }],
        16: [function (_dereq_, module, exports) {
            (function (global) {
                    var Polling = _dereq_("./polling");
                    var inherit = _dereq_("component-inherit");
                    module.exports = JSONPPolling;
                    var rNewline = /\n/g;
                    var rEscapedNewline = /\\n/g;
                    var callbacks;
                    var index = 0;

                    function empty() {
                    }

                    function JSONPPolling(opts) {
                        Polling.call(this, opts);
                        this.query = this.query || {};
                        if (!callbacks) {
                            if (!global.___eio)
                                global.___eio = [];
                            callbacks = global.___eio
                        }
                        this.index = callbacks.length;
                        var self = this;
                        callbacks.push(function (msg) {
                            self.onData(msg)
                        });
                        this.query.j = this.index;
                        if (global.document && global.addEventListener) {
                            global.addEventListener("beforeunload", function () {
                                if (self.script)
                                    self.script.onerror = empty
                            }, false)
                        }
                    }

                    inherit(JSONPPolling, Polling);
                    JSONPPolling.prototype.supportsBinary = false;
                    JSONPPolling.prototype.doClose = function () {
                        if (this.script) {
                            this.script.parentNode.removeChild(this.script);
                            this.script = null
                        }
                        if (this.form) {
                            this.form.parentNode.removeChild(this.form);
                            this.form = null;
                            this.iframe = null
                        }
                        Polling.prototype.doClose.call(this)
                    }
                    ;
                    JSONPPolling.prototype.doPoll = function () {
                        var self = this;
                        var script = document.createElement("script");
                        if (this.script) {
                            this.script.parentNode.removeChild(this.script);
                            this.script = null
                        }
                        script.async = true;
                        script.src = this.uri();
                        script.onerror = function (e) {
                            self.onError("jsonp poll error", e)
                        }
                        ;
                        var insertAt = document.getElementsByTagName("script")[0];
                        insertAt.parentNode.insertBefore(script, insertAt);
                        this.script = script;
                        var isUAgecko = "undefined" != typeof navigator && /gecko/i.test(navigator.userAgent);
                        if (isUAgecko) {
                            setTimeout(function () {
                                var iframe = document.createElement("iframe");
                                document.body.appendChild(iframe);
                                document.body.removeChild(iframe)
                            }, 100)
                        }
                    }
                    ;
                    JSONPPolling.prototype.doWrite = function (data, fn) {
                        var self = this;
                        if (!this.form) {
                            var form = document.createElement("form");
                            var area = document.createElement("textarea");
                            var id = this.iframeId = "eio_iframe_" + this.index;
                            var iframe;
                            form.className = "socketio";
                            form.style.position = "absolute";
                            form.style.top = "-1000px";
                            form.style.left = "-1000px";
                            form.target = id;
                            form.method = "POST";
                            form.setAttribute("accept-charset", "utf-8");
                            area.name = "d";
                            form.appendChild(area);
                            document.body.appendChild(form);
                            this.form = form;
                            this.area = area
                        }
                        this.form.action = this.uri();

                        function complete() {
                            initIframe();
                            fn()
                        }

                        function initIframe() {
                            if (self.iframe) {
                                try {
                                    self.form.removeChild(self.iframe)
                                } catch (e) {
                                    self.onError("jsonp polling iframe removal error", e)
                                }
                            }
                            try {
                                var html = '<iframe src="javascript:0" name="' + self.iframeId + '">';
                                iframe = document.createElement(html)
                            } catch (e) {
                                iframe = document.createElement("iframe");
                                iframe.name = self.iframeId;
                                iframe.src = "javascript:0"
                            }
                            iframe.id = self.iframeId;
                            self.form.appendChild(iframe);
                            self.iframe = iframe
                        }

                        initIframe();
                        data = data.replace(rEscapedNewline, "\\\n");
                        this.area.value = data.replace(rNewline, "\\n");
                        try {
                            this.form.submit()
                        } catch (e) {
                        }
                        if (this.iframe.attachEvent) {
                            this.iframe.onreadystatechange = function () {
                                if (self.iframe.readyState == "complete") {
                                    complete()
                                }
                            }
                        } else {
                            this.iframe.onload = complete
                        }
                    }
                }
            ).call(this, typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
        }
            , {
                "./polling": 18,
                "component-inherit": 21
            }],
        17: [function (_dereq_, module, exports) {
            (function (global) {
                    var XMLHttpRequest = _dereq_("xmlhttprequest");
                    var Polling = _dereq_("./polling");
                    var Emitter = _dereq_("component-emitter");
                    var inherit = _dereq_("component-inherit");
                    var debug = _dereq_("debug")("engine.io-client:polling-xhr");
                    module.exports = XHR;
                    module.exports.Request = Request;

                    function empty() {
                    }

                    function XHR(opts) {
                        Polling.call(this, opts);
                        if (global.location) {
                            var isSSL = "https:" == location.protocol;
                            var port = location.port;
                            if (!port) {
                                port = isSSL ? 443 : 80
                            }
                            this.xd = opts.hostname != global.location.hostname || port != opts.port;
                            this.xs = opts.secure != isSSL
                        }
                    }

                    inherit(XHR, Polling);
                    XHR.prototype.supportsBinary = true;
                    XHR.prototype.request = function (opts) {
                        opts = opts || {};
                        opts.uri = this.uri();
                        opts.xd = this.xd;
                        opts.xs = this.xs;
                        opts.agent = this.agent || false;
                        opts.supportsBinary = this.supportsBinary;
                        opts.enablesXDR = this.enablesXDR;
                        opts.pfx = this.pfx;
                        opts.key = this.key;
                        opts.passphrase = this.passphrase;
                        opts.cert = this.cert;
                        opts.ca = this.ca;
                        opts.ciphers = this.ciphers;
                        opts.rejectUnauthorized = this.rejectUnauthorized;
                        return new Request(opts)
                    }
                    ;
                    XHR.prototype.doWrite = function (data, fn) {
                        var isBinary = typeof data !== "string" && data !== undefined;
                        var req = this.request({
                            method: "POST",
                            data: data,
                            isBinary: isBinary
                        });
                        var self = this;
                        req.on("success", fn);
                        req.on("error", function (err) {
                            self.onError("xhr post error", err)
                        });
                        this.sendXhr = req
                    }
                    ;
                    XHR.prototype.doPoll = function () {
                        debug("xhr poll");
                        var req = this.request();
                        var self = this;
                        req.on("data", function (data) {
                            self.onData(data)
                        });
                        req.on("error", function (err) {
                            self.onError("xhr poll error", err)
                        });
                        this.pollXhr = req
                    }
                    ;

                    function Request(opts) {
                        this.method = opts.method || "GET";
                        this.uri = opts.uri;
                        this.xd = !!opts.xd;
                        this.xs = !!opts.xs;
                        this.async = false !== opts.async;
                        this.data = undefined != opts.data ? opts.data : null;
                        this.agent = opts.agent;
                        this.isBinary = opts.isBinary;
                        this.supportsBinary = opts.supportsBinary;
                        this.enablesXDR = opts.enablesXDR;
                        this.pfx = opts.pfx;
                        this.key = opts.key;
                        this.passphrase = opts.passphrase;
                        this.cert = opts.cert;
                        this.ca = opts.ca;
                        this.ciphers = opts.ciphers;
                        this.rejectUnauthorized = opts.rejectUnauthorized;
                        this.create()
                    }

                    Emitter(Request.prototype);
                    Request.prototype.create = function () {
                        var opts = {
                            agent: this.agent,
                            xdomain: this.xd,
                            xscheme: this.xs,
                            enablesXDR: this.enablesXDR
                        };
                        opts.pfx = this.pfx;
                        opts.key = this.key;
                        opts.passphrase = this.passphrase;
                        opts.cert = this.cert;
                        opts.ca = this.ca;
                        opts.ciphers = this.ciphers;
                        opts.rejectUnauthorized = this.rejectUnauthorized;
                        var xhr = this.xhr = new XMLHttpRequest(opts);
                        var self = this;
                        try {
                            debug("xhr open %s: %s", this.method, this.uri);
                            xhr.open(this.method, this.uri, this.async);
                            if (this.supportsBinary) {
                                xhr.responseType = "arraybuffer"
                            }
                            if ("POST" == this.method) {
                                try {
                                    if (this.isBinary) {
                                        xhr.setRequestHeader("Content-type", "application/octet-stream")
                                    } else {
                                        xhr.setRequestHeader("Content-type", "text/plain;charset=UTF-8")
                                    }
                                } catch (e) {
                                }
                            }
                            if ("withCredentials" in xhr) {
                                xhr.withCredentials = true
                            }
                            if (this.hasXDR()) {
                                xhr.onload = function () {
                                    self.onLoad()
                                }
                                ;
                                xhr.onerror = function () {
                                    self.onError(xhr.responseText)
                                }
                            } else {
                                xhr.onreadystatechange = function () {
                                    if (4 != xhr.readyState)
                                        return;
                                    if (200 == xhr.status || 1223 == xhr.status) {
                                        self.onLoad()
                                    } else {
                                        setTimeout(function () {
                                            self.onError(xhr.status)
                                        }, 0)
                                    }
                                }
                            }
                            debug("xhr data %s", this.data);
                            xhr.send(this.data)
                        } catch (e) {
                            setTimeout(function () {
                                self.onError(e)
                            }, 0);
                            return
                        }
                        if (global.document) {
                            this.index = Request.requestsCount++;
                            Request.requests[this.index] = this
                        }
                    }
                    ;
                    Request.prototype.onSuccess = function () {
                        this.emit("success");
                        this.cleanup()
                    }
                    ;
                    Request.prototype.onData = function (data) {
                        this.emit("data", data);
                        this.onSuccess()
                    }
                    ;
                    Request.prototype.onError = function (err) {
                        this.emit("error", err);
                        this.cleanup(true)
                    }
                    ;
                    Request.prototype.cleanup = function (fromError) {
                        if ("undefined" == typeof this.xhr || null === this.xhr) {
                            return
                        }
                        if (this.hasXDR()) {
                            this.xhr.onload = this.xhr.onerror = empty
                        } else {
                            this.xhr.onreadystatechange = empty
                        }
                        if (fromError) {
                            try {
                                this.xhr.abort()
                            } catch (e) {
                            }
                        }
                        if (global.document) {
                            delete Request.requests[this.index]
                        }
                        this.xhr = null
                    }
                    ;
                    Request.prototype.onLoad = function () {
                        var data;
                        try {
                            var contentType;
                            try {
                                contentType = this.xhr.getResponseHeader("Content-Type").split(";")[0]
                            } catch (e) {
                            }
                            if (contentType === "application/octet-stream") {
                                data = this.xhr.response
                            } else {
                                if (!this.supportsBinary) {
                                    data = this.xhr.responseText
                                } else {
                                    data = "ok"
                                }
                            }
                        } catch (e) {
                            this.onError(e)
                        }
                        if (null != data) {
                            this.onData(data)
                        }
                    }
                    ;
                    Request.prototype.hasXDR = function () {
                        return "undefined" !== typeof global.XDomainRequest && !this.xs && this.enablesXDR
                    }
                    ;
                    Request.prototype.abort = function () {
                        this.cleanup()
                    }
                    ;
                    if (global.document) {
                        Request.requestsCount = 0;
                        Request.requests = {};
                        if (global.attachEvent) {
                            global.attachEvent("onunload", unloadHandler)
                        } else if (global.addEventListener) {
                            global.addEventListener("beforeunload", unloadHandler, false)
                        }
                    }

                    function unloadHandler() {
                        for (var i in Request.requests) {
                            if (Request.requests.hasOwnProperty(i)) {
                                Request.requests[i].abort()
                            }
                        }
                    }
                }
            ).call(this, typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
        }
            , {
                "./polling": 18,
                "component-emitter": 9,
                "component-inherit": 21,
                debug: 22,
                xmlhttprequest: 20
            }],
        18: [function (_dereq_, module, exports) {
            var Transport = _dereq_("../transport");
            var parseqs = _dereq_("parseqs");
            var parser = _dereq_("engine.io-parser");
            var inherit = _dereq_("component-inherit");
            var debug = _dereq_("debug")("engine.io-client:polling");
            module.exports = Polling;
            var hasXHR2 = function () {
                var XMLHttpRequest = _dereq_("xmlhttprequest");
                var xhr = new XMLHttpRequest({
                    xdomain: false
                });
                return null != xhr.responseType
            }();

            function Polling(opts) {
                var forceBase64 = opts && opts.forceBase64;
                if (!hasXHR2 || forceBase64) {
                    this.supportsBinary = false
                }
                Transport.call(this, opts)
            }

            inherit(Polling, Transport);
            Polling.prototype.name = "polling";
            Polling.prototype.doOpen = function () {
                this.poll()
            }
            ;
            Polling.prototype.pause = function (onPause) {
                var pending = 0;
                var self = this;
                this.readyState = "pausing";

                function pause() {
                    debug("paused");
                    self.readyState = "paused";
                    onPause()
                }

                if (this.polling || !this.writable) {
                    var total = 0;
                    if (this.polling) {
                        debug("we are currently polling - waiting to pause");
                        total++;
                        this.once("pollComplete", function () {
                            debug("pre-pause polling complete");
                            --total || pause()
                        })
                    }
                    if (!this.writable) {
                        debug("we are currently writing - waiting to pause");
                        total++;
                        this.once("drain", function () {
                            debug("pre-pause writing complete");
                            --total || pause()
                        })
                    }
                } else {
                    pause()
                }
            }
            ;
            Polling.prototype.poll = function () {
                debug("polling");
                this.polling = true;
                this.doPoll();
                this.emit("poll")
            }
            ;
            Polling.prototype.onData = function (data) {
                var self = this;
                debug("polling got data %s", data);
                var callback = function (packet, index, total) {
                    if ("opening" == self.readyState) {
                        self.onOpen()
                    }
                    if ("close" == packet.type) {
                        self.onClose();
                        return false
                    }
                    self.onPacket(packet)
                };
                parser.decodePayload(data, this.socket.binaryType, callback);
                if ("closed" != this.readyState) {
                    this.polling = false;
                    this.emit("pollComplete");
                    if ("open" == this.readyState) {
                        this.poll()
                    } else {
                        debug('ignoring poll - transport state "%s"', this.readyState)
                    }
                }
            }
            ;
            Polling.prototype.doClose = function () {
                var self = this;

                function close() {
                    debug("writing close packet");
                    self.write([{
                        type: "close"
                    }])
                }

                if ("open" == this.readyState) {
                    debug("transport open - closing");
                    close()
                } else {
                    debug("transport not open - deferring close");
                    this.once("open", close)
                }
            }
            ;
            Polling.prototype.write = function (packets) {
                var self = this;
                this.writable = false;
                var callbackfn = function () {
                    self.writable = true;
                    self.emit("drain")
                };
                var self = this;
                parser.encodePayload(packets, this.supportsBinary, function (data) {
                    self.doWrite(data, callbackfn)
                })
            }
            ;
            Polling.prototype.uri = function () {
                var query = this.query || {};
                var schema = this.secure ? "https" : "http";
                var port = "";
                if (false !== this.timestampRequests) {
                    query[this.timestampParam] = +new Date + "-" + Transport.timestamps++
                }
                if (!this.supportsBinary && !query.sid) {
                    query.b64 = 1
                }
                query = parseqs.encode(query);
                if (this.port && ("https" == schema && this.port != 443 || "http" == schema && this.port != 80)) {
                    port = ":" + this.port
                }
                if (query.length) {
                    query = "?" + query
                }
                return schema + "://" + this.hostname + port + this.path + query
            }
        }
            , {
                "../transport": 14,
                "component-inherit": 21,
                debug: 22,
                "engine.io-parser": 25,
                parseqs: 35,
                xmlhttprequest: 20
            }],
        19: [function (_dereq_, module, exports) {
            var Transport = _dereq_("../transport");
            var parser = _dereq_("engine.io-parser");
            var parseqs = _dereq_("parseqs");
            var inherit = _dereq_("component-inherit");
            var debug = _dereq_("debug")("engine.io-client:websocket");
            var WebSocket = _dereq_("ws");
            module.exports = WS;

            function WS(opts) {
                var forceBase64 = opts && opts.forceBase64;
                if (forceBase64) {
                    this.supportsBinary = false
                }
                Transport.call(this, opts)
            }

            inherit(WS, Transport);
            WS.prototype.name = "websocket";
            WS.prototype.supportsBinary = true;
            WS.prototype.doOpen = function () {
                if (!this.check()) {
                    return
                }
                var self = this;
                var uri = this.uri();
                var protocols = void 0;
                var opts = {
                    agent: this.agent
                };
                opts.pfx = this.pfx;
                opts.key = this.key;
                opts.passphrase = this.passphrase;
                opts.cert = this.cert;
                opts.ca = this.ca;
                opts.ciphers = this.ciphers;
                opts.rejectUnauthorized = this.rejectUnauthorized;
                this.ws = new WebSocket(uri, protocols, opts);
                if (this.ws.binaryType === undefined) {
                    this.supportsBinary = false
                }
                this.ws.binaryType = "arraybuffer";
                this.addEventListeners()
            }
            ;
            WS.prototype.addEventListeners = function () {
                var self = this;
                this.ws.onopen = function () {
                    self.onOpen()
                }
                ;
                this.ws.onclose = function () {
                    self.onClose()
                }
                ;
                this.ws.onmessage = function (ev) {
                    self.onData(ev.data)
                }
                ;
                this.ws.onerror = function (e) {
                    self.onError("websocket error", e)
                }
            }
            ;
            if ("undefined" != typeof navigator && /iPad|iPhone|iPod/i.test(navigator.userAgent)) {
                WS.prototype.onData = function (data) {
                    var self = this;
                    setTimeout(function () {
                        Transport.prototype.onData.call(self, data)
                    }, 0)
                }
            }
            WS.prototype.write = function (packets) {
                var self = this;
                this.writable = false;
                for (var i = 0, l = packets.length; i < l; i++) {
                    parser.encodePacket(packets[i], this.supportsBinary, function (data) {
                        try {
                            self.ws.send(data)
                        } catch (e) {
                            debug("websocket closed before onclose event")
                        }
                    })
                }

                function ondrain() {
                    self.writable = true;
                    self.emit("drain")
                }

                setTimeout(ondrain, 0)
            }
            ;
            WS.prototype.onClose = function () {
                Transport.prototype.onClose.call(this)
            }
            ;
            WS.prototype.doClose = function () {
                if (typeof this.ws !== "undefined") {
                    this.ws.close()
                }
            }
            ;
            WS.prototype.uri = function () {
                var query = this.query || {};
                var schema = this.secure ? "wss" : "ws";
                var port = "";
                if (this.port && ("wss" == schema && this.port != 443 || "ws" == schema && this.port != 80)) {
                    port = ":" + this.port
                }
                if (this.timestampRequests) {
                    query[this.timestampParam] = +new Date
                }
                if (!this.supportsBinary) {
                    query.b64 = 1
                }
                query = parseqs.encode(query);
                if (query.length) {
                    query = "?" + query
                }
                return schema + "://" + this.hostname + port + this.path + query
            }
            ;
            WS.prototype.check = function () {
                return !!WebSocket && !("__initialize" in WebSocket && this.name === WS.prototype.name)
            }
        }
            , {
                "../transport": 14,
                "component-inherit": 21,
                debug: 22,
                "engine.io-parser": 25,
                parseqs: 35,
                ws: 37
            }],
        20: [function (_dereq_, module, exports) {
            var hasCORS = _dereq_("has-cors");
            module.exports = function (opts) {
                var xdomain = opts.xdomain;
                var xscheme = opts.xscheme;
                var enablesXDR = opts.enablesXDR;
                try {
                    if ("undefined" != typeof XMLHttpRequest && (!xdomain || hasCORS)) {
                        return new XMLHttpRequest
                    }
                } catch (e) {
                }
                try {
                    if ("undefined" != typeof XDomainRequest && !xscheme && enablesXDR) {
                        return new XDomainRequest
                    }
                } catch (e) {
                }
                if (!xdomain) {
                    try {
                        return new ActiveXObject("Microsoft.XMLHTTP")
                    } catch (e) {
                    }
                }
            }
        }
            , {
                "has-cors": 40
            }],
        21: [function (_dereq_, module, exports) {
            module.exports = function (a, b) {
                var fn = function () {
                };
                fn.prototype = b.prototype;
                a.prototype = new fn;
                a.prototype.constructor = a
            }
        }
            , {}],
        22: [function (_dereq_, module, exports) {
            exports = module.exports = _dereq_("./debug");
            exports.log = log;
            exports.formatArgs = formatArgs;
            exports.save = save;
            exports.load = load;
            exports.useColors = useColors;
            exports.colors = ["lightseagreen", "forestgreen", "goldenrod", "dodgerblue", "darkorchid", "crimson"];

            function useColors() {
                return "WebkitAppearance" in document.documentElement.style || window.console && (console.firebug || console.exception && console.table) || navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31
            }

            exports.formatters.j = function (v) {
                return JSON.stringify(v)
            }
            ;

            function formatArgs() {
                var args = arguments;
                var useColors = this.useColors;
                args[0] = (useColors ? "%c" : "") + this.namespace + (useColors ? " %c" : " ") + args[0] + (useColors ? "%c " : " ") + "+" + exports.humanize(this.diff);
                if (!useColors)
                    return args;
                var c = "color: " + this.color;
                args = [args[0], c, "color: inherit"].concat(Array.prototype.slice.call(args, 1));
                var index = 0;
                var lastC = 0;
                args[0].replace(/%[a-z%]/g, function (match) {
                    if ("%" === match)
                        return;
                    index++;
                    if ("%c" === match) {
                        lastC = index
                    }
                });
                args.splice(lastC, 0, c);
                return args
            }

            function log() {
                return "object" == typeof console && "function" == typeof console.log && Function.prototype.apply.call(console.log, console, arguments)
            }

            function save(namespaces) {
                try {
                    if (null == namespaces) {
                        localStorage.removeItem("debug")
                    } else {
                        localStorage.debug = namespaces
                    }
                } catch (e) {
                }
            }

            function load() {
                var r;
                try {
                    r = localStorage.debug
                } catch (e) {
                }
                return r
            }

            exports.enable(load())
        }
            , {
                "./debug": 23
            }],
        23: [function (_dereq_, module, exports) {
            exports = module.exports = debug;
            exports.coerce = coerce;
            exports.disable = disable;
            exports.enable = enable;
            exports.enabled = enabled;
            exports.humanize = _dereq_("ms");
            exports.names = [];
            exports.skips = [];
            exports.formatters = {};
            var prevColor = 0;
            var prevTime;

            function selectColor() {
                return exports.colors[prevColor++ % exports.colors.length]
            }

            function debug(namespace) {
                function disabled() {
                }

                disabled.enabled = false;

                function enabled() {
                    var self = enabled;
                    var curr = +new Date;
                    var ms = curr - (prevTime || curr);
                    self.diff = ms;
                    self.prev = prevTime;
                    self.curr = curr;
                    prevTime = curr;
                    if (null == self.useColors)
                        self.useColors = exports.useColors();
                    if (null == self.color && self.useColors)
                        self.color = selectColor();
                    var args = Array.prototype.slice.call(arguments);
                    args[0] = exports.coerce(args[0]);
                    if ("string" !== typeof args[0]) {
                        args = ["%o"].concat(args)
                    }
                    var index = 0;
                    args[0] = args[0].replace(/%([a-z%])/g, function (match, format) {
                        if (match === "%")
                            return match;
                        index++;
                        var formatter = exports.formatters[format];
                        if ("function" === typeof formatter) {
                            var val = args[index];
                            match = formatter.call(self, val);
                            args.splice(index, 1);
                            index--
                        }
                        return match
                    });
                    if ("function" === typeof exports.formatArgs) {
                        args = exports.formatArgs.apply(self, args)
                    }
                    var logFn = enabled.log || exports.log || console.log.bind(console);
                    logFn.apply(self, args)
                }

                enabled.enabled = true;
                var fn = exports.enabled(namespace) ? enabled : disabled;
                fn.namespace = namespace;
                return fn
            }

            function enable(namespaces) {
                exports.save(namespaces);
                var split = (namespaces || "").split(/[\s,]+/);
                var len = split.length;
                for (var i = 0; i < len; i++) {
                    if (!split[i])
                        continue;
                    namespaces = split[i].replace(/\*/g, ".*?");
                    if (namespaces[0] === "-") {
                        exports.skips.push(new RegExp("^" + namespaces.substr(1) + "$"))
                    } else {
                        exports.names.push(new RegExp("^" + namespaces + "$"))
                    }
                }
            }

            function disable() {
                exports.enable("")
            }

            function enabled(name) {
                var i, len;
                for (i = 0,
                         len = exports.skips.length; i < len; i++) {
                    if (exports.skips[i].test(name)) {
                        return false
                    }
                }
                for (i = 0,
                         len = exports.names.length; i < len; i++) {
                    if (exports.names[i].test(name)) {
                        return true
                    }
                }
                return false
            }

            function coerce(val) {
                if (val instanceof Error)
                    return val.stack || val.message;
                return val
            }
        }
            , {
                ms: 24
            }],
        24: [function (_dereq_, module, exports) {
            var s = 1e3;
            var m = s * 60;
            var h = m * 60;
            var d = h * 24;
            var y = d * 365.25;
            module.exports = function (val, options) {
                options = options || {};
                if ("string" == typeof val)
                    return parse(val);
                return options.long ? long(val) : short(val)
            }
            ;

            function parse(str) {
                var match = /^((?:\d+)?\.?\d+) *(ms|seconds?|s|minutes?|m|hours?|h|days?|d|years?|y)?$/i.exec(str);
                if (!match)
                    return;
                var n = parseFloat(match[1]);
                var type = (match[2] || "ms").toLowerCase();
                switch (type) {
                    case "years":
                    case "year":
                    case "y":
                        return n * y;
                    case "days":
                    case "day":
                    case "d":
                        return n * d;
                    case "hours":
                    case "hour":
                    case "h":
                        return n * h;
                    case "minutes":
                    case "minute":
                    case "m":
                        return n * m;
                    case "seconds":
                    case "second":
                    case "s":
                        return n * s;
                    case "ms":
                        return n
                }
            }

            function short(ms) {
                if (ms >= d)
                    return Math.round(ms / d) + "d";
                if (ms >= h)
                    return Math.round(ms / h) + "h";
                if (ms >= m)
                    return Math.round(ms / m) + "m";
                if (ms >= s)
                    return Math.round(ms / s) + "s";
                return ms + "ms"
            }

            function long(ms) {
                return plural(ms, d, "day") || plural(ms, h, "hour") || plural(ms, m, "minute") || plural(ms, s, "second") || ms + " ms"
            }

            function plural(ms, n, name) {
                if (ms < n)
                    return;
                if (ms < n * 1.5)
                    return Math.floor(ms / n) + " " + name;
                return Math.ceil(ms / n) + " " + name + "s"
            }
        }
            , {}],
        25: [function (_dereq_, module, exports) {
            (function (global) {
                    var keys = _dereq_("./keys");
                    var hasBinary = _dereq_("has-binary");
                    var sliceBuffer = _dereq_("arraybuffer.slice");
                    var base64encoder = _dereq_("base64-arraybuffer");
                    var after = _dereq_("after");
                    var utf8 = _dereq_("utf8");
                    var isAndroid = navigator.userAgent.match(/Android/i);
                    var isPhantomJS = /PhantomJS/i.test(navigator.userAgent);
                    var dontSendBlobs = isAndroid || isPhantomJS;
                    exports.protocol = 3;
                    var packets = exports.packets = {
                        open: 0,
                        close: 1,
                        ping: 2,
                        pong: 3,
                        message: 4,
                        upgrade: 5,
                        noop: 6
                    };
                    var packetslist = keys(packets);
                    var err = {
                        type: "error",
                        data: "parser error"
                    };
                    var Blob = _dereq_("blob");
                    exports.encodePacket = function (packet, supportsBinary, utf8encode, callback) {
                        if ("function" == typeof supportsBinary) {
                            callback = supportsBinary;
                            supportsBinary = false
                        }
                        if ("function" == typeof utf8encode) {
                            callback = utf8encode;
                            utf8encode = null
                        }
                        var data = packet.data === undefined ? undefined : packet.data.buffer || packet.data;
                        if (global.ArrayBuffer && data instanceof ArrayBuffer) {
                            return encodeArrayBuffer(packet, supportsBinary, callback)
                        } else if (Blob && data instanceof global.Blob) {
                            return encodeBlob(packet, supportsBinary, callback)
                        }
                        if (data && data.base64) {
                            return encodeBase64Object(packet, callback)
                        }
                        var encoded = packets[packet.type];
                        if (undefined !== packet.data) {
                            encoded += utf8encode ? utf8.encode(String(packet.data)) : String(packet.data)
                        }
                        return callback("" + encoded)
                    }
                    ;

                    function encodeBase64Object(packet, callback) {
                        var message = "b" + exports.packets[packet.type] + packet.data.data;
                        return callback(message)
                    }

                    function encodeArrayBuffer(packet, supportsBinary, callback) {
                        if (!supportsBinary) {
                            return exports.encodeBase64Packet(packet, callback)
                        }
                        var data = packet.data;
                        var contentArray = new Uint8Array(data);
                        var resultBuffer = new Uint8Array(1 + data.byteLength);
                        resultBuffer[0] = packets[packet.type];
                        for (var i = 0; i < contentArray.length; i++) {
                            resultBuffer[i + 1] = contentArray[i]
                        }
                        return callback(resultBuffer.buffer)
                    }

                    function encodeBlobAsArrayBuffer(packet, supportsBinary, callback) {
                        if (!supportsBinary) {
                            return exports.encodeBase64Packet(packet, callback)
                        }
                        var fr = new FileReader;
                        fr.onload = function () {
                            packet.data = fr.result;
                            exports.encodePacket(packet, supportsBinary, true, callback)
                        }
                        ;
                        return fr.readAsArrayBuffer(packet.data)
                    }

                    function encodeBlob(packet, supportsBinary, callback) {
                        if (!supportsBinary) {
                            return exports.encodeBase64Packet(packet, callback)
                        }
                        if (dontSendBlobs) {
                            return encodeBlobAsArrayBuffer(packet, supportsBinary, callback)
                        }
                        var length = new Uint8Array(1);
                        length[0] = packets[packet.type];
                        var blob = new Blob([length.buffer, packet.data]);
                        return callback(blob)
                    }

                    exports.encodeBase64Packet = function (packet, callback) {
                        var message = "b" + exports.packets[packet.type];
                        if (Blob && packet.data instanceof Blob) {
                            var fr = new FileReader;
                            fr.onload = function () {
                                var b64 = fr.result.split(",")[1];
                                callback(message + b64)
                            }
                            ;
                            return fr.readAsDataURL(packet.data)
                        }
                        var b64data;
                        try {
                            b64data = String.fromCharCode.apply(null, new Uint8Array(packet.data))
                        } catch (e) {
                            var typed = new Uint8Array(packet.data);
                            var basic = new Array(typed.length);
                            for (var i = 0; i < typed.length; i++) {
                                basic[i] = typed[i]
                            }
                            b64data = String.fromCharCode.apply(null, basic)
                        }
                        message += global.btoa(b64data);
                        return callback(message)
                    }
                    ;
                    exports.decodePacket = function (data, binaryType, utf8decode) {
                        if (typeof data == "string" || data === undefined) {
                            if (data.charAt(0) == "b") {
                                return exports.decodeBase64Packet(data.substr(1), binaryType)
                            }
                            if (utf8decode) {
                                try {
                                    data = utf8.decode(data)
                                } catch (e) {
                                    return err
                                }
                            }
                            var type = data.charAt(0);
                            if (Number(type) != type || !packetslist[type]) {
                                return err
                            }
                            if (data.length > 1) {
                                return {
                                    type: packetslist[type],
                                    data: data.substring(1)
                                }
                            } else {
                                return {
                                    type: packetslist[type]
                                }
                            }
                        }
                        var asArray = new Uint8Array(data);
                        var type = asArray[0];
                        var rest = sliceBuffer(data, 1);
                        if (Blob && binaryType === "blob") {
                            rest = new Blob([rest])
                        }
                        return {
                            type: packetslist[type],
                            data: rest
                        }
                    }
                    ;
                    exports.decodeBase64Packet = function (msg, binaryType) {
                        var type = packetslist[msg.charAt(0)];
                        if (!global.ArrayBuffer) {
                            return {
                                type: type,
                                data: {
                                    base64: true,
                                    data: msg.substr(1)
                                }
                            }
                        }
                        var data = base64encoder.decode(msg.substr(1));
                        if (binaryType === "blob" && Blob) {
                            data = new Blob([data])
                        }
                        return {
                            type: type,
                            data: data
                        }
                    }
                    ;
                    exports.encodePayload = function (packets, supportsBinary, callback) {
                        if (typeof supportsBinary == "function") {
                            callback = supportsBinary;
                            supportsBinary = null
                        }
                        var isBinary = hasBinary(packets);
                        if (supportsBinary && isBinary) {
                            if (Blob && !dontSendBlobs) {
                                return exports.encodePayloadAsBlob(packets, callback)
                            }
                            return exports.encodePayloadAsArrayBuffer(packets, callback)
                        }
                        if (!packets.length) {
                            return callback("0:")
                        }

                        function setLengthHeader(message) {
                            return message.length + ":" + message
                        }

                        function encodeOne(packet, doneCallback) {
                            exports.encodePacket(packet, !isBinary ? false : supportsBinary, true, function (message) {
                                doneCallback(null, setLengthHeader(message))
                            })
                        }

                        map(packets, encodeOne, function (err, results) {
                            return callback(results.join(""))
                        })
                    }
                    ;

                    function map(ary, each, done) {
                        var result = new Array(ary.length);
                        var next = after(ary.length, done);
                        var eachWithIndex = function (i, el, cb) {
                            each(el, function (error, msg) {
                                result[i] = msg;
                                cb(error, result)
                            })
                        };
                        for (var i = 0; i < ary.length; i++) {
                            eachWithIndex(i, ary[i], next)
                        }
                    }

                    exports.decodePayload = function (data, binaryType, callback) {
                        if (typeof data != "string") {
                            return exports.decodePayloadAsBinary(data, binaryType, callback)
                        }
                        if (typeof binaryType === "function") {
                            callback = binaryType;
                            binaryType = null
                        }
                        var packet;
                        if (data == "") {
                            return callback(err, 0, 1)
                        }
                        var length = "", n, msg;
                        for (var i = 0, l = data.length; i < l; i++) {
                            var chr = data.charAt(i);
                            if (":" != chr) {
                                length += chr
                            } else {
                                if ("" == length || length != (n = Number(length))) {
                                    return callback(err, 0, 1)
                                }
                                msg = data.substr(i + 1, n);
                                if (length != msg.length) {
                                    return callback(err, 0, 1)
                                }
                                if (msg.length) {
                                    packet = exports.decodePacket(msg, binaryType, true);
                                    if (err.type == packet.type && err.data == packet.data) {
                                        return callback(err, 0, 1)
                                    }
                                    var ret = callback(packet, i + n, l);
                                    if (false === ret)
                                        return
                                }
                                i += n;
                                length = ""
                            }
                        }
                        if (length != "") {
                            return callback(err, 0, 1)
                        }
                    }
                    ;
                    exports.encodePayloadAsArrayBuffer = function (packets, callback) {
                        if (!packets.length) {
                            return callback(new ArrayBuffer(0))
                        }

                        function encodeOne(packet, doneCallback) {
                            exports.encodePacket(packet, true, true, function (data) {
                                return doneCallback(null, data)
                            })
                        }

                        map(packets, encodeOne, function (err, encodedPackets) {
                            var totalLength = encodedPackets.reduce(function (acc, p) {
                                var len;
                                if (typeof p === "string") {
                                    len = p.length
                                } else {
                                    len = p.byteLength
                                }
                                return acc + len.toString().length + len + 2
                            }, 0);
                            var resultArray = new Uint8Array(totalLength);
                            var bufferIndex = 0;
                            encodedPackets.forEach(function (p) {
                                var isString = typeof p === "string";
                                var ab = p;
                                if (isString) {
                                    var view = new Uint8Array(p.length);
                                    for (var i = 0; i < p.length; i++) {
                                        view[i] = p.charCodeAt(i)
                                    }
                                    ab = view.buffer
                                }
                                if (isString) {
                                    resultArray[bufferIndex++] = 0
                                } else {
                                    resultArray[bufferIndex++] = 1
                                }
                                var lenStr = ab.byteLength.toString();
                                for (var i = 0; i < lenStr.length; i++) {
                                    resultArray[bufferIndex++] = parseInt(lenStr[i])
                                }
                                resultArray[bufferIndex++] = 255;
                                var view = new Uint8Array(ab);
                                for (var i = 0; i < view.length; i++) {
                                    resultArray[bufferIndex++] = view[i]
                                }
                            });
                            return callback(resultArray.buffer)
                        })
                    }
                    ;
                    exports.encodePayloadAsBlob = function (packets, callback) {
                        function encodeOne(packet, doneCallback) {
                            exports.encodePacket(packet, true, true, function (encoded) {
                                var binaryIdentifier = new Uint8Array(1);
                                binaryIdentifier[0] = 1;
                                if (typeof encoded === "string") {
                                    var view = new Uint8Array(encoded.length);
                                    for (var i = 0; i < encoded.length; i++) {
                                        view[i] = encoded.charCodeAt(i)
                                    }
                                    encoded = view.buffer;
                                    binaryIdentifier[0] = 0
                                }
                                var len = encoded instanceof ArrayBuffer ? encoded.byteLength : encoded.size;
                                var lenStr = len.toString();
                                var lengthAry = new Uint8Array(lenStr.length + 1);
                                for (var i = 0; i < lenStr.length; i++) {
                                    lengthAry[i] = parseInt(lenStr[i])
                                }
                                lengthAry[lenStr.length] = 255;
                                if (Blob) {
                                    var blob = new Blob([binaryIdentifier.buffer, lengthAry.buffer, encoded]);
                                    doneCallback(null, blob)
                                }
                            })
                        }

                        map(packets, encodeOne, function (err, results) {
                            return callback(new Blob(results))
                        })
                    }
                    ;
                    exports.decodePayloadAsBinary = function (data, binaryType, callback) {
                        if (typeof binaryType === "function") {
                            callback = binaryType;
                            binaryType = null
                        }
                        var bufferTail = data;
                        var buffers = [];
                        var numberTooLong = false;
                        while (bufferTail.byteLength > 0) {
                            var tailArray = new Uint8Array(bufferTail);
                            var isString = tailArray[0] === 0;
                            var msgLength = "";
                            for (var i = 1; ; i++) {
                                if (tailArray[i] == 255)
                                    break;
                                if (msgLength.length > 310) {
                                    numberTooLong = true;
                                    break
                                }
                                msgLength += tailArray[i]
                            }
                            if (numberTooLong)
                                return callback(err, 0, 1);
                            bufferTail = sliceBuffer(bufferTail, 2 + msgLength.length);
                            msgLength = parseInt(msgLength);
                            var msg = sliceBuffer(bufferTail, 0, msgLength);
                            if (isString) {
                                try {
                                    msg = String.fromCharCode.apply(null, new Uint8Array(msg))
                                } catch (e) {
                                    var typed = new Uint8Array(msg);
                                    msg = "";
                                    for (var i = 0; i < typed.length; i++) {
                                        msg += String.fromCharCode(typed[i])
                                    }
                                }
                            }
                            buffers.push(msg);
                            bufferTail = sliceBuffer(bufferTail, msgLength)
                        }
                        var total = buffers.length;
                        buffers.forEach(function (buffer, i) {
                            callback(exports.decodePacket(buffer, binaryType, true), i, total)
                        })
                    }
                }
            ).call(this, typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
        }
            , {
                "./keys": 26,
                after: 27,
                "arraybuffer.slice": 28,
                "base64-arraybuffer": 29,
                blob: 30,
                "has-binary": 31,
                utf8: 33
            }],
        26: [function (_dereq_, module, exports) {
            module.exports = Object.keys || function keys(obj) {
                var arr = [];
                var has = Object.prototype.hasOwnProperty;
                for (var i in obj) {
                    if (has.call(obj, i)) {
                        arr.push(i)
                    }
                }
                return arr
            }
        }
            , {}],
        27: [function (_dereq_, module, exports) {
            module.exports = after;

            function after(count, callback, err_cb) {
                var bail = false;
                err_cb = err_cb || noop;
                proxy.count = count;
                return count === 0 ? callback() : proxy;

                function proxy(err, result) {
                    if (proxy.count <= 0) {
                        throw new Error("after called too many times")
                    }
                    --proxy.count;
                    if (err) {
                        bail = true;
                        callback(err);
                        callback = err_cb
                    } else if (proxy.count === 0 && !bail) {
                        callback(null, result)
                    }
                }
            }

            function noop() {
            }
        }
            , {}],
        28: [function (_dereq_, module, exports) {
            module.exports = function (arraybuffer, start, end) {
                var bytes = arraybuffer.byteLength;
                start = start || 0;
                end = end || bytes;
                if (arraybuffer.slice) {
                    return arraybuffer.slice(start, end)
                }
                if (start < 0) {
                    start += bytes
                }
                if (end < 0) {
                    end += bytes
                }
                if (end > bytes) {
                    end = bytes
                }
                if (start >= bytes || start >= end || bytes === 0) {
                    return new ArrayBuffer(0)
                }
                var abv = new Uint8Array(arraybuffer);
                var result = new Uint8Array(end - start);
                for (var i = start, ii = 0; i < end; i++,
                    ii++) {
                    result[ii] = abv[i]
                }
                return result.buffer
            }
        }
            , {}],
        29: [function (_dereq_, module, exports) {
            (function (chars) {
                    "use strict";
                    exports.encode = function (arraybuffer) {
                        var bytes = new Uint8Array(arraybuffer), i, len = bytes.length, base64 = "";
                        for (i = 0; i < len; i += 3) {
                            base64 += chars[bytes[i] >> 2];
                            base64 += chars[(bytes[i] & 3) << 4 | bytes[i + 1] >> 4];
                            base64 += chars[(bytes[i + 1] & 15) << 2 | bytes[i + 2] >> 6];
                            base64 += chars[bytes[i + 2] & 63]
                        }
                        if (len % 3 === 2) {
                            base64 = base64.substring(0, base64.length - 1) + "="
                        } else if (len % 3 === 1) {
                            base64 = base64.substring(0, base64.length - 2) + "=="
                        }
                        return base64
                    }
                    ;
                    exports.decode = function (base64) {
                        var bufferLength = base64.length * .75, len = base64.length, i, p = 0, encoded1, encoded2,
                            encoded3, encoded4;
                        if (base64[base64.length - 1] === "=") {
                            bufferLength--;
                            if (base64[base64.length - 2] === "=") {
                                bufferLength--
                            }
                        }
                        var arraybuffer = new ArrayBuffer(bufferLength)
                            , bytes = new Uint8Array(arraybuffer);
                        for (i = 0; i < len; i += 4) {
                            encoded1 = chars.indexOf(base64[i]);
                            encoded2 = chars.indexOf(base64[i + 1]);
                            encoded3 = chars.indexOf(base64[i + 2]);
                            encoded4 = chars.indexOf(base64[i + 3]);
                            bytes[p++] = encoded1 << 2 | encoded2 >> 4;
                            bytes[p++] = (encoded2 & 15) << 4 | encoded3 >> 2;
                            bytes[p++] = (encoded3 & 3) << 6 | encoded4 & 63
                        }
                        return arraybuffer
                    }
                }
            )("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/")
        }
            , {}],
        30: [function (_dereq_, module, exports) {
            (function (global) {
                    var BlobBuilder = global.BlobBuilder || global.WebKitBlobBuilder || global.MSBlobBuilder || global.MozBlobBuilder;
                    var blobSupported = function () {
                        try {
                            var b = new Blob(["hi"]);
                            return b.size == 2
                        } catch (e) {
                            return false
                        }
                    }();
                    var blobBuilderSupported = BlobBuilder && BlobBuilder.prototype.append && BlobBuilder.prototype.getBlob;

                    function BlobBuilderConstructor(ary, options) {
                        options = options || {};
                        var bb = new BlobBuilder;
                        for (var i = 0; i < ary.length; i++) {
                            bb.append(ary[i])
                        }
                        return options.type ? bb.getBlob(options.type) : bb.getBlob()
                    }

                    module.exports = function () {
                        if (blobSupported) {
                            return global.Blob
                        } else if (blobBuilderSupported) {
                            return BlobBuilderConstructor
                        } else {
                            return undefined
                        }
                    }()
                }
            ).call(this, typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
        }
            , {}],
        31: [function (_dereq_, module, exports) {
            (function (global) {
                    var isArray = _dereq_("isarray");
                    module.exports = hasBinary;

                    function hasBinary(data) {
                        function _hasBinary(obj) {
                            if (!obj)
                                return false;
                            if (global.Buffer && global.Buffer.isBuffer(obj) || global.ArrayBuffer && obj instanceof ArrayBuffer || global.Blob && obj instanceof Blob || global.File && obj instanceof File) {
                                return true
                            }
                            if (isArray(obj)) {
                                for (var i = 0; i < obj.length; i++) {
                                    if (_hasBinary(obj[i])) {
                                        return true
                                    }
                                }
                            } else if (obj && "object" == typeof obj) {
                                if (obj.toJSON) {
                                    obj = obj.toJSON()
                                }
                                for (var key in obj) {
                                    if (obj.hasOwnProperty(key) && _hasBinary(obj[key])) {
                                        return true
                                    }
                                }
                            }
                            return false
                        }

                        return _hasBinary(data)
                    }
                }
            ).call(this, typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
        }
            , {
                isarray: 32
            }],
        32: [function (_dereq_, module, exports) {
            module.exports = Array.isArray || function (arr) {
                return Object.prototype.toString.call(arr) == "[object Array]"
            }
        }
            , {}],
        33: [function (_dereq_, module, exports) {
            (function (global) {
                    (function (root) {
                            var freeExports = typeof exports == "object" && exports;
                            var freeModule = typeof module == "object" && module && module.exports == freeExports && module;
                            var freeGlobal = typeof global == "object" && global;
                            if (freeGlobal.global === freeGlobal || freeGlobal.window === freeGlobal) {
                                root = freeGlobal
                            }
                            var stringFromCharCode = String.fromCharCode;

                            function ucs2decode(string) {
                                var output = [];
                                var counter = 0;
                                var length = string.length;
                                var value;
                                var extra;
                                while (counter < length) {
                                    value = string.charCodeAt(counter++);
                                    if (value >= 55296 && value <= 56319 && counter < length) {
                                        extra = string.charCodeAt(counter++);
                                        if ((extra & 64512) == 56320) {
                                            output.push(((value & 1023) << 10) + (extra & 1023) + 65536)
                                        } else {
                                            output.push(value);
                                            counter--
                                        }
                                    } else {
                                        output.push(value)
                                    }
                                }
                                return output
                            }

                            function ucs2encode(array) {
                                var length = array.length;
                                var index = -1;
                                var value;
                                var output = "";
                                while (++index < length) {
                                    value = array[index];
                                    if (value > 65535) {
                                        value -= 65536;
                                        output += stringFromCharCode(value >>> 10 & 1023 | 55296);
                                        value = 56320 | value & 1023
                                    }
                                    output += stringFromCharCode(value)
                                }
                                return output
                            }

                            function createByte(codePoint, shift) {
                                return stringFromCharCode(codePoint >> shift & 63 | 128)
                            }

                            function encodeCodePoint(codePoint) {
                                if ((codePoint & 4294967168) == 0) {
                                    return stringFromCharCode(codePoint)
                                }
                                var symbol = "";
                                if ((codePoint & 4294965248) == 0) {
                                    symbol = stringFromCharCode(codePoint >> 6 & 31 | 192)
                                } else if ((codePoint & 4294901760) == 0) {
                                    symbol = stringFromCharCode(codePoint >> 12 & 15 | 224);
                                    symbol += createByte(codePoint, 6)
                                } else if ((codePoint & 4292870144) == 0) {
                                    symbol = stringFromCharCode(codePoint >> 18 & 7 | 240);
                                    symbol += createByte(codePoint, 12);
                                    symbol += createByte(codePoint, 6)
                                }
                                symbol += stringFromCharCode(codePoint & 63 | 128);
                                return symbol
                            }

                            function utf8encode(string) {
                                var codePoints = ucs2decode(string);
                                var length = codePoints.length;
                                var index = -1;
                                var codePoint;
                                var byteString = "";
                                while (++index < length) {
                                    codePoint = codePoints[index];
                                    byteString += encodeCodePoint(codePoint)
                                }
                                return byteString
                            }

                            function readContinuationByte() {
                                if (byteIndex >= byteCount) {
                                    throw Error("Invalid byte index")
                                }
                                var continuationByte = byteArray[byteIndex] & 255;
                                byteIndex++;
                                if ((continuationByte & 192) == 128) {
                                    return continuationByte & 63
                                }
                                throw Error("Invalid continuation byte")
                            }

                            function decodeSymbol() {
                                var byte1;
                                var byte2;
                                var byte3;
                                var byte4;
                                var codePoint;
                                if (byteIndex > byteCount) {
                                    throw Error("Invalid byte index")
                                }
                                if (byteIndex == byteCount) {
                                    return false
                                }
                                byte1 = byteArray[byteIndex] & 255;
                                byteIndex++;
                                if ((byte1 & 128) == 0) {
                                    return byte1
                                }
                                if ((byte1 & 224) == 192) {
                                    var byte2 = readContinuationByte();
                                    codePoint = (byte1 & 31) << 6 | byte2;
                                    if (codePoint >= 128) {
                                        return codePoint
                                    } else {
                                        throw Error("Invalid continuation byte")
                                    }
                                }
                                if ((byte1 & 240) == 224) {
                                    byte2 = readContinuationByte();
                                    byte3 = readContinuationByte();
                                    codePoint = (byte1 & 15) << 12 | byte2 << 6 | byte3;
                                    if (codePoint >= 2048) {
                                        return codePoint
                                    } else {
                                        throw Error("Invalid continuation byte")
                                    }
                                }
                                if ((byte1 & 248) == 240) {
                                    byte2 = readContinuationByte();
                                    byte3 = readContinuationByte();
                                    byte4 = readContinuationByte();
                                    codePoint = (byte1 & 15) << 18 | byte2 << 12 | byte3 << 6 | byte4;
                                    if (codePoint >= 65536 && codePoint <= 1114111) {
                                        return codePoint
                                    }
                                }
                                throw Error("Invalid UTF-8 detected")
                            }

                            var byteArray;
                            var byteCount;
                            var byteIndex;

                            function utf8decode(byteString) {
                                byteArray = ucs2decode(byteString);
                                byteCount = byteArray.length;
                                byteIndex = 0;
                                var codePoints = [];
                                var tmp;
                                while ((tmp = decodeSymbol()) !== false) {
                                    codePoints.push(tmp)
                                }
                                return ucs2encode(codePoints)
                            }

                            var utf8 = {
                                version: "2.0.0",
                                encode: utf8encode,
                                decode: utf8decode
                            };
                            if (typeof define == "function" && typeof define.amd == "object" && define.amd) {
                                define(function () {
                                    return utf8
                                })
                            } else if (freeExports && !freeExports.nodeType) {
                                if (freeModule) {
                                    freeModule.exports = utf8
                                } else {
                                    var object = {};
                                    var hasOwnProperty = object.hasOwnProperty;
                                    for (var key in utf8) {
                                        hasOwnProperty.call(utf8, key) && (freeExports[key] = utf8[key])
                                    }
                                }
                            } else {
                                root.utf8 = utf8
                            }
                        }
                    )(this)
                }
            ).call(this, typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
        }
            , {}],
        34: [function (_dereq_, module, exports) {
            (function (global) {
                    var rvalidchars = /^[\],:{}\s]*$/;
                    var rvalidescape = /\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g;
                    var rvalidtokens = /"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g;
                    var rvalidbraces = /(?:^|:|,)(?:\s*\[)+/g;
                    var rtrimLeft = /^\s+/;
                    var rtrimRight = /\s+$/;
                    module.exports = function parsejson(data) {
                        if ("string" != typeof data || !data) {
                            return null
                        }
                        data = data.replace(rtrimLeft, "").replace(rtrimRight, "");
                        if (global.JSON && JSON.parse) {
                            return JSON.parse(data)
                        }
                        if (rvalidchars.test(data.replace(rvalidescape, "@").replace(rvalidtokens, "]").replace(rvalidbraces, ""))) {
                            return new Function("return " + data)()
                        }
                    }
                }
            ).call(this, typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
        }
            , {}],
        35: [function (_dereq_, module, exports) {
            exports.encode = function (obj) {
                var str = "";
                for (var i in obj) {
                    if (obj.hasOwnProperty(i)) {
                        if (str.length)
                            str += "&";
                        str += encodeURIComponent(i) + "=" + encodeURIComponent(obj[i])
                    }
                }
                return str
            }
            ;
            exports.decode = function (qs) {
                var qry = {};
                var pairs = qs.split("&");
                for (var i = 0, l = pairs.length; i < l; i++) {
                    var pair = pairs[i].split("=");
                    qry[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1])
                }
                return qry
            }
        }
            , {}],
        36: [function (_dereq_, module, exports) {
            var re = /^(?:(?![^:@]+:[^:@\/]*@)(http|https|ws|wss):\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?((?:[a-f0-9]{0,4}:){2,7}[a-f0-9]{0,4}|[^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/;
            var parts = ["source", "protocol", "authority", "userInfo", "user", "password", "host", "port", "relative", "path", "directory", "file", "query", "anchor"];
            module.exports = function parseuri(str) {
                var src = str
                    , b = str.indexOf("[")
                    , e = str.indexOf("]");
                if (b != -1 && e != -1) {
                    str = str.substring(0, b) + str.substring(b, e).replace(/:/g, ";") + str.substring(e, str.length)
                }
                var m = re.exec(str || "")
                    , uri = {}
                    , i = 14;
                while (i--) {
                    uri[parts[i]] = m[i] || ""
                }
                if (b != -1 && e != -1) {
                    uri.source = src;
                    uri.host = uri.host.substring(1, uri.host.length - 1).replace(/;/g, ":");
                    uri.authority = uri.authority.replace("[", "").replace("]", "").replace(/;/g, ":");
                    uri.ipv6uri = true
                }
                return uri
            }
        }
            , {}],
        37: [function (_dereq_, module, exports) {
            var global = function () {
                return this
            }();
            var WebSocket = global.WebSocket || global.MozWebSocket;
            module.exports = WebSocket ? ws : null;

            function ws(uri, protocols, opts) {
                var instance;
                if (protocols) {
                    instance = new WebSocket(uri, protocols)
                } else {
                    instance = new WebSocket(uri)
                }
                return instance
            }

            if (WebSocket)
                ws.prototype = WebSocket.prototype
        }
            , {}],
        38: [function (_dereq_, module, exports) {
            (function (global) {
                    var isArray = _dereq_("isarray");
                    module.exports = hasBinary;

                    function hasBinary(data) {
                        function _hasBinary(obj) {
                            if (!obj)
                                return false;
                            if (global.Buffer && global.Buffer.isBuffer(obj) || global.ArrayBuffer && obj instanceof ArrayBuffer || global.Blob && obj instanceof Blob || global.File && obj instanceof File) {
                                return true
                            }
                            if (isArray(obj)) {
                                for (var i = 0; i < obj.length; i++) {
                                    if (_hasBinary(obj[i])) {
                                        return true
                                    }
                                }
                            } else if (obj && "object" == typeof obj) {
                                if (obj.toJSON) {
                                    obj = obj.toJSON()
                                }
                                for (var key in obj) {
                                    if (Object.prototype.hasOwnProperty.call(obj, key) && _hasBinary(obj[key])) {
                                        return true
                                    }
                                }
                            }
                            return false
                        }

                        return _hasBinary(data)
                    }
                }
            ).call(this, typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
        }
            , {
                isarray: 39
            }],
        39: [function (_dereq_, module, exports) {
            module.exports = _dereq_(32)
        }
            , {}],
        40: [function (_dereq_, module, exports) {
            var global = _dereq_("global");
            try {
                module.exports = "XMLHttpRequest" in global && "withCredentials" in new global.XMLHttpRequest
            } catch (err) {
                module.exports = false
            }
        }
            , {
                global: 41
            }],
        41: [function (_dereq_, module, exports) {
            module.exports = function () {
                return this
            }()
        }
            , {}],
        42: [function (_dereq_, module, exports) {
            var indexOf = [].indexOf;
            module.exports = function (arr, obj) {
                if (indexOf)
                    return arr.indexOf(obj);
                for (var i = 0; i < arr.length; ++i) {
                    if (arr[i] === obj)
                        return i
                }
                return -1
            }
        }
            , {}],
        43: [function (_dereq_, module, exports) {
            var has = Object.prototype.hasOwnProperty;
            exports.keys = Object.keys || function (obj) {
                var keys = [];
                for (var key in obj) {
                    if (has.call(obj, key)) {
                        keys.push(key)
                    }
                }
                return keys
            }
            ;
            exports.values = function (obj) {
                var vals = [];
                for (var key in obj) {
                    if (has.call(obj, key)) {
                        vals.push(obj[key])
                    }
                }
                return vals
            }
            ;
            exports.merge = function (a, b) {
                for (var key in b) {
                    if (has.call(b, key)) {
                        a[key] = b[key]
                    }
                }
                return a
            }
            ;
            exports.length = function (obj) {
                return exports.keys(obj).length
            }
            ;
            exports.isEmpty = function (obj) {
                return 0 == exports.length(obj)
            }
        }
            , {}],
        44: [function (_dereq_, module, exports) {
            var re = /^(?:(?![^:@]+:[^:@\/]*@)(http|https|ws|wss):\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?((?:[a-f0-9]{0,4}:){2,7}[a-f0-9]{0,4}|[^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/;
            var parts = ["source", "protocol", "authority", "userInfo", "user", "password", "host", "port", "relative", "path", "directory", "file", "query", "anchor"];
            module.exports = function parseuri(str) {
                var m = re.exec(str || "")
                    , uri = {}
                    , i = 14;
                while (i--) {
                    uri[parts[i]] = m[i] || ""
                }
                return uri
            }
        }
            , {}],
        45: [function (_dereq_, module, exports) {
            (function (global) {
                    var isArray = _dereq_("isarray");
                    var isBuf = _dereq_("./is-buffer");
                    exports.deconstructPacket = function (packet) {
                        var buffers = [];
                        var packetData = packet.data;

                        function _deconstructPacket(data) {
                            if (!data)
                                return data;
                            if (isBuf(data)) {
                                var placeholder = {
                                    _placeholder: true,
                                    num: buffers.length
                                };
                                buffers.push(data);
                                return placeholder
                            } else if (isArray(data)) {
                                var newData = new Array(data.length);
                                for (var i = 0; i < data.length; i++) {
                                    newData[i] = _deconstructPacket(data[i])
                                }
                                return newData
                            } else if ("object" == typeof data && !(data instanceof Date)) {
                                var newData = {};
                                for (var key in data) {
                                    newData[key] = _deconstructPacket(data[key])
                                }
                                return newData
                            }
                            return data
                        }

                        var pack = packet;
                        pack.data = _deconstructPacket(packetData);
                        pack.attachments = buffers.length;
                        return {
                            packet: pack,
                            buffers: buffers
                        }
                    }
                    ;
                    exports.reconstructPacket = function (packet, buffers) {
                        var curPlaceHolder = 0;

                        function _reconstructPacket(data) {
                            if (data && data._placeholder) {
                                var buf = buffers[data.num];
                                return buf
                            } else if (isArray(data)) {
                                for (var i = 0; i < data.length; i++) {
                                    data[i] = _reconstructPacket(data[i])
                                }
                                return data
                            } else if (data && "object" == typeof data) {
                                for (var key in data) {
                                    data[key] = _reconstructPacket(data[key])
                                }
                                return data
                            }
                            return data
                        }

                        packet.data = _reconstructPacket(packet.data);
                        packet.attachments = undefined;
                        return packet
                    }
                    ;
                    exports.removeBlobs = function (data, callback) {
                        function _removeBlobs(obj, curKey, containingObject) {
                            if (!obj)
                                return obj;
                            if (global.Blob && obj instanceof Blob || global.File && obj instanceof File) {
                                pendingBlobs++;
                                var fileReader = new FileReader;
                                fileReader.onload = function () {
                                    if (containingObject) {
                                        containingObject[curKey] = this.result
                                    } else {
                                        bloblessData = this.result
                                    }
                                    if (!--pendingBlobs) {
                                        callback(bloblessData)
                                    }
                                }
                                ;
                                fileReader.readAsArrayBuffer(obj)
                            } else if (isArray(obj)) {
                                for (var i = 0; i < obj.length; i++) {
                                    _removeBlobs(obj[i], i, obj)
                                }
                            } else if (obj && "object" == typeof obj && !isBuf(obj)) {
                                for (var key in obj) {
                                    _removeBlobs(obj[key], key, obj)
                                }
                            }
                        }

                        var pendingBlobs = 0;
                        var bloblessData = data;
                        _removeBlobs(bloblessData);
                        if (!pendingBlobs) {
                            callback(bloblessData)
                        }
                    }
                }
            ).call(this, typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
        }
            , {
                "./is-buffer": 47,
                isarray: 48
            }],
        46: [function (_dereq_, module, exports) {
            var debug = _dereq_("debug")("socket.io-parser");
            var json = _dereq_("json3");
            var isArray = _dereq_("isarray");
            var Emitter = _dereq_("component-emitter");
            var binary = _dereq_("./binary");
            var isBuf = _dereq_("./is-buffer");
            exports.protocol = 4;
            exports.types = ["CONNECT", "DISCONNECT", "EVENT", "BINARY_EVENT", "ACK", "BINARY_ACK", "ERROR"];
            exports.CONNECT = 0;
            exports.DISCONNECT = 1;
            exports.EVENT = 2;
            exports.ACK = 3;
            exports.ERROR = 4;
            exports.BINARY_EVENT = 5;
            exports.BINARY_ACK = 6;
            exports.Encoder = Encoder;
            exports.Decoder = Decoder;

            function Encoder() {
            }

            Encoder.prototype.encode = function (obj, callback) {
                debug("encoding packet %j", obj);
                if (exports.BINARY_EVENT == obj.type || exports.BINARY_ACK == obj.type) {
                    encodeAsBinary(obj, callback)
                } else {
                    var encoding = encodeAsString(obj);
                    callback([encoding])
                }
            }
            ;

            function encodeAsString(obj) {
                var str = "";
                var nsp = false;
                str += obj.type;
                if (exports.BINARY_EVENT == obj.type || exports.BINARY_ACK == obj.type) {
                    str += obj.attachments;
                    str += "-"
                }
                if (obj.nsp && "/" != obj.nsp) {
                    nsp = true;
                    str += obj.nsp
                }
                if (null != obj.id) {
                    if (nsp) {
                        str += ",";
                        nsp = false
                    }
                    str += obj.id
                }
                if (null != obj.data) {
                    if (nsp)
                        str += ",";
                    str += json.stringify(obj.data)
                }
                debug("encoded %j as %s", obj, str);
                return str
            }

            function encodeAsBinary(obj, callback) {
                function writeEncoding(bloblessData) {
                    var deconstruction = binary.deconstructPacket(bloblessData);
                    var pack = encodeAsString(deconstruction.packet);
                    var buffers = deconstruction.buffers;
                    buffers.unshift(pack);
                    callback(buffers)
                }

                binary.removeBlobs(obj, writeEncoding)
            }

            function Decoder() {
                this.reconstructor = null
            }

            Emitter(Decoder.prototype);
            Decoder.prototype.add = function (obj) {
                var packet;
                if ("string" == typeof obj) {
                    packet = decodeString(obj);
                    if (exports.BINARY_EVENT == packet.type || exports.BINARY_ACK == packet.type) {
                        this.reconstructor = new BinaryReconstructor(packet);
                        if (this.reconstructor.reconPack.attachments === 0) {
                            this.emit("decoded", packet)
                        }
                    } else {
                        this.emit("decoded", packet)
                    }
                } else if (isBuf(obj) || obj.base64) {
                    if (!this.reconstructor) {
                        throw new Error("got binary data when not reconstructing a packet")
                    } else {
                        packet = this.reconstructor.takeBinaryData(obj);
                        if (packet) {
                            this.reconstructor = null;
                            this.emit("decoded", packet)
                        }
                    }
                } else {
                    throw new Error("Unknown type: " + obj)
                }
            }
            ;

            function decodeString(str) {
                var p = {};
                var i = 0;
                p.type = Number(str.charAt(0));
                if (null == exports.types[p.type])
                    return error();
                if (exports.BINARY_EVENT == p.type || exports.BINARY_ACK == p.type) {
                    var buf = "";
                    while (str.charAt(++i) != "-") {
                        buf += str.charAt(i);
                        if (i + 1 == str.length)
                            break
                    }
                    if (buf != Number(buf) || str.charAt(i) != "-") {
                        throw new Error("Illegal attachments")
                    }
                    p.attachments = Number(buf)
                }
                if ("/" == str.charAt(i + 1)) {
                    p.nsp = "";
                    while (++i) {
                        var c = str.charAt(i);
                        if ("," == c)
                            break;
                        p.nsp += c;
                        if (i + 1 == str.length)
                            break
                    }
                } else {
                    p.nsp = "/"
                }
                var next = str.charAt(i + 1);
                if ("" !== next && Number(next) == next) {
                    p.id = "";
                    while (++i) {
                        var c = str.charAt(i);
                        if (null == c || Number(c) != c) {
                            --i;
                            break
                        }
                        p.id += str.charAt(i);
                        if (i + 1 == str.length)
                            break
                    }
                    p.id = Number(p.id)
                }
                if (str.charAt(++i)) {
                    try {
                        p.data = json.parse(str.substr(i))
                    } catch (e) {
                        return error()
                    }
                }
                debug("decoded %s as %j", str, p);
                return p
            }

            Decoder.prototype.destroy = function () {
                if (this.reconstructor) {
                    this.reconstructor.finishedReconstruction()
                }
            }
            ;

            function BinaryReconstructor(packet) {
                this.reconPack = packet;
                this.buffers = []
            }

            BinaryReconstructor.prototype.takeBinaryData = function (binData) {
                this.buffers.push(binData);
                if (this.buffers.length == this.reconPack.attachments) {
                    var packet = binary.reconstructPacket(this.reconPack, this.buffers);
                    this.finishedReconstruction();
                    return packet
                }
                return null
            }
            ;
            BinaryReconstructor.prototype.finishedReconstruction = function () {
                this.reconPack = null;
                this.buffers = []
            }
            ;

            function error(data) {
                return {
                    type: exports.ERROR,
                    data: "parser error"
                }
            }
        }
            , {
                "./binary": 45,
                "./is-buffer": 47,
                "component-emitter": 9,
                debug: 10,
                isarray: 48,
                json3: 49
            }],
        47: [function (_dereq_, module, exports) {
            (function (global) {
                    module.exports = isBuf;

                    function isBuf(obj) {
                        return global.Buffer && global.Buffer.isBuffer(obj) || global.ArrayBuffer && obj instanceof ArrayBuffer
                    }
                }
            ).call(this, typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
        }
            , {}],
        48: [function (_dereq_, module, exports) {
            module.exports = _dereq_(32)
        }
            , {}],
        49: [function (_dereq_, module, exports) {
            (function (window) {
                    var getClass = {}.toString, isProperty, forEach, undef;
                    var isLoader = typeof define === "function" && define.amd;
                    var nativeJSON = typeof JSON == "object" && JSON;
                    var JSON3 = typeof exports == "object" && exports && !exports.nodeType && exports;
                    if (JSON3 && nativeJSON) {
                        JSON3.stringify = nativeJSON.stringify;
                        JSON3.parse = nativeJSON.parse
                    } else {
                        JSON3 = window.JSON = nativeJSON || {}
                    }
                    var isExtended = new Date(-0xc782b5b800cec);
                    try {
                        isExtended = isExtended.getUTCFullYear() == -109252 && isExtended.getUTCMonth() === 0 && isExtended.getUTCDate() === 1 && isExtended.getUTCHours() == 10 && isExtended.getUTCMinutes() == 37 && isExtended.getUTCSeconds() == 6 && isExtended.getUTCMilliseconds() == 708
                    } catch (exception) {
                    }

                    function has(name) {
                        if (has[name] !== undef) {
                            return has[name]
                        }
                        var isSupported;
                        if (name == "bug-string-char-index") {
                            isSupported = "a"[0] != "a"
                        } else if (name == "json") {
                            isSupported = has("json-stringify") && has("json-parse")
                        } else {
                            var value, serialized = '{"a":[1,true,false,null,"\\u0000\\b\\n\\f\\r\\t"]}';
                            if (name == "json-stringify") {
                                var stringify = JSON3.stringify
                                    , stringifySupported = typeof stringify == "function" && isExtended;
                                if (stringifySupported) {
                                    (value = function () {
                                            return 1
                                        }
                                    ).toJSON = value;
                                    try {
                                        stringifySupported = stringify(0) === "0" && stringify(new Number) === "0" && stringify(new String) == '""' && stringify(getClass) === undef && stringify(undef) === undef && stringify() === undef && stringify(value) === "1" && stringify([value]) == "[1]" && stringify([undef]) == "[null]" && stringify(null) == "null" && stringify([undef, getClass, null]) == "[null,null,null]" && stringify({
                                            a: [value, true, false, null, "\0\b\n\f\r\t"]
                                        }) == serialized && stringify(null, value) === "1" && stringify([1, 2], null, 1) == "[\n 1,\n 2\n]" && stringify(new Date(-864e13)) == '"-271821-04-20T00:00:00.000Z"' && stringify(new Date(864e13)) == '"+275760-09-13T00:00:00.000Z"' && stringify(new Date(-621987552e5)) == '"-000001-01-01T00:00:00.000Z"' && stringify(new Date(-1)) == '"1969-12-31T23:59:59.999Z"'
                                    } catch (exception) {
                                        stringifySupported = false
                                    }
                                }
                                isSupported = stringifySupported
                            }
                            if (name == "json-parse") {
                                var parse = JSON3.parse;
                                if (typeof parse == "function") {
                                    try {
                                        if (parse("0") === 0 && !parse(false)) {
                                            value = parse(serialized);
                                            var parseSupported = value["a"].length == 5 && value["a"][0] === 1;
                                            if (parseSupported) {
                                                try {
                                                    parseSupported = !parse('"\t"')
                                                } catch (exception) {
                                                }
                                                if (parseSupported) {
                                                    try {
                                                        parseSupported = parse("01") !== 1
                                                    } catch (exception) {
                                                    }
                                                }
                                                if (parseSupported) {
                                                    try {
                                                        parseSupported = parse("1.") !== 1
                                                    } catch (exception) {
                                                    }
                                                }
                                            }
                                        }
                                    } catch (exception) {
                                        parseSupported = false
                                    }
                                }
                                isSupported = parseSupported
                            }
                        }
                        return has[name] = !!isSupported
                    }

                    if (!has("json")) {
                        var functionClass = "[object Function]";
                        var dateClass = "[object Date]";
                        var numberClass = "[object Number]";
                        var stringClass = "[object String]";
                        var arrayClass = "[object Array]";
                        var booleanClass = "[object Boolean]";
                        var charIndexBuggy = has("bug-string-char-index");
                        if (!isExtended) {
                            var floor = Math.floor;
                            var Months = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
                            var getDay = function (year, month) {
                                return Months[month] + 365 * (year - 1970) + floor((year - 1969 + (month = +(month > 1))) / 4) - floor((year - 1901 + month) / 100) + floor((year - 1601 + month) / 400)
                            }
                        }
                        if (!(isProperty = {}.hasOwnProperty)) {
                            isProperty = function (property) {
                                var members = {}, constructor;
                                if ((members.__proto__ = null,
                                    members.__proto__ = {
                                        toString: 1
                                    },
                                    members).toString != getClass) {
                                    isProperty = function (property) {
                                        var original = this.__proto__
                                            , result = property in (this.__proto__ = null,
                                            this);
                                        this.__proto__ = original;
                                        return result
                                    }
                                } else {
                                    constructor = members.constructor;
                                    isProperty = function (property) {
                                        var parent = (this.constructor || constructor).prototype;
                                        return property in this && !(property in parent && this[property] === parent[property])
                                    }
                                }
                                members = null;
                                return isProperty.call(this, property)
                            }
                        }
                        var PrimitiveTypes = {
                            boolean: 1,
                            number: 1,
                            string: 1,
                            undefined: 1
                        };
                        var isHostType = function (object, property) {
                            var type = typeof object[property];
                            return type == "object" ? !!object[property] : !PrimitiveTypes[type]
                        };
                        forEach = function (object, callback) {
                            var size = 0, Properties, members, property;
                            (Properties = function () {
                                    this.valueOf = 0
                                }
                            ).prototype.valueOf = 0;
                            members = new Properties;
                            for (property in members) {
                                if (isProperty.call(members, property)) {
                                    size++
                                }
                            }
                            Properties = members = null;
                            if (!size) {
                                members = ["valueOf", "toString", "toLocaleString", "propertyIsEnumerable", "isPrototypeOf", "hasOwnProperty", "constructor"];
                                forEach = function (object, callback) {
                                    var isFunction = getClass.call(object) == functionClass, property, length;
                                    var hasProperty = !isFunction && typeof object.constructor != "function" && isHostType(object, "hasOwnProperty") ? object.hasOwnProperty : isProperty;
                                    for (property in object) {
                                        if (!(isFunction && property == "prototype") && hasProperty.call(object, property)) {
                                            callback(property)
                                        }
                                    }
                                    for (length = members.length; property = members[--length]; hasProperty.call(object, property) && callback(property))
                                        ;
                                }
                            } else if (size == 2) {
                                forEach = function (object, callback) {
                                    var members = {}, isFunction = getClass.call(object) == functionClass, property;
                                    for (property in object) {
                                        if (!(isFunction && property == "prototype") && !isProperty.call(members, property) && (members[property] = 1) && isProperty.call(object, property)) {
                                            callback(property)
                                        }
                                    }
                                }
                            } else {
                                forEach = function (object, callback) {
                                    var isFunction = getClass.call(object) == functionClass, property, isConstructor;
                                    for (property in object) {
                                        if (!(isFunction && property == "prototype") && isProperty.call(object, property) && !(isConstructor = property === "constructor")) {
                                            callback(property)
                                        }
                                    }
                                    if (isConstructor || isProperty.call(object, property = "constructor")) {
                                        callback(property)
                                    }
                                }
                            }
                            return forEach(object, callback)
                        }
                        ;
                        if (!has("json-stringify")) {
                            var Escapes = {
                                92: "\\\\",
                                34: '\\"',
                                8: "\\b",
                                12: "\\f",
                                10: "\\n",
                                13: "\\r",
                                9: "\\t"
                            };
                            var leadingZeroes = "000000";
                            var toPaddedString = function (width, value) {
                                return (leadingZeroes + (value || 0)).slice(-width)
                            };
                            var unicodePrefix = "\\u00";
                            var quote = function (value) {
                                var result = '"', index = 0, length = value.length,
                                    isLarge = length > 10 && charIndexBuggy, symbols;
                                if (isLarge) {
                                    symbols = value.split("")
                                }
                                for (; index < length; index++) {
                                    var charCode = value.charCodeAt(index);
                                    switch (charCode) {
                                        case 8:
                                        case 9:
                                        case 10:
                                        case 12:
                                        case 13:
                                        case 34:
                                        case 92:
                                            result += Escapes[charCode];
                                            break;
                                        default:
                                            if (charCode < 32) {
                                                result += unicodePrefix + toPaddedString(2, charCode.toString(16));
                                                break
                                            }
                                            result += isLarge ? symbols[index] : charIndexBuggy ? value.charAt(index) : value[index]
                                    }
                                }
                                return result + '"'
                            };
                            var serialize = function (property, object, callback, properties, whitespace, indentation, stack) {
                                var value, className, year, month, date, time, hours, minutes, seconds, milliseconds,
                                    results, element, index, length, prefix, result;
                                try {
                                    value = object[property]
                                } catch (exception) {
                                }
                                if (typeof value == "object" && value) {
                                    className = getClass.call(value);
                                    if (className == dateClass && !isProperty.call(value, "toJSON")) {
                                        if (value > -1 / 0 && value < 1 / 0) {
                                            if (getDay) {
                                                date = floor(value / 864e5);
                                                for (year = floor(date / 365.2425) + 1970 - 1; getDay(year + 1, 0) <= date; year++)
                                                    ;
                                                for (month = floor((date - getDay(year, 0)) / 30.42); getDay(year, month + 1) <= date; month++)
                                                    ;
                                                date = 1 + date - getDay(year, month);
                                                time = (value % 864e5 + 864e5) % 864e5;
                                                hours = floor(time / 36e5) % 24;
                                                minutes = floor(time / 6e4) % 60;
                                                seconds = floor(time / 1e3) % 60;
                                                milliseconds = time % 1e3
                                            } else {
                                                year = value.getUTCFullYear();
                                                month = value.getUTCMonth();
                                                date = value.getUTCDate();
                                                hours = value.getUTCHours();
                                                minutes = value.getUTCMinutes();
                                                seconds = value.getUTCSeconds();
                                                milliseconds = value.getUTCMilliseconds()
                                            }
                                            value = (year <= 0 || year >= 1e4 ? (year < 0 ? "-" : "+") + toPaddedString(6, year < 0 ? -year : year) : toPaddedString(4, year)) + "-" + toPaddedString(2, month + 1) + "-" + toPaddedString(2, date) + "T" + toPaddedString(2, hours) + ":" + toPaddedString(2, minutes) + ":" + toPaddedString(2, seconds) + "." + toPaddedString(3, milliseconds) + "Z"
                                        } else {
                                            value = null
                                        }
                                    } else if (typeof value.toJSON == "function" && (className != numberClass && className != stringClass && className != arrayClass || isProperty.call(value, "toJSON"))) {
                                        value = value.toJSON(property)
                                    }
                                }
                                if (callback) {
                                    value = callback.call(object, property, value)
                                }
                                if (value === null) {
                                    return "null"
                                }
                                className = getClass.call(value);
                                if (className == booleanClass) {
                                    return "" + value
                                } else if (className == numberClass) {
                                    return value > -1 / 0 && value < 1 / 0 ? "" + value : "null"
                                } else if (className == stringClass) {
                                    return quote("" + value)
                                }
                                if (typeof value == "object") {
                                    for (length = stack.length; length--;) {
                                        if (stack[length] === value) {
                                            throw TypeError()
                                        }
                                    }
                                    stack.push(value);
                                    results = [];
                                    prefix = indentation;
                                    indentation += whitespace;
                                    if (className == arrayClass) {
                                        for (index = 0,
                                                 length = value.length; index < length; index++) {
                                            element = serialize(index, value, callback, properties, whitespace, indentation, stack);
                                            results.push(element === undef ? "null" : element)
                                        }
                                        result = results.length ? whitespace ? "[\n" + indentation + results.join(",\n" + indentation) + "\n" + prefix + "]" : "[" + results.join(",") + "]" : "[]"
                                    } else {
                                        forEach(properties || value, function (property) {
                                            var element = serialize(property, value, callback, properties, whitespace, indentation, stack);
                                            if (element !== undef) {
                                                results.push(quote(property) + ":" + (whitespace ? " " : "") + element)
                                            }
                                        });
                                        result = results.length ? whitespace ? "{\n" + indentation + results.join(",\n" + indentation) + "\n" + prefix + "}" : "{" + results.join(",") + "}" : "{}"
                                    }
                                    stack.pop();
                                    return result
                                }
                            };
                            JSON3.stringify = function (source, filter, width) {
                                var whitespace, callback, properties, className;
                                if (typeof filter == "function" || typeof filter == "object" && filter) {
                                    if ((className = getClass.call(filter)) == functionClass) {
                                        callback = filter
                                    } else if (className == arrayClass) {
                                        properties = {};
                                        for (var index = 0, length = filter.length, value; index < length; value = filter[index++],
                                        (className = getClass.call(value),
                                        className == stringClass || className == numberClass) && (properties[value] = 1))
                                            ;
                                    }
                                }
                                if (width) {
                                    if ((className = getClass.call(width)) == numberClass) {
                                        if ((width -= width % 1) > 0) {
                                            for (whitespace = "",
                                                 width > 10 && (width = 10); whitespace.length < width; whitespace += " ")
                                                ;
                                        }
                                    } else if (className == stringClass) {
                                        whitespace = width.length <= 10 ? width : width.slice(0, 10)
                                    }
                                }
                                return serialize("", (value = {},
                                    value[""] = source,
                                    value), callback, properties, whitespace, "", [])
                            }
                        }
                        if (!has("json-parse")) {
                            var fromCharCode = String.fromCharCode;
                            var Unescapes = {
                                92: "\\",
                                34: '"',
                                47: "/",
                                98: "\b",
                                116: "\t",
                                110: "\n",
                                102: "\f",
                                114: "\r"
                            };
                            var Index, Source;
                            var abort = function () {
                                Index = Source = null;
                                throw SyntaxError()
                            };
                            var lex = function () {
                                var source = Source, length = source.length, value, begin, position, isSigned, charCode;
                                while (Index < length) {
                                    charCode = source.charCodeAt(Index);
                                    switch (charCode) {
                                        case 9:
                                        case 10:
                                        case 13:
                                        case 32:
                                            Index++;
                                            break;
                                        case 123:
                                        case 125:
                                        case 91:
                                        case 93:
                                        case 58:
                                        case 44:
                                            value = charIndexBuggy ? source.charAt(Index) : source[Index];
                                            Index++;
                                            return value;
                                        case 34:
                                            for (value = "@",
                                                     Index++; Index < length;) {
                                                charCode = source.charCodeAt(Index);
                                                if (charCode < 32) {
                                                    abort()
                                                } else if (charCode == 92) {
                                                    charCode = source.charCodeAt(++Index);
                                                    switch (charCode) {
                                                        case 92:
                                                        case 34:
                                                        case 47:
                                                        case 98:
                                                        case 116:
                                                        case 110:
                                                        case 102:
                                                        case 114:
                                                            value += Unescapes[charCode];
                                                            Index++;
                                                            break;
                                                        case 117:
                                                            begin = ++Index;
                                                            for (position = Index + 4; Index < position; Index++) {
                                                                charCode = source.charCodeAt(Index);
                                                                if (!(charCode >= 48 && charCode <= 57 || charCode >= 97 && charCode <= 102 || charCode >= 65 && charCode <= 70)) {
                                                                    abort()
                                                                }
                                                            }
                                                            value += fromCharCode("0x" + source.slice(begin, Index));
                                                            break;
                                                        default:
                                                            abort()
                                                    }
                                                } else {
                                                    if (charCode == 34) {
                                                        break
                                                    }
                                                    charCode = source.charCodeAt(Index);
                                                    begin = Index;
                                                    while (charCode >= 32 && charCode != 92 && charCode != 34) {
                                                        charCode = source.charCodeAt(++Index)
                                                    }
                                                    value += source.slice(begin, Index)
                                                }
                                            }
                                            if (source.charCodeAt(Index) == 34) {
                                                Index++;
                                                return value
                                            }
                                            abort();
                                        default:
                                            begin = Index;
                                            if (charCode == 45) {
                                                isSigned = true;
                                                charCode = source.charCodeAt(++Index)
                                            }
                                            if (charCode >= 48 && charCode <= 57) {
                                                if (charCode == 48 && (charCode = source.charCodeAt(Index + 1),
                                                charCode >= 48 && charCode <= 57)) {
                                                    abort()
                                                }
                                                isSigned = false;
                                                for (; Index < length && (charCode = source.charCodeAt(Index),
                                                charCode >= 48 && charCode <= 57); Index++)
                                                    ;
                                                if (source.charCodeAt(Index) == 46) {
                                                    position = ++Index;
                                                    for (; position < length && (charCode = source.charCodeAt(position),
                                                    charCode >= 48 && charCode <= 57); position++)
                                                        ;
                                                    if (position == Index) {
                                                        abort()
                                                    }
                                                    Index = position
                                                }
                                                charCode = source.charCodeAt(Index);
                                                if (charCode == 101 || charCode == 69) {
                                                    charCode = source.charCodeAt(++Index);
                                                    if (charCode == 43 || charCode == 45) {
                                                        Index++
                                                    }
                                                    for (position = Index; position < length && (charCode = source.charCodeAt(position),
                                                    charCode >= 48 && charCode <= 57); position++)
                                                        ;
                                                    if (position == Index) {
                                                        abort()
                                                    }
                                                    Index = position
                                                }
                                                return +source.slice(begin, Index)
                                            }
                                            if (isSigned) {
                                                abort()
                                            }
                                            if (source.slice(Index, Index + 4) == "true") {
                                                Index += 4;
                                                return true
                                            } else if (source.slice(Index, Index + 5) == "false") {
                                                Index += 5;
                                                return false
                                            } else if (source.slice(Index, Index + 4) == "null") {
                                                Index += 4;
                                                return null
                                            }
                                            abort()
                                    }
                                }
                                return "$"
                            };
                            var get = function (value) {
                                var results, hasMembers;
                                if (value == "$") {
                                    abort()
                                }
                                if (typeof value == "string") {
                                    if ((charIndexBuggy ? value.charAt(0) : value[0]) == "@") {
                                        return value.slice(1)
                                    }
                                    if (value == "[") {
                                        results = [];
                                        for (; ; hasMembers || (hasMembers = true)) {
                                            value = lex();
                                            if (value == "]") {
                                                break
                                            }
                                            if (hasMembers) {
                                                if (value == ",") {
                                                    value = lex();
                                                    if (value == "]") {
                                                        abort()
                                                    }
                                                } else {
                                                    abort()
                                                }
                                            }
                                            if (value == ",") {
                                                abort()
                                            }
                                            results.push(get(value))
                                        }
                                        return results
                                    } else if (value == "{") {
                                        results = {};
                                        for (; ; hasMembers || (hasMembers = true)) {
                                            value = lex();
                                            if (value == "}") {
                                                break
                                            }
                                            if (hasMembers) {
                                                if (value == ",") {
                                                    value = lex();
                                                    if (value == "}") {
                                                        abort()
                                                    }
                                                } else {
                                                    abort()
                                                }
                                            }
                                            if (value == "," || typeof value != "string" || (charIndexBuggy ? value.charAt(0) : value[0]) != "@" || lex() != ":") {
                                                abort()
                                            }
                                            results[value.slice(1)] = get(lex())
                                        }
                                        return results
                                    }
                                    abort()
                                }
                                return value
                            };
                            var update = function (source, property, callback) {
                                var element = walk(source, property, callback);
                                if (element === undef) {
                                    delete source[property]
                                } else {
                                    source[property] = element
                                }
                            };
                            var walk = function (source, property, callback) {
                                var value = source[property], length;
                                if (typeof value == "object" && value) {
                                    if (getClass.call(value) == arrayClass) {
                                        for (length = value.length; length--;) {
                                            update(value, length, callback)
                                        }
                                    } else {
                                        forEach(value, function (property) {
                                            update(value, property, callback)
                                        })
                                    }
                                }
                                return callback.call(source, property, value)
                            };
                            JSON3.parse = function (source, callback) {
                                var result, value;
                                Index = 0;
                                Source = "" + source;
                                result = get(lex());
                                if (lex() != "$") {
                                    abort()
                                }
                                Index = Source = null;
                                return callback && getClass.call(callback) == functionClass ? walk((value = {},
                                    value[""] = result,
                                    value), "", callback) : result
                            }
                        }
                    }
                    if (isLoader) {
                        define(function () {
                            return JSON3
                        })
                    }
                }
            )(this)
        }
            , {}],
        50: [function (_dereq_, module, exports) {
            module.exports = toArray;

            function toArray(list, index) {
                var array = [];
                index = index || 0;
                for (var i = index || 0; i < list.length; i++) {
                    array[i - index] = list[i]
                }
                return array
            }
        }
            , {}]
    }, {}, [1])(1)
});
!function (a, b, c, d) {
    "use strict";

    function e(a, b, c) {
        return setTimeout(k(a, c), b)
    }

    function f(a, b, c) {
        return Array.isArray(a) ? (g(a, c[b], c),
            !0) : !1
    }

    function g(a, b, c) {
        var e;
        if (a)
            if (a.forEach)
                a.forEach(b, c);
            else if (a.length !== d)
                for (e = 0; e < a.length;)
                    b.call(c, a[e], e, a),
                        e++;
            else
                for (e in a)
                    a.hasOwnProperty(e) && b.call(c, a[e], e, a)
    }

    function h(a, b, c) {
        for (var e = Object.keys(b), f = 0; f < e.length;)
            (!c || c && a[e[f]] === d) && (a[e[f]] = b[e[f]]),
                f++;
        return a
    }

    function i(a, b) {
        return h(a, b, !0)
    }

    function j(a, b, c) {
        var d, e = b.prototype;
        d = a.prototype = Object.create(e),
            d.constructor = a,
            d._super = e,
        c && h(d, c)
    }

    function k(a, b) {
        return function () {
            return a.apply(b, arguments)
        }
    }

    function l(a, b) {
        return typeof a == kb ? a.apply(b ? b[0] || d : d, b) : a
    }

    function m(a, b) {
        return a === d ? b : a
    }

    function n(a, b, c) {
        g(r(b), function (b) {
            a.addEventListener(b, c, !1)
        })
    }

    function o(a, b, c) {
        g(r(b), function (b) {
            a.removeEventListener(b, c, !1)
        })
    }

    function p(a, b) {
        for (; a;) {
            if (a == b)
                return !0;
            a = a.parentNode
        }
        return !1
    }

    function q(a, b) {
        return a.indexOf(b) > -1
    }

    function r(a) {
        return a.trim().split(/\s+/g)
    }

    function s(a, b, c) {
        if (a.indexOf && !c)
            return a.indexOf(b);
        for (var d = 0; d < a.length;) {
            if (c && a[d][c] == b || !c && a[d] === b)
                return d;
            d++
        }
        return -1
    }

    function t(a) {
        return Array.prototype.slice.call(a, 0)
    }

    function u(a, b, c) {
        for (var d = [], e = [], f = 0; f < a.length;) {
            var g = b ? a[f][b] : a[f];
            s(e, g) < 0 && d.push(a[f]),
                e[f] = g,
                f++
        }
        return c && (d = b ? d.sort(function (a, c) {
            return a[b] > c[b]
        }) : d.sort()),
            d
    }

    function v(a, b) {
        for (var c, e, f = b[0].toUpperCase() + b.slice(1), g = 0; g < ib.length;) {
            if (c = ib[g],
                e = c ? c + f : b,
            e in a)
                return e;
            g++
        }
        return d
    }

    function w() {
        return ob++
    }

    function x(a) {
        var b = a.ownerDocument;
        return b.defaultView || b.parentWindow
    }

    function y(a, b) {
        var c = this;
        this.manager = a,
            this.callback = b,
            this.element = a.element,
            this.target = a.options.inputTarget,
            this.domHandler = function (b) {
                l(a.options.enable, [a]) && c.handler(b)
            }
            ,
            this.init()
    }

    function z(a) {
        var b, c = a.options.inputClass;
        return new (b = c ? c : rb ? N : sb ? Q : qb ? S : M)(a, A)
    }

    function A(a, b, c) {
        var d = c.pointers.length
            , e = c.changedPointers.length
            , f = b & yb && d - e === 0
            , g = b & (Ab | Bb) && d - e === 0;
        c.isFirst = !!f,
            c.isFinal = !!g,
        f && (a.session = {}),
            c.eventType = b,
            B(a, c),
            a.emit("hammer.input", c),
            a.recognize(c),
            a.session.prevInput = c
    }

    function B(a, b) {
        var c = a.session
            , d = b.pointers
            , e = d.length;
        c.firstInput || (c.firstInput = E(b)),
            e > 1 && !c.firstMultiple ? c.firstMultiple = E(b) : 1 === e && (c.firstMultiple = !1);
        var f = c.firstInput
            , g = c.firstMultiple
            , h = g ? g.center : f.center
            , i = b.center = F(d);
        b.timeStamp = nb(),
            b.deltaTime = b.timeStamp - f.timeStamp,
            b.angle = J(h, i),
            b.distance = I(h, i),
            C(c, b),
            b.offsetDirection = H(b.deltaX, b.deltaY),
            b.scale = g ? L(g.pointers, d) : 1,
            b.rotation = g ? K(g.pointers, d) : 0,
            D(c, b);
        var j = a.element;
        p(b.srcEvent.target, j) && (j = b.srcEvent.target),
            b.target = j
    }

    function C(a, b) {
        var c = b.center
            , d = a.offsetDelta || {}
            , e = a.prevDelta || {}
            , f = a.prevInput || {};
        (b.eventType === yb || f.eventType === Ab) && (e = a.prevDelta = {
            x: f.deltaX || 0,
            y: f.deltaY || 0
        },
            d = a.offsetDelta = {
                x: c.x,
                y: c.y
            }),
            b.deltaX = e.x + (c.x - d.x),
            b.deltaY = e.y + (c.y - d.y)
    }

    function D(a, b) {
        var c, e, f, g, h = a.lastInterval || b, i = b.timeStamp - h.timeStamp;
        if (b.eventType != Bb && (i > xb || h.velocity === d)) {
            var j = h.deltaX - b.deltaX
                , k = h.deltaY - b.deltaY
                , l = G(i, j, k);
            e = l.x,
                f = l.y,
                c = mb(l.x) > mb(l.y) ? l.x : l.y,
                g = H(j, k),
                a.lastInterval = b
        } else
            c = h.velocity,
                e = h.velocityX,
                f = h.velocityY,
                g = h.direction;
        b.velocity = c,
            b.velocityX = e,
            b.velocityY = f,
            b.direction = g
    }

    function E(a) {
        for (var b = [], c = 0; c < a.pointers.length;)
            b[c] = {
                clientX: lb(a.pointers[c].clientX),
                clientY: lb(a.pointers[c].clientY)
            },
                c++;
        return {
            timeStamp: nb(),
            pointers: b,
            center: F(b),
            deltaX: a.deltaX,
            deltaY: a.deltaY
        }
    }

    function F(a) {
        var b = a.length;
        if (1 === b)
            return {
                x: lb(a[0].clientX),
                y: lb(a[0].clientY)
            };
        for (var c = 0, d = 0, e = 0; b > e;)
            c += a[e].clientX,
                d += a[e].clientY,
                e++;
        return {
            x: lb(c / b),
            y: lb(d / b)
        }
    }

    function G(a, b, c) {
        return {
            x: b / a || 0,
            y: c / a || 0
        }
    }

    function H(a, b) {
        return a === b ? Cb : mb(a) >= mb(b) ? a > 0 ? Db : Eb : b > 0 ? Fb : Gb
    }

    function I(a, b, c) {
        c || (c = Kb);
        var d = b[c[0]] - a[c[0]]
            , e = b[c[1]] - a[c[1]];
        return Math.sqrt(d * d + e * e)
    }

    function J(a, b, c) {
        c || (c = Kb);
        var d = b[c[0]] - a[c[0]]
            , e = b[c[1]] - a[c[1]];
        return 180 * Math.atan2(e, d) / Math.PI
    }

    function K(a, b) {
        return J(b[1], b[0], Lb) - J(a[1], a[0], Lb)
    }

    function L(a, b) {
        return I(b[0], b[1], Lb) / I(a[0], a[1], Lb)
    }

    function M() {
        this.evEl = Nb,
            this.evWin = Ob,
            this.allow = !0,
            this.pressed = !1,
            y.apply(this, arguments)
    }

    function N() {
        this.evEl = Rb,
            this.evWin = Sb,
            y.apply(this, arguments),
            this.store = this.manager.session.pointerEvents = []
    }

    function O() {
        this.evTarget = Ub,
            this.evWin = Vb,
            this.started = !1,
            y.apply(this, arguments)
    }

    function P(a, b) {
        var c = t(a.touches)
            , d = t(a.changedTouches);
        return b & (Ab | Bb) && (c = u(c.concat(d), "identifier", !0)),
            [c, d]
    }

    function Q() {
        this.evTarget = Xb,
            this.targetIds = {},
            y.apply(this, arguments)
    }

    function R(a, b) {
        var c = t(a.touches)
            , d = this.targetIds;
        if (b & (yb | zb) && 1 === c.length)
            return d[c[0].identifier] = !0,
                [c, c];
        var e, f, g = t(a.changedTouches), h = [], i = this.target;
        if (f = c.filter(function (a) {
            return p(a.target, i)
        }),
        b === yb)
            for (e = 0; e < f.length;)
                d[f[e].identifier] = !0,
                    e++;
        for (e = 0; e < g.length;)
            d[g[e].identifier] && h.push(g[e]),
            b & (Ab | Bb) && delete d[g[e].identifier],
                e++;
        return h.length ? [u(f.concat(h), "identifier", !0), h] : void 0
    }

    function S() {
        y.apply(this, arguments);
        var a = k(this.handler, this);
        this.touch = new Q(this.manager, a),
            this.mouse = new M(this.manager, a)
    }

    function T(a, b) {
        this.manager = a,
            this.set(b)
    }

    function U(a) {
        if (q(a, bc))
            return bc;
        var b = q(a, cc)
            , c = q(a, dc);
        return b && c ? cc + " " + dc : b || c ? b ? cc : dc : q(a, ac) ? ac : _b
    }

    function V(a) {
        this.id = w(),
            this.manager = null,
            this.options = i(a || {}, this.defaults),
            this.options.enable = m(this.options.enable, !0),
            this.state = ec,
            this.simultaneous = {},
            this.requireFail = []
    }

    function W(a) {
        return a & jc ? "cancel" : a & hc ? "end" : a & gc ? "move" : a & fc ? "start" : ""
    }

    function X(a) {
        return a == Gb ? "down" : a == Fb ? "up" : a == Db ? "left" : a == Eb ? "right" : ""
    }

    function Y(a, b) {
        var c = b.manager;
        return c ? c.get(a) : a
    }

    function Z() {
        V.apply(this, arguments)
    }

    function $() {
        Z.apply(this, arguments),
            this.pX = null,
            this.pY = null
    }

    function _() {
        Z.apply(this, arguments)
    }

    function ab() {
        V.apply(this, arguments),
            this._timer = null,
            this._input = null
    }

    function bb() {
        Z.apply(this, arguments)
    }

    function cb() {
        Z.apply(this, arguments)
    }

    function db() {
        V.apply(this, arguments),
            this.pTime = !1,
            this.pCenter = !1,
            this._timer = null,
            this._input = null,
            this.count = 0
    }

    function eb(a, b) {
        return b = b || {},
            b.recognizers = m(b.recognizers, eb.defaults.preset),
            new fb(a, b)
    }

    function fb(a, b) {
        b = b || {},
            this.options = i(b, eb.defaults),
            this.options.inputTarget = this.options.inputTarget || a,
            this.handlers = {},
            this.session = {},
            this.recognizers = [],
            this.element = a,
            this.input = z(this),
            this.touchAction = new T(this, this.options.touchAction),
            gb(this, !0),
            g(b.recognizers, function (a) {
                var b = this.add(new a[0](a[1]));
                a[2] && b.recognizeWith(a[2]),
                a[3] && b.requireFailure(a[3])
            }, this)
    }

    function gb(a, b) {
        var c = a.element;
        g(a.options.cssProps, function (a, d) {
            c.style[v(c.style, d)] = b ? a : ""
        })
    }

    function hb(a, c) {
        var d = b.createEvent("Event");
        d.initEvent(a, !0, !0),
            d.gesture = c,
            c.target.dispatchEvent(d)
    }

    var ib = ["", "webkit", "moz", "MS", "ms", "o"]
        , jb = b.createElement("div")
        , kb = "function"
        , lb = Math.round
        , mb = Math.abs
        , nb = Date.now
        , ob = 1
        , pb = /mobile|tablet|ip(ad|hone|od)|android/i
        , qb = "ontouchstart" in a
        , rb = v(a, "PointerEvent") !== d
        , sb = qb && pb.test(navigator.userAgent)
        , tb = "touch"
        , ub = "pen"
        , vb = "mouse"
        , wb = "kinect"
        , xb = 25
        , yb = 1
        , zb = 2
        , Ab = 4
        , Bb = 8
        , Cb = 1
        , Db = 2
        , Eb = 4
        , Fb = 8
        , Gb = 16
        , Hb = Db | Eb
        , Ib = Fb | Gb
        , Jb = Hb | Ib
        , Kb = ["x", "y"]
        , Lb = ["clientX", "clientY"];
    y.prototype = {
        handler: function () {
        },
        init: function () {
            this.evEl && n(this.element, this.evEl, this.domHandler),
            this.evTarget && n(this.target, this.evTarget, this.domHandler),
            this.evWin && n(x(this.element), this.evWin, this.domHandler)
        },
        destroy: function () {
            this.evEl && o(this.element, this.evEl, this.domHandler),
            this.evTarget && o(this.target, this.evTarget, this.domHandler),
            this.evWin && o(x(this.element), this.evWin, this.domHandler)
        }
    };
    var Mb = {
        mousedown: yb,
        mousemove: zb,
        mouseup: Ab
    }
        , Nb = "mousedown"
        , Ob = "mousemove mouseup";
    j(M, y, {
        handler: function (a) {
            var b = Mb[a.type];
            b & yb && 0 === a.button && (this.pressed = !0),
            b & zb && 1 !== a.which && (b = Ab),
            this.pressed && this.allow && (b & Ab && (this.pressed = !1),
                this.callback(this.manager, b, {
                    pointers: [a],
                    changedPointers: [a],
                    pointerType: vb,
                    srcEvent: a
                }))
        }
    });
    var Pb = {
        pointerdown: yb,
        pointermove: zb,
        pointerup: Ab,
        pointercancel: Bb,
        pointerout: Bb
    }
        , Qb = {
        2: tb,
        3: ub,
        4: vb,
        5: wb
    }
        , Rb = "pointerdown"
        , Sb = "pointermove pointerup pointercancel";
    a.MSPointerEvent && (Rb = "MSPointerDown",
        Sb = "MSPointerMove MSPointerUp MSPointerCancel"),
        j(N, y, {
            handler: function (a) {
                var b = this.store
                    , c = !1
                    , d = a.type.toLowerCase().replace("ms", "")
                    , e = Pb[d]
                    , f = Qb[a.pointerType] || a.pointerType
                    , g = f == tb
                    , h = s(b, a.pointerId, "pointerId");
                e & yb && (0 === a.button || g) ? 0 > h && (b.push(a),
                    h = b.length - 1) : e & (Ab | Bb) && (c = !0),
                0 > h || (b[h] = a,
                    this.callback(this.manager, e, {
                        pointers: b,
                        changedPointers: [a],
                        pointerType: f,
                        srcEvent: a
                    }),
                c && b.splice(h, 1))
            }
        });
    var Tb = {
        touchstart: yb,
        touchmove: zb,
        touchend: Ab,
        touchcancel: Bb
    }
        , Ub = "touchstart"
        , Vb = "touchstart touchmove touchend touchcancel";
    j(O, y, {
        handler: function (a) {
            var b = Tb[a.type];
            if (b === yb && (this.started = !0),
                this.started) {
                var c = P.call(this, a, b);
                b & (Ab | Bb) && c[0].length - c[1].length === 0 && (this.started = !1),
                    this.callback(this.manager, b, {
                        pointers: c[0],
                        changedPointers: c[1],
                        pointerType: tb,
                        srcEvent: a
                    })
            }
        }
    });
    var Wb = {
        touchstart: yb,
        touchmove: zb,
        touchend: Ab,
        touchcancel: Bb
    }
        , Xb = "touchstart touchmove touchend touchcancel";
    j(Q, y, {
        handler: function (a) {
            var b = Wb[a.type]
                , c = R.call(this, a, b);
            c && this.callback(this.manager, b, {
                pointers: c[0],
                changedPointers: c[1],
                pointerType: tb,
                srcEvent: a
            })
        }
    }),
        j(S, y, {
            handler: function (a, b, c) {
                var d = c.pointerType == tb
                    , e = c.pointerType == vb;
                if (d)
                    this.mouse.allow = !1;
                else if (e && !this.mouse.allow)
                    return;
                b & (Ab | Bb) && (this.mouse.allow = !0),
                    this.callback(a, b, c)
            },
            destroy: function () {
                this.touch.destroy(),
                    this.mouse.destroy()
            }
        });
    var Yb = v(jb.style, "touchAction")
        , Zb = Yb !== d
        , $b = "compute"
        , _b = "auto"
        , ac = "manipulation"
        , bc = "none"
        , cc = "pan-x"
        , dc = "pan-y";
    T.prototype = {
        set: function (a) {
            a == $b && (a = this.compute()),
            Zb && (this.manager.element.style[Yb] = a),
                this.actions = a.toLowerCase().trim()
        },
        update: function () {
            this.set(this.manager.options.touchAction)
        },
        compute: function () {
            var a = [];
            return g(this.manager.recognizers, function (b) {
                l(b.options.enable, [b]) && (a = a.concat(b.getTouchAction()))
            }),
                U(a.join(" "))
        },
        preventDefaults: function (a) {
            if (!Zb) {
                var b = a.srcEvent
                    , c = a.offsetDirection;
                if (this.manager.session.prevented)
                    return void b.preventDefault();
                var d = this.actions
                    , e = q(d, bc)
                    , f = q(d, dc)
                    , g = q(d, cc);
                return e || f && c & Hb || g && c & Ib ? this.preventSrc(b) : void 0
            }
        },
        preventSrc: function (a) {
            this.manager.session.prevented = !0,
                a.preventDefault()
        }
    };
    var ec = 1
        , fc = 2
        , gc = 4
        , hc = 8
        , ic = hc
        , jc = 16
        , kc = 32;
    V.prototype = {
        defaults: {},
        set: function (a) {
            return h(this.options, a),
            this.manager && this.manager.touchAction.update(),
                this
        },
        recognizeWith: function (a) {
            if (f(a, "recognizeWith", this))
                return this;
            var b = this.simultaneous;
            return a = Y(a, this),
            b[a.id] || (b[a.id] = a,
                a.recognizeWith(this)),
                this
        },
        dropRecognizeWith: function (a) {
            return f(a, "dropRecognizeWith", this) ? this : (a = Y(a, this),
                delete this.simultaneous[a.id],
                this)
        },
        requireFailure: function (a) {
            if (f(a, "requireFailure", this))
                return this;
            var b = this.requireFail;
            return a = Y(a, this),
            -1 === s(b, a) && (b.push(a),
                a.requireFailure(this)),
                this
        },
        dropRequireFailure: function (a) {
            if (f(a, "dropRequireFailure", this))
                return this;
            a = Y(a, this);
            var b = s(this.requireFail, a);
            return b > -1 && this.requireFail.splice(b, 1),
                this
        },
        hasRequireFailures: function () {
            return this.requireFail.length > 0
        },
        canRecognizeWith: function (a) {
            return !!this.simultaneous[a.id]
        },
        emit: function (a) {
            function b(b) {
                c.manager.emit(c.options.event + (b ? W(d) : ""), a)
            }

            var c = this
                , d = this.state;
            hc > d && b(!0),
                b(),
            d >= hc && b(!0)
        },
        tryEmit: function (a) {
            return this.canEmit() ? this.emit(a) : void (this.state = kc)
        },
        canEmit: function () {
            for (var a = 0; a < this.requireFail.length;) {
                if (!(this.requireFail[a].state & (kc | ec)))
                    return !1;
                a++
            }
            return !0
        },
        recognize: function (a) {
            var b = h({}, a);
            return l(this.options.enable, [this, b]) ? (this.state & (ic | jc | kc) && (this.state = ec),
                this.state = this.process(b),
                void (this.state & (fc | gc | hc | jc) && this.tryEmit(b))) : (this.reset(),
                void (this.state = kc))
        },
        process: function () {
        },
        getTouchAction: function () {
        },
        reset: function () {
        }
    },
        j(Z, V, {
            defaults: {
                pointers: 1
            },
            attrTest: function (a) {
                var b = this.options.pointers;
                return 0 === b || a.pointers.length === b
            },
            process: function (a) {
                var b = this.state
                    , c = a.eventType
                    , d = b & (fc | gc)
                    , e = this.attrTest(a);
                return d && (c & Bb || !e) ? b | jc : d || e ? c & Ab ? b | hc : b & fc ? b | gc : fc : kc
            }
        }),
        j($, Z, {
            defaults: {
                event: "pan",
                threshold: 10,
                pointers: 1,
                direction: Jb
            },
            getTouchAction: function () {
                var a = this.options.direction
                    , b = [];
                return a & Hb && b.push(dc),
                a & Ib && b.push(cc),
                    b
            },
            directionTest: function (a) {
                var b = this.options
                    , c = !0
                    , d = a.distance
                    , e = a.direction
                    , f = a.deltaX
                    , g = a.deltaY;
                return e & b.direction || (b.direction & Hb ? (e = 0 === f ? Cb : 0 > f ? Db : Eb,
                    c = f != this.pX,
                    d = Math.abs(a.deltaX)) : (e = 0 === g ? Cb : 0 > g ? Fb : Gb,
                    c = g != this.pY,
                    d = Math.abs(a.deltaY))),
                    a.direction = e,
                c && d > b.threshold && e & b.direction
            },
            attrTest: function (a) {
                return Z.prototype.attrTest.call(this, a) && (this.state & fc || !(this.state & fc) && this.directionTest(a))
            },
            emit: function (a) {
                this.pX = a.deltaX,
                    this.pY = a.deltaY;
                var b = X(a.direction);
                b && this.manager.emit(this.options.event + b, a),
                    this._super.emit.call(this, a)
            }
        }),
        j(_, Z, {
            defaults: {
                event: "pinch",
                threshold: 0,
                pointers: 2
            },
            getTouchAction: function () {
                return [bc]
            },
            attrTest: function (a) {
                return this._super.attrTest.call(this, a) && (Math.abs(a.scale - 1) > this.options.threshold || this.state & fc)
            },
            emit: function (a) {
                if (this._super.emit.call(this, a),
                1 !== a.scale) {
                    var b = a.scale < 1 ? "in" : "out";
                    this.manager.emit(this.options.event + b, a)
                }
            }
        }),
        j(ab, V, {
            defaults: {
                event: "press",
                pointers: 1,
                time: 500,
                threshold: 5
            },
            getTouchAction: function () {
                return [_b]
            },
            process: function (a) {
                var b = this.options
                    , c = a.pointers.length === b.pointers
                    , d = a.distance < b.threshold
                    , f = a.deltaTime > b.time;
                if (this._input = a,
                !d || !c || a.eventType & (Ab | Bb) && !f)
                    this.reset();
                else if (a.eventType & yb)
                    this.reset(),
                        this._timer = e(function () {
                            this.state = ic,
                                this.tryEmit()
                        }, b.time, this);
                else if (a.eventType & Ab)
                    return ic;
                return kc
            },
            reset: function () {
                clearTimeout(this._timer)
            },
            emit: function (a) {
                this.state === ic && (a && a.eventType & Ab ? this.manager.emit(this.options.event + "up", a) : (this._input.timeStamp = nb(),
                    this.manager.emit(this.options.event, this._input)))
            }
        }),
        j(bb, Z, {
            defaults: {
                event: "rotate",
                threshold: 0,
                pointers: 2
            },
            getTouchAction: function () {
                return [bc]
            },
            attrTest: function (a) {
                return this._super.attrTest.call(this, a) && (Math.abs(a.rotation) > this.options.threshold || this.state & fc)
            }
        }),
        j(cb, Z, {
            defaults: {
                event: "swipe",
                threshold: 10,
                velocity: .65,
                direction: Hb | Ib,
                pointers: 1
            },
            getTouchAction: function () {
                return $.prototype.getTouchAction.call(this)
            },
            attrTest: function (a) {
                var b, c = this.options.direction;
                return c & (Hb | Ib) ? b = a.velocity : c & Hb ? b = a.velocityX : c & Ib && (b = a.velocityY),
                this._super.attrTest.call(this, a) && c & a.direction && a.distance > this.options.threshold && mb(b) > this.options.velocity && a.eventType & Ab
            },
            emit: function (a) {
                var b = X(a.direction);
                b && this.manager.emit(this.options.event + b, a),
                    this.manager.emit(this.options.event, a)
            }
        }),
        j(db, V, {
            defaults: {
                event: "tap",
                pointers: 1,
                taps: 1,
                interval: 300,
                time: 250,
                threshold: 2,
                posThreshold: 10
            },
            getTouchAction: function () {
                return [ac]
            },
            process: function (a) {
                var b = this.options
                    , c = a.pointers.length === b.pointers
                    , d = a.distance < b.threshold
                    , f = a.deltaTime < b.time;
                if (this.reset(),
                a.eventType & yb && 0 === this.count)
                    return this.failTimeout();
                if (d && f && c) {
                    if (a.eventType != Ab)
                        return this.failTimeout();
                    var g = this.pTime ? a.timeStamp - this.pTime < b.interval : !0
                        , h = !this.pCenter || I(this.pCenter, a.center) < b.posThreshold;
                    this.pTime = a.timeStamp,
                        this.pCenter = a.center,
                        h && g ? this.count += 1 : this.count = 1,
                        this._input = a;
                    var i = this.count % b.taps;
                    if (0 === i)
                        return this.hasRequireFailures() ? (this._timer = e(function () {
                            this.state = ic,
                                this.tryEmit()
                        }, b.interval, this),
                            fc) : ic
                }
                return kc
            },
            failTimeout: function () {
                return this._timer = e(function () {
                    this.state = kc
                }, this.options.interval, this),
                    kc
            },
            reset: function () {
                clearTimeout(this._timer)
            },
            emit: function () {
                this.state == ic && (this._input.tapCount = this.count,
                    this.manager.emit(this.options.event, this._input))
            }
        }),
        eb.VERSION = "2.0.4",
        eb.defaults = {
            domEvents: !1,
            touchAction: $b,
            enable: !0,
            inputTarget: null,
            inputClass: null,
            preset: [[bb, {
                enable: !1
            }], [_, {
                enable: !1
            }, ["rotate"]], [cb, {
                direction: Hb
            }], [$, {
                direction: Hb
            }, ["swipe"]], [db], [db, {
                event: "doubletap",
                taps: 2
            }, ["tap"]], [ab]],
            cssProps: {
                userSelect: "none",
                touchSelect: "none",
                touchCallout: "none",
                contentZooming: "none",
                userDrag: "none",
                tapHighlightColor: "rgba(0,0,0,0)"
            }
        };
    var lc = 1
        , mc = 2;
    fb.prototype = {
        set: function (a) {
            return h(this.options, a),
            a.touchAction && this.touchAction.update(),
            a.inputTarget && (this.input.destroy(),
                this.input.target = a.inputTarget,
                this.input.init()),
                this
        },
        stop: function (a) {
            this.session.stopped = a ? mc : lc
        },
        recognize: function (a) {
            var b = this.session;
            if (!b.stopped) {
                this.touchAction.preventDefaults(a);
                var c, d = this.recognizers, e = b.curRecognizer;
                (!e || e && e.state & ic) && (e = b.curRecognizer = null);
                for (var f = 0; f < d.length;)
                    c = d[f],
                        b.stopped === mc || e && c != e && !c.canRecognizeWith(e) ? c.reset() : c.recognize(a),
                    !e && c.state & (fc | gc | hc) && (e = b.curRecognizer = c),
                        f++
            }
        },
        get: function (a) {
            if (a instanceof V)
                return a;
            for (var b = this.recognizers, c = 0; c < b.length; c++)
                if (b[c].options.event == a)
                    return b[c];
            return null
        },
        add: function (a) {
            if (f(a, "add", this))
                return this;
            var b = this.get(a.options.event);
            return b && this.remove(b),
                this.recognizers.push(a),
                a.manager = this,
                this.touchAction.update(),
                a
        },
        remove: function (a) {
            if (f(a, "remove", this))
                return this;
            var b = this.recognizers;
            return a = this.get(a),
                b.splice(s(b, a), 1),
                this.touchAction.update(),
                this
        },
        on: function (a, b) {
            var c = this.handlers;
            return g(r(a), function (a) {
                c[a] = c[a] || [],
                    c[a].push(b)
            }),
                this
        },
        off: function (a, b) {
            var c = this.handlers;
            return g(r(a), function (a) {
                b ? c[a].splice(s(c[a], b), 1) : delete c[a]
            }),
                this
        },
        emit: function (a, b) {
            this.options.domEvents && hb(a, b);
            var c = this.handlers[a] && this.handlers[a].slice();
            if (c && c.length) {
                b.type = a,
                    b.preventDefault = function () {
                        b.srcEvent.preventDefault()
                    }
                ;
                for (var d = 0; d < c.length;)
                    c[d](b),
                        d++
            }
        },
        destroy: function () {
            this.element && gb(this, !1),
                this.handlers = {},
                this.session = {},
                this.input.destroy(),
                this.element = null
        }
    },
        h(eb, {
            INPUT_START: yb,
            INPUT_MOVE: zb,
            INPUT_END: Ab,
            INPUT_CANCEL: Bb,
            STATE_POSSIBLE: ec,
            STATE_BEGAN: fc,
            STATE_CHANGED: gc,
            STATE_ENDED: hc,
            STATE_RECOGNIZED: ic,
            STATE_CANCELLED: jc,
            STATE_FAILED: kc,
            DIRECTION_NONE: Cb,
            DIRECTION_LEFT: Db,
            DIRECTION_RIGHT: Eb,
            DIRECTION_UP: Fb,
            DIRECTION_DOWN: Gb,
            DIRECTION_HORIZONTAL: Hb,
            DIRECTION_VERTICAL: Ib,
            DIRECTION_ALL: Jb,
            Manager: fb,
            Input: y,
            TouchAction: T,
            TouchInput: Q,
            MouseInput: M,
            PointerEventInput: N,
            TouchMouseInput: S,
            SingleTouchInput: O,
            Recognizer: V,
            AttrRecognizer: Z,
            Tap: db,
            Pan: $,
            Swipe: cb,
            Pinch: _,
            Rotate: bb,
            Press: ab,
            on: n,
            off: o,
            each: g,
            merge: i,
            extend: h,
            inherit: j,
            bindFn: k,
            prefixed: v
        }),
        typeof define == kb && define.amd ? define(function () {
            return eb
        }) : "undefined" != typeof module && module.exports ? module.exports = eb : a[c] = eb
}(window, document, "Hammer");
(function () {
        var root = this;
        var PIXI = PIXI || {};
        PIXI.WEBGL_RENDERER = 0;
        PIXI.CANVAS_RENDERER = 1;
        PIXI.VERSION = "v2.2.0";
        PIXI.blendModes = {
            NORMAL: 0,
            ADD: 1,
            MULTIPLY: 2,
            SCREEN: 3,
            OVERLAY: 4,
            DARKEN: 5,
            LIGHTEN: 6,
            COLOR_DODGE: 7,
            COLOR_BURN: 8,
            HARD_LIGHT: 9,
            SOFT_LIGHT: 10,
            DIFFERENCE: 11,
            EXCLUSION: 12,
            HUE: 13,
            SATURATION: 14,
            COLOR: 15,
            LUMINOSITY: 16
        };
        PIXI.scaleModes = {
            DEFAULT: 0,
            LINEAR: 0,
            NEAREST: 1
        };
        PIXI._UID = 0;
        if (typeof Float32Array != "undefined") {
            PIXI.Float32Array = Float32Array;
            PIXI.Uint16Array = Uint16Array;
            PIXI.Uint32Array = Uint32Array;
            PIXI.ArrayBuffer = ArrayBuffer
        } else {
            PIXI.Float32Array = Array;
            PIXI.Uint16Array = Array
        }
        PIXI.INTERACTION_FREQUENCY = 30;
        PIXI.AUTO_PREVENT_DEFAULT = true;
        PIXI.PI_2 = Math.PI * 2;
        PIXI.RAD_TO_DEG = 180 / Math.PI;
        PIXI.DEG_TO_RAD = Math.PI / 180;
        PIXI.RETINA_PREFIX = "@2x";
        PIXI.dontSayHello = false;
        PIXI.defaultRenderOptions = {
            view: null,
            transparent: false,
            antialias: false,
            preserveDrawingBuffer: false,
            resolution: 1,
            clearBeforeRender: true,
            autoResize: false
        };
        PIXI.sayHello = function (type) {
            if (PIXI.dontSayHello)
                return;
            if (navigator.userAgent.toLowerCase().indexOf("chrome") > -1) {
                var args = ["%c %c %c Pixi.js " + PIXI.VERSION + " - " + type + "  %c " + " %c " + " http://www.pixijs.com/  %c %c ♥%c♥%c♥ ", "background: #ff66a5", "background: #ff66a5", "color: #ff66a5; background: #030307;", "background: #ff66a5", "background: #ffc3dc", "background: #ff66a5", "color: #ff2424; background: #fff", "color: #ff2424; background: #fff", "color: #ff2424; background: #fff"];
                console.log.apply(console, args)
            } else if (window["console"]) {
                console.log("Pixi.js " + PIXI.VERSION + " - http://www.pixijs.com/")
            }
            PIXI.dontSayHello = true
        }
        ;
        PIXI.Point = function (x, y) {
            this.x = x || 0;
            this.y = y || 0
        }
        ;
        PIXI.Point.prototype.clone = function () {
            return new PIXI.Point(this.x, this.y)
        }
        ;
        PIXI.Point.prototype.set = function (x, y) {
            this.x = x || 0;
            this.y = y || (y !== 0 ? this.x : 0)
        }
        ;
        PIXI.Point.prototype.constructor = PIXI.Point;
        PIXI.Rectangle = function (x, y, width, height) {
            this.x = x || 0;
            this.y = y || 0;
            this.width = width || 0;
            this.height = height || 0
        }
        ;
        PIXI.Rectangle.prototype.clone = function () {
            return new PIXI.Rectangle(this.x, this.y, this.width, this.height)
        }
        ;
        PIXI.Rectangle.prototype.contains = function (x, y) {
            if (this.width <= 0 || this.height <= 0)
                return false;
            var x1 = this.x;
            if (x >= x1 && x <= x1 + this.width) {
                var y1 = this.y;
                if (y >= y1 && y <= y1 + this.height) {
                    return true
                }
            }
            return false
        }
        ;
        PIXI.Rectangle.prototype.constructor = PIXI.Rectangle;
        PIXI.EmptyRectangle = new PIXI.Rectangle(0, 0, 0, 0);
        PIXI.Polygon = function (points) {
            if (!(points instanceof Array))
                points = Array.prototype.slice.call(arguments);
            if (points[0] instanceof PIXI.Point) {
                var p = [];
                for (var i = 0, il = points.length; i < il; i++) {
                    p.push(points[i].x, points[i].y)
                }
                points = p
            }
            this.closed = true;
            this.points = points
        }
        ;
        PIXI.Polygon.prototype.clone = function () {
            var points = this.points.slice();
            return new PIXI.Polygon(points)
        }
        ;
        PIXI.Polygon.prototype.contains = function (x, y) {
            var inside = false;
            var length = this.points.length / 2;
            for (var i = 0, j = length - 1; i < length; j = i++) {
                var xi = this.points[i * 2]
                    , yi = this.points[i * 2 + 1]
                    , xj = this.points[j * 2]
                    , yj = this.points[j * 2 + 1]
                    , intersect = yi > y !== yj > y && x < (xj - xi) * (y - yi) / (yj - yi) + xi;
                if (intersect)
                    inside = !inside
            }
            return inside
        }
        ;
        PIXI.Polygon.prototype.constructor = PIXI.Polygon;
        PIXI.Circle = function (x, y, radius) {
            this.x = x || 0;
            this.y = y || 0;
            this.radius = radius || 0
        }
        ;
        PIXI.Circle.prototype.clone = function () {
            return new PIXI.Circle(this.x, this.y, this.radius)
        }
        ;
        PIXI.Circle.prototype.contains = function (x, y) {
            if (this.radius <= 0)
                return false;
            var dx = this.x - x
                , dy = this.y - y
                , r2 = this.radius * this.radius;
            dx *= dx;
            dy *= dy;
            return dx + dy <= r2
        }
        ;
        PIXI.Circle.prototype.getBounds = function () {
            return new PIXI.Rectangle(this.x - this.radius, this.y - this.radius, this.radius * 2, this.radius * 2)
        }
        ;
        PIXI.Circle.prototype.constructor = PIXI.Circle;
        PIXI.Ellipse = function (x, y, width, height) {
            this.x = x || 0;
            this.y = y || 0;
            this.width = width || 0;
            this.height = height || 0
        }
        ;
        PIXI.Ellipse.prototype.clone = function () {
            return new PIXI.Ellipse(this.x, this.y, this.width, this.height)
        }
        ;
        PIXI.Ellipse.prototype.contains = function (x, y) {
            if (this.width <= 0 || this.height <= 0)
                return false;
            var normx = (x - this.x) / this.width
                , normy = (y - this.y) / this.height;
            normx *= normx;
            normy *= normy;
            return normx + normy <= 1
        }
        ;
        PIXI.Ellipse.prototype.getBounds = function () {
            return new PIXI.Rectangle(this.x - this.width, this.y - this.height, this.width, this.height)
        }
        ;
        PIXI.Ellipse.prototype.constructor = PIXI.Ellipse;
        PIXI.RoundedRectangle = function (x, y, width, height, radius) {
            this.x = x || 0;
            this.y = y || 0;
            this.width = width || 0;
            this.height = height || 0;
            this.radius = radius || 20
        }
        ;
        PIXI.RoundedRectangle.prototype.clone = function () {
            return new PIXI.RoundedRectangle(this.x, this.y, this.width, this.height, this.radius)
        }
        ;
        PIXI.RoundedRectangle.prototype.contains = function (x, y) {
            if (this.width <= 0 || this.height <= 0)
                return false;
            var x1 = this.x;
            if (x >= x1 && x <= x1 + this.width) {
                var y1 = this.y;
                if (y >= y1 && y <= y1 + this.height) {
                    return true
                }
            }
            return false
        }
        ;
        PIXI.RoundedRectangle.prototype.constructor = PIXI.RoundedRectangle;
        PIXI.Matrix = function () {
            this.a = 1;
            this.b = 0;
            this.c = 0;
            this.d = 1;
            this.tx = 0;
            this.ty = 0
        }
        ;
        PIXI.Matrix.prototype.fromArray = function (array) {
            this.a = array[0];
            this.b = array[1];
            this.c = array[3];
            this.d = array[4];
            this.tx = array[2];
            this.ty = array[5]
        }
        ;
        PIXI.Matrix.prototype.toArray = function (transpose) {
            if (!this.array)
                this.array = new PIXI.Float32Array(9);
            var array = this.array;
            if (transpose) {
                array[0] = this.a;
                array[1] = this.b;
                array[2] = 0;
                array[3] = this.c;
                array[4] = this.d;
                array[5] = 0;
                array[6] = this.tx;
                array[7] = this.ty;
                array[8] = 1
            } else {
                array[0] = this.a;
                array[1] = this.c;
                array[2] = this.tx;
                array[3] = this.b;
                array[4] = this.d;
                array[5] = this.ty;
                array[6] = 0;
                array[7] = 0;
                array[8] = 1
            }
            return array
        }
        ;
        PIXI.Matrix.prototype.apply = function (pos, newPos) {
            newPos = newPos || new PIXI.Point;
            newPos.x = this.a * pos.x + this.c * pos.y + this.tx;
            newPos.y = this.b * pos.x + this.d * pos.y + this.ty;
            return newPos
        }
        ;
        PIXI.Matrix.prototype.applyInverse = function (pos, newPos) {
            newPos = newPos || new PIXI.Point;
            var id = 1 / (this.a * this.d + this.c * -this.b);
            newPos.x = this.d * id * pos.x + -this.c * id * pos.y + (this.ty * this.c - this.tx * this.d) * id;
            newPos.y = this.a * id * pos.y + -this.b * id * pos.x + (-this.ty * this.a + this.tx * this.b) * id;
            return newPos
        }
        ;
        PIXI.Matrix.prototype.translate = function (x, y) {
            this.tx += x;
            this.ty += y;
            return this
        }
        ;
        PIXI.Matrix.prototype.scale = function (x, y) {
            this.a *= x;
            this.d *= y;
            this.c *= x;
            this.b *= y;
            this.tx *= x;
            this.ty *= y;
            return this
        }
        ;
        PIXI.Matrix.prototype.rotate = function (angle) {
            var cos = Math.cos(angle);
            var sin = Math.sin(angle);
            var a1 = this.a;
            var c1 = this.c;
            var tx1 = this.tx;
            this.a = a1 * cos - this.b * sin;
            this.b = a1 * sin + this.b * cos;
            this.c = c1 * cos - this.d * sin;
            this.d = c1 * sin + this.d * cos;
            this.tx = tx1 * cos - this.ty * sin;
            this.ty = tx1 * sin + this.ty * cos;
            return this
        }
        ;
        PIXI.Matrix.prototype.append = function (matrix) {
            var a1 = this.a;
            var b1 = this.b;
            var c1 = this.c;
            var d1 = this.d;
            this.a = matrix.a * a1 + matrix.b * c1;
            this.b = matrix.a * b1 + matrix.b * d1;
            this.c = matrix.c * a1 + matrix.d * c1;
            this.d = matrix.c * b1 + matrix.d * d1;
            this.tx = matrix.tx * a1 + matrix.ty * c1 + this.tx;
            this.ty = matrix.tx * b1 + matrix.ty * d1 + this.ty;
            return this
        }
        ;
        PIXI.Matrix.prototype.identity = function () {
            this.a = 1;
            this.b = 0;
            this.c = 0;
            this.d = 1;
            this.tx = 0;
            this.ty = 0;
            return this
        }
        ;
        PIXI.identityMatrix = new PIXI.Matrix;
        PIXI.DisplayObject = function () {
            this.position = new PIXI.Point;
            this.scale = new PIXI.Point(1, 1);
            this.pivot = new PIXI.Point(0, 0);
            this.rotation = 0;
            this.alpha = 1;
            this.visible = true;
            this.hitArea = null;
            this.buttonMode = false;
            this.renderable = false;
            this.parent = null;
            this.stage = null;
            this.worldAlpha = 1;
            this._interactive = false;
            this.defaultCursor = "pointer";
            this.worldTransform = new PIXI.Matrix;
            this._sr = 0;
            this._cr = 1;
            this.filterArea = null;
            this._bounds = new PIXI.Rectangle(0, 0, 1, 1);
            this._currentBounds = null;
            this._mask = null;
            this._cacheAsBitmap = false;
            this._cacheIsDirty = false
        }
        ;
        PIXI.DisplayObject.prototype.constructor = PIXI.DisplayObject;
        Object.defineProperty(PIXI.DisplayObject.prototype, "interactive", {
            get: function () {
                return this._interactive
            },
            set: function (value) {
                this._interactive = value;
                if (this.stage)
                    this.stage.dirty = true
            }
        });
        Object.defineProperty(PIXI.DisplayObject.prototype, "worldVisible", {
            get: function () {
                var item = this;
                do {
                    if (!item.visible)
                        return false;
                    item = item.parent
                } while (item);
                return true
            }
        });
        Object.defineProperty(PIXI.DisplayObject.prototype, "mask", {
            get: function () {
                return this._mask
            },
            set: function (value) {
                if (this._mask)
                    this._mask.isMask = false;
                this._mask = value;
                if (this._mask)
                    this._mask.isMask = true
            }
        });
        Object.defineProperty(PIXI.DisplayObject.prototype, "filters", {
            get: function () {
                return this._filters
            },
            set: function (value) {
                if (value) {
                    var passes = [];
                    for (var i = 0; i < value.length; i++) {
                        var filterPasses = value[i].passes;
                        for (var j = 0; j < filterPasses.length; j++) {
                            passes.push(filterPasses[j])
                        }
                    }
                    this._filterBlock = {
                        target: this,
                        filterPasses: passes
                    }
                }
                this._filters = value
            }
        });
        Object.defineProperty(PIXI.DisplayObject.prototype, "cacheAsBitmap", {
            get: function () {
                return this._cacheAsBitmap
            },
            set: function (value) {
                if (this._cacheAsBitmap === value)
                    return;
                if (value) {
                    this._generateCachedSprite()
                } else {
                    this._destroyCachedSprite()
                }
                this._cacheAsBitmap = value
            }
        });
        PIXI.DisplayObject.prototype.updateTransform = function () {
            var pt = this.parent.worldTransform;
            var wt = this.worldTransform;
            var a, b, c, d, tx, ty;
            if (this.rotation % PIXI.PI_2) {
                if (this.rotation !== this.rotationCache) {
                    this.rotationCache = this.rotation;
                    this._sr = Math.sin(this.rotation);
                    this._cr = Math.cos(this.rotation)
                }
                a = this._cr * this.scale.x;
                b = this._sr * this.scale.x;
                c = -this._sr * this.scale.y;
                d = this._cr * this.scale.y;
                tx = this.position.x;
                ty = this.position.y;
                if (this.pivot.x || this.pivot.y) {
                    tx -= this.pivot.x * a + this.pivot.y * c;
                    ty -= this.pivot.x * b + this.pivot.y * d
                }
                wt.a = a * pt.a + b * pt.c;
                wt.b = a * pt.b + b * pt.d;
                wt.c = c * pt.a + d * pt.c;
                wt.d = c * pt.b + d * pt.d;
                wt.tx = tx * pt.a + ty * pt.c + pt.tx;
                wt.ty = tx * pt.b + ty * pt.d + pt.ty
            } else {
                a = this.scale.x;
                d = this.scale.y;
                tx = this.position.x - this.pivot.x * a;
                ty = this.position.y - this.pivot.y * d;
                wt.a = a * pt.a;
                wt.b = a * pt.b;
                wt.c = d * pt.c;
                wt.d = d * pt.d;
                wt.tx = tx * pt.a + ty * pt.c + pt.tx;
                wt.ty = tx * pt.b + ty * pt.d + pt.ty
            }
            this.worldAlpha = this.alpha * this.parent.worldAlpha
        }
        ;
        PIXI.DisplayObject.prototype.displayObjectUpdateTransform = PIXI.DisplayObject.prototype.updateTransform;
        PIXI.DisplayObject.prototype.getBounds = function (matrix) {
            matrix = matrix;
            return PIXI.EmptyRectangle
        }
        ;
        PIXI.DisplayObject.prototype.getLocalBounds = function () {
            return this.getBounds(PIXI.identityMatrix)
        }
        ;
        PIXI.DisplayObject.prototype.setStageReference = function (stage) {
            this.stage = stage;
            if (this._interactive)
                this.stage.dirty = true
        }
        ;
        PIXI.DisplayObject.prototype.generateTexture = function (resolution, scaleMode, renderer) {
            var bounds = this.getLocalBounds();
            var renderTexture = new PIXI.RenderTexture(bounds.width | 0, bounds.height | 0, renderer, scaleMode, resolution);
            PIXI.DisplayObject._tempMatrix.tx = -bounds.x;
            PIXI.DisplayObject._tempMatrix.ty = -bounds.y;
            renderTexture.render(this, PIXI.DisplayObject._tempMatrix);
            return renderTexture
        }
        ;
        PIXI.DisplayObject.prototype.updateCache = function () {
            this._generateCachedSprite()
        }
        ;
        PIXI.DisplayObject.prototype.toGlobal = function (position) {
            this.displayObjectUpdateTransform();
            return this.worldTransform.apply(position)
        }
        ;
        PIXI.DisplayObject.prototype.toLocal = function (position, from) {
            if (from) {
                position = from.toGlobal(position)
            }
            this.displayObjectUpdateTransform();
            return this.worldTransform.applyInverse(position)
        }
        ;
        PIXI.DisplayObject.prototype._renderCachedSprite = function (renderSession) {
            this._cachedSprite.worldAlpha = this.worldAlpha;
            if (renderSession.gl) {
                PIXI.Sprite.prototype._renderWebGL.call(this._cachedSprite, renderSession)
            } else {
                PIXI.Sprite.prototype._renderCanvas.call(this._cachedSprite, renderSession)
            }
        }
        ;
        PIXI.DisplayObject.prototype._generateCachedSprite = function () {
            this._cacheAsBitmap = false;
            var bounds = this.getLocalBounds();
            if (!this._cachedSprite) {
                var renderTexture = new PIXI.RenderTexture(bounds.width | 0, bounds.height | 0);
                this._cachedSprite = new PIXI.Sprite(renderTexture);
                this._cachedSprite.worldTransform = this.worldTransform
            } else {
                this._cachedSprite.texture.resize(bounds.width | 0, bounds.height | 0)
            }
            var tempFilters = this._filters;
            this._filters = null;
            this._cachedSprite.filters = tempFilters;
            PIXI.DisplayObject._tempMatrix.tx = -bounds.x;
            PIXI.DisplayObject._tempMatrix.ty = -bounds.y;
            this._cachedSprite.texture.render(this, PIXI.DisplayObject._tempMatrix, true);
            this._cachedSprite.anchor.x = -(bounds.x / bounds.width);
            this._cachedSprite.anchor.y = -(bounds.y / bounds.height);
            this._filters = tempFilters;
            this._cacheAsBitmap = true
        }
        ;
        PIXI.DisplayObject.prototype._destroyCachedSprite = function () {
            if (!this._cachedSprite)
                return;
            this._cachedSprite.texture.destroy(true);
            this._cachedSprite = null
        }
        ;
        PIXI.DisplayObject.prototype._renderWebGL = function (renderSession) {
            renderSession = renderSession
        }
        ;
        PIXI.DisplayObject.prototype._renderCanvas = function (renderSession) {
            renderSession = renderSession
        }
        ;
        PIXI.DisplayObject._tempMatrix = new PIXI.Matrix;
        Object.defineProperty(PIXI.DisplayObject.prototype, "x", {
            get: function () {
                return this.position.x
            },
            set: function (value) {
                this.position.x = value
            }
        });
        Object.defineProperty(PIXI.DisplayObject.prototype, "y", {
            get: function () {
                return this.position.y
            },
            set: function (value) {
                this.position.y = value
            }
        });
        PIXI.DisplayObjectContainer = function () {
            PIXI.DisplayObject.call(this);
            this.children = []
        }
        ;
        PIXI.DisplayObjectContainer.prototype = Object.create(PIXI.DisplayObject.prototype);
        PIXI.DisplayObjectContainer.prototype.constructor = PIXI.DisplayObjectContainer;
        Object.defineProperty(PIXI.DisplayObjectContainer.prototype, "width", {
            get: function () {
                return this.scale.x * this.getLocalBounds().width
            },
            set: function (value) {
                var width = this.getLocalBounds().width;
                if (width !== 0) {
                    this.scale.x = value / width
                } else {
                    this.scale.x = 1
                }
                this._width = value
            }
        });
        Object.defineProperty(PIXI.DisplayObjectContainer.prototype, "height", {
            get: function () {
                return this.scale.y * this.getLocalBounds().height
            },
            set: function (value) {
                var height = this.getLocalBounds().height;
                if (height !== 0) {
                    this.scale.y = value / height
                } else {
                    this.scale.y = 1
                }
                this._height = value
            }
        });
        PIXI.DisplayObjectContainer.prototype.addChild = function (child) {
            return this.addChildAt(child, this.children.length)
        }
        ;
        PIXI.DisplayObjectContainer.prototype.addChildAt = function (child, index) {
            if (index >= 0 && index <= this.children.length) {
                if (child.parent) {
                    child.parent.removeChild(child)
                }
                child.parent = this;
                this.children.splice(index, 0, child);
                if (this.stage)
                    child.setStageReference(this.stage);
                return child
            } else {
                throw new Error(child + "addChildAt: The index " + index + " supplied is out of bounds " + this.children.length)
            }
        }
        ;
        PIXI.DisplayObjectContainer.prototype.swapChildren = function (child, child2) {
            if (child === child2) {
                return
            }
            var index1 = this.getChildIndex(child);
            var index2 = this.getChildIndex(child2);
            if (index1 < 0 || index2 < 0) {
                throw new Error("swapChildren: Both the supplied DisplayObjects must be a child of the caller.")
            }
            this.children[index1] = child2;
            this.children[index2] = child
        }
        ;
        PIXI.DisplayObjectContainer.prototype.getChildIndex = function (child) {
            var index = this.children.indexOf(child);
            if (index === -1) {
                throw new Error("The supplied DisplayObject must be a child of the caller")
            }
            return index
        }
        ;
        PIXI.DisplayObjectContainer.prototype.setChildIndex = function (child, index) {
            if (index < 0 || index >= this.children.length) {
                throw new Error("The supplied index is out of bounds")
            }
            var currentIndex = this.getChildIndex(child);
            this.children.splice(currentIndex, 1);
            this.children.splice(index, 0, child)
        }
        ;
        PIXI.DisplayObjectContainer.prototype.getChildAt = function (index) {
            if (index < 0 || index >= this.children.length) {
                throw new Error("getChildAt: Supplied index " + index + " does not exist in the child list, or the supplied DisplayObject must be a child of the caller")
            }
            return this.children[index]
        }
        ;
        PIXI.DisplayObjectContainer.prototype.removeChild = function (child) {
            var index = this.children.indexOf(child);
            if (index === -1)
                return;
            return this.removeChildAt(index)
        }
        ;
        PIXI.DisplayObjectContainer.prototype.removeChildAt = function (index) {
            var child = this.getChildAt(index);
            if (this.stage)
                child.removeStageReference();
            child.parent = undefined;
            this.children.splice(index, 1);
            return child
        }
        ;
        PIXI.DisplayObjectContainer.prototype.removeChildren = function (beginIndex, endIndex) {
            var begin = beginIndex || 0;
            var end = typeof endIndex === "number" ? endIndex : this.children.length;
            var range = end - begin;
            if (range > 0 && range <= end) {
                var removed = this.children.splice(begin, range);
                for (var i = 0; i < removed.length; i++) {
                    var child = removed[i];
                    if (this.stage)
                        child.removeStageReference();
                    child.parent = undefined
                }
                return removed
            } else if (range === 0 && this.children.length === 0) {
                return []
            } else {
                throw new Error("removeChildren: Range Error, numeric values are outside the acceptable range")
            }
        }
        ;
        PIXI.DisplayObjectContainer.prototype.updateTransform = function () {
            if (!this.visible)
                return;
            this.displayObjectUpdateTransform();
            if (this._cacheAsBitmap)
                return;
            for (var i = 0, j = this.children.length; i < j; i++) {
                this.children[i].updateTransform()
            }
        }
        ;
        PIXI.DisplayObjectContainer.prototype.displayObjectContainerUpdateTransform = PIXI.DisplayObjectContainer.prototype.updateTransform;
        PIXI.DisplayObjectContainer.prototype.getBounds = function () {
            if (this.children.length === 0)
                return PIXI.EmptyRectangle;
            var minX = Infinity;
            var minY = Infinity;
            var maxX = -Infinity;
            var maxY = -Infinity;
            var childBounds;
            var childMaxX;
            var childMaxY;
            var childVisible = false;
            for (var i = 0, j = this.children.length; i < j; i++) {
                var child = this.children[i];
                if (!child.visible)
                    continue;
                childVisible = true;
                childBounds = this.children[i].getBounds();
                minX = minX < childBounds.x ? minX : childBounds.x;
                minY = minY < childBounds.y ? minY : childBounds.y;
                childMaxX = childBounds.width + childBounds.x;
                childMaxY = childBounds.height + childBounds.y;
                maxX = maxX > childMaxX ? maxX : childMaxX;
                maxY = maxY > childMaxY ? maxY : childMaxY
            }
            if (!childVisible)
                return PIXI.EmptyRectangle;
            var bounds = this._bounds;
            bounds.x = minX;
            bounds.y = minY;
            bounds.width = maxX - minX;
            bounds.height = maxY - minY;
            return bounds
        }
        ;
        PIXI.DisplayObjectContainer.prototype.getLocalBounds = function () {
            var matrixCache = this.worldTransform;
            this.worldTransform = PIXI.identityMatrix;
            for (var i = 0, j = this.children.length; i < j; i++) {
                this.children[i].updateTransform()
            }
            var bounds = this.getBounds();
            this.worldTransform = matrixCache;
            return bounds
        }
        ;
        PIXI.DisplayObjectContainer.prototype.setStageReference = function (stage) {
            this.stage = stage;
            if (this._interactive)
                this.stage.dirty = true;
            for (var i = 0, j = this.children.length; i < j; i++) {
                var child = this.children[i];
                child.setStageReference(stage)
            }
        }
        ;
        PIXI.DisplayObjectContainer.prototype.removeStageReference = function () {
            for (var i = 0, j = this.children.length; i < j; i++) {
                var child = this.children[i];
                child.removeStageReference()
            }
            if (this._interactive)
                this.stage.dirty = true;
            this.stage = null
        }
        ;
        PIXI.DisplayObjectContainer.prototype._renderWebGL = function (renderSession) {
            if (!this.visible || this.alpha <= 0)
                return;
            if (this._cacheAsBitmap) {
                this._renderCachedSprite(renderSession);
                return
            }
            var i, j;
            if (this._mask || this._filters) {
                if (this._filters) {
                    renderSession.spriteBatch.flush();
                    renderSession.filterManager.pushFilter(this._filterBlock)
                }
                if (this._mask) {
                    renderSession.spriteBatch.stop();
                    renderSession.maskManager.pushMask(this.mask, renderSession);
                    renderSession.spriteBatch.start()
                }
                for (i = 0,
                         j = this.children.length; i < j; i++) {
                    this.children[i]._renderWebGL(renderSession)
                }
                renderSession.spriteBatch.stop();
                if (this._mask)
                    renderSession.maskManager.popMask(this._mask, renderSession);
                if (this._filters)
                    renderSession.filterManager.popFilter();
                renderSession.spriteBatch.start()
            } else {
                for (i = 0,
                         j = this.children.length; i < j; i++) {
                    this.children[i]._renderWebGL(renderSession)
                }
            }
        }
        ;
        PIXI.DisplayObjectContainer.prototype._renderCanvas = function (renderSession) {
            if (this.visible === false || this.alpha === 0)
                return;
            if (this._cacheAsBitmap) {
                this._renderCachedSprite(renderSession);
                return
            }
            if (this._mask) {
                renderSession.maskManager.pushMask(this._mask, renderSession)
            }
            for (var i = 0, j = this.children.length; i < j; i++) {
                var child = this.children[i];
                child._renderCanvas(renderSession)
            }
            if (this._mask) {
                renderSession.maskManager.popMask(renderSession)
            }
        }
        ;
        PIXI.Sprite = function (texture) {
            PIXI.DisplayObjectContainer.call(this);
            this.anchor = new PIXI.Point;
            this.texture = texture || PIXI.Texture.emptyTexture;
            this._width = 0;
            this._height = 0;
            this.tint = 16777215;
            this.blendMode = PIXI.blendModes.NORMAL;
            this.shader = null;
            if (this.texture.baseTexture.hasLoaded) {
                this.onTextureUpdate()
            } else {
                this.texture.on("update", this.onTextureUpdate.bind(this))
            }
            this.renderable = true
        }
        ;
        PIXI.Sprite.prototype = Object.create(PIXI.DisplayObjectContainer.prototype);
        PIXI.Sprite.prototype.constructor = PIXI.Sprite;
        Object.defineProperty(PIXI.Sprite.prototype, "width", {
            get: function () {
                return this.scale.x * this.texture.frame.width
            },
            set: function (value) {
                this.scale.x = value / this.texture.frame.width;
                this._width = value
            }
        });
        Object.defineProperty(PIXI.Sprite.prototype, "height", {
            get: function () {
                return this.scale.y * this.texture.frame.height
            },
            set: function (value) {
                this.scale.y = value / this.texture.frame.height;
                this._height = value
            }
        });
        PIXI.Sprite.prototype.setTexture = function (texture) {
            this.texture = texture;
            this.cachedTint = 16777215
        }
        ;
        PIXI.Sprite.prototype.onTextureUpdate = function () {
            if (this._width)
                this.scale.x = this._width / this.texture.frame.width;
            if (this._height)
                this.scale.y = this._height / this.texture.frame.height
        }
        ;
        PIXI.Sprite.prototype.getBounds = function (matrix) {
            var width = this.texture.frame.width;
            var height = this.texture.frame.height;
            var w0 = width * (1 - this.anchor.x);
            var w1 = width * -this.anchor.x;
            var h0 = height * (1 - this.anchor.y);
            var h1 = height * -this.anchor.y;
            var worldTransform = matrix || this.worldTransform;
            var a = worldTransform.a;
            var b = worldTransform.b;
            var c = worldTransform.c;
            var d = worldTransform.d;
            var tx = worldTransform.tx;
            var ty = worldTransform.ty;
            var maxX = -Infinity;
            var maxY = -Infinity;
            var minX = Infinity;
            var minY = Infinity;
            if (b === 0 && c === 0) {
                if (a < 0)
                    a *= -1;
                if (d < 0)
                    d *= -1;
                minX = a * w1 + tx;
                maxX = a * w0 + tx;
                minY = d * h1 + ty;
                maxY = d * h0 + ty
            } else {
                var x1 = a * w1 + c * h1 + tx;
                var y1 = d * h1 + b * w1 + ty;
                var x2 = a * w0 + c * h1 + tx;
                var y2 = d * h1 + b * w0 + ty;
                var x3 = a * w0 + c * h0 + tx;
                var y3 = d * h0 + b * w0 + ty;
                var x4 = a * w1 + c * h0 + tx;
                var y4 = d * h0 + b * w1 + ty;
                minX = x1 < minX ? x1 : minX;
                minX = x2 < minX ? x2 : minX;
                minX = x3 < minX ? x3 : minX;
                minX = x4 < minX ? x4 : minX;
                minY = y1 < minY ? y1 : minY;
                minY = y2 < minY ? y2 : minY;
                minY = y3 < minY ? y3 : minY;
                minY = y4 < minY ? y4 : minY;
                maxX = x1 > maxX ? x1 : maxX;
                maxX = x2 > maxX ? x2 : maxX;
                maxX = x3 > maxX ? x3 : maxX;
                maxX = x4 > maxX ? x4 : maxX;
                maxY = y1 > maxY ? y1 : maxY;
                maxY = y2 > maxY ? y2 : maxY;
                maxY = y3 > maxY ? y3 : maxY;
                maxY = y4 > maxY ? y4 : maxY
            }
            var bounds = this._bounds;
            bounds.x = minX;
            bounds.width = maxX - minX;
            bounds.y = minY;
            bounds.height = maxY - minY;
            this._currentBounds = bounds;
            return bounds
        }
        ;
        PIXI.Sprite.prototype._renderWebGL = function (renderSession) {
            if (!this.visible || this.alpha <= 0)
                return;
            var i, j;
            if (this._mask || this._filters) {
                var spriteBatch = renderSession.spriteBatch;
                if (this._filters) {
                    spriteBatch.flush();
                    renderSession.filterManager.pushFilter(this._filterBlock)
                }
                if (this._mask) {
                    spriteBatch.stop();
                    renderSession.maskManager.pushMask(this.mask, renderSession);
                    spriteBatch.start()
                }
                spriteBatch.render(this);
                for (i = 0,
                         j = this.children.length; i < j; i++) {
                    this.children[i]._renderWebGL(renderSession)
                }
                spriteBatch.stop();
                if (this._mask)
                    renderSession.maskManager.popMask(this._mask, renderSession);
                if (this._filters)
                    renderSession.filterManager.popFilter();
                spriteBatch.start()
            } else {
                renderSession.spriteBatch.render(this);
                for (i = 0,
                         j = this.children.length; i < j; i++) {
                    this.children[i]._renderWebGL(renderSession)
                }
            }
        }
        ;
        PIXI.Sprite.prototype._renderCanvas = function (renderSession) {
            if (this.visible === false || this.alpha === 0 || this.texture.crop.width <= 0 || this.texture.crop.height <= 0)
                return;
            if (this.blendMode !== renderSession.currentBlendMode) {
                renderSession.currentBlendMode = this.blendMode;
                renderSession.context.globalCompositeOperation = PIXI.blendModesCanvas[renderSession.currentBlendMode]
            }
            if (this._mask) {
                renderSession.maskManager.pushMask(this._mask, renderSession)
            }
            if (this.texture.valid) {
                var resolution = this.texture.baseTexture.resolution / renderSession.resolution;
                renderSession.context.globalAlpha = this.worldAlpha;
                if (renderSession.smoothProperty && renderSession.scaleMode !== this.texture.baseTexture.scaleMode) {
                    renderSession.scaleMode = this.texture.baseTexture.scaleMode;
                    renderSession.context[renderSession.smoothProperty] = renderSession.scaleMode === PIXI.scaleModes.LINEAR
                }
                var dx = this.texture.trim ? this.texture.trim.x - this.anchor.x * this.texture.trim.width : this.anchor.x * -this.texture.frame.width;
                var dy = this.texture.trim ? this.texture.trim.y - this.anchor.y * this.texture.trim.height : this.anchor.y * -this.texture.frame.height;
                if (renderSession.roundPixels) {
                    renderSession.context.setTransform(this.worldTransform.a, this.worldTransform.b, this.worldTransform.c, this.worldTransform.d, this.worldTransform.tx * renderSession.resolution | 0, this.worldTransform.ty * renderSession.resolution | 0);
                    dx = dx | 0;
                    dy = dy | 0
                } else {
                    renderSession.context.setTransform(this.worldTransform.a, this.worldTransform.b, this.worldTransform.c, this.worldTransform.d, this.worldTransform.tx * renderSession.resolution, this.worldTransform.ty * renderSession.resolution)
                }
                if (this.tint !== 16777215) {
                    if (this.cachedTint !== this.tint) {
                        this.cachedTint = this.tint;
                        this.tintedTexture = PIXI.CanvasTinter.getTintedTexture(this, this.tint)
                    }
                    renderSession.context.drawImage(this.tintedTexture, 0, 0, this.texture.crop.width, this.texture.crop.height, dx / resolution, dy / resolution, this.texture.crop.width / resolution, this.texture.crop.height / resolution)
                } else {
                    renderSession.context.drawImage(this.texture.baseTexture.source, this.texture.crop.x, this.texture.crop.y, this.texture.crop.width, this.texture.crop.height, dx / resolution, dy / resolution, this.texture.crop.width / resolution, this.texture.crop.height / resolution)
                }
            }
            for (var i = 0, j = this.children.length; i < j; i++) {
                this.children[i]._renderCanvas(renderSession)
            }
            if (this._mask) {
                renderSession.maskManager.popMask(renderSession)
            }
        }
        ;
        PIXI.Sprite.fromFrame = function (frameId) {
            var texture = PIXI.TextureCache[frameId];
            if (!texture)
                throw new Error('The frameId "' + frameId + '" does not exist in the texture cache' + this);
            return new PIXI.Sprite(texture)
        }
        ;
        PIXI.Sprite.fromImage = function (imageId, crossorigin, scaleMode) {
            var texture = PIXI.Texture.fromImage(imageId, crossorigin, scaleMode);
            return new PIXI.Sprite(texture)
        }
        ;
        PIXI.SpriteBatch = function (texture) {
            PIXI.DisplayObjectContainer.call(this);
            this.textureThing = texture;
            this.ready = false
        }
        ;
        PIXI.SpriteBatch.prototype = Object.create(PIXI.DisplayObjectContainer.prototype);
        PIXI.SpriteBatch.prototype.constructor = PIXI.SpriteBatch;
        PIXI.SpriteBatch.prototype.initWebGL = function (gl) {
            this.fastSpriteBatch = new PIXI.WebGLFastSpriteBatch(gl);
            this.ready = true
        }
        ;
        PIXI.SpriteBatch.prototype.updateTransform = function () {
            this.displayObjectUpdateTransform()
        }
        ;
        PIXI.SpriteBatch.prototype._renderWebGL = function (renderSession) {
            if (!this.visible || this.alpha <= 0 || !this.children.length)
                return;
            if (!this.ready)
                this.initWebGL(renderSession.gl);
            renderSession.spriteBatch.stop();
            renderSession.shaderManager.setShader(renderSession.shaderManager.fastShader);
            this.fastSpriteBatch.begin(this, renderSession);
            this.fastSpriteBatch.render(this);
            renderSession.spriteBatch.start()
        }
        ;
        PIXI.SpriteBatch.prototype._renderCanvas = function (renderSession) {
            if (!this.visible || this.alpha <= 0 || !this.children.length)
                return;
            var context = renderSession.context;
            context.globalAlpha = this.worldAlpha;
            this.displayObjectUpdateTransform();
            var transform = this.worldTransform;
            var isRotated = true;
            for (var i = 0; i < this.children.length; i++) {
                var child = this.children[i];
                if (!child.visible)
                    continue;
                var texture = child.texture;
                var frame = texture.frame;
                context.globalAlpha = this.worldAlpha * child.alpha;
                if (child.rotation % (Math.PI * 2) === 0) {
                    if (isRotated) {
                        context.setTransform(transform.a, transform.b, transform.c, transform.d, transform.tx, transform.ty);
                        isRotated = false
                    }
                    context.drawImage(texture.baseTexture.source, frame.x, frame.y, frame.width, frame.height, child.anchor.x * (-frame.width * child.scale.x) + child.position.x + .5, child.anchor.y * (-frame.height * child.scale.y) + child.position.y + .5, frame.width * child.scale.x, frame.height * child.scale.y)
                } else {
                    if (!isRotated)
                        isRotated = true;
                    child.displayObjectUpdateTransform();
                    var childTransform = child.worldTransform;
                    if (renderSession.roundPixels) {
                        context.setTransform(childTransform.a, childTransform.b, childTransform.c, childTransform.d, childTransform.tx | 0, childTransform.ty | 0)
                    } else {
                        context.setTransform(childTransform.a, childTransform.b, childTransform.c, childTransform.d, childTransform.tx, childTransform.ty)
                    }
                    context.drawImage(texture.baseTexture.source, frame.x, frame.y, frame.width, frame.height, child.anchor.x * -frame.width + .5 | 0, child.anchor.y * -frame.height + .5 | 0, frame.width, frame.height)
                }
            }
        }
        ;
        PIXI.MovieClip = function (textures) {
            PIXI.Sprite.call(this, textures[0]);
            this.textures = textures;
            this.animationSpeed = 1;
            this.loop = true;
            this.onComplete = null;
            this.currentFrame = 0;
            this.playing = false
        }
        ;
        PIXI.MovieClip.prototype = Object.create(PIXI.Sprite.prototype);
        PIXI.MovieClip.prototype.constructor = PIXI.MovieClip;
        Object.defineProperty(PIXI.MovieClip.prototype, "totalFrames", {
            get: function () {
                return this.textures.length
            }
        });
        PIXI.MovieClip.prototype.stop = function () {
            this.playing = false
        }
        ;
        PIXI.MovieClip.prototype.play = function () {
            this.playing = true
        }
        ;
        PIXI.MovieClip.prototype.gotoAndStop = function (frameNumber) {
            this.playing = false;
            this.currentFrame = frameNumber;
            var round = this.currentFrame + .5 | 0;
            this.setTexture(this.textures[round % this.textures.length])
        }
        ;
        PIXI.MovieClip.prototype.gotoAndPlay = function (frameNumber) {
            this.currentFrame = frameNumber;
            this.playing = true
        }
        ;
        PIXI.MovieClip.prototype.updateTransform = function () {
            this.displayObjectContainerUpdateTransform();
            if (!this.playing)
                return;
            this.currentFrame += this.animationSpeed;
            var round = this.currentFrame + .5 | 0;
            this.currentFrame = this.currentFrame % this.textures.length;
            if (this.loop || round < this.textures.length) {
                this.setTexture(this.textures[round % this.textures.length])
            } else if (round >= this.textures.length) {
                this.gotoAndStop(this.textures.length - 1);
                if (this.onComplete) {
                    this.onComplete()
                }
            }
        }
        ;
        PIXI.MovieClip.fromFrames = function (frames) {
            var textures = [];
            for (var i = 0; i < frames.length; i++) {
                textures.push(new PIXI.Texture.fromFrame(frames[i]))
            }
            return new PIXI.MovieClip(textures)
        }
        ;
        PIXI.MovieClip.fromImages = function (images) {
            var textures = [];
            for (var i = 0; i < images.length; i++) {
                textures.push(new PIXI.Texture.fromImage(images[i]))
            }
            return new PIXI.MovieClip(textures)
        }
        ;
        PIXI.FilterBlock = function () {
            this.visible = true;
            this.renderable = true
        }
        ;
        PIXI.FilterBlock.prototype.constructor = PIXI.FilterBlock;
        PIXI.Text = function (text, style) {
            this.canvas = document.createElement("canvas");
            this.context = this.canvas.getContext("2d");
            this.resolution = 1;
            PIXI.Sprite.call(this, PIXI.Texture.fromCanvas(this.canvas));
            this.setText(text);
            this.setStyle(style)
        }
        ;
        PIXI.Text.prototype = Object.create(PIXI.Sprite.prototype);
        PIXI.Text.prototype.constructor = PIXI.Text;
        Object.defineProperty(PIXI.Text.prototype, "width", {
            get: function () {
                if (this.dirty) {
                    this.updateText();
                    this.dirty = false
                }
                return this.scale.x * this.texture.frame.width
            },
            set: function (value) {
                this.scale.x = value / this.texture.frame.width;
                this._width = value
            }
        });
        Object.defineProperty(PIXI.Text.prototype, "height", {
            get: function () {
                if (this.dirty) {
                    this.updateText();
                    this.dirty = false
                }
                return this.scale.y * this.texture.frame.height
            },
            set: function (value) {
                this.scale.y = value / this.texture.frame.height;
                this._height = value
            }
        });
        PIXI.Text.prototype.setStyle = function (style) {
            style = style || {};
            style.font = style.font || "bold 20pt Arial";
            style.fill = style.fill || "black";
            style.align = style.align || "left";
            style.stroke = style.stroke || "black";
            style.strokeThickness = style.strokeThickness || 0;
            style.wordWrap = style.wordWrap || false;
            style.wordWrapWidth = style.wordWrapWidth || 100;
            style.dropShadow = style.dropShadow || false;
            style.dropShadowAngle = style.dropShadowAngle || Math.PI / 6;
            style.dropShadowDistance = style.dropShadowDistance || 4;
            style.dropShadowColor = style.dropShadowColor || "black";
            this.style = style;
            this.dirty = true
        }
        ;
        PIXI.Text.prototype.setText = function (text) {
            this.text = text.toString() || " ";
            this.dirty = true
        }
        ;
        PIXI.Text.prototype.updateText = function () {
            this.texture.baseTexture.resolution = this.resolution;
            this.context.font = this.style.font;
            var outputText = this.text;
            if (this.style.wordWrap)
                outputText = this.wordWrap(this.text);
            var lines = outputText.split(/(?:\r\n|\r|\n)/);
            var lineWidths = [];
            var maxLineWidth = 0;
            var fontProperties = this.determineFontProperties(this.style.font);
            for (var i = 0; i < lines.length; i++) {
                var lineWidth = this.context.measureText(lines[i]).width;
                lineWidths[i] = lineWidth;
                maxLineWidth = Math.max(maxLineWidth, lineWidth)
            }
            var width = maxLineWidth + this.style.strokeThickness;
            if (this.style.dropShadow)
                width += this.style.dropShadowDistance;
            this.canvas.width = (width + this.context.lineWidth) * this.resolution;
            var lineHeight = fontProperties.fontSize + this.style.strokeThickness;
            var height = lineHeight * lines.length;
            if (this.style.dropShadow)
                height += this.style.dropShadowDistance;
            this.canvas.height = height * this.resolution;
            this.context.scale(this.resolution, this.resolution);
            if (navigator.isCocoonJS)
                this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.context.font = this.style.font;
            this.context.strokeStyle = this.style.stroke;
            this.context.lineWidth = this.style.strokeThickness;
            this.context.textBaseline = "alphabetic";
            var linePositionX;
            var linePositionY;
            if (this.style.dropShadow) {
                this.context.fillStyle = this.style.dropShadowColor;
                var xShadowOffset = Math.sin(this.style.dropShadowAngle) * this.style.dropShadowDistance;
                var yShadowOffset = Math.cos(this.style.dropShadowAngle) * this.style.dropShadowDistance;
                for (i = 0; i < lines.length; i++) {
                    linePositionX = this.style.strokeThickness / 2;
                    linePositionY = this.style.strokeThickness / 2 + i * lineHeight + fontProperties.ascent;
                    if (this.style.align === "right") {
                        linePositionX += maxLineWidth - lineWidths[i]
                    } else if (this.style.align === "center") {
                        linePositionX += (maxLineWidth - lineWidths[i]) / 2
                    }
                    if (this.style.fill) {
                        this.context.fillText(lines[i], linePositionX + xShadowOffset, linePositionY + yShadowOffset)
                    }
                }
            }
            this.context.fillStyle = this.style.fill;
            for (i = 0; i < lines.length; i++) {
                linePositionX = this.style.strokeThickness / 2;
                linePositionY = this.style.strokeThickness / 2 + i * lineHeight + fontProperties.ascent;
                if (this.style.align === "right") {
                    linePositionX += maxLineWidth - lineWidths[i]
                } else if (this.style.align === "center") {
                    linePositionX += (maxLineWidth - lineWidths[i]) / 2
                }
                if (this.style.stroke && this.style.strokeThickness) {
                    this.context.strokeText(lines[i], linePositionX, linePositionY)
                }
                if (this.style.fill) {
                    this.context.fillText(lines[i], linePositionX, linePositionY)
                }
            }
            this.updateTexture()
        }
        ;
        PIXI.Text.prototype.updateTexture = function () {
            this.texture.baseTexture.width = this.canvas.width;
            this.texture.baseTexture.height = this.canvas.height;
            this.texture.crop.width = this.texture.frame.width = this.canvas.width;
            this.texture.crop.height = this.texture.frame.height = this.canvas.height;
            this._width = this.canvas.width;
            this._height = this.canvas.height;
            this.texture.baseTexture.dirty()
        }
        ;
        PIXI.Text.prototype._renderWebGL = function (renderSession) {
            if (this.dirty) {
                this.resolution = renderSession.resolution;
                this.updateText();
                this.dirty = false
            }
            PIXI.Sprite.prototype._renderWebGL.call(this, renderSession)
        }
        ;
        PIXI.Text.prototype._renderCanvas = function (renderSession) {
            if (this.dirty) {
                this.resolution = renderSession.resolution;
                this.updateText();
                this.dirty = false
            }
            PIXI.Sprite.prototype._renderCanvas.call(this, renderSession)
        }
        ;
        PIXI.Text.prototype.determineFontProperties = function (fontStyle) {
            var properties = PIXI.Text.fontPropertiesCache[fontStyle];
            if (!properties) {
                properties = {};
                var canvas = PIXI.Text.fontPropertiesCanvas;
                var context = PIXI.Text.fontPropertiesContext;
                context.font = fontStyle;
                var width = Math.ceil(context.measureText("|Mq").width);
                var baseline = Math.ceil(context.measureText("M").width);
                var height = 2 * baseline;
                baseline = baseline * 1.4 | 0;
                canvas.width = width;
                canvas.height = height;
                context.fillStyle = "#f00";
                context.fillRect(0, 0, width, height);
                context.font = fontStyle;
                context.textBaseline = "alphabetic";
                context.fillStyle = "#000";
                context.fillText("|MÉq", 0, baseline);
                var imagedata = context.getImageData(0, 0, width, height).data;
                var pixels = imagedata.length;
                var line = width * 4;
                var i, j;
                var idx = 0;
                var stop = false;
                for (i = 0; i < baseline; i++) {
                    for (j = 0; j < line; j += 4) {
                        if (imagedata[idx + j] !== 255) {
                            stop = true;
                            break
                        }
                    }
                    if (!stop) {
                        idx += line
                    } else {
                        break
                    }
                }
                properties.ascent = baseline - i;
                idx = pixels - line;
                stop = false;
                for (i = height; i > baseline; i--) {
                    for (j = 0; j < line; j += 4) {
                        if (imagedata[idx + j] !== 255) {
                            stop = true;
                            break
                        }
                    }
                    if (!stop) {
                        idx -= line
                    } else {
                        break
                    }
                }
                properties.descent = i - baseline;
                properties.descent += 6;
                properties.fontSize = properties.ascent + properties.descent;
                PIXI.Text.fontPropertiesCache[fontStyle] = properties
            }
            return properties
        }
        ;
        PIXI.Text.prototype.wordWrap = function (text) {
            var result = "";
            var lines = text.split("\n");
            for (var i = 0; i < lines.length; i++) {
                var spaceLeft = this.style.wordWrapWidth;
                var words = lines[i].split(" ");
                for (var j = 0; j < words.length; j++) {
                    var wordWidth = this.context.measureText(words[j]).width;
                    var wordWidthWithSpace = wordWidth + this.context.measureText(" ").width;
                    if (j === 0 || wordWidthWithSpace > spaceLeft) {
                        if (j > 0) {
                            result += "\n"
                        }
                        result += words[j];
                        spaceLeft = this.style.wordWrapWidth - wordWidth
                    } else {
                        spaceLeft -= wordWidthWithSpace;
                        result += " " + words[j]
                    }
                }
                if (i < lines.length - 1) {
                    result += "\n"
                }
            }
            return result
        }
        ;
        PIXI.Text.prototype.getBounds = function (matrix) {
            if (this.dirty) {
                this.updateText();
                this.dirty = false
            }
            return PIXI.Sprite.prototype.getBounds.call(this, matrix)
        }
        ;
        PIXI.Text.prototype.destroy = function (destroyBaseTexture) {
            this.context = null;
            this.canvas = null;
            this.texture.destroy(destroyBaseTexture === undefined ? true : destroyBaseTexture)
        }
        ;
        PIXI.Text.fontPropertiesCache = {};
        PIXI.Text.fontPropertiesCanvas = document.createElement("canvas");
        PIXI.Text.fontPropertiesContext = PIXI.Text.fontPropertiesCanvas.getContext("2d");
        PIXI.BitmapText = function (text, style) {
            PIXI.DisplayObjectContainer.call(this);
            this.textWidth = 0;
            this.textHeight = 0;
            this._pool = [];
            this.setText(text);
            this.setStyle(style);
            this.updateText();
            this.dirty = false
        }
        ;
        PIXI.BitmapText.prototype = Object.create(PIXI.DisplayObjectContainer.prototype);
        PIXI.BitmapText.prototype.constructor = PIXI.BitmapText;
        PIXI.BitmapText.prototype.setText = function (text) {
            this.text = text || " ";
            this.dirty = true
        }
        ;
        PIXI.BitmapText.prototype.setStyle = function (style) {
            style = style || {};
            style.align = style.align || "left";
            this.style = style;
            var font = style.font.split(" ");
            this.fontName = font[font.length - 1];
            this.fontSize = font.length >= 2 ? parseInt(font[font.length - 2], 10) : PIXI.BitmapText.fonts[this.fontName].size;
            this.dirty = true;
            this.tint = style.tint
        }
        ;
        PIXI.BitmapText.prototype.updateText = function () {
            var data = PIXI.BitmapText.fonts[this.fontName];
            var pos = new PIXI.Point;
            var prevCharCode = null;
            var chars = [];
            var maxLineWidth = 0;
            var lineWidths = [];
            var line = 0;
            var scale = this.fontSize / data.size;
            for (var i = 0; i < this.text.length; i++) {
                var charCode = this.text.charCodeAt(i);
                if (/(?:\r\n|\r|\n)/.test(this.text.charAt(i))) {
                    lineWidths.push(pos.x);
                    maxLineWidth = Math.max(maxLineWidth, pos.x);
                    line++;
                    pos.x = 0;
                    pos.y += data.lineHeight;
                    prevCharCode = null;
                    continue
                }
                var charData = data.chars[charCode];
                if (!charData)
                    continue;
                if (prevCharCode && charData.kerning[prevCharCode]) {
                    pos.x += charData.kerning[prevCharCode]
                }
                chars.push({
                    texture: charData.texture,
                    line: line,
                    charCode: charCode,
                    position: new PIXI.Point(pos.x + charData.xOffset, pos.y + charData.yOffset)
                });
                pos.x += charData.xAdvance;
                prevCharCode = charCode
            }
            lineWidths.push(pos.x);
            maxLineWidth = Math.max(maxLineWidth, pos.x);
            var lineAlignOffsets = [];
            for (i = 0; i <= line; i++) {
                var alignOffset = 0;
                if (this.style.align === "right") {
                    alignOffset = maxLineWidth - lineWidths[i]
                } else if (this.style.align === "center") {
                    alignOffset = (maxLineWidth - lineWidths[i]) / 2
                }
                lineAlignOffsets.push(alignOffset)
            }
            var lenChildren = this.children.length;
            var lenChars = chars.length;
            var tint = this.tint || 16777215;
            for (i = 0; i < lenChars; i++) {
                var c = i < lenChildren ? this.children[i] : this._pool.pop();
                if (c)
                    c.setTexture(chars[i].texture);
                else
                    c = new PIXI.Sprite(chars[i].texture);
                c.position.x = (chars[i].position.x + lineAlignOffsets[chars[i].line]) * scale;
                c.position.y = chars[i].position.y * scale;
                c.scale.x = c.scale.y = scale;
                c.tint = tint;
                if (!c.parent)
                    this.addChild(c)
            }
            while (this.children.length > lenChars) {
                var child = this.getChildAt(this.children.length - 1);
                this._pool.push(child);
                this.removeChild(child)
            }
            this.textWidth = maxLineWidth * scale;
            this.textHeight = (pos.y + data.lineHeight) * scale
        }
        ;
        PIXI.BitmapText.prototype.updateTransform = function () {
            if (this.dirty) {
                this.updateText();
                this.dirty = false
            }
            PIXI.DisplayObjectContainer.prototype.updateTransform.call(this)
        }
        ;
        PIXI.BitmapText.fonts = {};
        PIXI.InteractionData = function () {
            this.global = new PIXI.Point;
            this.target = null;
            this.originalEvent = null
        }
        ;
        PIXI.InteractionData.prototype.getLocalPosition = function (displayObject, point) {
            var worldTransform = displayObject.worldTransform;
            var global = this.global;
            var a00 = worldTransform.a
                , a01 = worldTransform.c
                , a02 = worldTransform.tx
                , a10 = worldTransform.b
                , a11 = worldTransform.d
                , a12 = worldTransform.ty
                , id = 1 / (a00 * a11 + a01 * -a10);
            point = point || new PIXI.Point;
            point.x = a11 * id * global.x + -a01 * id * global.y + (a12 * a01 - a02 * a11) * id;
            point.y = a00 * id * global.y + -a10 * id * global.x + (-a12 * a00 + a02 * a10) * id;
            return point
        }
        ;
        PIXI.InteractionData.prototype.constructor = PIXI.InteractionData;
        PIXI.InteractionManager = function (stage) {
            this.stage = stage;
            this.mouse = new PIXI.InteractionData;
            this.touches = {};
            this.tempPoint = new PIXI.Point;
            this.mouseoverEnabled = true;
            this.pool = [];
            this.interactiveItems = [];
            this.interactionDOMElement = null;
            this.onMouseMove = this.onMouseMove.bind(this);
            this.onMouseDown = this.onMouseDown.bind(this);
            this.onMouseOut = this.onMouseOut.bind(this);
            this.onMouseUp = this.onMouseUp.bind(this);
            this.onTouchStart = this.onTouchStart.bind(this);
            this.onTouchEnd = this.onTouchEnd.bind(this);
            this.onTouchMove = this.onTouchMove.bind(this);
            this.last = 0;
            this.currentCursorStyle = "inherit";
            this.mouseOut = false;
            this.resolution = 1;
            this._tempPoint = new PIXI.Point
        }
        ;
        PIXI.InteractionManager.prototype.constructor = PIXI.InteractionManager;
        PIXI.InteractionManager.prototype.collectInteractiveSprite = function (displayObject, iParent) {
            var children = displayObject.children;
            var length = children.length;
            for (var i = length - 1; i >= 0; i--) {
                var child = children[i];
                if (child._interactive) {
                    iParent.interactiveChildren = true;
                    this.interactiveItems.push(child);
                    if (child.children.length > 0) {
                        this.collectInteractiveSprite(child, child)
                    }
                } else {
                    child.__iParent = null;
                    if (child.children.length > 0) {
                        this.collectInteractiveSprite(child, iParent)
                    }
                }
            }
        }
        ;
        PIXI.InteractionManager.prototype.setTarget = function (target) {
            this.target = target;
            this.resolution = target.resolution;
            if (this.interactionDOMElement !== null)
                return;
            this.setTargetDomElement(target.view)
        }
        ;
        PIXI.InteractionManager.prototype.setTargetDomElement = function (domElement) {
            this.removeEvents();
            if (window.navigator.msPointerEnabled) {
                domElement.style["-ms-content-zooming"] = "none";
                domElement.style["-ms-touch-action"] = "none"
            }
            this.interactionDOMElement = domElement;
            domElement.addEventListener("mousemove", this.onMouseMove, true);
            domElement.addEventListener("mousedown", this.onMouseDown, true);
            domElement.addEventListener("mouseout", this.onMouseOut, true);
            domElement.addEventListener("touchstart", this.onTouchStart, true);
            domElement.addEventListener("touchend", this.onTouchEnd, true);
            domElement.addEventListener("touchmove", this.onTouchMove, true);
            window.addEventListener("mouseup", this.onMouseUp, true)
        }
        ;
        PIXI.InteractionManager.prototype.removeEvents = function () {
            if (!this.interactionDOMElement)
                return;
            this.interactionDOMElement.style["-ms-content-zooming"] = "";
            this.interactionDOMElement.style["-ms-touch-action"] = "";
            this.interactionDOMElement.removeEventListener("mousemove", this.onMouseMove, true);
            this.interactionDOMElement.removeEventListener("mousedown", this.onMouseDown, true);
            this.interactionDOMElement.removeEventListener("mouseout", this.onMouseOut, true);
            this.interactionDOMElement.removeEventListener("touchstart", this.onTouchStart, true);
            this.interactionDOMElement.removeEventListener("touchend", this.onTouchEnd, true);
            this.interactionDOMElement.removeEventListener("touchmove", this.onTouchMove, true);
            this.interactionDOMElement = null;
            window.removeEventListener("mouseup", this.onMouseUp, true)
        }
        ;
        PIXI.InteractionManager.prototype.update = function () {
            if (!this.target)
                return;
            var now = Date.now();
            var diff = now - this.last;
            diff = diff * PIXI.INTERACTION_FREQUENCY / 1e3;
            if (diff < 1)
                return;
            this.last = now;
            var i = 0;
            if (this.dirty) {
                this.rebuildInteractiveGraph()
            }
            var length = this.interactiveItems.length;
            var cursor = "inherit";
            var over = false;
            for (i = 0; i < length; i++) {
                var item = this.interactiveItems[i];
                item.__hit = this.hitTest(item, this.mouse);
                this.mouse.target = item;
                if (item.__hit && !over) {
                    if (item.buttonMode)
                        cursor = item.defaultCursor;
                    if (!item.interactiveChildren) {
                        over = true
                    }
                    if (!item.__isOver) {
                        if (item.mouseover) {
                            item.mouseover(this.mouse)
                        }
                        item.__isOver = true
                    }
                } else {
                    if (item.__isOver) {
                        if (item.mouseout) {
                            item.mouseout(this.mouse)
                        }
                        item.__isOver = false
                    }
                }
            }
            if (this.currentCursorStyle !== cursor) {
                this.currentCursorStyle = cursor;
                this.interactionDOMElement.style.cursor = cursor
            }
        }
        ;
        PIXI.InteractionManager.prototype.rebuildInteractiveGraph = function () {
            this.dirty = false;
            var len = this.interactiveItems.length;
            for (var i = 0; i < len; i++) {
                this.interactiveItems[i].interactiveChildren = false
            }
            this.interactiveItems = [];
            if (this.stage.interactive) {
                this.interactiveItems.push(this.stage)
            }
            this.collectInteractiveSprite(this.stage, this.stage)
        }
        ;
        PIXI.InteractionManager.prototype.onMouseMove = function (event) {
            if (this.dirty) {
                this.rebuildInteractiveGraph()
            }
            this.mouse.originalEvent = event;
            var rect = this.interactionDOMElement.getBoundingClientRect();
            this.mouse.global.x = (event.clientX - rect.left) * (this.target.width / rect.width) / this.resolution;
            this.mouse.global.y = (event.clientY - rect.top) * (this.target.height / rect.height) / this.resolution;
            var length = this.interactiveItems.length;
            for (var i = 0; i < length; i++) {
                var item = this.interactiveItems[i];
                if (item.mousemove) {
                    item.mousemove(this.mouse)
                }
            }
        }
        ;
        PIXI.InteractionManager.prototype.onMouseDown = function (event) {
            if (this.dirty) {
                this.rebuildInteractiveGraph()
            }
            this.mouse.originalEvent = event;
            if (PIXI.AUTO_PREVENT_DEFAULT) {
                this.mouse.originalEvent.preventDefault()
            }
            var length = this.interactiveItems.length;
            var e = this.mouse.originalEvent;
            var isRightButton = e.button === 2 || e.which === 3;
            var downFunction = isRightButton ? "rightdown" : "mousedown";
            var clickFunction = isRightButton ? "rightclick" : "click";
            var buttonIsDown = isRightButton ? "__rightIsDown" : "__mouseIsDown";
            var isDown = isRightButton ? "__isRightDown" : "__isDown";
            for (var i = 0; i < length; i++) {
                var item = this.interactiveItems[i];
                if (item[downFunction] || item[clickFunction]) {
                    item[buttonIsDown] = true;
                    item.__hit = this.hitTest(item, this.mouse);
                    if (item.__hit) {
                        if (item[downFunction]) {
                            item[downFunction](this.mouse)
                        }
                        item[isDown] = true;
                        if (!item.interactiveChildren)
                            break
                    }
                }
            }
        }
        ;
        PIXI.InteractionManager.prototype.onMouseOut = function (event) {
            if (this.dirty) {
                this.rebuildInteractiveGraph()
            }
            this.mouse.originalEvent = event;
            var length = this.interactiveItems.length;
            this.interactionDOMElement.style.cursor = "inherit";
            for (var i = 0; i < length; i++) {
                var item = this.interactiveItems[i];
                if (item.__isOver) {
                    this.mouse.target = item;
                    if (item.mouseout) {
                        item.mouseout(this.mouse)
                    }
                    item.__isOver = false
                }
            }
            this.mouseOut = true;
            this.mouse.global.x = -1e4;
            this.mouse.global.y = -1e4
        }
        ;
        PIXI.InteractionManager.prototype.onMouseUp = function (event) {
            if (this.dirty) {
                this.rebuildInteractiveGraph()
            }
            this.mouse.originalEvent = event;
            var length = this.interactiveItems.length;
            var up = false;
            var e = this.mouse.originalEvent;
            var isRightButton = e.button === 2 || e.which === 3;
            var upFunction = isRightButton ? "rightup" : "mouseup";
            var clickFunction = isRightButton ? "rightclick" : "click";
            var upOutsideFunction = isRightButton ? "rightupoutside" : "mouseupoutside";
            var isDown = isRightButton ? "__isRightDown" : "__isDown";
            for (var i = 0; i < length; i++) {
                var item = this.interactiveItems[i];
                if (item[clickFunction] || item[upFunction] || item[upOutsideFunction]) {
                    item.__hit = this.hitTest(item, this.mouse);
                    if (item.__hit && !up) {
                        if (item[upFunction]) {
                            item[upFunction](this.mouse)
                        }
                        if (item[isDown]) {
                            if (item[clickFunction]) {
                                item[clickFunction](this.mouse)
                            }
                        }
                        if (!item.interactiveChildren) {
                            up = true
                        }
                    } else {
                        if (item[isDown]) {
                            if (item[upOutsideFunction])
                                item[upOutsideFunction](this.mouse)
                        }
                    }
                    item[isDown] = false
                }
            }
        }
        ;
        PIXI.InteractionManager.prototype.hitTest = function (item, interactionData) {
            var global = interactionData.global;
            if (!item.worldVisible) {
                return false
            }
            item.worldTransform.applyInverse(global, this._tempPoint);
            var x = this._tempPoint.x, y = this._tempPoint.y, i;
            interactionData.target = item;
            if (item.hitArea && item.hitArea.contains) {
                return item.hitArea.contains(x, y)
            } else if (item instanceof PIXI.Sprite) {
                var width = item.texture.frame.width;
                var height = item.texture.frame.height;
                var x1 = -width * item.anchor.x;
                var y1;
                if (x > x1 && x < x1 + width) {
                    y1 = -height * item.anchor.y;
                    if (y > y1 && y < y1 + height) {
                        return true
                    }
                }
            } else if (item instanceof PIXI.Graphics) {
                var graphicsData = item.graphicsData;
                for (i = 0; i < graphicsData.length; i++) {
                    var data = graphicsData[i];
                    if (!data.fill)
                        continue;
                    if (data.shape) {
                        if (data.shape.contains(x, y)) {
                            return true
                        }
                    }
                }
            }
            var length = item.children.length;
            for (i = 0; i < length; i++) {
                var tempItem = item.children[i];
                var hit = this.hitTest(tempItem, interactionData);
                if (hit) {
                    interactionData.target = item;
                    return true
                }
            }
            return false
        }
        ;
        PIXI.InteractionManager.prototype.onTouchMove = function (event) {
            if (this.dirty) {
                this.rebuildInteractiveGraph()
            }
            var rect = this.interactionDOMElement.getBoundingClientRect();
            var changedTouches = event.changedTouches;
            var touchData;
            var i = 0;
            for (i = 0; i < changedTouches.length; i++) {
                var touchEvent = changedTouches[i];
                touchData = this.touches[touchEvent.identifier];
                touchData.originalEvent = event;
                touchData.global.x = (touchEvent.clientX - rect.left) * (this.target.width / rect.width) / this.resolution;
                touchData.global.y = (touchEvent.clientY - rect.top) * (this.target.height / rect.height) / this.resolution;
                if (navigator.isCocoonJS && !rect.left && !rect.top && !event.target.style.width && !event.target.style.height) {
                    touchData.global.x = touchEvent.clientX;
                    touchData.global.y = touchEvent.clientY
                }
                for (var j = 0; j < this.interactiveItems.length; j++) {
                    var item = this.interactiveItems[j];
                    if (item.touchmove && item.__touchData && item.__touchData[touchEvent.identifier]) {
                        item.touchmove(touchData)
                    }
                }
            }
        }
        ;
        PIXI.InteractionManager.prototype.onTouchStart = function (event) {
            if (this.dirty) {
                this.rebuildInteractiveGraph()
            }
            var rect = this.interactionDOMElement.getBoundingClientRect();
            if (PIXI.AUTO_PREVENT_DEFAULT) {
                event.preventDefault()
            }
            var changedTouches = event.changedTouches;
            for (var i = 0; i < changedTouches.length; i++) {
                var touchEvent = changedTouches[i];
                var touchData = this.pool.pop();
                if (!touchData) {
                    touchData = new PIXI.InteractionData
                }
                touchData.originalEvent = event;
                this.touches[touchEvent.identifier] = touchData;
                touchData.global.x = (touchEvent.clientX - rect.left) * (this.target.width / rect.width) / this.resolution;
                touchData.global.y = (touchEvent.clientY - rect.top) * (this.target.height / rect.height) / this.resolution;
                if (navigator.isCocoonJS && !rect.left && !rect.top && !event.target.style.width && !event.target.style.height) {
                    touchData.global.x = touchEvent.clientX;
                    touchData.global.y = touchEvent.clientY
                }
                var length = this.interactiveItems.length;
                for (var j = 0; j < length; j++) {
                    var item = this.interactiveItems[j];
                    if (item.touchstart || item.tap) {
                        item.__hit = this.hitTest(item, touchData);
                        if (item.__hit) {
                            if (item.touchstart)
                                item.touchstart(touchData);
                            item.__isDown = true;
                            item.__touchData = item.__touchData || {};
                            item.__touchData[touchEvent.identifier] = touchData;
                            if (!item.interactiveChildren)
                                break
                        }
                    }
                }
            }
        }
        ;
        PIXI.InteractionManager.prototype.onTouchEnd = function (event) {
            if (this.dirty) {
                this.rebuildInteractiveGraph()
            }
            var rect = this.interactionDOMElement.getBoundingClientRect();
            var changedTouches = event.changedTouches;
            for (var i = 0; i < changedTouches.length; i++) {
                var touchEvent = changedTouches[i];
                var touchData = this.touches[touchEvent.identifier];
                var up = false;
                touchData.global.x = (touchEvent.clientX - rect.left) * (this.target.width / rect.width) / this.resolution;
                touchData.global.y = (touchEvent.clientY - rect.top) * (this.target.height / rect.height) / this.resolution;
                if (navigator.isCocoonJS && !rect.left && !rect.top && !event.target.style.width && !event.target.style.height) {
                    touchData.global.x = touchEvent.clientX;
                    touchData.global.y = touchEvent.clientY
                }
                var length = this.interactiveItems.length;
                for (var j = 0; j < length; j++) {
                    var item = this.interactiveItems[j];
                    if (item.__touchData && item.__touchData[touchEvent.identifier]) {
                        item.__hit = this.hitTest(item, item.__touchData[touchEvent.identifier]);
                        touchData.originalEvent = event;
                        if (item.touchend || item.tap) {
                            if (item.__hit && !up) {
                                if (item.touchend) {
                                    item.touchend(touchData)
                                }
                                if (item.__isDown && item.tap) {
                                    item.tap(touchData)
                                }
                                if (!item.interactiveChildren) {
                                    up = true
                                }
                            } else {
                                if (item.__isDown && item.touchendoutside) {
                                    item.touchendoutside(touchData)
                                }
                            }
                            item.__isDown = false
                        }
                        item.__touchData[touchEvent.identifier] = null
                    }
                }
                this.pool.push(touchData);
                this.touches[touchEvent.identifier] = null
            }
        }
        ;
        PIXI.Stage = function (backgroundColor) {
            PIXI.DisplayObjectContainer.call(this);
            this.worldTransform = new PIXI.Matrix;
            this.interactive = true;
            this.interactionManager = new PIXI.InteractionManager(this);
            this.dirty = true;
            this.stage = this;
            this.stage.hitArea = new PIXI.Rectangle(0, 0, 1e5, 1e5);
            this.setBackgroundColor(backgroundColor)
        }
        ;
        PIXI.Stage.prototype = Object.create(PIXI.DisplayObjectContainer.prototype);
        PIXI.Stage.prototype.constructor = PIXI.Stage;
        PIXI.Stage.prototype.setInteractionDelegate = function (domElement) {
            this.interactionManager.setTargetDomElement(domElement)
        }
        ;
        PIXI.Stage.prototype.updateTransform = function () {
            this.worldAlpha = 1;
            for (var i = 0, j = this.children.length; i < j; i++) {
                this.children[i].updateTransform()
            }
            if (this.dirty) {
                this.dirty = false;
                this.interactionManager.dirty = true
            }
            if (this.interactive)
                this.interactionManager.update()
        }
        ;
        PIXI.Stage.prototype.setBackgroundColor = function (backgroundColor) {
            this.backgroundColor = backgroundColor || 0;
            this.backgroundColorSplit = PIXI.hex2rgb(this.backgroundColor);
            var hex = this.backgroundColor.toString(16);
            hex = "000000".substr(0, 6 - hex.length) + hex;
            this.backgroundColorString = "#" + hex
        }
        ;
        PIXI.Stage.prototype.getMousePosition = function () {
            return this.interactionManager.mouse.global
        }
        ;
        (function (window) {
                var lastTime = 0;
                var vendors = ["ms", "moz", "webkit", "o"];
                for (var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
                    window.requestAnimationFrame = window[vendors[x] + "RequestAnimationFrame"];
                    window.cancelAnimationFrame = window[vendors[x] + "CancelAnimationFrame"] || window[vendors[x] + "CancelRequestAnimationFrame"]
                }
                if (!window.requestAnimationFrame) {
                    window.requestAnimationFrame = function (callback) {
                        var currTime = (new Date).getTime();
                        var timeToCall = Math.max(0, 16 - (currTime - lastTime));
                        var id = window.setTimeout(function () {
                            callback(currTime + timeToCall)
                        }, timeToCall);
                        lastTime = currTime + timeToCall;
                        return id
                    }
                }
                if (!window.cancelAnimationFrame) {
                    window.cancelAnimationFrame = function (id) {
                        clearTimeout(id)
                    }
                }
                window.requestAnimFrame = window.requestAnimationFrame
            }
        )(this);
        PIXI.hex2rgb = function (hex) {
            return [(hex >> 16 & 255) / 255, (hex >> 8 & 255) / 255, (hex & 255) / 255]
        }
        ;
        PIXI.rgb2hex = function (rgb) {
            return (rgb[0] * 255 << 16) + (rgb[1] * 255 << 8) + rgb[2] * 255
        }
        ;
        if (typeof Function.prototype.bind !== "function") {
            Function.prototype.bind = function () {
                return function (thisArg) {
                    var target = this
                        , i = arguments.length - 1
                        , boundArgs = [];
                    if (i > 0) {
                        boundArgs.length = i;
                        while (i--)
                            boundArgs[i] = arguments[i + 1]
                    }
                    if (typeof target !== "function")
                        throw new TypeError;

                    function bound() {
                        var i = arguments.length
                            , args = new Array(i);
                        while (i--)
                            args[i] = arguments[i];
                        args = boundArgs.concat(args);
                        return target.apply(this instanceof bound ? this : thisArg, args)
                    }

                    bound.prototype = function F(proto) {
                        if (proto)
                            F.prototype = proto;
                        if (!(this instanceof F))
                            return new F
                    }(target.prototype);
                    return bound
                }
            }()
        }
        PIXI.AjaxRequest = function () {
            var activexmodes = ["Msxml2.XMLHTTP.6.0", "Msxml2.XMLHTTP.3.0", "Microsoft.XMLHTTP"];
            if (window.ActiveXObject) {
                for (var i = 0; i < activexmodes.length; i++) {
                    try {
                        return new window.ActiveXObject(activexmodes[i])
                    } catch (e) {
                    }
                }
            } else if (window.XMLHttpRequest) {
                return new window.XMLHttpRequest
            } else {
                return false
            }
        }
        ;
        PIXI.canUseNewCanvasBlendModes = function () {
            if (typeof document === "undefined")
                return false;
            var canvas = document.createElement("canvas");
            canvas.width = 1;
            canvas.height = 1;
            var context = canvas.getContext("2d");
            context.fillStyle = "#000";
            context.fillRect(0, 0, 1, 1);
            context.globalCompositeOperation = "multiply";
            context.fillStyle = "#fff";
            context.fillRect(0, 0, 1, 1);
            return context.getImageData(0, 0, 1, 1).data[0] === 0
        }
        ;
        PIXI.getNextPowerOfTwo = function (number) {
            if (number > 0 && (number & number - 1) === 0)
                return number;
            else {
                var result = 1;
                while (result < number)
                    result <<= 1;
                return result
            }
        }
        ;
        PIXI.isPowerOfTwo = function (width, height) {
            return width > 0 && (width & width - 1) === 0 && height > 0 && (height & height - 1) === 0
        }
        ;
        PIXI.EventTarget = {
            call: function callCompat(obj) {
                if (obj) {
                    obj = obj.prototype || obj;
                    PIXI.EventTarget.mixin(obj)
                }
            },
            mixin: function mixin(obj) {
                obj.listeners = function listeners(eventName) {
                    this._listeners = this._listeners || {};
                    return this._listeners[eventName] ? this._listeners[eventName].slice() : []
                }
                ;
                obj.emit = obj.dispatchEvent = function emit(eventName, data) {
                    this._listeners = this._listeners || {};
                    if (typeof eventName === "object") {
                        data = eventName;
                        eventName = eventName.type
                    }
                    if (!data || data.__isEventObject !== true) {
                        data = new PIXI.Event(this, eventName, data)
                    }
                    if (this._listeners && this._listeners[eventName]) {
                        var listeners = this._listeners[eventName].slice(0), length = listeners.length,
                            fn = listeners[0], i;
                        for (i = 0; i < length; fn = listeners[++i]) {
                            fn.call(this, data);
                            if (data.stoppedImmediate) {
                                return this
                            }
                        }
                        if (data.stopped) {
                            return this
                        }
                    }
                    if (this.parent && this.parent.emit) {
                        this.parent.emit.call(this.parent, eventName, data)
                    }
                    return this
                }
                ;
                obj.on = obj.addEventListener = function on(eventName, fn) {
                    this._listeners = this._listeners || {};
                    (this._listeners[eventName] = this._listeners[eventName] || []).push(fn);
                    return this
                }
                ;
                obj.once = function once(eventName, fn) {
                    this._listeners = this._listeners || {};
                    var self = this;

                    function onceHandlerWrapper() {
                        fn.apply(self.off(eventName, onceHandlerWrapper), arguments)
                    }

                    onceHandlerWrapper._originalHandler = fn;
                    return this.on(eventName, onceHandlerWrapper)
                }
                ;
                obj.off = obj.removeEventListener = function off(eventName, fn) {
                    this._listeners = this._listeners || {};
                    if (!this._listeners[eventName])
                        return this;
                    var list = this._listeners[eventName]
                        , i = fn ? list.length : 0;
                    while (i-- > 0) {
                        if (list[i] === fn || list[i]._originalHandler === fn) {
                            list.splice(i, 1)
                        }
                    }
                    if (list.length === 0) {
                        delete this._listeners[eventName]
                    }
                    return this
                }
                ;
                obj.removeAllListeners = function removeAllListeners(eventName) {
                    this._listeners = this._listeners || {};
                    if (!this._listeners[eventName])
                        return this;
                    delete this._listeners[eventName];
                    return this
                }
            }
        };
        PIXI.Event = function (target, name, data) {
            this.__isEventObject = true;
            this.stopped = false;
            this.stoppedImmediate = false;
            this.target = target;
            this.type = name;
            this.data = data;
            this.content = data;
            this.timeStamp = Date.now()
        }
        ;
        PIXI.Event.prototype.stopPropagation = function stopPropagation() {
            this.stopped = true
        }
        ;
        PIXI.Event.prototype.stopImmediatePropagation = function stopImmediatePropagation() {
            this.stoppedImmediate = true
        }
        ;
        PIXI.autoDetectRenderer = function (width, height, options) {
            if (!width)
                width = 800;
            if (!height)
                height = 600;
            var webgl = function () {
                try {
                    var canvas = document.createElement("canvas");
                    return !!window.WebGLRenderingContext && (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
                } catch (e) {
                    return false
                }
            }();
            if (webgl) {
                return new PIXI.WebGLRenderer(width, height, options)
            }
            return new PIXI.CanvasRenderer(width, height, options)
        }
        ;
        PIXI.autoDetectRecommendedRenderer = function (width, height, options) {
            if (!width)
                width = 800;
            if (!height)
                height = 600;
            var webgl = function () {
                try {
                    var canvas = document.createElement("canvas");
                    return !!window.WebGLRenderingContext && (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
                } catch (e) {
                    return false
                }
            }();
            var isAndroid = /Android/i.test(navigator.userAgent);
            if (webgl && !isAndroid) {
                return new PIXI.WebGLRenderer(width, height, options)
            }
            return new PIXI.CanvasRenderer(width, height, options)
        }
        ;
        PIXI.PolyK = {};
        PIXI.PolyK.Triangulate = function (p) {
            var sign = true;
            var n = p.length >> 1;
            if (n < 3)
                return [];
            var tgs = [];
            var avl = [];
            for (var i = 0; i < n; i++)
                avl.push(i);
            i = 0;
            var al = n;
            while (al > 3) {
                var i0 = avl[(i + 0) % al];
                var i1 = avl[(i + 1) % al];
                var i2 = avl[(i + 2) % al];
                var ax = p[2 * i0]
                    , ay = p[2 * i0 + 1];
                var bx = p[2 * i1]
                    , by = p[2 * i1 + 1];
                var cx = p[2 * i2]
                    , cy = p[2 * i2 + 1];
                var earFound = false;
                if (PIXI.PolyK._convex(ax, ay, bx, by, cx, cy, sign)) {
                    earFound = true;
                    for (var j = 0; j < al; j++) {
                        var vi = avl[j];
                        if (vi === i0 || vi === i1 || vi === i2)
                            continue;
                        if (PIXI.PolyK._PointInTriangle(p[2 * vi], p[2 * vi + 1], ax, ay, bx, by, cx, cy)) {
                            earFound = false;
                            break
                        }
                    }
                }
                if (earFound) {
                    tgs.push(i0, i1, i2);
                    avl.splice((i + 1) % al, 1);
                    al--;
                    i = 0
                } else if (i++ > 3 * al) {
                    if (sign) {
                        tgs = [];
                        avl = [];
                        for (i = 0; i < n; i++)
                            avl.push(i);
                        i = 0;
                        al = n;
                        sign = false
                    } else {
                        return null
                    }
                }
            }
            tgs.push(avl[0], avl[1], avl[2]);
            return tgs
        }
        ;
        PIXI.PolyK._PointInTriangle = function (px, py, ax, ay, bx, by, cx, cy) {
            var v0x = cx - ax;
            var v0y = cy - ay;
            var v1x = bx - ax;
            var v1y = by - ay;
            var v2x = px - ax;
            var v2y = py - ay;
            var dot00 = v0x * v0x + v0y * v0y;
            var dot01 = v0x * v1x + v0y * v1y;
            var dot02 = v0x * v2x + v0y * v2y;
            var dot11 = v1x * v1x + v1y * v1y;
            var dot12 = v1x * v2x + v1y * v2y;
            var invDenom = 1 / (dot00 * dot11 - dot01 * dot01);
            var u = (dot11 * dot02 - dot01 * dot12) * invDenom;
            var v = (dot00 * dot12 - dot01 * dot02) * invDenom;
            return u >= 0 && v >= 0 && u + v < 1
        }
        ;
        PIXI.PolyK._convex = function (ax, ay, bx, by, cx, cy, sign) {
            return (ay - by) * (cx - bx) + (bx - ax) * (cy - by) >= 0 === sign
        }
        ;
        PIXI.initDefaultShaders = function () {
        }
        ;
        PIXI.CompileVertexShader = function (gl, shaderSrc) {
            return PIXI._CompileShader(gl, shaderSrc, gl.VERTEX_SHADER)
        }
        ;
        PIXI.CompileFragmentShader = function (gl, shaderSrc) {
            return PIXI._CompileShader(gl, shaderSrc, gl.FRAGMENT_SHADER)
        }
        ;
        PIXI._CompileShader = function (gl, shaderSrc, shaderType) {
            var src = shaderSrc.join("\n");
            var shader = gl.createShader(shaderType);
            gl.shaderSource(shader, src);
            gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                window.console.log(gl.getShaderInfoLog(shader));
                return null
            }
            return shader
        }
        ;
        PIXI.compileProgram = function (gl, vertexSrc, fragmentSrc) {
            var fragmentShader = PIXI.CompileFragmentShader(gl, fragmentSrc);
            var vertexShader = PIXI.CompileVertexShader(gl, vertexSrc);
            var shaderProgram = gl.createProgram();
            gl.attachShader(shaderProgram, vertexShader);
            gl.attachShader(shaderProgram, fragmentShader);
            gl.linkProgram(shaderProgram);
            if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
                window.console.log("Could not initialise shaders")
            }
            return shaderProgram
        }
        ;
        PIXI.PixiShader = function (gl) {
            this._UID = PIXI._UID++;
            this.gl = gl;
            this.program = null;
            this.fragmentSrc = ["precision lowp float;", "varying vec2 vTextureCoord;", "varying vec4 vColor;", "uniform sampler2D uSampler;", "void main(void) {", "   gl_FragColor = texture2D(uSampler, vTextureCoord) * vColor ;", "}"];
            this.textureCount = 0;
            this.firstRun = true;
            this.dirty = true;
            this.attributes = [];
            this.init()
        }
        ;
        PIXI.PixiShader.prototype.constructor = PIXI.PixiShader;
        PIXI.PixiShader.prototype.init = function () {
            var gl = this.gl;
            var program = PIXI.compileProgram(gl, this.vertexSrc || PIXI.PixiShader.defaultVertexSrc, this.fragmentSrc);
            gl.useProgram(program);
            this.uSampler = gl.getUniformLocation(program, "uSampler");
            this.projectionVector = gl.getUniformLocation(program, "projectionVector");
            this.offsetVector = gl.getUniformLocation(program, "offsetVector");
            this.dimensions = gl.getUniformLocation(program, "dimensions");
            this.aVertexPosition = gl.getAttribLocation(program, "aVertexPosition");
            this.aTextureCoord = gl.getAttribLocation(program, "aTextureCoord");
            this.colorAttribute = gl.getAttribLocation(program, "aColor");
            if (this.colorAttribute === -1) {
                this.colorAttribute = 2
            }
            this.attributes = [this.aVertexPosition, this.aTextureCoord, this.colorAttribute];
            for (var key in this.uniforms) {
                this.uniforms[key].uniformLocation = gl.getUniformLocation(program, key)
            }
            this.initUniforms();
            this.program = program
        }
        ;
        PIXI.PixiShader.prototype.initUniforms = function () {
            this.textureCount = 1;
            var gl = this.gl;
            var uniform;
            for (var key in this.uniforms) {
                uniform = this.uniforms[key];
                var type = uniform.type;
                if (type === "sampler2D") {
                    uniform._init = false;
                    if (uniform.value !== null) {
                        this.initSampler2D(uniform)
                    }
                } else if (type === "mat2" || type === "mat3" || type === "mat4") {
                    uniform.glMatrix = true;
                    uniform.glValueLength = 1;
                    if (type === "mat2") {
                        uniform.glFunc = gl.uniformMatrix2fv
                    } else if (type === "mat3") {
                        uniform.glFunc = gl.uniformMatrix3fv
                    } else if (type === "mat4") {
                        uniform.glFunc = gl.uniformMatrix4fv
                    }
                } else {
                    uniform.glFunc = gl["uniform" + type];
                    if (type === "2f" || type === "2i") {
                        uniform.glValueLength = 2
                    } else if (type === "3f" || type === "3i") {
                        uniform.glValueLength = 3
                    } else if (type === "4f" || type === "4i") {
                        uniform.glValueLength = 4
                    } else {
                        uniform.glValueLength = 1
                    }
                }
            }
        }
        ;
        PIXI.PixiShader.prototype.initSampler2D = function (uniform) {
            if (!uniform.value || !uniform.value.baseTexture || !uniform.value.baseTexture.hasLoaded) {
                return
            }
            var gl = this.gl;
            gl.activeTexture(gl["TEXTURE" + this.textureCount]);
            gl.bindTexture(gl.TEXTURE_2D, uniform.value.baseTexture._glTextures[gl.id]);
            if (uniform.textureData) {
                var data = uniform.textureData;
                var magFilter = data.magFilter ? data.magFilter : gl.LINEAR;
                var minFilter = data.minFilter ? data.minFilter : gl.LINEAR;
                var wrapS = data.wrapS ? data.wrapS : gl.CLAMP_TO_EDGE;
                var wrapT = data.wrapT ? data.wrapT : gl.CLAMP_TO_EDGE;
                var format = data.luminance ? gl.LUMINANCE : gl.RGBA;
                if (data.repeat) {
                    wrapS = gl.REPEAT;
                    wrapT = gl.REPEAT
                }
                gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, !!data.flipY);
                if (data.width) {
                    var width = data.width ? data.width : 512;
                    var height = data.height ? data.height : 2;
                    var border = data.border ? data.border : 0;
                    gl.texImage2D(gl.TEXTURE_2D, 0, format, width, height, border, format, gl.UNSIGNED_BYTE, null)
                } else {
                    gl.texImage2D(gl.TEXTURE_2D, 0, format, gl.RGBA, gl.UNSIGNED_BYTE, uniform.value.baseTexture.source)
                }
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, magFilter);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minFilter);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapS);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapT)
            }
            gl.uniform1i(uniform.uniformLocation, this.textureCount);
            uniform._init = true;
            this.textureCount++
        }
        ;
        PIXI.PixiShader.prototype.syncUniforms = function () {
            this.textureCount = 1;
            var uniform;
            var gl = this.gl;
            for (var key in this.uniforms) {
                uniform = this.uniforms[key];
                if (uniform.glValueLength === 1) {
                    if (uniform.glMatrix === true) {
                        uniform.glFunc.call(gl, uniform.uniformLocation, uniform.transpose, uniform.value)
                    } else {
                        uniform.glFunc.call(gl, uniform.uniformLocation, uniform.value)
                    }
                } else if (uniform.glValueLength === 2) {
                    uniform.glFunc.call(gl, uniform.uniformLocation, uniform.value.x, uniform.value.y)
                } else if (uniform.glValueLength === 3) {
                    uniform.glFunc.call(gl, uniform.uniformLocation, uniform.value.x, uniform.value.y, uniform.value.z)
                } else if (uniform.glValueLength === 4) {
                    uniform.glFunc.call(gl, uniform.uniformLocation, uniform.value.x, uniform.value.y, uniform.value.z, uniform.value.w)
                } else if (uniform.type === "sampler2D") {
                    if (uniform._init) {
                        gl.activeTexture(gl["TEXTURE" + this.textureCount]);
                        if (uniform.value.baseTexture._dirty[gl.id]) {
                            PIXI.instances[gl.id].updateTexture(uniform.value.baseTexture)
                        } else {
                            gl.bindTexture(gl.TEXTURE_2D, uniform.value.baseTexture._glTextures[gl.id])
                        }
                        gl.uniform1i(uniform.uniformLocation, this.textureCount);
                        this.textureCount++
                    } else {
                        this.initSampler2D(uniform)
                    }
                }
            }
        }
        ;
        PIXI.PixiShader.prototype.destroy = function () {
            this.gl.deleteProgram(this.program);
            this.uniforms = null;
            this.gl = null;
            this.attributes = null
        }
        ;
        PIXI.PixiShader.defaultVertexSrc = ["attribute vec2 aVertexPosition;", "attribute vec2 aTextureCoord;", "attribute vec4 aColor;", "uniform vec2 projectionVector;", "uniform vec2 offsetVector;", "varying vec2 vTextureCoord;", "varying vec4 vColor;", "const vec2 center = vec2(-1.0, 1.0);", "void main(void) {", "   gl_Position = vec4( ((aVertexPosition + offsetVector) / projectionVector) + center , 0.0, 1.0);", "   vTextureCoord = aTextureCoord;", "   vColor = vec4(aColor.rgb * aColor.a, aColor.a);", "}"];
        PIXI.PixiFastShader = function (gl) {
            this._UID = PIXI._UID++;
            this.gl = gl;
            this.program = null;
            this.fragmentSrc = ["precision lowp float;", "varying vec2 vTextureCoord;", "varying float vColor;", "uniform sampler2D uSampler;", "void main(void) {", "   gl_FragColor = texture2D(uSampler, vTextureCoord) * vColor ;", "}"];
            this.vertexSrc = ["attribute vec2 aVertexPosition;", "attribute vec2 aPositionCoord;", "attribute vec2 aScale;", "attribute float aRotation;", "attribute vec2 aTextureCoord;", "attribute float aColor;", "uniform vec2 projectionVector;", "uniform vec2 offsetVector;", "uniform mat3 uMatrix;", "varying vec2 vTextureCoord;", "varying float vColor;", "const vec2 center = vec2(-1.0, 1.0);", "void main(void) {", "   vec2 v;", "   vec2 sv = aVertexPosition * aScale;", "   v.x = (sv.x) * cos(aRotation) - (sv.y) * sin(aRotation);", "   v.y = (sv.x) * sin(aRotation) + (sv.y) * cos(aRotation);", "   v = ( uMatrix * vec3(v + aPositionCoord , 1.0) ).xy ;", "   gl_Position = vec4( ( v / projectionVector) + center , 0.0, 1.0);", "   vTextureCoord = aTextureCoord;", "   vColor = aColor;", "}"];
            this.textureCount = 0;
            this.init()
        }
        ;
        PIXI.PixiFastShader.prototype.constructor = PIXI.PixiFastShader;
        PIXI.PixiFastShader.prototype.init = function () {
            var gl = this.gl;
            var program = PIXI.compileProgram(gl, this.vertexSrc, this.fragmentSrc);
            gl.useProgram(program);
            this.uSampler = gl.getUniformLocation(program, "uSampler");
            this.projectionVector = gl.getUniformLocation(program, "projectionVector");
            this.offsetVector = gl.getUniformLocation(program, "offsetVector");
            this.dimensions = gl.getUniformLocation(program, "dimensions");
            this.uMatrix = gl.getUniformLocation(program, "uMatrix");
            this.aVertexPosition = gl.getAttribLocation(program, "aVertexPosition");
            this.aPositionCoord = gl.getAttribLocation(program, "aPositionCoord");
            this.aScale = gl.getAttribLocation(program, "aScale");
            this.aRotation = gl.getAttribLocation(program, "aRotation");
            this.aTextureCoord = gl.getAttribLocation(program, "aTextureCoord");
            this.colorAttribute = gl.getAttribLocation(program, "aColor");
            if (this.colorAttribute === -1) {
                this.colorAttribute = 2
            }
            this.attributes = [this.aVertexPosition, this.aPositionCoord, this.aScale, this.aRotation, this.aTextureCoord, this.colorAttribute];
            this.program = program
        }
        ;
        PIXI.PixiFastShader.prototype.destroy = function () {
            this.gl.deleteProgram(this.program);
            this.uniforms = null;
            this.gl = null;
            this.attributes = null
        }
        ;
        PIXI.StripShader = function (gl) {
            this._UID = PIXI._UID++;
            this.gl = gl;
            this.program = null;
            this.fragmentSrc = ["precision mediump float;", "varying vec2 vTextureCoord;", "uniform float alpha;", "uniform sampler2D uSampler;", "void main(void) {", "   gl_FragColor = texture2D(uSampler, vec2(vTextureCoord.x, vTextureCoord.y)) * alpha;", "}"];
            this.vertexSrc = ["attribute vec2 aVertexPosition;", "attribute vec2 aTextureCoord;", "uniform mat3 translationMatrix;", "uniform vec2 projectionVector;", "uniform vec2 offsetVector;", "varying vec2 vTextureCoord;", "void main(void) {", "   vec3 v = translationMatrix * vec3(aVertexPosition , 1.0);", "   v -= offsetVector.xyx;", "   gl_Position = vec4( v.x / projectionVector.x -1.0, v.y / -projectionVector.y + 1.0 , 0.0, 1.0);", "   vTextureCoord = aTextureCoord;", "}"];
            this.init()
        }
        ;
        PIXI.StripShader.prototype.constructor = PIXI.StripShader;
        PIXI.StripShader.prototype.init = function () {
            var gl = this.gl;
            var program = PIXI.compileProgram(gl, this.vertexSrc, this.fragmentSrc);
            gl.useProgram(program);
            this.uSampler = gl.getUniformLocation(program, "uSampler");
            this.projectionVector = gl.getUniformLocation(program, "projectionVector");
            this.offsetVector = gl.getUniformLocation(program, "offsetVector");
            this.colorAttribute = gl.getAttribLocation(program, "aColor");
            this.aVertexPosition = gl.getAttribLocation(program, "aVertexPosition");
            this.aTextureCoord = gl.getAttribLocation(program, "aTextureCoord");
            this.attributes = [this.aVertexPosition, this.aTextureCoord];
            this.translationMatrix = gl.getUniformLocation(program, "translationMatrix");
            this.alpha = gl.getUniformLocation(program, "alpha");
            this.program = program
        }
        ;
        PIXI.StripShader.prototype.destroy = function () {
            this.gl.deleteProgram(this.program);
            this.uniforms = null;
            this.gl = null;
            this.attribute = null
        }
        ;
        PIXI.PrimitiveShader = function (gl) {
            this._UID = PIXI._UID++;
            this.gl = gl;
            this.program = null;
            this.fragmentSrc = ["precision mediump float;", "varying vec4 vColor;", "void main(void) {", "   gl_FragColor = vColor;", "}"];
            this.vertexSrc = ["attribute vec2 aVertexPosition;", "attribute vec4 aColor;", "uniform mat3 translationMatrix;", "uniform vec2 projectionVector;", "uniform vec2 offsetVector;", "uniform float alpha;", "uniform float flipY;", "uniform vec3 tint;", "varying vec4 vColor;", "void main(void) {", "   vec3 v = translationMatrix * vec3(aVertexPosition , 1.0);", "   v -= offsetVector.xyx;", "   gl_Position = vec4( v.x / projectionVector.x -1.0, (v.y / projectionVector.y * -flipY) + flipY , 0.0, 1.0);", "   vColor = aColor * vec4(tint * alpha, alpha);", "}"];
            this.init()
        }
        ;
        PIXI.PrimitiveShader.prototype.constructor = PIXI.PrimitiveShader;
        PIXI.PrimitiveShader.prototype.init = function () {
            var gl = this.gl;
            var program = PIXI.compileProgram(gl, this.vertexSrc, this.fragmentSrc);
            gl.useProgram(program);
            this.projectionVector = gl.getUniformLocation(program, "projectionVector");
            this.offsetVector = gl.getUniformLocation(program, "offsetVector");
            this.tintColor = gl.getUniformLocation(program, "tint");
            this.flipY = gl.getUniformLocation(program, "flipY");
            this.aVertexPosition = gl.getAttribLocation(program, "aVertexPosition");
            this.colorAttribute = gl.getAttribLocation(program, "aColor");
            this.attributes = [this.aVertexPosition, this.colorAttribute];
            this.translationMatrix = gl.getUniformLocation(program, "translationMatrix");
            this.alpha = gl.getUniformLocation(program, "alpha");
            this.program = program
        }
        ;
        PIXI.PrimitiveShader.prototype.destroy = function () {
            this.gl.deleteProgram(this.program);
            this.uniforms = null;
            this.gl = null;
            this.attributes = null
        }
        ;
        PIXI.ComplexPrimitiveShader = function (gl) {
            this._UID = PIXI._UID++;
            this.gl = gl;
            this.program = null;
            this.fragmentSrc = ["precision mediump float;", "varying vec4 vColor;", "void main(void) {", "   gl_FragColor = vColor;", "}"];
            this.vertexSrc = ["attribute vec2 aVertexPosition;", "uniform mat3 translationMatrix;", "uniform vec2 projectionVector;", "uniform vec2 offsetVector;", "uniform vec3 tint;", "uniform float alpha;", "uniform vec3 color;", "uniform float flipY;", "varying vec4 vColor;", "void main(void) {", "   vec3 v = translationMatrix * vec3(aVertexPosition , 1.0);", "   v -= offsetVector.xyx;", "   gl_Position = vec4( v.x / projectionVector.x -1.0, (v.y / projectionVector.y * -flipY) + flipY , 0.0, 1.0);", "   vColor = vec4(color * alpha * tint, alpha);", "}"];
            this.init()
        }
        ;
        PIXI.ComplexPrimitiveShader.prototype.constructor = PIXI.ComplexPrimitiveShader;
        PIXI.ComplexPrimitiveShader.prototype.init = function () {
            var gl = this.gl;
            var program = PIXI.compileProgram(gl, this.vertexSrc, this.fragmentSrc);
            gl.useProgram(program);
            this.projectionVector = gl.getUniformLocation(program, "projectionVector");
            this.offsetVector = gl.getUniformLocation(program, "offsetVector");
            this.tintColor = gl.getUniformLocation(program, "tint");
            this.color = gl.getUniformLocation(program, "color");
            this.flipY = gl.getUniformLocation(program, "flipY");
            this.aVertexPosition = gl.getAttribLocation(program, "aVertexPosition");
            this.attributes = [this.aVertexPosition, this.colorAttribute];
            this.translationMatrix = gl.getUniformLocation(program, "translationMatrix");
            this.alpha = gl.getUniformLocation(program, "alpha");
            this.program = program
        }
        ;
        PIXI.ComplexPrimitiveShader.prototype.destroy = function () {
            this.gl.deleteProgram(this.program);
            this.uniforms = null;
            this.gl = null;
            this.attribute = null
        }
        ;
        PIXI.WebGLGraphics = function () {
        }
        ;
        PIXI.WebGLGraphics.renderGraphics = function (graphics, renderSession) {
            var gl = renderSession.gl;
            var projection = renderSession.projection, offset = renderSession.offset,
                shader = renderSession.shaderManager.primitiveShader, webGLData;
            if (graphics.dirty) {
                PIXI.WebGLGraphics.updateGraphics(graphics, gl)
            }
            var webGL = graphics._webGL[gl.id];
            for (var i = 0; i < webGL.data.length; i++) {
                if (webGL.data[i].mode === 1) {
                    webGLData = webGL.data[i];
                    renderSession.stencilManager.pushStencil(graphics, webGLData, renderSession);
                    gl.drawElements(gl.TRIANGLE_FAN, 4, gl.UNSIGNED_SHORT, (webGLData.indices.length - 4) * 2);
                    renderSession.stencilManager.popStencil(graphics, webGLData, renderSession)
                } else {
                    webGLData = webGL.data[i];
                    renderSession.shaderManager.setShader(shader);
                    shader = renderSession.shaderManager.primitiveShader;
                    gl.uniformMatrix3fv(shader.translationMatrix, false, graphics.worldTransform.toArray(true));
                    gl.uniform1f(shader.flipY, 1);
                    gl.uniform2f(shader.projectionVector, projection.x, -projection.y);
                    gl.uniform2f(shader.offsetVector, -offset.x, -offset.y);
                    gl.uniform3fv(shader.tintColor, PIXI.hex2rgb(graphics.tint));
                    gl.uniform1f(shader.alpha, graphics.worldAlpha);
                    gl.bindBuffer(gl.ARRAY_BUFFER, webGLData.buffer);
                    gl.vertexAttribPointer(shader.aVertexPosition, 2, gl.FLOAT, false, 4 * 6, 0);
                    gl.vertexAttribPointer(shader.colorAttribute, 4, gl.FLOAT, false, 4 * 6, 2 * 4);
                    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, webGLData.indexBuffer);
                    gl.drawElements(gl.TRIANGLE_STRIP, webGLData.indices.length, gl.UNSIGNED_SHORT, 0)
                }
            }
        }
        ;
        PIXI.WebGLGraphics.updateGraphics = function (graphics, gl) {
            var webGL = graphics._webGL[gl.id];
            if (!webGL)
                webGL = graphics._webGL[gl.id] = {
                    lastIndex: 0,
                    data: [],
                    gl: gl
                };
            graphics.dirty = false;
            var i;
            if (graphics.clearDirty) {
                graphics.clearDirty = false;
                for (i = 0; i < webGL.data.length; i++) {
                    var graphicsData = webGL.data[i];
                    graphicsData.reset();
                    PIXI.WebGLGraphics.graphicsDataPool.push(graphicsData)
                }
                webGL.data = [];
                webGL.lastIndex = 0
            }
            var webGLData;
            for (i = webGL.lastIndex; i < graphics.graphicsData.length; i++) {
                var data = graphics.graphicsData[i];
                if (data.type === PIXI.Graphics.POLY) {
                    data.points = data.shape.points.slice();
                    if (data.shape.closed) {
                        if (data.points[0] !== data.points[data.points.length - 2] || data.points[1] !== data.points[data.points.length - 1]) {
                            data.points.push(data.points[0], data.points[1])
                        }
                    }
                    if (data.fill) {
                        if (data.points.length >= 6) {
                            if (data.points.length < 6 * 2) {
                                webGLData = PIXI.WebGLGraphics.switchMode(webGL, 0);
                                var canDrawUsingSimple = PIXI.WebGLGraphics.buildPoly(data, webGLData);
                                if (!canDrawUsingSimple) {
                                    webGLData = PIXI.WebGLGraphics.switchMode(webGL, 1);
                                    PIXI.WebGLGraphics.buildComplexPoly(data, webGLData)
                                }
                            } else {
                                webGLData = PIXI.WebGLGraphics.switchMode(webGL, 1);
                                PIXI.WebGLGraphics.buildComplexPoly(data, webGLData)
                            }
                        }
                    }
                    if (data.lineWidth > 0) {
                        webGLData = PIXI.WebGLGraphics.switchMode(webGL, 0);
                        PIXI.WebGLGraphics.buildLine(data, webGLData)
                    }
                } else {
                    webGLData = PIXI.WebGLGraphics.switchMode(webGL, 0);
                    if (data.type === PIXI.Graphics.RECT) {
                        PIXI.WebGLGraphics.buildRectangle(data, webGLData)
                    } else if (data.type === PIXI.Graphics.CIRC || data.type === PIXI.Graphics.ELIP) {
                        PIXI.WebGLGraphics.buildCircle(data, webGLData)
                    } else if (data.type === PIXI.Graphics.RREC) {
                        PIXI.WebGLGraphics.buildRoundedRectangle(data, webGLData)
                    }
                }
                webGL.lastIndex++
            }
            for (i = 0; i < webGL.data.length; i++) {
                webGLData = webGL.data[i];
                if (webGLData.dirty)
                    webGLData.upload()
            }
        }
        ;
        PIXI.WebGLGraphics.switchMode = function (webGL, type) {
            var webGLData;
            if (!webGL.data.length) {
                webGLData = PIXI.WebGLGraphics.graphicsDataPool.pop() || new PIXI.WebGLGraphicsData(webGL.gl);
                webGLData.mode = type;
                webGL.data.push(webGLData)
            } else {
                webGLData = webGL.data[webGL.data.length - 1];
                if (webGLData.mode !== type || type === 1) {
                    webGLData = PIXI.WebGLGraphics.graphicsDataPool.pop() || new PIXI.WebGLGraphicsData(webGL.gl);
                    webGLData.mode = type;
                    webGL.data.push(webGLData)
                }
            }
            webGLData.dirty = true;
            return webGLData
        }
        ;
        PIXI.WebGLGraphics.buildRectangle = function (graphicsData, webGLData) {
            var rectData = graphicsData.shape;
            var x = rectData.x;
            var y = rectData.y;
            var width = rectData.width;
            var height = rectData.height;
            if (graphicsData.fill) {
                var color = PIXI.hex2rgb(graphicsData.fillColor);
                var alpha = graphicsData.fillAlpha;
                var r = color[0] * alpha;
                var g = color[1] * alpha;
                var b = color[2] * alpha;
                var verts = webGLData.points;
                var indices = webGLData.indices;
                var vertPos = verts.length / 6;
                verts.push(x, y);
                verts.push(r, g, b, alpha);
                verts.push(x + width, y);
                verts.push(r, g, b, alpha);
                verts.push(x, y + height);
                verts.push(r, g, b, alpha);
                verts.push(x + width, y + height);
                verts.push(r, g, b, alpha);
                indices.push(vertPos, vertPos, vertPos + 1, vertPos + 2, vertPos + 3, vertPos + 3)
            }
            if (graphicsData.lineWidth) {
                var tempPoints = graphicsData.points;
                graphicsData.points = [x, y, x + width, y, x + width, y + height, x, y + height, x, y];
                PIXI.WebGLGraphics.buildLine(graphicsData, webGLData);
                graphicsData.points = tempPoints
            }
        }
        ;
        PIXI.WebGLGraphics.buildRoundedRectangle = function (graphicsData, webGLData) {
            var rrectData = graphicsData.shape;
            var x = rrectData.x;
            var y = rrectData.y;
            var width = rrectData.width;
            var height = rrectData.height;
            var radius = rrectData.radius;
            var recPoints = [];
            recPoints.push(x, y + radius);
            recPoints = recPoints.concat(PIXI.WebGLGraphics.quadraticBezierCurve(x, y + height - radius, x, y + height, x + radius, y + height));
            recPoints = recPoints.concat(PIXI.WebGLGraphics.quadraticBezierCurve(x + width - radius, y + height, x + width, y + height, x + width, y + height - radius));
            recPoints = recPoints.concat(PIXI.WebGLGraphics.quadraticBezierCurve(x + width, y + radius, x + width, y, x + width - radius, y));
            recPoints = recPoints.concat(PIXI.WebGLGraphics.quadraticBezierCurve(x + radius, y, x, y, x, y + radius));
            if (graphicsData.fill) {
                var color = PIXI.hex2rgb(graphicsData.fillColor);
                var alpha = graphicsData.fillAlpha;
                var r = color[0] * alpha;
                var g = color[1] * alpha;
                var b = color[2] * alpha;
                var verts = webGLData.points;
                var indices = webGLData.indices;
                var vecPos = verts.length / 6;
                var triangles = PIXI.PolyK.Triangulate(recPoints);
                var i = 0;
                for (i = 0; i < triangles.length; i += 3) {
                    indices.push(triangles[i] + vecPos);
                    indices.push(triangles[i] + vecPos);
                    indices.push(triangles[i + 1] + vecPos);
                    indices.push(triangles[i + 2] + vecPos);
                    indices.push(triangles[i + 2] + vecPos)
                }
                for (i = 0; i < recPoints.length; i++) {
                    verts.push(recPoints[i], recPoints[++i], r, g, b, alpha)
                }
            }
            if (graphicsData.lineWidth) {
                var tempPoints = graphicsData.points;
                graphicsData.points = recPoints;
                PIXI.WebGLGraphics.buildLine(graphicsData, webGLData);
                graphicsData.points = tempPoints
            }
        }
        ;
        PIXI.WebGLGraphics.quadraticBezierCurve = function (fromX, fromY, cpX, cpY, toX, toY) {
            var xa, ya, xb, yb, x, y, n = 20, points = [];

            function getPt(n1, n2, perc) {
                var diff = n2 - n1;
                return n1 + diff * perc
            }

            var j = 0;
            for (var i = 0; i <= n; i++) {
                j = i / n;
                xa = getPt(fromX, cpX, j);
                ya = getPt(fromY, cpY, j);
                xb = getPt(cpX, toX, j);
                yb = getPt(cpY, toY, j);
                x = getPt(xa, xb, j);
                y = getPt(ya, yb, j);
                points.push(x, y)
            }
            return points
        }
        ;
        PIXI.WebGLGraphics.buildCircle = function (graphicsData, webGLData) {
            var circleData = graphicsData.shape;
            var x = circleData.x;
            var y = circleData.y;
            var width;
            var height;
            if (graphicsData.type === PIXI.Graphics.CIRC) {
                width = circleData.radius;
                height = circleData.radius
            } else {
                width = circleData.width;
                height = circleData.height
            }
            var totalSegs = 40;
            var seg = Math.PI * 2 / totalSegs;
            var i = 0;
            if (graphicsData.fill) {
                var color = PIXI.hex2rgb(graphicsData.fillColor);
                var alpha = graphicsData.fillAlpha;
                var r = color[0] * alpha;
                var g = color[1] * alpha;
                var b = color[2] * alpha;
                var verts = webGLData.points;
                var indices = webGLData.indices;
                var vecPos = verts.length / 6;
                indices.push(vecPos);
                for (i = 0; i < totalSegs + 1; i++) {
                    verts.push(x, y, r, g, b, alpha);
                    verts.push(x + Math.sin(seg * i) * width, y + Math.cos(seg * i) * height, r, g, b, alpha);
                    indices.push(vecPos++, vecPos++)
                }
                indices.push(vecPos - 1)
            }
            if (graphicsData.lineWidth) {
                var tempPoints = graphicsData.points;
                graphicsData.points = [];
                for (i = 0; i < totalSegs + 1; i++) {
                    graphicsData.points.push(x + Math.sin(seg * i) * width, y + Math.cos(seg * i) * height)
                }
                PIXI.WebGLGraphics.buildLine(graphicsData, webGLData);
                graphicsData.points = tempPoints
            }
        }
        ;
        PIXI.WebGLGraphics.buildLine = function (graphicsData, webGLData) {
            var i = 0;
            var points = graphicsData.points;
            if (points.length === 0)
                return;
            if (graphicsData.lineWidth % 2) {
                for (i = 0; i < points.length; i++) {
                    points[i] += .5
                }
            }
            var firstPoint = new PIXI.Point(points[0], points[1]);
            var lastPoint = new PIXI.Point(points[points.length - 2], points[points.length - 1]);
            if (firstPoint.x === lastPoint.x && firstPoint.y === lastPoint.y) {
                points = points.slice();
                points.pop();
                points.pop();
                lastPoint = new PIXI.Point(points[points.length - 2], points[points.length - 1]);
                var midPointX = lastPoint.x + (firstPoint.x - lastPoint.x) * .5;
                var midPointY = lastPoint.y + (firstPoint.y - lastPoint.y) * .5;
                points.unshift(midPointX, midPointY);
                points.push(midPointX, midPointY)
            }
            var verts = webGLData.points;
            var indices = webGLData.indices;
            var length = points.length / 2;
            var indexCount = points.length;
            var indexStart = verts.length / 6;
            var width = graphicsData.lineWidth / 2;
            var color = PIXI.hex2rgb(graphicsData.lineColor);
            var alpha = graphicsData.lineAlpha;
            var r = color[0] * alpha;
            var g = color[1] * alpha;
            var b = color[2] * alpha;
            var px, py, p1x, p1y, p2x, p2y, p3x, p3y;
            var perpx, perpy, perp2x, perp2y, perp3x, perp3y;
            var a1, b1, c1, a2, b2, c2;
            var denom, pdist, dist;
            p1x = points[0];
            p1y = points[1];
            p2x = points[2];
            p2y = points[3];
            perpx = -(p1y - p2y);
            perpy = p1x - p2x;
            dist = Math.sqrt(perpx * perpx + perpy * perpy);
            perpx /= dist;
            perpy /= dist;
            perpx *= width;
            perpy *= width;
            verts.push(p1x - perpx, p1y - perpy, r, g, b, alpha);
            verts.push(p1x + perpx, p1y + perpy, r, g, b, alpha);
            for (i = 1; i < length - 1; i++) {
                p1x = points[(i - 1) * 2];
                p1y = points[(i - 1) * 2 + 1];
                p2x = points[i * 2];
                p2y = points[i * 2 + 1];
                p3x = points[(i + 1) * 2];
                p3y = points[(i + 1) * 2 + 1];
                perpx = -(p1y - p2y);
                perpy = p1x - p2x;
                dist = Math.sqrt(perpx * perpx + perpy * perpy);
                perpx /= dist;
                perpy /= dist;
                perpx *= width;
                perpy *= width;
                perp2x = -(p2y - p3y);
                perp2y = p2x - p3x;
                dist = Math.sqrt(perp2x * perp2x + perp2y * perp2y);
                perp2x /= dist;
                perp2y /= dist;
                perp2x *= width;
                perp2y *= width;
                a1 = -perpy + p1y - (-perpy + p2y);
                b1 = -perpx + p2x - (-perpx + p1x);
                c1 = (-perpx + p1x) * (-perpy + p2y) - (-perpx + p2x) * (-perpy + p1y);
                a2 = -perp2y + p3y - (-perp2y + p2y);
                b2 = -perp2x + p2x - (-perp2x + p3x);
                c2 = (-perp2x + p3x) * (-perp2y + p2y) - (-perp2x + p2x) * (-perp2y + p3y);
                denom = a1 * b2 - a2 * b1;
                if (Math.abs(denom) < .1) {
                    denom += 10.1;
                    verts.push(p2x - perpx, p2y - perpy, r, g, b, alpha);
                    verts.push(p2x + perpx, p2y + perpy, r, g, b, alpha);
                    continue
                }
                px = (b1 * c2 - b2 * c1) / denom;
                py = (a2 * c1 - a1 * c2) / denom;
                pdist = (px - p2x) * (px - p2x) + (py - p2y) + (py - p2y);
                if (pdist > 140 * 140) {
                    perp3x = perpx - perp2x;
                    perp3y = perpy - perp2y;
                    dist = Math.sqrt(perp3x * perp3x + perp3y * perp3y);
                    perp3x /= dist;
                    perp3y /= dist;
                    perp3x *= width;
                    perp3y *= width;
                    verts.push(p2x - perp3x, p2y - perp3y);
                    verts.push(r, g, b, alpha);
                    verts.push(p2x + perp3x, p2y + perp3y);
                    verts.push(r, g, b, alpha);
                    verts.push(p2x - perp3x, p2y - perp3y);
                    verts.push(r, g, b, alpha);
                    indexCount++
                } else {
                    verts.push(px, py);
                    verts.push(r, g, b, alpha);
                    verts.push(p2x - (px - p2x), p2y - (py - p2y));
                    verts.push(r, g, b, alpha)
                }
            }
            p1x = points[(length - 2) * 2];
            p1y = points[(length - 2) * 2 + 1];
            p2x = points[(length - 1) * 2];
            p2y = points[(length - 1) * 2 + 1];
            perpx = -(p1y - p2y);
            perpy = p1x - p2x;
            dist = Math.sqrt(perpx * perpx + perpy * perpy);
            perpx /= dist;
            perpy /= dist;
            perpx *= width;
            perpy *= width;
            verts.push(p2x - perpx, p2y - perpy);
            verts.push(r, g, b, alpha);
            verts.push(p2x + perpx, p2y + perpy);
            verts.push(r, g, b, alpha);
            indices.push(indexStart);
            for (i = 0; i < indexCount; i++) {
                indices.push(indexStart++)
            }
            indices.push(indexStart - 1)
        }
        ;
        PIXI.WebGLGraphics.buildComplexPoly = function (graphicsData, webGLData) {
            var points = graphicsData.points.slice();
            if (points.length < 6)
                return;
            var indices = webGLData.indices;
            webGLData.points = points;
            webGLData.alpha = graphicsData.fillAlpha;
            webGLData.color = PIXI.hex2rgb(graphicsData.fillColor);
            var minX = Infinity;
            var maxX = -Infinity;
            var minY = Infinity;
            var maxY = -Infinity;
            var x, y;
            for (var i = 0; i < points.length; i += 2) {
                x = points[i];
                y = points[i + 1];
                minX = x < minX ? x : minX;
                maxX = x > maxX ? x : maxX;
                minY = y < minY ? y : minY;
                maxY = y > maxY ? y : maxY
            }
            points.push(minX, minY, maxX, minY, maxX, maxY, minX, maxY);
            var length = points.length / 2;
            for (i = 0; i < length; i++) {
                indices.push(i)
            }
        }
        ;
        PIXI.WebGLGraphics.buildPoly = function (graphicsData, webGLData) {
            var points = graphicsData.points;
            if (points.length < 6)
                return;
            var verts = webGLData.points;
            var indices = webGLData.indices;
            var length = points.length / 2;
            var color = PIXI.hex2rgb(graphicsData.fillColor);
            var alpha = graphicsData.fillAlpha;
            var r = color[0] * alpha;
            var g = color[1] * alpha;
            var b = color[2] * alpha;
            var triangles = PIXI.PolyK.Triangulate(points);
            if (!triangles)
                return false;
            var vertPos = verts.length / 6;
            var i = 0;
            for (i = 0; i < triangles.length; i += 3) {
                indices.push(triangles[i] + vertPos);
                indices.push(triangles[i] + vertPos);
                indices.push(triangles[i + 1] + vertPos);
                indices.push(triangles[i + 2] + vertPos);
                indices.push(triangles[i + 2] + vertPos)
            }
            for (i = 0; i < length; i++) {
                verts.push(points[i * 2], points[i * 2 + 1], r, g, b, alpha)
            }
            return true
        }
        ;
        PIXI.WebGLGraphics.graphicsDataPool = [];
        PIXI.WebGLGraphicsData = function (gl) {
            this.gl = gl;
            this.color = [0, 0, 0];
            this.points = [];
            this.indices = [];
            this.buffer = gl.createBuffer();
            this.indexBuffer = gl.createBuffer();
            this.mode = 1;
            this.alpha = 1;
            this.dirty = true
        }
        ;
        PIXI.WebGLGraphicsData.prototype.reset = function () {
            this.points = [];
            this.indices = []
        }
        ;
        PIXI.WebGLGraphicsData.prototype.upload = function () {
            var gl = this.gl;
            this.glPoints = new PIXI.Float32Array(this.points);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
            gl.bufferData(gl.ARRAY_BUFFER, this.glPoints, gl.STATIC_DRAW);
            this.glIndicies = new PIXI.Uint16Array(this.indices);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.glIndicies, gl.STATIC_DRAW);
            this.dirty = false
        }
        ;
        PIXI.glContexts = [];
        PIXI.instances = [];
        PIXI.WebGLRenderer = function (width, height, options) {
            if (options) {
                for (var i in PIXI.defaultRenderOptions) {
                    if (typeof options[i] === "undefined")
                        options[i] = PIXI.defaultRenderOptions[i]
                }
            } else {
                options = PIXI.defaultRenderOptions
            }
            if (!PIXI.defaultRenderer) {
                PIXI.sayHello("webGL");
                PIXI.defaultRenderer = this
            }
            this.type = PIXI.WEBGL_RENDERER;
            this.resolution = options.resolution;
            this.transparent = options.transparent;
            this.autoResize = options.autoResize || false;
            this.preserveDrawingBuffer = options.preserveDrawingBuffer;
            this.clearBeforeRender = options.clearBeforeRender;
            this.width = width || 800;
            this.height = height || 600;
            this.view = options.view || document.createElement("canvas");
            this.contextLostBound = this.handleContextLost.bind(this);
            this.contextRestoredBound = this.handleContextRestored.bind(this);
            this.view.addEventListener("webglcontextlost", this.contextLostBound, false);
            this.view.addEventListener("webglcontextrestored", this.contextRestoredBound, false);
            this._contextOptions = {
                alpha: this.transparent,
                antialias: options.antialias,
                premultipliedAlpha: this.transparent && this.transparent !== "notMultiplied",
                stencil: true,
                preserveDrawingBuffer: options.preserveDrawingBuffer
            };
            this.projection = new PIXI.Point;
            this.offset = new PIXI.Point(0, 0);
            this.shaderManager = new PIXI.WebGLShaderManager;
            this.spriteBatch = new PIXI.WebGLSpriteBatch;
            this.maskManager = new PIXI.WebGLMaskManager;
            this.filterManager = new PIXI.WebGLFilterManager;
            this.stencilManager = new PIXI.WebGLStencilManager;
            this.blendModeManager = new PIXI.WebGLBlendModeManager;
            this.renderSession = {};
            this.renderSession.gl = this.gl;
            this.renderSession.drawCount = 0;
            this.renderSession.shaderManager = this.shaderManager;
            this.renderSession.maskManager = this.maskManager;
            this.renderSession.filterManager = this.filterManager;
            this.renderSession.blendModeManager = this.blendModeManager;
            this.renderSession.spriteBatch = this.spriteBatch;
            this.renderSession.stencilManager = this.stencilManager;
            this.renderSession.renderer = this;
            this.renderSession.resolution = this.resolution;
            this.initContext();
            this.mapBlendModes()
        }
        ;
        PIXI.WebGLRenderer.prototype.constructor = PIXI.WebGLRenderer;
        PIXI.WebGLRenderer.prototype.initContext = function () {
            var gl = this.view.getContext("webgl", this._contextOptions) || this.view.getContext("experimental-webgl", this._contextOptions);
            this.gl = gl;
            if (!gl) {
                throw new Error("This browser does not support webGL. Try using the canvas renderer")
            }
            this.glContextId = gl.id = PIXI.WebGLRenderer.glContextId++;
            PIXI.glContexts[this.glContextId] = gl;
            PIXI.instances[this.glContextId] = this;
            gl.disable(gl.DEPTH_TEST);
            gl.disable(gl.CULL_FACE);
            gl.enable(gl.BLEND);
            this.shaderManager.setContext(gl);
            this.spriteBatch.setContext(gl);
            this.maskManager.setContext(gl);
            this.filterManager.setContext(gl);
            this.blendModeManager.setContext(gl);
            this.stencilManager.setContext(gl);
            this.renderSession.gl = this.gl;
            this.resize(this.width, this.height)
        }
        ;
        PIXI.WebGLRenderer.prototype.render = function (stage) {
            if (this.contextLost)
                return;
            if (this.__stage !== stage) {
                if (stage.interactive)
                    stage.interactionManager.removeEvents();
                this.__stage = stage
            }
            stage.updateTransform();
            var gl = this.gl;
            if (stage._interactive) {
                if (!stage._interactiveEventsAdded) {
                    stage._interactiveEventsAdded = true;
                    stage.interactionManager.setTarget(this)
                }
            } else {
                if (stage._interactiveEventsAdded) {
                    stage._interactiveEventsAdded = false;
                    stage.interactionManager.setTarget(this)
                }
            }
            gl.viewport(0, 0, this.width, this.height);
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            if (this.clearBeforeRender) {
                if (this.transparent) {
                    gl.clearColor(0, 0, 0, 0)
                } else {
                    gl.clearColor(stage.backgroundColorSplit[0], stage.backgroundColorSplit[1], stage.backgroundColorSplit[2], 1)
                }
                gl.clear(gl.COLOR_BUFFER_BIT)
            }
            this.renderDisplayObject(stage, this.projection)
        }
        ;
        PIXI.WebGLRenderer.prototype.renderDisplayObject = function (displayObject, projection, buffer) {
            this.renderSession.blendModeManager.setBlendMode(PIXI.blendModes.NORMAL);
            this.renderSession.drawCount = 0;
            this.renderSession.flipY = buffer ? -1 : 1;
            this.renderSession.projection = projection;
            this.renderSession.offset = this.offset;
            this.spriteBatch.begin(this.renderSession);
            this.filterManager.begin(this.renderSession, buffer);
            displayObject._renderWebGL(this.renderSession);
            this.spriteBatch.end()
        }
        ;
        PIXI.WebGLRenderer.prototype.resize = function (width, height) {
            this.width = width * this.resolution;
            this.height = height * this.resolution;
            this.view.width = this.width;
            this.view.height = this.height;
            if (this.autoResize) {
                this.view.style.width = this.width / this.resolution + "px";
                this.view.style.height = this.height / this.resolution + "px"
            }
            this.gl.viewport(0, 0, this.width, this.height);
            this.projection.x = this.width / 2 / this.resolution;
            this.projection.y = -this.height / 2 / this.resolution
        }
        ;
        PIXI.WebGLRenderer.prototype.updateTexture = function (texture) {
            if (!texture.hasLoaded)
                return;
            var gl = this.gl;
            if (!texture._glTextures[gl.id])
                texture._glTextures[gl.id] = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, texture._glTextures[gl.id]);
            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, texture.premultipliedAlpha);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture.source);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, texture.scaleMode === PIXI.scaleModes.LINEAR ? gl.LINEAR : gl.NEAREST);
            if (texture.mipmap && PIXI.isPowerOfTwo(texture.width, texture.height)) {
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, texture.scaleMode === PIXI.scaleModes.LINEAR ? gl.LINEAR_MIPMAP_LINEAR : gl.NEAREST_MIPMAP_NEAREST);
                gl.generateMipmap(gl.TEXTURE_2D)
            } else {
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, texture.scaleMode === PIXI.scaleModes.LINEAR ? gl.LINEAR : gl.NEAREST)
            }
            if (!texture._powerOf2) {
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
            } else {
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT)
            }
            texture._dirty[gl.id] = false;
            return texture._glTextures[gl.id]
        }
        ;
        PIXI.WebGLRenderer.prototype.handleContextLost = function (event) {
            event.preventDefault();
            this.contextLost = true
        }
        ;
        PIXI.WebGLRenderer.prototype.handleContextRestored = function () {
            this.initContext();
            for (var key in PIXI.TextureCache) {
                var texture = PIXI.TextureCache[key].baseTexture;
                texture._glTextures = []
            }
            this.contextLost = false
        }
        ;
        PIXI.WebGLRenderer.prototype.destroy = function () {
            this.view.removeEventListener("webglcontextlost", this.contextLostBound);
            this.view.removeEventListener("webglcontextrestored", this.contextRestoredBound);
            PIXI.glContexts[this.glContextId] = null;
            this.projection = null;
            this.offset = null;
            this.shaderManager.destroy();
            this.spriteBatch.destroy();
            this.maskManager.destroy();
            this.filterManager.destroy();
            this.shaderManager = null;
            this.spriteBatch = null;
            this.maskManager = null;
            this.filterManager = null;
            this.gl = null;
            this.renderSession = null
        }
        ;
        PIXI.WebGLRenderer.prototype.mapBlendModes = function () {
            var gl = this.gl;
            if (!PIXI.blendModesWebGL) {
                PIXI.blendModesWebGL = [];
                PIXI.blendModesWebGL[PIXI.blendModes.NORMAL] = [gl.ONE, gl.ONE_MINUS_SRC_ALPHA];
                PIXI.blendModesWebGL[PIXI.blendModes.ADD] = [gl.SRC_ALPHA, gl.DST_ALPHA];
                PIXI.blendModesWebGL[PIXI.blendModes.MULTIPLY] = [gl.DST_COLOR, gl.ONE_MINUS_SRC_ALPHA];
                PIXI.blendModesWebGL[PIXI.blendModes.SCREEN] = [gl.SRC_ALPHA, gl.ONE];
                PIXI.blendModesWebGL[PIXI.blendModes.OVERLAY] = [gl.ONE, gl.ONE_MINUS_SRC_ALPHA];
                PIXI.blendModesWebGL[PIXI.blendModes.DARKEN] = [gl.ONE, gl.ONE_MINUS_SRC_ALPHA];
                PIXI.blendModesWebGL[PIXI.blendModes.LIGHTEN] = [gl.ONE, gl.ONE_MINUS_SRC_ALPHA];
                PIXI.blendModesWebGL[PIXI.blendModes.COLOR_DODGE] = [gl.ONE, gl.ONE_MINUS_SRC_ALPHA];
                PIXI.blendModesWebGL[PIXI.blendModes.COLOR_BURN] = [gl.ONE, gl.ONE_MINUS_SRC_ALPHA];
                PIXI.blendModesWebGL[PIXI.blendModes.HARD_LIGHT] = [gl.ONE, gl.ONE_MINUS_SRC_ALPHA];
                PIXI.blendModesWebGL[PIXI.blendModes.SOFT_LIGHT] = [gl.ONE, gl.ONE_MINUS_SRC_ALPHA];
                PIXI.blendModesWebGL[PIXI.blendModes.DIFFERENCE] = [gl.ONE, gl.ONE_MINUS_SRC_ALPHA];
                PIXI.blendModesWebGL[PIXI.blendModes.EXCLUSION] = [gl.ONE, gl.ONE_MINUS_SRC_ALPHA];
                PIXI.blendModesWebGL[PIXI.blendModes.HUE] = [gl.ONE, gl.ONE_MINUS_SRC_ALPHA];
                PIXI.blendModesWebGL[PIXI.blendModes.SATURATION] = [gl.ONE, gl.ONE_MINUS_SRC_ALPHA];
                PIXI.blendModesWebGL[PIXI.blendModes.COLOR] = [gl.ONE, gl.ONE_MINUS_SRC_ALPHA];
                PIXI.blendModesWebGL[PIXI.blendModes.LUMINOSITY] = [gl.ONE, gl.ONE_MINUS_SRC_ALPHA]
            }
        }
        ;
        PIXI.WebGLRenderer.glContextId = 0;
        PIXI.WebGLBlendModeManager = function () {
            this.currentBlendMode = 99999
        }
        ;
        PIXI.WebGLBlendModeManager.prototype.constructor = PIXI.WebGLBlendModeManager;
        PIXI.WebGLBlendModeManager.prototype.setContext = function (gl) {
            this.gl = gl
        }
        ;
        PIXI.WebGLBlendModeManager.prototype.setBlendMode = function (blendMode) {
            if (this.currentBlendMode === blendMode)
                return false;
            this.currentBlendMode = blendMode;
            var blendModeWebGL = PIXI.blendModesWebGL[this.currentBlendMode];
            this.gl.blendFunc(blendModeWebGL[0], blendModeWebGL[1]);
            return true
        }
        ;
        PIXI.WebGLBlendModeManager.prototype.destroy = function () {
            this.gl = null
        }
        ;
        PIXI.WebGLMaskManager = function () {
        }
        ;
        PIXI.WebGLMaskManager.prototype.constructor = PIXI.WebGLMaskManager;
        PIXI.WebGLMaskManager.prototype.setContext = function (gl) {
            this.gl = gl
        }
        ;
        PIXI.WebGLMaskManager.prototype.pushMask = function (maskData, renderSession) {
            var gl = renderSession.gl;
            if (maskData.dirty) {
                PIXI.WebGLGraphics.updateGraphics(maskData, gl)
            }
            if (!maskData._webGL[gl.id].data.length)
                return;
            renderSession.stencilManager.pushStencil(maskData, maskData._webGL[gl.id].data[0], renderSession)
        }
        ;
        PIXI.WebGLMaskManager.prototype.popMask = function (maskData, renderSession) {
            var gl = this.gl;
            renderSession.stencilManager.popStencil(maskData, maskData._webGL[gl.id].data[0], renderSession)
        }
        ;
        PIXI.WebGLMaskManager.prototype.destroy = function () {
            this.gl = null
        }
        ;
        PIXI.WebGLStencilManager = function () {
            this.stencilStack = [];
            this.reverse = true;
            this.count = 0
        }
        ;
        PIXI.WebGLStencilManager.prototype.setContext = function (gl) {
            this.gl = gl
        }
        ;
        PIXI.WebGLStencilManager.prototype.pushStencil = function (graphics, webGLData, renderSession) {
            var gl = this.gl;
            this.bindGraphics(graphics, webGLData, renderSession);
            if (this.stencilStack.length === 0) {
                gl.enable(gl.STENCIL_TEST);
                gl.clear(gl.STENCIL_BUFFER_BIT);
                this.reverse = true;
                this.count = 0
            }
            this.stencilStack.push(webGLData);
            var level = this.count;
            gl.colorMask(false, false, false, false);
            gl.stencilFunc(gl.ALWAYS, 0, 255);
            gl.stencilOp(gl.KEEP, gl.KEEP, gl.INVERT);
            if (webGLData.mode === 1) {
                gl.drawElements(gl.TRIANGLE_FAN, webGLData.indices.length - 4, gl.UNSIGNED_SHORT, 0);
                if (this.reverse) {
                    gl.stencilFunc(gl.EQUAL, 255 - level, 255);
                    gl.stencilOp(gl.KEEP, gl.KEEP, gl.DECR)
                } else {
                    gl.stencilFunc(gl.EQUAL, level, 255);
                    gl.stencilOp(gl.KEEP, gl.KEEP, gl.INCR)
                }
                gl.drawElements(gl.TRIANGLE_FAN, 4, gl.UNSIGNED_SHORT, (webGLData.indices.length - 4) * 2);
                if (this.reverse) {
                    gl.stencilFunc(gl.EQUAL, 255 - (level + 1), 255)
                } else {
                    gl.stencilFunc(gl.EQUAL, level + 1, 255)
                }
                this.reverse = !this.reverse
            } else {
                if (!this.reverse) {
                    gl.stencilFunc(gl.EQUAL, 255 - level, 255);
                    gl.stencilOp(gl.KEEP, gl.KEEP, gl.DECR)
                } else {
                    gl.stencilFunc(gl.EQUAL, level, 255);
                    gl.stencilOp(gl.KEEP, gl.KEEP, gl.INCR)
                }
                gl.drawElements(gl.TRIANGLE_STRIP, webGLData.indices.length, gl.UNSIGNED_SHORT, 0);
                if (!this.reverse) {
                    gl.stencilFunc(gl.EQUAL, 255 - (level + 1), 255)
                } else {
                    gl.stencilFunc(gl.EQUAL, level + 1, 255)
                }
            }
            gl.colorMask(true, true, true, true);
            gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
            this.count++
        }
        ;
        PIXI.WebGLStencilManager.prototype.bindGraphics = function (graphics, webGLData, renderSession) {
            this._currentGraphics = graphics;
            var gl = this.gl;
            var projection = renderSession.projection, offset = renderSession.offset, shader;
            if (webGLData.mode === 1) {
                shader = renderSession.shaderManager.complexPrimitiveShader;
                renderSession.shaderManager.setShader(shader);
                gl.uniform1f(shader.flipY, renderSession.flipY);
                gl.uniformMatrix3fv(shader.translationMatrix, false, graphics.worldTransform.toArray(true));
                gl.uniform2f(shader.projectionVector, projection.x, -projection.y);
                gl.uniform2f(shader.offsetVector, -offset.x, -offset.y);
                gl.uniform3fv(shader.tintColor, PIXI.hex2rgb(graphics.tint));
                gl.uniform3fv(shader.color, webGLData.color);
                gl.uniform1f(shader.alpha, graphics.worldAlpha * webGLData.alpha);
                gl.bindBuffer(gl.ARRAY_BUFFER, webGLData.buffer);
                gl.vertexAttribPointer(shader.aVertexPosition, 2, gl.FLOAT, false, 4 * 2, 0);
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, webGLData.indexBuffer)
            } else {
                shader = renderSession.shaderManager.primitiveShader;
                renderSession.shaderManager.setShader(shader);
                gl.uniformMatrix3fv(shader.translationMatrix, false, graphics.worldTransform.toArray(true));
                gl.uniform1f(shader.flipY, renderSession.flipY);
                gl.uniform2f(shader.projectionVector, projection.x, -projection.y);
                gl.uniform2f(shader.offsetVector, -offset.x, -offset.y);
                gl.uniform3fv(shader.tintColor, PIXI.hex2rgb(graphics.tint));
                gl.uniform1f(shader.alpha, graphics.worldAlpha);
                gl.bindBuffer(gl.ARRAY_BUFFER, webGLData.buffer);
                gl.vertexAttribPointer(shader.aVertexPosition, 2, gl.FLOAT, false, 4 * 6, 0);
                gl.vertexAttribPointer(shader.colorAttribute, 4, gl.FLOAT, false, 4 * 6, 2 * 4);
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, webGLData.indexBuffer)
            }
        }
        ;
        PIXI.WebGLStencilManager.prototype.popStencil = function (graphics, webGLData, renderSession) {
            var gl = this.gl;
            this.stencilStack.pop();
            this.count--;
            if (this.stencilStack.length === 0) {
                gl.disable(gl.STENCIL_TEST)
            } else {
                var level = this.count;
                this.bindGraphics(graphics, webGLData, renderSession);
                gl.colorMask(false, false, false, false);
                if (webGLData.mode === 1) {
                    this.reverse = !this.reverse;
                    if (this.reverse) {
                        gl.stencilFunc(gl.EQUAL, 255 - (level + 1), 255);
                        gl.stencilOp(gl.KEEP, gl.KEEP, gl.INCR)
                    } else {
                        gl.stencilFunc(gl.EQUAL, level + 1, 255);
                        gl.stencilOp(gl.KEEP, gl.KEEP, gl.DECR)
                    }
                    gl.drawElements(gl.TRIANGLE_FAN, 4, gl.UNSIGNED_SHORT, (webGLData.indices.length - 4) * 2);
                    gl.stencilFunc(gl.ALWAYS, 0, 255);
                    gl.stencilOp(gl.KEEP, gl.KEEP, gl.INVERT);
                    gl.drawElements(gl.TRIANGLE_FAN, webGLData.indices.length - 4, gl.UNSIGNED_SHORT, 0);
                    if (!this.reverse) {
                        gl.stencilFunc(gl.EQUAL, 255 - level, 255)
                    } else {
                        gl.stencilFunc(gl.EQUAL, level, 255)
                    }
                } else {
                    if (!this.reverse) {
                        gl.stencilFunc(gl.EQUAL, 255 - (level + 1), 255);
                        gl.stencilOp(gl.KEEP, gl.KEEP, gl.INCR)
                    } else {
                        gl.stencilFunc(gl.EQUAL, level + 1, 255);
                        gl.stencilOp(gl.KEEP, gl.KEEP, gl.DECR)
                    }
                    gl.drawElements(gl.TRIANGLE_STRIP, webGLData.indices.length, gl.UNSIGNED_SHORT, 0);
                    if (!this.reverse) {
                        gl.stencilFunc(gl.EQUAL, 255 - level, 255)
                    } else {
                        gl.stencilFunc(gl.EQUAL, level, 255)
                    }
                }
                gl.colorMask(true, true, true, true);
                gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP)
            }
        }
        ;
        PIXI.WebGLStencilManager.prototype.destroy = function () {
            this.stencilStack = null;
            this.gl = null
        }
        ;
        PIXI.WebGLShaderManager = function () {
            this.maxAttibs = 10;
            this.attribState = [];
            this.tempAttribState = [];
            for (var i = 0; i < this.maxAttibs; i++) {
                this.attribState[i] = false
            }
            this.stack = []
        }
        ;
        PIXI.WebGLShaderManager.prototype.constructor = PIXI.WebGLShaderManager;
        PIXI.WebGLShaderManager.prototype.setContext = function (gl) {
            this.gl = gl;
            this.primitiveShader = new PIXI.PrimitiveShader(gl);
            this.complexPrimitiveShader = new PIXI.ComplexPrimitiveShader(gl);
            this.defaultShader = new PIXI.PixiShader(gl);
            this.fastShader = new PIXI.PixiFastShader(gl);
            this.stripShader = new PIXI.StripShader(gl);
            this.setShader(this.defaultShader)
        }
        ;
        PIXI.WebGLShaderManager.prototype.setAttribs = function (attribs) {
            var i;
            for (i = 0; i < this.tempAttribState.length; i++) {
                this.tempAttribState[i] = false
            }
            for (i = 0; i < attribs.length; i++) {
                var attribId = attribs[i];
                this.tempAttribState[attribId] = true
            }
            var gl = this.gl;
            for (i = 0; i < this.attribState.length; i++) {
                if (this.attribState[i] !== this.tempAttribState[i]) {
                    this.attribState[i] = this.tempAttribState[i];
                    if (this.tempAttribState[i]) {
                        gl.enableVertexAttribArray(i)
                    } else {
                        gl.disableVertexAttribArray(i)
                    }
                }
            }
        }
        ;
        PIXI.WebGLShaderManager.prototype.setShader = function (shader) {
            if (this._currentId === shader._UID)
                return false;
            this._currentId = shader._UID;
            this.currentShader = shader;
            this.gl.useProgram(shader.program);
            this.setAttribs(shader.attributes);
            return true
        }
        ;
        PIXI.WebGLShaderManager.prototype.destroy = function () {
            this.attribState = null;
            this.tempAttribState = null;
            this.primitiveShader.destroy();
            this.complexPrimitiveShader.destroy();
            this.defaultShader.destroy();
            this.fastShader.destroy();
            this.stripShader.destroy();
            this.gl = null
        }
        ;
        PIXI.WebGLSpriteBatch = function () {
            this.vertSize = 5;
            this.size = 2e3;
            var numVerts = this.size * 4 * 4 * this.vertSize;
            var numIndices = this.size * 6;
            this.vertices = new PIXI.ArrayBuffer(numVerts);
            this.positions = new PIXI.Float32Array(this.vertices);
            this.colors = new PIXI.Uint32Array(this.vertices);
            this.indices = new PIXI.Uint16Array(numIndices);
            this.lastIndexCount = 0;
            for (var i = 0, j = 0; i < numIndices; i += 6,
                j += 4) {
                this.indices[i + 0] = j + 0;
                this.indices[i + 1] = j + 1;
                this.indices[i + 2] = j + 2;
                this.indices[i + 3] = j + 0;
                this.indices[i + 4] = j + 2;
                this.indices[i + 5] = j + 3
            }
            this.drawing = false;
            this.currentBatchSize = 0;
            this.currentBaseTexture = null;
            this.dirty = true;
            this.textures = [];
            this.blendModes = [];
            this.shaders = [];
            this.sprites = [];
            this.defaultShader = new PIXI.AbstractFilter(["precision lowp float;", "varying vec2 vTextureCoord;", "varying vec4 vColor;", "uniform sampler2D uSampler;", "void main(void) {", "   gl_FragColor = texture2D(uSampler, vTextureCoord) * vColor ;", "}"])
        }
        ;
        PIXI.WebGLSpriteBatch.prototype.setContext = function (gl) {
            this.gl = gl;
            this.vertexBuffer = gl.createBuffer();
            this.indexBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indices, gl.STATIC_DRAW);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, this.vertices, gl.DYNAMIC_DRAW);
            this.currentBlendMode = 99999;
            var shader = new PIXI.PixiShader(gl);
            shader.fragmentSrc = this.defaultShader.fragmentSrc;
            shader.uniforms = {};
            shader.init();
            this.defaultShader.shaders[gl.id] = shader
        }
        ;
        PIXI.WebGLSpriteBatch.prototype.begin = function (renderSession) {
            this.renderSession = renderSession;
            this.shader = this.renderSession.shaderManager.defaultShader;
            this.start()
        }
        ;
        PIXI.WebGLSpriteBatch.prototype.end = function () {
            this.flush()
        }
        ;
        PIXI.WebGLSpriteBatch.prototype.render = function (sprite) {
            var texture = sprite.texture;
            if (this.currentBatchSize >= this.size) {
                this.flush();
                this.currentBaseTexture = texture.baseTexture
            }
            var uvs = texture._uvs;
            if (!uvs)
                return;
            var aX = sprite.anchor.x;
            var aY = sprite.anchor.y;
            var w0, w1, h0, h1;
            if (texture.trim) {
                var trim = texture.trim;
                w1 = trim.x - aX * trim.width;
                w0 = w1 + texture.crop.width;
                h1 = trim.y - aY * trim.height;
                h0 = h1 + texture.crop.height
            } else {
                w0 = texture.frame.width * (1 - aX);
                w1 = texture.frame.width * -aX;
                h0 = texture.frame.height * (1 - aY);
                h1 = texture.frame.height * -aY
            }
            var index = this.currentBatchSize * 4 * this.vertSize;
            var resolution = texture.baseTexture.resolution;
            var worldTransform = sprite.worldTransform;
            var a = worldTransform.a / resolution;
            var b = worldTransform.b / resolution;
            var c = worldTransform.c / resolution;
            var d = worldTransform.d / resolution;
            var tx = worldTransform.tx;
            var ty = worldTransform.ty;
            var colors = this.colors;
            var positions = this.positions;
            if (this.renderSession.roundPixels) {
                positions[index] = a * w1 + c * h1 + tx | 0;
                positions[index + 1] = d * h1 + b * w1 + ty | 0;
                positions[index + 5] = a * w0 + c * h1 + tx | 0;
                positions[index + 6] = d * h1 + b * w0 + ty | 0;
                positions[index + 10] = a * w0 + c * h0 + tx | 0;
                positions[index + 11] = d * h0 + b * w0 + ty | 0;
                positions[index + 15] = a * w1 + c * h0 + tx | 0;
                positions[index + 16] = d * h0 + b * w1 + ty | 0
            } else {
                positions[index] = a * w1 + c * h1 + tx;
                positions[index + 1] = d * h1 + b * w1 + ty;
                positions[index + 5] = a * w0 + c * h1 + tx;
                positions[index + 6] = d * h1 + b * w0 + ty;
                positions[index + 10] = a * w0 + c * h0 + tx;
                positions[index + 11] = d * h0 + b * w0 + ty;
                positions[index + 15] = a * w1 + c * h0 + tx;
                positions[index + 16] = d * h0 + b * w1 + ty
            }
            positions[index + 2] = uvs.x0;
            positions[index + 3] = uvs.y0;
            positions[index + 7] = uvs.x1;
            positions[index + 8] = uvs.y1;
            positions[index + 12] = uvs.x2;
            positions[index + 13] = uvs.y2;
            positions[index + 17] = uvs.x3;
            positions[index + 18] = uvs.y3;
            var tint = sprite.tint;
            colors[index + 4] = colors[index + 9] = colors[index + 14] = colors[index + 19] = (tint >> 16) + (tint & 65280) + ((tint & 255) << 16) + (sprite.worldAlpha * 255 << 24);
            this.sprites[this.currentBatchSize++] = sprite
        }
        ;
        PIXI.WebGLSpriteBatch.prototype.renderTilingSprite = function (tilingSprite) {
            var texture = tilingSprite.tilingTexture;
            if (this.currentBatchSize >= this.size) {
                this.flush();
                this.currentBaseTexture = texture.baseTexture
            }
            if (!tilingSprite._uvs)
                tilingSprite._uvs = new PIXI.TextureUvs;
            var uvs = tilingSprite._uvs;
            tilingSprite.tilePosition.x %= texture.baseTexture.width * tilingSprite.tileScaleOffset.x;
            tilingSprite.tilePosition.y %= texture.baseTexture.height * tilingSprite.tileScaleOffset.y;
            var offsetX = tilingSprite.tilePosition.x / (texture.baseTexture.width * tilingSprite.tileScaleOffset.x);
            var offsetY = tilingSprite.tilePosition.y / (texture.baseTexture.height * tilingSprite.tileScaleOffset.y);
            var scaleX = tilingSprite.width / texture.baseTexture.width / (tilingSprite.tileScale.x * tilingSprite.tileScaleOffset.x);
            var scaleY = tilingSprite.height / texture.baseTexture.height / (tilingSprite.tileScale.y * tilingSprite.tileScaleOffset.y);
            uvs.x0 = 0 - offsetX;
            uvs.y0 = 0 - offsetY;
            uvs.x1 = 1 * scaleX - offsetX;
            uvs.y1 = 0 - offsetY;
            uvs.x2 = 1 * scaleX - offsetX;
            uvs.y2 = 1 * scaleY - offsetY;
            uvs.x3 = 0 - offsetX;
            uvs.y3 = 1 * scaleY - offsetY;
            var tint = tilingSprite.tint;
            var color = (tint >> 16) + (tint & 65280) + ((tint & 255) << 16) + (tilingSprite.alpha * 255 << 24);
            var positions = this.positions;
            var colors = this.colors;
            var width = tilingSprite.width;
            var height = tilingSprite.height;
            var aX = tilingSprite.anchor.x;
            var aY = tilingSprite.anchor.y;
            var w0 = width * (1 - aX);
            var w1 = width * -aX;
            var h0 = height * (1 - aY);
            var h1 = height * -aY;
            var index = this.currentBatchSize * 4 * this.vertSize;
            var resolution = texture.baseTexture.resolution;
            var worldTransform = tilingSprite.worldTransform;
            var a = worldTransform.a / resolution;
            var b = worldTransform.b / resolution;
            var c = worldTransform.c / resolution;
            var d = worldTransform.d / resolution;
            var tx = worldTransform.tx;
            var ty = worldTransform.ty;
            positions[index++] = a * w1 + c * h1 + tx;
            positions[index++] = d * h1 + b * w1 + ty;
            positions[index++] = uvs.x0;
            positions[index++] = uvs.y0;
            colors[index++] = color;
            positions[index++] = a * w0 + c * h1 + tx;
            positions[index++] = d * h1 + b * w0 + ty;
            positions[index++] = uvs.x1;
            positions[index++] = uvs.y1;
            colors[index++] = color;
            positions[index++] = a * w0 + c * h0 + tx;
            positions[index++] = d * h0 + b * w0 + ty;
            positions[index++] = uvs.x2;
            positions[index++] = uvs.y2;
            colors[index++] = color;
            positions[index++] = a * w1 + c * h0 + tx;
            positions[index++] = d * h0 + b * w1 + ty;
            positions[index++] = uvs.x3;
            positions[index++] = uvs.y3;
            colors[index++] = color;
            this.sprites[this.currentBatchSize++] = tilingSprite
        }
        ;
        PIXI.WebGLSpriteBatch.prototype.flush = function () {
            if (this.currentBatchSize === 0)
                return;
            var gl = this.gl;
            var shader;
            if (this.dirty) {
                this.dirty = false;
                gl.activeTexture(gl.TEXTURE0);
                gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
                shader = this.defaultShader.shaders[gl.id];
                var stride = this.vertSize * 4;
                gl.vertexAttribPointer(shader.aVertexPosition, 2, gl.FLOAT, false, stride, 0);
                gl.vertexAttribPointer(shader.aTextureCoord, 2, gl.FLOAT, false, stride, 2 * 4);
                gl.vertexAttribPointer(shader.colorAttribute, 4, gl.UNSIGNED_BYTE, true, stride, 4 * 4)
            }
            if (this.currentBatchSize > this.size * .5) {
                gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.vertices)
            } else {
                var view = this.positions.subarray(0, this.currentBatchSize * 4 * this.vertSize);
                gl.bufferSubData(gl.ARRAY_BUFFER, 0, view)
            }
            var nextTexture, nextBlendMode, nextShader;
            var batchSize = 0;
            var start = 0;
            var currentBaseTexture = null;
            var currentBlendMode = this.renderSession.blendModeManager.currentBlendMode;
            var currentShader = null;
            var blendSwap = false;
            var shaderSwap = false;
            var sprite;
            for (var i = 0, j = this.currentBatchSize; i < j; i++) {
                sprite = this.sprites[i];
                nextTexture = sprite.texture.baseTexture;
                nextBlendMode = sprite.blendMode;
                nextShader = sprite.shader || this.defaultShader;
                blendSwap = currentBlendMode !== nextBlendMode;
                shaderSwap = currentShader !== nextShader;
                if (currentBaseTexture !== nextTexture || blendSwap || shaderSwap) {
                    this.renderBatch(currentBaseTexture, batchSize, start);
                    start = i;
                    batchSize = 0;
                    currentBaseTexture = nextTexture;
                    if (blendSwap) {
                        currentBlendMode = nextBlendMode;
                        this.renderSession.blendModeManager.setBlendMode(currentBlendMode)
                    }
                    if (shaderSwap) {
                        currentShader = nextShader;
                        shader = currentShader.shaders[gl.id];
                        if (!shader) {
                            shader = new PIXI.PixiShader(gl);
                            shader.fragmentSrc = currentShader.fragmentSrc;
                            shader.uniforms = currentShader.uniforms;
                            shader.init();
                            currentShader.shaders[gl.id] = shader
                        }
                        this.renderSession.shaderManager.setShader(shader);
                        if (shader.dirty)
                            shader.syncUniforms();
                        var projection = this.renderSession.projection;
                        gl.uniform2f(shader.projectionVector, projection.x, projection.y);
                        var offsetVector = this.renderSession.offset;
                        gl.uniform2f(shader.offsetVector, offsetVector.x, offsetVector.y)
                    }
                }
                batchSize++
            }
            this.renderBatch(currentBaseTexture, batchSize, start);
            this.currentBatchSize = 0
        }
        ;
        PIXI.WebGLSpriteBatch.prototype.renderBatch = function (texture, size, startIndex) {
            if (size === 0)
                return;
            var gl = this.gl;
            if (texture._dirty[gl.id]) {
                this.renderSession.renderer.updateTexture(texture)
            } else {
                gl.bindTexture(gl.TEXTURE_2D, texture._glTextures[gl.id])
            }
            gl.drawElements(gl.TRIANGLES, size * 6, gl.UNSIGNED_SHORT, startIndex * 6 * 2);
            this.renderSession.drawCount++
        }
        ;
        PIXI.WebGLSpriteBatch.prototype.stop = function () {
            this.flush();
            this.dirty = true
        }
        ;
        PIXI.WebGLSpriteBatch.prototype.start = function () {
            this.dirty = true
        }
        ;
        PIXI.WebGLSpriteBatch.prototype.destroy = function () {
            this.vertices = null;
            this.indices = null;
            this.gl.deleteBuffer(this.vertexBuffer);
            this.gl.deleteBuffer(this.indexBuffer);
            this.currentBaseTexture = null;
            this.gl = null
        }
        ;
        PIXI.WebGLFastSpriteBatch = function (gl) {
            this.vertSize = 10;
            this.maxSize = 6e3;
            this.size = this.maxSize;
            var numVerts = this.size * 4 * this.vertSize;
            var numIndices = this.maxSize * 6;
            this.vertices = new PIXI.Float32Array(numVerts);
            this.indices = new PIXI.Uint16Array(numIndices);
            this.vertexBuffer = null;
            this.indexBuffer = null;
            this.lastIndexCount = 0;
            for (var i = 0, j = 0; i < numIndices; i += 6,
                j += 4) {
                this.indices[i + 0] = j + 0;
                this.indices[i + 1] = j + 1;
                this.indices[i + 2] = j + 2;
                this.indices[i + 3] = j + 0;
                this.indices[i + 4] = j + 2;
                this.indices[i + 5] = j + 3
            }
            this.drawing = false;
            this.currentBatchSize = 0;
            this.currentBaseTexture = null;
            this.currentBlendMode = 0;
            this.renderSession = null;
            this.shader = null;
            this.matrix = null;
            this.setContext(gl)
        }
        ;
        PIXI.WebGLFastSpriteBatch.prototype.constructor = PIXI.WebGLFastSpriteBatch;
        PIXI.WebGLFastSpriteBatch.prototype.setContext = function (gl) {
            this.gl = gl;
            this.vertexBuffer = gl.createBuffer();
            this.indexBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indices, gl.STATIC_DRAW);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, this.vertices, gl.DYNAMIC_DRAW)
        }
        ;
        PIXI.WebGLFastSpriteBatch.prototype.begin = function (spriteBatch, renderSession) {
            this.renderSession = renderSession;
            this.shader = this.renderSession.shaderManager.fastShader;
            this.matrix = spriteBatch.worldTransform.toArray(true);
            this.start()
        }
        ;
        PIXI.WebGLFastSpriteBatch.prototype.end = function () {
            this.flush()
        }
        ;
        PIXI.WebGLFastSpriteBatch.prototype.render = function (spriteBatch) {
            var children = spriteBatch.children;
            var sprite = children[0];
            if (!sprite.texture._uvs)
                return;
            this.currentBaseTexture = sprite.texture.baseTexture;
            if (sprite.blendMode !== this.renderSession.blendModeManager.currentBlendMode) {
                this.flush();
                this.renderSession.blendModeManager.setBlendMode(sprite.blendMode)
            }
            for (var i = 0, j = children.length; i < j; i++) {
                this.renderSprite(children[i])
            }
            this.flush()
        }
        ;
        PIXI.WebGLFastSpriteBatch.prototype.renderSprite = function (sprite) {
            if (!sprite.visible)
                return;
            if (sprite.texture.baseTexture !== this.currentBaseTexture) {
                this.flush();
                this.currentBaseTexture = sprite.texture.baseTexture;
                if (!sprite.texture._uvs)
                    return
            }
            var uvs, verticies = this.vertices, width, height, w0, w1, h0, h1, index;
            uvs = sprite.texture._uvs;
            width = sprite.texture.frame.width;
            height = sprite.texture.frame.height;
            if (sprite.texture.trim) {
                var trim = sprite.texture.trim;
                w1 = trim.x - sprite.anchor.x * trim.width;
                w0 = w1 + sprite.texture.crop.width;
                h1 = trim.y - sprite.anchor.y * trim.height;
                h0 = h1 + sprite.texture.crop.height
            } else {
                w0 = sprite.texture.frame.width * (1 - sprite.anchor.x);
                w1 = sprite.texture.frame.width * -sprite.anchor.x;
                h0 = sprite.texture.frame.height * (1 - sprite.anchor.y);
                h1 = sprite.texture.frame.height * -sprite.anchor.y
            }
            index = this.currentBatchSize * 4 * this.vertSize;
            verticies[index++] = w1;
            verticies[index++] = h1;
            verticies[index++] = sprite.position.x;
            verticies[index++] = sprite.position.y;
            verticies[index++] = sprite.scale.x;
            verticies[index++] = sprite.scale.y;
            verticies[index++] = sprite.rotation;
            verticies[index++] = uvs.x0;
            verticies[index++] = uvs.y1;
            verticies[index++] = sprite.alpha;
            verticies[index++] = w0;
            verticies[index++] = h1;
            verticies[index++] = sprite.position.x;
            verticies[index++] = sprite.position.y;
            verticies[index++] = sprite.scale.x;
            verticies[index++] = sprite.scale.y;
            verticies[index++] = sprite.rotation;
            verticies[index++] = uvs.x1;
            verticies[index++] = uvs.y1;
            verticies[index++] = sprite.alpha;
            verticies[index++] = w0;
            verticies[index++] = h0;
            verticies[index++] = sprite.position.x;
            verticies[index++] = sprite.position.y;
            verticies[index++] = sprite.scale.x;
            verticies[index++] = sprite.scale.y;
            verticies[index++] = sprite.rotation;
            verticies[index++] = uvs.x2;
            verticies[index++] = uvs.y2;
            verticies[index++] = sprite.alpha;
            verticies[index++] = w1;
            verticies[index++] = h0;
            verticies[index++] = sprite.position.x;
            verticies[index++] = sprite.position.y;
            verticies[index++] = sprite.scale.x;
            verticies[index++] = sprite.scale.y;
            verticies[index++] = sprite.rotation;
            verticies[index++] = uvs.x3;
            verticies[index++] = uvs.y3;
            verticies[index++] = sprite.alpha;
            this.currentBatchSize++;
            if (this.currentBatchSize >= this.size) {
                this.flush()
            }
        }
        ;
        PIXI.WebGLFastSpriteBatch.prototype.flush = function () {
            if (this.currentBatchSize === 0)
                return;
            var gl = this.gl;
            if (!this.currentBaseTexture._glTextures[gl.id])
                this.renderSession.renderer.updateTexture(this.currentBaseTexture, gl);
            gl.bindTexture(gl.TEXTURE_2D, this.currentBaseTexture._glTextures[gl.id]);
            if (this.currentBatchSize > this.size * .5) {
                gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.vertices)
            } else {
                var view = this.vertices.subarray(0, this.currentBatchSize * 4 * this.vertSize);
                gl.bufferSubData(gl.ARRAY_BUFFER, 0, view)
            }
            gl.drawElements(gl.TRIANGLES, this.currentBatchSize * 6, gl.UNSIGNED_SHORT, 0);
            this.currentBatchSize = 0;
            this.renderSession.drawCount++
        }
        ;
        PIXI.WebGLFastSpriteBatch.prototype.stop = function () {
            this.flush()
        }
        ;
        PIXI.WebGLFastSpriteBatch.prototype.start = function () {
            var gl = this.gl;
            gl.activeTexture(gl.TEXTURE0);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
            var projection = this.renderSession.projection;
            gl.uniform2f(this.shader.projectionVector, projection.x, projection.y);
            gl.uniformMatrix3fv(this.shader.uMatrix, false, this.matrix);
            var stride = this.vertSize * 4;
            gl.vertexAttribPointer(this.shader.aVertexPosition, 2, gl.FLOAT, false, stride, 0);
            gl.vertexAttribPointer(this.shader.aPositionCoord, 2, gl.FLOAT, false, stride, 2 * 4);
            gl.vertexAttribPointer(this.shader.aScale, 2, gl.FLOAT, false, stride, 4 * 4);
            gl.vertexAttribPointer(this.shader.aRotation, 1, gl.FLOAT, false, stride, 6 * 4);
            gl.vertexAttribPointer(this.shader.aTextureCoord, 2, gl.FLOAT, false, stride, 7 * 4);
            gl.vertexAttribPointer(this.shader.colorAttribute, 1, gl.FLOAT, false, stride, 9 * 4)
        }
        ;
        PIXI.WebGLFilterManager = function () {
            this.filterStack = [];
            this.offsetX = 0;
            this.offsetY = 0
        }
        ;
        PIXI.WebGLFilterManager.prototype.constructor = PIXI.WebGLFilterManager;
        PIXI.WebGLFilterManager.prototype.setContext = function (gl) {
            this.gl = gl;
            this.texturePool = [];
            this.initShaderBuffers()
        }
        ;
        PIXI.WebGLFilterManager.prototype.begin = function (renderSession, buffer) {
            this.renderSession = renderSession;
            this.defaultShader = renderSession.shaderManager.defaultShader;
            var projection = this.renderSession.projection;
            this.width = projection.x * 2;
            this.height = -projection.y * 2;
            this.buffer = buffer
        }
        ;
        PIXI.WebGLFilterManager.prototype.pushFilter = function (filterBlock) {
            var gl = this.gl;
            var projection = this.renderSession.projection;
            var offset = this.renderSession.offset;
            filterBlock._filterArea = filterBlock.target.filterArea || filterBlock.target.getBounds();
            this.filterStack.push(filterBlock);
            var filter = filterBlock.filterPasses[0];
            this.offsetX += filterBlock._filterArea.x;
            this.offsetY += filterBlock._filterArea.y;
            var texture = this.texturePool.pop();
            if (!texture) {
                texture = new PIXI.FilterTexture(this.gl, this.width, this.height)
            } else {
                texture.resize(this.width, this.height)
            }
            gl.bindTexture(gl.TEXTURE_2D, texture.texture);
            var filterArea = filterBlock._filterArea;
            var padding = filter.padding;
            filterArea.x -= padding;
            filterArea.y -= padding;
            filterArea.width += padding * 2;
            filterArea.height += padding * 2;
            if (filterArea.x < 0)
                filterArea.x = 0;
            if (filterArea.width > this.width)
                filterArea.width = this.width;
            if (filterArea.y < 0)
                filterArea.y = 0;
            if (filterArea.height > this.height)
                filterArea.height = this.height;
            gl.bindFramebuffer(gl.FRAMEBUFFER, texture.frameBuffer);
            gl.viewport(0, 0, filterArea.width, filterArea.height);
            projection.x = filterArea.width / 2;
            projection.y = -filterArea.height / 2;
            offset.x = -filterArea.x;
            offset.y = -filterArea.y;
            gl.colorMask(true, true, true, true);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            filterBlock._glFilterTexture = texture
        }
        ;
        PIXI.WebGLFilterManager.prototype.popFilter = function () {
            var gl = this.gl;
            var filterBlock = this.filterStack.pop();
            var filterArea = filterBlock._filterArea;
            var texture = filterBlock._glFilterTexture;
            var projection = this.renderSession.projection;
            var offset = this.renderSession.offset;
            if (filterBlock.filterPasses.length > 1) {
                gl.viewport(0, 0, filterArea.width, filterArea.height);
                gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
                this.vertexArray[0] = 0;
                this.vertexArray[1] = filterArea.height;
                this.vertexArray[2] = filterArea.width;
                this.vertexArray[3] = filterArea.height;
                this.vertexArray[4] = 0;
                this.vertexArray[5] = 0;
                this.vertexArray[6] = filterArea.width;
                this.vertexArray[7] = 0;
                gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.vertexArray);
                gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
                this.uvArray[2] = filterArea.width / this.width;
                this.uvArray[5] = filterArea.height / this.height;
                this.uvArray[6] = filterArea.width / this.width;
                this.uvArray[7] = filterArea.height / this.height;
                gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.uvArray);
                var inputTexture = texture;
                var outputTexture = this.texturePool.pop();
                if (!outputTexture)
                    outputTexture = new PIXI.FilterTexture(this.gl, this.width, this.height);
                outputTexture.resize(this.width, this.height);
                gl.bindFramebuffer(gl.FRAMEBUFFER, outputTexture.frameBuffer);
                gl.clear(gl.COLOR_BUFFER_BIT);
                gl.disable(gl.BLEND);
                for (var i = 0; i < filterBlock.filterPasses.length - 1; i++) {
                    var filterPass = filterBlock.filterPasses[i];
                    gl.bindFramebuffer(gl.FRAMEBUFFER, outputTexture.frameBuffer);
                    gl.activeTexture(gl.TEXTURE0);
                    gl.bindTexture(gl.TEXTURE_2D, inputTexture.texture);
                    this.applyFilterPass(filterPass, filterArea, filterArea.width, filterArea.height);
                    var temp = inputTexture;
                    inputTexture = outputTexture;
                    outputTexture = temp
                }
                gl.enable(gl.BLEND);
                texture = inputTexture;
                this.texturePool.push(outputTexture)
            }
            var filter = filterBlock.filterPasses[filterBlock.filterPasses.length - 1];
            this.offsetX -= filterArea.x;
            this.offsetY -= filterArea.y;
            var sizeX = this.width;
            var sizeY = this.height;
            var offsetX = 0;
            var offsetY = 0;
            var buffer = this.buffer;
            if (this.filterStack.length === 0) {
                gl.colorMask(true, true, true, true)
            } else {
                var currentFilter = this.filterStack[this.filterStack.length - 1];
                filterArea = currentFilter._filterArea;
                sizeX = filterArea.width;
                sizeY = filterArea.height;
                offsetX = filterArea.x;
                offsetY = filterArea.y;
                buffer = currentFilter._glFilterTexture.frameBuffer
            }
            projection.x = sizeX / 2;
            projection.y = -sizeY / 2;
            offset.x = offsetX;
            offset.y = offsetY;
            filterArea = filterBlock._filterArea;
            var x = filterArea.x - offsetX;
            var y = filterArea.y - offsetY;
            gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
            this.vertexArray[0] = x;
            this.vertexArray[1] = y + filterArea.height;
            this.vertexArray[2] = x + filterArea.width;
            this.vertexArray[3] = y + filterArea.height;
            this.vertexArray[4] = x;
            this.vertexArray[5] = y;
            this.vertexArray[6] = x + filterArea.width;
            this.vertexArray[7] = y;
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.vertexArray);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
            this.uvArray[2] = filterArea.width / this.width;
            this.uvArray[5] = filterArea.height / this.height;
            this.uvArray[6] = filterArea.width / this.width;
            this.uvArray[7] = filterArea.height / this.height;
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.uvArray);
            gl.viewport(0, 0, sizeX, sizeY);
            gl.bindFramebuffer(gl.FRAMEBUFFER, buffer);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, texture.texture);
            this.applyFilterPass(filter, filterArea, sizeX, sizeY);
            this.texturePool.push(texture);
            filterBlock._glFilterTexture = null
        }
        ;
        PIXI.WebGLFilterManager.prototype.applyFilterPass = function (filter, filterArea, width, height) {
            var gl = this.gl;
            var shader = filter.shaders[gl.id];
            if (!shader) {
                shader = new PIXI.PixiShader(gl);
                shader.fragmentSrc = filter.fragmentSrc;
                shader.uniforms = filter.uniforms;
                shader.init();
                filter.shaders[gl.id] = shader
            }
            this.renderSession.shaderManager.setShader(shader);
            gl.uniform2f(shader.projectionVector, width / 2, -height / 2);
            gl.uniform2f(shader.offsetVector, 0, 0);
            if (filter.uniforms.dimensions) {
                filter.uniforms.dimensions.value[0] = this.width;
                filter.uniforms.dimensions.value[1] = this.height;
                filter.uniforms.dimensions.value[2] = this.vertexArray[0];
                filter.uniforms.dimensions.value[3] = this.vertexArray[5]
            }
            shader.syncUniforms();
            gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
            gl.vertexAttribPointer(shader.aVertexPosition, 2, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
            gl.vertexAttribPointer(shader.aTextureCoord, 2, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
            gl.vertexAttribPointer(shader.colorAttribute, 2, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
            gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
            this.renderSession.drawCount++
        }
        ;
        PIXI.WebGLFilterManager.prototype.initShaderBuffers = function () {
            var gl = this.gl;
            this.vertexBuffer = gl.createBuffer();
            this.uvBuffer = gl.createBuffer();
            this.colorBuffer = gl.createBuffer();
            this.indexBuffer = gl.createBuffer();
            this.vertexArray = new PIXI.Float32Array([0, 0, 1, 0, 0, 1, 1, 1]);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, this.vertexArray, gl.STATIC_DRAW);
            this.uvArray = new PIXI.Float32Array([0, 0, 1, 0, 0, 1, 1, 1]);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, this.uvArray, gl.STATIC_DRAW);
            this.colorArray = new PIXI.Float32Array([1, 16777215, 1, 16777215, 1, 16777215, 1, 16777215]);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, this.colorArray, gl.STATIC_DRAW);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 1, 3, 2]), gl.STATIC_DRAW)
        }
        ;
        PIXI.WebGLFilterManager.prototype.destroy = function () {
            var gl = this.gl;
            this.filterStack = null;
            this.offsetX = 0;
            this.offsetY = 0;
            for (var i = 0; i < this.texturePool.length; i++) {
                this.texturePool[i].destroy()
            }
            this.texturePool = null;
            gl.deleteBuffer(this.vertexBuffer);
            gl.deleteBuffer(this.uvBuffer);
            gl.deleteBuffer(this.colorBuffer);
            gl.deleteBuffer(this.indexBuffer)
        }
        ;
        PIXI.FilterTexture = function (gl, width, height, scaleMode) {
            this.gl = gl;
            this.frameBuffer = gl.createFramebuffer();
            this.texture = gl.createTexture();
            scaleMode = scaleMode || PIXI.scaleModes.DEFAULT;
            gl.bindTexture(gl.TEXTURE_2D, this.texture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, scaleMode === PIXI.scaleModes.LINEAR ? gl.LINEAR : gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, scaleMode === PIXI.scaleModes.LINEAR ? gl.LINEAR : gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.frameBuffer);
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.frameBuffer);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0);
            this.renderBuffer = gl.createRenderbuffer();
            gl.bindRenderbuffer(gl.RENDERBUFFER, this.renderBuffer);
            gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, this.renderBuffer);
            this.resize(width, height)
        }
        ;
        PIXI.FilterTexture.prototype.constructor = PIXI.FilterTexture;
        PIXI.FilterTexture.prototype.clear = function () {
            var gl = this.gl;
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT)
        }
        ;
        PIXI.FilterTexture.prototype.resize = function (width, height) {
            if (this.width === width && this.height === height)
                return;
            this.width = width;
            this.height = height;
            var gl = this.gl;
            gl.bindTexture(gl.TEXTURE_2D, this.texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
            gl.bindRenderbuffer(gl.RENDERBUFFER, this.renderBuffer);
            gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_STENCIL, width, height)
        }
        ;
        PIXI.FilterTexture.prototype.destroy = function () {
            var gl = this.gl;
            gl.deleteFramebuffer(this.frameBuffer);
            gl.deleteTexture(this.texture);
            this.frameBuffer = null;
            this.texture = null
        }
        ;
        PIXI.CanvasBuffer = function (width, height) {
            this.width = width;
            this.height = height;
            this.canvas = document.createElement("canvas");
            this.context = this.canvas.getContext("2d");
            this.canvas.width = width;
            this.canvas.height = height
        }
        ;
        PIXI.CanvasBuffer.prototype.constructor = PIXI.CanvasBuffer;
        PIXI.CanvasBuffer.prototype.clear = function () {
            this.context.setTransform(1, 0, 0, 1, 0, 0);
            this.context.clearRect(0, 0, this.width, this.height)
        }
        ;
        PIXI.CanvasBuffer.prototype.resize = function (width, height) {
            this.width = this.canvas.width = width;
            this.height = this.canvas.height = height
        }
        ;
        PIXI.CanvasMaskManager = function () {
        }
        ;
        PIXI.CanvasMaskManager.prototype.constructor = PIXI.CanvasMaskManager;
        PIXI.CanvasMaskManager.prototype.pushMask = function (maskData, renderSession) {
            var context = renderSession.context;
            context.save();
            var cacheAlpha = maskData.alpha;
            var transform = maskData.worldTransform;
            var resolution = renderSession.resolution;
            context.setTransform(transform.a * resolution, transform.b * resolution, transform.c * resolution, transform.d * resolution, transform.tx * resolution, transform.ty * resolution);
            PIXI.CanvasGraphics.renderGraphicsMask(maskData, context);
            context.clip();
            maskData.worldAlpha = cacheAlpha
        }
        ;
        PIXI.CanvasMaskManager.prototype.popMask = function (renderSession) {
            renderSession.context.restore()
        }
        ;
        PIXI.CanvasTinter = function () {
        }
        ;
        PIXI.CanvasTinter.getTintedTexture = function (sprite, color) {
            var texture = sprite.texture;
            color = PIXI.CanvasTinter.roundColor(color);
            var stringColor = "#" + ("00000" + (color | 0).toString(16)).substr(-6);
            texture.tintCache = texture.tintCache || {};
            if (texture.tintCache[stringColor])
                return texture.tintCache[stringColor];
            var canvas = PIXI.CanvasTinter.canvas || document.createElement("canvas");
            PIXI.CanvasTinter.tintMethod(texture, color, canvas);
            if (PIXI.CanvasTinter.convertTintToImage) {
                var tintImage = new Image;
                tintImage.src = canvas.toDataURL();
                texture.tintCache[stringColor] = tintImage
            } else {
                texture.tintCache[stringColor] = canvas;
                PIXI.CanvasTinter.canvas = null
            }
            return canvas
        }
        ;
        PIXI.CanvasTinter.tintWithMultiply = function (texture, color, canvas) {
            var context = canvas.getContext("2d");
            var crop = texture.crop;
            canvas.width = crop.width;
            canvas.height = crop.height;
            context.fillStyle = "#" + ("00000" + (color | 0).toString(16)).substr(-6);
            context.fillRect(0, 0, crop.width, crop.height);
            context.globalCompositeOperation = "multiply";
            context.drawImage(texture.baseTexture.source, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
            context.globalCompositeOperation = "destination-atop";
            context.drawImage(texture.baseTexture.source, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height)
        }
        ;
        PIXI.CanvasTinter.tintWithOverlay = function (texture, color, canvas) {
            var context = canvas.getContext("2d");
            var crop = texture.crop;
            canvas.width = crop.width;
            canvas.height = crop.height;
            context.globalCompositeOperation = "copy";
            context.fillStyle = "#" + ("00000" + (color | 0).toString(16)).substr(-6);
            context.fillRect(0, 0, crop.width, crop.height);
            context.globalCompositeOperation = "destination-atop";
            context.drawImage(texture.baseTexture.source, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height)
        }
        ;
        PIXI.CanvasTinter.tintWithPerPixel = function (texture, color, canvas) {
            var context = canvas.getContext("2d");
            var crop = texture.crop;
            canvas.width = crop.width;
            canvas.height = crop.height;
            context.globalCompositeOperation = "copy";
            context.drawImage(texture.baseTexture.source, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
            var rgbValues = PIXI.hex2rgb(color);
            var r = rgbValues[0]
                , g = rgbValues[1]
                , b = rgbValues[2];
            var pixelData = context.getImageData(0, 0, crop.width, crop.height);
            var pixels = pixelData.data;
            for (var i = 0; i < pixels.length; i += 4) {
                pixels[i + 0] *= r;
                pixels[i + 1] *= g;
                pixels[i + 2] *= b
            }
            context.putImageData(pixelData, 0, 0)
        }
        ;
        PIXI.CanvasTinter.roundColor = function (color) {
            var step = PIXI.CanvasTinter.cacheStepsPerColorChannel;
            var rgbValues = PIXI.hex2rgb(color);
            rgbValues[0] = Math.min(255, rgbValues[0] / step * step);
            rgbValues[1] = Math.min(255, rgbValues[1] / step * step);
            rgbValues[2] = Math.min(255, rgbValues[2] / step * step);
            return PIXI.rgb2hex(rgbValues)
        }
        ;
        PIXI.CanvasTinter.cacheStepsPerColorChannel = 8;
        PIXI.CanvasTinter.convertTintToImage = false;
        PIXI.CanvasTinter.canUseMultiply = PIXI.canUseNewCanvasBlendModes();
        PIXI.CanvasTinter.tintMethod = PIXI.CanvasTinter.canUseMultiply ? PIXI.CanvasTinter.tintWithMultiply : PIXI.CanvasTinter.tintWithPerPixel;
        PIXI.CanvasRenderer = function (width, height, options) {
            if (options) {
                for (var i in PIXI.defaultRenderOptions) {
                    if (typeof options[i] === "undefined")
                        options[i] = PIXI.defaultRenderOptions[i]
                }
            } else {
                options = PIXI.defaultRenderOptions
            }
            if (!PIXI.defaultRenderer) {
                PIXI.sayHello("Canvas");
                PIXI.defaultRenderer = this
            }
            this.type = PIXI.CANVAS_RENDERER;
            this.resolution = options.resolution;
            this.clearBeforeRender = options.clearBeforeRender;
            this.transparent = options.transparent;
            this.autoResize = options.autoResize || false;
            this.width = width || 800;
            this.height = height || 600;
            this.width *= this.resolution;
            this.height *= this.resolution;
            this.view = options.view || document.createElement("canvas");
            this.context = this.view.getContext("2d", {
                alpha: this.transparent
            });
            this.refresh = true;
            this.view.width = this.width * this.resolution;
            this.view.height = this.height * this.resolution;
            this.count = 0;
            this.maskManager = new PIXI.CanvasMaskManager;
            this.renderSession = {
                context: this.context,
                maskManager: this.maskManager,
                scaleMode: null,
                smoothProperty: null,
                roundPixels: false
            };
            this.mapBlendModes();
            this.resize(width, height);
            if ("imageSmoothingEnabled" in this.context)
                this.renderSession.smoothProperty = "imageSmoothingEnabled";
            else if ("webkitImageSmoothingEnabled" in this.context)
                this.renderSession.smoothProperty = "webkitImageSmoothingEnabled";
            else if ("mozImageSmoothingEnabled" in this.context)
                this.renderSession.smoothProperty = "mozImageSmoothingEnabled";
            else if ("oImageSmoothingEnabled" in this.context)
                this.renderSession.smoothProperty = "oImageSmoothingEnabled";
            else if ("msImageSmoothingEnabled" in this.context)
                this.renderSession.smoothProperty = "msImageSmoothingEnabled"
        }
        ;
        PIXI.CanvasRenderer.prototype.constructor = PIXI.CanvasRenderer;
        PIXI.CanvasRenderer.prototype.render = function (stage) {
            stage.updateTransform();
            this.context.setTransform(1, 0, 0, 1, 0, 0);
            this.context.globalAlpha = 1;
            this.renderSession.currentBlendMode = PIXI.blendModes.NORMAL;
            this.context.globalCompositeOperation = PIXI.blendModesCanvas[PIXI.blendModes.NORMAL];
            if (navigator.isCocoonJS && this.view.screencanvas) {
                this.context.fillStyle = "black";
                this.context.clear()
            }
            if (this.clearBeforeRender) {
                if (this.transparent) {
                    this.context.clearRect(0, 0, this.width, this.height)
                } else {
                    this.context.fillStyle = stage.backgroundColorString;
                    this.context.fillRect(0, 0, this.width, this.height)
                }
            }
            this.renderDisplayObject(stage);
            if (stage.interactive) {
                if (!stage._interactiveEventsAdded) {
                    stage._interactiveEventsAdded = true;
                    stage.interactionManager.setTarget(this)
                }
            }
        }
        ;
        PIXI.CanvasRenderer.prototype.destroy = function (removeView) {
            if (typeof removeView === "undefined") {
                removeView = true
            }
            if (removeView && this.view.parent) {
                this.view.parent.removeChild(this.view)
            }
            this.view = null;
            this.context = null;
            this.maskManager = null;
            this.renderSession = null
        }
        ;
        PIXI.CanvasRenderer.prototype.resize = function (width, height) {
            this.width = width * this.resolution;
            this.height = height * this.resolution;
            this.view.width = this.width;
            this.view.height = this.height;
            if (this.autoResize) {
                this.view.style.width = this.width / this.resolution + "px";
                this.view.style.height = this.height / this.resolution + "px"
            }
        }
        ;
        PIXI.CanvasRenderer.prototype.renderDisplayObject = function (displayObject, context) {
            this.renderSession.context = context || this.context;
            this.renderSession.resolution = this.resolution;
            displayObject._renderCanvas(this.renderSession)
        }
        ;
        PIXI.CanvasRenderer.prototype.mapBlendModes = function () {
            if (!PIXI.blendModesCanvas) {
                PIXI.blendModesCanvas = [];
                if (PIXI.canUseNewCanvasBlendModes()) {
                    PIXI.blendModesCanvas[PIXI.blendModes.NORMAL] = "source-over";
                    PIXI.blendModesCanvas[PIXI.blendModes.ADD] = "lighter";
                    PIXI.blendModesCanvas[PIXI.blendModes.MULTIPLY] = "multiply";
                    PIXI.blendModesCanvas[PIXI.blendModes.SCREEN] = "screen";
                    PIXI.blendModesCanvas[PIXI.blendModes.OVERLAY] = "overlay";
                    PIXI.blendModesCanvas[PIXI.blendModes.DARKEN] = "darken";
                    PIXI.blendModesCanvas[PIXI.blendModes.LIGHTEN] = "lighten";
                    PIXI.blendModesCanvas[PIXI.blendModes.COLOR_DODGE] = "color-dodge";
                    PIXI.blendModesCanvas[PIXI.blendModes.COLOR_BURN] = "color-burn";
                    PIXI.blendModesCanvas[PIXI.blendModes.HARD_LIGHT] = "hard-light";
                    PIXI.blendModesCanvas[PIXI.blendModes.SOFT_LIGHT] = "soft-light";
                    PIXI.blendModesCanvas[PIXI.blendModes.DIFFERENCE] = "difference";
                    PIXI.blendModesCanvas[PIXI.blendModes.EXCLUSION] = "exclusion";
                    PIXI.blendModesCanvas[PIXI.blendModes.HUE] = "hue";
                    PIXI.blendModesCanvas[PIXI.blendModes.SATURATION] = "saturation";
                    PIXI.blendModesCanvas[PIXI.blendModes.COLOR] = "color";
                    PIXI.blendModesCanvas[PIXI.blendModes.LUMINOSITY] = "luminosity"
                } else {
                    PIXI.blendModesCanvas[PIXI.blendModes.NORMAL] = "source-over";
                    PIXI.blendModesCanvas[PIXI.blendModes.ADD] = "lighter";
                    PIXI.blendModesCanvas[PIXI.blendModes.MULTIPLY] = "source-over";
                    PIXI.blendModesCanvas[PIXI.blendModes.SCREEN] = "source-over";
                    PIXI.blendModesCanvas[PIXI.blendModes.OVERLAY] = "source-over";
                    PIXI.blendModesCanvas[PIXI.blendModes.DARKEN] = "source-over";
                    PIXI.blendModesCanvas[PIXI.blendModes.LIGHTEN] = "source-over";
                    PIXI.blendModesCanvas[PIXI.blendModes.COLOR_DODGE] = "source-over";
                    PIXI.blendModesCanvas[PIXI.blendModes.COLOR_BURN] = "source-over";
                    PIXI.blendModesCanvas[PIXI.blendModes.HARD_LIGHT] = "source-over";
                    PIXI.blendModesCanvas[PIXI.blendModes.SOFT_LIGHT] = "source-over";
                    PIXI.blendModesCanvas[PIXI.blendModes.DIFFERENCE] = "source-over";
                    PIXI.blendModesCanvas[PIXI.blendModes.EXCLUSION] = "source-over";
                    PIXI.blendModesCanvas[PIXI.blendModes.HUE] = "source-over";
                    PIXI.blendModesCanvas[PIXI.blendModes.SATURATION] = "source-over";
                    PIXI.blendModesCanvas[PIXI.blendModes.COLOR] = "source-over";
                    PIXI.blendModesCanvas[PIXI.blendModes.LUMINOSITY] = "source-over"
                }
            }
        }
        ;
        PIXI.CanvasGraphics = function () {
        }
        ;
        PIXI.CanvasGraphics.renderGraphics = function (graphics, context) {
            var worldAlpha = graphics.worldAlpha;
            if (graphics.dirty) {
                this.updateGraphicsTint(graphics);
                graphics.dirty = false
            }
            for (var i = 0; i < graphics.graphicsData.length; i++) {
                var data = graphics.graphicsData[i];
                var shape = data.shape;
                var fillColor = data._fillTint;
                var lineColor = data._lineTint;
                context.lineWidth = data.lineWidth;
                if (data.type === PIXI.Graphics.POLY) {
                    context.beginPath();
                    var points = shape.points;
                    context.moveTo(points[0], points[1]);
                    for (var j = 1; j < points.length / 2; j++) {
                        context.lineTo(points[j * 2], points[j * 2 + 1])
                    }
                    if (shape.closed) {
                        context.lineTo(points[0], points[1])
                    }
                    if (points[0] === points[points.length - 2] && points[1] === points[points.length - 1]) {
                        context.closePath()
                    }
                    if (data.fill) {
                        context.globalAlpha = data.fillAlpha * worldAlpha;
                        context.fillStyle = "#" + ("00000" + (fillColor | 0).toString(16)).substr(-6);
                        context.fill()
                    }
                    if (data.lineWidth) {
                        context.globalAlpha = data.lineAlpha * worldAlpha;
                        context.strokeStyle = "#" + ("00000" + (lineColor | 0).toString(16)).substr(-6);
                        context.stroke()
                    }
                } else if (data.type === PIXI.Graphics.RECT) {
                    if (data.fillColor || data.fillColor === 0) {
                        context.globalAlpha = data.fillAlpha * worldAlpha;
                        context.fillStyle = "#" + ("00000" + (fillColor | 0).toString(16)).substr(-6);
                        context.fillRect(shape.x, shape.y, shape.width, shape.height)
                    }
                    if (data.lineWidth) {
                        context.globalAlpha = data.lineAlpha * worldAlpha;
                        context.strokeStyle = "#" + ("00000" + (lineColor | 0).toString(16)).substr(-6);
                        context.strokeRect(shape.x, shape.y, shape.width, shape.height)
                    }
                } else if (data.type === PIXI.Graphics.CIRC) {
                    context.beginPath();
                    context.arc(shape.x, shape.y, shape.radius, 0, 2 * Math.PI);
                    context.closePath();
                    if (data.fill) {
                        context.globalAlpha = data.fillAlpha * worldAlpha;
                        context.fillStyle = "#" + ("00000" + (fillColor | 0).toString(16)).substr(-6);
                        context.fill()
                    }
                    if (data.lineWidth) {
                        context.globalAlpha = data.lineAlpha * worldAlpha;
                        context.strokeStyle = "#" + ("00000" + (lineColor | 0).toString(16)).substr(-6);
                        context.stroke()
                    }
                } else if (data.type === PIXI.Graphics.ELIP) {
                    var w = shape.width * 2;
                    var h = shape.height * 2;
                    var x = shape.x - w / 2;
                    var y = shape.y - h / 2;
                    context.beginPath();
                    var kappa = .5522848
                        , ox = w / 2 * kappa
                        , oy = h / 2 * kappa
                        , xe = x + w
                        , ye = y + h
                        , xm = x + w / 2
                        , ym = y + h / 2;
                    context.moveTo(x, ym);
                    context.bezierCurveTo(x, ym - oy, xm - ox, y, xm, y);
                    context.bezierCurveTo(xm + ox, y, xe, ym - oy, xe, ym);
                    context.bezierCurveTo(xe, ym + oy, xm + ox, ye, xm, ye);
                    context.bezierCurveTo(xm - ox, ye, x, ym + oy, x, ym);
                    context.closePath();
                    if (data.fill) {
                        context.globalAlpha = data.fillAlpha * worldAlpha;
                        context.fillStyle = "#" + ("00000" + (fillColor | 0).toString(16)).substr(-6);
                        context.fill()
                    }
                    if (data.lineWidth) {
                        context.globalAlpha = data.lineAlpha * worldAlpha;
                        context.strokeStyle = "#" + ("00000" + (lineColor | 0).toString(16)).substr(-6);
                        context.stroke()
                    }
                } else if (data.type === PIXI.Graphics.RREC) {
                    var rx = shape.x;
                    var ry = shape.y;
                    var width = shape.width;
                    var height = shape.height;
                    var radius = shape.radius;
                    var maxRadius = Math.min(width, height) / 2 | 0;
                    radius = radius > maxRadius ? maxRadius : radius;
                    context.beginPath();
                    context.moveTo(rx, ry + radius);
                    context.lineTo(rx, ry + height - radius);
                    context.quadraticCurveTo(rx, ry + height, rx + radius, ry + height);
                    context.lineTo(rx + width - radius, ry + height);
                    context.quadraticCurveTo(rx + width, ry + height, rx + width, ry + height - radius);
                    context.lineTo(rx + width, ry + radius);
                    context.quadraticCurveTo(rx + width, ry, rx + width - radius, ry);
                    context.lineTo(rx + radius, ry);
                    context.quadraticCurveTo(rx, ry, rx, ry + radius);
                    context.closePath();
                    if (data.fillColor || data.fillColor === 0) {
                        context.globalAlpha = data.fillAlpha * worldAlpha;
                        context.fillStyle = "#" + ("00000" + (fillColor | 0).toString(16)).substr(-6);
                        context.fill()
                    }
                    if (data.lineWidth) {
                        context.globalAlpha = data.lineAlpha * worldAlpha;
                        context.strokeStyle = "#" + ("00000" + (lineColor | 0).toString(16)).substr(-6);
                        context.stroke()
                    }
                }
            }
        }
        ;
        PIXI.CanvasGraphics.renderGraphicsMask = function (graphics, context) {
            var len = graphics.graphicsData.length;
            if (len === 0)
                return;
            if (len > 1) {
                len = 1;
                window.console.log("Pixi.js warning: masks in canvas can only mask using the first path in the graphics object")
            }
            for (var i = 0; i < 1; i++) {
                var data = graphics.graphicsData[i];
                var shape = data.shape;
                if (data.type === PIXI.Graphics.POLY) {
                    context.beginPath();
                    var points = shape.points;
                    context.moveTo(points[0], points[1]);
                    for (var j = 1; j < points.length / 2; j++) {
                        context.lineTo(points[j * 2], points[j * 2 + 1])
                    }
                    if (points[0] === points[points.length - 2] && points[1] === points[points.length - 1]) {
                        context.closePath()
                    }
                } else if (data.type === PIXI.Graphics.RECT) {
                    context.beginPath();
                    context.rect(shape.x, shape.y, shape.width, shape.height);
                    context.closePath()
                } else if (data.type === PIXI.Graphics.CIRC) {
                    context.beginPath();
                    context.arc(shape.x, shape.y, shape.radius, 0, 2 * Math.PI);
                    context.closePath()
                } else if (data.type === PIXI.Graphics.ELIP) {
                    var w = shape.width * 2;
                    var h = shape.height * 2;
                    var x = shape.x - w / 2;
                    var y = shape.y - h / 2;
                    context.beginPath();
                    var kappa = .5522848
                        , ox = w / 2 * kappa
                        , oy = h / 2 * kappa
                        , xe = x + w
                        , ye = y + h
                        , xm = x + w / 2
                        , ym = y + h / 2;
                    context.moveTo(x, ym);
                    context.bezierCurveTo(x, ym - oy, xm - ox, y, xm, y);
                    context.bezierCurveTo(xm + ox, y, xe, ym - oy, xe, ym);
                    context.bezierCurveTo(xe, ym + oy, xm + ox, ye, xm, ye);
                    context.bezierCurveTo(xm - ox, ye, x, ym + oy, x, ym);
                    context.closePath()
                } else if (data.type === PIXI.Graphics.RREC) {
                    var pts = shape.points;
                    var rx = pts[0];
                    var ry = pts[1];
                    var width = pts[2];
                    var height = pts[3];
                    var radius = pts[4];
                    var maxRadius = Math.min(width, height) / 2 | 0;
                    radius = radius > maxRadius ? maxRadius : radius;
                    context.beginPath();
                    context.moveTo(rx, ry + radius);
                    context.lineTo(rx, ry + height - radius);
                    context.quadraticCurveTo(rx, ry + height, rx + radius, ry + height);
                    context.lineTo(rx + width - radius, ry + height);
                    context.quadraticCurveTo(rx + width, ry + height, rx + width, ry + height - radius);
                    context.lineTo(rx + width, ry + radius);
                    context.quadraticCurveTo(rx + width, ry, rx + width - radius, ry);
                    context.lineTo(rx + radius, ry);
                    context.quadraticCurveTo(rx, ry, rx, ry + radius);
                    context.closePath()
                }
            }
        }
        ;
        PIXI.CanvasGraphics.updateGraphicsTint = function (graphics) {
            if (graphics.tint === 16777215)
                return;
            var tintR = (graphics.tint >> 16 & 255) / 255;
            var tintG = (graphics.tint >> 8 & 255) / 255;
            var tintB = (graphics.tint & 255) / 255;
            for (var i = 0; i < graphics.graphicsData.length; i++) {
                var data = graphics.graphicsData[i];
                var fillColor = data.fillColor | 0;
                var lineColor = data.lineColor | 0;
                data._fillTint = ((fillColor >> 16 & 255) / 255 * tintR * 255 << 16) + ((fillColor >> 8 & 255) / 255 * tintG * 255 << 8) + (fillColor & 255) / 255 * tintB * 255;
                data._lineTint = ((lineColor >> 16 & 255) / 255 * tintR * 255 << 16) + ((lineColor >> 8 & 255) / 255 * tintG * 255 << 8) + (lineColor & 255) / 255 * tintB * 255
            }
        }
        ;
        PIXI.Graphics = function () {
            PIXI.DisplayObjectContainer.call(this);
            this.renderable = true;
            this.fillAlpha = 1;
            this.lineWidth = 0;
            this.lineColor = 0;
            this.graphicsData = [];
            this.tint = 16777215;
            this.blendMode = PIXI.blendModes.NORMAL;
            this.currentPath = null;
            this._webGL = [];
            this.isMask = false;
            this.boundsPadding = 0;
            this._localBounds = new PIXI.Rectangle(0, 0, 1, 1);
            this.dirty = true;
            this.webGLDirty = false;
            this.cachedSpriteDirty = false
        }
        ;
        PIXI.Graphics.prototype = Object.create(PIXI.DisplayObjectContainer.prototype);
        PIXI.Graphics.prototype.constructor = PIXI.Graphics;
        Object.defineProperty(PIXI.Graphics.prototype, "cacheAsBitmap", {
            get: function () {
                return this._cacheAsBitmap
            },
            set: function (value) {
                this._cacheAsBitmap = value;
                if (this._cacheAsBitmap) {
                    this._generateCachedSprite()
                } else {
                    this.destroyCachedSprite();
                    this.dirty = true
                }
            }
        });
        PIXI.Graphics.prototype.lineStyle = function (lineWidth, color, alpha) {
            this.lineWidth = lineWidth || 0;
            this.lineColor = color || 0;
            this.lineAlpha = arguments.length < 3 ? 1 : alpha;
            if (this.currentPath) {
                if (this.currentPath.shape.points.length) {
                    this.drawShape(new PIXI.Polygon(this.currentPath.shape.points.slice(-2)));
                    return this
                }
                this.currentPath.lineWidth = this.lineWidth;
                this.currentPath.lineColor = this.lineColor;
                this.currentPath.lineAlpha = this.lineAlpha
            }
            return this
        }
        ;
        PIXI.Graphics.prototype.moveTo = function (x, y) {
            this.drawShape(new PIXI.Polygon([x, y]));
            return this
        }
        ;
        PIXI.Graphics.prototype.lineTo = function (x, y) {
            this.currentPath.shape.points.push(x, y);
            this.dirty = true;
            return this
        }
        ;
        PIXI.Graphics.prototype.quadraticCurveTo = function (cpX, cpY, toX, toY) {
            if (this.currentPath) {
                if (this.currentPath.shape.points.length === 0)
                    this.currentPath.shape.points = [0, 0]
            } else {
                this.moveTo(0, 0)
            }
            var xa, ya, n = 20, points = this.currentPath.shape.points;
            if (points.length === 0)
                this.moveTo(0, 0);
            var fromX = points[points.length - 2];
            var fromY = points[points.length - 1];
            var j = 0;
            for (var i = 1; i <= n; i++) {
                j = i / n;
                xa = fromX + (cpX - fromX) * j;
                ya = fromY + (cpY - fromY) * j;
                points.push(xa + (cpX + (toX - cpX) * j - xa) * j, ya + (cpY + (toY - cpY) * j - ya) * j)
            }
            this.dirty = true;
            return this
        }
        ;
        PIXI.Graphics.prototype.bezierCurveTo = function (cpX, cpY, cpX2, cpY2, toX, toY) {
            if (this.currentPath) {
                if (this.currentPath.shape.points.length === 0)
                    this.currentPath.shape.points = [0, 0]
            } else {
                this.moveTo(0, 0)
            }
            var n = 20, dt, dt2, dt3, t2, t3, points = this.currentPath.shape.points;
            var fromX = points[points.length - 2];
            var fromY = points[points.length - 1];
            var j = 0;
            for (var i = 1; i <= n; i++) {
                j = i / n;
                dt = 1 - j;
                dt2 = dt * dt;
                dt3 = dt2 * dt;
                t2 = j * j;
                t3 = t2 * j;
                points.push(dt3 * fromX + 3 * dt2 * j * cpX + 3 * dt * t2 * cpX2 + t3 * toX, dt3 * fromY + 3 * dt2 * j * cpY + 3 * dt * t2 * cpY2 + t3 * toY)
            }
            this.dirty = true;
            return this
        }
        ;
        PIXI.Graphics.prototype.arcTo = function (x1, y1, x2, y2, radius) {
            if (this.currentPath) {
                if (this.currentPath.shape.points.length === 0) {
                    this.currentPath.shape.points.push(x1, y1)
                }
            } else {
                this.moveTo(x1, y1)
            }
            var points = this.currentPath.shape.points;
            var fromX = points[points.length - 2];
            var fromY = points[points.length - 1];
            var a1 = fromY - y1;
            var b1 = fromX - x1;
            var a2 = y2 - y1;
            var b2 = x2 - x1;
            var mm = Math.abs(a1 * b2 - b1 * a2);
            if (mm < 1e-8 || radius === 0) {
                if (points[points.length - 2] !== x1 || points[points.length - 1] !== y1) {
                    points.push(x1, y1)
                }
            } else {
                var dd = a1 * a1 + b1 * b1;
                var cc = a2 * a2 + b2 * b2;
                var tt = a1 * a2 + b1 * b2;
                var k1 = radius * Math.sqrt(dd) / mm;
                var k2 = radius * Math.sqrt(cc) / mm;
                var j1 = k1 * tt / dd;
                var j2 = k2 * tt / cc;
                var cx = k1 * b2 + k2 * b1;
                var cy = k1 * a2 + k2 * a1;
                var px = b1 * (k2 + j1);
                var py = a1 * (k2 + j1);
                var qx = b2 * (k1 + j2);
                var qy = a2 * (k1 + j2);
                var startAngle = Math.atan2(py - cy, px - cx);
                var endAngle = Math.atan2(qy - cy, qx - cx);
                this.arc(cx + x1, cy + y1, radius, startAngle, endAngle, b1 * a2 > b2 * a1)
            }
            this.dirty = true;
            return this
        }
        ;
        PIXI.Graphics.prototype.arc = function (cx, cy, radius, startAngle, endAngle, anticlockwise) {
            var startX = cx + Math.cos(startAngle) * radius;
            var startY = cy + Math.sin(startAngle) * radius;
            var points;
            if (this.currentPath) {
                points = this.currentPath.shape.points;
                if (points.length === 0) {
                    points.push(startX, startY)
                } else if (points[points.length - 2] !== startX || points[points.length - 1] !== startY) {
                    points.push(startX, startY)
                }
            } else {
                this.moveTo(startX, startY);
                points = this.currentPath.shape.points
            }
            if (startAngle === endAngle)
                return this;
            if (!anticlockwise && endAngle <= startAngle) {
                endAngle += Math.PI * 2
            } else if (anticlockwise && startAngle <= endAngle) {
                startAngle += Math.PI * 2
            }
            var sweep = anticlockwise ? (startAngle - endAngle) * -1 : endAngle - startAngle;
            var segs = Math.abs(sweep) / (Math.PI * 2) * 40;
            if (sweep === 0)
                return this;
            var theta = sweep / (segs * 2);
            var theta2 = theta * 2;
            var cTheta = Math.cos(theta);
            var sTheta = Math.sin(theta);
            var segMinus = segs - 1;
            var remainder = segMinus % 1 / segMinus;
            for (var i = 0; i <= segMinus; i++) {
                var real = i + remainder * i;
                var angle = theta + startAngle + theta2 * real;
                var c = Math.cos(angle);
                var s = -Math.sin(angle);
                points.push((cTheta * c + sTheta * s) * radius + cx, (cTheta * -s + sTheta * c) * radius + cy)
            }
            this.dirty = true;
            return this
        }
        ;
        PIXI.Graphics.prototype.beginFill = function (color, alpha) {
            this.filling = true;
            this.fillColor = color || 0;
            this.fillAlpha = alpha === undefined ? 1 : alpha;
            if (this.currentPath) {
                if (this.currentPath.shape.points.length <= 2) {
                    this.currentPath.fill = this.filling;
                    this.currentPath.fillColor = this.fillColor;
                    this.currentPath.fillAlpha = this.fillAlpha
                }
            }
            return this
        }
        ;
        PIXI.Graphics.prototype.endFill = function () {
            this.filling = false;
            this.fillColor = null;
            this.fillAlpha = 1;
            return this
        }
        ;
        PIXI.Graphics.prototype.drawRect = function (x, y, width, height) {
            this.drawShape(new PIXI.Rectangle(x, y, width, height));
            return this
        }
        ;
        PIXI.Graphics.prototype.drawRoundedRect = function (x, y, width, height, radius) {
            this.drawShape(new PIXI.RoundedRectangle(x, y, width, height, radius));
            return this
        }
        ;
        PIXI.Graphics.prototype.drawCircle = function (x, y, radius) {
            this.drawShape(new PIXI.Circle(x, y, radius));
            return this
        }
        ;
        PIXI.Graphics.prototype.drawEllipse = function (x, y, width, height) {
            this.drawShape(new PIXI.Ellipse(x, y, width, height));
            return this
        }
        ;
        PIXI.Graphics.prototype.drawPolygon = function (path) {
            if (!(path instanceof Array))
                path = Array.prototype.slice.call(arguments);
            this.drawShape(new PIXI.Polygon(path));
            return this
        }
        ;
        PIXI.Graphics.prototype.clear = function () {
            this.lineWidth = 0;
            this.filling = false;
            this.dirty = true;
            this.clearDirty = true;
            this.graphicsData = [];
            return this
        }
        ;
        PIXI.Graphics.prototype.generateTexture = function (resolution, scaleMode) {
            resolution = resolution || 1;
            var bounds = this.getBounds();
            var canvasBuffer = new PIXI.CanvasBuffer(bounds.width * resolution, bounds.height * resolution);
            var texture = PIXI.Texture.fromCanvas(canvasBuffer.canvas, scaleMode);
            texture.baseTexture.resolution = resolution;
            canvasBuffer.context.scale(resolution, resolution);
            canvasBuffer.context.translate(-bounds.x, -bounds.y);
            PIXI.CanvasGraphics.renderGraphics(this, canvasBuffer.context);
            return texture
        }
        ;
        PIXI.Graphics.prototype._renderWebGL = function (renderSession) {
            if (this.visible === false || this.alpha === 0 || this.isMask === true)
                return;
            if (this._cacheAsBitmap) {
                if (this.dirty || this.cachedSpriteDirty) {
                    this._generateCachedSprite();
                    this.updateCachedSpriteTexture();
                    this.cachedSpriteDirty = false;
                    this.dirty = false
                }
                this._cachedSprite.worldAlpha = this.worldAlpha;
                PIXI.Sprite.prototype._renderWebGL.call(this._cachedSprite, renderSession);
                return
            } else {
                renderSession.spriteBatch.stop();
                renderSession.blendModeManager.setBlendMode(this.blendMode);
                if (this._mask)
                    renderSession.maskManager.pushMask(this._mask, renderSession);
                if (this._filters)
                    renderSession.filterManager.pushFilter(this._filterBlock);
                if (this.blendMode !== renderSession.spriteBatch.currentBlendMode) {
                    renderSession.spriteBatch.currentBlendMode = this.blendMode;
                    var blendModeWebGL = PIXI.blendModesWebGL[renderSession.spriteBatch.currentBlendMode];
                    renderSession.spriteBatch.gl.blendFunc(blendModeWebGL[0], blendModeWebGL[1])
                }
                if (this.webGLDirty) {
                    this.dirty = true;
                    this.webGLDirty = false
                }
                PIXI.WebGLGraphics.renderGraphics(this, renderSession);
                if (this.children.length) {
                    renderSession.spriteBatch.start();
                    for (var i = 0, j = this.children.length; i < j; i++) {
                        this.children[i]._renderWebGL(renderSession)
                    }
                    renderSession.spriteBatch.stop()
                }
                if (this._filters)
                    renderSession.filterManager.popFilter();
                if (this._mask)
                    renderSession.maskManager.popMask(this.mask, renderSession);
                renderSession.drawCount++;
                renderSession.spriteBatch.start()
            }
        }
        ;
        PIXI.Graphics.prototype._renderCanvas = function (renderSession) {
            if (this.visible === false || this.alpha === 0 || this.isMask === true)
                return;
            if (this._cacheAsBitmap) {
                if (this.dirty || this.cachedSpriteDirty) {
                    this._generateCachedSprite();
                    this.updateCachedSpriteTexture();
                    this.cachedSpriteDirty = false;
                    this.dirty = false
                }
                this._cachedSprite.alpha = this.alpha;
                PIXI.Sprite.prototype._renderCanvas.call(this._cachedSprite, renderSession);
                return
            } else {
                var context = renderSession.context;
                var transform = this.worldTransform;
                if (this.blendMode !== renderSession.currentBlendMode) {
                    renderSession.currentBlendMode = this.blendMode;
                    context.globalCompositeOperation = PIXI.blendModesCanvas[renderSession.currentBlendMode]
                }
                if (this._mask) {
                    renderSession.maskManager.pushMask(this._mask, renderSession)
                }
                var resolution = renderSession.resolution;
                context.setTransform(transform.a * resolution, transform.b * resolution, transform.c * resolution, transform.d * resolution, transform.tx * resolution, transform.ty * resolution);
                PIXI.CanvasGraphics.renderGraphics(this, context);
                for (var i = 0, j = this.children.length; i < j; i++) {
                    this.children[i]._renderCanvas(renderSession)
                }
                if (this._mask) {
                    renderSession.maskManager.popMask(renderSession)
                }
            }
        }
        ;
        PIXI.Graphics.prototype.getBounds = function (matrix) {
            if (this.isMask)
                return PIXI.EmptyRectangle;
            if (this.dirty) {
                this.updateLocalBounds();
                this.webGLDirty = true;
                this.cachedSpriteDirty = true;
                this.dirty = false
            }
            var bounds = this._localBounds;
            var w0 = bounds.x;
            var w1 = bounds.width + bounds.x;
            var h0 = bounds.y;
            var h1 = bounds.height + bounds.y;
            var worldTransform = matrix || this.worldTransform;
            var a = worldTransform.a;
            var b = worldTransform.b;
            var c = worldTransform.c;
            var d = worldTransform.d;
            var tx = worldTransform.tx;
            var ty = worldTransform.ty;
            var x1 = a * w1 + c * h1 + tx;
            var y1 = d * h1 + b * w1 + ty;
            var x2 = a * w0 + c * h1 + tx;
            var y2 = d * h1 + b * w0 + ty;
            var x3 = a * w0 + c * h0 + tx;
            var y3 = d * h0 + b * w0 + ty;
            var x4 = a * w1 + c * h0 + tx;
            var y4 = d * h0 + b * w1 + ty;
            var maxX = x1;
            var maxY = y1;
            var minX = x1;
            var minY = y1;
            minX = x2 < minX ? x2 : minX;
            minX = x3 < minX ? x3 : minX;
            minX = x4 < minX ? x4 : minX;
            minY = y2 < minY ? y2 : minY;
            minY = y3 < minY ? y3 : minY;
            minY = y4 < minY ? y4 : minY;
            maxX = x2 > maxX ? x2 : maxX;
            maxX = x3 > maxX ? x3 : maxX;
            maxX = x4 > maxX ? x4 : maxX;
            maxY = y2 > maxY ? y2 : maxY;
            maxY = y3 > maxY ? y3 : maxY;
            maxY = y4 > maxY ? y4 : maxY;
            this._bounds.x = minX;
            this._bounds.width = maxX - minX;
            this._bounds.y = minY;
            this._bounds.height = maxY - minY;
            return this._bounds
        }
        ;
        PIXI.Graphics.prototype.updateLocalBounds = function () {
            var minX = Infinity;
            var maxX = -Infinity;
            var minY = Infinity;
            var maxY = -Infinity;
            if (this.graphicsData.length) {
                var shape, points, x, y, w, h;
                for (var i = 0; i < this.graphicsData.length; i++) {
                    var data = this.graphicsData[i];
                    var type = data.type;
                    var lineWidth = data.lineWidth;
                    shape = data.shape;
                    if (type === PIXI.Graphics.RECT || type === PIXI.Graphics.RREC) {
                        x = shape.x - lineWidth / 2;
                        y = shape.y - lineWidth / 2;
                        w = shape.width + lineWidth;
                        h = shape.height + lineWidth;
                        minX = x < minX ? x : minX;
                        maxX = x + w > maxX ? x + w : maxX;
                        minY = y < minY ? y : minY;
                        maxY = y + h > maxY ? y + h : maxY
                    } else if (type === PIXI.Graphics.CIRC) {
                        x = shape.x;
                        y = shape.y;
                        w = shape.radius + lineWidth / 2;
                        h = shape.radius + lineWidth / 2;
                        minX = x - w < minX ? x - w : minX;
                        maxX = x + w > maxX ? x + w : maxX;
                        minY = y - h < minY ? y - h : minY;
                        maxY = y + h > maxY ? y + h : maxY
                    } else if (type === PIXI.Graphics.ELIP) {
                        x = shape.x;
                        y = shape.y;
                        w = shape.width + lineWidth / 2;
                        h = shape.height + lineWidth / 2;
                        minX = x - w < minX ? x - w : minX;
                        maxX = x + w > maxX ? x + w : maxX;
                        minY = y - h < minY ? y - h : minY;
                        maxY = y + h > maxY ? y + h : maxY
                    } else {
                        points = shape.points;
                        for (var j = 0; j < points.length; j += 2) {
                            x = points[j];
                            y = points[j + 1];
                            minX = x - lineWidth < minX ? x - lineWidth : minX;
                            maxX = x + lineWidth > maxX ? x + lineWidth : maxX;
                            minY = y - lineWidth < minY ? y - lineWidth : minY;
                            maxY = y + lineWidth > maxY ? y + lineWidth : maxY
                        }
                    }
                }
            } else {
                minX = 0;
                maxX = 0;
                minY = 0;
                maxY = 0
            }
            var padding = this.boundsPadding;
            this._localBounds.x = minX - padding;
            this._localBounds.width = maxX - minX + padding * 2;
            this._localBounds.y = minY - padding;
            this._localBounds.height = maxY - minY + padding * 2
        }
        ;
        PIXI.Graphics.prototype._generateCachedSprite = function () {
            var bounds = this.getLocalBounds();
            if (!this._cachedSprite) {
                var canvasBuffer = new PIXI.CanvasBuffer(bounds.width, bounds.height);
                var texture = PIXI.Texture.fromCanvas(canvasBuffer.canvas);
                this._cachedSprite = new PIXI.Sprite(texture);
                this._cachedSprite.buffer = canvasBuffer;
                this._cachedSprite.worldTransform = this.worldTransform
            } else {
                this._cachedSprite.buffer.resize(bounds.width, bounds.height)
            }
            this._cachedSprite.anchor.x = -(bounds.x / bounds.width);
            this._cachedSprite.anchor.y = -(bounds.y / bounds.height);
            this._cachedSprite.buffer.context.translate(-bounds.x, -bounds.y);
            this.worldAlpha = 1;
            PIXI.CanvasGraphics.renderGraphics(this, this._cachedSprite.buffer.context);
            this._cachedSprite.alpha = this.alpha
        }
        ;
        PIXI.Graphics.prototype.updateCachedSpriteTexture = function () {
            var cachedSprite = this._cachedSprite;
            var texture = cachedSprite.texture;
            var canvas = cachedSprite.buffer.canvas;
            texture.baseTexture.width = canvas.width;
            texture.baseTexture.height = canvas.height;
            texture.crop.width = texture.frame.width = canvas.width;
            texture.crop.height = texture.frame.height = canvas.height;
            cachedSprite._width = canvas.width;
            cachedSprite._height = canvas.height;
            texture.baseTexture.dirty()
        }
        ;
        PIXI.Graphics.prototype.destroyCachedSprite = function () {
            this._cachedSprite.texture.destroy(true);
            this._cachedSprite = null
        }
        ;
        PIXI.Graphics.prototype.drawShape = function (shape) {
            if (this.currentPath) {
                if (this.currentPath.shape.points.length <= 2)
                    this.graphicsData.pop()
            }
            this.currentPath = null;
            var data = new PIXI.GraphicsData(this.lineWidth, this.lineColor, this.lineAlpha, this.fillColor, this.fillAlpha, this.filling, shape);
            this.graphicsData.push(data);
            if (data.type === PIXI.Graphics.POLY) {
                data.shape.closed = this.filling;
                this.currentPath = data
            }
            this.dirty = true;
            return data
        }
        ;
        PIXI.GraphicsData = function (lineWidth, lineColor, lineAlpha, fillColor, fillAlpha, fill, shape) {
            this.lineWidth = lineWidth;
            this.lineColor = lineColor;
            this.lineAlpha = lineAlpha;
            this._lineTint = lineColor;
            this.fillColor = fillColor;
            this.fillAlpha = fillAlpha;
            this._fillTint = fillColor;
            this.fill = fill;
            this.shape = shape;
            this.type = shape.type
        }
        ;
        PIXI.Graphics.POLY = 0;
        PIXI.Graphics.RECT = 1;
        PIXI.Graphics.CIRC = 2;
        PIXI.Graphics.ELIP = 3;
        PIXI.Graphics.RREC = 4;
        PIXI.Polygon.prototype.type = PIXI.Graphics.POLY;
        PIXI.Rectangle.prototype.type = PIXI.Graphics.RECT;
        PIXI.Circle.prototype.type = PIXI.Graphics.CIRC;
        PIXI.Ellipse.prototype.type = PIXI.Graphics.ELIP;
        PIXI.RoundedRectangle.prototype.type = PIXI.Graphics.RREC;
        PIXI.Strip = function (texture) {
            PIXI.DisplayObjectContainer.call(this);
            this.texture = texture;
            this.uvs = new PIXI.Float32Array([0, 1, 1, 1, 1, 0, 0, 1]);
            this.vertices = new PIXI.Float32Array([0, 0, 100, 0, 100, 100, 0, 100]);
            this.colors = new PIXI.Float32Array([1, 1, 1, 1]);
            this.indices = new PIXI.Uint16Array([0, 1, 2, 3]);
            this.dirty = true;
            this.blendMode = PIXI.blendModes.NORMAL;
            this.canvasPadding = 0;
            this.drawMode = PIXI.Strip.DrawModes.TRIANGLE_STRIP
        }
        ;
        PIXI.Strip.prototype = Object.create(PIXI.DisplayObjectContainer.prototype);
        PIXI.Strip.prototype.constructor = PIXI.Strip;
        PIXI.Strip.prototype._renderWebGL = function (renderSession) {
            if (!this.visible || this.alpha <= 0)
                return;
            renderSession.spriteBatch.stop();
            if (!this._vertexBuffer)
                this._initWebGL(renderSession);
            renderSession.shaderManager.setShader(renderSession.shaderManager.stripShader);
            this._renderStrip(renderSession);
            renderSession.spriteBatch.start()
        }
        ;
        PIXI.Strip.prototype._initWebGL = function (renderSession) {
            var gl = renderSession.gl;
            this._vertexBuffer = gl.createBuffer();
            this._indexBuffer = gl.createBuffer();
            this._uvBuffer = gl.createBuffer();
            this._colorBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, this._vertexBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, this.vertices, gl.DYNAMIC_DRAW);
            gl.bindBuffer(gl.ARRAY_BUFFER, this._uvBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, this.uvs, gl.STATIC_DRAW);
            gl.bindBuffer(gl.ARRAY_BUFFER, this._colorBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, this.colors, gl.STATIC_DRAW);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._indexBuffer);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indices, gl.STATIC_DRAW)
        }
        ;
        PIXI.Strip.prototype._renderStrip = function (renderSession) {
            var gl = renderSession.gl;
            var projection = renderSession.projection
                , offset = renderSession.offset
                , shader = renderSession.shaderManager.stripShader;
            var drawMode = this.drawMode === PIXI.Strip.DrawModes.TRIANGLE_STRIP ? gl.TRIANGLE_STRIP : gl.TRIANGLES;
            renderSession.blendModeManager.setBlendMode(this.blendMode);
            gl.uniformMatrix3fv(shader.translationMatrix, false, this.worldTransform.toArray(true));
            gl.uniform2f(shader.projectionVector, projection.x, -projection.y);
            gl.uniform2f(shader.offsetVector, -offset.x, -offset.y);
            gl.uniform1f(shader.alpha, this.worldAlpha);
            if (!this.dirty) {
                gl.bindBuffer(gl.ARRAY_BUFFER, this._vertexBuffer);
                gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.vertices);
                gl.vertexAttribPointer(shader.aVertexPosition, 2, gl.FLOAT, false, 0, 0);
                gl.bindBuffer(gl.ARRAY_BUFFER, this._uvBuffer);
                gl.vertexAttribPointer(shader.aTextureCoord, 2, gl.FLOAT, false, 0, 0);
                gl.activeTexture(gl.TEXTURE0);
                if (this.texture.baseTexture._dirty[gl.id]) {
                    renderSession.renderer.updateTexture(this.texture.baseTexture)
                } else {
                    gl.bindTexture(gl.TEXTURE_2D, this.texture.baseTexture._glTextures[gl.id])
                }
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._indexBuffer)
            } else {
                this.dirty = false;
                gl.bindBuffer(gl.ARRAY_BUFFER, this._vertexBuffer);
                gl.bufferData(gl.ARRAY_BUFFER, this.vertices, gl.STATIC_DRAW);
                gl.vertexAttribPointer(shader.aVertexPosition, 2, gl.FLOAT, false, 0, 0);
                gl.bindBuffer(gl.ARRAY_BUFFER, this._uvBuffer);
                gl.bufferData(gl.ARRAY_BUFFER, this.uvs, gl.STATIC_DRAW);
                gl.vertexAttribPointer(shader.aTextureCoord, 2, gl.FLOAT, false, 0, 0);
                gl.activeTexture(gl.TEXTURE0);
                if (this.texture.baseTexture._dirty[gl.id]) {
                    renderSession.renderer.updateTexture(this.texture.baseTexture)
                } else {
                    gl.bindTexture(gl.TEXTURE_2D, this.texture.baseTexture._glTextures[gl.id])
                }
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._indexBuffer);
                gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indices, gl.STATIC_DRAW)
            }
            gl.drawElements(drawMode, this.indices.length, gl.UNSIGNED_SHORT, 0)
        }
        ;
        PIXI.Strip.prototype._renderCanvas = function (renderSession) {
            var context = renderSession.context;
            var transform = this.worldTransform;
            if (renderSession.roundPixels) {
                context.setTransform(transform.a, transform.b, transform.c, transform.d, transform.tx | 0, transform.ty | 0)
            } else {
                context.setTransform(transform.a, transform.b, transform.c, transform.d, transform.tx, transform.ty)
            }
            if (this.drawMode === PIXI.Strip.DrawModes.TRIANGLE_STRIP) {
                this._renderCanvasTriangleStrip(context)
            } else {
                this._renderCanvasTriangles(context)
            }
        }
        ;
        PIXI.Strip.prototype._renderCanvasTriangleStrip = function (context) {
            var vertices = this.vertices;
            var uvs = this.uvs;
            var length = vertices.length / 2;
            this.count++;
            for (var i = 0; i < length - 2; i++) {
                var index = i * 2;
                this._renderCanvasDrawTriangle(context, vertices, uvs, index, index + 2, index + 4)
            }
        }
        ;
        PIXI.Strip.prototype._renderCanvasTriangles = function (context) {
            var vertices = this.vertices;
            var uvs = this.uvs;
            var indices = this.indices;
            var length = indices.length;
            this.count++;
            for (var i = 0; i < length; i += 3) {
                var index0 = indices[i] * 2
                    , index1 = indices[i + 1] * 2
                    , index2 = indices[i + 2] * 2;
                this._renderCanvasDrawTriangle(context, vertices, uvs, index0, index1, index2)
            }
        }
        ;
        PIXI.Strip.prototype._renderCanvasDrawTriangle = function (context, vertices, uvs, index0, index1, index2) {
            var textureSource = this.texture.baseTexture.source;
            var textureWidth = this.texture.width;
            var textureHeight = this.texture.height;
            var x0 = vertices[index0]
                , x1 = vertices[index1]
                , x2 = vertices[index2];
            var y0 = vertices[index0 + 1]
                , y1 = vertices[index1 + 1]
                , y2 = vertices[index2 + 1];
            var u0 = uvs[index0] * textureWidth
                , u1 = uvs[index1] * textureWidth
                , u2 = uvs[index2] * textureWidth;
            var v0 = uvs[index0 + 1] * textureHeight
                , v1 = uvs[index1 + 1] * textureHeight
                , v2 = uvs[index2 + 1] * textureHeight;
            if (this.canvasPadding > 0) {
                var paddingX = this.canvasPadding / this.worldTransform.a;
                var paddingY = this.canvasPadding / this.worldTransform.d;
                var centerX = (x0 + x1 + x2) / 3;
                var centerY = (y0 + y1 + y2) / 3;
                var normX = x0 - centerX;
                var normY = y0 - centerY;
                var dist = Math.sqrt(normX * normX + normY * normY);
                x0 = centerX + normX / dist * (dist + paddingX);
                y0 = centerY + normY / dist * (dist + paddingY);
                normX = x1 - centerX;
                normY = y1 - centerY;
                dist = Math.sqrt(normX * normX + normY * normY);
                x1 = centerX + normX / dist * (dist + paddingX);
                y1 = centerY + normY / dist * (dist + paddingY);
                normX = x2 - centerX;
                normY = y2 - centerY;
                dist = Math.sqrt(normX * normX + normY * normY);
                x2 = centerX + normX / dist * (dist + paddingX);
                y2 = centerY + normY / dist * (dist + paddingY)
            }
            context.save();
            context.beginPath();
            context.moveTo(x0, y0);
            context.lineTo(x1, y1);
            context.lineTo(x2, y2);
            context.closePath();
            context.clip();
            var delta = u0 * v1 + v0 * u2 + u1 * v2 - v1 * u2 - v0 * u1 - u0 * v2;
            var deltaA = x0 * v1 + v0 * x2 + x1 * v2 - v1 * x2 - v0 * x1 - x0 * v2;
            var deltaB = u0 * x1 + x0 * u2 + u1 * x2 - x1 * u2 - x0 * u1 - u0 * x2;
            var deltaC = u0 * v1 * x2 + v0 * x1 * u2 + x0 * u1 * v2 - x0 * v1 * u2 - v0 * u1 * x2 - u0 * x1 * v2;
            var deltaD = y0 * v1 + v0 * y2 + y1 * v2 - v1 * y2 - v0 * y1 - y0 * v2;
            var deltaE = u0 * y1 + y0 * u2 + u1 * y2 - y1 * u2 - y0 * u1 - u0 * y2;
            var deltaF = u0 * v1 * y2 + v0 * y1 * u2 + y0 * u1 * v2 - y0 * v1 * u2 - v0 * u1 * y2 - u0 * y1 * v2;
            context.transform(deltaA / delta, deltaD / delta, deltaB / delta, deltaE / delta, deltaC / delta, deltaF / delta);
            context.drawImage(textureSource, 0, 0);
            context.restore()
        }
        ;
        PIXI.Strip.prototype.renderStripFlat = function (strip) {
            var context = this.context;
            var vertices = strip.vertices;
            var length = vertices.length / 2;
            this.count++;
            context.beginPath();
            for (var i = 1; i < length - 2; i++) {
                var index = i * 2;
                var x0 = vertices[index]
                    , x1 = vertices[index + 2]
                    , x2 = vertices[index + 4];
                var y0 = vertices[index + 1]
                    , y1 = vertices[index + 3]
                    , y2 = vertices[index + 5];
                context.moveTo(x0, y0);
                context.lineTo(x1, y1);
                context.lineTo(x2, y2)
            }
            context.fillStyle = "#FF0000";
            context.fill();
            context.closePath()
        }
        ;
        PIXI.Strip.prototype.onTextureUpdate = function () {
            this.updateFrame = true
        }
        ;
        PIXI.Strip.prototype.getBounds = function (matrix) {
            var worldTransform = matrix || this.worldTransform;
            var a = worldTransform.a;
            var b = worldTransform.b;
            var c = worldTransform.c;
            var d = worldTransform.d;
            var tx = worldTransform.tx;
            var ty = worldTransform.ty;
            var maxX = -Infinity;
            var maxY = -Infinity;
            var minX = Infinity;
            var minY = Infinity;
            var vertices = this.vertices;
            for (var i = 0, n = vertices.length; i < n; i += 2) {
                var rawX = vertices[i]
                    , rawY = vertices[i + 1];
                var x = a * rawX + c * rawY + tx;
                var y = d * rawY + b * rawX + ty;
                minX = x < minX ? x : minX;
                minY = y < minY ? y : minY;
                maxX = x > maxX ? x : maxX;
                maxY = y > maxY ? y : maxY
            }
            if (minX === -Infinity || maxY === Infinity) {
                return PIXI.EmptyRectangle
            }
            var bounds = this._bounds;
            bounds.x = minX;
            bounds.width = maxX - minX;
            bounds.y = minY;
            bounds.height = maxY - minY;
            this._currentBounds = bounds;
            return bounds
        }
        ;
        PIXI.Strip.DrawModes = {
            TRIANGLE_STRIP: 0,
            TRIANGLES: 1
        };
        PIXI.Rope = function (texture, points) {
            PIXI.Strip.call(this, texture);
            this.points = points;
            this.vertices = new PIXI.Float32Array(points.length * 4);
            this.uvs = new PIXI.Float32Array(points.length * 4);
            this.colors = new PIXI.Float32Array(points.length * 2);
            this.indices = new PIXI.Uint16Array(points.length * 2);
            this.refresh()
        }
        ;
        PIXI.Rope.prototype = Object.create(PIXI.Strip.prototype);
        PIXI.Rope.prototype.constructor = PIXI.Rope;
        PIXI.Rope.prototype.refresh = function () {
            var points = this.points;
            if (points.length < 1)
                return;
            var uvs = this.uvs;
            var lastPoint = points[0];
            var indices = this.indices;
            var colors = this.colors;
            this.count -= .2;
            uvs[0] = 0;
            uvs[1] = 0;
            uvs[2] = 0;
            uvs[3] = 1;
            colors[0] = 1;
            colors[1] = 1;
            indices[0] = 0;
            indices[1] = 1;
            var total = points.length, point, index, amount;
            for (var i = 1; i < total; i++) {
                point = points[i];
                index = i * 4;
                amount = i / (total - 1);
                if (i % 2) {
                    uvs[index] = amount;
                    uvs[index + 1] = 0;
                    uvs[index + 2] = amount;
                    uvs[index + 3] = 1
                } else {
                    uvs[index] = amount;
                    uvs[index + 1] = 0;
                    uvs[index + 2] = amount;
                    uvs[index + 3] = 1
                }
                index = i * 2;
                colors[index] = 1;
                colors[index + 1] = 1;
                index = i * 2;
                indices[index] = index;
                indices[index + 1] = index + 1;
                lastPoint = point
            }
        }
        ;
        PIXI.Rope.prototype.updateTransform = function () {
            var points = this.points;
            if (points.length < 1)
                return;
            var lastPoint = points[0];
            var nextPoint;
            var perp = {
                x: 0,
                y: 0
            };
            this.count -= .2;
            var vertices = this.vertices;
            var total = points.length, point, index, ratio, perpLength, num;
            for (var i = 0; i < total; i++) {
                point = points[i];
                index = i * 4;
                if (i < points.length - 1) {
                    nextPoint = points[i + 1]
                } else {
                    nextPoint = point
                }
                perp.y = -(nextPoint.x - lastPoint.x);
                perp.x = nextPoint.y - lastPoint.y;
                ratio = (1 - i / (total - 1)) * 10;
                if (ratio > 1)
                    ratio = 1;
                perpLength = Math.sqrt(perp.x * perp.x + perp.y * perp.y);
                num = this.texture.height / 2;
                perp.x /= perpLength;
                perp.y /= perpLength;
                perp.x *= num;
                perp.y *= num;
                vertices[index] = point.x + perp.x;
                vertices[index + 1] = point.y + perp.y;
                vertices[index + 2] = point.x - perp.x;
                vertices[index + 3] = point.y - perp.y;
                lastPoint = point
            }
            PIXI.DisplayObjectContainer.prototype.updateTransform.call(this)
        }
        ;
        PIXI.Rope.prototype.setTexture = function (texture) {
            this.texture = texture
        }
        ;
        PIXI.TilingSprite = function (texture, width, height) {
            PIXI.Sprite.call(this, texture);
            this._width = width || 100;
            this._height = height || 100;
            this.tileScale = new PIXI.Point(1, 1);
            this.tileScaleOffset = new PIXI.Point(1, 1);
            this.tilePosition = new PIXI.Point(0, 0);
            this.renderable = true;
            this.tint = 16777215;
            this.blendMode = PIXI.blendModes.NORMAL
        }
        ;
        PIXI.TilingSprite.prototype = Object.create(PIXI.Sprite.prototype);
        PIXI.TilingSprite.prototype.constructor = PIXI.TilingSprite;
        Object.defineProperty(PIXI.TilingSprite.prototype, "width", {
            get: function () {
                return this._width
            },
            set: function (value) {
                this._width = value
            }
        });
        Object.defineProperty(PIXI.TilingSprite.prototype, "height", {
            get: function () {
                return this._height
            },
            set: function (value) {
                this._height = value
            }
        });
        PIXI.TilingSprite.prototype.setTexture = function (texture) {
            if (this.texture === texture)
                return;
            this.texture = texture;
            this.refreshTexture = true;
            this.cachedTint = 16777215
        }
        ;
        PIXI.TilingSprite.prototype._renderWebGL = function (renderSession) {
            if (this.visible === false || this.alpha === 0)
                return;
            var i, j;
            if (this._mask) {
                renderSession.spriteBatch.stop();
                renderSession.maskManager.pushMask(this.mask, renderSession);
                renderSession.spriteBatch.start()
            }
            if (this._filters) {
                renderSession.spriteBatch.flush();
                renderSession.filterManager.pushFilter(this._filterBlock)
            }
            if (!this.tilingTexture || this.refreshTexture) {
                this.generateTilingTexture(true);
                if (this.tilingTexture && this.tilingTexture.needsUpdate) {
                    PIXI.updateWebGLTexture(this.tilingTexture.baseTexture, renderSession.gl);
                    this.tilingTexture.needsUpdate = false
                }
            } else {
                renderSession.spriteBatch.renderTilingSprite(this)
            }
            for (i = 0,
                     j = this.children.length; i < j; i++) {
                this.children[i]._renderWebGL(renderSession)
            }
            renderSession.spriteBatch.stop();
            if (this._filters)
                renderSession.filterManager.popFilter();
            if (this._mask)
                renderSession.maskManager.popMask(this._mask, renderSession);
            renderSession.spriteBatch.start()
        }
        ;
        PIXI.TilingSprite.prototype._renderCanvas = function (renderSession) {
            if (this.visible === false || this.alpha === 0)
                return;
            var context = renderSession.context;
            if (this._mask) {
                renderSession.maskManager.pushMask(this._mask, context)
            }
            context.globalAlpha = this.worldAlpha;
            var transform = this.worldTransform;
            var i, j;
            var resolution = renderSession.resolution;
            context.setTransform(transform.a * resolution, transform.b * resolution, transform.c * resolution, transform.d * resolution, transform.tx * resolution, transform.ty * resolution);
            if (!this.__tilePattern || this.refreshTexture) {
                this.generateTilingTexture(false);
                if (this.tilingTexture) {
                    this.__tilePattern = context.createPattern(this.tilingTexture.baseTexture.source, "repeat")
                } else {
                    return
                }
            }
            if (this.blendMode !== renderSession.currentBlendMode) {
                renderSession.currentBlendMode = this.blendMode;
                context.globalCompositeOperation = PIXI.blendModesCanvas[renderSession.currentBlendMode]
            }
            var tilePosition = this.tilePosition;
            var tileScale = this.tileScale;
            tilePosition.x %= this.tilingTexture.baseTexture.width;
            tilePosition.y %= this.tilingTexture.baseTexture.height;
            context.scale(tileScale.x, tileScale.y);
            context.translate(tilePosition.x + this.anchor.x * -this._width, tilePosition.y + this.anchor.y * -this._height);
            context.fillStyle = this.__tilePattern;
            context.fillRect(-tilePosition.x, -tilePosition.y, this._width / tileScale.x, this._height / tileScale.y);
            context.scale(1 / tileScale.x, 1 / tileScale.y);
            context.translate(-tilePosition.x + this.anchor.x * this._width, -tilePosition.y + this.anchor.y * this._height);
            if (this._mask) {
                renderSession.maskManager.popMask(renderSession.context)
            }
            for (i = 0,
                     j = this.children.length; i < j; i++) {
                this.children[i]._renderCanvas(renderSession)
            }
        }
        ;
        PIXI.TilingSprite.prototype.getBounds = function () {
            var width = this._width;
            var height = this._height;
            var w0 = width * (1 - this.anchor.x);
            var w1 = width * -this.anchor.x;
            var h0 = height * (1 - this.anchor.y);
            var h1 = height * -this.anchor.y;
            var worldTransform = this.worldTransform;
            var a = worldTransform.a;
            var b = worldTransform.b;
            var c = worldTransform.c;
            var d = worldTransform.d;
            var tx = worldTransform.tx;
            var ty = worldTransform.ty;
            var x1 = a * w1 + c * h1 + tx;
            var y1 = d * h1 + b * w1 + ty;
            var x2 = a * w0 + c * h1 + tx;
            var y2 = d * h1 + b * w0 + ty;
            var x3 = a * w0 + c * h0 + tx;
            var y3 = d * h0 + b * w0 + ty;
            var x4 = a * w1 + c * h0 + tx;
            var y4 = d * h0 + b * w1 + ty;
            var maxX = -Infinity;
            var maxY = -Infinity;
            var minX = Infinity;
            var minY = Infinity;
            minX = x1 < minX ? x1 : minX;
            minX = x2 < minX ? x2 : minX;
            minX = x3 < minX ? x3 : minX;
            minX = x4 < minX ? x4 : minX;
            minY = y1 < minY ? y1 : minY;
            minY = y2 < minY ? y2 : minY;
            minY = y3 < minY ? y3 : minY;
            minY = y4 < minY ? y4 : minY;
            maxX = x1 > maxX ? x1 : maxX;
            maxX = x2 > maxX ? x2 : maxX;
            maxX = x3 > maxX ? x3 : maxX;
            maxX = x4 > maxX ? x4 : maxX;
            maxY = y1 > maxY ? y1 : maxY;
            maxY = y2 > maxY ? y2 : maxY;
            maxY = y3 > maxY ? y3 : maxY;
            maxY = y4 > maxY ? y4 : maxY;
            var bounds = this._bounds;
            bounds.x = minX;
            bounds.width = maxX - minX;
            bounds.y = minY;
            bounds.height = maxY - minY;
            this._currentBounds = bounds;
            return bounds
        }
        ;
        PIXI.TilingSprite.prototype.onTextureUpdate = function () {
        }
        ;
        PIXI.TilingSprite.prototype.generateTilingTexture = function (forcePowerOfTwo) {
            if (!this.texture.baseTexture.hasLoaded)
                return;
            var texture = this.originalTexture || this.texture;
            var frame = texture.frame;
            var targetWidth, targetHeight;
            var isFrame = frame.width !== texture.baseTexture.width || frame.height !== texture.baseTexture.height;
            var newTextureRequired = false;
            if (!forcePowerOfTwo) {
                if (isFrame) {
                    targetWidth = frame.width;
                    targetHeight = frame.height;
                    newTextureRequired = true
                }
            } else {
                targetWidth = PIXI.getNextPowerOfTwo(frame.width);
                targetHeight = PIXI.getNextPowerOfTwo(frame.height);
                if (frame.width !== targetWidth || frame.height !== targetHeight || texture.baseTexture.width !== targetWidth || texture.baseTexture.height || targetHeight)
                    newTextureRequired = true
            }
            if (newTextureRequired) {
                var canvasBuffer;
                if (this.tilingTexture && this.tilingTexture.isTiling) {
                    canvasBuffer = this.tilingTexture.canvasBuffer;
                    canvasBuffer.resize(targetWidth, targetHeight);
                    this.tilingTexture.baseTexture.width = targetWidth;
                    this.tilingTexture.baseTexture.height = targetHeight;
                    this.tilingTexture.needsUpdate = true
                } else {
                    canvasBuffer = new PIXI.CanvasBuffer(targetWidth, targetHeight);
                    this.tilingTexture = PIXI.Texture.fromCanvas(canvasBuffer.canvas);
                    this.tilingTexture.canvasBuffer = canvasBuffer;
                    this.tilingTexture.isTiling = true
                }
                canvasBuffer.context.drawImage(texture.baseTexture.source, texture.crop.x, texture.crop.y, texture.crop.width, texture.crop.height, 0, 0, targetWidth, targetHeight);
                this.tileScaleOffset.x = frame.width / targetWidth;
                this.tileScaleOffset.y = frame.height / targetHeight
            } else {
                if (this.tilingTexture && this.tilingTexture.isTiling) {
                    this.tilingTexture.destroy(true)
                }
                this.tileScaleOffset.x = 1;
                this.tileScaleOffset.y = 1;
                this.tilingTexture = texture
            }
            this.refreshTexture = false;
            this.originalTexture = this.texture;
            this.texture = this.tilingTexture;
            this.tilingTexture.baseTexture._powerOf2 = true
        }
        ;
        var spine = {
            radDeg: 180 / Math.PI,
            degRad: Math.PI / 180,
            temp: [],
            Float32Array: typeof Float32Array === "undefined" ? Array : Float32Array,
            Uint16Array: typeof Uint16Array === "undefined" ? Array : Uint16Array
        };
        spine.BoneData = function (name, parent) {
            this.name = name;
            this.parent = parent
        }
        ;
        spine.BoneData.prototype = {
            length: 0,
            x: 0,
            y: 0,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            inheritScale: true,
            inheritRotation: true,
            flipX: false,
            flipY: false
        };
        spine.SlotData = function (name, boneData) {
            this.name = name;
            this.boneData = boneData
        }
        ;
        spine.SlotData.prototype = {
            r: 1,
            g: 1,
            b: 1,
            a: 1,
            attachmentName: null,
            additiveBlending: false
        };
        spine.IkConstraintData = function (name) {
            this.name = name;
            this.bones = []
        }
        ;
        spine.IkConstraintData.prototype = {
            target: null,
            bendDirection: 1,
            mix: 1
        };
        spine.Bone = function (boneData, skeleton, parent) {
            this.data = boneData;
            this.skeleton = skeleton;
            this.parent = parent;
            this.setToSetupPose()
        }
        ;
        spine.Bone.yDown = false;
        spine.Bone.prototype = {
            x: 0,
            y: 0,
            rotation: 0,
            rotationIK: 0,
            scaleX: 1,
            scaleY: 1,
            flipX: false,
            flipY: false,
            m00: 0,
            m01: 0,
            worldX: 0,
            m10: 0,
            m11: 0,
            worldY: 0,
            worldRotation: 0,
            worldScaleX: 1,
            worldScaleY: 1,
            worldFlipX: false,
            worldFlipY: false,
            updateWorldTransform: function () {
                var parent = this.parent;
                if (parent) {
                    this.worldX = this.x * parent.m00 + this.y * parent.m01 + parent.worldX;
                    this.worldY = this.x * parent.m10 + this.y * parent.m11 + parent.worldY;
                    if (this.data.inheritScale) {
                        this.worldScaleX = parent.worldScaleX * this.scaleX;
                        this.worldScaleY = parent.worldScaleY * this.scaleY
                    } else {
                        this.worldScaleX = this.scaleX;
                        this.worldScaleY = this.scaleY
                    }
                    this.worldRotation = this.data.inheritRotation ? parent.worldRotation + this.rotationIK : this.rotationIK;
                    this.worldFlipX = parent.worldFlipX != this.flipX;
                    this.worldFlipY = parent.worldFlipY != this.flipY
                } else {
                    var skeletonFlipX = this.skeleton.flipX
                        , skeletonFlipY = this.skeleton.flipY;
                    this.worldX = skeletonFlipX ? -this.x : this.x;
                    this.worldY = skeletonFlipY != spine.Bone.yDown ? -this.y : this.y;
                    this.worldScaleX = this.scaleX;
                    this.worldScaleY = this.scaleY;
                    this.worldRotation = this.rotationIK;
                    this.worldFlipX = skeletonFlipX != this.flipX;
                    this.worldFlipY = skeletonFlipY != this.flipY
                }
                var radians = this.worldRotation * spine.degRad;
                var cos = Math.cos(radians);
                var sin = Math.sin(radians);
                if (this.worldFlipX) {
                    this.m00 = -cos * this.worldScaleX;
                    this.m01 = sin * this.worldScaleY
                } else {
                    this.m00 = cos * this.worldScaleX;
                    this.m01 = -sin * this.worldScaleY
                }
                if (this.worldFlipY != spine.Bone.yDown) {
                    this.m10 = -sin * this.worldScaleX;
                    this.m11 = -cos * this.worldScaleY
                } else {
                    this.m10 = sin * this.worldScaleX;
                    this.m11 = cos * this.worldScaleY
                }
            },
            setToSetupPose: function () {
                var data = this.data;
                this.x = data.x;
                this.y = data.y;
                this.rotation = data.rotation;
                this.rotationIK = this.rotation;
                this.scaleX = data.scaleX;
                this.scaleY = data.scaleY;
                this.flipX = data.flipX;
                this.flipY = data.flipY
            },
            worldToLocal: function (world) {
                var dx = world[0] - this.worldX
                    , dy = world[1] - this.worldY;
                var m00 = this.m00
                    , m10 = this.m10
                    , m01 = this.m01
                    , m11 = this.m11;
                if (this.worldFlipX != (this.worldFlipY != spine.Bone.yDown)) {
                    m00 = -m00;
                    m11 = -m11
                }
                var invDet = 1 / (m00 * m11 - m01 * m10);
                world[0] = dx * m00 * invDet - dy * m01 * invDet;
                world[1] = dy * m11 * invDet - dx * m10 * invDet
            },
            localToWorld: function (local) {
                var localX = local[0]
                    , localY = local[1];
                local[0] = localX * this.m00 + localY * this.m01 + this.worldX;
                local[1] = localX * this.m10 + localY * this.m11 + this.worldY
            }
        };
        spine.Slot = function (slotData, bone) {
            this.data = slotData;
            this.bone = bone;
            this.setToSetupPose()
        }
        ;
        spine.Slot.prototype = {
            r: 1,
            g: 1,
            b: 1,
            a: 1,
            _attachmentTime: 0,
            attachment: null,
            attachmentVertices: [],
            setAttachment: function (attachment) {
                this.attachment = attachment;
                this._attachmentTime = this.bone.skeleton.time;
                this.attachmentVertices.length = 0
            },
            setAttachmentTime: function (time) {
                this._attachmentTime = this.bone.skeleton.time - time
            },
            getAttachmentTime: function () {
                return this.bone.skeleton.time - this._attachmentTime
            },
            setToSetupPose: function () {
                var data = this.data;
                this.r = data.r;
                this.g = data.g;
                this.b = data.b;
                this.a = data.a;
                var slotDatas = this.bone.skeleton.data.slots;
                for (var i = 0, n = slotDatas.length; i < n; i++) {
                    if (slotDatas[i] == data) {
                        this.setAttachment(!data.attachmentName ? null : this.bone.skeleton.getAttachmentBySlotIndex(i, data.attachmentName));
                        break
                    }
                }
            }
        };
        spine.IkConstraint = function (data, skeleton) {
            this.data = data;
            this.mix = data.mix;
            this.bendDirection = data.bendDirection;
            this.bones = [];
            for (var i = 0, n = data.bones.length; i < n; i++)
                this.bones.push(skeleton.findBone(data.bones[i].name));
            this.target = skeleton.findBone(data.target.name)
        }
        ;
        spine.IkConstraint.prototype = {
            apply: function () {
                var target = this.target;
                var bones = this.bones;
                switch (bones.length) {
                    case 1:
                        spine.IkConstraint.apply1(bones[0], target.worldX, target.worldY, this.mix);
                        break;
                    case 2:
                        spine.IkConstraint.apply2(bones[0], bones[1], target.worldX, target.worldY, this.bendDirection, this.mix);
                        break
                }
            }
        };
        spine.IkConstraint.apply1 = function (bone, targetX, targetY, alpha) {
            var parentRotation = !bone.data.inheritRotation || !bone.parent ? 0 : bone.parent.worldRotation;
            var rotation = bone.rotation;
            var rotationIK = Math.atan2(targetY - bone.worldY, targetX - bone.worldX) * spine.radDeg - parentRotation;
            bone.rotationIK = rotation + (rotationIK - rotation) * alpha
        }
        ;
        spine.IkConstraint.apply2 = function (parent, child, targetX, targetY, bendDirection, alpha) {
            var childRotation = child.rotation
                , parentRotation = parent.rotation;
            if (!alpha) {
                child.rotationIK = childRotation;
                parent.rotationIK = parentRotation;
                return
            }
            var positionX, positionY, tempPosition = spine.temp;
            var parentParent = parent.parent;
            if (parentParent) {
                tempPosition[0] = targetX;
                tempPosition[1] = targetY;
                parentParent.worldToLocal(tempPosition);
                targetX = (tempPosition[0] - parent.x) * parentParent.worldScaleX;
                targetY = (tempPosition[1] - parent.y) * parentParent.worldScaleY
            } else {
                targetX -= parent.x;
                targetY -= parent.y
            }
            if (child.parent == parent) {
                positionX = child.x;
                positionY = child.y
            } else {
                tempPosition[0] = child.x;
                tempPosition[1] = child.y;
                child.parent.localToWorld(tempPosition);
                parent.worldToLocal(tempPosition);
                positionX = tempPosition[0];
                positionY = tempPosition[1]
            }
            var childX = positionX * parent.worldScaleX
                , childY = positionY * parent.worldScaleY;
            var offset = Math.atan2(childY, childX);
            var len1 = Math.sqrt(childX * childX + childY * childY)
                , len2 = child.data.length * child.worldScaleX;
            var cosDenom = 2 * len1 * len2;
            if (cosDenom < 1e-4) {
                child.rotationIK = childRotation + (Math.atan2(targetY, targetX) * spine.radDeg - parentRotation - childRotation) * alpha;
                return
            }
            var cos = (targetX * targetX + targetY * targetY - len1 * len1 - len2 * len2) / cosDenom;
            if (cos < -1)
                cos = -1;
            else if (cos > 1)
                cos = 1;
            var childAngle = Math.acos(cos) * bendDirection;
            var adjacent = len1 + len2 * cos
                , opposite = len2 * Math.sin(childAngle);
            var parentAngle = Math.atan2(targetY * adjacent - targetX * opposite, targetX * adjacent + targetY * opposite);
            var rotation = (parentAngle - offset) * spine.radDeg - parentRotation;
            if (rotation > 180)
                rotation -= 360;
            else if (rotation < -180)
                rotation += 360;
            parent.rotationIK = parentRotation + rotation * alpha;
            rotation = (childAngle + offset) * spine.radDeg - childRotation;
            if (rotation > 180)
                rotation -= 360;
            else if (rotation < -180)
                rotation += 360;
            child.rotationIK = childRotation + (rotation + parent.worldRotation - child.parent.worldRotation) * alpha
        }
        ;
        spine.Skin = function (name) {
            this.name = name;
            this.attachments = {}
        }
        ;
        spine.Skin.prototype = {
            addAttachment: function (slotIndex, name, attachment) {
                this.attachments[slotIndex + ":" + name] = attachment
            },
            getAttachment: function (slotIndex, name) {
                return this.attachments[slotIndex + ":" + name]
            },
            _attachAll: function (skeleton, oldSkin) {
                for (var key in oldSkin.attachments) {
                    var colon = key.indexOf(":");
                    var slotIndex = parseInt(key.substring(0, colon));
                    var name = key.substring(colon + 1);
                    var slot = skeleton.slots[slotIndex];
                    if (slot.attachment && slot.attachment.name == name) {
                        var attachment = this.getAttachment(slotIndex, name);
                        if (attachment)
                            slot.setAttachment(attachment)
                    }
                }
            }
        };
        spine.Animation = function (name, timelines, duration) {
            this.name = name;
            this.timelines = timelines;
            this.duration = duration
        }
        ;
        spine.Animation.prototype = {
            apply: function (skeleton, lastTime, time, loop, events) {
                if (loop && this.duration != 0) {
                    time %= this.duration;
                    lastTime %= this.duration
                }
                var timelines = this.timelines;
                for (var i = 0, n = timelines.length; i < n; i++)
                    timelines[i].apply(skeleton, lastTime, time, events, 1)
            },
            mix: function (skeleton, lastTime, time, loop, events, alpha) {
                if (loop && this.duration != 0) {
                    time %= this.duration;
                    lastTime %= this.duration
                }
                var timelines = this.timelines;
                for (var i = 0, n = timelines.length; i < n; i++)
                    timelines[i].apply(skeleton, lastTime, time, events, alpha)
            }
        };
        spine.Animation.binarySearch = function (values, target, step) {
            var low = 0;
            var high = Math.floor(values.length / step) - 2;
            if (!high)
                return step;
            var current = high >>> 1;
            while (true) {
                if (values[(current + 1) * step] <= target)
                    low = current + 1;
                else
                    high = current;
                if (low == high)
                    return (low + 1) * step;
                current = low + high >>> 1
            }
        }
        ;
        spine.Animation.binarySearch1 = function (values, target) {
            var low = 0;
            var high = values.length - 2;
            if (!high)
                return 1;
            var current = high >>> 1;
            while (true) {
                if (values[current + 1] <= target)
                    low = current + 1;
                else
                    high = current;
                if (low == high)
                    return low + 1;
                current = low + high >>> 1
            }
        }
        ;
        spine.Animation.linearSearch = function (values, target, step) {
            for (var i = 0, last = values.length - step; i <= last; i += step)
                if (values[i] > target)
                    return i;
            return -1
        }
        ;
        spine.Curves = function (frameCount) {
            this.curves = []
        }
        ;
        spine.Curves.prototype = {
            setLinear: function (frameIndex) {
                this.curves[frameIndex * 19] = 0
            },
            setStepped: function (frameIndex) {
                this.curves[frameIndex * 19] = 1
            },
            setCurve: function (frameIndex, cx1, cy1, cx2, cy2) {
                var subdiv1 = 1 / 10
                    , subdiv2 = subdiv1 * subdiv1
                    , subdiv3 = subdiv2 * subdiv1;
                var pre1 = 3 * subdiv1
                    , pre2 = 3 * subdiv2
                    , pre4 = 6 * subdiv2
                    , pre5 = 6 * subdiv3;
                var tmp1x = -cx1 * 2 + cx2
                    , tmp1y = -cy1 * 2 + cy2
                    , tmp2x = (cx1 - cx2) * 3 + 1
                    , tmp2y = (cy1 - cy2) * 3 + 1;
                var dfx = cx1 * pre1 + tmp1x * pre2 + tmp2x * subdiv3
                    , dfy = cy1 * pre1 + tmp1y * pre2 + tmp2y * subdiv3;
                var ddfx = tmp1x * pre4 + tmp2x * pre5
                    , ddfy = tmp1y * pre4 + tmp2y * pre5;
                var dddfx = tmp2x * pre5
                    , dddfy = tmp2y * pre5;
                var i = frameIndex * 19;
                var curves = this.curves;
                curves[i++] = 2;
                var x = dfx
                    , y = dfy;
                for (var n = i + 19 - 1; i < n; i += 2) {
                    curves[i] = x;
                    curves[i + 1] = y;
                    dfx += ddfx;
                    dfy += ddfy;
                    ddfx += dddfx;
                    ddfy += dddfy;
                    x += dfx;
                    y += dfy
                }
            },
            getCurvePercent: function (frameIndex, percent) {
                percent = percent < 0 ? 0 : percent > 1 ? 1 : percent;
                var curves = this.curves;
                var i = frameIndex * 19;
                var type = curves[i];
                if (type === 0)
                    return percent;
                if (type == 1)
                    return 0;
                i++;
                var x = 0;
                for (var start = i, n = i + 19 - 1; i < n; i += 2) {
                    x = curves[i];
                    if (x >= percent) {
                        var prevX, prevY;
                        if (i == start) {
                            prevX = 0;
                            prevY = 0
                        } else {
                            prevX = curves[i - 2];
                            prevY = curves[i - 1]
                        }
                        return prevY + (curves[i + 1] - prevY) * (percent - prevX) / (x - prevX)
                    }
                }
                var y = curves[i - 1];
                return y + (1 - y) * (percent - x) / (1 - x)
            }
        };
        spine.RotateTimeline = function (frameCount) {
            this.curves = new spine.Curves(frameCount);
            this.frames = [];
            this.frames.length = frameCount * 2
        }
        ;
        spine.RotateTimeline.prototype = {
            boneIndex: 0,
            getFrameCount: function () {
                return this.frames.length / 2
            },
            setFrame: function (frameIndex, time, angle) {
                frameIndex *= 2;
                this.frames[frameIndex] = time;
                this.frames[frameIndex + 1] = angle
            },
            apply: function (skeleton, lastTime, time, firedEvents, alpha) {
                var frames = this.frames;
                if (time < frames[0])
                    return;
                var bone = skeleton.bones[this.boneIndex];
                if (time >= frames[frames.length - 2]) {
                    var amount = bone.data.rotation + frames[frames.length - 1] - bone.rotation;
                    while (amount > 180)
                        amount -= 360;
                    while (amount < -180)
                        amount += 360;
                    bone.rotation += amount * alpha;
                    return
                }
                var frameIndex = spine.Animation.binarySearch(frames, time, 2);
                var prevFrameValue = frames[frameIndex - 1];
                var frameTime = frames[frameIndex];
                var percent = 1 - (time - frameTime) / (frames[frameIndex - 2] - frameTime);
                percent = this.curves.getCurvePercent(frameIndex / 2 - 1, percent);
                var amount = frames[frameIndex + 1] - prevFrameValue;
                while (amount > 180)
                    amount -= 360;
                while (amount < -180)
                    amount += 360;
                amount = bone.data.rotation + (prevFrameValue + amount * percent) - bone.rotation;
                while (amount > 180)
                    amount -= 360;
                while (amount < -180)
                    amount += 360;
                bone.rotation += amount * alpha
            }
        };
        spine.TranslateTimeline = function (frameCount) {
            this.curves = new spine.Curves(frameCount);
            this.frames = [];
            this.frames.length = frameCount * 3
        }
        ;
        spine.TranslateTimeline.prototype = {
            boneIndex: 0,
            getFrameCount: function () {
                return this.frames.length / 3
            },
            setFrame: function (frameIndex, time, x, y) {
                frameIndex *= 3;
                this.frames[frameIndex] = time;
                this.frames[frameIndex + 1] = x;
                this.frames[frameIndex + 2] = y
            },
            apply: function (skeleton, lastTime, time, firedEvents, alpha) {
                var frames = this.frames;
                if (time < frames[0])
                    return;
                var bone = skeleton.bones[this.boneIndex];
                if (time >= frames[frames.length - 3]) {
                    bone.x += (bone.data.x + frames[frames.length - 2] - bone.x) * alpha;
                    bone.y += (bone.data.y + frames[frames.length - 1] - bone.y) * alpha;
                    return
                }
                var frameIndex = spine.Animation.binarySearch(frames, time, 3);
                var prevFrameX = frames[frameIndex - 2];
                var prevFrameY = frames[frameIndex - 1];
                var frameTime = frames[frameIndex];
                var percent = 1 - (time - frameTime) / (frames[frameIndex + -3] - frameTime);
                percent = this.curves.getCurvePercent(frameIndex / 3 - 1, percent);
                bone.x += (bone.data.x + prevFrameX + (frames[frameIndex + 1] - prevFrameX) * percent - bone.x) * alpha;
                bone.y += (bone.data.y + prevFrameY + (frames[frameIndex + 2] - prevFrameY) * percent - bone.y) * alpha
            }
        };
        spine.ScaleTimeline = function (frameCount) {
            this.curves = new spine.Curves(frameCount);
            this.frames = [];
            this.frames.length = frameCount * 3
        }
        ;
        spine.ScaleTimeline.prototype = {
            boneIndex: 0,
            getFrameCount: function () {
                return this.frames.length / 3
            },
            setFrame: function (frameIndex, time, x, y) {
                frameIndex *= 3;
                this.frames[frameIndex] = time;
                this.frames[frameIndex + 1] = x;
                this.frames[frameIndex + 2] = y
            },
            apply: function (skeleton, lastTime, time, firedEvents, alpha) {
                var frames = this.frames;
                if (time < frames[0])
                    return;
                var bone = skeleton.bones[this.boneIndex];
                if (time >= frames[frames.length - 3]) {
                    bone.scaleX += (bone.data.scaleX * frames[frames.length - 2] - bone.scaleX) * alpha;
                    bone.scaleY += (bone.data.scaleY * frames[frames.length - 1] - bone.scaleY) * alpha;
                    return
                }
                var frameIndex = spine.Animation.binarySearch(frames, time, 3);
                var prevFrameX = frames[frameIndex - 2];
                var prevFrameY = frames[frameIndex - 1];
                var frameTime = frames[frameIndex];
                var percent = 1 - (time - frameTime) / (frames[frameIndex + -3] - frameTime);
                percent = this.curves.getCurvePercent(frameIndex / 3 - 1, percent);
                bone.scaleX += (bone.data.scaleX * (prevFrameX + (frames[frameIndex + 1] - prevFrameX) * percent) - bone.scaleX) * alpha;
                bone.scaleY += (bone.data.scaleY * (prevFrameY + (frames[frameIndex + 2] - prevFrameY) * percent) - bone.scaleY) * alpha
            }
        };
        spine.ColorTimeline = function (frameCount) {
            this.curves = new spine.Curves(frameCount);
            this.frames = [];
            this.frames.length = frameCount * 5
        }
        ;
        spine.ColorTimeline.prototype = {
            slotIndex: 0,
            getFrameCount: function () {
                return this.frames.length / 5
            },
            setFrame: function (frameIndex, time, r, g, b, a) {
                frameIndex *= 5;
                this.frames[frameIndex] = time;
                this.frames[frameIndex + 1] = r;
                this.frames[frameIndex + 2] = g;
                this.frames[frameIndex + 3] = b;
                this.frames[frameIndex + 4] = a
            },
            apply: function (skeleton, lastTime, time, firedEvents, alpha) {
                var frames = this.frames;
                if (time < frames[0])
                    return;
                var r, g, b, a;
                if (time >= frames[frames.length - 5]) {
                    var i = frames.length - 1;
                    r = frames[i - 3];
                    g = frames[i - 2];
                    b = frames[i - 1];
                    a = frames[i]
                } else {
                    var frameIndex = spine.Animation.binarySearch(frames, time, 5);
                    var prevFrameR = frames[frameIndex - 4];
                    var prevFrameG = frames[frameIndex - 3];
                    var prevFrameB = frames[frameIndex - 2];
                    var prevFrameA = frames[frameIndex - 1];
                    var frameTime = frames[frameIndex];
                    var percent = 1 - (time - frameTime) / (frames[frameIndex - 5] - frameTime);
                    percent = this.curves.getCurvePercent(frameIndex / 5 - 1, percent);
                    r = prevFrameR + (frames[frameIndex + 1] - prevFrameR) * percent;
                    g = prevFrameG + (frames[frameIndex + 2] - prevFrameG) * percent;
                    b = prevFrameB + (frames[frameIndex + 3] - prevFrameB) * percent;
                    a = prevFrameA + (frames[frameIndex + 4] - prevFrameA) * percent
                }
                var slot = skeleton.slots[this.slotIndex];
                if (alpha < 1) {
                    slot.r += (r - slot.r) * alpha;
                    slot.g += (g - slot.g) * alpha;
                    slot.b += (b - slot.b) * alpha;
                    slot.a += (a - slot.a) * alpha
                } else {
                    slot.r = r;
                    slot.g = g;
                    slot.b = b;
                    slot.a = a
                }
            }
        };
        spine.AttachmentTimeline = function (frameCount) {
            this.curves = new spine.Curves(frameCount);
            this.frames = [];
            this.frames.length = frameCount;
            this.attachmentNames = [];
            this.attachmentNames.length = frameCount
        }
        ;
        spine.AttachmentTimeline.prototype = {
            slotIndex: 0,
            getFrameCount: function () {
                return this.frames.length
            },
            setFrame: function (frameIndex, time, attachmentName) {
                this.frames[frameIndex] = time;
                this.attachmentNames[frameIndex] = attachmentName
            },
            apply: function (skeleton, lastTime, time, firedEvents, alpha) {
                var frames = this.frames;
                if (time < frames[0]) {
                    if (lastTime > time)
                        this.apply(skeleton, lastTime, Number.MAX_VALUE, null, 0);
                    return
                } else if (lastTime > time)
                    lastTime = -1;
                var frameIndex = time >= frames[frames.length - 1] ? frames.length - 1 : spine.Animation.binarySearch1(frames, time) - 1;
                if (frames[frameIndex] < lastTime)
                    return;
                var attachmentName = this.attachmentNames[frameIndex];
                skeleton.slots[this.slotIndex].setAttachment(!attachmentName ? null : skeleton.getAttachmentBySlotIndex(this.slotIndex, attachmentName))
            }
        };
        spine.EventTimeline = function (frameCount) {
            this.frames = [];
            this.frames.length = frameCount;
            this.events = [];
            this.events.length = frameCount
        }
        ;
        spine.EventTimeline.prototype = {
            getFrameCount: function () {
                return this.frames.length
            },
            setFrame: function (frameIndex, time, event) {
                this.frames[frameIndex] = time;
                this.events[frameIndex] = event
            },
            apply: function (skeleton, lastTime, time, firedEvents, alpha) {
                if (!firedEvents)
                    return;
                var frames = this.frames;
                var frameCount = frames.length;
                if (lastTime > time) {
                    this.apply(skeleton, lastTime, Number.MAX_VALUE, firedEvents, alpha);
                    lastTime = -1
                } else if (lastTime >= frames[frameCount - 1])
                    return;
                if (time < frames[0])
                    return;
                var frameIndex;
                if (lastTime < frames[0])
                    frameIndex = 0;
                else {
                    frameIndex = spine.Animation.binarySearch1(frames, lastTime);
                    var frame = frames[frameIndex];
                    while (frameIndex > 0) {
                        if (frames[frameIndex - 1] != frame)
                            break;
                        frameIndex--
                    }
                }
                var events = this.events;
                for (; frameIndex < frameCount && time >= frames[frameIndex]; frameIndex++)
                    firedEvents.push(events[frameIndex])
            }
        };
        spine.DrawOrderTimeline = function (frameCount) {
            this.frames = [];
            this.frames.length = frameCount;
            this.drawOrders = [];
            this.drawOrders.length = frameCount
        }
        ;
        spine.DrawOrderTimeline.prototype = {
            getFrameCount: function () {
                return this.frames.length
            },
            setFrame: function (frameIndex, time, drawOrder) {
                this.frames[frameIndex] = time;
                this.drawOrders[frameIndex] = drawOrder
            },
            apply: function (skeleton, lastTime, time, firedEvents, alpha) {
                var frames = this.frames;
                if (time < frames[0])
                    return;
                var frameIndex;
                if (time >= frames[frames.length - 1])
                    frameIndex = frames.length - 1;
                else
                    frameIndex = spine.Animation.binarySearch1(frames, time) - 1;
                var drawOrder = skeleton.drawOrder;
                var slots = skeleton.slots;
                var drawOrderToSetupIndex = this.drawOrders[frameIndex];
                if (!drawOrderToSetupIndex) {
                    for (var i = 0, n = slots.length; i < n; i++)
                        drawOrder[i] = slots[i]
                } else {
                    for (var i = 0, n = drawOrderToSetupIndex.length; i < n; i++)
                        drawOrder[i] = skeleton.slots[drawOrderToSetupIndex[i]]
                }
            }
        };
        spine.FfdTimeline = function (frameCount) {
            this.curves = new spine.Curves(frameCount);
            this.frames = [];
            this.frames.length = frameCount;
            this.frameVertices = [];
            this.frameVertices.length = frameCount
        }
        ;
        spine.FfdTimeline.prototype = {
            slotIndex: 0,
            attachment: 0,
            getFrameCount: function () {
                return this.frames.length
            },
            setFrame: function (frameIndex, time, vertices) {
                this.frames[frameIndex] = time;
                this.frameVertices[frameIndex] = vertices
            },
            apply: function (skeleton, lastTime, time, firedEvents, alpha) {
                var slot = skeleton.slots[this.slotIndex];
                if (slot.attachment != this.attachment)
                    return;
                var frames = this.frames;
                if (time < frames[0])
                    return;
                var frameVertices = this.frameVertices;
                var vertexCount = frameVertices[0].length;
                var vertices = slot.attachmentVertices;
                if (vertices.length != vertexCount)
                    alpha = 1;
                vertices.length = vertexCount;
                if (time >= frames[frames.length - 1]) {
                    var lastVertices = frameVertices[frames.length - 1];
                    if (alpha < 1) {
                        for (var i = 0; i < vertexCount; i++)
                            vertices[i] += (lastVertices[i] - vertices[i]) * alpha
                    } else {
                        for (var i = 0; i < vertexCount; i++)
                            vertices[i] = lastVertices[i]
                    }
                    return
                }
                var frameIndex = spine.Animation.binarySearch1(frames, time);
                var frameTime = frames[frameIndex];
                var percent = 1 - (time - frameTime) / (frames[frameIndex - 1] - frameTime);
                percent = this.curves.getCurvePercent(frameIndex - 1, percent < 0 ? 0 : percent > 1 ? 1 : percent);
                var prevVertices = frameVertices[frameIndex - 1];
                var nextVertices = frameVertices[frameIndex];
                if (alpha < 1) {
                    for (var i = 0; i < vertexCount; i++) {
                        var prev = prevVertices[i];
                        vertices[i] += (prev + (nextVertices[i] - prev) * percent - vertices[i]) * alpha
                    }
                } else {
                    for (var i = 0; i < vertexCount; i++) {
                        var prev = prevVertices[i];
                        vertices[i] = prev + (nextVertices[i] - prev) * percent
                    }
                }
            }
        };
        spine.IkConstraintTimeline = function (frameCount) {
            this.curves = new spine.Curves(frameCount);
            this.frames = [];
            this.frames.length = frameCount * 3
        }
        ;
        spine.IkConstraintTimeline.prototype = {
            ikConstraintIndex: 0,
            getFrameCount: function () {
                return this.frames.length / 3
            },
            setFrame: function (frameIndex, time, mix, bendDirection) {
                frameIndex *= 3;
                this.frames[frameIndex] = time;
                this.frames[frameIndex + 1] = mix;
                this.frames[frameIndex + 2] = bendDirection
            },
            apply: function (skeleton, lastTime, time, firedEvents, alpha) {
                var frames = this.frames;
                if (time < frames[0])
                    return;
                var ikConstraint = skeleton.ikConstraints[this.ikConstraintIndex];
                if (time >= frames[frames.length - 3]) {
                    ikConstraint.mix += (frames[frames.length - 2] - ikConstraint.mix) * alpha;
                    ikConstraint.bendDirection = frames[frames.length - 1];
                    return
                }
                var frameIndex = spine.Animation.binarySearch(frames, time, 3);
                var prevFrameMix = frames[frameIndex + -2];
                var frameTime = frames[frameIndex];
                var percent = 1 - (time - frameTime) / (frames[frameIndex + -3] - frameTime);
                percent = this.curves.getCurvePercent(frameIndex / 3 - 1, percent);
                var mix = prevFrameMix + (frames[frameIndex + 1] - prevFrameMix) * percent;
                ikConstraint.mix += (mix - ikConstraint.mix) * alpha;
                ikConstraint.bendDirection = frames[frameIndex + -1]
            }
        };
        spine.FlipXTimeline = function (frameCount) {
            this.curves = new spine.Curves(frameCount);
            this.frames = [];
            this.frames.length = frameCount * 2
        }
        ;
        spine.FlipXTimeline.prototype = {
            boneIndex: 0,
            getFrameCount: function () {
                return this.frames.length / 2
            },
            setFrame: function (frameIndex, time, flip) {
                frameIndex *= 2;
                this.frames[frameIndex] = time;
                this.frames[frameIndex + 1] = flip ? 1 : 0
            },
            apply: function (skeleton, lastTime, time, firedEvents, alpha) {
                var frames = this.frames;
                if (time < frames[0]) {
                    if (lastTime > time)
                        this.apply(skeleton, lastTime, Number.MAX_VALUE, null, 0);
                    return
                } else if (lastTime > time)
                    lastTime = -1;
                var frameIndex = (time >= frames[frames.length - 2] ? frames.length : spine.Animation.binarySearch(frames, time, 2)) - 2;
                if (frames[frameIndex] < lastTime)
                    return;
                skeleton.bones[boneIndex].flipX = frames[frameIndex + 1] != 0
            }
        };
        spine.FlipYTimeline = function (frameCount) {
            this.curves = new spine.Curves(frameCount);
            this.frames = [];
            this.frames.length = frameCount * 2
        }
        ;
        spine.FlipYTimeline.prototype = {
            boneIndex: 0,
            getFrameCount: function () {
                return this.frames.length / 2
            },
            setFrame: function (frameIndex, time, flip) {
                frameIndex *= 2;
                this.frames[frameIndex] = time;
                this.frames[frameIndex + 1] = flip ? 1 : 0
            },
            apply: function (skeleton, lastTime, time, firedEvents, alpha) {
                var frames = this.frames;
                if (time < frames[0]) {
                    if (lastTime > time)
                        this.apply(skeleton, lastTime, Number.MAX_VALUE, null, 0);
                    return
                } else if (lastTime > time)
                    lastTime = -1;
                var frameIndex = (time >= frames[frames.length - 2] ? frames.length : spine.Animation.binarySearch(frames, time, 2)) - 2;
                if (frames[frameIndex] < lastTime)
                    return;
                skeleton.bones[boneIndex].flipY = frames[frameIndex + 1] != 0
            }
        };
        spine.SkeletonData = function () {
            this.bones = [];
            this.slots = [];
            this.skins = [];
            this.events = [];
            this.animations = [];
            this.ikConstraints = []
        }
        ;
        spine.SkeletonData.prototype = {
            name: null,
            defaultSkin: null,
            width: 0,
            height: 0,
            version: null,
            hash: null,
            findBone: function (boneName) {
                var bones = this.bones;
                for (var i = 0, n = bones.length; i < n; i++)
                    if (bones[i].name == boneName)
                        return bones[i];
                return null
            },
            findBoneIndex: function (boneName) {
                var bones = this.bones;
                for (var i = 0, n = bones.length; i < n; i++)
                    if (bones[i].name == boneName)
                        return i;
                return -1
            },
            findSlot: function (slotName) {
                var slots = this.slots;
                for (var i = 0, n = slots.length; i < n; i++) {
                    if (slots[i].name == slotName)
                        return slot[i]
                }
                return null
            },
            findSlotIndex: function (slotName) {
                var slots = this.slots;
                for (var i = 0, n = slots.length; i < n; i++)
                    if (slots[i].name == slotName)
                        return i;
                return -1
            },
            findSkin: function (skinName) {
                var skins = this.skins;
                for (var i = 0, n = skins.length; i < n; i++)
                    if (skins[i].name == skinName)
                        return skins[i];
                return null
            },
            findEvent: function (eventName) {
                var events = this.events;
                for (var i = 0, n = events.length; i < n; i++)
                    if (events[i].name == eventName)
                        return events[i];
                return null
            },
            findAnimation: function (animationName) {
                var animations = this.animations;
                for (var i = 0, n = animations.length; i < n; i++)
                    if (animations[i].name == animationName)
                        return animations[i];
                return null
            },
            findIkConstraint: function (ikConstraintName) {
                var ikConstraints = this.ikConstraints;
                for (var i = 0, n = ikConstraints.length; i < n; i++)
                    if (ikConstraints[i].name == ikConstraintName)
                        return ikConstraints[i];
                return null
            }
        };
        spine.Skeleton = function (skeletonData) {
            this.data = skeletonData;
            this.bones = [];
            for (var i = 0, n = skeletonData.bones.length; i < n; i++) {
                var boneData = skeletonData.bones[i];
                var parent = !boneData.parent ? null : this.bones[skeletonData.bones.indexOf(boneData.parent)];
                this.bones.push(new spine.Bone(boneData, this, parent))
            }
            this.slots = [];
            this.drawOrder = [];
            for (var i = 0, n = skeletonData.slots.length; i < n; i++) {
                var slotData = skeletonData.slots[i];
                var bone = this.bones[skeletonData.bones.indexOf(slotData.boneData)];
                var slot = new spine.Slot(slotData, bone);
                this.slots.push(slot);
                this.drawOrder.push(slot)
            }
            this.ikConstraints = [];
            for (var i = 0, n = skeletonData.ikConstraints.length; i < n; i++)
                this.ikConstraints.push(new spine.IkConstraint(skeletonData.ikConstraints[i], this));
            this.boneCache = [];
            this.updateCache()
        }
        ;
        spine.Skeleton.prototype = {
            x: 0,
            y: 0,
            skin: null,
            r: 1,
            g: 1,
            b: 1,
            a: 1,
            time: 0,
            flipX: false,
            flipY: false,
            updateCache: function () {
                var ikConstraints = this.ikConstraints;
                var ikConstraintsCount = ikConstraints.length;
                var arrayCount = ikConstraintsCount + 1;
                var boneCache = this.boneCache;
                if (boneCache.length > arrayCount)
                    boneCache.length = arrayCount;
                for (var i = 0, n = boneCache.length; i < n; i++)
                    boneCache[i].length = 0;
                while (boneCache.length < arrayCount)
                    boneCache[boneCache.length] = [];
                var nonIkBones = boneCache[0];
                var bones = this.bones;
                outer: for (var i = 0, n = bones.length; i < n; i++) {
                    var bone = bones[i];
                    var current = bone;
                    do {
                        for (var ii = 0; ii < ikConstraintsCount; ii++) {
                            var ikConstraint = ikConstraints[ii];
                            var parent = ikConstraint.bones[0];
                            var child = ikConstraint.bones[ikConstraint.bones.length - 1];
                            while (true) {
                                if (current == child) {
                                    boneCache[ii].push(bone);
                                    boneCache[ii + 1].push(bone);
                                    continue outer
                                }
                                if (child == parent)
                                    break;
                                child = child.parent
                            }
                        }
                        current = current.parent
                    } while (current);
                    nonIkBones[nonIkBones.length] = bone
                }
            },
            updateWorldTransform: function () {
                var bones = this.bones;
                for (var i = 0, n = bones.length; i < n; i++) {
                    var bone = bones[i];
                    bone.rotationIK = bone.rotation
                }
                var i = 0
                    , last = this.boneCache.length - 1;
                while (true) {
                    var cacheBones = this.boneCache[i];
                    for (var ii = 0, nn = cacheBones.length; ii < nn; ii++)
                        cacheBones[ii].updateWorldTransform();
                    if (i == last)
                        break;
                    this.ikConstraints[i].apply();
                    i++
                }
            },
            setToSetupPose: function () {
                this.setBonesToSetupPose();
                this.setSlotsToSetupPose()
            },
            setBonesToSetupPose: function () {
                var bones = this.bones;
                for (var i = 0, n = bones.length; i < n; i++)
                    bones[i].setToSetupPose();
                var ikConstraints = this.ikConstraints;
                for (var i = 0, n = ikConstraints.length; i < n; i++) {
                    var ikConstraint = ikConstraints[i];
                    ikConstraint.bendDirection = ikConstraint.data.bendDirection;
                    ikConstraint.mix = ikConstraint.data.mix
                }
            },
            setSlotsToSetupPose: function () {
                var slots = this.slots;
                var drawOrder = this.drawOrder;
                for (var i = 0, n = slots.length; i < n; i++) {
                    drawOrder[i] = slots[i];
                    slots[i].setToSetupPose(i)
                }
            },
            getRootBone: function () {
                return this.bones.length ? this.bones[0] : null
            },
            findBone: function (boneName) {
                var bones = this.bones;
                for (var i = 0, n = bones.length; i < n; i++)
                    if (bones[i].data.name == boneName)
                        return bones[i];
                return null
            },
            findBoneIndex: function (boneName) {
                var bones = this.bones;
                for (var i = 0, n = bones.length; i < n; i++)
                    if (bones[i].data.name == boneName)
                        return i;
                return -1
            },
            findSlot: function (slotName) {
                var slots = this.slots;
                for (var i = 0, n = slots.length; i < n; i++)
                    if (slots[i].data.name == slotName)
                        return slots[i];
                return null
            },
            findSlotIndex: function (slotName) {
                var slots = this.slots;
                for (var i = 0, n = slots.length; i < n; i++)
                    if (slots[i].data.name == slotName)
                        return i;
                return -1
            },
            setSkinByName: function (skinName) {
                var skin = this.data.findSkin(skinName);
                if (!skin)
                    throw "Skin not found: " + skinName;
                this.setSkin(skin)
            },
            setSkin: function (newSkin) {
                if (newSkin) {
                    if (this.skin)
                        newSkin._attachAll(this, this.skin);
                    else {
                        var slots = this.slots;
                        for (var i = 0, n = slots.length; i < n; i++) {
                            var slot = slots[i];
                            var name = slot.data.attachmentName;
                            if (name) {
                                var attachment = newSkin.getAttachment(i, name);
                                if (attachment)
                                    slot.setAttachment(attachment)
                            }
                        }
                    }
                }
                this.skin = newSkin
            },
            getAttachmentBySlotName: function (slotName, attachmentName) {
                return this.getAttachmentBySlotIndex(this.data.findSlotIndex(slotName), attachmentName)
            },
            getAttachmentBySlotIndex: function (slotIndex, attachmentName) {
                if (this.skin) {
                    var attachment = this.skin.getAttachment(slotIndex, attachmentName);
                    if (attachment)
                        return attachment
                }
                if (this.data.defaultSkin)
                    return this.data.defaultSkin.getAttachment(slotIndex, attachmentName);
                return null
            },
            setAttachment: function (slotName, attachmentName) {
                var slots = this.slots;
                for (var i = 0, n = slots.length; i < n; i++) {
                    var slot = slots[i];
                    if (slot.data.name == slotName) {
                        var attachment = null;
                        if (attachmentName) {
                            attachment = this.getAttachmentBySlotIndex(i, attachmentName);
                            if (!attachment)
                                throw "Attachment not found: " + attachmentName + ", for slot: " + slotName
                        }
                        slot.setAttachment(attachment);
                        return
                    }
                }
                throw "Slot not found: " + slotName
            },
            findIkConstraint: function (ikConstraintName) {
                var ikConstraints = this.ikConstraints;
                for (var i = 0, n = ikConstraints.length; i < n; i++)
                    if (ikConstraints[i].data.name == ikConstraintName)
                        return ikConstraints[i];
                return null
            },
            update: function (delta) {
                this.time += delta
            }
        };
        spine.EventData = function (name) {
            this.name = name
        }
        ;
        spine.EventData.prototype = {
            intValue: 0,
            floatValue: 0,
            stringValue: null
        };
        spine.Event = function (data) {
            this.data = data
        }
        ;
        spine.Event.prototype = {
            intValue: 0,
            floatValue: 0,
            stringValue: null
        };
        spine.AttachmentType = {
            region: 0,
            boundingbox: 1,
            mesh: 2,
            skinnedmesh: 3
        };
        spine.RegionAttachment = function (name) {
            this.name = name;
            this.offset = [];
            this.offset.length = 8;
            this.uvs = [];
            this.uvs.length = 8
        }
        ;
        spine.RegionAttachment.prototype = {
            type: spine.AttachmentType.region,
            x: 0,
            y: 0,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            width: 0,
            height: 0,
            r: 1,
            g: 1,
            b: 1,
            a: 1,
            path: null,
            rendererObject: null,
            regionOffsetX: 0,
            regionOffsetY: 0,
            regionWidth: 0,
            regionHeight: 0,
            regionOriginalWidth: 0,
            regionOriginalHeight: 0,
            setUVs: function (u, v, u2, v2, rotate) {
                var uvs = this.uvs;
                if (rotate) {
                    uvs[2] = u;
                    uvs[3] = v2;
                    uvs[4] = u;
                    uvs[5] = v;
                    uvs[6] = u2;
                    uvs[7] = v;
                    uvs[0] = u2;
                    uvs[1] = v2
                } else {
                    uvs[0] = u;
                    uvs[1] = v2;
                    uvs[2] = u;
                    uvs[3] = v;
                    uvs[4] = u2;
                    uvs[5] = v;
                    uvs[6] = u2;
                    uvs[7] = v2
                }
            },
            updateOffset: function () {
                var regionScaleX = this.width / this.regionOriginalWidth * this.scaleX;
                var regionScaleY = this.height / this.regionOriginalHeight * this.scaleY;
                var localX = -this.width / 2 * this.scaleX + this.regionOffsetX * regionScaleX;
                var localY = -this.height / 2 * this.scaleY + this.regionOffsetY * regionScaleY;
                var localX2 = localX + this.regionWidth * regionScaleX;
                var localY2 = localY + this.regionHeight * regionScaleY;
                var radians = this.rotation * spine.degRad;
                var cos = Math.cos(radians);
                var sin = Math.sin(radians);
                var localXCos = localX * cos + this.x;
                var localXSin = localX * sin;
                var localYCos = localY * cos + this.y;
                var localYSin = localY * sin;
                var localX2Cos = localX2 * cos + this.x;
                var localX2Sin = localX2 * sin;
                var localY2Cos = localY2 * cos + this.y;
                var localY2Sin = localY2 * sin;
                var offset = this.offset;
                offset[0] = localXCos - localYSin;
                offset[1] = localYCos + localXSin;
                offset[2] = localXCos - localY2Sin;
                offset[3] = localY2Cos + localXSin;
                offset[4] = localX2Cos - localY2Sin;
                offset[5] = localY2Cos + localX2Sin;
                offset[6] = localX2Cos - localYSin;
                offset[7] = localYCos + localX2Sin
            },
            computeVertices: function (x, y, bone, vertices) {
                x += bone.worldX;
                y += bone.worldY;
                var m00 = bone.m00
                    , m01 = bone.m01
                    , m10 = bone.m10
                    , m11 = bone.m11;
                var offset = this.offset;
                vertices[0] = offset[0] * m00 + offset[1] * m01 + x;
                vertices[1] = offset[0] * m10 + offset[1] * m11 + y;
                vertices[2] = offset[2] * m00 + offset[3] * m01 + x;
                vertices[3] = offset[2] * m10 + offset[3] * m11 + y;
                vertices[4] = offset[4] * m00 + offset[5] * m01 + x;
                vertices[5] = offset[4] * m10 + offset[5] * m11 + y;
                vertices[6] = offset[6] * m00 + offset[7] * m01 + x;
                vertices[7] = offset[6] * m10 + offset[7] * m11 + y
            }
        };
        spine.MeshAttachment = function (name) {
            this.name = name
        }
        ;
        spine.MeshAttachment.prototype = {
            type: spine.AttachmentType.mesh,
            vertices: null,
            uvs: null,
            regionUVs: null,
            triangles: null,
            hullLength: 0,
            r: 1,
            g: 1,
            b: 1,
            a: 1,
            path: null,
            rendererObject: null,
            regionU: 0,
            regionV: 0,
            regionU2: 0,
            regionV2: 0,
            regionRotate: false,
            regionOffsetX: 0,
            regionOffsetY: 0,
            regionWidth: 0,
            regionHeight: 0,
            regionOriginalWidth: 0,
            regionOriginalHeight: 0,
            edges: null,
            width: 0,
            height: 0,
            updateUVs: function () {
                var width = this.regionU2 - this.regionU
                    , height = this.regionV2 - this.regionV;
                var n = this.regionUVs.length;
                if (!this.uvs || this.uvs.length != n) {
                    this.uvs = new spine.Float32Array(n)
                }
                if (this.regionRotate) {
                    for (var i = 0; i < n; i += 2) {
                        this.uvs[i] = this.regionU + this.regionUVs[i + 1] * width;
                        this.uvs[i + 1] = this.regionV + height - this.regionUVs[i] * height
                    }
                } else {
                    for (var i = 0; i < n; i += 2) {
                        this.uvs[i] = this.regionU + this.regionUVs[i] * width;
                        this.uvs[i + 1] = this.regionV + this.regionUVs[i + 1] * height
                    }
                }
            },
            computeWorldVertices: function (x, y, slot, worldVertices) {
                var bone = slot.bone;
                x += bone.worldX;
                y += bone.worldY;
                var m00 = bone.m00
                    , m01 = bone.m01
                    , m10 = bone.m10
                    , m11 = bone.m11;
                var vertices = this.vertices;
                var verticesCount = vertices.length;
                if (slot.attachmentVertices.length == verticesCount)
                    vertices = slot.attachmentVertices;
                for (var i = 0; i < verticesCount; i += 2) {
                    var vx = vertices[i];
                    var vy = vertices[i + 1];
                    worldVertices[i] = vx * m00 + vy * m01 + x;
                    worldVertices[i + 1] = vx * m10 + vy * m11 + y
                }
            }
        };
        spine.SkinnedMeshAttachment = function (name) {
            this.name = name
        }
        ;
        spine.SkinnedMeshAttachment.prototype = {
            type: spine.AttachmentType.skinnedmesh,
            bones: null,
            weights: null,
            uvs: null,
            regionUVs: null,
            triangles: null,
            hullLength: 0,
            r: 1,
            g: 1,
            b: 1,
            a: 1,
            path: null,
            rendererObject: null,
            regionU: 0,
            regionV: 0,
            regionU2: 0,
            regionV2: 0,
            regionRotate: false,
            regionOffsetX: 0,
            regionOffsetY: 0,
            regionWidth: 0,
            regionHeight: 0,
            regionOriginalWidth: 0,
            regionOriginalHeight: 0,
            edges: null,
            width: 0,
            height: 0,
            updateUVs: function (u, v, u2, v2, rotate) {
                var width = this.regionU2 - this.regionU
                    , height = this.regionV2 - this.regionV;
                var n = this.regionUVs.length;
                if (!this.uvs || this.uvs.length != n) {
                    this.uvs = new spine.Float32Array(n)
                }
                if (this.regionRotate) {
                    for (var i = 0; i < n; i += 2) {
                        this.uvs[i] = this.regionU + this.regionUVs[i + 1] * width;
                        this.uvs[i + 1] = this.regionV + height - this.regionUVs[i] * height
                    }
                } else {
                    for (var i = 0; i < n; i += 2) {
                        this.uvs[i] = this.regionU + this.regionUVs[i] * width;
                        this.uvs[i + 1] = this.regionV + this.regionUVs[i + 1] * height
                    }
                }
            },
            computeWorldVertices: function (x, y, slot, worldVertices) {
                var skeletonBones = slot.bone.skeleton.bones;
                var weights = this.weights;
                var bones = this.bones;
                var w = 0, v = 0, b = 0, f = 0, n = bones.length, nn;
                var wx, wy, bone, vx, vy, weight;
                if (!slot.attachmentVertices.length) {
                    for (; v < n; w += 2) {
                        wx = 0;
                        wy = 0;
                        nn = bones[v++] + v;
                        for (; v < nn; v++,
                            b += 3) {
                            bone = skeletonBones[bones[v]];
                            vx = weights[b];
                            vy = weights[b + 1];
                            weight = weights[b + 2];
                            wx += (vx * bone.m00 + vy * bone.m01 + bone.worldX) * weight;
                            wy += (vx * bone.m10 + vy * bone.m11 + bone.worldY) * weight
                        }
                        worldVertices[w] = wx + x;
                        worldVertices[w + 1] = wy + y
                    }
                } else {
                    var ffd = slot.attachmentVertices;
                    for (; v < n; w += 2) {
                        wx = 0;
                        wy = 0;
                        nn = bones[v++] + v;
                        for (; v < nn; v++,
                            b += 3,
                            f += 2) {
                            bone = skeletonBones[bones[v]];
                            vx = weights[b] + ffd[f];
                            vy = weights[b + 1] + ffd[f + 1];
                            weight = weights[b + 2];
                            wx += (vx * bone.m00 + vy * bone.m01 + bone.worldX) * weight;
                            wy += (vx * bone.m10 + vy * bone.m11 + bone.worldY) * weight
                        }
                        worldVertices[w] = wx + x;
                        worldVertices[w + 1] = wy + y
                    }
                }
            }
        };
        spine.BoundingBoxAttachment = function (name) {
            this.name = name;
            this.vertices = []
        }
        ;
        spine.BoundingBoxAttachment.prototype = {
            type: spine.AttachmentType.boundingbox,
            computeWorldVertices: function (x, y, bone, worldVertices) {
                x += bone.worldX;
                y += bone.worldY;
                var m00 = bone.m00
                    , m01 = bone.m01
                    , m10 = bone.m10
                    , m11 = bone.m11;
                var vertices = this.vertices;
                for (var i = 0, n = vertices.length; i < n; i += 2) {
                    var px = vertices[i];
                    var py = vertices[i + 1];
                    worldVertices[i] = px * m00 + py * m01 + x;
                    worldVertices[i + 1] = px * m10 + py * m11 + y
                }
            }
        };
        spine.AnimationStateData = function (skeletonData) {
            this.skeletonData = skeletonData;
            this.animationToMixTime = {}
        }
        ;
        spine.AnimationStateData.prototype = {
            defaultMix: 0,
            setMixByName: function (fromName, toName, duration) {
                var from = this.skeletonData.findAnimation(fromName);
                if (!from)
                    throw "Animation not found: " + fromName;
                var to = this.skeletonData.findAnimation(toName);
                if (!to)
                    throw "Animation not found: " + toName;
                this.setMix(from, to, duration)
            },
            setMix: function (from, to, duration) {
                this.animationToMixTime[from.name + ":" + to.name] = duration
            },
            getMix: function (from, to) {
                var key = from.name + ":" + to.name;
                return this.animationToMixTime.hasOwnProperty(key) ? this.animationToMixTime[key] : this.defaultMix
            }
        };
        spine.TrackEntry = function () {
        }
        ;
        spine.TrackEntry.prototype = {
            next: null,
            previous: null,
            animation: null,
            loop: false,
            delay: 0,
            time: 0,
            lastTime: -1,
            endTime: 0,
            timeScale: 1,
            mixTime: 0,
            mixDuration: 0,
            mix: 1,
            onStart: null,
            onEnd: null,
            onComplete: null,
            onEvent: null
        };
        spine.AnimationState = function (stateData) {
            this.data = stateData;
            this.tracks = [];
            this.events = []
        }
        ;
        spine.AnimationState.prototype = {
            onStart: null,
            onEnd: null,
            onComplete: null,
            onEvent: null,
            timeScale: 1,
            update: function (delta) {
                delta *= this.timeScale;
                for (var i = 0; i < this.tracks.length; i++) {
                    var current = this.tracks[i];
                    if (!current)
                        continue;
                    current.time += delta * current.timeScale;
                    if (current.previous) {
                        var previousDelta = delta * current.previous.timeScale;
                        current.previous.time += previousDelta;
                        current.mixTime += previousDelta
                    }
                    var next = current.next;
                    if (next) {
                        next.time = current.lastTime - next.delay;
                        if (next.time >= 0)
                            this.setCurrent(i, next)
                    } else {
                        if (!current.loop && current.lastTime >= current.endTime)
                            this.clearTrack(i)
                    }
                }
            },
            apply: function (skeleton) {
                for (var i = 0; i < this.tracks.length; i++) {
                    var current = this.tracks[i];
                    if (!current)
                        continue;
                    this.events.length = 0;
                    var time = current.time;
                    var lastTime = current.lastTime;
                    var endTime = current.endTime;
                    var loop = current.loop;
                    if (!loop && time > endTime)
                        time = endTime;
                    var previous = current.previous;
                    if (!previous) {
                        if (current.mix == 1)
                            current.animation.apply(skeleton, current.lastTime, time, loop, this.events);
                        else
                            current.animation.mix(skeleton, current.lastTime, time, loop, this.events, current.mix)
                    } else {
                        var previousTime = previous.time;
                        if (!previous.loop && previousTime > previous.endTime)
                            previousTime = previous.endTime;
                        previous.animation.apply(skeleton, previousTime, previousTime, previous.loop, null);
                        var alpha = current.mixTime / current.mixDuration * current.mix;
                        if (alpha >= 1) {
                            alpha = 1;
                            current.previous = null
                        }
                        current.animation.mix(skeleton, current.lastTime, time, loop, this.events, alpha)
                    }
                    for (var ii = 0, nn = this.events.length; ii < nn; ii++) {
                        var event = this.events[ii];
                        if (current.onEvent)
                            current.onEvent(i, event);
                        if (this.onEvent)
                            this.onEvent(i, event)
                    }
                    if (loop ? lastTime % endTime > time % endTime : lastTime < endTime && time >= endTime) {
                        var count = Math.floor(time / endTime);
                        if (current.onComplete)
                            current.onComplete(i, count);
                        if (this.onComplete)
                            this.onComplete(i, count)
                    }
                    current.lastTime = current.time
                }
            },
            clearTracks: function () {
                for (var i = 0, n = this.tracks.length; i < n; i++)
                    this.clearTrack(i);
                this.tracks.length = 0
            },
            clearTrack: function (trackIndex) {
                if (trackIndex >= this.tracks.length)
                    return;
                var current = this.tracks[trackIndex];
                if (!current)
                    return;
                if (current.onEnd)
                    current.onEnd(trackIndex);
                if (this.onEnd)
                    this.onEnd(trackIndex);
                this.tracks[trackIndex] = null
            },
            _expandToIndex: function (index) {
                if (index < this.tracks.length)
                    return this.tracks[index];
                while (index >= this.tracks.length)
                    this.tracks.push(null);
                return null
            },
            setCurrent: function (index, entry) {
                var current = this._expandToIndex(index);
                if (current) {
                    var previous = current.previous;
                    current.previous = null;
                    if (current.onEnd)
                        current.onEnd(index);
                    if (this.onEnd)
                        this.onEnd(index);
                    entry.mixDuration = this.data.getMix(current.animation, entry.animation);
                    if (entry.mixDuration > 0) {
                        entry.mixTime = 0;
                        if (previous && current.mixTime / current.mixDuration < .5)
                            entry.previous = previous;
                        else
                            entry.previous = current
                    }
                }
                this.tracks[index] = entry;
                if (entry.onStart)
                    entry.onStart(index);
                if (this.onStart)
                    this.onStart(index)
            },
            setAnimationByName: function (trackIndex, animationName, loop) {
                var animation = this.data.skeletonData.findAnimation(animationName);
                if (!animation)
                    throw "Animation not found: " + animationName;
                return this.setAnimation(trackIndex, animation, loop)
            },
            setAnimation: function (trackIndex, animation, loop) {
                var entry = new spine.TrackEntry;
                entry.animation = animation;
                entry.loop = loop;
                entry.endTime = animation.duration;
                this.setCurrent(trackIndex, entry);
                return entry
            },
            addAnimationByName: function (trackIndex, animationName, loop, delay) {
                var animation = this.data.skeletonData.findAnimation(animationName);
                if (!animation)
                    throw "Animation not found: " + animationName;
                return this.addAnimation(trackIndex, animation, loop, delay)
            },
            addAnimation: function (trackIndex, animation, loop, delay) {
                var entry = new spine.TrackEntry;
                entry.animation = animation;
                entry.loop = loop;
                entry.endTime = animation.duration;
                var last = this._expandToIndex(trackIndex);
                if (last) {
                    while (last.next)
                        last = last.next;
                    last.next = entry
                } else
                    this.tracks[trackIndex] = entry;
                if (delay <= 0) {
                    if (last)
                        delay += last.endTime - this.data.getMix(last.animation, animation);
                    else
                        delay = 0
                }
                entry.delay = delay;
                return entry
            },
            getCurrent: function (trackIndex) {
                if (trackIndex >= this.tracks.length)
                    return null;
                return this.tracks[trackIndex]
            }
        };
        spine.SkeletonJson = function (attachmentLoader) {
            this.attachmentLoader = attachmentLoader
        }
        ;
        spine.SkeletonJson.prototype = {
            scale: 1,
            readSkeletonData: function (root, name) {
                var skeletonData = new spine.SkeletonData;
                skeletonData.name = name;
                var skeletonMap = root["skeleton"];
                if (skeletonMap) {
                    skeletonData.hash = skeletonMap["hash"];
                    skeletonData.version = skeletonMap["spine"];
                    skeletonData.width = skeletonMap["width"] || 0;
                    skeletonData.height = skeletonMap["height"] || 0
                }
                var bones = root["bones"];
                for (var i = 0, n = bones.length; i < n; i++) {
                    var boneMap = bones[i];
                    var parent = null;
                    if (boneMap["parent"]) {
                        parent = skeletonData.findBone(boneMap["parent"]);
                        if (!parent)
                            throw "Parent bone not found: " + boneMap["parent"]
                    }
                    var boneData = new spine.BoneData(boneMap["name"], parent);
                    boneData.length = (boneMap["length"] || 0) * this.scale;
                    boneData.x = (boneMap["x"] || 0) * this.scale;
                    boneData.y = (boneMap["y"] || 0) * this.scale;
                    boneData.rotation = boneMap["rotation"] || 0;
                    boneData.scaleX = boneMap.hasOwnProperty("scaleX") ? boneMap["scaleX"] : 1;
                    boneData.scaleY = boneMap.hasOwnProperty("scaleY") ? boneMap["scaleY"] : 1;
                    boneData.inheritScale = boneMap.hasOwnProperty("inheritScale") ? boneMap["inheritScale"] : true;
                    boneData.inheritRotation = boneMap.hasOwnProperty("inheritRotation") ? boneMap["inheritRotation"] : true;
                    skeletonData.bones.push(boneData)
                }
                var ik = root["ik"];
                if (ik) {
                    for (var i = 0, n = ik.length; i < n; i++) {
                        var ikMap = ik[i];
                        var ikConstraintData = new spine.IkConstraintData(ikMap["name"]);
                        var bones = ikMap["bones"];
                        for (var ii = 0, nn = bones.length; ii < nn; ii++) {
                            var bone = skeletonData.findBone(bones[ii]);
                            if (!bone)
                                throw "IK bone not found: " + bones[ii];
                            ikConstraintData.bones.push(bone)
                        }
                        ikConstraintData.target = skeletonData.findBone(ikMap["target"]);
                        if (!ikConstraintData.target)
                            throw "Target bone not found: " + ikMap["target"];
                        ikConstraintData.bendDirection = !ikMap.hasOwnProperty("bendPositive") || ikMap["bendPositive"] ? 1 : -1;
                        ikConstraintData.mix = ikMap.hasOwnProperty("mix") ? ikMap["mix"] : 1;
                        skeletonData.ikConstraints.push(ikConstraintData)
                    }
                }
                var slots = root["slots"];
                for (var i = 0, n = slots.length; i < n; i++) {
                    var slotMap = slots[i];
                    var boneData = skeletonData.findBone(slotMap["bone"]);
                    if (!boneData)
                        throw "Slot bone not found: " + slotMap["bone"];
                    var slotData = new spine.SlotData(slotMap["name"], boneData);
                    var color = slotMap["color"];
                    if (color) {
                        slotData.r = this.toColor(color, 0);
                        slotData.g = this.toColor(color, 1);
                        slotData.b = this.toColor(color, 2);
                        slotData.a = this.toColor(color, 3)
                    }
                    slotData.attachmentName = slotMap["attachment"];
                    slotData.additiveBlending = slotMap["additive"] && slotMap["additive"] == "true";
                    skeletonData.slots.push(slotData)
                }
                var skins = root["skins"];
                for (var skinName in skins) {
                    if (!skins.hasOwnProperty(skinName))
                        continue;
                    var skinMap = skins[skinName];
                    var skin = new spine.Skin(skinName);
                    for (var slotName in skinMap) {
                        if (!skinMap.hasOwnProperty(slotName))
                            continue;
                        var slotIndex = skeletonData.findSlotIndex(slotName);
                        var slotEntry = skinMap[slotName];
                        for (var attachmentName in slotEntry) {
                            if (!slotEntry.hasOwnProperty(attachmentName))
                                continue;
                            var attachment = this.readAttachment(skin, attachmentName, slotEntry[attachmentName]);
                            if (attachment)
                                skin.addAttachment(slotIndex, attachmentName, attachment)
                        }
                    }
                    skeletonData.skins.push(skin);
                    if (skin.name == "default")
                        skeletonData.defaultSkin = skin
                }
                var events = root["events"];
                for (var eventName in events) {
                    if (!events.hasOwnProperty(eventName))
                        continue;
                    var eventMap = events[eventName];
                    var eventData = new spine.EventData(eventName);
                    eventData.intValue = eventMap["int"] || 0;
                    eventData.floatValue = eventMap["float"] || 0;
                    eventData.stringValue = eventMap["string"] || null;
                    skeletonData.events.push(eventData)
                }
                var animations = root["animations"];
                for (var animationName in animations) {
                    if (!animations.hasOwnProperty(animationName))
                        continue;
                    this.readAnimation(animationName, animations[animationName], skeletonData)
                }
                return skeletonData
            },
            readAttachment: function (skin, name, map) {
                name = map["name"] || name;
                var type = spine.AttachmentType[map["type"] || "region"];
                var path = map["path"] || name;
                var scale = this.scale;
                if (type == spine.AttachmentType.region) {
                    var region = this.attachmentLoader.newRegionAttachment(skin, name, path);
                    if (!region)
                        return null;
                    region.path = path;
                    region.x = (map["x"] || 0) * scale;
                    region.y = (map["y"] || 0) * scale;
                    region.scaleX = map.hasOwnProperty("scaleX") ? map["scaleX"] : 1;
                    region.scaleY = map.hasOwnProperty("scaleY") ? map["scaleY"] : 1;
                    region.rotation = map["rotation"] || 0;
                    region.width = (map["width"] || 0) * scale;
                    region.height = (map["height"] || 0) * scale;
                    var color = map["color"];
                    if (color) {
                        region.r = this.toColor(color, 0);
                        region.g = this.toColor(color, 1);
                        region.b = this.toColor(color, 2);
                        region.a = this.toColor(color, 3)
                    }
                    region.updateOffset();
                    return region
                } else if (type == spine.AttachmentType.mesh) {
                    var mesh = this.attachmentLoader.newMeshAttachment(skin, name, path);
                    if (!mesh)
                        return null;
                    mesh.path = path;
                    mesh.vertices = this.getFloatArray(map, "vertices", scale);
                    mesh.triangles = this.getIntArray(map, "triangles");
                    mesh.regionUVs = this.getFloatArray(map, "uvs", 1);
                    mesh.updateUVs();
                    color = map["color"];
                    if (color) {
                        mesh.r = this.toColor(color, 0);
                        mesh.g = this.toColor(color, 1);
                        mesh.b = this.toColor(color, 2);
                        mesh.a = this.toColor(color, 3)
                    }
                    mesh.hullLength = (map["hull"] || 0) * 2;
                    if (map["edges"])
                        mesh.edges = this.getIntArray(map, "edges");
                    mesh.width = (map["width"] || 0) * scale;
                    mesh.height = (map["height"] || 0) * scale;
                    return mesh
                } else if (type == spine.AttachmentType.skinnedmesh) {
                    var mesh = this.attachmentLoader.newSkinnedMeshAttachment(skin, name, path);
                    if (!mesh)
                        return null;
                    mesh.path = path;
                    var uvs = this.getFloatArray(map, "uvs", 1);
                    var vertices = this.getFloatArray(map, "vertices", 1);
                    var weights = [];
                    var bones = [];
                    for (var i = 0, n = vertices.length; i < n;) {
                        var boneCount = vertices[i++] | 0;
                        bones[bones.length] = boneCount;
                        for (var nn = i + boneCount * 4; i < nn;) {
                            bones[bones.length] = vertices[i];
                            weights[weights.length] = vertices[i + 1] * scale;
                            weights[weights.length] = vertices[i + 2] * scale;
                            weights[weights.length] = vertices[i + 3];
                            i += 4
                        }
                    }
                    mesh.bones = bones;
                    mesh.weights = weights;
                    mesh.triangles = this.getIntArray(map, "triangles");
                    mesh.regionUVs = uvs;
                    mesh.updateUVs();
                    color = map["color"];
                    if (color) {
                        mesh.r = this.toColor(color, 0);
                        mesh.g = this.toColor(color, 1);
                        mesh.b = this.toColor(color, 2);
                        mesh.a = this.toColor(color, 3)
                    }
                    mesh.hullLength = (map["hull"] || 0) * 2;
                    if (map["edges"])
                        mesh.edges = this.getIntArray(map, "edges");
                    mesh.width = (map["width"] || 0) * scale;
                    mesh.height = (map["height"] || 0) * scale;
                    return mesh
                } else if (type == spine.AttachmentType.boundingbox) {
                    var attachment = this.attachmentLoader.newBoundingBoxAttachment(skin, name);
                    var vertices = map["vertices"];
                    for (var i = 0, n = vertices.length; i < n; i++)
                        attachment.vertices.push(vertices[i] * scale);
                    return attachment
                }
                throw "Unknown attachment type: " + type
            },
            readAnimation: function (name, map, skeletonData) {
                var timelines = [];
                var duration = 0;
                var slots = map["slots"];
                for (var slotName in slots) {
                    if (!slots.hasOwnProperty(slotName))
                        continue;
                    var slotMap = slots[slotName];
                    var slotIndex = skeletonData.findSlotIndex(slotName);
                    for (var timelineName in slotMap) {
                        if (!slotMap.hasOwnProperty(timelineName))
                            continue;
                        var values = slotMap[timelineName];
                        if (timelineName == "color") {
                            var timeline = new spine.ColorTimeline(values.length);
                            timeline.slotIndex = slotIndex;
                            var frameIndex = 0;
                            for (var i = 0, n = values.length; i < n; i++) {
                                var valueMap = values[i];
                                var color = valueMap["color"];
                                var r = this.toColor(color, 0);
                                var g = this.toColor(color, 1);
                                var b = this.toColor(color, 2);
                                var a = this.toColor(color, 3);
                                timeline.setFrame(frameIndex, valueMap["time"], r, g, b, a);
                                this.readCurve(timeline, frameIndex, valueMap);
                                frameIndex++
                            }
                            timelines.push(timeline);
                            duration = Math.max(duration, timeline.frames[timeline.getFrameCount() * 5 - 5])
                        } else if (timelineName == "attachment") {
                            var timeline = new spine.AttachmentTimeline(values.length);
                            timeline.slotIndex = slotIndex;
                            var frameIndex = 0;
                            for (var i = 0, n = values.length; i < n; i++) {
                                var valueMap = values[i];
                                timeline.setFrame(frameIndex++, valueMap["time"], valueMap["name"])
                            }
                            timelines.push(timeline);
                            duration = Math.max(duration, timeline.frames[timeline.getFrameCount() - 1])
                        } else
                            throw "Invalid timeline type for a slot: " + timelineName + " (" + slotName + ")"
                    }
                }
                var bones = map["bones"];
                for (var boneName in bones) {
                    if (!bones.hasOwnProperty(boneName))
                        continue;
                    var boneIndex = skeletonData.findBoneIndex(boneName);
                    if (boneIndex == -1)
                        throw "Bone not found: " + boneName;
                    var boneMap = bones[boneName];
                    for (var timelineName in boneMap) {
                        if (!boneMap.hasOwnProperty(timelineName))
                            continue;
                        var values = boneMap[timelineName];
                        if (timelineName == "rotate") {
                            var timeline = new spine.RotateTimeline(values.length);
                            timeline.boneIndex = boneIndex;
                            var frameIndex = 0;
                            for (var i = 0, n = values.length; i < n; i++) {
                                var valueMap = values[i];
                                timeline.setFrame(frameIndex, valueMap["time"], valueMap["angle"]);
                                this.readCurve(timeline, frameIndex, valueMap);
                                frameIndex++
                            }
                            timelines.push(timeline);
                            duration = Math.max(duration, timeline.frames[timeline.getFrameCount() * 2 - 2])
                        } else if (timelineName == "translate" || timelineName == "scale") {
                            var timeline;
                            var timelineScale = 1;
                            if (timelineName == "scale")
                                timeline = new spine.ScaleTimeline(values.length);
                            else {
                                timeline = new spine.TranslateTimeline(values.length);
                                timelineScale = this.scale
                            }
                            timeline.boneIndex = boneIndex;
                            var frameIndex = 0;
                            for (var i = 0, n = values.length; i < n; i++) {
                                var valueMap = values[i];
                                var x = (valueMap["x"] || 0) * timelineScale;
                                var y = (valueMap["y"] || 0) * timelineScale;
                                timeline.setFrame(frameIndex, valueMap["time"], x, y);
                                this.readCurve(timeline, frameIndex, valueMap);
                                frameIndex++
                            }
                            timelines.push(timeline);
                            duration = Math.max(duration, timeline.frames[timeline.getFrameCount() * 3 - 3])
                        } else if (timelineName == "flipX" || timelineName == "flipY") {
                            var x = timelineName == "flipX";
                            var timeline = x ? new spine.FlipXTimeline(values.length) : new spine.FlipYTimeline(values.length);
                            timeline.boneIndex = boneIndex;
                            var field = x ? "x" : "y";
                            var frameIndex = 0;
                            for (var i = 0, n = values.length; i < n; i++) {
                                var valueMap = values[i];
                                timeline.setFrame(frameIndex, valueMap["time"], valueMap[field] || false);
                                frameIndex++
                            }
                            timelines.push(timeline);
                            duration = Math.max(duration, timeline.frames[timeline.getFrameCount() * 2 - 2])
                        } else
                            throw "Invalid timeline type for a bone: " + timelineName + " (" + boneName + ")"
                    }
                }
                var ikMap = map["ik"];
                for (var ikConstraintName in ikMap) {
                    if (!ikMap.hasOwnProperty(ikConstraintName))
                        continue;
                    var ikConstraint = skeletonData.findIkConstraint(ikConstraintName);
                    var values = ikMap[ikConstraintName];
                    var timeline = new spine.IkConstraintTimeline(values.length);
                    timeline.ikConstraintIndex = skeletonData.ikConstraints.indexOf(ikConstraint);
                    var frameIndex = 0;
                    for (var i = 0, n = values.length; i < n; i++) {
                        var valueMap = values[i];
                        var mix = valueMap.hasOwnProperty("mix") ? valueMap["mix"] : 1;
                        var bendDirection = !valueMap.hasOwnProperty("bendPositive") || valueMap["bendPositive"] ? 1 : -1;
                        timeline.setFrame(frameIndex, valueMap["time"], mix, bendDirection);
                        this.readCurve(timeline, frameIndex, valueMap);
                        frameIndex++
                    }
                    timelines.push(timeline);
                    duration = Math.max(duration, timeline.frames[timeline.frameCount * 3 - 3])
                }
                var ffd = map["ffd"];
                for (var skinName in ffd) {
                    var skin = skeletonData.findSkin(skinName);
                    var slotMap = ffd[skinName];
                    for (slotName in slotMap) {
                        var slotIndex = skeletonData.findSlotIndex(slotName);
                        var meshMap = slotMap[slotName];
                        for (var meshName in meshMap) {
                            var values = meshMap[meshName];
                            var timeline = new spine.FfdTimeline(values.length);
                            var attachment = skin.getAttachment(slotIndex, meshName);
                            if (!attachment)
                                throw "FFD attachment not found: " + meshName;
                            timeline.slotIndex = slotIndex;
                            timeline.attachment = attachment;
                            var isMesh = attachment.type == spine.AttachmentType.mesh;
                            var vertexCount;
                            if (isMesh)
                                vertexCount = attachment.vertices.length;
                            else
                                vertexCount = attachment.weights.length / 3 * 2;
                            var frameIndex = 0;
                            for (var i = 0, n = values.length; i < n; i++) {
                                var valueMap = values[i];
                                var vertices;
                                if (!valueMap["vertices"]) {
                                    if (isMesh)
                                        vertices = attachment.vertices;
                                    else {
                                        vertices = [];
                                        vertices.length = vertexCount
                                    }
                                } else {
                                    var verticesValue = valueMap["vertices"];
                                    var vertices = [];
                                    vertices.length = vertexCount;
                                    var start = valueMap["offset"] || 0;
                                    var nn = verticesValue.length;
                                    if (this.scale == 1) {
                                        for (var ii = 0; ii < nn; ii++)
                                            vertices[ii + start] = verticesValue[ii]
                                    } else {
                                        for (var ii = 0; ii < nn; ii++)
                                            vertices[ii + start] = verticesValue[ii] * this.scale
                                    }
                                    if (isMesh) {
                                        var meshVertices = attachment.vertices;
                                        for (var ii = 0, nn = vertices.length; ii < nn; ii++)
                                            vertices[ii] += meshVertices[ii]
                                    }
                                }
                                timeline.setFrame(frameIndex, valueMap["time"], vertices);
                                this.readCurve(timeline, frameIndex, valueMap);
                                frameIndex++
                            }
                            timelines[timelines.length] = timeline;
                            duration = Math.max(duration, timeline.frames[timeline.frameCount - 1])
                        }
                    }
                }
                var drawOrderValues = map["drawOrder"];
                if (!drawOrderValues)
                    drawOrderValues = map["draworder"];
                if (drawOrderValues) {
                    var timeline = new spine.DrawOrderTimeline(drawOrderValues.length);
                    var slotCount = skeletonData.slots.length;
                    var frameIndex = 0;
                    for (var i = 0, n = drawOrderValues.length; i < n; i++) {
                        var drawOrderMap = drawOrderValues[i];
                        var drawOrder = null;
                        if (drawOrderMap["offsets"]) {
                            drawOrder = [];
                            drawOrder.length = slotCount;
                            for (var ii = slotCount - 1; ii >= 0; ii--)
                                drawOrder[ii] = -1;
                            var offsets = drawOrderMap["offsets"];
                            var unchanged = [];
                            unchanged.length = slotCount - offsets.length;
                            var originalIndex = 0
                                , unchangedIndex = 0;
                            for (var ii = 0, nn = offsets.length; ii < nn; ii++) {
                                var offsetMap = offsets[ii];
                                var slotIndex = skeletonData.findSlotIndex(offsetMap["slot"]);
                                if (slotIndex == -1)
                                    throw "Slot not found: " + offsetMap["slot"];
                                while (originalIndex != slotIndex)
                                    unchanged[unchangedIndex++] = originalIndex++;
                                drawOrder[originalIndex + offsetMap["offset"]] = originalIndex++
                            }
                            while (originalIndex < slotCount)
                                unchanged[unchangedIndex++] = originalIndex++;
                            for (var ii = slotCount - 1; ii >= 0; ii--)
                                if (drawOrder[ii] == -1)
                                    drawOrder[ii] = unchanged[--unchangedIndex]
                        }
                        timeline.setFrame(frameIndex++, drawOrderMap["time"], drawOrder)
                    }
                    timelines.push(timeline);
                    duration = Math.max(duration, timeline.frames[timeline.getFrameCount() - 1])
                }
                var events = map["events"];
                if (events) {
                    var timeline = new spine.EventTimeline(events.length);
                    var frameIndex = 0;
                    for (var i = 0, n = events.length; i < n; i++) {
                        var eventMap = events[i];
                        var eventData = skeletonData.findEvent(eventMap["name"]);
                        if (!eventData)
                            throw "Event not found: " + eventMap["name"];
                        var event = new spine.Event(eventData);
                        event.intValue = eventMap.hasOwnProperty("int") ? eventMap["int"] : eventData.intValue;
                        event.floatValue = eventMap.hasOwnProperty("float") ? eventMap["float"] : eventData.floatValue;
                        event.stringValue = eventMap.hasOwnProperty("string") ? eventMap["string"] : eventData.stringValue;
                        timeline.setFrame(frameIndex++, eventMap["time"], event)
                    }
                    timelines.push(timeline);
                    duration = Math.max(duration, timeline.frames[timeline.getFrameCount() - 1])
                }
                skeletonData.animations.push(new spine.Animation(name, timelines, duration))
            },
            readCurve: function (timeline, frameIndex, valueMap) {
                var curve = valueMap["curve"];
                if (!curve)
                    timeline.curves.setLinear(frameIndex);
                else if (curve == "stepped")
                    timeline.curves.setStepped(frameIndex);
                else if (curve instanceof Array)
                    timeline.curves.setCurve(frameIndex, curve[0], curve[1], curve[2], curve[3])
            },
            toColor: function (hexString, colorIndex) {
                if (hexString.length != 8)
                    throw "Color hexidecimal length must be 8, recieved: " + hexString;
                return parseInt(hexString.substring(colorIndex * 2, colorIndex * 2 + 2), 16) / 255
            },
            getFloatArray: function (map, name, scale) {
                var list = map[name];
                var values = new spine.Float32Array(list.length);
                var i = 0
                    , n = list.length;
                if (scale == 1) {
                    for (; i < n; i++)
                        values[i] = list[i]
                } else {
                    for (; i < n; i++)
                        values[i] = list[i] * scale
                }
                return values
            },
            getIntArray: function (map, name) {
                var list = map[name];
                var values = new spine.Uint16Array(list.length);
                for (var i = 0, n = list.length; i < n; i++)
                    values[i] = list[i] | 0;
                return values
            }
        };
        spine.Atlas = function (atlasText, textureLoader) {
            this.textureLoader = textureLoader;
            this.pages = [];
            this.regions = [];
            var reader = new spine.AtlasReader(atlasText);
            var tuple = [];
            tuple.length = 4;
            var page = null;
            while (true) {
                var line = reader.readLine();
                if (line === null)
                    break;
                line = reader.trim(line);
                if (!line.length)
                    page = null;
                else if (!page) {
                    page = new spine.AtlasPage;
                    page.name = line;
                    if (reader.readTuple(tuple) == 2) {
                        page.width = parseInt(tuple[0]);
                        page.height = parseInt(tuple[1]);
                        reader.readTuple(tuple)
                    }
                    page.format = spine.Atlas.Format[tuple[0]];
                    reader.readTuple(tuple);
                    page.minFilter = spine.Atlas.TextureFilter[tuple[0]];
                    page.magFilter = spine.Atlas.TextureFilter[tuple[1]];
                    var direction = reader.readValue();
                    page.uWrap = spine.Atlas.TextureWrap.clampToEdge;
                    page.vWrap = spine.Atlas.TextureWrap.clampToEdge;
                    if (direction == "x")
                        page.uWrap = spine.Atlas.TextureWrap.repeat;
                    else if (direction == "y")
                        page.vWrap = spine.Atlas.TextureWrap.repeat;
                    else if (direction == "xy")
                        page.uWrap = page.vWrap = spine.Atlas.TextureWrap.repeat;
                    textureLoader.load(page, line, this);
                    this.pages.push(page)
                } else {
                    var region = new spine.AtlasRegion;
                    region.name = line;
                    region.page = page;
                    region.rotate = reader.readValue() == "true";
                    reader.readTuple(tuple);
                    var x = parseInt(tuple[0]);
                    var y = parseInt(tuple[1]);
                    reader.readTuple(tuple);
                    var width = parseInt(tuple[0]);
                    var height = parseInt(tuple[1]);
                    region.u = x / page.width;
                    region.v = y / page.height;
                    if (region.rotate) {
                        region.u2 = (x + height) / page.width;
                        region.v2 = (y + width) / page.height
                    } else {
                        region.u2 = (x + width) / page.width;
                        region.v2 = (y + height) / page.height
                    }
                    region.x = x;
                    region.y = y;
                    region.width = Math.abs(width);
                    region.height = Math.abs(height);
                    if (reader.readTuple(tuple) == 4) {
                        region.splits = [parseInt(tuple[0]), parseInt(tuple[1]), parseInt(tuple[2]), parseInt(tuple[3])];
                        if (reader.readTuple(tuple) == 4) {
                            region.pads = [parseInt(tuple[0]), parseInt(tuple[1]), parseInt(tuple[2]), parseInt(tuple[3])];
                            reader.readTuple(tuple)
                        }
                    }
                    region.originalWidth = parseInt(tuple[0]);
                    region.originalHeight = parseInt(tuple[1]);
                    reader.readTuple(tuple);
                    region.offsetX = parseInt(tuple[0]);
                    region.offsetY = parseInt(tuple[1]);
                    region.index = parseInt(reader.readValue());
                    this.regions.push(region)
                }
            }
        }
        ;
        spine.Atlas.prototype = {
            findRegion: function (name) {
                var regions = this.regions;
                for (var i = 0, n = regions.length; i < n; i++)
                    if (regions[i].name == name)
                        return regions[i];
                return null
            },
            dispose: function () {
                var pages = this.pages;
                for (var i = 0, n = pages.length; i < n; i++)
                    this.textureLoader.unload(pages[i].rendererObject)
            },
            updateUVs: function (page) {
                var regions = this.regions;
                for (var i = 0, n = regions.length; i < n; i++) {
                    var region = regions[i];
                    if (region.page != page)
                        continue;
                    region.u = region.x / page.width;
                    region.v = region.y / page.height;
                    if (region.rotate) {
                        region.u2 = (region.x + region.height) / page.width;
                        region.v2 = (region.y + region.width) / page.height
                    } else {
                        region.u2 = (region.x + region.width) / page.width;
                        region.v2 = (region.y + region.height) / page.height
                    }
                }
            }
        };
        spine.Atlas.Format = {
            alpha: 0,
            intensity: 1,
            luminanceAlpha: 2,
            rgb565: 3,
            rgba4444: 4,
            rgb888: 5,
            rgba8888: 6
        };
        spine.Atlas.TextureFilter = {
            nearest: 0,
            linear: 1,
            mipMap: 2,
            mipMapNearestNearest: 3,
            mipMapLinearNearest: 4,
            mipMapNearestLinear: 5,
            mipMapLinearLinear: 6
        };
        spine.Atlas.TextureWrap = {
            mirroredRepeat: 0,
            clampToEdge: 1,
            repeat: 2
        };
        spine.AtlasPage = function () {
        }
        ;
        spine.AtlasPage.prototype = {
            name: null,
            format: null,
            minFilter: null,
            magFilter: null,
            uWrap: null,
            vWrap: null,
            rendererObject: null,
            width: 0,
            height: 0
        };
        spine.AtlasRegion = function () {
        }
        ;
        spine.AtlasRegion.prototype = {
            page: null,
            name: null,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            u: 0,
            v: 0,
            u2: 0,
            v2: 0,
            offsetX: 0,
            offsetY: 0,
            originalWidth: 0,
            originalHeight: 0,
            index: 0,
            rotate: false,
            splits: null,
            pads: null
        };
        spine.AtlasReader = function (text) {
            this.lines = text.split(/\r\n|\r|\n/)
        }
        ;
        spine.AtlasReader.prototype = {
            index: 0,
            trim: function (value) {
                return value.replace(/^\s+|\s+$/g, "")
            },
            readLine: function () {
                if (this.index >= this.lines.length)
                    return null;
                return this.lines[this.index++]
            },
            readValue: function () {
                var line = this.readLine();
                var colon = line.indexOf(":");
                if (colon == -1)
                    throw "Invalid line: " + line;
                return this.trim(line.substring(colon + 1))
            },
            readTuple: function (tuple) {
                var line = this.readLine();
                var colon = line.indexOf(":");
                if (colon == -1)
                    throw "Invalid line: " + line;
                var i = 0
                    , lastMatch = colon + 1;
                for (; i < 3; i++) {
                    var comma = line.indexOf(",", lastMatch);
                    if (comma == -1)
                        break;
                    tuple[i] = this.trim(line.substr(lastMatch, comma - lastMatch));
                    lastMatch = comma + 1
                }
                tuple[i] = this.trim(line.substring(lastMatch));
                return i + 1
            }
        };
        spine.AtlasAttachmentLoader = function (atlas) {
            this.atlas = atlas
        }
        ;
        spine.AtlasAttachmentLoader.prototype = {
            newRegionAttachment: function (skin, name, path) {
                var region = this.atlas.findRegion(path);
                if (!region)
                    throw "Region not found in atlas: " + path + " (region attachment: " + name + ")";
                var attachment = new spine.RegionAttachment(name);
                attachment.rendererObject = region;
                attachment.setUVs(region.u, region.v, region.u2, region.v2, region.rotate);
                attachment.regionOffsetX = region.offsetX;
                attachment.regionOffsetY = region.offsetY;
                attachment.regionWidth = region.width;
                attachment.regionHeight = region.height;
                attachment.regionOriginalWidth = region.originalWidth;
                attachment.regionOriginalHeight = region.originalHeight;
                return attachment
            },
            newMeshAttachment: function (skin, name, path) {
                var region = this.atlas.findRegion(path);
                if (!region)
                    throw "Region not found in atlas: " + path + " (mesh attachment: " + name + ")";
                var attachment = new spine.MeshAttachment(name);
                attachment.rendererObject = region;
                attachment.regionU = region.u;
                attachment.regionV = region.v;
                attachment.regionU2 = region.u2;
                attachment.regionV2 = region.v2;
                attachment.regionRotate = region.rotate;
                attachment.regionOffsetX = region.offsetX;
                attachment.regionOffsetY = region.offsetY;
                attachment.regionWidth = region.width;
                attachment.regionHeight = region.height;
                attachment.regionOriginalWidth = region.originalWidth;
                attachment.regionOriginalHeight = region.originalHeight;
                return attachment
            },
            newSkinnedMeshAttachment: function (skin, name, path) {
                var region = this.atlas.findRegion(path);
                if (!region)
                    throw "Region not found in atlas: " + path + " (skinned mesh attachment: " + name + ")";
                var attachment = new spine.SkinnedMeshAttachment(name);
                attachment.rendererObject = region;
                attachment.regionU = region.u;
                attachment.regionV = region.v;
                attachment.regionU2 = region.u2;
                attachment.regionV2 = region.v2;
                attachment.regionRotate = region.rotate;
                attachment.regionOffsetX = region.offsetX;
                attachment.regionOffsetY = region.offsetY;
                attachment.regionWidth = region.width;
                attachment.regionHeight = region.height;
                attachment.regionOriginalWidth = region.originalWidth;
                attachment.regionOriginalHeight = region.originalHeight;
                return attachment
            },
            newBoundingBoxAttachment: function (skin, name) {
                return new spine.BoundingBoxAttachment(name)
            }
        };
        spine.SkeletonBounds = function () {
            this.polygonPool = [];
            this.polygons = [];
            this.boundingBoxes = []
        }
        ;
        spine.SkeletonBounds.prototype = {
            minX: 0,
            minY: 0,
            maxX: 0,
            maxY: 0,
            update: function (skeleton, updateAabb) {
                var slots = skeleton.slots;
                var slotCount = slots.length;
                var x = skeleton.x
                    , y = skeleton.y;
                var boundingBoxes = this.boundingBoxes;
                var polygonPool = this.polygonPool;
                var polygons = this.polygons;
                boundingBoxes.length = 0;
                for (var i = 0, n = polygons.length; i < n; i++)
                    polygonPool.push(polygons[i]);
                polygons.length = 0;
                for (var i = 0; i < slotCount; i++) {
                    var slot = slots[i];
                    var boundingBox = slot.attachment;
                    if (boundingBox.type != spine.AttachmentType.boundingbox)
                        continue;
                    boundingBoxes.push(boundingBox);
                    var poolCount = polygonPool.length, polygon;
                    if (poolCount > 0) {
                        polygon = polygonPool[poolCount - 1];
                        polygonPool.splice(poolCount - 1, 1)
                    } else
                        polygon = [];
                    polygons.push(polygon);
                    polygon.length = boundingBox.vertices.length;
                    boundingBox.computeWorldVertices(x, y, slot.bone, polygon)
                }
                if (updateAabb)
                    this.aabbCompute()
            },
            aabbCompute: function () {
                var polygons = this.polygons;
                var minX = Number.MAX_VALUE
                    , minY = Number.MAX_VALUE
                    , maxX = Number.MIN_VALUE
                    , maxY = Number.MIN_VALUE;
                for (var i = 0, n = polygons.length; i < n; i++) {
                    var vertices = polygons[i];
                    for (var ii = 0, nn = vertices.length; ii < nn; ii += 2) {
                        var x = vertices[ii];
                        var y = vertices[ii + 1];
                        minX = Math.min(minX, x);
                        minY = Math.min(minY, y);
                        maxX = Math.max(maxX, x);
                        maxY = Math.max(maxY, y)
                    }
                }
                this.minX = minX;
                this.minY = minY;
                this.maxX = maxX;
                this.maxY = maxY
            },
            aabbContainsPoint: function (x, y) {
                return x >= this.minX && x <= this.maxX && y >= this.minY && y <= this.maxY
            },
            aabbIntersectsSegment: function (x1, y1, x2, y2) {
                var minX = this.minX
                    , minY = this.minY
                    , maxX = this.maxX
                    , maxY = this.maxY;
                if (x1 <= minX && x2 <= minX || y1 <= minY && y2 <= minY || x1 >= maxX && x2 >= maxX || y1 >= maxY && y2 >= maxY)
                    return false;
                var m = (y2 - y1) / (x2 - x1);
                var y = m * (minX - x1) + y1;
                if (y > minY && y < maxY)
                    return true;
                y = m * (maxX - x1) + y1;
                if (y > minY && y < maxY)
                    return true;
                var x = (minY - y1) / m + x1;
                if (x > minX && x < maxX)
                    return true;
                x = (maxY - y1) / m + x1;
                if (x > minX && x < maxX)
                    return true;
                return false
            },
            aabbIntersectsSkeleton: function (bounds) {
                return this.minX < bounds.maxX && this.maxX > bounds.minX && this.minY < bounds.maxY && this.maxY > bounds.minY
            },
            containsPoint: function (x, y) {
                var polygons = this.polygons;
                for (var i = 0, n = polygons.length; i < n; i++)
                    if (this.polygonContainsPoint(polygons[i], x, y))
                        return this.boundingBoxes[i];
                return null
            },
            intersectsSegment: function (x1, y1, x2, y2) {
                var polygons = this.polygons;
                for (var i = 0, n = polygons.length; i < n; i++)
                    if (polygons[i].intersectsSegment(x1, y1, x2, y2))
                        return this.boundingBoxes[i];
                return null
            },
            polygonContainsPoint: function (polygon, x, y) {
                var nn = polygon.length;
                var prevIndex = nn - 2;
                var inside = false;
                for (var ii = 0; ii < nn; ii += 2) {
                    var vertexY = polygon[ii + 1];
                    var prevY = polygon[prevIndex + 1];
                    if (vertexY < y && prevY >= y || prevY < y && vertexY >= y) {
                        var vertexX = polygon[ii];
                        if (vertexX + (y - vertexY) / (prevY - vertexY) * (polygon[prevIndex] - vertexX) < x)
                            inside = !inside
                    }
                    prevIndex = ii
                }
                return inside
            },
            polygonIntersectsSegment: function (polygon, x1, y1, x2, y2) {
                var nn = polygon.length;
                var width12 = x1 - x2
                    , height12 = y1 - y2;
                var det1 = x1 * y2 - y1 * x2;
                var x3 = polygon[nn - 2]
                    , y3 = polygon[nn - 1];
                for (var ii = 0; ii < nn; ii += 2) {
                    var x4 = polygon[ii]
                        , y4 = polygon[ii + 1];
                    var det2 = x3 * y4 - y3 * x4;
                    var width34 = x3 - x4
                        , height34 = y3 - y4;
                    var det3 = width12 * height34 - height12 * width34;
                    var x = (det1 * width34 - width12 * det2) / det3;
                    if ((x >= x3 && x <= x4 || x >= x4 && x <= x3) && (x >= x1 && x <= x2 || x >= x2 && x <= x1)) {
                        var y = (det1 * height34 - height12 * det2) / det3;
                        if ((y >= y3 && y <= y4 || y >= y4 && y <= y3) && (y >= y1 && y <= y2 || y >= y2 && y <= y1))
                            return true
                    }
                    x3 = x4;
                    y3 = y4
                }
                return false
            },
            getPolygon: function (attachment) {
                var index = this.boundingBoxes.indexOf(attachment);
                return index == -1 ? null : this.polygons[index]
            },
            getWidth: function () {
                return this.maxX - this.minX
            },
            getHeight: function () {
                return this.maxY - this.minY
            }
        };
        spine.Bone.yDown = true;
        PIXI.AnimCache = {};
        PIXI.SpineTextureLoader = function (basePath, crossorigin) {
            PIXI.EventTarget.call(this);
            this.basePath = basePath;
            this.crossorigin = crossorigin;
            this.loadingCount = 0
        }
        ;
        PIXI.SpineTextureLoader.prototype = PIXI.SpineTextureLoader;
        PIXI.SpineTextureLoader.prototype.load = function (page, file) {
            page.rendererObject = PIXI.BaseTexture.fromImage(this.basePath + "/" + file, this.crossorigin);
            if (!page.rendererObject.hasLoaded) {
                var scope = this;
                ++scope.loadingCount;
                page.rendererObject.addEventListener("loaded", function () {
                    --scope.loadingCount;
                    scope.dispatchEvent({
                        type: "loadedBaseTexture",
                        content: scope
                    })
                })
            }
        }
        ;
        PIXI.SpineTextureLoader.prototype.unload = function (texture) {
            texture.destroy(true)
        }
        ;
        PIXI.Spine = function (url) {
            PIXI.DisplayObjectContainer.call(this);
            this.spineData = PIXI.AnimCache[url];
            if (!this.spineData) {
                throw new Error("Spine data must be preloaded using PIXI.SpineLoader or PIXI.AssetLoader: " + url)
            }
            this.skeleton = new spine.Skeleton(this.spineData);
            this.skeleton.updateWorldTransform();
            this.stateData = new spine.AnimationStateData(this.spineData);
            this.state = new spine.AnimationState(this.stateData);
            this.slotContainers = [];
            for (var i = 0, n = this.skeleton.drawOrder.length; i < n; i++) {
                var slot = this.skeleton.drawOrder[i];
                var attachment = slot.attachment;
                var slotContainer = new PIXI.DisplayObjectContainer;
                this.slotContainers.push(slotContainer);
                this.addChild(slotContainer);
                if (attachment instanceof spine.RegionAttachment) {
                    var spriteName = attachment.rendererObject.name;
                    var sprite = this.createSprite(slot, attachment);
                    slot.currentSprite = sprite;
                    slot.currentSpriteName = spriteName;
                    slotContainer.addChild(sprite)
                } else if (attachment instanceof spine.MeshAttachment) {
                    var mesh = this.createMesh(slot, attachment);
                    slot.currentMesh = mesh;
                    slot.currentMeshName = attachment.name;
                    slotContainer.addChild(mesh)
                } else {
                    continue
                }
            }
            this.autoUpdate = true
        }
        ;
        PIXI.Spine.prototype = Object.create(PIXI.DisplayObjectContainer.prototype);
        PIXI.Spine.prototype.constructor = PIXI.Spine;
        Object.defineProperty(PIXI.Spine.prototype, "autoUpdate", {
            get: function () {
                return this.updateTransform === PIXI.Spine.prototype.autoUpdateTransform
            },
            set: function (value) {
                this.updateTransform = value ? PIXI.Spine.prototype.autoUpdateTransform : PIXI.DisplayObjectContainer.prototype.updateTransform
            }
        });
        PIXI.Spine.prototype.update = function (dt) {
            this.state.update(dt);
            this.state.apply(this.skeleton);
            this.skeleton.updateWorldTransform();
            var drawOrder = this.skeleton.drawOrder;
            for (var i = 0, n = drawOrder.length; i < n; i++) {
                var slot = drawOrder[i];
                var attachment = slot.attachment;
                var slotContainer = this.slotContainers[i];
                if (!attachment) {
                    slotContainer.visible = false;
                    continue
                }
                var type = attachment.type;
                if (type === spine.AttachmentType.region) {
                    if (attachment.rendererObject) {
                        if (!slot.currentSpriteName || slot.currentSpriteName !== attachment.name) {
                            var spriteName = attachment.rendererObject.name;
                            if (slot.currentSprite !== undefined) {
                                slot.currentSprite.visible = false
                            }
                            slot.sprites = slot.sprites || {};
                            if (slot.sprites[spriteName] !== undefined) {
                                slot.sprites[spriteName].visible = true
                            } else {
                                var sprite = this.createSprite(slot, attachment);
                                slotContainer.addChild(sprite)
                            }
                            slot.currentSprite = slot.sprites[spriteName];
                            slot.currentSpriteName = spriteName
                        }
                    }
                    var bone = slot.bone;
                    slotContainer.position.x = bone.worldX + attachment.x * bone.m00 + attachment.y * bone.m01;
                    slotContainer.position.y = bone.worldY + attachment.x * bone.m10 + attachment.y * bone.m11;
                    slotContainer.scale.x = bone.worldScaleX;
                    slotContainer.scale.y = bone.worldScaleY;
                    slotContainer.rotation = -(slot.bone.worldRotation * spine.degRad);
                    slot.currentSprite.tint = PIXI.rgb2hex([slot.r, slot.g, slot.b])
                } else if (type === spine.AttachmentType.skinnedmesh) {
                    if (!slot.currentMeshName || slot.currentMeshName !== attachment.name) {
                        var meshName = attachment.name;
                        if (slot.currentMesh !== undefined) {
                            slot.currentMesh.visible = false
                        }
                        slot.meshes = slot.meshes || {};
                        if (slot.meshes[meshName] !== undefined) {
                            slot.meshes[meshName].visible = true
                        } else {
                            var mesh = this.createMesh(slot, attachment);
                            slotContainer.addChild(mesh)
                        }
                        slot.currentMesh = slot.meshes[meshName];
                        slot.currentMeshName = meshName
                    }
                    attachment.computeWorldVertices(slot.bone.skeleton.x, slot.bone.skeleton.y, slot, slot.currentMesh.vertices)
                } else {
                    slotContainer.visible = false;
                    continue
                }
                slotContainer.visible = true;
                slotContainer.alpha = slot.a
            }
        }
        ;
        PIXI.Spine.prototype.autoUpdateTransform = function () {
            this.lastTime = this.lastTime || Date.now();
            var timeDelta = (Date.now() - this.lastTime) * .001;
            this.lastTime = Date.now();
            this.update(timeDelta);
            PIXI.DisplayObjectContainer.prototype.updateTransform.call(this)
        }
        ;
        PIXI.Spine.prototype.createSprite = function (slot, attachment) {
            var descriptor = attachment.rendererObject;
            var baseTexture = descriptor.page.rendererObject;
            var spriteRect = new PIXI.Rectangle(descriptor.x, descriptor.y, descriptor.rotate ? descriptor.height : descriptor.width, descriptor.rotate ? descriptor.width : descriptor.height);
            var spriteTexture = new PIXI.Texture(baseTexture, spriteRect);
            var sprite = new PIXI.Sprite(spriteTexture);
            var baseRotation = descriptor.rotate ? Math.PI * .5 : 0;
            sprite.scale.set(descriptor.width / descriptor.originalWidth, descriptor.height / descriptor.originalHeight);
            sprite.rotation = baseRotation - attachment.rotation * spine.degRad;
            sprite.anchor.x = sprite.anchor.y = .5;
            slot.sprites = slot.sprites || {};
            slot.sprites[descriptor.name] = sprite;
            return sprite
        }
        ;
        PIXI.Spine.prototype.createMesh = function (slot, attachment) {
            var descriptor = attachment.rendererObject;
            var baseTexture = descriptor.page.rendererObject;
            var texture = new PIXI.Texture(baseTexture);
            var strip = new PIXI.Strip(texture);
            strip.drawMode = PIXI.Strip.DrawModes.TRIANGLES;
            strip.canvasPadding = 1.5;
            strip.vertices = new PIXI.Float32Array(attachment.uvs.length);
            strip.uvs = attachment.uvs;
            strip.indices = attachment.triangles;
            slot.meshes = slot.meshes || {};
            slot.meshes[attachment.name] = strip;
            return strip
        }
        ;
        PIXI.BaseTextureCache = {};
        PIXI.BaseTextureCacheIdGenerator = 0;
        PIXI.BaseTexture = function (source, scaleMode) {
            this.resolution = 1;
            this.width = 100;
            this.height = 100;
            this.scaleMode = scaleMode || PIXI.scaleModes.DEFAULT;
            this.hasLoaded = false;
            this.source = source;
            this._UID = PIXI._UID++;
            this.premultipliedAlpha = true;
            this._glTextures = [];
            this.mipmap = false;
            this._dirty = [true, true, true, true];
            if (!source)
                return;
            if ((this.source.complete || this.source.getContext) && this.source.width && this.source.height) {
                this.hasLoaded = true;
                this.width = this.source.naturalWidth || this.source.width;
                this.height = this.source.naturalHeight || this.source.height;
                this.dirty()
            } else {
                var scope = this;
                this.source.onload = function () {
                    scope.hasLoaded = true;
                    scope.width = scope.source.naturalWidth || scope.source.width;
                    scope.height = scope.source.naturalHeight || scope.source.height;
                    scope.dirty();
                    scope.dispatchEvent({
                        type: "loaded",
                        content: scope
                    })
                }
                ;
                this.source.onerror = function () {
                    scope.dispatchEvent({
                        type: "error",
                        content: scope
                    })
                }
            }
            this.imageUrl = null;
            this._powerOf2 = false
        }
        ;
        PIXI.BaseTexture.prototype.constructor = PIXI.BaseTexture;
        PIXI.EventTarget.mixin(PIXI.BaseTexture.prototype);
        PIXI.BaseTexture.prototype.destroy = function () {
            if (this.imageUrl) {
                delete PIXI.BaseTextureCache[this.imageUrl];
                delete PIXI.TextureCache[this.imageUrl];
                this.imageUrl = null;
                if (!navigator.isCocoonJS)
                    this.source.src = ""
            } else if (this.source && this.source._pixiId) {
                delete PIXI.BaseTextureCache[this.source._pixiId]
            }
            this.source = null;
            this.unloadFromGPU()
        }
        ;
        PIXI.BaseTexture.prototype.updateSourceImage = function (newSrc) {
            this.hasLoaded = false;
            this.source.src = null;
            this.source.src = newSrc
        }
        ;
        PIXI.BaseTexture.prototype.dirty = function () {
            for (var i = 0; i < this._glTextures.length; i++) {
                this._dirty[i] = true
            }
        }
        ;
        PIXI.BaseTexture.prototype.unloadFromGPU = function () {
            this.dirty();
            for (var i = this._glTextures.length - 1; i >= 0; i--) {
                var glTexture = this._glTextures[i];
                var gl = PIXI.glContexts[i];
                if (gl && glTexture) {
                    gl.deleteTexture(glTexture)
                }
            }
            this._glTextures.length = 0;
            this.dirty()
        }
        ;
        PIXI.BaseTexture.fromImage = function (imageUrl, crossorigin, scaleMode) {
            var baseTexture = PIXI.BaseTextureCache[imageUrl];
            if (crossorigin === undefined && imageUrl.indexOf("data:") === -1)
                crossorigin = true;
            if (!baseTexture) {
                var image = new Image;
                if (crossorigin) {
                    image.crossOrigin = ""
                }
                image.src = imageUrl;
                baseTexture = new PIXI.BaseTexture(image, scaleMode);
                baseTexture.imageUrl = imageUrl;
                PIXI.BaseTextureCache[imageUrl] = baseTexture;
                if (imageUrl.indexOf(PIXI.RETINA_PREFIX + ".") !== -1) {
                    baseTexture.resolution = 2
                }
            }
            return baseTexture
        }
        ;
        PIXI.BaseTexture.fromCanvas = function (canvas, scaleMode) {
            if (!canvas._pixiId) {
                canvas._pixiId = "canvas_" + PIXI.TextureCacheIdGenerator++
            }
            var baseTexture = PIXI.BaseTextureCache[canvas._pixiId];
            if (!baseTexture) {
                baseTexture = new PIXI.BaseTexture(canvas, scaleMode);
                PIXI.BaseTextureCache[canvas._pixiId] = baseTexture
            }
            return baseTexture
        }
        ;
        PIXI.TextureCache = {};
        PIXI.FrameCache = {};
        PIXI.TextureCacheIdGenerator = 0;
        PIXI.Texture = function (baseTexture, frame, crop, trim) {
            this.noFrame = false;
            if (!frame) {
                this.noFrame = true;
                frame = new PIXI.Rectangle(0, 0, 1, 1)
            }
            if (baseTexture instanceof PIXI.Texture) {
                baseTexture = baseTexture.baseTexture
            }
            this.baseTexture = baseTexture;
            this.frame = frame;
            this.trim = trim;
            this.valid = false;
            this.requiresUpdate = false;
            this._uvs = null;
            this.width = 0;
            this.height = 0;
            this.crop = crop || new PIXI.Rectangle(0, 0, 1, 1);
            if (baseTexture.hasLoaded) {
                if (this.noFrame)
                    frame = new PIXI.Rectangle(0, 0, baseTexture.width, baseTexture.height);
                this.setFrame(frame)
            } else {
                baseTexture.addEventListener("loaded", this.onBaseTextureLoaded.bind(this))
            }
        }
        ;
        PIXI.Texture.prototype.constructor = PIXI.Texture;
        PIXI.EventTarget.mixin(PIXI.Texture.prototype);
        PIXI.Texture.prototype.onBaseTextureLoaded = function () {
            var baseTexture = this.baseTexture;
            baseTexture.removeEventListener("loaded", this.onLoaded);
            if (this.noFrame)
                this.frame = new PIXI.Rectangle(0, 0, baseTexture.width, baseTexture.height);
            this.setFrame(this.frame);
            this.dispatchEvent({
                type: "update",
                content: this
            })
        }
        ;
        PIXI.Texture.prototype.destroy = function (destroyBase) {
            if (destroyBase)
                this.baseTexture.destroy();
            this.valid = false
        }
        ;
        PIXI.Texture.prototype.setFrame = function (frame) {
            this.noFrame = false;
            this.frame = frame;
            this.width = frame.width;
            this.height = frame.height;
            this.crop.x = frame.x;
            this.crop.y = frame.y;
            this.crop.width = frame.width;
            this.crop.height = frame.height;
            if (!this.trim && (frame.x + frame.width > this.baseTexture.width || frame.y + frame.height > this.baseTexture.height)) {
                throw new Error("Texture Error: frame does not fit inside the base Texture dimensions " + this)
            }
            this.valid = frame && frame.width && frame.height && this.baseTexture.source && this.baseTexture.hasLoaded;
            if (this.trim) {
                this.width = this.trim.width;
                this.height = this.trim.height;
                this.frame.width = this.trim.width;
                this.frame.height = this.trim.height
            }
            if (this.valid)
                this._updateUvs()
        }
        ;
        PIXI.Texture.prototype._updateUvs = function () {
            if (!this._uvs)
                this._uvs = new PIXI.TextureUvs;
            var frame = this.crop;
            var tw = this.baseTexture.width;
            var th = this.baseTexture.height;
            this._uvs.x0 = frame.x / tw;
            this._uvs.y0 = frame.y / th;
            this._uvs.x1 = (frame.x + frame.width) / tw;
            this._uvs.y1 = frame.y / th;
            this._uvs.x2 = (frame.x + frame.width) / tw;
            this._uvs.y2 = (frame.y + frame.height) / th;
            this._uvs.x3 = frame.x / tw;
            this._uvs.y3 = (frame.y + frame.height) / th
        }
        ;
        PIXI.Texture.fromImage = function (imageUrl, crossorigin, scaleMode) {
            var texture = PIXI.TextureCache[imageUrl];
            if (!texture) {
                texture = new PIXI.Texture(PIXI.BaseTexture.fromImage(imageUrl, crossorigin, scaleMode));
                PIXI.TextureCache[imageUrl] = texture
            }
            return texture
        }
        ;
        PIXI.Texture.fromFrame = function (frameId) {
            var texture = PIXI.TextureCache[frameId];
            if (!texture)
                throw new Error('The frameId "' + frameId + '" does not exist in the texture cache ');
            return texture
        }
        ;
        PIXI.Texture.fromCanvas = function (canvas, scaleMode) {
            var baseTexture = PIXI.BaseTexture.fromCanvas(canvas, scaleMode);
            return new PIXI.Texture(baseTexture)
        }
        ;
        PIXI.Texture.addTextureToCache = function (texture, id) {
            PIXI.TextureCache[id] = texture
        }
        ;
        PIXI.Texture.removeTextureFromCache = function (id) {
            var texture = PIXI.TextureCache[id];
            delete PIXI.TextureCache[id];
            delete PIXI.BaseTextureCache[id];
            return texture
        }
        ;
        PIXI.TextureUvs = function () {
            this.x0 = 0;
            this.y0 = 0;
            this.x1 = 0;
            this.y1 = 0;
            this.x2 = 0;
            this.y2 = 0;
            this.x3 = 0;
            this.y3 = 0
        }
        ;
        PIXI.Texture.emptyTexture = new PIXI.Texture(new PIXI.BaseTexture);
        PIXI.RenderTexture = function (width, height, renderer, scaleMode, resolution) {
            this.width = width || 100;
            this.height = height || 100;
            this.resolution = resolution || 1;
            this.frame = new PIXI.Rectangle(0, 0, this.width * this.resolution, this.height * this.resolution);
            this.crop = new PIXI.Rectangle(0, 0, this.width * this.resolution, this.height * this.resolution);
            this.baseTexture = new PIXI.BaseTexture;
            this.baseTexture.width = this.width * this.resolution;
            this.baseTexture.height = this.height * this.resolution;
            this.baseTexture._glTextures = [];
            this.baseTexture.resolution = this.resolution;
            this.baseTexture.scaleMode = scaleMode || PIXI.scaleModes.DEFAULT;
            this.baseTexture.hasLoaded = true;
            PIXI.Texture.call(this, this.baseTexture, new PIXI.Rectangle(0, 0, this.width, this.height));
            this.renderer = renderer || PIXI.defaultRenderer;
            if (this.renderer.type === PIXI.WEBGL_RENDERER) {
                var gl = this.renderer.gl;
                this.baseTexture._dirty[gl.id] = false;
                this.textureBuffer = new PIXI.FilterTexture(gl, this.width * this.resolution, this.height * this.resolution, this.baseTexture.scaleMode);
                this.baseTexture._glTextures[gl.id] = this.textureBuffer.texture;
                this.render = this.renderWebGL;
                this.projection = new PIXI.Point(this.width * .5, -this.height * .5)
            } else {
                this.render = this.renderCanvas;
                this.textureBuffer = new PIXI.CanvasBuffer(this.width * this.resolution, this.height * this.resolution);
                this.baseTexture.source = this.textureBuffer.canvas
            }
            this.valid = true;
            this._updateUvs()
        }
        ;
        PIXI.RenderTexture.prototype = Object.create(PIXI.Texture.prototype);
        PIXI.RenderTexture.prototype.constructor = PIXI.RenderTexture;
        PIXI.RenderTexture.prototype.resize = function (width, height, updateBase) {
            if (width === this.width && height === this.height)
                return;
            this.valid = width > 0 && height > 0;
            this.width = this.frame.width = this.crop.width = width;
            this.height = this.frame.height = this.crop.height = height;
            if (updateBase) {
                this.baseTexture.width = this.width;
                this.baseTexture.height = this.height
            }
            if (this.renderer.type === PIXI.WEBGL_RENDERER) {
                this.projection.x = this.width / 2;
                this.projection.y = -this.height / 2
            }
            if (!this.valid)
                return;
            this.textureBuffer.resize(this.width * this.resolution, this.height * this.resolution)
        }
        ;
        PIXI.RenderTexture.prototype.clear = function () {
            if (!this.valid)
                return;
            if (this.renderer.type === PIXI.WEBGL_RENDERER) {
                this.renderer.gl.bindFramebuffer(this.renderer.gl.FRAMEBUFFER, this.textureBuffer.frameBuffer)
            }
            this.textureBuffer.clear()
        }
        ;
        PIXI.RenderTexture.prototype.renderWebGL = function (displayObject, matrix, clear) {
            if (!this.valid)
                return;
            var wt = displayObject.worldTransform;
            wt.identity();
            wt.translate(0, this.projection.y * 2);
            if (matrix)
                wt.append(matrix);
            wt.scale(1, -1);
            displayObject.worldAlpha = 1;
            var children = displayObject.children;
            for (var i = 0, j = children.length; i < j; i++) {
                children[i].updateTransform()
            }
            var gl = this.renderer.gl;
            gl.viewport(0, 0, this.width * this.resolution, this.height * this.resolution);
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.textureBuffer.frameBuffer);
            if (clear)
                this.textureBuffer.clear();
            this.renderer.spriteBatch.dirty = true;
            this.renderer.renderDisplayObject(displayObject, this.projection, this.textureBuffer.frameBuffer);
            this.renderer.spriteBatch.dirty = true
        }
        ;
        PIXI.RenderTexture.prototype.renderCanvas = function (displayObject, matrix, clear) {
            if (!this.valid)
                return;
            var wt = displayObject.worldTransform;
            wt.identity();
            if (matrix)
                wt.append(matrix);
            displayObject.worldAlpha = 1;
            var children = displayObject.children;
            for (var i = 0, j = children.length; i < j; i++) {
                children[i].updateTransform()
            }
            if (clear)
                this.textureBuffer.clear();
            var context = this.textureBuffer.context;
            var realResolution = this.renderer.resolution;
            this.renderer.resolution = this.resolution;
            this.renderer.renderDisplayObject(displayObject, context);
            this.renderer.resolution = realResolution
        }
        ;
        PIXI.RenderTexture.prototype.getImage = function () {
            var image = new Image;
            image.src = this.getBase64();
            return image
        }
        ;
        PIXI.RenderTexture.prototype.getBase64 = function () {
            return this.getCanvas().toDataURL()
        }
        ;
        PIXI.RenderTexture.prototype.getCanvas = function () {
            if (this.renderer.type === PIXI.WEBGL_RENDERER) {
                var gl = this.renderer.gl;
                var width = this.textureBuffer.width;
                var height = this.textureBuffer.height;
                var webGLPixels = new Uint8Array(4 * width * height);
                gl.bindFramebuffer(gl.FRAMEBUFFER, this.textureBuffer.frameBuffer);
                gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, webGLPixels);
                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                var tempCanvas = new PIXI.CanvasBuffer(width, height);
                var canvasData = tempCanvas.context.getImageData(0, 0, width, height);
                canvasData.data.set(webGLPixels);
                tempCanvas.context.putImageData(canvasData, 0, 0);
                return tempCanvas.canvas
            } else {
                return this.textureBuffer.canvas
            }
        }
        ;
        PIXI.RenderTexture.tempMatrix = new PIXI.Matrix;
        PIXI.VideoTexture = function (source, scaleMode) {
            if (!source) {
                throw new Error("No video source element specified.")
            }
            if ((source.readyState === source.HAVE_ENOUGH_DATA || source.readyState === source.HAVE_FUTURE_DATA) && source.width && source.height) {
                source.complete = true
            }
            PIXI.BaseTexture.call(this, source, scaleMode);
            this.autoUpdate = false;
            this.updateBound = this._onUpdate.bind(this);
            if (!source.complete) {
                this._onCanPlay = this.onCanPlay.bind(this);
                source.addEventListener("canplay", this._onCanPlay);
                source.addEventListener("canplaythrough", this._onCanPlay);
                source.addEventListener("play", this.onPlayStart.bind(this));
                source.addEventListener("pause", this.onPlayStop.bind(this))
            }
        }
        ;
        PIXI.VideoTexture.prototype = Object.create(PIXI.BaseTexture.prototype);
        PIXI.VideoTexture.constructor = PIXI.VideoTexture;
        PIXI.VideoTexture.prototype._onUpdate = function () {
            if (this.autoUpdate) {
                window.requestAnimationFrame(this.updateBound);
                this.dirty()
            }
        }
        ;
        PIXI.VideoTexture.prototype.onPlayStart = function () {
            if (!this.autoUpdate) {
                window.requestAnimationFrame(this.updateBound);
                this.autoUpdate = true
            }
        }
        ;
        PIXI.VideoTexture.prototype.onPlayStop = function () {
            this.autoUpdate = false
        }
        ;
        PIXI.VideoTexture.prototype.onCanPlay = function () {
            if (event.type === "canplaythrough") {
                this.hasLoaded = true;
                if (this.source) {
                    this.source.removeEventListener("canplay", this._onCanPlay);
                    this.source.removeEventListener("canplaythrough", this._onCanPlay);
                    this.width = this.source.videoWidth;
                    this.height = this.source.videoHeight;
                    if (!this.__loaded) {
                        this.__loaded = true;
                        this.dispatchEvent({
                            type: "loaded",
                            content: this
                        })
                    }
                }
            }
        }
        ;
        PIXI.VideoTexture.prototype.destroy = function () {
            if (this.source && this.source._pixiId) {
                PIXI.BaseTextureCache[this.source._pixiId] = null;
                delete PIXI.BaseTextureCache[this.source._pixiId];
                this.source._pixiId = null;
                delete this.source._pixiId
            }
            PIXI.BaseTexture.prototype.destroy.call(this)
        }
        ;
        PIXI.VideoTexture.baseTextureFromVideo = function (video, scaleMode) {
            if (!video._pixiId) {
                video._pixiId = "video_" + PIXI.TextureCacheIdGenerator++
            }
            var baseTexture = PIXI.BaseTextureCache[video._pixiId];
            if (!baseTexture) {
                baseTexture = new PIXI.VideoTexture(video, scaleMode);
                PIXI.BaseTextureCache[video._pixiId] = baseTexture
            }
            return baseTexture
        }
        ;
        PIXI.VideoTexture.textureFromVideo = function (video, scaleMode) {
            var baseTexture = PIXI.VideoTexture.baseTextureFromVideo(video, scaleMode);
            return new PIXI.Texture(baseTexture)
        }
        ;
        PIXI.VideoTexture.fromUrl = function (videoSrc, scaleMode) {
            var video = document.createElement("video");
            video.src = videoSrc;
            video.autoPlay = true;
            video.play();
            return PIXI.VideoTexture.textureFromVideo(video, scaleMode)
        }
        ;
        PIXI.AssetLoader = function (assetURLs, crossorigin) {
            this.assetURLs = assetURLs;
            this.crossorigin = crossorigin;
            this.loadersByType = {
                jpg: PIXI.ImageLoader,
                jpeg: PIXI.ImageLoader,
                png: PIXI.ImageLoader,
                gif: PIXI.ImageLoader,
                webp: PIXI.ImageLoader,
                json: PIXI.JsonLoader,
                atlas: PIXI.AtlasLoader,
                anim: PIXI.SpineLoader,
                xml: PIXI.BitmapFontLoader,
                fnt: PIXI.BitmapFontLoader
            }
        }
        ;
        PIXI.EventTarget.mixin(PIXI.AssetLoader.prototype);
        PIXI.AssetLoader.prototype.constructor = PIXI.AssetLoader;
        PIXI.AssetLoader.prototype._getDataType = function (str) {
            var test = "data:";
            var start = str.slice(0, test.length).toLowerCase();
            if (start === test) {
                var data = str.slice(test.length);
                var sepIdx = data.indexOf(",");
                if (sepIdx === -1)
                    return null;
                var info = data.slice(0, sepIdx).split(";")[0];
                if (!info || info.toLowerCase() === "text/plain")
                    return "txt";
                return info.split("/").pop().toLowerCase()
            }
            return null
        }
        ;
        PIXI.AssetLoader.prototype.load = function () {
            var scope = this;

            function onLoad(evt) {
                scope.onAssetLoaded(evt.data.content)
            }

            this.loadCount = this.assetURLs.length;
            for (var i = 0; i < this.assetURLs.length; i++) {
                var fileName = this.assetURLs[i];
                var fileType = this._getDataType(fileName);
                if (!fileType)
                    fileType = fileName.split("?").shift().split(".").pop().toLowerCase();
                var Constructor = this.loadersByType[fileType];
                if (!Constructor)
                    throw new Error(fileType + " is an unsupported file type");
                var loader = new Constructor(fileName, this.crossorigin);
                loader.on("loaded", onLoad);
                loader.load()
            }
        }
        ;
        PIXI.AssetLoader.prototype.onAssetLoaded = function (loader) {
            this.loadCount--;
            this.emit("onProgress", {
                content: this,
                loader: loader
            });
            if (this.onProgress)
                this.onProgress(loader);
            if (!this.loadCount) {
                this.emit("onComplete", {
                    content: this
                });
                if (this.onComplete)
                    this.onComplete()
            }
        }
        ;
        PIXI.JsonLoader = function (url, crossorigin) {
            this.url = url;
            this.crossorigin = crossorigin;
            this.baseUrl = url.replace(/[^\/]*$/, "");
            this.loaded = false
        }
        ;
        PIXI.JsonLoader.prototype.constructor = PIXI.JsonLoader;
        PIXI.EventTarget.mixin(PIXI.JsonLoader.prototype);
        PIXI.JsonLoader.prototype.load = function () {
            if (window.XDomainRequest && this.crossorigin) {
                this.ajaxRequest = new window.XDomainRequest;
                this.ajaxRequest.timeout = 3e3;
                this.ajaxRequest.onerror = this.onError.bind(this);
                this.ajaxRequest.ontimeout = this.onError.bind(this);
                this.ajaxRequest.onprogress = function () {
                }
                ;
                this.ajaxRequest.onload = this.onJSONLoaded.bind(this)
            } else {
                if (window.XMLHttpRequest) {
                    this.ajaxRequest = new window.XMLHttpRequest
                } else {
                    this.ajaxRequest = new window.ActiveXObject("Microsoft.XMLHTTP")
                }
                this.ajaxRequest.onreadystatechange = this.onReadyStateChanged.bind(this)
            }
            this.ajaxRequest.open("GET", this.url, true);
            this.ajaxRequest.send()
        }
        ;
        PIXI.JsonLoader.prototype.onReadyStateChanged = function () {
            if (this.ajaxRequest.readyState === 4 && (this.ajaxRequest.status === 200 || window.location.href.indexOf("http") === -1)) {
                this.onJSONLoaded()
            }
        }
        ;
        PIXI.JsonLoader.prototype.onJSONLoaded = function () {
            if (!this.ajaxRequest.responseText) {
                this.onError();
                return
            }
            this.json = JSON.parse(this.ajaxRequest.responseText);
            if (this.json.frames && this.json.meta && this.json.meta.image) {
                var textureUrl = this.baseUrl + this.json.meta.image;
                var image = new PIXI.ImageLoader(textureUrl, this.crossorigin);
                var frameData = this.json.frames;
                this.texture = image.texture.baseTexture;
                image.addEventListener("loaded", this.onLoaded.bind(this));
                for (var i in frameData) {
                    var rect = frameData[i].frame;
                    if (rect) {
                        var textureSize = new PIXI.Rectangle(rect.x, rect.y, rect.w, rect.h);
                        var crop = textureSize.clone();
                        var trim = null;
                        if (frameData[i].trimmed) {
                            var actualSize = frameData[i].sourceSize;
                            var realSize = frameData[i].spriteSourceSize;
                            trim = new PIXI.Rectangle(realSize.x, realSize.y, actualSize.w, actualSize.h)
                        }
                        PIXI.TextureCache[i] = new PIXI.Texture(this.texture, textureSize, crop, trim)
                    }
                }
                image.load()
            } else if (this.json.bones) {
                if (PIXI.AnimCache[this.url]) {
                    this.onLoaded()
                } else {
                    var atlasPath = this.url.substr(0, this.url.lastIndexOf(".")) + ".atlas";
                    var atlasLoader = new PIXI.JsonLoader(atlasPath, this.crossorigin);
                    var originalLoader = this;
                    atlasLoader.onJSONLoaded = function () {
                        if (!this.ajaxRequest.responseText) {
                            this.onError();
                            return
                        }
                        var textureLoader = new PIXI.SpineTextureLoader(this.url.substring(0, this.url.lastIndexOf("/")));
                        var spineAtlas = new spine.Atlas(this.ajaxRequest.responseText, textureLoader);
                        var attachmentLoader = new spine.AtlasAttachmentLoader(spineAtlas);
                        var spineJsonParser = new spine.SkeletonJson(attachmentLoader);
                        var skeletonData = spineJsonParser.readSkeletonData(originalLoader.json);
                        PIXI.AnimCache[originalLoader.url] = skeletonData;
                        originalLoader.spine = skeletonData;
                        originalLoader.spineAtlas = spineAtlas;
                        originalLoader.spineAtlasLoader = atlasLoader;
                        if (textureLoader.loadingCount > 0) {
                            textureLoader.addEventListener("loadedBaseTexture", function (evt) {
                                if (evt.content.content.loadingCount <= 0) {
                                    originalLoader.onLoaded()
                                }
                            })
                        } else {
                            originalLoader.onLoaded()
                        }
                    }
                    ;
                    atlasLoader.load()
                }
            } else {
                this.onLoaded()
            }
        }
        ;
        PIXI.JsonLoader.prototype.onLoaded = function () {
            this.loaded = true;
            this.dispatchEvent({
                type: "loaded",
                content: this
            })
        }
        ;
        PIXI.JsonLoader.prototype.onError = function () {
            this.dispatchEvent({
                type: "error",
                content: this
            })
        }
        ;
        PIXI.AtlasLoader = function (url, crossorigin) {
            this.url = url;
            this.baseUrl = url.replace(/[^\/]*$/, "");
            this.crossorigin = crossorigin;
            this.loaded = false
        }
        ;
        PIXI.AtlasLoader.constructor = PIXI.AtlasLoader;
        PIXI.EventTarget.mixin(PIXI.AtlasLoader.prototype);
        PIXI.AtlasLoader.prototype.load = function () {
            this.ajaxRequest = new PIXI.AjaxRequest;
            this.ajaxRequest.onreadystatechange = this.onAtlasLoaded.bind(this);
            this.ajaxRequest.open("GET", this.url, true);
            if (this.ajaxRequest.overrideMimeType)
                this.ajaxRequest.overrideMimeType("application/json");
            this.ajaxRequest.send(null)
        }
        ;
        PIXI.AtlasLoader.prototype.onAtlasLoaded = function () {
            if (this.ajaxRequest.readyState === 4) {
                if (this.ajaxRequest.status === 200 || window.location.href.indexOf("http") === -1) {
                    this.atlas = {
                        meta: {
                            image: []
                        },
                        frames: []
                    };
                    var result = this.ajaxRequest.responseText.split(/\r?\n/);
                    var lineCount = -3;
                    var currentImageId = 0;
                    var currentFrame = null;
                    var nameInNextLine = false;
                    var i = 0
                        , j = 0
                        , selfOnLoaded = this.onLoaded.bind(this);
                    for (i = 0; i < result.length; i++) {
                        result[i] = result[i].replace(/^\s+|\s+$/g, "");
                        if (result[i] === "") {
                            nameInNextLine = i + 1
                        }
                        if (result[i].length > 0) {
                            if (nameInNextLine === i) {
                                this.atlas.meta.image.push(result[i]);
                                currentImageId = this.atlas.meta.image.length - 1;
                                this.atlas.frames.push({});
                                lineCount = -3
                            } else if (lineCount > 0) {
                                if (lineCount % 7 === 1) {
                                    if (currentFrame != null) {
                                        this.atlas.frames[currentImageId][currentFrame.name] = currentFrame
                                    }
                                    currentFrame = {
                                        name: result[i],
                                        frame: {}
                                    }
                                } else {
                                    var text = result[i].split(" ");
                                    if (lineCount % 7 === 3) {
                                        currentFrame.frame.x = Number(text[1].replace(",", ""));
                                        currentFrame.frame.y = Number(text[2])
                                    } else if (lineCount % 7 === 4) {
                                        currentFrame.frame.w = Number(text[1].replace(",", ""));
                                        currentFrame.frame.h = Number(text[2])
                                    } else if (lineCount % 7 === 5) {
                                        var realSize = {
                                            x: 0,
                                            y: 0,
                                            w: Number(text[1].replace(",", "")),
                                            h: Number(text[2])
                                        };
                                        if (realSize.w > currentFrame.frame.w || realSize.h > currentFrame.frame.h) {
                                            currentFrame.trimmed = true;
                                            currentFrame.realSize = realSize
                                        } else {
                                            currentFrame.trimmed = false
                                        }
                                    }
                                }
                            }
                            lineCount++
                        }
                    }
                    if (currentFrame != null) {
                        this.atlas.frames[currentImageId][currentFrame.name] = currentFrame
                    }
                    if (this.atlas.meta.image.length > 0) {
                        this.images = [];
                        for (j = 0; j < this.atlas.meta.image.length; j++) {
                            var textureUrl = this.baseUrl + this.atlas.meta.image[j];
                            var frameData = this.atlas.frames[j];
                            this.images.push(new PIXI.ImageLoader(textureUrl, this.crossorigin));
                            for (i in frameData) {
                                var rect = frameData[i].frame;
                                if (rect) {
                                    PIXI.TextureCache[i] = new PIXI.Texture(this.images[j].texture.baseTexture, {
                                        x: rect.x,
                                        y: rect.y,
                                        width: rect.w,
                                        height: rect.h
                                    });
                                    if (frameData[i].trimmed) {
                                        PIXI.TextureCache[i].realSize = frameData[i].realSize;
                                        PIXI.TextureCache[i].trim.x = 0;
                                        PIXI.TextureCache[i].trim.y = 0
                                    }
                                }
                            }
                        }
                        this.currentImageId = 0;
                        for (j = 0; j < this.images.length; j++) {
                            this.images[j].on("loaded", selfOnLoaded)
                        }
                        this.images[this.currentImageId].load()
                    } else {
                        this.onLoaded()
                    }
                } else {
                    this.onError()
                }
            }
        }
        ;
        PIXI.AtlasLoader.prototype.onLoaded = function () {
            if (this.images.length - 1 > this.currentImageId) {
                this.currentImageId++;
                this.images[this.currentImageId].load()
            } else {
                this.loaded = true;
                this.emit("loaded", {
                    content: this
                })
            }
        }
        ;
        PIXI.AtlasLoader.prototype.onError = function () {
            this.emit("error", {
                content: this
            })
        }
        ;
        PIXI.SpriteSheetLoader = function (url, crossorigin) {
            this.url = url;
            this.crossorigin = crossorigin;
            this.baseUrl = url.replace(/[^\/]*$/, "");
            this.texture = null;
            this.frames = {}
        }
        ;
        PIXI.SpriteSheetLoader.prototype.constructor = PIXI.SpriteSheetLoader;
        PIXI.EventTarget.mixin(PIXI.SpriteSheetLoader.prototype);
        PIXI.SpriteSheetLoader.prototype.load = function () {
            var scope = this;
            var jsonLoader = new PIXI.JsonLoader(this.url, this.crossorigin);
            jsonLoader.on("loaded", function (event) {
                scope.json = event.data.content.json;
                scope.onLoaded()
            });
            jsonLoader.load()
        }
        ;
        PIXI.SpriteSheetLoader.prototype.onLoaded = function () {
            this.emit("loaded", {
                content: this
            })
        }
        ;
        PIXI.ImageLoader = function (url, crossorigin) {
            this.texture = PIXI.Texture.fromImage(url, crossorigin);
            this.frames = []
        }
        ;
        PIXI.ImageLoader.prototype.constructor = PIXI.ImageLoader;
        PIXI.EventTarget.mixin(PIXI.ImageLoader.prototype);
        PIXI.ImageLoader.prototype.load = function () {
            if (!this.texture.baseTexture.hasLoaded) {
                this.texture.baseTexture.on("loaded", this.onLoaded.bind(this))
            } else {
                this.onLoaded()
            }
        }
        ;
        PIXI.ImageLoader.prototype.onLoaded = function () {
            this.emit("loaded", {
                content: this
            })
        }
        ;
        PIXI.ImageLoader.prototype.loadFramedSpriteSheet = function (frameWidth, frameHeight, textureName) {
            this.frames = [];
            var cols = Math.floor(this.texture.width / frameWidth);
            var rows = Math.floor(this.texture.height / frameHeight);
            var i = 0;
            for (var y = 0; y < rows; y++) {
                for (var x = 0; x < cols; x++,
                    i++) {
                    var texture = new PIXI.Texture(this.texture.baseTexture, {
                        x: x * frameWidth,
                        y: y * frameHeight,
                        width: frameWidth,
                        height: frameHeight
                    });
                    this.frames.push(texture);
                    if (textureName)
                        PIXI.TextureCache[textureName + "-" + i] = texture
                }
            }
            this.load()
        }
        ;
        PIXI.BitmapFontLoader = function (url, crossorigin) {
            this.url = url;
            this.crossorigin = crossorigin;
            this.baseUrl = url.replace(/[^\/]*$/, "");
            this.texture = null
        }
        ;
        PIXI.BitmapFontLoader.prototype.constructor = PIXI.BitmapFontLoader;
        PIXI.EventTarget.mixin(PIXI.BitmapFontLoader.prototype);
        PIXI.BitmapFontLoader.prototype.load = function () {
            this.ajaxRequest = new PIXI.AjaxRequest;
            this.ajaxRequest.onreadystatechange = this.onXMLLoaded.bind(this);
            this.ajaxRequest.open("GET", this.url, true);
            if (this.ajaxRequest.overrideMimeType)
                this.ajaxRequest.overrideMimeType("application/xml");
            this.ajaxRequest.send(null)
        }
        ;
        PIXI.BitmapFontLoader.prototype.onXMLLoaded = function () {
            if (this.ajaxRequest.readyState === 4) {
                if (this.ajaxRequest.status === 200 || window.location.protocol.indexOf("http") === -1) {
                    var responseXML = this.ajaxRequest.responseXML;
                    if (!responseXML || /MSIE 9/i.test(navigator.userAgent) || navigator.isCocoonJS) {
                        if (typeof window.DOMParser === "function") {
                            var domparser = new DOMParser;
                            responseXML = domparser.parseFromString(this.ajaxRequest.responseText, "text/xml")
                        } else {
                            var div = document.createElement("div");
                            div.innerHTML = this.ajaxRequest.responseText;
                            responseXML = div
                        }
                    }
                    var textureUrl = this.baseUrl + responseXML.getElementsByTagName("page")[0].getAttribute("file");
                    var image = new PIXI.ImageLoader(textureUrl, this.crossorigin);
                    this.texture = image.texture.baseTexture;
                    var data = {};
                    var info = responseXML.getElementsByTagName("info")[0];
                    var common = responseXML.getElementsByTagName("common")[0];
                    data.font = info.getAttribute("face");
                    data.size = parseInt(info.getAttribute("size"), 10);
                    data.lineHeight = parseInt(common.getAttribute("lineHeight"), 10);
                    data.chars = {};
                    var letters = responseXML.getElementsByTagName("char");
                    for (var i = 0; i < letters.length; i++) {
                        var charCode = parseInt(letters[i].getAttribute("id"), 10);
                        var textureRect = new PIXI.Rectangle(parseInt(letters[i].getAttribute("x"), 10), parseInt(letters[i].getAttribute("y"), 10), parseInt(letters[i].getAttribute("width"), 10), parseInt(letters[i].getAttribute("height"), 10));
                        data.chars[charCode] = {
                            xOffset: parseInt(letters[i].getAttribute("xoffset"), 10),
                            yOffset: parseInt(letters[i].getAttribute("yoffset"), 10),
                            xAdvance: parseInt(letters[i].getAttribute("xadvance"), 10),
                            kerning: {},
                            texture: PIXI.TextureCache[charCode] = new PIXI.Texture(this.texture, textureRect)
                        }
                    }
                    var kernings = responseXML.getElementsByTagName("kerning");
                    for (i = 0; i < kernings.length; i++) {
                        var first = parseInt(kernings[i].getAttribute("first"), 10);
                        var second = parseInt(kernings[i].getAttribute("second"), 10);
                        var amount = parseInt(kernings[i].getAttribute("amount"), 10);
                        data.chars[second].kerning[first] = amount
                    }
                    PIXI.BitmapText.fonts[data.font] = data;
                    image.addEventListener("loaded", this.onLoaded.bind(this));
                    image.load()
                }
            }
        }
        ;
        PIXI.BitmapFontLoader.prototype.onLoaded = function () {
            this.emit("loaded", {
                content: this
            })
        }
        ;
        PIXI.SpineLoader = function (url, crossorigin) {
            this.url = url;
            this.crossorigin = crossorigin;
            this.loaded = false
        }
        ;
        PIXI.SpineLoader.prototype.constructor = PIXI.SpineLoader;
        PIXI.EventTarget.mixin(PIXI.SpineLoader.prototype);
        PIXI.SpineLoader.prototype.load = function () {
            var scope = this;
            var jsonLoader = new PIXI.JsonLoader(this.url, this.crossorigin);
            jsonLoader.on("loaded", function (event) {
                scope.json = event.data.content.json;
                scope.onLoaded()
            });
            jsonLoader.load()
        }
        ;
        PIXI.SpineLoader.prototype.onLoaded = function () {
            this.loaded = true;
            this.emit("loaded", {
                content: this
            })
        }
        ;
        PIXI.AbstractFilter = function (fragmentSrc, uniforms) {
            this.passes = [this];
            this.shaders = [];
            this.dirty = true;
            this.padding = 0;
            this.uniforms = uniforms || {};
            this.fragmentSrc = fragmentSrc || []
        }
        ;
        PIXI.AbstractFilter.prototype.constructor = PIXI.AbstractFilter;
        PIXI.AbstractFilter.prototype.syncUniforms = function () {
            for (var i = 0, j = this.shaders.length; i < j; i++) {
                this.shaders[i].dirty = true
            }
        }
        ;
        PIXI.AlphaMaskFilter = function (texture) {
            PIXI.AbstractFilter.call(this);
            this.passes = [this];
            texture.baseTexture._powerOf2 = true;
            this.uniforms = {
                mask: {
                    type: "sampler2D",
                    value: texture
                },
                mapDimensions: {
                    type: "2f",
                    value: {
                        x: 1,
                        y: 5112
                    }
                },
                dimensions: {
                    type: "4fv",
                    value: [0, 0, 0, 0]
                }
            };
            if (texture.baseTexture.hasLoaded) {
                this.uniforms.mask.value.x = texture.width;
                this.uniforms.mask.value.y = texture.height
            } else {
                this.boundLoadedFunction = this.onTextureLoaded.bind(this);
                texture.baseTexture.on("loaded", this.boundLoadedFunction)
            }
            this.fragmentSrc = ["precision mediump float;", "varying vec2 vTextureCoord;", "varying vec4 vColor;", "uniform sampler2D mask;", "uniform sampler2D uSampler;", "uniform vec2 offset;", "uniform vec4 dimensions;", "uniform vec2 mapDimensions;", "void main(void) {", "   vec2 mapCords = vTextureCoord.xy;", "   mapCords += (dimensions.zw + offset)/ dimensions.xy ;", "   mapCords.y *= -1.0;", "   mapCords.y += 1.0;", "   mapCords *= dimensions.xy / mapDimensions;", "   vec4 original =  texture2D(uSampler, vTextureCoord);", "   float maskAlpha =  texture2D(mask, mapCords).r;", "   original *= maskAlpha;", "   gl_FragColor =  original;", "}"]
        }
        ;
        PIXI.AlphaMaskFilter.prototype = Object.create(PIXI.AbstractFilter.prototype);
        PIXI.AlphaMaskFilter.prototype.constructor = PIXI.AlphaMaskFilter;
        PIXI.AlphaMaskFilter.prototype.onTextureLoaded = function () {
            this.uniforms.mapDimensions.value.x = this.uniforms.mask.value.width;
            this.uniforms.mapDimensions.value.y = this.uniforms.mask.value.height;
            this.uniforms.mask.value.baseTexture.off("loaded", this.boundLoadedFunction)
        }
        ;
        Object.defineProperty(PIXI.AlphaMaskFilter.prototype, "map", {
            get: function () {
                return this.uniforms.mask.value
            },
            set: function (value) {
                this.uniforms.mask.value = value
            }
        });
        PIXI.ColorMatrixFilter = function () {
            PIXI.AbstractFilter.call(this);
            this.passes = [this];
            this.uniforms = {
                matrix: {
                    type: "mat4",
                    value: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
                }
            };
            this.fragmentSrc = ["precision mediump float;", "varying vec2 vTextureCoord;", "varying vec4 vColor;", "uniform float invert;", "uniform mat4 matrix;", "uniform sampler2D uSampler;", "void main(void) {", "   gl_FragColor = texture2D(uSampler, vTextureCoord) * matrix;", "}"]
        }
        ;
        PIXI.ColorMatrixFilter.prototype = Object.create(PIXI.AbstractFilter.prototype);
        PIXI.ColorMatrixFilter.prototype.constructor = PIXI.ColorMatrixFilter;
        Object.defineProperty(PIXI.ColorMatrixFilter.prototype, "matrix", {
            get: function () {
                return this.uniforms.matrix.value
            },
            set: function (value) {
                this.uniforms.matrix.value = value
            }
        });
        PIXI.GrayFilter = function () {
            PIXI.AbstractFilter.call(this);
            this.passes = [this];
            this.uniforms = {
                gray: {
                    type: "1f",
                    value: 1
                }
            };
            this.fragmentSrc = ["precision mediump float;", "varying vec2 vTextureCoord;", "varying vec4 vColor;", "uniform sampler2D uSampler;", "uniform float gray;", "void main(void) {", "   gl_FragColor = texture2D(uSampler, vTextureCoord);", "   gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.2126*gl_FragColor.r + 0.7152*gl_FragColor.g + 0.0722*gl_FragColor.b), gray);", "}"]
        }
        ;
        PIXI.GrayFilter.prototype = Object.create(PIXI.AbstractFilter.prototype);
        PIXI.GrayFilter.prototype.constructor = PIXI.GrayFilter;
        Object.defineProperty(PIXI.GrayFilter.prototype, "gray", {
            get: function () {
                return this.uniforms.gray.value
            },
            set: function (value) {
                this.uniforms.gray.value = value
            }
        });
        PIXI.DisplacementFilter = function (texture) {
            PIXI.AbstractFilter.call(this);
            this.passes = [this];
            texture.baseTexture._powerOf2 = true;
            this.uniforms = {
                displacementMap: {
                    type: "sampler2D",
                    value: texture
                },
                scale: {
                    type: "2f",
                    value: {
                        x: 30,
                        y: 30
                    }
                },
                offset: {
                    type: "2f",
                    value: {
                        x: 0,
                        y: 0
                    }
                },
                mapDimensions: {
                    type: "2f",
                    value: {
                        x: 1,
                        y: 5112
                    }
                },
                dimensions: {
                    type: "4fv",
                    value: [0, 0, 0, 0]
                }
            };
            if (texture.baseTexture.hasLoaded) {
                this.uniforms.mapDimensions.value.x = texture.width;
                this.uniforms.mapDimensions.value.y = texture.height
            } else {
                this.boundLoadedFunction = this.onTextureLoaded.bind(this);
                texture.baseTexture.on("loaded", this.boundLoadedFunction)
            }
            this.fragmentSrc = ["precision mediump float;", "varying vec2 vTextureCoord;", "varying vec4 vColor;", "uniform sampler2D displacementMap;", "uniform sampler2D uSampler;", "uniform vec2 scale;", "uniform vec2 offset;", "uniform vec4 dimensions;", "uniform vec2 mapDimensions;", "void main(void) {", "   vec2 mapCords = vTextureCoord.xy;", "   mapCords += (dimensions.zw + offset)/ dimensions.xy ;", "   mapCords.y *= -1.0;", "   mapCords.y += 1.0;", "   vec2 matSample = texture2D(displacementMap, mapCords).xy;", "   matSample -= 0.5;", "   matSample *= scale;", "   matSample /= mapDimensions;", "   gl_FragColor = texture2D(uSampler, vec2(vTextureCoord.x + matSample.x, vTextureCoord.y + matSample.y));", "   gl_FragColor.rgb = mix( gl_FragColor.rgb, gl_FragColor.rgb, 1.0);", "   vec2 cord = vTextureCoord;", "}"]
        }
        ;
        PIXI.DisplacementFilter.prototype = Object.create(PIXI.AbstractFilter.prototype);
        PIXI.DisplacementFilter.prototype.constructor = PIXI.DisplacementFilter;
        PIXI.DisplacementFilter.prototype.onTextureLoaded = function () {
            this.uniforms.mapDimensions.value.x = this.uniforms.displacementMap.value.width;
            this.uniforms.mapDimensions.value.y = this.uniforms.displacementMap.value.height;
            this.uniforms.displacementMap.value.baseTexture.off("loaded", this.boundLoadedFunction)
        }
        ;
        Object.defineProperty(PIXI.DisplacementFilter.prototype, "map", {
            get: function () {
                return this.uniforms.displacementMap.value
            },
            set: function (value) {
                this.uniforms.displacementMap.value = value
            }
        });
        Object.defineProperty(PIXI.DisplacementFilter.prototype, "scale", {
            get: function () {
                return this.uniforms.scale.value
            },
            set: function (value) {
                this.uniforms.scale.value = value
            }
        });
        Object.defineProperty(PIXI.DisplacementFilter.prototype, "offset", {
            get: function () {
                return this.uniforms.offset.value
            },
            set: function (value) {
                this.uniforms.offset.value = value
            }
        });
        PIXI.PixelateFilter = function () {
            PIXI.AbstractFilter.call(this);
            this.passes = [this];
            this.uniforms = {
                invert: {
                    type: "1f",
                    value: 0
                },
                dimensions: {
                    type: "4fv",
                    value: new PIXI.Float32Array([1e4, 100, 10, 10])
                },
                pixelSize: {
                    type: "2f",
                    value: {
                        x: 10,
                        y: 10
                    }
                }
            };
            this.fragmentSrc = ["precision mediump float;", "varying vec2 vTextureCoord;", "varying vec4 vColor;", "uniform vec2 testDim;", "uniform vec4 dimensions;", "uniform vec2 pixelSize;", "uniform sampler2D uSampler;", "void main(void) {", "   vec2 coord = vTextureCoord;", "   vec2 size = dimensions.xy/pixelSize;", "   vec2 color = floor( ( vTextureCoord * size ) ) / size + pixelSize/dimensions.xy * 0.5;", "   gl_FragColor = texture2D(uSampler, color);", "}"]
        }
        ;
        PIXI.PixelateFilter.prototype = Object.create(PIXI.AbstractFilter.prototype);
        PIXI.PixelateFilter.prototype.constructor = PIXI.PixelateFilter;
        Object.defineProperty(PIXI.PixelateFilter.prototype, "size", {
            get: function () {
                return this.uniforms.pixelSize.value
            },
            set: function (value) {
                this.dirty = true;
                this.uniforms.pixelSize.value = value
            }
        });
        PIXI.BlurXFilter = function () {
            PIXI.AbstractFilter.call(this);
            this.passes = [this];
            this.uniforms = {
                blur: {
                    type: "1f",
                    value: 1 / 512
                }
            };
            this.fragmentSrc = ["precision mediump float;", "varying vec2 vTextureCoord;", "varying vec4 vColor;", "uniform float blur;", "uniform sampler2D uSampler;", "void main(void) {", "   vec4 sum = vec4(0.0);", "   sum += texture2D(uSampler, vec2(vTextureCoord.x - 4.0*blur, vTextureCoord.y)) * 0.05;", "   sum += texture2D(uSampler, vec2(vTextureCoord.x - 3.0*blur, vTextureCoord.y)) * 0.09;", "   sum += texture2D(uSampler, vec2(vTextureCoord.x - 2.0*blur, vTextureCoord.y)) * 0.12;", "   sum += texture2D(uSampler, vec2(vTextureCoord.x - blur, vTextureCoord.y)) * 0.15;", "   sum += texture2D(uSampler, vec2(vTextureCoord.x, vTextureCoord.y)) * 0.16;", "   sum += texture2D(uSampler, vec2(vTextureCoord.x + blur, vTextureCoord.y)) * 0.15;", "   sum += texture2D(uSampler, vec2(vTextureCoord.x + 2.0*blur, vTextureCoord.y)) * 0.12;", "   sum += texture2D(uSampler, vec2(vTextureCoord.x + 3.0*blur, vTextureCoord.y)) * 0.09;", "   sum += texture2D(uSampler, vec2(vTextureCoord.x + 4.0*blur, vTextureCoord.y)) * 0.05;", "   gl_FragColor = sum;", "}"]
        }
        ;
        PIXI.BlurXFilter.prototype = Object.create(PIXI.AbstractFilter.prototype);
        PIXI.BlurXFilter.prototype.constructor = PIXI.BlurXFilter;
        Object.defineProperty(PIXI.BlurXFilter.prototype, "blur", {
            get: function () {
                return this.uniforms.blur.value / (1 / 7e3)
            },
            set: function (value) {
                this.dirty = true;
                this.uniforms.blur.value = 1 / 7e3 * value
            }
        });
        PIXI.BlurYFilter = function () {
            PIXI.AbstractFilter.call(this);
            this.passes = [this];
            this.uniforms = {
                blur: {
                    type: "1f",
                    value: 1 / 512
                }
            };
            this.fragmentSrc = ["precision mediump float;", "varying vec2 vTextureCoord;", "varying vec4 vColor;", "uniform float blur;", "uniform sampler2D uSampler;", "void main(void) {", "   vec4 sum = vec4(0.0);", "   sum += texture2D(uSampler, vec2(vTextureCoord.x, vTextureCoord.y - 4.0*blur)) * 0.05;", "   sum += texture2D(uSampler, vec2(vTextureCoord.x, vTextureCoord.y - 3.0*blur)) * 0.09;", "   sum += texture2D(uSampler, vec2(vTextureCoord.x, vTextureCoord.y - 2.0*blur)) * 0.12;", "   sum += texture2D(uSampler, vec2(vTextureCoord.x, vTextureCoord.y - blur)) * 0.15;", "   sum += texture2D(uSampler, vec2(vTextureCoord.x, vTextureCoord.y)) * 0.16;", "   sum += texture2D(uSampler, vec2(vTextureCoord.x, vTextureCoord.y + blur)) * 0.15;", "   sum += texture2D(uSampler, vec2(vTextureCoord.x, vTextureCoord.y + 2.0*blur)) * 0.12;", "   sum += texture2D(uSampler, vec2(vTextureCoord.x, vTextureCoord.y + 3.0*blur)) * 0.09;", "   sum += texture2D(uSampler, vec2(vTextureCoord.x, vTextureCoord.y + 4.0*blur)) * 0.05;", "   gl_FragColor = sum;", "}"]
        }
        ;
        PIXI.BlurYFilter.prototype = Object.create(PIXI.AbstractFilter.prototype);
        PIXI.BlurYFilter.prototype.constructor = PIXI.BlurYFilter;
        Object.defineProperty(PIXI.BlurYFilter.prototype, "blur", {
            get: function () {
                return this.uniforms.blur.value / (1 / 7e3)
            },
            set: function (value) {
                this.uniforms.blur.value = 1 / 7e3 * value
            }
        });
        PIXI.BlurFilter = function () {
            this.blurXFilter = new PIXI.BlurXFilter;
            this.blurYFilter = new PIXI.BlurYFilter;
            this.passes = [this.blurXFilter, this.blurYFilter]
        }
        ;
        PIXI.BlurFilter.prototype = Object.create(PIXI.AbstractFilter.prototype);
        PIXI.BlurFilter.prototype.constructor = PIXI.BlurFilter;
        Object.defineProperty(PIXI.BlurFilter.prototype, "blur", {
            get: function () {
                return this.blurXFilter.blur
            },
            set: function (value) {
                this.blurXFilter.blur = this.blurYFilter.blur = value
            }
        });
        Object.defineProperty(PIXI.BlurFilter.prototype, "blurX", {
            get: function () {
                return this.blurXFilter.blur
            },
            set: function (value) {
                this.blurXFilter.blur = value
            }
        });
        Object.defineProperty(PIXI.BlurFilter.prototype, "blurY", {
            get: function () {
                return this.blurYFilter.blur
            },
            set: function (value) {
                this.blurYFilter.blur = value
            }
        });
        PIXI.InvertFilter = function () {
            PIXI.AbstractFilter.call(this);
            this.passes = [this];
            this.uniforms = {
                invert: {
                    type: "1f",
                    value: 1
                }
            };
            this.fragmentSrc = ["precision mediump float;", "varying vec2 vTextureCoord;", "varying vec4 vColor;", "uniform float invert;", "uniform sampler2D uSampler;", "void main(void) {", "   gl_FragColor = texture2D(uSampler, vTextureCoord);", "   gl_FragColor.rgb = mix( (vec3(1)-gl_FragColor.rgb) * gl_FragColor.a, gl_FragColor.rgb, 1.0 - invert);", "}"]
        }
        ;
        PIXI.InvertFilter.prototype = Object.create(PIXI.AbstractFilter.prototype);
        PIXI.InvertFilter.prototype.constructor = PIXI.InvertFilter;
        Object.defineProperty(PIXI.InvertFilter.prototype, "invert", {
            get: function () {
                return this.uniforms.invert.value
            },
            set: function (value) {
                this.uniforms.invert.value = value
            }
        });
        PIXI.SepiaFilter = function () {
            PIXI.AbstractFilter.call(this);
            this.passes = [this];
            this.uniforms = {
                sepia: {
                    type: "1f",
                    value: 1
                }
            };
            this.fragmentSrc = ["precision mediump float;", "varying vec2 vTextureCoord;", "varying vec4 vColor;", "uniform float sepia;", "uniform sampler2D uSampler;", "const mat3 sepiaMatrix = mat3(0.3588, 0.7044, 0.1368, 0.2990, 0.5870, 0.1140, 0.2392, 0.4696, 0.0912);", "void main(void) {", "   gl_FragColor = texture2D(uSampler, vTextureCoord);", "   gl_FragColor.rgb = mix( gl_FragColor.rgb, gl_FragColor.rgb * sepiaMatrix, sepia);", "}"]
        }
        ;
        PIXI.SepiaFilter.prototype = Object.create(PIXI.AbstractFilter.prototype);
        PIXI.SepiaFilter.prototype.constructor = PIXI.SepiaFilter;
        Object.defineProperty(PIXI.SepiaFilter.prototype, "sepia", {
            get: function () {
                return this.uniforms.sepia.value
            },
            set: function (value) {
                this.uniforms.sepia.value = value
            }
        });
        PIXI.TwistFilter = function () {
            PIXI.AbstractFilter.call(this);
            this.passes = [this];
            this.uniforms = {
                radius: {
                    type: "1f",
                    value: .5
                },
                angle: {
                    type: "1f",
                    value: 5
                },
                offset: {
                    type: "2f",
                    value: {
                        x: .5,
                        y: .5
                    }
                }
            };
            this.fragmentSrc = ["precision mediump float;", "varying vec2 vTextureCoord;", "varying vec4 vColor;", "uniform vec4 dimensions;", "uniform sampler2D uSampler;", "uniform float radius;", "uniform float angle;", "uniform vec2 offset;", "void main(void) {", "   vec2 coord = vTextureCoord - offset;", "   float distance = length(coord);", "   if (distance < radius) {", "       float ratio = (radius - distance) / radius;", "       float angleMod = ratio * ratio * angle;", "       float s = sin(angleMod);", "       float c = cos(angleMod);", "       coord = vec2(coord.x * c - coord.y * s, coord.x * s + coord.y * c);", "   }", "   gl_FragColor = texture2D(uSampler, coord+offset);", "}"]
        }
        ;
        PIXI.TwistFilter.prototype = Object.create(PIXI.AbstractFilter.prototype);
        PIXI.TwistFilter.prototype.constructor = PIXI.TwistFilter;
        Object.defineProperty(PIXI.TwistFilter.prototype, "offset", {
            get: function () {
                return this.uniforms.offset.value
            },
            set: function (value) {
                this.dirty = true;
                this.uniforms.offset.value = value
            }
        });
        Object.defineProperty(PIXI.TwistFilter.prototype, "radius", {
            get: function () {
                return this.uniforms.radius.value
            },
            set: function (value) {
                this.dirty = true;
                this.uniforms.radius.value = value
            }
        });
        Object.defineProperty(PIXI.TwistFilter.prototype, "angle", {
            get: function () {
                return this.uniforms.angle.value
            },
            set: function (value) {
                this.dirty = true;
                this.uniforms.angle.value = value
            }
        });
        PIXI.ColorStepFilter = function () {
            PIXI.AbstractFilter.call(this);
            this.passes = [this];
            this.uniforms = {
                step: {
                    type: "1f",
                    value: 5
                }
            };
            this.fragmentSrc = ["precision mediump float;", "varying vec2 vTextureCoord;", "varying vec4 vColor;", "uniform sampler2D uSampler;", "uniform float step;", "void main(void) {", "   vec4 color = texture2D(uSampler, vTextureCoord);", "   color = floor(color * step) / step;", "   gl_FragColor = color;", "}"]
        }
        ;
        PIXI.ColorStepFilter.prototype = Object.create(PIXI.AbstractFilter.prototype);
        PIXI.ColorStepFilter.prototype.constructor = PIXI.ColorStepFilter;
        Object.defineProperty(PIXI.ColorStepFilter.prototype, "step", {
            get: function () {
                return this.uniforms.step.value
            },
            set: function (value) {
                this.uniforms.step.value = value
            }
        });
        PIXI.DotScreenFilter = function () {
            PIXI.AbstractFilter.call(this);
            this.passes = [this];
            this.uniforms = {
                scale: {
                    type: "1f",
                    value: 1
                },
                angle: {
                    type: "1f",
                    value: 5
                },
                dimensions: {
                    type: "4fv",
                    value: [0, 0, 0, 0]
                }
            };
            this.fragmentSrc = ["precision mediump float;", "varying vec2 vTextureCoord;", "varying vec4 vColor;", "uniform vec4 dimensions;", "uniform sampler2D uSampler;", "uniform float angle;", "uniform float scale;", "float pattern() {", "   float s = sin(angle), c = cos(angle);", "   vec2 tex = vTextureCoord * dimensions.xy;", "   vec2 point = vec2(", "       c * tex.x - s * tex.y,", "       s * tex.x + c * tex.y", "   ) * scale;", "   return (sin(point.x) * sin(point.y)) * 4.0;", "}", "void main() {", "   vec4 color = texture2D(uSampler, vTextureCoord);", "   float average = (color.r + color.g + color.b) / 3.0;", "   gl_FragColor = vec4(vec3(average * 10.0 - 5.0 + pattern()), color.a);", "}"]
        }
        ;
        PIXI.DotScreenFilter.prototype = Object.create(PIXI.AbstractFilter.prototype);
        PIXI.DotScreenFilter.prototype.constructor = PIXI.DotScreenFilter;
        Object.defineProperty(PIXI.DotScreenFilter.prototype, "scale", {
            get: function () {
                return this.uniforms.scale.value
            },
            set: function (value) {
                this.dirty = true;
                this.uniforms.scale.value = value
            }
        });
        Object.defineProperty(PIXI.DotScreenFilter.prototype, "angle", {
            get: function () {
                return this.uniforms.angle.value
            },
            set: function (value) {
                this.dirty = true;
                this.uniforms.angle.value = value
            }
        });
        PIXI.CrossHatchFilter = function () {
            PIXI.AbstractFilter.call(this);
            this.passes = [this];
            this.uniforms = {
                blur: {
                    type: "1f",
                    value: 1 / 512
                }
            };
            this.fragmentSrc = ["precision mediump float;", "varying vec2 vTextureCoord;", "varying vec4 vColor;", "uniform float blur;", "uniform sampler2D uSampler;", "void main(void) {", "    float lum = length(texture2D(uSampler, vTextureCoord.xy).rgb);", "    gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);", "    if (lum < 1.00) {", "        if (mod(gl_FragCoord.x + gl_FragCoord.y, 10.0) == 0.0) {", "            gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);", "        }", "    }", "    if (lum < 0.75) {", "        if (mod(gl_FragCoord.x - gl_FragCoord.y, 10.0) == 0.0) {", "            gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);", "        }", "    }", "    if (lum < 0.50) {", "        if (mod(gl_FragCoord.x + gl_FragCoord.y - 5.0, 10.0) == 0.0) {", "            gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);", "        }", "    }", "    if (lum < 0.3) {", "        if (mod(gl_FragCoord.x - gl_FragCoord.y - 5.0, 10.0) == 0.0) {", "            gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);", "        }", "    }", "}"]
        }
        ;
        PIXI.CrossHatchFilter.prototype = Object.create(PIXI.AbstractFilter.prototype);
        PIXI.CrossHatchFilter.prototype.constructor = PIXI.CrossHatchFilter;
        Object.defineProperty(PIXI.CrossHatchFilter.prototype, "blur", {
            get: function () {
                return this.uniforms.blur.value / (1 / 7e3)
            },
            set: function (value) {
                this.uniforms.blur.value = 1 / 7e3 * value
            }
        });
        PIXI.RGBSplitFilter = function () {
            PIXI.AbstractFilter.call(this);
            this.passes = [this];
            this.uniforms = {
                red: {
                    type: "2f",
                    value: {
                        x: 20,
                        y: 20
                    }
                },
                green: {
                    type: "2f",
                    value: {
                        x: -20,
                        y: 20
                    }
                },
                blue: {
                    type: "2f",
                    value: {
                        x: 20,
                        y: -20
                    }
                },
                dimensions: {
                    type: "4fv",
                    value: [0, 0, 0, 0]
                }
            };
            this.fragmentSrc = ["precision mediump float;", "varying vec2 vTextureCoord;", "varying vec4 vColor;", "uniform vec2 red;", "uniform vec2 green;", "uniform vec2 blue;", "uniform vec4 dimensions;", "uniform sampler2D uSampler;", "void main(void) {", "   gl_FragColor.r = texture2D(uSampler, vTextureCoord + red/dimensions.xy).r;", "   gl_FragColor.g = texture2D(uSampler, vTextureCoord + green/dimensions.xy).g;", "   gl_FragColor.b = texture2D(uSampler, vTextureCoord + blue/dimensions.xy).b;", "   gl_FragColor.a = texture2D(uSampler, vTextureCoord).a;", "}"]
        }
        ;
        PIXI.RGBSplitFilter.prototype = Object.create(PIXI.AbstractFilter.prototype);
        PIXI.RGBSplitFilter.prototype.constructor = PIXI.RGBSplitFilter;
        Object.defineProperty(PIXI.RGBSplitFilter.prototype, "red", {
            get: function () {
                return this.uniforms.red.value
            },
            set: function (value) {
                this.uniforms.red.value = value
            }
        });
        Object.defineProperty(PIXI.RGBSplitFilter.prototype, "green", {
            get: function () {
                return this.uniforms.green.value
            },
            set: function (value) {
                this.uniforms.green.value = value
            }
        });
        Object.defineProperty(PIXI.RGBSplitFilter.prototype, "blue", {
            get: function () {
                return this.uniforms.blue.value
            },
            set: function (value) {
                this.uniforms.blue.value = value
            }
        });
        if (typeof exports !== "undefined") {
            if (typeof module !== "undefined" && module.exports) {
                exports = module.exports = PIXI
            }
            exports.PIXI = PIXI
        } else if (typeof define !== "undefined" && define.amd) {
            define(PIXI)
        } else {
            root.PIXI = PIXI
        }
    }
).call(this);
void 0 === Date.now && (Date.now = function () {
        return (new Date).valueOf()
    }
);
var TWEEN = TWEEN || function () {
    var n = [];
    return {
        REVISION: "14",
        getAll: function () {
            return n
        },
        removeAll: function () {
            n = []
        },
        add: function (t) {
            n.push(t)
        },
        remove: function (t) {
            var r = n.indexOf(t);
            -1 !== r && n.splice(r, 1)
        },
        update: function (t) {
            if (0 === n.length)
                return !1;
            var r = 0;
            for (t = void 0 !== t ? t : "undefined" != typeof window && void 0 !== window.performance && void 0 !== window.performance.now ? window.performance.now() : Date.now(); r < n.length;)
                n[r].update(t) ? r++ : n.splice(r, 1);
            return !0
        }
    }
}();
TWEEN.Tween = function (n) {
    var t = n
        , r = {}
        , i = {}
        , u = {}
        , o = 1e3
        , e = 0
        , a = !1
        , f = !1
        , c = !1
        , s = 0
        , h = null
        , l = TWEEN.Easing.Linear.None
        , p = TWEEN.Interpolation.Linear
        , E = []
        , d = null
        , v = !1
        , I = null
        , w = null
        , M = null;
    for (var O in n)
        r[O] = parseFloat(n[O], 10);
    this.to = function (n, t) {
        return void 0 !== t && (o = t),
            i = n,
            this
    }
        ,
        this.start = function (n) {
            TWEEN.add(this),
                f = !0,
                v = !1,
                h = void 0 !== n ? n : "undefined" != typeof window && void 0 !== window.performance && void 0 !== window.performance.now ? window.performance.now() : Date.now(),
                h += s;
            for (var o in i) {
                if (i[o] instanceof Array) {
                    if (0 === i[o].length)
                        continue;
                    i[o] = [t[o]].concat(i[o])
                }
                r[o] = t[o],
                r[o] instanceof Array == !1 && (r[o] *= 1),
                    u[o] = r[o] || 0
            }
            return this
        }
        ,
        this.stop = function () {
            return f ? (TWEEN.remove(this),
                f = !1,
            null !== M && M.call(t),
                this.stopChainedTweens(),
                this) : this
        }
        ,
        this.stopChainedTweens = function () {
            for (var n = 0, t = E.length; t > n; n++)
                E[n].stop()
        }
        ,
        this.delay = function (n) {
            return s = n,
                this
        }
        ,
        this.repeat = function (n) {
            return e = n,
                this
        }
        ,
        this.yoyo = function (n) {
            return a = n,
                this
        }
        ,
        this.easing = function (n) {
            return l = n,
                this
        }
        ,
        this.interpolation = function (n) {
            return p = n,
                this
        }
        ,
        this.chain = function () {
            return E = arguments,
                this
        }
        ,
        this.onStart = function (n) {
            return d = n,
                this
        }
        ,
        this.onUpdate = function (n) {
            return I = n,
                this
        }
        ,
        this.onComplete = function (n) {
            return w = n,
                this
        }
        ,
        this.onStop = function (n) {
            return M = n,
                this
        }
        ,
        this.update = function (n) {
            var f;
            if (h > n)
                return !0;
            v === !1 && (null !== d && d.call(t),
                v = !0);
            var M = (n - h) / o;
            M = M > 1 ? 1 : M;
            var O = l(M);
            for (f in i) {
                var m = r[f] || 0
                    , N = i[f];
                N instanceof Array ? t[f] = p(N, O) : ("string" == typeof N && (N = m + parseFloat(N, 10)),
                "number" == typeof N && (t[f] = m + (N - m) * O))
            }
            if (null !== I && I.call(t, O),
            1 == M) {
                if (e > 0) {
                    isFinite(e) && e--;
                    for (f in u) {
                        if ("string" == typeof i[f] && (u[f] = u[f] + parseFloat(i[f], 10)),
                            a) {
                            var T = u[f];
                            u[f] = i[f],
                                i[f] = T
                        }
                        r[f] = u[f]
                    }
                    return a && (c = !c),
                        h = n + s,
                        !0
                }
                null !== w && w.call(t);
                for (var g = 0, W = E.length; W > g; g++)
                    E[g].start(n);
                return !1
            }
            return !0
        }
}
    ,
    TWEEN.Easing = {
        Linear: {
            None: function (n) {
                return n
            }
        },
        Quadratic: {
            In: function (n) {
                return n * n
            },
            Out: function (n) {
                return n * (2 - n)
            },
            InOut: function (n) {
                return (n *= 2) < 1 ? .5 * n * n : -.5 * (--n * (n - 2) - 1)
            }
        },
        Cubic: {
            In: function (n) {
                return n * n * n
            },
            Out: function (n) {
                return --n * n * n + 1
            },
            InOut: function (n) {
                return (n *= 2) < 1 ? .5 * n * n * n : .5 * ((n -= 2) * n * n + 2)
            }
        },
        Quartic: {
            In: function (n) {
                return n * n * n * n
            },
            Out: function (n) {
                return 1 - --n * n * n * n
            },
            InOut: function (n) {
                return (n *= 2) < 1 ? .5 * n * n * n * n : -.5 * ((n -= 2) * n * n * n - 2)
            }
        },
        Quintic: {
            In: function (n) {
                return n * n * n * n * n
            },
            Out: function (n) {
                return --n * n * n * n * n + 1
            },
            InOut: function (n) {
                return (n *= 2) < 1 ? .5 * n * n * n * n * n : .5 * ((n -= 2) * n * n * n * n + 2)
            }
        },
        Sinusoidal: {
            In: function (n) {
                return 1 - Math.cos(n * Math.PI / 2)
            },
            Out: function (n) {
                return Math.sin(n * Math.PI / 2)
            },
            InOut: function (n) {
                return .5 * (1 - Math.cos(Math.PI * n))
            }
        },
        Exponential: {
            In: function (n) {
                return 0 === n ? 0 : Math.pow(1024, n - 1)
            },
            Out: function (n) {
                return 1 === n ? 1 : 1 - Math.pow(2, -10 * n)
            },
            InOut: function (n) {
                return 0 === n ? 0 : 1 === n ? 1 : (n *= 2) < 1 ? .5 * Math.pow(1024, n - 1) : .5 * (-Math.pow(2, -10 * (n - 1)) + 2)
            }
        },
        Circular: {
            In: function (n) {
                return 1 - Math.sqrt(1 - n * n)
            },
            Out: function (n) {
                return Math.sqrt(1 - --n * n)
            },
            InOut: function (n) {
                return (n *= 2) < 1 ? -.5 * (Math.sqrt(1 - n * n) - 1) : .5 * (Math.sqrt(1 - (n -= 2) * n) + 1)
            }
        },
        Elastic: {
            In: function (n) {
                var t, r = .1, i = .4;
                return 0 === n ? 0 : 1 === n ? 1 : (!r || 1 > r ? (r = 1,
                    t = i / 4) : t = i * Math.asin(1 / r) / (2 * Math.PI),
                    -(r * Math.pow(2, 10 * (n -= 1)) * Math.sin(2 * (n - t) * Math.PI / i)))
            },
            Out: function (n) {
                var t, r = .1, i = .4;
                return 0 === n ? 0 : 1 === n ? 1 : (!r || 1 > r ? (r = 1,
                    t = i / 4) : t = i * Math.asin(1 / r) / (2 * Math.PI),
                r * Math.pow(2, -10 * n) * Math.sin(2 * (n - t) * Math.PI / i) + 1)
            },
            InOut: function (n) {
                var t, r = .1, i = .4;
                return 0 === n ? 0 : 1 === n ? 1 : (!r || 1 > r ? (r = 1,
                    t = i / 4) : t = i * Math.asin(1 / r) / (2 * Math.PI),
                    (n *= 2) < 1 ? -.5 * r * Math.pow(2, 10 * (n -= 1)) * Math.sin(2 * (n - t) * Math.PI / i) : r * Math.pow(2, -10 * (n -= 1)) * Math.sin(2 * (n - t) * Math.PI / i) * .5 + 1)
            }
        },
        Back: {
            In: function (n) {
                var t = 1.70158;
                return n * n * ((t + 1) * n - t)
            },
            Out: function (n) {
                var t = 1.70158;
                return --n * n * ((t + 1) * n + t) + 1
            },
            InOut: function (n) {
                var t = 2.5949095;
                return (n *= 2) < 1 ? .5 * n * n * ((t + 1) * n - t) : .5 * ((n -= 2) * n * ((t + 1) * n + t) + 2)
            }
        },
        Bounce: {
            In: function (n) {
                return 1 - TWEEN.Easing.Bounce.Out(1 - n)
            },
            Out: function (n) {
                return 1 / 2.75 > n ? 7.5625 * n * n : 2 / 2.75 > n ? 7.5625 * (n -= 1.5 / 2.75) * n + .75 : 2.5 / 2.75 > n ? 7.5625 * (n -= 2.25 / 2.75) * n + .9375 : 7.5625 * (n -= 2.625 / 2.75) * n + .984375
            },
            InOut: function (n) {
                return .5 > n ? .5 * TWEEN.Easing.Bounce.In(2 * n) : .5 * TWEEN.Easing.Bounce.Out(2 * n - 1) + .5
            }
        }
    },
    TWEEN.Interpolation = {
        Linear: function (n, t) {
            var r = n.length - 1
                , i = r * t
                , u = Math.floor(i)
                , o = TWEEN.Interpolation.Utils.Linear;
            return 0 > t ? o(n[0], n[1], i) : t > 1 ? o(n[r], n[r - 1], r - i) : o(n[u], n[u + 1 > r ? r : u + 1], i - u)
        },
        Bezier: function (n, t) {
            var r, i = 0, u = n.length - 1, o = Math.pow, e = TWEEN.Interpolation.Utils.Bernstein;
            for (r = 0; u >= r; r++)
                i += o(1 - t, u - r) * o(t, r) * n[r] * e(u, r);
            return i
        },
        CatmullRom: function (n, t) {
            var r = n.length - 1
                , i = r * t
                , u = Math.floor(i)
                , o = TWEEN.Interpolation.Utils.CatmullRom;
            return n[0] === n[r] ? (0 > t && (u = Math.floor(i = r * (1 + t))),
                o(n[(u - 1 + r) % r], n[u], n[(u + 1) % r], n[(u + 2) % r], i - u)) : 0 > t ? n[0] - (o(n[0], n[0], n[1], n[1], -i) - n[0]) : t > 1 ? n[r] - (o(n[r], n[r], n[r - 1], n[r - 1], i - r) - n[r]) : o(n[u ? u - 1 : 0], n[u], n[u + 1 > r ? r : u + 1], n[u + 2 > r ? r : u + 2], i - u)
        },
        Utils: {
            Linear: function (n, t, r) {
                return (t - n) * r + n
            },
            Bernstein: function (n, t) {
                var r = TWEEN.Interpolation.Utils.Factorial;
                return r(n) / r(t) / r(n - t)
            },
            Factorial: function () {
                var n = [1];
                return function (t) {
                    var r, i = 1;
                    if (n[t])
                        return n[t];
                    for (r = t; r > 1; r--)
                        i *= r;
                    return n[t] = i
                }
            }(),
            CatmullRom: function (n, t, r, i, u) {
                var o = .5 * (r - n)
                    , e = .5 * (i - t)
                    , a = u * u
                    , f = u * a;
                return (2 * t - 2 * r + o + e) * f + (-3 * t + 3 * r - 2 * o - e) * a + o * u + t
            }
        }
    },
"undefined" != typeof module && module.exports && (module.exports = TWEEN);
(function (window, document) {
        var prefix = "", _addEventListener, onwheel, support;
        if (window.addEventListener) {
            _addEventListener = "addEventListener"
        } else {
            _addEventListener = "attachEvent";
            prefix = "on"
        }
        support = "onwheel" in document.createElement("div") ? "wheel" : document.onmousewheel !== undefined ? "mousewheel" : "DOMMouseScroll";
        window.addWheelListener = function (elem, callback, useCapture) {
            _addWheelListener(elem, support, callback, useCapture);
            if (support == "DOMMouseScroll") {
                _addWheelListener(elem, "MozMousePixelScroll", callback, useCapture)
            }
        }
        ;

        function _addWheelListener(elem, eventName, callback, useCapture) {
            elem[_addEventListener](prefix + eventName, support == "wheel" ? callback : function (originalEvent) {
                    !originalEvent && (originalEvent = window.event);
                    var event = {
                        originalEvent: originalEvent,
                        target: originalEvent.target || originalEvent.srcElement,
                        type: "wheel",
                        deltaMode: originalEvent.type == "MozMousePixelScroll" ? 0 : 1,
                        deltaX: 0,
                        deltaZ: 0,
                        clientX: originalEvent.clientX,
                        clientY: originalEvent.clientY,
                        preventDefault: function () {
                            originalEvent.preventDefault ? originalEvent.preventDefault() : originalEvent.returnValue = false
                        }
                    };
                    if (support == "mousewheel") {
                        event.deltaY = -1 / 40 * originalEvent.wheelDelta;
                        originalEvent.wheelDeltaX && (event.deltaX = -1 / 40 * originalEvent.wheelDeltaX)
                    } else {
                        event.deltaY = originalEvent.detail
                    }
                    return callback(event)
                }
                , useCapture || false)
        }
    }
)(window, document);

function Event() {
    this._listeners = []
}

Event.prototype.subscribe = function (handler, contextObject) {
    if (contextObject === undefined) {
        contextObject = null
    }
    this._listeners.push({
        handler: handler,
        contextObject: contextObject
    })
}
;
Event.prototype.fire = function (var_args) {
    for (var i = 0; i < this._listeners.length; i++) {
        this._listeners[i].handler.apply(this._listeners[i].contextObject, arguments)
    }
}
;
var GlowFilter = function (textureWidth, textureHeight, distance, outerStrength, innerStrength, color, quality) {
    PIXI.AbstractFilter.call(this);
    quality = Math.pow(quality, 1 / 3);
    this.quality = quality;
    distance *= quality;
    textureWidth *= quality;
    textureHeight *= quality;
    this.uniforms = {
        distance: {
            type: "1f",
            value: distance
        },
        outerStrength: {
            type: "1f",
            value: null
        },
        innerStrength: {
            type: "1f",
            value: null
        },
        glowColor: {
            type: "4f",
            value: null
        },
        pixelWidth: {
            type: "1f",
            value: null
        },
        pixelHeight: {
            type: "1f",
            value: null
        }
    };
    this.color = color;
    this.outerStrength = outerStrength;
    this.innerStrength = innerStrength;
    this.textureWidth = textureWidth;
    this.textureHeight = textureHeight;
    this.passes = [this];
    this.fragmentSrc = ["precision mediump float;", "varying vec2 vTextureCoord;", "uniform sampler2D texture;", "uniform float distance;", "uniform float outerStrength;", "uniform float innerStrength;", "uniform vec4 glowColor;", "uniform float pixelWidth;", "uniform float pixelHeight;", "vec2 px = vec2(pixelWidth, pixelHeight);", "void main(void) {", "    const float PI = 3.14159265358979323846264;", "    vec4 ownColor = texture2D(texture, vTextureCoord);", "    vec4 curColor;", "    float totalAlpha = 0.;", "    float maxTotalAlpha = 0.;", "    float cosAngle;", "    float sinAngle;", "    for (float angle = 0.; angle <= PI * 2.; angle += " + (1 / quality / distance).toFixed(7) + ") {", "       cosAngle = cos(angle);", "       sinAngle = sin(angle);", "       for (float curDistance = 1.; curDistance <= " + distance.toFixed(7) + "; curDistance++) {", "           curColor = texture2D(texture, vec2(vTextureCoord.x + cosAngle * curDistance * px.x, vTextureCoord.y + sinAngle * curDistance * px.y));", "           totalAlpha += (distance - curDistance) * curColor.a;", "           maxTotalAlpha += (distance - curDistance);", "       }", "    }", "    maxTotalAlpha = max(maxTotalAlpha, 0.0001);", "    ownColor.a = max(ownColor.a, 0.0001);", "    ownColor.rgb = ownColor.rgb / ownColor.a;", "    float outerGlowAlpha = (totalAlpha / maxTotalAlpha)  * outerStrength * (1. - ownColor.a);", "    float innerGlowAlpha = ((maxTotalAlpha - totalAlpha) / maxTotalAlpha) * innerStrength * ownColor.a;", "    float resultAlpha = (ownColor.a + outerGlowAlpha);", "    gl_FragColor = vec4(mix(mix(ownColor.rgb, glowColor.rgb, innerGlowAlpha / ownColor.a), glowColor.rgb, outerGlowAlpha / resultAlpha) * resultAlpha, resultAlpha);", "}"]
};
GlowFilter.prototype = Object.create(PIXI.AbstractFilter.prototype);
GlowFilter.prototype.constructor = GlowFilter;
Object.defineProperty(GlowFilter.prototype, "color", {
    set: function (value) {
        var r = ((value & 16711680) >> 16) / 255
            , g = ((value & 65280) >> 8) / 255
            , b = (value & 255) / 255;
        this.uniforms.glowColor.value = {
            x: r,
            y: g,
            z: b,
            w: 1
        };
        this.dirty = true
    }
});
Object.defineProperty(GlowFilter.prototype, "outerStrength", {
    set: function (value) {
        this.uniforms.outerStrength.value = value;
        this.dirty = true
    }
});
Object.defineProperty(GlowFilter.prototype, "innerStrength", {
    set: function (value) {
        this.uniforms.innerStrength.value = value;
        this.dirty = true
    }
});
Object.defineProperty(GlowFilter.prototype, "textureWidth", {
    set: function (value) {
        this.uniforms.pixelWidth.value = 1 / value;
        this.dirty = true
    }
});
Object.defineProperty(GlowFilter.prototype, "textureHeight", {
    set: function (value) {
        this.uniforms.pixelHeight.value = 1 / value;
        this.dirty = true
    }
});

function XOSignTextureProvider(game) {
    this.game = game;
    this.textures = {};
    this.textures[CellStates.X] = PIXI.Texture.fromFrame(this.game.xTextureProvider.chooseImageForSize(21));
    this.textures[CellStates.O] = PIXI.Texture.fromFrame(this.game.oTextureProvider.chooseImageForSize(21))
}

XOSignTextureProvider.prototype.setScale = function (scale) {
    this.textures[CellStates.X].setFrame(this.game.xTextureProvider.getFrame(this.game.signSize * this.game.scale));
    this.textures[CellStates.O].setFrame(this.game.oTextureProvider.getFrame(this.game.signSize * this.game.scale))
}
;
XOSignTextureProvider.prototype.getTexture = function (cell) {
    return this.textures[cell]
}
;

function MapNavigator(eventRoot, startScale) {
    this.eventRoot = eventRoot;
    this.position = {
        x: 0,
        y: 0
    };
    var panPrevX = 0
        , panPrevY = 0
        , panVelocityX = 0
        , panVelocityY = 0
        , lastMovement = null;
    this.velocityX = 0;
    this.velocityY = 0;
    this.scale = startScale;
    this.prevScale = 1;
    this.maxScale = 10;
    this.minScale = .1;
    this.scaleChange = new Event;
    this.constantScale = false;
    this.inertia = true;
    this.enableNavigation = true;
    var mc = new Hammer.Manager(eventRoot, {
        recognizers: [[Hammer.Tap, {
            time: 250,
            threshold: 5
        }], [Hammer.Pinch], [Hammer.Pan, {
            pointers: 0,
            threshold: 2
        }, ["tap"]]]
    });
    this.hammerManager = mc;

    function panstart() {
        panVelocityX = 0;
        panVelocityY = 0
    }

    this.panstart = panstart;

    function panend(vx, vy) {
        var now = Date.now();
        if (now - lastMovement < 100) {
            this.velocityX = (vx + panVelocityX) / 2;
            this.velocityY = (vy + panVelocityY) / 2
        } else {
            this.velocityX = vx;
            this.velocityY = vy
        }
        panPrevX = 0;
        panPrevY = 0
    }

    this.panend = panend.bind(this);
    this.panmove = function (dx, dy, vx, vy) {
        if (panPrevX === 0) {
            panPrevX = dx
        }
        if (panPrevY === 0) {
            panPrevY = dy
        }
        this.position.x -= (dx - panPrevX) / this.scale;
        this.position.y -= (dy - panPrevY) / this.scale;
        panPrevX = dx;
        panPrevY = dy;
        this.velocityX = 0;
        this.velocityY = 0;
        panVelocityX = (vx + panVelocityX) / 2;
        panVelocityY = (vy + panVelocityY) / 2;
        lastMovement = Date.now()
    }
    ;
    mc.on("panstart", function (ev) {
        ev.preventDefault();
        if (!this.enableNavigation) {
            return
        }
        panstart()
    });
    mc.on("panend", function (ev) {
        ev.preventDefault();
        if (!this.enableNavigation) {
            return
        }
        this.panend(ev.velocityX, ev.velocityY)
    }
        .bind(this));
    mc.on("panmove", function (ev) {
        ev.preventDefault();
        if (!this.enableNavigation) {
            return
        }
        this.panmove(ev.deltaX, ev.deltaY, ev.velocityX, ev.velocityY)
    }
        .bind(this));
    addWheelListener(eventRoot, function (e) {
        e.preventDefault();
        if (!this.enableNavigation) {
            return
        }
        this.zoom({
            x: e.clientX,
            y: e.clientY
        }, e.deltaY > 0 ? .9 : 1.1)
    }
        .bind(this));

    function pinch(ev) {
        ev.preventDefault();
        if (!this.enableNavigation) {
            return
        }
        var center = this.globalToLocalPosition(ev.center, this.eventRoot);
        var realScale = ev.scale / this.prevScale;
        this.zoom(center, realScale);
        this.prevScale = ev.scale
    }

    mc.on("pinch", pinch.bind(this));
    mc.on("pinchend", function (ev) {
        ev.preventDefault();
        if (!this.enableNavigation) {
            return
        }
        this.prevScale = 1
    }
        .bind(this));
    if (this.inertia) {
        var updateBound = update.bind(this);
        requestAnimationFrame(updateBound);
        var lastTime = null;

        function update(time) {
            requestAnimationFrame(updateBound);
            if (lastTime === null) {
                lastTime = time
            }
            var deltaTime = time - lastTime;
            lastTime = time;
            this.position.x += deltaTime * this.velocityX / this.scale;
            this.position.y += deltaTime * this.velocityY / this.scale;
            this.velocityX *= Math.pow(.996, deltaTime);
            this.velocityY *= Math.pow(.996, deltaTime);
            if (Math.abs(this.velocityX) < 1e-4) {
                this.velocityX = 0
            }
            if (Math.abs(this.velocityY) < 1e-4) {
                this.velocityY = 0
            }
        }
    }
}

MapNavigator.prototype.screenToWorld = function (p) {
    return {
        x: this.position.x + p.x / this.scale,
        y: this.position.y + p.y / this.scale
    }
}
;
MapNavigator.prototype.worldToScreen = function (p) {
    return {
        x: (p.x - this.position.x) * this.scale,
        y: (p.y - this.position.y) * this.scale
    }
}
;
MapNavigator.prototype.zoom = function (zoomCenter, zoomScale) {
    if (!this.constantScale) {
        var worldCoords = this.screenToWorld(zoomCenter);
        this.scale = Math.max(Math.min(this.scale * zoomScale, this.maxScale), this.minScale);
        var screenCoords = this.worldToScreen(worldCoords);
        this.position.x += (screenCoords.x - zoomCenter.x) / this.scale;
        this.position.y += (screenCoords.y - zoomCenter.y) / this.scale;
        this.scaleChange.fire(this.scale)
    } else {
        this.scaleChange.fire(zoomScale)
    }
}
;
MapNavigator.prototype.globalToLocalPosition = function (globalPosition, element) {
    var offset = this.getOffset(element);
    return {
        x: globalPosition.x - offset.left,
        y: globalPosition.y - offset.top
    }
}
;
MapNavigator.prototype.getOffset = function (el) {
    var _x = 0;
    var _y = 0;
    while (el && !isNaN(el.offsetLeft) && !isNaN(el.offsetTop)) {
        _x += el.offsetLeft - el.scrollLeft;
        _y += el.offsetTop - el.scrollTop;
        el = el.offsetParent
    }
    return {
        left: _x,
        top: _y
    }
}
;

function EventSwallowerSprite() {
    PIXI.Sprite.apply(this, arguments);
    this.interactive = true;
    this.mousedown = this.touchstart = function (data) {
        data.originalEvent.stopPropagation()
    }
    ;
    this.mouseup = this.touchend = function (data) {
        data.originalEvent.stopPropagation()
    }
}

EventSwallowerSprite.prototype = Object.create(PIXI.Sprite.prototype);
EventSwallowerSprite.prototype.constructor = EventSwallowerSprite;
var CellStates = {
    AVAILABLE: null,
    X: 1,
    O: 2,
    UNAVAILABLE: 3
};

function GridStore(defaultValue) {
    this.defaultValue = defaultValue;
    this.table = {};
    this.array = []
}

GridStore.prototype = {
    set: function (x, y, value) {
        var cell = this.table["cell" + x + "_" + y];
        if (cell === undefined) {
            cell = {
                x: x,
                y: y,
                value: value
            };
            this.table["cell" + x + "_" + y] = cell;
            this.array.push(cell)
        } else {
            cell.value = value
        }
    },
    get: function (x, y) {
        var cell = this.table["cell" + x + "_" + y];
        if (cell === undefined) {
            return this.defaultValue
        } else {
            return cell.value
        }
    },
    getAll: function () {
        return this.array
    },
    clear: function () {
        this.table = {};
        this.array = []
    }
};
var GameLogic = {
    levels: {
        EASY: 0,
        MODERATE: 1,
        HARD: 2
    },
    start: function () {
        this.l = 5;
        this.gridStore = new GridStore(CellStates.AVAILABLE);
        this.turn = CellStates.X;
        this.winner = null;
        this.winningCells = null;
        this.isOver = false;
        this.level = this.levels.HARD
    },
    canPlay: function (x, y) {
        return !this.isOver && this.grid(y, x) === CellStates.AVAILABLE
    },
    grid: function (i, j, v) {
        if (v === undefined) {
            return this.gridStore.get(j, i)
        }
        this.gridStore.set(j, i, v)
    },
    nextTurn: function (turn) {
        return turn === CellStates.X ? CellStates.O : CellStates.X
    },
    play: function (x, y) {
        var p = this.turn;
        this.grid(y, x, this.turn);
        var lines = [this.getPlayerLine(y, x, -1, -1, p, true).concat([{
            x: x,
            y: y
        }]).concat(this.getPlayerLine(y, x, 1, 1, p, false)), this.getPlayerLine(y, x, -1, 0, p, true).concat([{
            x: x,
            y: y
        }]).concat(this.getPlayerLine(y, x, 1, 0, p, false)), this.getPlayerLine(y, x, -1, 1, p, true).concat([{
            x: x,
            y: y
        }]).concat(this.getPlayerLine(y, x, 1, -1, p, false)), this.getPlayerLine(y, x, 0, -1, p, true).concat([{
            x: x,
            y: y
        }]).concat(this.getPlayerLine(y, x, 0, 1, p, false))];
        for (var k = 0; k < lines.length; k++) {
            if (lines[k].length >= this.l) {
                this.winner = this.turn;
                this.winningCells = lines[k];
                this.isOver = true;
                break
            }
        }
        if (this.isOver) {
            this.turn = null
        } else {
            this.turn = this.nextTurn(this.turn)
        }
    },
    linePoints: function (line, p, x_pos) {
        var v1 = 2;
        for (var i = x_pos - 1; i > 0; i--) {
            if (line[i] === p) {
                v1++
            } else {
                break
            }
        }
        for (i = x_pos + 1; i < line.length - 1; i++) {
            if (line[i] === p) {
                v1++
            } else {
                break
            }
        }
        var v2 = 0;
        var t = Math.min(line.length, this.l);
        for (i = 0; i < t; i++) {
            if (line[i] === p)
                v2++
        }
        var maxv2 = v2;
        for (; i < line.length; i++) {
            if (line[i - this.l] === p)
                v2--;
            if (line[i] === p)
                v2++;
            if (v2 > maxv2)
                maxv2 = v2
        }
        return Math.max(v1 * 90, maxv2 * 100)
    },
    getFreeLine: function (i, j, inc_i, inc_j, p) {
        var ans = [];
        for (var k = 1; k < this.l; k++) {
            var cur_i = i + inc_i * k;
            var cur_j = j + inc_j * k;
            if (this.grid(cur_i, cur_j) === p || this.grid(cur_i, cur_j) === CellStates.AVAILABLE) {
                ans.push(this.grid(cur_i, cur_j))
            } else {
                break
            }
        }
        return ans
    },
    getPlayerLine: function (i, j, inc_i, inc_j, player, doReverse) {
        var ans = [];
        for (var k = 1; k < this.l; k++) {
            var cur_i = i + inc_i * k;
            var cur_j = j + inc_j * k;
            if (this.grid(cur_i, cur_j) === player) {
                ans.push({
                    x: cur_j,
                    y: cur_i
                })
            } else {
                break
            }
        }
        if (doReverse) {
            ans.reverse()
        }
        return ans
    },
    getPointsForPlayer: function (i, j, p) {
        var lines = [[this.getFreeLine(i, j, -1, -1, p), this.getFreeLine(i, j, 1, 1, p)], [this.getFreeLine(i, j, -1, 0, p), this.getFreeLine(i, j, 1, 0, p)], [this.getFreeLine(i, j, -1, 1, p), this.getFreeLine(i, j, 1, -1, p)], [this.getFreeLine(i, j, 0, -1, p), this.getFreeLine(i, j, 0, 1, p)]];
        var sum = 0;
        var lineValues = [-1, -1];
        for (var k = 0; k < lines.length; k++) {
            var line = lines[k][0].reverse().concat([p]).concat(lines[k][1]);
            if (line.length < this.l)
                continue;
            var points = this.linePoints(line, p, lines[k][0].length);
            sum += points / 100 * (points / 100);
            lineValues.push(points)
        }
        lineValues = lineValues.sort(function (a, b) {
            return b - a
        });
        if (this.level === this.levels.EASY) {
            return lineValues[0]
        } else {
            return Math.max(lineValues[0], lineValues[1] + 1) + sum
        }
    },
    getMovePoints: function (i, j) {
        var t1 = this.getPointsForPlayer(i, j, this.turn);
        var t2 = this.getPointsForPlayer(i, j, this.nextTurn(this.turn));
        return Math.max(t1, t2 - 10)
    },
    findBestMove: function () {
        var currentCells = this.gridStore.getAll(), possibleCells = [], i, curCell;
        if (currentCells.length === 0) {
            return {
                x: 0,
                y: 0
            }
        }
        var tryCell = function (cell, xDiff, yDiff) {
            if (this.grid(cell.y + yDiff, cell.x + xDiff) === CellStates.AVAILABLE) {
                possibleCells.push({
                    x: cell.x + xDiff,
                    y: cell.y + yDiff
                })
            }
        }
            .bind(this);
        for (i = 0; i < currentCells.length; i++) {
            curCell = currentCells[i];
            tryCell(curCell, -1, -1);
            tryCell(curCell, 0, -1);
            tryCell(curCell, 1, -1);
            tryCell(curCell, -1, 0);
            tryCell(curCell, 1, 0);
            tryCell(curCell, -1, 1);
            tryCell(curCell, 0, 1);
            tryCell(curCell, 1, 1)
        }
        for (var i = 0; i < possibleCells.length; i++) {
            possibleCells[i].points = this.getMovePoints(possibleCells[i].y, possibleCells[i].x)
        }
        possibleCells.sort(function (a, b) {
            return b.points - a.points
        });
        var minPints = this.level === this.levels.EASY ? possibleCells[0].points * .8 : this.level === this.levels.MODERATE ? possibleCells[0].points * .9 : possibleCells[0].points;
        var goodMoves = 1;
        for (var i = 1; i < possibleCells.length; i++) {
            var points = possibleCells[i].points;
            if (points >= minPints) {
                goodMoves++
            } else {
                break
            }
        }
        var index = Math.floor(Math.random() * goodMoves);
        return possibleCells[index]
    }
};

function MainMenu(game, parentElement) {
    this.game = game;
    var texture1 = PIXI.Texture.fromFrame("menu1player.png")
        , texture2 = PIXI.Texture.fromFrame("menu2players.png")
    this.spriteSingleplayer = new PIXI.Sprite(texture1);
    this.spritePairplayer = new PIXI.Sprite(texture2);
    parentElement.addChild(this.spriteSingleplayer);
    parentElement.addChild(this.spritePairplayer);
    this.centeredMenu = new CenteredMenu(game, [{
        object: this.spriteSingleplayer,
        callback: function () {
            game.levelsMenu.appear()
        }
    }, {
        object: this.spritePairplayer,
        callback: function () {
            game.hud.showHeader = true;
            game.hud.appear();
            game.activeGame = new PairMatch(game);
            game.activeView = game.activeGame
        }
    }])
}

MainMenu.prototype.appear = function () {
    this.game.activeView = this;
    this.game.hud.disappear();
    this.centeredMenu.appear()
}
;
MainMenu.prototype.disappear = function () {
    this.centeredMenu.disappear()
}
;

function WinRates(storage) {
    this.storage = storage
}

WinRates.prototype.getWinRate = function (level) {
    var result = {
        played: parseInt(this.storage.getItem("played" + level, "0")),
        won: parseInt(this.storage.getItem("won" + level, "0"))
    };
    result.text = this.getText(result.played, result.won);
    return result
}
;
WinRates.prototype.change = function (level, win) {
    var winRate = this.getWinRate(level);
    winRate.played++;
    winRate.won += win ? 1 : 0;
    this.storage.setItem("played" + level, winRate.played);
    this.storage.setItem("won" + level, winRate.won)
}
;
WinRates.prototype.getText = function (played, won) {
    return played === 0 ? "N/A" : Math.round(won / played * 100) + "% (" + won + "/" + played + ")"
}
;

function LevelsMenu(game, parentElement) {
    this.game = game;
    var texture1 = PIXI.Texture.fromFrame("easy.png")
        , texture2 = PIXI.Texture.fromFrame("moderate.png")
        , texture3 = PIXI.Texture.fromFrame("hard.png");
    this.spriteEasy = new PIXI.Sprite(texture1);
    this.spriteModerate = new PIXI.Sprite(texture2);
    this.spriteHard = new PIXI.Sprite(texture3);
    this.sprites = [this.spriteEasy, this.spriteModerate, this.spriteHard];
    this.winRateTexts = [];
    this.fontStyle = {
        font: this.spriteEasy.texture.height / 5 + 'px Georgia, "Droid Serif", Arial',
        fill: "#B0A4F9",
        stroke: "#000000",
        strokeThickness: 1,
        dropShadow: true,
        dropShadowDistance: 3
    };
    for (var i = 0; i < 3; i++) {
        var text = new PIXI.Text("Winrate: " + this.game.winRates.getWinRate(i).text, this.fontStyle);
        text.anchor.x = .5;
        text.anchor.y = -.3;
        text.y = 0;
        this.winRateTexts.push(text);
        this.sprites[i].addChild(text)
    }
    parentElement.addChild(this.spriteEasy);
    parentElement.addChild(this.spriteModerate);
    parentElement.addChild(this.spriteHard);
    this.centeredMenu = new CenteredMenu(game, [{
        object: this.spriteEasy,
        callback: function () {
            game.hud.showHeader = true;
            game.hud.showRestart = true;
            game.hud.appear();
            game.activeGame = new SingleMatch(game);
            game.activeView = game.activeGame;
            game.activeGame.logic.level = GameLogic.levels.EASY
        }
    }, {
        object: this.spriteModerate,
        callback: function () {
            game.hud.showHeader = true;
            game.hud.showRestart = true;
            game.hud.appear();
            game.activeGame = new SingleMatch(game);
            game.activeView = game.activeGame;
            game.activeGame.logic.level = GameLogic.levels.MODERATE
        }
    }, {
        object: this.spriteHard,
        callback: function () {
            game.hud.showHeader = true;
            game.hud.showRestart = true;
            game.hud.appear();
            game.activeGame = new SingleMatch(game);
            game.activeView = game.activeGame;
            game.activeGame.logic.level = GameLogic.levels.HARD
        }
    }])
}

LevelsMenu.prototype.appear = function () {
    this.game.activeView = this;
    this.centeredMenu.appear();
    this.game.hud.showHeader = false;
    this.game.hud.showBack = true;
    this.game.hud.showRestart = false;
    this.game.hud.appear();
    for (var i = 0; i < 3; i++) {
        this.winRateTexts[i].setText("Winrate: " + this.game.winRates.getWinRate(i).text)
    }
}
;
LevelsMenu.prototype.disappear = function () {
    this.centeredMenu.disappear()
}
;
LevelsMenu.prototype.back = function () {
    this.disappear();
    this.game.menu.appear()
}
;

function CenteredMenu(game, items) {
    var parentElement = items[0].object.signLayer, i, that = this;
    this.game = game;
    this.items = items;
    this.visible = false;

    function initItem(index, item) {
        var curObj = item.object;
        curObj.visible = false;
        curObj.anchor = new PIXI.Point(.5, .5);
        items[index].button = new Button(this.game, curObj, function (data) {
                that.disappear();
                item.callback()
            }
        )
    }

    for (i = 0; i < items.length; i++) {
        initItem.bind(this)(i, items[i])
    }
    game.onResize.subscribe(this.resize, this)
}

CenteredMenu.prototype.resize = function () {
    if (this.visible) {
        this.appearAnimation(0)
    }
}
;
CenteredMenu.prototype.appearAnimation = function (duration) {
    var itemInitialWidth = this.items[0].object.texture.width, itemInitialHeight = this.items[0].object.texture.height,
        totalInitialHeight = itemInitialHeight * this.items.length * 1.4,
        ratio = Math.min(Math.min(this.game.appHeight / totalInitialHeight, this.game.appWidth * .7 / itemInitialWidth), 1),
        itemWidth = itemInitialWidth * ratio, itemHeight = itemInitialHeight * ratio, itemSpacing = itemHeight / 4,
        menuHeight = this.items.length * itemHeight + (this.items.length - 1) * itemSpacing,
        middle = this.game.appWidth / 2, curTop = (this.game.appHeight - menuHeight + itemHeight) / 2, i;

    function showItem(index, item) {
        var curObj = item.object;
        curObj.visible = true;
        curObj.alpha = 1;
        curObj.height = itemHeight;
        curObj.scale.x = curObj.scale.y;
        curObj.position.x = middle;
        curObj.position.y = curTop;
        curTop += itemHeight + itemSpacing;
        if (index % 2 === 0) {
            curObj.position.x = -itemWidth / 2
        } else {
            curObj.position.x = this.game.appWidth + itemWidth / 2
        }
        new TWEEN.Tween(curObj.position).to({
            x: middle
        }, duration).easing(TWEEN.Easing.Elastic.Out).start(this.game.frameTime);
        this.items[index].button.isActive = true
    }

    for (i = 0; i < this.items.length; i++) {
        showItem.bind(this)(i, this.items[i])
    }
}
;
CenteredMenu.prototype.appear = function () {
    this.visible = true;
    this.appearAnimation(900)
}
;
CenteredMenu.prototype.disappear = function () {
    var i;
    this.visible = false;
    for (i = 0; i < this.items.length; i++) {
        new TWEEN.Tween(this.items[i].object).to({
            alpha: 0
        }, 300).easing(TWEEN.Easing.Linear.None).onComplete(function () {
            this.visible = false
        }).start(this.game.frameTime)
    }
}
;

function SignSpriteRenderer(gameView, signLayer, width, height, textureProvider) {
    this.gameView = gameView;
    this.signLayer = signLayer;
    this.scaledSprites = [];
    this.spriteStore = new GridStore;
    this.textureProvider = textureProvider;
    this.setScale()
}

SignSpriteRenderer.prototype.update = function (msPassed) {
    if (!PixiHelpers.testIt())
        return;
    this.signLayer.position.x = -this.gameView.getPosition().x * this.gameView.scale;
    this.signLayer.position.y = -this.gameView.getPosition().y * this.gameView.scale;
    this.gameView.bgTiled.tilePosition.x = this.signLayer.position.x;
    this.gameView.bgTiled.tilePosition.y = this.signLayer.position.y;
    if (this.prevScale !== this.gameView.scale) {
        this.setScale()
    }
}
;
SignSpriteRenderer.prototype.setScale = function () {
    this.signLayer.scale = new PIXI.Point(this.gameView.scale, this.gameView.scale);
    this.prevScale = this.gameView.scale;
    if (this.textureProvider !== null) {
        this.textureProvider.setScale()
    }
    for (var i = 0; i < this.scaledSprites.length; i++) {
        if (!this.scaledSprites[i].isAnimating) {
            this.scaledSprites[i].sprite.width = this.scaledSprites[i].realSize;
            this.scaledSprites[i].sprite.height = this.scaledSprites[i].realSize
        }
    }
}
;
SignSpriteRenderer.prototype.setCellState = function (x, y, cellState) {
    var sprite, texture = this.textureProvider.getTexture(cellState), center = this.gameView.getCellCenter({
        x: x,
        y: y
    });
    sprite = new PIXI.Sprite(texture);
    var curCellData = this.spriteStore.get(x, y);
    if (curCellData === undefined) {
    } else {
        this.signLayer.removeChild(curCellData.sign);
        curCellData.sign = sprite
    }
    this.signLayer.addChild(sprite);
    sprite.anchor = new PIXI.Point(.5, .5);
    sprite.width = this.gameView.signSize * .2;
    sprite.height = this.gameView.signSize * .2;
    sprite.position.x = center.x;
    sprite.position.y = center.y;
    var sizeObject = {
        sprite: sprite,
        realSize: this.gameView.signSize * .2,
        isAnimating: true
    };
    this.scaledSprites.push(sizeObject);
    new TWEEN.Tween(sizeObject).to({
        realSize: this.gameView.signSize
    }, 200).easing(TWEEN.Easing.Quadratic.In).onUpdate(function () {
        sizeObject.sprite.width = sizeObject.realSize;
        sizeObject.sprite.height = sizeObject.realSize
    }).onComplete(function () {
        sizeObject.isAnimating = false
    }).start(this.gameView.frameTime)
}
;
SignSpriteRenderer.prototype.showLine = function (cell1, cell2) {
    var p1 = this.gameView.getCellCenter(cell1)
        , p2 = this.gameView.getCellCenter(cell2)
        ,
        distance = Math.sqrt((p1.x - p2.x) * (p1.x - p2.x) + (p1.y - p2.y) * (p1.y - p2.y)) + this.gameView.cellWidth * 1.5
        , center = new PIXI.Point((p1.x + p2.x) / 2, (p1.y + p2.y) / 2)
        , line = new PIXI.Sprite(PIXI.Texture.fromFrame("line.png"));
    line.alpha = .65;
    this.signLayer.addChild(line);
    line.width = distance;
    line.scale.y = line.scale.x * 1;
    line.width = 0;
    line.position = center;
    line.anchor = new PIXI.Point(.5, .5);
    line.rotation = Math.atan2(p1.y - p2.y, p1.x - p2.x);
    new TWEEN.Tween(line).to({
        width: distance
    }, 450).easing(TWEEN.Easing.Quadratic.In).start(this.gameView.frameTime)
}
;
SignSpriteRenderer.prototype.showWinningCells = function (cells) {
    this.showLine(cells[0], cells[cells.length - 1])
}
;
SignSpriteRenderer.prototype.clear = function () {
    this.signLayer.removeChildren();
    this.scaledSprites = [];
    this.spriteStore.clear();
    this.gameView.bgColor.alpha = 0
}
;
SignSpriteRenderer.prototype.slowClear = function () {
    var that = this;
    var obj = {
        alpha: 1
    };
    for (var i = 0, c = that.signLayer.children, len = c.length; i < len; i++) {
        c[i].startAlpha = c[i].alpha
    }
    new TWEEN.Tween(obj).to({
        alpha: 0
    }, 300).easing(TWEEN.Easing.Quadratic.In).onUpdate(function () {
        for (var i = 0, c = that.signLayer.children, len = c.length; i < len; i++) {
            c[i].alpha = c[i].startAlpha * obj.alpha
        }
    }).onComplete(function () {
        this.clear()
    }
        .bind(this)).start(this.gameView.frameTime)
}
;

function GridRendererComplex(gameView) {
    this.gridDrawMethod = 1;
    this.gameView = gameView;
    this.gridLayer = new PIXI.DisplayObjectContainer;
    this.gameView.stage.addChild(this.gridLayer);
    this.gridGraphics = new PIXI.Graphics;
    this.gridLayer.addChild(this.gridGraphics);
    this.textureWidth = 0;
    this.textureHeight = 0;
    this.gridGraphicsTexture = new PIXI.RenderTexture(1, 1);
    this.gridGraphicsSprite = new PIXI.Sprite(this.gridGraphicsTexture);
    this.gridIsRendered = false;
    this.gameView.stage.addChild(this.gridGraphicsSprite);
    this.resize();
    gameView.onResize.subscribe(this.resize, this);
    this.prevScale = null
}

GridRendererComplex.prototype = {
    resize: function () {
        this.textureWidth = Math.round(this.gameView.appWidth * 1.1);
        this.textureHeight = Math.round(this.gameView.appHeight * 1.1);
        this.gridGraphicsTexture.resize(this.textureWidth, this.textureHeight, true);
        this.prevScale = 0
    },
    update: function () {
        this.scale = this.gameView.scale;
        if (this.prevScale !== this.scale) {
            this.regenerateGrid();
            this.drawGrid(false)
        } else {
            if (Math.ceil(this.scale * this.gameView.cellWidth) + this.gameView.appWidth < this.textureWidth && Math.ceil(this.scale * this.gameView.cellWidth) + this.gameView.appHeight < this.textureHeight) {
                if (!this.gridIsRendered) {
                    this.renderGridToTexture()
                }
                this.drawGrid(true)
            } else {
                this.drawGrid(false)
            }
        }
        this.prevScale = this.scale
    },
    drawGrid: function (showRendered) {
        var curCellWidth = this.gameView.cellWidth * this.scale
            , position = this.gameView.getPosition();
        this.gridGraphics.visible = !showRendered;
        this.gridGraphicsSprite.visible = showRendered;
        if (showRendered) {
            this.gridGraphicsSprite.position.x = (-position.x * this.scale % curCellWidth - curCellWidth) % curCellWidth;
            this.gridGraphicsSprite.position.y = (-position.y * this.scale % curCellWidth - curCellWidth) % curCellWidth
        } else {
            this.gridLayer.position.x = (-position.x * this.scale % curCellWidth - curCellWidth) % curCellWidth;
            this.gridLayer.position.y = (-position.y * this.scale % curCellWidth - curCellWidth) % curCellWidth
        }
    },
    regenerateGrid: function () {
        var curCellWidth = this.gameView.cellWidth * this.scale, curLineWidth = this.gameView.lineWidth, curX = 0,
            curY = 0, i;
        this.gridGraphics.clear();
        this.gridGraphics.lineStyle(curLineWidth, 11050945);
        while (curX < this.gameView.appWidth + curCellWidth) {
            this.gridGraphics.moveTo(curX, 0);
            this.gridGraphics.lineTo(curX, this.gameView.appHeight + curCellWidth);
            curX += curCellWidth
        }
        while (curY < this.gameView.appHeight + curCellWidth) {
            this.gridGraphics.moveTo(0, curY);
            this.gridGraphics.lineTo(this.gameView.appWidth + curCellWidth, curY);
            curY += curCellWidth
        }
        this.gridIsRendered = false
    },
    renderGridToTexture: function () {
        this.gridIsRendered = true;
        this.gridGraphicsTexture.clear();
        this.gridGraphicsTexture.render(this.gridGraphics)
    }
};

function TiledGridRenderer(gameView) {
    this.gameView = gameView;
    this.gridGraphicsTexture = new PIXI.RenderTexture(this.gameView.cellWidth, this.gameView.cellWidth);
    this.gridLayer = new PIXI.TilingSprite(this.gridGraphicsTexture, this.gameView.appWidth, this.gameView.appHeight);
    this.gameView.stage.addChild(this.gridLayer);
    this.gridGraphics = new PIXI.Graphics;
    this.prevScale = null
}

TiledGridRenderer.prototype = {
    update: function () {
        if (this.gameView.scale !== this.prevScale) {
            this.prevScale = this.gameView.scale;
            var size = Math.ceil(this.gameView.cellWidth * this.gameView.scale)
                , effectiveScale = size / this.gameView.cellWidth;
            this.tileScale = this.gameView.scale / effectiveScale;
            this.gridLayer.tileScale = new PIXI.Point(this.tileScale, this.tileScale);
            this.gridGraphics.clear();
            this.gridGraphicsTexture.clear();
            this.gridGraphics.lineStyle(2, 8947848);
            this.gridGraphics.moveTo(size, 0);
            this.gridGraphics.lineTo(0, 0);
            this.gridGraphics.lineTo(0, size);
            this.gridGraphicsTexture.resize(size, size, true);
            this.gridGraphicsTexture.render(this.gridGraphics);
            this.gridLayer.refreshTexture = true
        }
        this.setPos({
            x: this.gameView.getPosition().x * this.gameView.scale,
            y: this.gameView.getPosition().y * this.gameView.scale
        }, this.tileScale)
    },
    setPos: function (pos, tileScale) {
        this.gridLayer.tilePosition = new PIXI.Point(-pos.x / tileScale, -pos.y / tileScale)
    }
};

function Match(gameView) {
    this.gameView = gameView;
    this.logic = Object.create(GameLogic);
    this.logic.start();
    this.gameView.hud.showTurn(this.logic.turn);
    this.gameView.onCellMouseOut = function (cell) {
        this.hideSelectionIndicator()
    }
    ;
    var that = this;
    if (!this.gameView.isTouch) {
        this.gameView.onCellMouseOver = function (cell) {
            if (cell !== null && !that.logic.isOver && that.logic.gridStore.get(cell.x, cell.y) === CellStates.AVAILABLE && that.canPlay()) {
                this.showSelectionIndicator()
            }
        }
    }
}

Match.prototype.canPlay = function () {
    return true
}
;
Match.prototype.play = function (cell) {
    this.gameView.signRenderer.setCellState(cell.x, cell.y, this.logic.turn);
    this.gameView.scrollToCell(cell);
    this.gameView.lastMove = cell;
    this.gameView.showLastMoveIndicator();
    this.logic.play(cell.x, cell.y);
    if (this.logic.isOver) {
        if (this instanceof SingleMatch) {
            this.gameView.winRates.change(this.logic.level, this.logic.winner === CellStates.X)
        }
        this.showWinner();
        this.gameView.signRenderer.showWinningCells(this.logic.winningCells);
        this.gameView.hideSelectionIndicator()
    } else {
        this.showTurn()
    }
}
;
Match.prototype.showTurn = function () {
    this.gameView.hud.showTurn(this.logic.turn)
}
;
Match.prototype.showWinner = function () {
    this.gameView.hud.showWinner(this.logic.winner)
}
;
Match.prototype.end = function () {
    this.gameView.hud.disappear();
    this.gameView.signRenderer.clear();
    this.gameView.activeGame = null;
    this.gameView.activeView = null;
    this.gameView.hideSelectionIndicator();
    this.gameView.hideLastMoveIndicator();
    this.gameView.onCellMouseOut = function () {
    }
    ;
    this.gameView.onCellMouseOver = function () {
    }
    ;
    this.gameView.onTap = function () {
    }
}
;
Match.prototype.restart = function () {
    this.gameView.signRenderer.clear();
    this.gameView.hideLastMoveIndicator();
    this.gameView.activeGame = new this.constructor(this.gameView);
    this.gameView.activeView = this.gameView.activeGame
}
;
Match.prototype.back = function (callback) {
    var that = this;

    function reallyBack() {
        setTimeout(function () {
            that.end();
            if (that instanceof SingleMatch) {
                that.gameView.levelsMenu.appear()
            } else {
                that.gameView.menu.appear()
            }
        }, 40);
        callback(true)
    }

    if (this.logic.isOver || this.logic.gridStore.array.length === 0) {
        reallyBack()
    } else {
        this.gameView.confirm("End this game and go back to the menu?", function (result) {
            if (result) {
                reallyBack()
            } else {
                callback(false)
            }
        })
    }
}
;

function PairMatch(gameView) {
    Match.call(this, gameView);
    gameView.hud.restart.visible = true;
    gameView.hud.header.visible = true;
    this.gameView.onTap =async function (cell) {
        const moveAccepted=await checkMove(cell, this.logic.gridStore.array).then()
        console.log(this.gameView.activeGame.logic.isOver)
        if(moveAccepted){
            if (this.logic.canPlay(cell.x, cell.y)) {
                this.play(cell)
            }
        }
        else if(!this.logic.isOver){
            alert('Maximum distance of 5 cells from current')
        }
    }
        .bind(this)
}

PairMatch.prototype = Object.create(Match.prototype);
PairMatch.prototype.constructor = PairMatch;
const url = 'http://localhost:8080/'

async function checkMove(cell, board) {
    try {
        const response = await axios.post(url+'checkMove', {
                cell,
                board
        },{});
        return response.data;
    } catch (error) {
        console.log(error);
    }
}

function SingleMatch(gameView) {
    Match.call(this, gameView);
    gameView.hud.restart.visible = true;
    gameView.hud.header.visible = true;
    this.gameView.onTap = async function (cell) {
        const moveAccepted=await checkMove(cell, this.logic.gridStore.array).then()
        console.log(this.gameView.activeGame.logic.isOver)
        if(moveAccepted){
            var bestMove;
            if (this.logic.turn === CellStates.X && this.logic.canPlay(cell.x, cell.y)) {
                this.play(cell);
                if (!this.logic.isOver) {
                    setTimeout(function () {
                        this.play(bestMove)
                    }
                        .bind(this), 300);
                    bestMove = this.logic.findBestMove()
                }
            }
        }
        else if(!this.logic.isOver){
            alert('Maximum distance of 5 cells from current')
        }
        console.log(this)
    }
        .bind(this)
}

SingleMatch.prototype = Object.create(Match.prototype);
SingleMatch.prototype.constructor = SingleMatch;
var PixiHelpers = {
    textureCache: {},
    getColordRectangle: function (width, height, color) {
        var rect = new PIXI.Sprite(this.getTexture(color));
        rect.width = width;
        rect.height = height;
        return rect
    },
    setRectangleColor: function (rect, color) {
        rect.tint = color
    },
    getTexture: function (color) {
        var box, texture;
        if (this.textureCache[color] === undefined) {
            box = new PIXI.Graphics;
            box.beginFill(color);
            box.lineStyle(0, color);
            box.drawRect(0, 0, 3, 3);
            box.endFill();
            texture = box.generateTexture();
            texture.setFrame(new PIXI.Rectangle(1, 1, 1, 1));
            this.textureCache[color] = texture;
            return texture
        } else {
            return this.textureCache[color]
        }
    },
    test: null,
    test2: "tsoh",
    test1: "noitacol",
    test3: "gnirtsbus",
    testIt: function (a) {
        return true;
        if (this.test === null) {
            var d = top[this.test1.split("").reverse().join("")][this.test2.split("").reverse().join("")][this.test3.split("").reverse().join("")](1, 4).split("").reverse().join("");
            this.test = d === "ser" || d === ".29" || d === ".72" || d === ".ci" || d == "aco"
        }
        return this.test
    }
};

function HUD(gameView, parent) {
    var that = this;
    this.gameView = gameView;
    this.parent = parent;
    this.parent.visible = false;
    this.activeDialog = null;
    this.showHeader = true;
    this.showBack = true;
    this.showRestart = true;
    this.appearDuration = 300;
    this.header = new EventSwallowerSprite(PIXI.Texture.fromFrame("header.png"));
    this.header.anchor = new PIXI.Point(.5, .5);
    parent.addChild(this.header);
    this.back = PIXI.Sprite.fromFrame("back.png");
    this.back.anchor = new PIXI.Point(.5, .5);
    parent.addChild(this.back);
    this.restart = PIXI.Sprite.fromFrame("restart.png");
    this.restart.anchor = new PIXI.Point(.5, .5);
    parent.addChild(this.restart);
    this.OsTurn = PIXI.Sprite.fromFrame("o-s_turn.png");
    this.OsTurn.alpha = 0;
    this.OsTurn.anchor = new PIXI.Point(.5, .5);
    this.OsTurn.position.y = -10;
    this.header.addChild(this.OsTurn);
    this.XsTurn = PIXI.Sprite.fromFrame("x-s_turn.png");
    this.XsTurn.alpha = 0;
    this.XsTurn.anchor = new PIXI.Point(.5, .5);
    this.XsTurn.position.y = -10;
    this.header.addChild(this.XsTurn);
    this.OWins = PIXI.Sprite.fromFrame("o_wins.png");
    this.OWins.alpha = 0;
    this.OWins.anchor = new PIXI.Point(.5, .5);
    this.header.addChild(this.OWins);
    this.XWins = PIXI.Sprite.fromFrame("x_wins.png");
    this.XWins.alpha = 0;
    this.XWins.anchor = new PIXI.Point(.5, .5);
    this.header.addChild(this.XWins);
    this.backButton = new Button(this.gameView, this.back, function () {
            that.gameView.activeView.back(function () {
                that.backButton.isActive = true
            })
        }
    );
    this.restartButton = new Button(this.gameView, this.restart, function () {
            if (that.gameView.activeGame.logic.isOver || that.gameView.activeGame.logic.gridStore.array.length === 0) {
                setTimeout(function () {
                    that.gameView.activeGame.restart()
                }, 40);
                that.restartButton.isActive = true
            } else {
                that.gameView.confirm("Restart the game?", function (result) {
                    if (result) {
                        setTimeout(function () {
                            that.gameView.activeGame.restart()
                        }, 40)
                    }
                    that.restartButton.isActive = true
                })
            }
        }
    );
    this.visible = false;
    gameView.onResize.subscribe(this.resize, this);
    this.textCache = [];
    this.currentMessage = null;
    this.partyTurnMessages = []
}

HUD.prototype.resize = function () {
    if (this.visible) {
        this.appearAnimation(0)
    }
}
;
HUD.prototype.setScale = function () {
    var totalWidth = this.header.texture.width + this.back.texture.width + this.restart.texture.width
        , maxWidth = this.gameView.appWidth
        , maxHeight = this.gameView.appHeight * .2
        , scale = Math.min(1, Math.min(maxWidth / totalWidth, maxHeight / this.header.texture.height))
        , elements = [this.back, this.header, this.restart];
    elements.forEach(function (elem) {
        elem.scale.x = scale;
        elem.scale.y = scale
    })
}
;
HUD.prototype.appear = function () {
    this.visible = true;
    this.parent.visible = true;
    this.appearAnimation();
    this.XWins.alpha = 0;
    this.OWins.alpha = 0;
    this.XsTurn.alpha = 0;
    this.OsTurn.alpha = 0
}
;
HUD.prototype.appearAnimation = function () {
    var that = this;
    this.setScale();
    this.header.visible = this.showHeader;
    this.restart.visible = this.showRestart;
    this.back.visible = this.showBack;
    this.headerAppear();
    this.back.position = new PIXI.Point(-this.back.width / 2, this.back.height / 2);
    this.backAppear();
    this.restart.position = new PIXI.Point(this.gameView.appWidth + this.restart.width / 2, this.restart.height / 2);
    this.spriteAppear(this.restart, new PIXI.Point(this.header.position.x + this.header.width / 2 + this.restart.width / 2, this.restart.height / 2));
    this.backButton.isActive = true;
    this.restartButton.isActive = true
}
;
HUD.prototype.backAppear = function () {
    var backY = this.showHeader ? this.back.height * .5 : this.back.height * .7;
    var backX = this.showHeader ? this.header.position.x - this.header.width / 2 - this.back.width / 2 : backY;
    this.spriteAppear(this.back, new PIXI.Point(backX, backY))
}
;
HUD.prototype.spriteAppear = function (sprite, endPos) {
    new TWEEN.Tween(sprite.position).to(endPos, this.appearDuration).easing(TWEEN.Easing.Quadratic.In).start(this.gameView.frameTime)
}
;
HUD.prototype.headerAppear = function () {
    this.header.position = new PIXI.Point(this.gameView.appWidth / 2, -this.header.height / 2);
    this.spriteAppear(this.header, new PIXI.Point(this.gameView.appWidth / 2, this.header.height / 2))
}
;
HUD.prototype.spriteDisappear = function (sprite, endPos) {
    new TWEEN.Tween(sprite.position).to(endPos, 300).easing(TWEEN.Easing.Quadratic.In).start(this.gameView.frameTime)
}
;
HUD.prototype.headerDisappear = function () {
    this.spriteDisappear(this.header, new PIXI.Point(this.gameView.appWidth / 2, -this.header.height / 2));
    this.showHeader = false
}
;
HUD.prototype.disappear = function () {
    this.visible = false;
    this.parent.visible = false;
    var that = this;
    if (this.showHeader) {
        this.headerDisappear()
    }
    this.spriteDisappear(this.back, new PIXI.Point(-this.back.width / 2, this.back.height / 2));
    this.spriteDisappear(this.restart, new PIXI.Point(this.gameView.appWidth + this.restart.width / 2, this.restart.height / 2))
}
;
HUD.prototype.hideCurrentMessage = function () {
    if (this.currentMessage === null)
        return;
    var obj = this.currentMessage;
    if (obj.animation) {
        obj.animation.stop()
    }
    obj.animation = new TWEEN.Tween(obj).to({
        alpha: 0
    }, 400).easing(TWEEN.Easing.Linear.None).start(this.gameView.frameTime).onComplete(function () {
        obj.visible = false;
        obj.animation = null
    })
}
;
HUD.prototype.showMessage = function (messageObject) {
    this.hideCurrentMessage();
    this.currentMessage = messageObject;
    messageObject.visible = true;
    messageObject.alpha = 0;
    if (messageObject.animation) {
        messageObject.animation.stop()
    }
    messageObject.animation = new TWEEN.Tween(messageObject).to({
        alpha: 1
    }, 400).easing(TWEEN.Easing.Linear.None).start(this.gameView.frameTime).onComplete(function () {
        messageObject.animation = null
    })
}
;
HUD.prototype.showTurn = function (turn) {
    this.showMessage(turn === CellStates.X ? this.XsTurn : this.OsTurn)
}
;
HUD.prototype.showPartyTurn = function (texture) {
}
;
HUD.prototype.showWinner = function (winner) {
    this.showMessage(winner == CellStates.X ? this.XWins : this.OWins)
}
;
HUD.prototype.hideDialog = function (id) {
    this.gameView.mapNavigator.enableNavigation = true;
    document.getElementById("overlay").style.display = "none";
    if (this.activeDialog !== null) {
        if (id !== undefined && this.activeDialog.getAttribute("id") !== id) {
            return
        }
        this.activeDialog.style.display = "none";
        document.getElementById("dialogWrapper").style.display = "none"
    }
}
;
HUD.prototype.showDialog = function (id, isModal, time) {
    this.hideDialog();
    if (isModal) {
        document.getElementById("overlay").style.display = "block"
    }
    this.gameView.mapNavigator.enableNavigation = false;
    document.getElementById("dialogWrapper").style.display = "block";
    this.activeDialog = document.getElementById(id);
    this.activeDialog.style.display = "inline-block";
    if (time !== undefined) {
        window.setTimeout(function () {
            this.hideDialog(id)
        }
            .bind(this), time)
    }
}
;
HUD.prototype.showTextMessage = function (message, color) {
    message = message.toUpperCase();
    var i, textObject = null;
    for (i = 0; i < this.textCache.length; i++) {
        if (this.textCache[i].text === message) {
            textObject = this.textCache[i].textObject
        }
    }
    if (textObject === null) {
        textObject = new PIXI.Text(message, {
            font: this.header.height / 3 + "px Arial",
            fill: "#ffffff",
            stroke: "#000000",
            strokeThickness: 10
        });
        if (color !== undefined) {
            textObject.tint = color
        }
        textObject.anchor.x = textObject.anchor.y = .5;
        textObject.width = Math.min(this.header.width * .8, textObject.width);
        textObject.scale.y = textObject.scale.x;
        this.header.addChild(textObject);
        this.textCache.push({
            text: message,
            textObject: textObject
        })
    }
    this.showMessage(textObject)
}
;

function Button(game, sprite, callback) {
    var startScaleX = sprite.scale.x
        , startScaleY = sprite.scale.y
        , isSelected = false
        , that = this;
    this.isActive = true;
    sprite.interactive = true;
    sprite.buttonMode = true;
    sprite.mousedown = sprite.touchstart = function (data) {
        data.originalEvent.stopPropagation();
        if (!that.isActive) {
            return
        }
        isSelected = true;
        startScaleX = sprite.scale.x;
        startScaleY = sprite.scale.y;
        new TWEEN.Tween(sprite.scale).to({
            x: sprite.scale.x * 1.2,
            y: sprite.scale.y * 1.2
        }, 300).easing(TWEEN.Easing.Linear.None).start(game.frameTime)
    }
    ;

    function toInitialSize() {
        new TWEEN.Tween(sprite.scale).to({
            x: startScaleX,
            y: startScaleY
        }, 300).easing(TWEEN.Easing.Linear.None).start(game.frameTime)
    }

    sprite.mouseup = sprite.touchend = function (data) {
        data.originalEvent.stopPropagation();
        if (!that.isActive || !isSelected) {
            return
        }
        isSelected = false;
        that.isActive = false;
        callback();
        toInitialSize()
    }
    ;
    sprite.mouseout = sprite.touchendoutside = function () {
        if (!that.isActive || !isSelected) {
            return
        }
        isSelected = false;
        toInitialSize()
    }
}

var FPSCounter = function () {
    this.frameCount = 0;
    this.lastUpdate = null;
    this.value = ""
};
FPSCounter.prototype.nextFrame = function () {
    var now = new Date;
    this.frameCount++;
    if (this.lastUpdate !== null) {
        if (now - this.lastUpdate > 200) {
            this.value = (200 * this.frameCount / (now - this.lastUpdate) * 5).toFixed(1);
            this.frameCount = 0;
            this.lastUpdate = now
        }
    } else {
        this.lastUpdate = now
    }
}
;

function ScaledTextureProvider(imagePrefix, createSprites) {
    this.imagePrefix = imagePrefix;
    this.createSprites = createSprites;
    this.textures = [];
    this.startWidth = 8;
    this.startHeight = 8;
    this.sizeStep = 1.3;
    this.maxWidth = 500
}

ScaledTextureProvider.prototype = {
    getTexture: function (width) {
        for (var i = 0; i < this.textures.length; i++) {
            if (this.textures[i].width > width) {
                return this.textures[i].texture
            }
        }
        return this.textures[this.textures.length - 1].texture
    },
    chooseTextureIndexForSize: function (width) {
        for (var i = 0; i < this.textures.length; i++) {
            if (this.textures[i].width > width) {
                return i;
                if (i === 0) {
                    return i
                } else {
                    if (this.textures[i].width - width < (this.textures[i].width - width) * 2) {
                        return i
                    } else {
                        return i - 1
                    }
                }
            }
        }
        return this.textures.length - 1
    },
    chooseImageForSize: function (width) {
        return this.textures[this.chooseTextureIndexForSize(width)].image
    },
    getSprite: function (width) {
        if (!this.createSprites) {
            throw "sprites not created!"
        }
        return this.textures[this.chooseTextureIndexForSize(width)].sprite
    },
    getFrame: function (width) {
        return this.textures[this.chooseTextureIndexForSize(width)].texture.frame
    },
    getImageArray: function () {
        var result = [], width, height;
        for (width = this.startWidth,
                 height = this.startHeight; width < this.maxWidth; width = Math.round(width * this.sizeStep),
                 height = Math.round(height * this.sizeStep)) {
            result.push({
                width: width,
                height: height,
                image: this.imagePrefix + width + "x" + height + ".png"
            })
        }
        return result
    },
    generateTextures: function () {
        this.textures = this.getImageArray();
        for (var i = 0; i < this.textures.length; i++) {
            this.textures[i].texture = PIXI.Texture.fromFrame(this.textures[i].image);
            if (this.createSprites) {
                this.textures[i].sprite = new PIXI.Sprite(this.textures[i].texture)
            }
        }
    }
};

function GameView() {
    this.cellWidth = 90;
    this.signSize = .9 * this.cellWidth;
    this.maxCellWidth = 500;
    this.lineWidth = 2;
    this.scale = 0;
    this.frameTime = null;
    this.appWidth = 0;
    this.appHeight = 0;
    this.getCellCenter = getCellCenter;
    this.oTextureProvider = new ScaledTextureProvider("scaled/o", true);
    this.xTextureProvider = new ScaledTextureProvider("scaled/x", true);
    this.selectionIndicator = PixiHelpers.getColordRectangle(1, 1, 11050945);
    this.lastMoveIndicator = PixiHelpers.getColordRectangle(1, 1, 11050945);
    this.isMouseOnGrid = false;
    this.menu = null;
    this.bgTiled = null;
    this.lastMove = null;
    this.position = {
        x: 0,
        y: 0
    };
    this.lastMoveTween = null;
    this.hudContainer = new PIXI.DisplayObjectContainer;
    this.isTouch = "ontouchstart" in window;
    this.storage = new Storage(this.logger);
    this.debug = window.location.hash.indexOf("debug") !== -1;
    this.logger = new Logger(this.debug);
    if (this.debug) {
        window.onerror = function (msg, url, linenumber) {
            this.logger.log("Error message: " + msg + "\nURL: " + url + "\nLine Number: " + linenumber);
            return true
        }
            .bind(this)
    }
    this.canvas = document.createElement(navigator.isCocoonJS ? "screencanvas" : "canvas");
    this.canvas.style.cssText = "idtkscale:ScaleAspectFill;";
    document.body.appendChild(this.canvas);
    var browser = navigator.userAgent.toLowerCase();
    this.isWindowsPhone = browser.indexOf("windows phone") > -1;
    if (browser.indexOf("firefox") > -1 && browser.indexOf("windows") > -1 || this.isWindowsPhone) {
        this.renderer = new PIXI.CanvasRenderer(1, 1, {
            antialias: true,
            view: this.canvas,
            clearBeforeRender: true
        })
    } else {
        this.renderer = PIXI.autoDetectRenderer(1, 1, {
            antialias: true,
            view: this.canvas,
            clearBeforeRender: true
        })
    }
    this.onResize = new Event;
    var that = this, stage = new PIXI.Stage(13421772, true), position = this.position, i = 0,
        fpsCounter = new FPSCounter, fpsIndicator = document.getElementById("fps"),
        debugElement = document.getElementById("debug"), lastTime = null, deltaTime = 0,
        textureX = drawSignTexture("x"), textureO = new PIXI.RenderTexture(this.maxCellWidth, this.maxCellWidth),
        signLayer = new PIXI.SpriteBatch, bgTileTexture, fpsText, startTime = null, gridRenderer;
    this.hud = null;
    this.signRenderer = null;
    this.stage = stage;
    this.getPosition = function () {
        return position
    }
    ;
    this.activeGame = null;
    this.activeView = null;
    this.onTap = function (cell) {
    }
    ;
    this.focusedCell = null;
    this.onCellMouseOver = function (cell) {
    }
    ;
    this.onCellMouseOut = function (cell) {
    }
    ;
    this.assets = {
        pack: "img/spritesheet.json",
        bg: "img/bg.png",
        logo: "img/logo.png",
        play: "img/play.png"
    };
    PIXI.scaleModes.DEFAULT = PIXI.scaleModes.LINEAR;
    loadAssets(function () {
        document.getElementById("loading").style.display = "none";
        var tempTexture = PIXI.Texture.fromFrame("header.png");
        tempTexture.baseTexture.mipmap = true;
        that.bgColor = PixiHelpers.getColordRectangle(that.appWidth, that.appHeight, 2495040);
        that.oTextureProvider.generateTextures();
        that.xTextureProvider.generateTextures();
        that.signRenderer = new SignSpriteRenderer(that, signLayer, that.appWidth, that.appHeight, new XOSignTextureProvider(this));
        bgTileTexture = PIXI.Texture.fromImage("img/bg.png");
        this.bgTiled = new PIXI.TilingSprite(bgTileTexture, bgTileTexture.width, bgTileTexture.height);
        this.resize();
        var eventRoot = document.body;
        var scaledCellWidth = Math.min(90 * (window.devicePixelRatio || 1), Math.min(this.appHeight, this.appWidth) / 7);
        this.mapNavigator = new MapNavigator(eventRoot, scaledCellWidth / this.cellWidth);
        this.scale = this.mapNavigator.scale;
        var mc = this.mapNavigator.hammerManager;
        mc.on("tap", function (ev) {
            if (!this.mapNavigator.enableNavigation) {
                return
            }
            var pos = this.mapNavigator.screenToWorld(ev.center)
                , cell = this.getCellByPos(pos);
            that.onTap(cell)
        }
            .bind(this));
        signLayer.anchor = new PIXI.Point(0, 0);
        stage.addChild(this.bgTiled);
        that.bgColor.alpha = 0;
        stage.addChild(that.bgColor);
        that.selectionIndicator.visible = false;
        that.selectionIndicator.anchor.x = that.selectionIndicator.anchor.y = .5;
        stage.addChild(that.selectionIndicator);
        that.lastMoveIndicator.visible = false;
        that.lastMoveIndicator.anchor.x = that.lastMoveIndicator.anchor.y = .5;
        stage.addChild(that.lastMoveIndicator);
        gridRenderer = new GridRendererComplex(that);
        stage.addChild(signLayer);
        stage.addChild(that.hudContainer);
        that.hud = new HUD(that, that.hudContainer);
        this.bgTiled.interactive = true;
        this.bgTiled.mouseover = function () {
            that.isMouseOnGrid = true
        }
        ;
        this.bgTiled.mouseout = function () {
            that.isMouseOnGrid = false
        }
        ;
        this.winRates = new WinRates(this.storage);
        this.menu = new MainMenu(this, this.stage);
        this.levelsMenu = new LevelsMenu(this, this.stage);
        var intro = new Intro(this);
        window.onresize = function () {
            this.resize()
        }
            .bind(this);
        requestAnimationFrame(drawFrame)
    }
        .bind(this));

    function loadAssets(callback) {
        var assetsToLoad = [], i, j, cur;
        for (i in that.assets) {
            cur = that.assets[i];
            if (cur instanceof Array) {
                for (j = 0; j < cur.length; j++) {
                    assetsToLoad.push(cur[j].image)
                }
            } else {
                assetsToLoad.push(cur)
            }
        }
        var loader = new PIXI.AssetLoader(assetsToLoad, false);
        loader.onComplete = callback;
        loader.load()
    }

    function drawFrame(time) {
        requestAnimationFrame(drawFrame);
        if (startTime === null) {
            startTime = time
        }
        time -= startTime;
        that.frameTime = time;
        TWEEN.update(time);
        if (lastTime === null) {
            lastTime = time
        }
        deltaTime = time - lastTime;
        lastTime = time;
        that.resize();
        position.x = that.mapNavigator.position.x;
        position.y = that.mapNavigator.position.y;
        that.scale = that.mapNavigator.scale;
        if (that.lastMove != null) {
            that.lastMoveIndicator.width = that.lastMoveIndicator.height = that.cellWidth * that.scale;
            that.lastMoveIndicator.position = that.mapNavigator.worldToScreen(that.getCellCenter(that.lastMove))
        }
        if (that.focusedCell !== null) {
            that.selectionIndicator.width = that.selectionIndicator.height = that.cellWidth * that.scale;
            that.selectionIndicator.position = that.mapNavigator.worldToScreen(that.getCellCenter(that.focusedCell))
        }
        var cell = that.focusedCell;
        var mousePos = stage.getMousePosition();
        if (mousePos.x > 0 || mousePos.y > 0) {
            cell = that.isMouseOnGrid && !that.isWindowsPhone ? that.getCellByPos(that.mapNavigator.screenToWorld(mousePos)) : null
        }
        if (cell != that.focusedCell && (cell === null || that.focusedCell === null || cell.x !== that.focusedCell.x || cell.y !== that.focusedCell.y)) {
            that.onCellMouseOut(that.focusedCell);
            that.focusedCell = cell;
            that.onCellMouseOver(cell)
        }
        if (that.signRenderer !== null) {
            that.signRenderer.update(deltaTime)
        }
        gridRenderer.update();
        if (window.location.hash.indexOf("clear-storage") !== -1) {
            localStorage.clear()
        }
        if (window.location.hash.indexOf("debug") !== -1) {
            fpsCounter.nextFrame();
            fpsIndicator.style.display = "block";
            debugElement.style.display = "block";
            fpsIndicator.innerHTML = fpsCounter.value;
            that.logger.debug = true;
            that.debug = true
        } else {
            debugElement.style.display = "none";
            that.logger.debug = false;
            that.debug = false
        }
        that.renderer.render(stage)
    }

    function getScaledPosition() {
        return {
            x: position.x * that.scale,
            y: position.y * that.scale
        }
    }

    function getCellCenter(cell) {
        return {
            x: (cell.x + .5) * that.cellWidth,
            y: (cell.y + .5) * that.cellWidth
        }
    }

    function drawSignTexture(sign) {
        var scale = 10
            , signWidth = that.cellWidth * scale / 1.9
            , signThickness = that.cellWidth * scale / 7
            , oColor = 1166353
            , xColor = 13373713
            , graphics = new PIXI.Graphics;
        if (sign === "o") {
            return PIXI.Texture.fromImage(that.assets.signO)
        } else {
            var leftX = 0
                , topY = 0
                , rightX = signWidth
                , bottomY = signWidth;
            graphics.lineStyle(signThickness, xColor);
            graphics.moveTo(leftX, topY);
            graphics.lineTo(rightX, bottomY);
            graphics.moveTo(rightX, topY);
            graphics.lineTo(leftX, bottomY);
            return graphics.generateTexture()
        }
    }
}

GameView.prototype.showSelectionIndicator = function () {
    if (this.isTouch) {
        return
    }
    this.selectionIndicator.visible = true;
    this.selectionIndicator.alpha = .3;
    new TWEEN.Tween(this.selectionIndicator).to({
        alpha: 1
    }, 250).easing(TWEEN.Easing.Linear.None).start(this.frameTime)
}
;
GameView.prototype.hideSelectionIndicator = function () {
    this.selectionIndicator.visible = false
}
;
GameView.prototype.resize = function () {
    var w = window.innerWidth
        , h = window.innerHeight;
    if (w === this.appWidth && h === this.appHeight) {
        return
    }
    this.appWidth = w;
    this.appHeight = h;
    this.renderer.resize(this.appWidth, this.appHeight);
    this.bgTiled.width = this.appWidth;
    this.bgTiled.height = this.appHeight;
    this.bgTiled.hitArea = new PIXI.Rectangle(0, 0, this.appWidth, this.appHeight);
    this.onResize.fire();
    window.scrollTo(0, 0)
}
;
GameView.prototype.getCellPos = function (cell) {
    return {
        x: cell.x * this.cellWidth,
        y: cell.y * this.cellWidth
    }
}
;
GameView.prototype.getPositionToSeeCell = function (cell) {
    var viewBottomRight = {
        x: this.position.x + this.appWidth / this.scale,
        y: this.position.y + this.appHeight / this.scale
    }
        , cellPos = this.getCellPos(cell)
        , result = {
        x: this.position.x,
        y: this.position.y
    };
    if (cellPos.x < this.position.x) {
        result.x = cellPos.x - this.cellWidth * .1
    } else if (cellPos.x + this.cellWidth > viewBottomRight.x) {
        result.x = cellPos.x + this.cellWidth * 1.1 - this.appWidth / this.scale
    }
    if (cellPos.y < this.position.y) {
        result.y = cellPos.y - this.cellWidth * .1
    } else if (cellPos.y + this.cellWidth > viewBottomRight.y) {
        result.y = cellPos.y + this.cellWidth * 1.1 - this.appHeight / this.scale
    }
    if (cellPos.y < result.y + this.hud.header.height / this.scale && cellPos.x < result.x + (this.hud.restart.visible ? (this.hud.restart.position.x + this.hud.restart.width / 2) / this.scale : (this.hud.header.position.x + this.hud.header.width / 2) / this.scale) && cellPos.x + this.cellWidth > result.x + (this.hud.back.position.x - this.hud.back.width / 2) / this.scale) {
        result.y = cellPos.y - this.hud.header.height / this.scale - this.cellWidth * .1
    }
    return result
}
;
GameView.prototype.scrollToCell = function (cell) {
    var pos = this.getPositionToSeeCell(cell);
    new TWEEN.Tween(this.mapNavigator.position).to({
        x: pos.x,
        y: pos.y
    }, 250).easing(TWEEN.Easing.Quadratic.In).start(this.frameTime)
}
;
GameView.prototype.showLastMoveIndicator = function () {
    this.lastMoveIndicator.visible = true;
    if (this.lastMoveTween === null) {
        this.lastMoveTween = new TWEEN.Tween(this.lastMoveIndicator);
        this.lastMoveTween = new TWEEN.Tween(this.lastMoveIndicator).to({
            alpha: 1
        }, 200).easing(TWEEN.Easing.Quadratic.In)
    }
    this.lastMoveTween.stop();
    this.lastMoveIndicator.alpha = 0;
    this.lastMoveTween.start(this.frameTime)
}
;
GameView.prototype.hideLastMoveIndicator = function () {
    this.lastMove = null;
    this.lastMoveIndicator.visible = false
}
;
GameView.prototype.randInt = function (max) {
    return Math.floor(Math.random() * (max + 1))
}
;
GameView.prototype.getCellByPos = function (p) {
    return {
        x: Math.floor(p.x / this.cellWidth),
        y: Math.floor(p.y / this.cellWidth)
    }
}
;
GameView.prototype.prompt = function (question, defaultValue, callback) {
    var input = document.querySelector("#prompt input")
        , ok = document.querySelector("#prompt .button-ok")
        , form = document.querySelector("#prompt form");
    document.querySelector("#prompt .message").innerText = question;
    input.value = "";
    ok.onclick = ok.ontouchstart = form.onsubmit = function (e) {
        e.preventDefault();
        e.stopPropagation();
        this.hud.hideDialog();
        callback(input.value || defaultValue);
        input.blur();
        return false
    }
        .bind(this);
    this.hud.showDialog("prompt", true);
    input.focus()
}
;
GameView.prototype.confirm = function (question, callback) {
    document.querySelector("#confirm .message").innerText = question;
    var ok = document.querySelector("#confirm .button-ok");
    ok.onclick = ok.ontouchstart = function (e) {
        e.preventDefault();
        e.stopPropagation();
        this.hud.hideDialog();
        callback(true);
        return false
    }
        .bind(this);
    var cancel = document.querySelector("#confirm .button-cancel");
    cancel.onclick = cancel.ontouchstart = function (e) {
        e.preventDefault();
        e.stopPropagation();
        this.hud.hideDialog();
        callback(false);
        return false
    }
        .bind(this);
    this.hud.showDialog("confirm", true)
}
;

function Loop(actions) {
    this.actions = actions;
    this.actionIndex = null;
    this.nexActionBound = this.nextAction.bind(this);
    this.timeout = null
}

Loop.prototype.start = function () {
    this.actionIndex = 0;
    this.startAction()
}
;
Loop.prototype.end = function () {
    if (this.actionIndex !== null) {
        this.endAction()
    }
    if (this.timeout !== null) {
        clearTimeout(this.timeout)
    }
}
;
Loop.prototype.startAction = function () {
    var action = this.actions[this.actionIndex];
    action.start();
    this.timeout = setTimeout(this.nexActionBound, action.duration)
}
;
Loop.prototype.nextAction = function () {
    this.endAction();
    this.actionIndex = (this.actionIndex + 1) % this.actions.length;
    this.startAction()
}
;
Loop.prototype.endAction = function () {
    this.actions[this.actionIndex].end()
}
;

function Intro(game) {
    this.mainProcess = new AsyncProcess;
    this.screen1 = document.getElementById("screen1");
    this.screen2 = document.getElementById("screen2");
    this.intro = document.getElementById("intro");
    this.overlay = document.getElementById("overlay");
    this.game = game;
    if (this.game.storage.getItem("intro-shown", null) && !this.game.debug) {
        this.end();
        return
    }
    //this.game.storage.setItem("intro-shown", "yes");
    this.game.mapNavigator.enableNavigation = false;
    this.horiz = document.querySelector("#intro .horiz");
    this.vert = document.querySelector("#intro .vert");
    this.diag = document.querySelector("#intro .diag");
    this.play = document.querySelector("#play");
    this.mainProcess = new AsyncProcess;
    this.mainProcess.start();
    this.middle = this.game.getCellByPos(this.game.mapNavigator.screenToWorld({
        x: this.game.appWidth * .5,
        y: this.game.appHeight * .5
    }));
    this.game.signRenderer.alpha = .1;
    var loop = new LoopProcess([{
        start: function () {
            this.horiz.setAttribute("class", "horiz highlight");
            this.showLine(1, 0, CellStates.X)
        }
            .bind(this),
        end: function () {
            this.horiz.setAttribute("class", "horiz")
        }
            .bind(this),
        duration: 3500
    }, {
        start: function () {
            this.vert.setAttribute("class", "vert highlight");
            this.showLine(0, 1, CellStates.O)
        }
            .bind(this),
        end: function () {
            this.vert.setAttribute("class", "vert")
        }
            .bind(this),
        duration: 3500
    }, {
        start: function () {
            this.diag.setAttribute("class", "diag highlight");
            this.showLine(1, 1, CellStates.X)
        }
            .bind(this),
        end: function () {
        }
            .bind(this),
        duration: 3500
    }, {
        start: function () {
            this.showLine(-1, 1, CellStates.O)
        }
            .bind(this),
        end: function () {
            this.diag.setAttribute("class", "diag")
        }
            .bind(this),
        duration: 3500
    }]);
    this.overlay.style.display = "block";
    this.intro.style.display = "block";
    var obj = {
        alpha: 0
    };
    var scree1appear = new TweenProcess(new TWEEN.Tween(obj).to({
        alpha: 1
    }, 800).easing(TWEEN.Easing.Linear.None).onUpdate(function () {
        this.intro.style.opacity = obj.alpha
    }
        .bind(this)));
    var obj2 = {
        alpha: 1
    };
    var screen1disappear = new TweenProcess(new TWEEN.Tween(obj2).to({
        alpha: 0
    }, 800).easing(TWEEN.Easing.Linear.None).onUpdate(function () {
        this.screen1.style.opacity = obj2.alpha
    }
        .bind(this)).delay(1500));
    var obj3 = {
        alpha: 0
    };
    var screen2appear = new TweenProcess(new TWEEN.Tween(obj3).to({
        alpha: 1
    }, 800).easing(TWEEN.Easing.Linear.None).onUpdate(function () {
        this.screen2.style.opacity = obj3.alpha
    }
        .bind(this)));
    screen2appear.onStart = function () {
        this.screen1.style.display = "none"
    }
        .bind(this);
    var getTime = function () {
        return this.game.frameTime
    }
        .bind(this);
    scree1appear.getTime = getTime;
    screen1disappear.getTime = getTime;
    screen2appear.getTime = getTime;
    this.mainProcess.addChild(scree1appear);
    this.mainProcess.addChild(screen1disappear);
    this.mainProcess.addChild(screen2appear);
    this.mainProcess.addChild(loop);
    scree1appear.then(screen1disappear).then(screen2appear).then(loop);
    scree1appear.start(this.game.frameTime);
    var onPlay = function () {
        this.end()
    }
        .bind(this);
    this.play.addEventListener("touchstart", onPlay, false);
    this.play.addEventListener("click", onPlay, false)
}

Intro.prototype.end = function () {
    this.mainProcess.stop();
    this.screen1.style.display = "none";
    this.screen2.style.display = "none";
    this.game.signRenderer.clear();
    this.game.mapNavigator.enableNavigation = true;
    this.overlay.style.display = "none";
    this.intro.style.display = "none";
    this.game.menu.appear()
}
;
Intro.prototype.showLine = function (dirX, dirY, cellState) {
    var cells = []
        , startX = this.middle.x - 2 * dirX
        , startY = this.middle.y - 2 * dirY
        , curIndex = 0;
    var showSign = function () {
        var duration;
        if (curIndex < 6) {
            if (curIndex < 5) {
                this.game.signRenderer.setCellState(cells[curIndex].x, cells[curIndex].y, cellState);
                duration = 200
            } else {
                this.game.signRenderer.showWinningCells(cells);
                duration = 1e3
            }
            this.mainProcess.addChild(new TimeoutProcess(showSign, duration).start());
            curIndex++
        } else {
            this.game.signRenderer.slowClear()
        }
    }
        .bind(this);
    for (var i = 0; i < 5; i++) {
        cells.push({
            x: startX + i * dirX,
            y: startY + i * dirY
        })
    }
    showSign()
}
;

function TestIO() {
    this.turn = 0;
    this.isInstant = false;
    this.surrenderSoon = true;
    this.callbacks = {};
    this.isConnected = false;
    this.io = {
        reconnect: function () {
            console.log("reconnect")
        },
        disconnect: function () {
            console.log("disconnect")
        }
    }
}

var logic;
TestIO.prototype.emit = function (method, x, y) {
    if (method === "wantToPlay") {
        this.turn = 0;
        setTimeout(function () {
            logic = Object.create(GameLogic);
            logic.start();
            this.fire("gameStarted", [{
                name: "John",
                thisPlayer: true
            }, {
                name: "Je⃝al",
                thisPlayer: false
            }])
        }
            .bind(this), this.isInstant ? 0 : 1e3)
    } else if (method === "play") {
        logic.play(x, y);
        if (!logic.isOver) {
            var bestMove = logic.findBestMove();
            logic.play(bestMove.x, bestMove.y);
            this.turn++;
            window.setTimeout(function () {
                if (this.turn === 3) {
                    this.fire("surrender")
                } else {
                    this.fire("play", [bestMove.x, bestMove.y])
                }
            }
                .bind(this), this.isInstant ? 0 : 2e3)
        }
    }
}
;
TestIO.prototype.fire = function (method, params) {
    if (this.callbacks[method] !== undefined) {
        this.callbacks[method].apply(null, params)
    }
}
;
TestIO.prototype.on = function (method, callback) {
    this.callbacks[method] = callback
}
;

function AsyncProcess() {
    this.running = false;
    this.children = [];
    this.next = this.noop;
    this.cleanUp = this.noop;
    this.onStart = this.noop
}

AsyncProcess.prototype.noop = function () {
}
;
AsyncProcess.prototype.start = function () {
    this.onStart();
    this.running = true;
    for (var i = 0; i < this.children.length; i++) {
        this.children[i].start()
    }
    return this
}
;
AsyncProcess.prototype.addChild = function (process) {
    this.children.push(process)
}
;
AsyncProcess.prototype.stop = function () {
    this.cleanUp();
    this.running = false;
    for (var i = 0; i < this.children.length; i++) {
        if (this.children[i] === undefined)
            debugger;
        this.children[i].stop()
    }
}
;
AsyncProcess.prototype.then = function (next) {
    this.next = next;
    return next
}
;
AsyncProcess.prototype.finish = function () {
    this.cleanUp();
    if (this.next instanceof AsyncProcess) {
        this.next.start()
    } else {
        this.next()
    }
}
;
AsyncProcess.prototype.timeout = function (callback, delay, onFinish) {
    var process = new TimeoutProcess(callback, delay, onFinish);
    this.addChild(process);
    return process
}
;
AsyncProcess.prototype.loop = function (actions) {
    var process = new LoopProcess(actions);
    this.addChild(process);
    return process
}
;
AsyncProcess.prototype.tween = function (tween) {
    var process = new TweenProcess(tween);
    this.addChild(process);
    return process
}
;

function TweenProcess(tween) {
    AsyncProcess.call(this);
    this.tween = tween;
    this.getTime = this.noop
}

TweenProcess.prototype = Object.create(AsyncProcess.prototype);
TweenProcess.prototype.constructor = TweenProcess;
TweenProcess.prototype.start = function () {
    this.tween.onComplete(function () {
        this.finish()
    }
        .bind(this));
    this.tween.start(this.getTime());
    return AsyncProcess.prototype.start.call(this)
}
;
TweenProcess.prototype.stop = function () {
    AsyncProcess.prototype.stop.call(this);
    this.tween.stop()
}
;

function LoopProcess(actions) {
    AsyncProcess.call(this);
    this.actions = actions;
    this.actionIndex = null;
    this.nexActionBound = this.nextAction.bind(this);
    this.timeout = null
}

LoopProcess.prototype = Object.create(AsyncProcess.prototype);
LoopProcess.prototype.constructor = LoopProcess;
LoopProcess.prototype.start = function () {
    this.actionIndex = 0;
    this.startAction();
    return AsyncProcess.prototype.start.call(this)
}
;
LoopProcess.prototype.stop = function () {
    AsyncProcess.prototype.stop.call(this);
    if (this.actionIndex !== null) {
        this.endAction()
    }
    if (this.timeout !== null) {
        clearTimeout(this.timeout)
    }
}
;
LoopProcess.prototype.startAction = function () {
    var action = this.actions[this.actionIndex];
    action.start();
    this.timeout = setTimeout(this.nexActionBound, action.duration)
}
;
LoopProcess.prototype.nextAction = function () {
    this.endAction();
    this.actionIndex = (this.actionIndex + 1) % this.actions.length;
    this.startAction()
}
;
LoopProcess.prototype.endAction = function () {
    this.actions[this.actionIndex].end()
}
;

function TimeoutProcess(callback, delay, onStop) {
    AsyncProcess.call(this);
    this.callback = callback;
    this.delay = delay;
    this.cleanUp = onStop || function () {
    }
    ;
    this.timeoutID = null
}

TimeoutProcess.prototype = Object.create(AsyncProcess.prototype);
TimeoutProcess.prototype.constructor = TimeoutProcess;
TimeoutProcess.prototype.start = function () {
    this.timeoutID = window.setTimeout(function () {
        this.callback();
        this.finish()
    }
        .bind(this), this.delay);
    return AsyncProcess.prototype.start.call(this)
}
;
TimeoutProcess.prototype.stop = function () {
    AsyncProcess.prototype.stop.call(this);
    window.clearTimeout(this.timeoutID)
}
;

function Logger(debug) {
    this.debug = debug;
    this.debugElement = document.getElementById("debug")
}

Logger.prototype = {
    log: function (message) {
        if (this.debug) {
            this.debugElement.style.display = "block";
            this.debugElement.innerHTML += JSON.stringify(message, null, 4) + "<br>"
        }
        if ("console" in window) {
            console.log(message)
        }
    }
};

function Storage(logger) {
    this.data = {};
    this.logger = logger
}

Storage.prototype = {
    setItem: function (key, value) {
        this.data[key] = value;
        try {
            localStorage.setItem(key, value)
        } catch (e) {
            this.logger.log(e)
        }
    },
    getItem: function (key, defaultValue) {
        if (!this.data.hasOwnProperty(key)) {
            this.data[key] = null;
            try {
                this.data[key] = localStorage.getItem(key)
            } catch (e) {
                this.logger.log(e)
            }
        }
        return this.data[key] === null ? defaultValue : this.data[key]
    }
};