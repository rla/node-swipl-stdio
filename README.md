# node-swipl-stdio

A Node.js interface to the SWI-Prolog communicating over stdio.
This interface fixes multiple issues found when developing [node-swipl][node-swipl].

[node-swipl]:https://github.com/rla/node-swipl

It is currently work-in-progress!

The issues fixed are:

 * No native code to maintain.
 * No compiler/linker needed during installation.
 * No need to set SWI-Prolog environment variables.
 * Queries are asynchronous, not blocking the event loop.
 * Unicode atoms work correctly.
 * Dicts can be exported from SWI-Prolog.
 * Concurrent queries by using multiple engines.

## Installation:

You need to have SWI-Prolog installed and `swipl` binary available in `PATH`.

```
npm install swipl-stdio
```

### Constructing safe queries

Queries with data requiring proper escaping can be constructed
by using helper functions from swipl.term.

Example:

```js
const swipl = require('swipl-stdio');
const { list, compound, variable, serialize } = swipl.term;

const safe = serialize(
    compound('member', [
        variable('X'),
        list([1, 2, 3, 4])]));

console.log(safe);
```

Blobs are not supported.

## License

The codebase uses 2-Clause BSD license. See the LICENSE file.
