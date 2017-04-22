const assert = require('assert');
const serializeString = require('./serialize_string');

const QUOTE = "'";

// Helper to convert term object into
// a string representation.

const serialize = (term) => {
    if (typeof term.toProlog === 'function') {
        return term.toProlog();
    } else if (typeof term === 'string') {
        return serializeString(term, QUOTE);
    } else if (typeof term === 'number') {
        return term.toString();
    } else if (typeof term === 'undefined') {
        return 'undefined';
    } else if (term === null) {
        return 'null';
    } else {
        throw new Error(`Invalid term: ${term}`);
    }
};

// Helpers to construct and escape query values.

class List {

    constructor(items) {
        assert.ok(Array.isArray(items),
            'List items must be an array.');
        this.items = items;
    }

    toProlog() {
        return '[' + this.items.map(serialize).join(',') + ']';
    }
};

class Variable {

    constructor(name) {
        assert.equal(typeof name, 'string',
            'Compound name must be a string.');
        assert.ok(name.match(/^[A-Z_][A-Za-z0-9]*$/),
            'Variable name must match the pattern ^[A-Z_][A-Za-z0-9]*$.');
        this.name = name;
    }

    toProlog() {
        return this.name;
    }
};

class Compound {

    constructor(name, args) {
        assert.equal(typeof name, 'string',
            'Compound name must be a string.');
        assert.ok(Array.isArray(args),
            'Compound arguments must be an array.');
        this.name = name;
        this.args = args;
    }

    toProlog() {
        return serializeString(this.name, QUOTE) + '(' + this.args.map(serialize).join(',') + ')';
    }
};

class Dict {

    constructor(tag, content) {
        assert.ok(typeof tag === 'string' || tag instanceof Variable,
            'Dict tag must be a string or a variable.');
        assert.ok(typeof content === 'object' && content !== null,
            'Dict content must be an object.');
        this.tag = tag;
        this.content = content;
    }

    toProlog() {
        const entries = Object.keys(this.content).map((key) => {
            return serializeString(key, QUOTE) + ':' + serialize(this.content[key]);
        });
        return serialize(this.tag, QUOTE) + '{' + entries.join(',') + '}';
    }
}

const list = (items) => {
    return new List(items);
};

const variable = (name) => {
    return new Variable(name);
};

const compound = (name, args) => {
    return new Compound(name, args);
};

const dict = (tag, content) => {
    return new Dict(tag, content);
};

module.exports = {
    list,
    variable,
    compound,
    dict,
    serialize
};
