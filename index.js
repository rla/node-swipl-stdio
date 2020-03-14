const path = require('path');
const assert = require('assert');
const EventEmitter = require('events');
const spawn = require('child_process').spawn;
const split = require('split');
const term = require('./lib/term');
const debug = require('debug')('swipl');

// Helper class to track the engine state and
// detect error conditions.

class EngineState extends EventEmitter {

    constructor() {
        super();
        this.setState(EngineState.ACCEPTING);
    }

    isClosed() { return this.state === EngineState.CLOSED; }
    isAccepting() { return this.state === EngineState.ACCEPTING; }
    isQuery() { return this.state === EngineState.QUERY; }

    setAccepting() { this.setState(EngineState.ACCEPTING); }
    setClosed() { this.setState(EngineState.CLOSED); }
    setQuery() { this.setState(EngineState.QUERY); }
    setWaiting() { this.setState(EngineState.WAITING); }

    setState(state) {
        this.state = state;
        debug(`Engine state set to ${state}.`);
        this.emit('change', state);
    }
}

EngineState.ACCEPTING = 'accepting'; // Accepting new queries.
EngineState.QUERY = 'query'; // Has a fresh query instance.
EngineState.WAITING = 'waiting'; // Waiting output from Prolog.
EngineState.CLOSED = 'closed'; // Engine is closed.

// Query waiting for another query to finish.

class QueuedQuery {
    constructor(string, deferred) {
        this.string = string;
        this.deferred = deferred;
    }
}

// Prolog engine. Representing one external
// SWI-Prolog process.

class Engine {

    constructor() {
        const top = path.join(__dirname, 'top.pl');
        this.swipl = spawn('swipl', [
            '-f', top,
            '--no-tty',
            '-q',
            '-t', 'loop',
            '--nodebug',
            '-O'
        ]);
        this.state = new EngineState();
        this.status = 0;
        this.query = null;
        this.queue = [];
        this.swipl.on('close', (code) => {
            this.status = code;
            this.state.setClosed();
        });
        this.state.on('change', () => {     
            if (this.state.isAccepting()) {                
                // If there was queued query then
                // start working on it.
                const queued = this.queue.shift();
                if (queued) {
                    debug('Working on a queued query.');
                    this.query = new Query(this, queued.string);
                    this.state.setQuery();
                    queued.deferred.resolve(this.query);
                }
            }
        });
        this.swipl.stdout.pipe(split()).on('data', (line) => {
            line = line.trim();
            if (line.length === 0) {
                // Last line, empty, do nothing.
                return;
            }
            debug(`Received from Prolog: ${line}.`);
            if (this.state.isClosed()) {
                // Engine is closed. Do nothing.
                return;
            }
            try {
                const obj = JSON.parse(line);                
                if (this.query) {
                    // Pass the response to the query instance.
                    // It will apply changes to the engine state
                    // as well.
                    this.query._response(obj);
                }                
            } catch (err) {
                // Received invalid output from Prolog.
                this.state.setClosed();
                if (this.query && this.query.deferred) {
                    this.query.deferred.reject(err);
                }
                // Reject all queued queries as well.
                for (const queued of this.queue) {
                    queued.reject(new Error('The engine was closed: ' + err));
                }
            }
        });
        // Stderr of SWI-Prolog is just redirected
        // to the main stderr.
        this.swipl.stderr.on('data', (data) => {
            process.stderr.write(data);
        });
    }

    // Creates a new Query instance on this engine.

    async createQuery(string) {
        assert.equal(typeof string, 'string',
            'Query must be a string.');
        assert.ok(!this.state.isClosed(),
            'Engine must not be closed.');        
        if (this.state.isAccepting()) {
            // Query can be executed right now.
            this.query = new Query(this, string);
            this.state.setQuery();
            return this.query;
        } else {
            debug('Engine busy, putting query into a queue.');
            // Query cannot be executed now. It is put into
            // a queue waiting until the query can be worked on.
            const deferred = new Deferred();
            this.queue.push(new QueuedQuery(string, deferred));
            return deferred.promise;
        }
    }

