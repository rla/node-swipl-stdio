const assert = require('assert');
const spawn = require('child_process').spawn;
const split = require('split');
const term = require('./lib/term');
const debug = require('debug')('swipl');

// Helper class to track the engine state and
// detect error conditions.

class EngineState {

    constructor() { this.setState(EngineState.ACCEPTING); }    

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
    }
}

EngineState.ACCEPTING = 'accepting'; // Accepting new queries.
EngineState.QUERY = 'query'; // Has a fresh query instance.
EngineState.WAITING = 'waiting'; // Waiting output from Prolog.
EngineState.CLOSED = 'closed'; // Engine is closed.

// Prolog engine. Representing one external
// SWI-Prolog process.

class Engine {

    constructor() {
        this.swipl = spawn('swipl', [
            '-f', 'top.pl',
            '-tty',
            '-q',
            '-t', 'loop'
        ]);
        this.state = new EngineState();
        this.status = 0;
        this.query = null;
        this.swipl.on('close', (code) => {
            this.status = code;
            this.state.setClosed();
        });
        this.swipl.stdout.pipe(split()).on('data', (line) => {
            line = line.trim();
            if (line.length === 0) {
                return;
            }
            debug(`Received from Prolog: ${line}.`);
            if (this.state.isClosed()) {
                return;
            }
            try {
                const obj = JSON.parse(line);                
                if (this.query) {
                    this.query._response(obj);
                }                
            } catch (err) {
                // Received invalid output from Prolog.
                this.state.setClosed();
                if (this.query && this.query.deferred) {
                    this.query.deferred.reject(err);
                }
            }
        });
        this.swipl.stderr.on('data', (data) => {
            process.stderr.write(data);
        });
    }

    // Creates a new Query instance on this engine.

    createQuery(string) {
        assert.ok(this.state.isAccepting(),
            'Engine is ready for new queries.');
        this.query = new Query(this, string);
        this.state.setQuery();
        return this.query;
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

    next() {
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

    close() {
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
