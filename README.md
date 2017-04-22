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

### Output term representation

Prolog terms in variable bindings are converted into
JavaScript objects under the following rules:

 * Integers are converted to numbers.
 * Floats are converted to numbers.
 * Atoms and strings are converted to strings.
 * Empty list is converted to string `[]`.
 * List head tail pair is converted to object `{ head, tail }` where
   `head` and `tail` are converted terms.
 * Compound term is converted to object `{ name, args }` where
   `name` is the compound functor name and `args` is the array
   of converted argument terms.
 * Dict is converted to object `{ tag, content }` where `tag`
   is the dict tag (either string or a variable) and `content`
   is an object representing the dict contents.
 * Blobs are not supported.

### Constructing safe queries

Queries with data requiring proper escaping can be constructed
by using helper functions from swipl.term.

Example:

```js
const swipl = require('swipl-stdio');
const { list, compound, variable, dict, serialize } = swipl.term;

const safe = serialize(
    compound('member', [
        variable('X'),
        list([1, 2, 3, 4])]));

console.log(safe);
```

Compound terms are created with the function:

```
compound(name, args)
```

Variables are created with the function:

```
variable(name)
```

Where `name` matches the pattern `^[A-Z_][A-Za-z0-9]*`.

Lists are created with the function:

```
list(items)
```

Dicts are created with the function:

```
dict(tag, content)
```

Where `tag` is a string or a variable and `content` is an object.
The properties of the `content` object are turned into the dict
entries.

Blobs are not supported.

### Debugging

Run with `DEBUG=swipl node your_code.js`. To write debugging output
from SWI-Prolog, write to stderr.

Example:

```prolog
format(user_error, 'Output to stderr.~n', []).
```

Or use the `debug` library which writes its output to stderr as well:
<http://www.swi-prolog.org/pldoc/man?section=debug>

Normal output from SWI-Prolog (`write(something)`) has been also redirected
through stderr.

## License

The codebase uses 2-Clause BSD license. See the LICENSE file.