    // Helper around createQuery to extract single
    // solution.
    
    async call(string) {
        const query = await this.createQuery(string);
        try {
            // Wait until respone comes in
            // before closing the query.
            return await query.next();
        } finally {
            await query.close();
        }
    }

    // Closes the engine. Stops the Prolog process.
    
    close() {
        this.swipl.kill();
        this.state.setClosed();
    }

    _sendQuery(string) {
        assert.ok(this.state.isQuery(),
            'Engine has query.');
        this._sendObject({ query: string });
    }

    _sendNext() {
        debug('Requesting next solution.');
        assert.ok(this.state.isQuery(),
            'Engine has query.');
        this._sendObject({ action: 'next' });
    }

    _sendClose() {
        assert.ok(this.state.isQuery(),
            'Engine has query.');
        this._sendObject({ action: 'close' });
    }

    _sendObject(obj) {        
        const json = JSON.stringify(obj);
        debug(`Sending to Prolog: ${json}.`);
        this.swipl.stdin.write(`${json}\n`);
        this.state.setWaiting();
    }
}

// Helper class to track the query state and
// detect error conditions.

class QueryState {

    constructor() { this.setState(QueryState.FRESH); }

    setWaiting() { this.setState(QueryState.WAITING); }
    setOpen() { this.setState(QueryState.OPEN); }
    setClosed() { this.setState(QueryState.CLOSED); }

    isFresh() { return this.state === QueryState.FRESH; }
    isOpen() { return this.state === QueryState.OPEN; }
    isWaiting() { return this.state === QueryState.WAITING; }
    isClosed() { return this.state === QueryState.CLOSED; }

    setState(state) {
        this.state = state;
        debug(`Query state set to ${state}.`);
    }
}

QueryState.FRESH = 'fresh'; // No query sent to Prolog yet.
QueryState.OPEN = 'open'; // Query sent to Prolog. Not waiting.
QueryState.WAITING = 'waiting'; // Waiting for input from Prolog.
QueryState.CLOSED = 'closed'; // No more answers/error.

class Query {

    constructor(engine, string) {
        this.query = string;
        this.engine = engine;
        this.deferred = null;
        this.state = new QueryState();
    }

    // Finds next solution. Returns a promise that
    // resolves to the bindings object or false.
    // In case of an error, the promise is rejected.

    async next() {
        if (this.state.isFresh()) {
            this.engine._sendQuery(this.query);
            this.deferred = new Deferred();
            this.state.setWaiting();
            return this.deferred.promise;
        } else if (this.state.isOpen()) {
            this.engine._sendNext();
            this.deferred = new Deferred();
            this.state.setWaiting();
            return this.deferred.promise;
        } else {
            throw new Error(`Invalid query state ${this.state.state}.`);
        }        
    }

    // Closes the query.

    async close() {
        if (this.state.isClosed()) {
            return Promise.resolve();
        } else if (this.state.isOpen()) {
            this.deferred = new Deferred();
            this.engine._sendClose();
            this.state.setWaiting();
            return this.deferred.promise;
        } else if (this.state.isFresh()) {
            this.state.setClosed();
            this.engine.state.setAccepting();
            return Promise.resolve();
        } else {
            throw new Error(`Invalid query state ${this.state.state}.`);
        }
    }

    // Receives response from Prolog.

    _response(obj) {
        assert(this.state.isWaiting(),
            'Query is waiting for response.');
        if (obj.status === 'success') {
            this.state.setOpen();
            this.deferred.resolve(obj.bindings);
            this.engine.state.setQuery();
        } else if (obj.status === 'fail') {
            this.state.setClosed();
            this.deferred.resolve(false);
            this.engine.query = null;
            this.engine.state.setAccepting();
        } else if (obj.status === 'error') {
            this.state.setClosed();
            this.deferred.reject(new Error(obj.error));
            this.engine.query = null;
            this.engine.state.setAccepting();
        }
    }
}

// Helper class to create a deferred promise.

class Deferred {

    constructor() {
        this.promise = new Promise((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        });
    }
}

module.exports = { Engine, term };
